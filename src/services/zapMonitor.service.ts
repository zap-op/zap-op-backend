import { ajaxStatusStream, ajaxStop, spiderStop, spiderStatusStream, spiderStart, ajaxStart, spiderFullResults, ajaxFullResults } from "./zapClient.service";
import {
    BehaviorSubject,
    Connectable,
    connectable,
    distinctUntilChanged,
    finalize,
    identity,
    Subject,
    takeUntil,
    tap
} from "rxjs";
import { mainProc } from "./logging.service";
import { genSHA512 } from "../utils/crypto";
import { ObjectId } from "bson";
import { zapAjaxScanFullResultsModel, zapSpiderScanFullResultsModel } from "../models/scan-fullresults.model";
import { scanSessionModel } from "../models";
import { ScanState, TZapAjaxStreamStatus } from "../utils/types";

type TMonitorSessionId = {
    scanId: string;
    isAjax: boolean;
}

type TMonitorSessionIdHash = string;

const monitoringSessions: Map<TMonitorSessionIdHash, {
    status$: Connectable<{ status: string | TZapAjaxStreamStatus }>,
    stopSignal$: Subject<boolean>,
}> = new Map();

// BEGIN ZAP SPIDER
export async function spiderStartAndMonitor(sessionId: ObjectId, url: string, config: any, emitDistinct?: boolean, removeOnDone?: boolean): Promise<string | undefined> {
    const scanId = await spiderStart(url, config);

    if (!scanId) {
        mainProc.error("Failed to start spider, nothing to monitor");
        return undefined;
    }

    const monitorId: TMonitorSessionId = { scanId, isAjax: false };
    const monitorHash = genSHA512(monitorId);

    const stopSignal$ = new Subject<boolean>();
    let done = false;
    let curStatus: string = "0";

    const status$ = connectable(spiderStatusStream(scanId).pipe(
        takeUntil(stopSignal$),
        tap(val => {
            curStatus = val.status;
            if (parseInt(val.status) === 100) {
                if (!done) done = true;
                else stopSignal$.next(true);
            }
        }),
        emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
        finalize(async () => {
            console.log("curStatus", curStatus);
            if (curStatus === "100") {
                const fullResults = await spiderFullResults(scanId);
                if (!fullResults) {
                    await scanSessionModel
                    .findByIdAndUpdate(sessionId, {
                        status: {
                            state: ScanState.FAILED,
                            message: "Failed to get spider full results.",
                        },
                    })
                    .exec()
                    .catch((error) => {
                        mainProc.error(`Error while update scan state to session: ${error}`);
                    });
                    mainProc.error(`Failed to get spider full results with id: ${scanId}`);
                }
                else {
                    const fullResultsDoc = new zapSpiderScanFullResultsModel({
                        sessionId,
                        fullResults: {
                            urlsInScope: fullResults[0].urlsInScope,
                            urlsOutOfScope: fullResults[1].urlsOutOfScope,
                            urlsError: fullResults[2].urlsIoError,
                        }
                    });
                    await fullResultsDoc.save().catch(error => {
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
                            mainProc.error(`Error while update scan state to session: ${error}`);
                        });
                }
            }
            await spiderStop(scanId, removeOnDone);
            monitoringSessions.delete(monitorHash);
        })
    ), {
        connector: () => new BehaviorSubject({ status: "0" }),
        resetOnDisconnect: false
    });

    monitoringSessions.set(monitorHash, { status$, stopSignal$ });
    monitoringSessions.get(monitorHash)!.status$.connect();
    monitoringSessions.get(monitorHash)!.status$.subscribe();

    return scanId;
}

export function spiderSharedStatusStream(scanId: string): Connectable<{ status: string }> | undefined {
    const monitorId: TMonitorSessionId = { scanId, isAjax: false };
    return monitoringSessions.get(genSHA512(monitorId))?.status$;
}

export function spiderSignalStop(scanId: string): void {
    const monitorId: TMonitorSessionId = { scanId, isAjax: false };
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
    const clientId = await ajaxStart(url, config);

    if (!clientId) {
        mainProc.error("Failed to start ajax, nothing to monitor");
        return undefined;
    }

    const monitorId: TMonitorSessionId = { scanId: clientId, isAjax: true };
    const monitorHash = genSHA512(monitorId);

    const stopSignal$ = new Subject<boolean>();
    let done = false;
    let curStatus: TZapAjaxStreamStatus = "running";

    const status$ = connectable(ajaxStatusStream(clientId)!.pipe(
        takeUntil(stopSignal$),
        tap(val => {
            curStatus = val.status;
            if (val.status === "stopped") {
                if (!done) done = true;
                else stopSignal$.next(true);
            }
        }),
        emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
        finalize(async () => {
            if (curStatus === "stopped") {
                const fullResults = await ajaxFullResults(clientId);
                if (!fullResults) {
                    await scanSessionModel
                        .findByIdAndUpdate(sessionId, {
                            status: {
                                state: ScanState.FAILED,
                                message: "Failed to get ajax full results.",
                            },
                        })
                        .exec()
                        .catch((error) => {
                            mainProc.error(`Error while update scan state to session: ${error}`);
                        });
                    mainProc.error(`Failed to get ajax full results with id: ${clientId}`);
                }
                else {
                    const fullResultsDoc = new zapAjaxScanFullResultsModel({
                        sessionId,
                        fullResults: {
                            urlsInScope: fullResults.inScope,
                            urlsOutOfScope: fullResults.outOfScope,
                            urlsError: fullResults.errors,
                        }
                    });
                    await fullResultsDoc.save().catch(error => {
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
                            mainProc.error(`Error while update scan state to session: ${error}`);
                        });
                }
            }
            await ajaxStop(clientId);
            monitoringSessions.delete(monitorHash);
        })
    ), {
        connector: () => new BehaviorSubject({ status: "running" }),
        resetOnDisconnect: false
    });

    monitoringSessions.set(monitorHash, { status$, stopSignal$ });
    monitoringSessions.get(monitorHash)!.status$.connect();
    monitoringSessions.get(monitorHash)!.status$.subscribe();

    return clientId;
}

export function ajaxSharedStatusStream(clientId: string): Connectable<{ status: TZapAjaxStreamStatus }> | undefined {
    const monitorId: TMonitorSessionId = { scanId: clientId, isAjax: true };
    return monitoringSessions.get(genSHA512(monitorId))?.status$ as Connectable<{ status: TZapAjaxStreamStatus }>;
}

export function ajaxSignalStop(clientId: string): void {
    const monitorId: TMonitorSessionId = { scanId: clientId, isAjax: true };
    const monitorHash = genSHA512(monitorId);

    if (!monitoringSessions.has(monitorHash)) {
        mainProc.warn(`Stop ajax with wrong id: ${clientId}`);
        return;
    }

    monitoringSessions.get(monitorHash)!.stopSignal$.next(true);
}
// END ZAP AJAX

// BEGIN UTILS
const reusableZapPorts: Set<number> = new Set();
let curAvailablePort = 8080;

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