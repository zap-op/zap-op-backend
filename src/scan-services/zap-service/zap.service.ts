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
import {mainProc} from "../../utils/log";
import {TZapAjaxFullResultsConfig, TZapSpiderFullResultsConfig} from "../../utils/types";

const ZAP_POLL_DELAY = 5000;
const ZAP_POLL_INTERVAL = 5000;
const ZAP_POLL_MAX_RETRY = 5;

let zapServiceShared: ZapClient;

export function connectZapService(port: number): ZapClient {
    return new ZapClient({
        apiKey: process.env.ZAP_APIKEY,
        proxy: `http://127.0.0.1:${port}`
    });
}

export function connectZapServiceShared(port: number) {
    zapServiceShared = connectZapService(port);
}

// BEGIN ZAP SPIDER
export async function spiderScan(url: string, config: any) {
    try {
        const result = await zapServiceShared.spider.scan(
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
        switchMap(_ => from(zapServiceShared.spider.status(scanId))),
        retry(ZAP_POLL_MAX_RETRY),
        emitDistinct ? distinctUntilChanged((prev: any, cur: any) => prev.status === cur.status) : identity,
        takeUntil(stopEmit$),
        tap(val => {
            if (val.status >= 100) {
                if (!done) done = true;
                else stopEmit$.next(true);
            }
        }),
        catchError(err => {
            throw `Error while polling zap spider status: ${err}`
        }),
        finalize(async () => {
            let res = await zapServiceShared.spider.stop(scanId);
            if (res.Result === "OK") mainProc.info(`Scan ${scanId} stopped successfully`);
            else mainProc.error(`Failed to stop scan ${scanId}`);

            if (removeOnDone) {
                res = await zapServiceShared.spider.removeScan(scanId);
                if (res.Result === "OK") mainProc.info(`Scan ${scanId} removed successfully`);
                else mainProc.error(`Failed to remove scan ${scanId}`);
            }
        })
    );
}

export async function spiderResults(scanId: number, offset?: number) {
    const results: string[] = await zapServiceShared.spider.results(scanId)
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

export async function spiderFullResults(scanId: number, offset?: TZapSpiderFullResultsConfig) {
    try {
        const results = await zapServiceShared.spider.fullResults(scanId);

        if (offset?.urlsInScope)
            results.urlsInScope.splice(offset?.urlsInScope);
        if (offset?.urlsOutOfScope)
            results.urlsOutOfScope.splice(offset?.urlsOutOfScope);
        if (offset?.urlsIoError)
            results.urlsIoError.splice(offset?.urlsIoError);

        return results;
    } catch (err) {
        mainProc.error(`Error while getting zap spider full results: ${err}`);
    }
}

// END ZAP SPIDER

// BEGIN ZAP AJAX
export async function ajaxScan(service: ZapClient, url: string, config: any) {
    try {
        // TODO: Only support chrome-headless for now
        let result = await service.ajaxSpider.setOptionBrowserId("chrome-headless");
        if (result.Result !== "OK")
            return result.Result;

        result = await service.ajaxSpider.scan(
            url,
            config.inScope,
            config.contextName,
            config.subtreeOnly
        );
        return result.Result;
    } catch (err) {
        mainProc.error(`ZapService: ${service}\nError while init zap ajax: ${err}`);
    }
}

export function ajaxStatusStream(service: ZapClient) {
    const stopEmit$ = new Subject<boolean>();
    let done = false;

    return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
        switchMap(_ => from(service.ajaxSpider.status())),
        retry(ZAP_POLL_MAX_RETRY),
        takeUntil(stopEmit$),
        tap((val: any) => {
            if (val.status === "stopped") {
                if (!done) done = true;
                else stopEmit$.next(true);
            }
        }),
        catchError(err => {
            throw `ZapService: ${service}\nError while polling zap ajax status: ${err}`
        }),
        finalize(async () => {
            let res = await service.ajaxSpider.stop();
            if (res.Result === "OK") mainProc.info("Ajax scan stopped successfully");
            else mainProc.error("Failed to stop ajax scan");
        })
    );
}

export async function ajaxResults(service: ZapClient, offset?: number) {
    const results: string[] = await service.ajaxSpider.results()
        .then((response: {
            results: any[]
        }) => {
            return response.results;
        })
        .catch((error: any) => {
            mainProc.error(`ZapService: ${service}\nError while getting zap ajax results: ${error}`);
        });
    return offset ? results.slice(offset) : results;
}

export async function ajaxFullResults(service: ZapClient, offset?: TZapAjaxFullResultsConfig) {
    try {
        const results = await service.ajaxSpider.fullResults();

        if (offset?.inScope)
            results.inScope.splice(offset?.inScope);
        if (offset?.outOfScope)
            results.outOfScope.splice(offset?.outOfScope);
        if (offset?.errors)
            results.errors.splice(offset?.errors);

        return results;
    } catch (error) {
        mainProc.error(`ZapService: ${service}\nError while getting zap ajax full results: ${error}`);
    }
}

// END ZAP AJAX