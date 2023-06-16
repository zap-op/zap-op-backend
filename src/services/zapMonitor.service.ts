import { ajaxStatusStream, spiderStop, spiderStatusStream, spiderStart, ajaxStart, spiderFullResults, ajaxFullResults, sharedClientId, stopZapClient, passiveStart, passiveStatusStream, activeStart, activeStatusStream, activeFullResults, passiveFullResults } from "./zapClient.service";
import { BehaviorSubject, Connectable, connectable, distinctUntilChanged, finalize, identity, Subject, takeUntil, tap } from "rxjs";
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
		status$: Connectable<{ status: string } | { status: TZapAjaxStreamStatus } | { recordsToScan: string }>;
		stopSignal$: Subject<boolean>;
	}
> = new Map();

// BEGIN ZAP SPIDER
export async function spiderStartAndMonitor(sessionId: ObjectId | null, url: string, config: any, emitDistinct?: boolean, removeOnDone?: boolean): Promise<string | undefined> {
	const startResult = await spiderStart(sharedClientId, url, config);

	if (!startResult) {
		mainProc.error("Failed to start spider, nothing to monitor");
		return undefined;
	}

	const monitorId: TMonitorSessionId = { clientId: startResult.clientId, scanId: startResult.scanId };
	const monitorHash = genSHA512(monitorId);

	const stopSignal$ = new Subject<boolean>();
	let done = false;

	const rawStatus$ = spiderStatusStream(sharedClientId, startResult.scanId);
	if (!rawStatus$) {
		mainProc.error("Failed to get spider status stream, nothing to monitor");
		return undefined;
	}

	const status$ = connectable(
		rawStatus$.pipe(
			takeUntil(stopSignal$),
			tap(async (val) => {
				if (parseInt(val.status) !== 100) return;

				if (!done) {
					done = true;
					return;
				}

				if (sessionId !== null) {
					const fullResults = await spiderFullResults(sharedClientId, startResult.scanId);
					if (!fullResults) {
						mainProc.error(`Failed to get spider full results of client ${startResult.clientId}, scanId ${startResult.scanId}`);
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
							sessionId,
							fullResults: {
								urlsInScope: fullResults[0].urlsInScope,
								urlsOutOfScope: fullResults[1].urlsOutOfScope,
								urlsError: fullResults[2].urlsIoError,
							},
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
				}

				stopSignal$.next(true);
			}),
			emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
			finalize(async () => {
				await spiderStop(sharedClientId, startResult.scanId, removeOnDone);
				monitoringSessions.delete(monitorHash);
			}),
		),
		{
			connector: () => new BehaviorSubject({ status: "0" }),
			resetOnDisconnect: false,
		},
	);

	monitoringSessions.set(monitorHash, { status$, stopSignal$ });
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

	monitoringSessions.get(monitorHash)!.stopSignal$.next(true);
}
// END ZAP SPIDER

// BEGIN ZAP AJAX
export async function ajaxStartAndMonitor(sessionId: ObjectId, url: string, config: any, emitDistinct?: boolean): Promise<string | undefined> {
	const clientId = await ajaxStart(undefined, url, config);

	if (!clientId) {
		mainProc.error("Failed to start ajax, nothing to monitor");
		return undefined;
	}

	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	const monitorHash = genSHA512(monitorId);

	const stopSignal$ = new Subject<boolean>();
	let done = false;

	const rawStatus$ = ajaxStatusStream(clientId);
	if (!rawStatus$) {
		mainProc.error("Failed to get ajax status stream, nothing to monitor");
		return undefined;
	}

	const status$ = connectable(
		rawStatus$.pipe(
			takeUntil(stopSignal$),
			tap(async (val) => {
				if (val.status !== "stopped") return;

				if (!done) {
					done = true;
					return;
				}

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
						sessionId,
						fullResults: {
							urlsInScope: fullResults.inScope,
							urlsOutOfScope: fullResults.outOfScope,
							urlsError: fullResults.errors,
						},
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

				stopSignal$.next(true);
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

	monitoringSessions.set(monitorHash, { status$, stopSignal$ });
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

	monitoringSessions.get(monitorHash)!.stopSignal$.next(true);
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

	const stopSignal$ = new Subject<boolean>();
	let done = false;

	const rawStatus$ = passiveStatusStream(clientId);
	if (!rawStatus$) {
		mainProc.error("Failed to get passive status stream, nothing to monitor");
		return undefined;
	}

	const status$ = connectable(
		rawStatus$.pipe(
			takeUntil(stopSignal$),
			tap(async (val) => {
				if (val.recordsToScan !== "0") return;

				if (!done) {
					done = true;
					return;
				}

				const fullResults = await passiveFullResults(clientId);
				if (!fullResults) {
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
						sessionId,
						fullResults: {
							data: fullResults,
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

				stopSignal$.next(true);
			}),
			emitDistinct ? distinctUntilChanged((prev, cur) => prev.recordsToScan === cur.recordsToScan) : identity,
			finalize(async () => {
				await stopZapClient(clientId);
				monitoringSessions.delete(monitorHash);
			}),
		),
		{
			connector: () => new BehaviorSubject({ recordsToScan: "1" }),
			resetOnDisconnect: false,
		},
	);

	monitoringSessions.set(monitorHash, { status$, stopSignal$ });
	monitoringSessions.get(monitorHash)!.status$.connect();
	monitoringSessions.get(monitorHash)!.status$.subscribe();

	return clientId;
}

export function passiveSharedStatusStream(clientId: string): Connectable<{ recordsToScan: string }> | undefined {
	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	return monitoringSessions.get(genSHA512(monitorId))?.status$ as Connectable<{ recordsToScan: string }>;
}

export function passiveSignalStop(clientId: string): void {
	const monitorId: TMonitorSessionId = { clientId, scanId: "0" };
	const monitorHash = genSHA512(monitorId);

	if (!monitoringSessions.has(monitorHash)) {
		mainProc.warn(`Stop passive with wrong id: ${clientId}`);
		return;
	}

	monitoringSessions.get(monitorHash)!.stopSignal$.next(true);
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

	const monitorId: TMonitorSessionId = { clientId: result.clientId, scanId: result.scanId };
	const monitorHash = genSHA512(monitorId);

	const stopSignal$ = new Subject<boolean>();
	let done = false;

	const rawStatus$ = activeStatusStream(result.clientId, result.scanId);
	if (!rawStatus$) {
		mainProc.error("Failed to get active status stream, nothing to monitor");
		return undefined;
	}

	const status$ = connectable(
		rawStatus$.pipe(
			takeUntil(stopSignal$),
			tap(async (val) => {
				if (parseInt(val.status) !== 100) return;

				if (!done) {
					done = true;
					return;
				}

				const fullResults = await activeFullResults(result.clientId);
				if (!fullResults) {
					mainProc.error(`Failed to get active full results of client ${result.clientId}`);
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
						sessionId,
						fullResults: {
							data: fullResults,
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

				stopSignal$.next(true);
			}),
			emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
			finalize(async () => {
				await stopZapClient(result.clientId);
				monitoringSessions.delete(monitorHash);
			}),
		),
		{
			connector: () => new BehaviorSubject({ status: "0" }),
			resetOnDisconnect: false,
		},
	);

	monitoringSessions.set(monitorHash, { status$, stopSignal$ });
	monitoringSessions.get(monitorHash)!.status$.connect();
	monitoringSessions.get(monitorHash)!.status$.subscribe();

	return result;
}

export function activeSharedStatusStream(clientId: string, scanId: string): Connectable<{ status: string }> | undefined {
	const monitorId: TMonitorSessionId = { clientId, scanId };
	return monitoringSessions.get(genSHA512(monitorId))?.status$ as Connectable<{ status: string }>;
}

export function activeSignalStop(clientId: string, scanId: string): void {
	const monitorId: TMonitorSessionId = { clientId, scanId };
	const monitorHash = genSHA512(monitorId);

	if (!monitoringSessions.has(monitorHash)) {
		mainProc.warn(`Stop active with wrong id: ${clientId}`);
		return;
	}

	monitoringSessions.get(monitorHash)!.stopSignal$.next(true);
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
