import { ajaxStatusStream, ajaxStop, spiderStop, spiderStatusStream, spiderStart, ajaxStart } from "./zapClient.service";
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

type TMonitorSessionId = {
    scanId: string;
    isAjax: boolean;
}

type TMonitorSessionIdHash = string;

const monitoringSessions: Map<TMonitorSessionIdHash, {
    status$: Connectable<{ status: string | "running" | "stopped" }>,
    stopSignal$: Subject<boolean>
}> = new Map();

// BEGIN ZAP SPIDER
export async function spiderStartAndMonitor(url: string, config: any, emitDistinct?: boolean, removeOnDone?: boolean): Promise<string | undefined> {
    const scanId = await spiderStart(url, config);

    if (!scanId) {
        mainProc.error("Failed to start spider, nothing to monitor");
        return undefined;
    }

    const sessionId: TMonitorSessionId = { scanId, isAjax: false };
    const sessionIdHash = genSHA512(sessionId);

    const stopSignal$ = new Subject<boolean>();
    let done = false;

    const status$ = connectable(spiderStatusStream(scanId).pipe(
        takeUntil(stopSignal$),
        tap(val => {
            if (parseInt(val.status) >= 100) {
                if (!done) done = true;
                else stopSignal$.next(true);
            }
        }),
        emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
        finalize(async () => {
            await spiderStop(scanId, removeOnDone);
            monitoringSessions.delete(sessionIdHash);
        })
    ), {
        connector: () => new BehaviorSubject({ status: "0" }),
        resetOnDisconnect: false
    });

    monitoringSessions.set(sessionIdHash, { status$, stopSignal$ });
    monitoringSessions.get(sessionIdHash)!.status$.connect();
    monitoringSessions.get(sessionIdHash)!.status$.subscribe();

    return scanId;
}

export function spiderSharedStatusStream(scanId: string): Connectable<{ status: string }> | undefined {
    const sessionId: TMonitorSessionId = { scanId, isAjax: false };
    return monitoringSessions.get(genSHA512(sessionId))?.status$;
}

export function spiderSignalStop(scanId: string): void {
    const sessionId: TMonitorSessionId = { scanId, isAjax: false };
    const sessionIdHash = genSHA512(sessionId);

    if (!monitoringSessions.has(sessionIdHash)) {
        mainProc.warn(`Stop spider with wrong id: ${scanId}`);
        return;
    }

    monitoringSessions.get(sessionIdHash)!.stopSignal$.next(true);
}
// END ZAP SPIDER

// BEGIN ZAP AJAX
export async function ajaxStartAndMonitor(url: string, config: any, emitDistinct?: boolean): Promise<string | undefined> {
    const clientId = await ajaxStart(url, config);

    if (!clientId) {
        mainProc.error("Failed to start ajax, nothing to monitor");
        return undefined;
    }

    const sessionId: TMonitorSessionId = { scanId: clientId, isAjax: true };
    const sessionIdHash = genSHA512(sessionId);

    const stopSignal$ = new Subject<boolean>();
    let done = false;

    const status$ = connectable(ajaxStatusStream(clientId)!.pipe(
        takeUntil(stopSignal$),
        tap(val => {
            if (val.status === "stopped") {
                if (!done) done = true;
                else stopSignal$.next(true);
            }
        }),
        emitDistinct ? distinctUntilChanged((prev, cur) => prev.status === cur.status) : identity,
        finalize(async () => {
            await ajaxStop(clientId);
            monitoringSessions.delete(sessionIdHash);
        })
    ), {
        connector: () => new BehaviorSubject({ status: "running" }),
        resetOnDisconnect: false
    });

    monitoringSessions.set(sessionIdHash, { status$, stopSignal$ });
    monitoringSessions.get(sessionIdHash)!.status$.connect();
    monitoringSessions.get(sessionIdHash)!.status$.subscribe();

    return clientId;
}

export function ajaxSharedStatusStream(clientId: string): Connectable<{ status: "running" | "stopped" }> | undefined {
    const sessionId: TMonitorSessionId = { scanId: clientId, isAjax: true };
    return monitoringSessions.get(genSHA512(sessionId))?.status$ as Connectable<{ status: "running" | "stopped" }>;
}

export function ajaxSignalStop(clientId: string): void {
    const sessionId: TMonitorSessionId = { scanId: clientId, isAjax: true };
    const sessionIdHash = genSHA512(sessionId);

    if (!monitoringSessions.has(sessionIdHash)) {
        mainProc.warn(`Stop ajax with wrong id: ${clientId}`);
        return;
    }

    monitoringSessions.get(sessionIdHash)!.stopSignal$.next(true);
}
// END ZAP AJAX