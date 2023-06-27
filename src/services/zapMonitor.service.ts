import {
	spiderStart,
	spiderStop,
	spiderStatusStream,
	spiderFullResults,
	ajaxStart,
	ajaxStatusStream, //
	ajaxFullResults,
	passiveStart,
	passiveStatusStream,
	activeStart,
	activeStatusStream,
	stopZapClient,
	sharedClientId,
	getClientAlerts,
	getClientAlertsByRisk,
} from "./zapClient.service";
import { BehaviorSubject, Connectable, connectable, delayWhen, distinctUntilChanged, finalize, from, identity, of, Subject, takeUntil, tap } from "rxjs";
import { mainProc } from "./logging.service";
import { genSHA512 } from "../utils/crypto";
import { ObjectId } from "bson";
import { zapActiveScanFullResultsModel, zapAjaxScanFullResultsModel, zapPassiveScanFullResultsModel, zapSpiderScanFullResultsModel } from "../models/scan-fullresults.model";
import { scanSessionModel } from "../models";
import { ScanState, TZapAjaxStreamStatus } from "../utils/types";

type TMonitorSessionId = {
	clientId: string;
	scanId: string;
};

type TMonitorSessionIdHash = string;

const monitoringSessions: Map<
	TMonitorSessionIdHash,
	{
		status$: Connectable<{ status: string | TZapAjaxStreamStatus; recordsToScan?: string }>;
		stopMonitorSignal$: Subject<boolean>;
	}
> = new Map();

// BEGIN ZAP SPIDER
export async function spiderStartAndMonitor(sessionId: ObjectId | null, url: string, config: any, emitDistinct?: boolean, removeOnDone?: boolean): Promise<string | undefined> {
	const startResult = await spiderStart(sharedClientId, url, config);

	if (!startResult) {
		mainProc.error("Failed to start spider, nothing to monitor");
		return undefined;
	}

	const { clientId, scanId } = startResult;

	const monitorId: TMonitorSessionId = {
		clientId,
		scanId,
	};
	const monitorHash = genSHA512(monitorId);

	const rawStatus$ = spiderStatusStream(sharedClientId, scanId);
	if (!rawStatus$) {
		mainProc.error("Failed to get spider status stream, nothing to monitor");
		return undefined;
	}

	const stopMonitorSignal$ = new Subject<boolean>();
	let resultSavedToDb = false;
	type SpiderStatus = { status: string };

	const saveResultToDb = (val: SpiderStatus): Promise<SpiderStatus> =>
		new Promise(async (resolve) => {
			const fullResults = await spiderFullResults(sharedClientId, scanId);
			if (!fullResults) {
				mainProc.error(`Failed to get spider full results of client ${clientId}, scanId ${scanId}`);
				await scanSessionModel
					.findByIdAndUpdate(sessionId, {
						status: {
							state: ScanState.FAILED,
							message: "Failed to get spider full results.",
						},
					})
					.exec()
					.catch((error) => {
						mainProc.error(`Error while update scan state to spider session: ${error}`);
					});
			} else {
				const fullResultsDoc = new zapSpiderScanFullResultsModel({
					sessionPop: sessionId,
					fullResults,
				});
				await fullResultsDoc.save().catch((error) => {
					mainProc.error(`Error while saving spider full results: ${error}`);
				});
				await scanSessionModel
					.findByIdAndUpdate(sessionId, {
						status: {
							state: ScanState.SUCCESSFUL,
						},
					})
					.exec()
					.catch((error) => {
						mainProc.error(`Error while update scan state to spider session: ${error}`);
					});
			}

			resultSavedToDb = true;
			resolve(val);
		});

	const status$ = connectable(
		rawStatus$.pipe(
			takeUntil(stopMonitorSignal$),
			delayWhen((val) => {
				if (parseInt(val.status) !== 100 || sessionId === null) return of(val);

				if (resultSavedToDb) {
					stopMonitorSignal$.next(true);
					return of(val);
				}

				return from(saveResultToDb(val));
			}),
			emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
			finalize(async () => {
				await spiderStop(sharedClientId, scanId, removeOnDone);
				monitoringSessions.delete(monitorHash);
			}),
		),
		{
			connector: () => new BehaviorSubject({ status: "0" }),
			resetOnDisconnect: false,
		},
	);

	monitoringSessions.set(monitorHash, { status$, stopMonitorSignal$ });
	monitoringSessions.get(monitorHash)!.status$.connect();
	monitoringSessions.get(monitorHash)!.status$.subscribe();

	return startResult.scanId;
}

export function spiderSharedStatusStream(scanId: string): Connectable<{ status: string }> | undefined {
	const monitorId: TMonitorSessionId = { clientId: sharedClientId, scanId };
	return monitoringSessions.get(genSHA512(monitorId))?.status$ as Connectable<{ status: string }>;
}

export function spiderSignalStop(scanId: string): void {
	const monitorId: TMonitorSessionId = { clientId: sharedClientId, scanId };
	const monitorHash = genSHA512(monitorId);

	if (!monitoringSessions.has(monitorHash)) {
		mainProc.warn(`Stop spider with wrong id: ${scanId}`);
		return;
	}

	monitoringSessions.get(monitorHash)!.stopMonitorSignal$.next(true);
}
// END ZAP SPIDER

// BEGIN ZAP AJAX
export async function ajaxStartAndMonitor(sessionId: ObjectId, url: string, config: any, emitDistinct?: boolean): Promise<string | undefined> {
	const clientId = await ajaxStart(undefined, url, config);

	if (!clientId) {
		mainProc.error("Failed to start ajax, nothing to monitor");
		return undefined;
	}

	const monitorId: TMonitorSessionId = {
		clientId,
		scanId: "0",
	};
	const monitorHash = genSHA512(monitorId);

	const rawStatus$ = ajaxStatusStream(clientId);
	if (!rawStatus$) {
		mainProc.error("Failed to get ajax status stream, nothing to monitor");
		return undefined;
	}

	const stopMonitorSignal$ = new Subject<boolean>();
	let resultSavedToDb = false;
	type AjaxStatus = { status: TZapAjaxStreamStatus };

	const saveResultToDb = (val: AjaxStatus): Promise<AjaxStatus> =>
		new Promise(async (resolve) => {
			const fullResults = await ajaxFullResults(clientId);
			if (!fullResults) {
				mainProc.error(`Failed to get ajax full results of client ${clientId}`);
				await scanSessionModel
					.findByIdAndUpdate(sessionId, {
						status: {
							state: ScanState.FAILED,
							message: "Failed to get ajax full results.",
						},
					})
					.exec()
					.catch((error) => {
						mainProc.error(`Error while update scan state to ajax session: ${error}`);
					});
			} else {
				const fullResultsDoc = new zapAjaxScanFullResultsModel({
					sessionPop: sessionId,
					fullResults,
				});
				await fullResultsDoc.save().catch((error) => {
					mainProc.error(`Error while saving ajax full results: ${error}`);
				});
				await scanSessionModel
					.findByIdAndUpdate(sessionId, {
						status: {
							state: ScanState.SUCCESSFUL,
						},
					})
					.exec()
					.catch((error) => {
						mainProc.error(`Error while update scan state to ajax session: ${error}`);
					});
			}

			resultSavedToDb = true;
			resolve(val);
		});

	const status$ = connectable(
		rawStatus$.pipe(
			takeUntil(stopMonitorSignal$),
			delayWhen((val) => {
				if (val.status !== "stopped" || sessionId === null) return of(val);

				if (resultSavedToDb) {
					stopMonitorSignal$.next(true);
					return of(val);
				}

				return from(saveResultToDb(val));
			}),
			emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
			finalize(async () => {
				await stopZapClient(clientId);
				monitoringSessions.delete(monitorHash);
			}),
		),
		{
			connector: () => new BehaviorSubject({ status: "running" }),
			resetOnDisconnect: false,
		},
	);

	monitoringSessions.set(monitorHash, { status$, stopMonitorSignal$ });
	monitoringSessions.get(monitorHash)!.status$.connect();
	monitoringSessions.get(monitorHash)!.status$.subscribe();

	return clientId;
}

export function ajaxSharedStatusStream(clientId: string): Connectable<{ status: TZapAjaxStreamStatus }> | undefined {
	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	return monitoringSessions.get(genSHA512(monitorId))?.status$ as Connectable<{ status: TZapAjaxStreamStatus }>;
}

export function ajaxSignalStop(clientId: string): void {
	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	const monitorHash = genSHA512(monitorId);

	if (!monitoringSessions.has(monitorHash)) {
		mainProc.warn(`Stop ajax with wrong id: ${clientId}`);
		return;
	}

	monitoringSessions.get(monitorHash)!.stopMonitorSignal$.next(true);
}
// END ZAP AJAX

// BEGIN ZAP PASSIVE
export async function passiveStartAndMonitor(sessionId: ObjectId, url: string, exploreType: "spider" | "ajax", exploreConfig: any, emitDistinct?: boolean): Promise<string | undefined> {
	const clientId = await passiveStart(url, exploreType, exploreConfig);

	if (!clientId) {
		mainProc.error("Failed to start passive, nothing to monitor");
		return undefined;
	}

	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	const monitorHash = genSHA512(monitorId);

	const rawStatus$ = passiveStatusStream(clientId, exploreType);
	if (!rawStatus$) {
		mainProc.error("Failed to get passive status stream, nothing to monitor");
		return undefined;
	}

	const stopMonitorSignal$ = new Subject<boolean>();
	let resultSavedToDb = false;
	type PassiveStatus = {
		status: string | TZapAjaxStreamStatus | "explored";
		recordsToScan?: string;
	};

	const saveResultToDb = (val: PassiveStatus): Promise<PassiveStatus> =>
		new Promise(async (resolve) => {
			const alertsResults = await getClientAlerts(clientId);
			const alertByRiskResults = await getClientAlertsByRisk(clientId);

			if (!alertsResults || !alertByRiskResults) {
				mainProc.error(`Failed to get passive full results of client ${clientId}`);
				await scanSessionModel
					.findByIdAndUpdate(sessionId, {
						status: {
							state: ScanState.FAILED,
							message: "Failed to get passive full results.",
						},
					})
					.exec()
					.catch((error) => {
						mainProc.error(`Error while update scan state to passive session: ${error}`);
					});
			} else {
				const fullResultsDoc = new zapPassiveScanFullResultsModel({
					sessionPop: sessionId,
					fullResults: {
						alertsByRisk: alertByRiskResults,
						alerts: alertsResults,
					},
				});
				await fullResultsDoc.save().catch((error) => {
					mainProc.error(`Error while saving passive full results: ${error}`);
				});
				await scanSessionModel
					.findByIdAndUpdate(sessionId, {
						status: {
							state: ScanState.SUCCESSFUL,
						},
					})
					.exec()
					.catch((error) => {
						mainProc.error(`Error while update scan state to passive session: ${error}`);
					});
			}

			resultSavedToDb = true;
			resolve(val);
		});

	const status$ = connectable(
		rawStatus$.pipe(
			takeUntil(stopMonitorSignal$),
			delayWhen((val) => {
				if (val.recordsToScan === undefined || parseInt(val.recordsToScan) !== 0 || sessionId === null) return of(val);

				if (resultSavedToDb) {
					stopMonitorSignal$.next(true);
					return of(val);
				}

				return from(saveResultToDb(val));
			}),
			emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status && prev.recordsToScan === cur.recordsToScan) : identity,
			finalize(async () => {
				await stopZapClient(clientId);
				monitoringSessions.delete(monitorHash);
			}),
		),
		{
			connector: () =>
				new BehaviorSubject({
					status: "0",
					recordsToScan: undefined,
				}),
			resetOnDisconnect: false,
		},
	);

	monitoringSessions.set(monitorHash, { status$, stopMonitorSignal$ });
	monitoringSessions.get(monitorHash)!.status$.connect();
	monitoringSessions.get(monitorHash)!.status$.subscribe();

	return clientId;
}

export function passiveSharedStatusStream(clientId: string): Connectable<{ status: string | TZapAjaxStreamStatus | "explored"; recordsToScan?: string }> | undefined {
	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	return monitoringSessions.get(genSHA512(monitorId))?.status$;
}

export function passiveSignalStop(clientId: string): void {
	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	const monitorHash = genSHA512(monitorId);

	if (!monitoringSessions.has(monitorHash)) {
		mainProc.warn(`Stop passive with wrong id: ${clientId}`);
		return;
	}

	monitoringSessions.get(monitorHash)!.stopMonitorSignal$.next(true);
}
// END ZAP PASSIVE

// BEGIN ZAP ACTIVE
export async function activeStartAndMonitor(
	sessionId: ObjectId,
	url: string,
	exploreType: "spider" | "ajax",
	exploreConfig: any,
	activeConfig: any,
	emitDistinct?: boolean,
): Promise<
	| {
			scanId: string;
			clientId: string;
	  }
	| undefined
> {
	const result = await activeStart(url, exploreType, exploreConfig, activeConfig);

	if (!result) {
		mainProc.error("Failed to start active, nothing to monitor");
		return undefined;
	}

	const { clientId, scanId } = result;

	const monitorId: TMonitorSessionId = {
		clientId,
		scanId,
	};
	const monitorHash = genSHA512(monitorId);

	const rawStatus$ = activeStatusStream(clientId, scanId);
	if (!rawStatus$) {
		mainProc.error("Failed to get active status stream, nothing to monitor");
		return undefined;
	}

	const stopMonitorSignal$ = new Subject<boolean>();
	let resultSavedToDb = false;
	type ActiveStatus = { status: string };

	const saveResultToDb = (val: ActiveStatus): Promise<ActiveStatus> =>
		new Promise(async (resolve) => {
			const alertsResults = await getClientAlerts(clientId);
			const alertByRiskResults = await getClientAlertsByRisk(clientId);

			if (!alertsResults || !alertByRiskResults) {
				mainProc.error(`Failed to get active full results of client ${clientId}`);
				await scanSessionModel
					.findByIdAndUpdate(sessionId, {
						status: {
							state: ScanState.FAILED,
							message: "Failed to get active full results.",
						},
					})
					.exec()
					.catch((error) => {
						mainProc.error(`Error while update scan state to active session: ${error}`);
					});
			} else {
				const fullResultsDoc = new zapActiveScanFullResultsModel({
					sessionPop: sessionId,
					fullResults: {
						alertsByRisk: alertByRiskResults,
						alerts: alertsResults,
					},
				});
				await fullResultsDoc.save().catch((error) => {
					mainProc.error(`Error while saving active full results: ${error}`);
				});
				await scanSessionModel
					.findByIdAndUpdate(sessionId, {
						status: {
							state: ScanState.SUCCESSFUL,
						},
					})
					.exec()
					.catch((error) => {
						mainProc.error(`Error while update scan state to active session: ${error}`);
					});
			}

			resultSavedToDb = true;
			resolve(val);
		});

	const status$ = connectable(
		rawStatus$.pipe(
			takeUntil(stopMonitorSignal$),
			delayWhen((val) => {
				if (parseInt(val.status) !== 100 || sessionId === null) return of(val);

				if (resultSavedToDb) {
					stopMonitorSignal$.next(true);
					return of(val);
				}

				return from(saveResultToDb(val));
			}),
			emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
			finalize(async () => {
				await stopZapClient(clientId);
				monitoringSessions.delete(monitorHash);
			}),
		),
		{
			connector: () => new BehaviorSubject({ status: "0" }),
			resetOnDisconnect: false,
		},
	);

	monitoringSessions.set(monitorHash, { status$, stopMonitorSignal$ });
	monitoringSessions.get(monitorHash)!.status$.connect();
	monitoringSessions.get(monitorHash)!.status$.subscribe();

	return result;
}

export function activeSharedStatusStream(clientId: string): Connectable<{ status: string }> | undefined {
	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	return monitoringSessions.get(genSHA512(monitorId))?.status$ as Connectable<{ status: string }>;
}

export function activeSignalStop(clientId: string, scanId: string): void {
	const monitorId: TMonitorSessionId = { clientId, scanId };
	const monitorHash = genSHA512(monitorId);

	if (!monitoringSessions.has(monitorHash)) {
		mainProc.warn(`Stop active with wrong id: ${clientId}`);
		return;
	}

	monitoringSessions.get(monitorHash)!.stopMonitorSignal$.next(true);
}
// END ZAP ACTIVE

// BEGIN UTILS
const reusableZapPorts: Set<number> = new Set();
let curAvailablePort = 9000;

export function zapGetAvailablePort(): number {
	const port: number | undefined = reusableZapPorts.values().next().value;
	if (port) {
		reusableZapPorts.delete(port);
		return port;
	}
	return curAvailablePort++;
}

export function zapReturnUsedPort(port: number): void {
	reusableZapPorts.add(port);
}
// END UTILS
