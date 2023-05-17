// @ts-ignore
import ZapClient from "zaproxy";
import {
    catchError,
    distinctUntilChanged,
    finalize,
    from,
    identity,
    retry,
    Subject,
    switchMap,
    takeUntil,
    tap,
    timer
} from "rxjs";
import { mainProc } from "../services/logging.service";
import { TZapAjaxFullResultsConfig, TZapSpiderFullResultsParams } from "../submodules/utility/api";
import {startZapProcess, ZAP_SESSION_TYPES} from "./zapProc";

const ZAP_POLL_DELAY = 5000;
const ZAP_POLL_INTERVAL = 5000;
const ZAP_POLL_MAX_RETRY = 5;

let spiderZapServiceShared: ZapClient;
const ajaxZapServices: Map<number, ZapClient> = new Map();

export function initZapClient(port: number): ZapClient {
    return new ZapClient({
        apiKey: process.env.ZAP_APIKEY,
        proxy: `http://127.0.0.1:${port}`
    });
}

export function initZapSharedClient(port: number) {
    spiderZapServiceShared = initZapClient(port);
}

// BEGIN ZAP SPIDER
export async function spiderScan(url: string, config: any) {
    try {
        const result = await spiderZapServiceShared.spider.scan(
            url,
            config.maxChildren,
            config.recurse,
            config.contextName,
            config.subtreeOnly
        );
        return result.scan;
    } catch (err) {
        mainProc.error(`Error while init zap spider: ${err}`);
    }
}

export function spiderStatusStream(scanId: number, emitDistinct?: boolean, removeOnDone?: boolean) {
    const stopEmit$ = new Subject<boolean>();
    let done = false;

    return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
        switchMap(_ => from(spiderZapServiceShared.spider.status(scanId))),
        retry(ZAP_POLL_MAX_RETRY),
        takeUntil(stopEmit$),
        tap((val: { status: number }) => {
            if (val.status >= 100) {
                if (!done) done = true;
                else stopEmit$.next(true);
            }
        }),
        emitDistinct ? distinctUntilChanged((prev: any, cur: any) => prev.status === cur.status) : identity,
        catchError(err => {
            throw `Error while polling zap spider status: ${err}`
        }),
        finalize(async () => {
            let res = await spiderZapServiceShared.spider.stop(scanId);
            if (res.Result === "OK") mainProc.info(`Scan ${scanId} stopped successfully`);
            else mainProc.error(`Failed to stop scan ${scanId}`);

            if (removeOnDone) {
                res = await spiderZapServiceShared.spider.removeScan(scanId);
                if (res.Result === "OK") mainProc.info(`Scan ${scanId} removed successfully`);
                else mainProc.error(`Failed to remove scan ${scanId}`);
            }
        })
    );
}

export async function spiderResults(scanId: number, offset?: number) {
    const results: string[] = await spiderZapServiceShared.spider.results(scanId)
        .then((response: {
            results: string[]
        }) => {
            return response.results;
        })
        .catch((error: any) => {
            mainProc.error(`Error while getting zap spider results: ${error}`);
        });
    return offset ? results.slice(offset) : results;
}

export async function spiderFullResults(scanId: number, offset?: TZapSpiderFullResultsParams) {
    try {
        const results = await spiderZapServiceShared.spider.fullResults(scanId);

        if (offset?.urlsInScopeOffset)
            results.urlsInScope.splice(offset?.urlsInScopeOffset);
        if (offset?.urlsOutOfScopeOffset)
            results.urlsOutOfScope.splice(offset?.urlsOutOfScopeOffset);
        if (offset?.urlsIoErrorOffset)
            results.urlsIoError.splice(offset?.urlsIoErrorOffset);

        return results;
    } catch (err) {
        mainProc.error(`Error while getting zap spider full results: ${err}`);
    }
}
// END ZAP SPIDER

// BEGIN ZAP AJAX
export async function ajaxScan(url: string, config: any) {
    const client = initZapClient(await startZapProcess(ZAP_SESSION_TYPES.TEMP));
    const clientId = Math.floor(Math.random() * 1000000);
    ajaxZapServices.set(clientId, client);
    try {
        // TODO: Only support chrome-headless for now
        let result = await client.ajaxSpider.setOptionBrowserId("chrome-headless");
        if (result.Result !== "OK")
            return result.Result;

        result = await client.ajaxSpider.scan(
            url,
            config.inScope,
            config.contextName,
            config.subtreeOnly
        );
        return result.Result;
    } catch (err) {
        mainProc.error(`ZapClient: ${client}\nError while init zap ajax: ${err}`);
    }
}

export function ajaxStatusStream(clientId: number) {
    if (!ajaxZapServices.has(clientId))
        throw new Error(`No ajax service with id ${clientId}`);
    const client: ZapClient = ajaxZapServices.get(clientId);

    const stopEmit$ = new Subject<boolean>();
    let done = false;

    return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
        switchMap(_ => from(client.ajaxSpider.status())),
        retry(ZAP_POLL_MAX_RETRY),
        takeUntil(stopEmit$),
        tap((val: any) => {
            if (val.status === "stopped") {
                if (!done) done = true;
                else stopEmit$.next(true);
            }
        }),
        catchError(err => {
            throw `ZapClient: ${client}\nError while polling zap ajax status: ${err}`
        }),
        finalize(async () => {
            let res = await client.ajaxSpider.stop();
            if (res.Result === "OK") mainProc.info("Ajax scan stopped successfully");
            else mainProc.error("Failed to stop ajax scan");

            await client.core.shutdown();
            ajaxZapServices.delete(clientId);
        })
    );
}

export async function ajaxResults(clientId: number, offset?: number) {
    if (!ajaxZapServices.has(clientId)) {
        mainProc.error(`No ajax service with id ${clientId}`);
        return undefined;
    }
    const client: ZapClient = ajaxZapServices.get(clientId);

    const results: string[] = await client.ajaxSpider.results()
        .then((response: {
            results: any[]
        }) => {
            return response.results;
        })
        .catch((error: any) => {
            mainProc.error(`ZapClient: ${client}\nError while getting zap ajax results: ${error}`);
        });
    return offset ? results.slice(offset) : results;
}

export async function ajaxFullResults(clientId: number, offset?: TZapAjaxFullResultsConfig) {
    if (!ajaxZapServices.has(clientId)) {
        mainProc.error(`No ajax service with id ${clientId}`);
        return undefined;
    }
    const client: ZapClient = ajaxZapServices.get(clientId);

    try {
        const results = await client.ajaxSpider.fullResults();

        if (offset?.inScope)
            results.inScope.splice(offset?.inScope);
        if (offset?.outOfScope)
            results.outOfScope.splice(offset?.outOfScope);
        if (offset?.errors)
            results.errors.splice(offset?.errors);

        return results;
    } catch (error) {
        mainProc.error(`ZapClient: ${client}\nError while getting zap ajax full results: ${error}`);
    }
}
// END ZAP AJAX