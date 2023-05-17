import {ajaxScan, ajaxStatusStream, spiderScan, spiderStatusStream} from "../utils/zapClient";
import {BehaviorSubject, Connectable, connectable, finalize, Observable, Subject, takeUntil} from "rxjs";
import {mainProc} from "./logging.service";

interface TScanId {
    id: number;
    isSpider: boolean;
}
const scannerServicesShared: Map<TScanId, Connectable<number>> = new Map();
const stopServiceEmits: Map<TScanId, Subject<boolean>> = new Map();

export async function spiderStartNewScan(url: string, config: any): Promise<number> {
    const scanId = await spiderScan(url, config);
    if (scanId) {
        // removeOnDone and emitDistinct are default to true
        const removeOnDone = !(config.removeOnDone === "false");
        const emitDistinct = !(config.emitDistinct === "false");
        const status$ = spiderStatusStream(scanId, emitDistinct, removeOnDone);

        const innerId: TScanId = {id: scanId, isSpider: true};
        setUpNewScan(innerId, status$);
    }
    return scanId;
}


export async function ajaxStartNewScan(url: string, config: any): Promise<number> {
    const scanId = await ajaxScan(url, config);
    if (scanId) {
        const status$ = ajaxStatusStream(scanId);
        const innerId: TScanId = {id: scanId, isSpider: false};
        setUpNewScan(innerId, status$);
    }
    return scanId;
}

// Add status$ and stopEmit$ to maps and start subscribing
function setUpNewScan(innerId: TScanId, status$: Observable<any>) {
    stopServiceEmits.set(innerId, new Subject<boolean>());
    const statusShared$ = connectable(status$.pipe(
        takeUntil(stopServiceEmits.get(innerId)!),
        finalize(() => {
            stopServiceEmits.delete(innerId);
            scannerServicesShared.delete(innerId);
        })
    ), {
        connector: () => new BehaviorSubject(0),
        resetOnDisconnect: false
    });
    scannerServicesShared.set(innerId, statusShared$);
    scannerServicesShared.get(innerId)!.subscribe();
    scannerServicesShared.get(innerId)!.connect();
}

export function spiderScanStatusStream(scanId: number): Connectable<number> | undefined {
    const innerId: TScanId = {id: scanId, isSpider: true};
    return scannerServicesShared.get(innerId);
}

export function ajaxScanStatusStream(scanId: number): Connectable<number> | undefined {
    const innerId: TScanId = {id: scanId, isSpider: false};
    return scannerServicesShared.get(innerId);
}

// TODO: should there be a return value on scanId not found ?
export function spiderStopScan(scanId: number) {
    const innerId: TScanId = {id: scanId, isSpider: true};
    if (!stopServiceEmits.has(innerId)) {
        mainProc.error(`Spider scan id ${scanId} not found`);
    }
    stopServiceEmits.get(innerId)!.next(true);
}

// TODO: should there be a return value on scanId not found ?
export function ajaxStopScan(scanId: number) {
    const innerId: TScanId = {id: scanId, isSpider: false};
    if (!stopServiceEmits.has(innerId)) {
        mainProc.error(`Ajax scan id ${scanId} not found`);
    }
    stopServiceEmits.get(innerId)!.next(true);
}