// @ts-ignore
import ZapClient from "zaproxy";
import {
    Subject,
    from,
    timer,
    switchMap,
    retry,
    identity,
    distinctUntilChanged,
    takeUntil,
    tap,
    catchError,
    of,
    finalize
} from "rxjs";
import {mainProc} from "../../utils/log";

const ZAP_POLL_DELAY = 5000;
const ZAP_POLL_INTERVAL = 5000;
const ZAP_POLL_MAX_RETRY = 5;

const ZAPService = new ZapClient({
    apiKey: process.env.ZAP_APIKEY,
    proxy: "http://127.0.0.1:" + (process.env.ZAP_PORT || 8080),
});

export async function initSpider(url: string, config: any) {
    try {
        const result = await ZAPService.spider.scan(
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

export function spiderProgressStream(scanId: number, emitDistinct?: boolean, removeOnDone?: boolean) {
    const stopEmit$ = new Subject<boolean>();
    let done = false;

    return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
        switchMap(_ => from(ZAPService.spider.status(scanId))),
        retry(ZAP_POLL_MAX_RETRY),
        emitDistinct ? distinctUntilChanged((prev: any, cur: any) => prev.status === cur.status) : identity,
        takeUntil(stopEmit$),
        tap(val => {
            if (val.status >= 100) {
                if (!done) done = true;
                else stopEmit$.next(true);
            }
        }),
        catchError(err => { throw `Error while polling zap spider status: ${err}` }),
        finalize(async () => {
            let res = await ZAPService.spider.stop(scanId);
            if (res.Result === "OK") mainProc.info(`Scan ${scanId} stopped successfully`);
            else mainProc.error(`Failed to stop scan ${scanId}`);

            if (removeOnDone) {
                res = await ZAPService.spider.removeScan(scanId);
                if (res.Result === "OK") mainProc.info(`Scan ${scanId} removed successfully`);
                else mainProc.error(`Failed to remove scan ${scanId}`);
            }
        })
    );
}

export async function spiderResults(scanId: number, offset?: number) {
    try {
        const results = await ZAPService.spider.results(scanId);
        return offset ? results.splice(offset) : results;
    } catch (err) {
        mainProc.error(`Error while getting zap spider results: ${err}`);
    }
}

export type TFullResultsConfig = { urlsInScope: number, urlsOutOfScope: number, urlsIoError: number };

export async function spiderFullResults(scanId: number, offset?: TFullResultsConfig) {
    try {
        const results = await ZAPService.spider.fullResults(scanId);

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