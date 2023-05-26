// @ts-ignore
import ZapClient from "zaproxy";
import { catchError, from, Observable, retry, switchMap, timer } from "rxjs";
import { mainProc } from "./logging.service";
import { TZapAjaxFullResultsConfig, TZapSpiderFullResultsParams } from "../submodules/utility/api";
import { startZapProcess, ZAP_SESSION_TYPES } from "../utils/zapProcess";
import crypto from "crypto";

const ZAP_POLL_DELAY = 5000;
const ZAP_POLL_INTERVAL = 5000;
const ZAP_POLL_MAX_RETRY = 5;

let zapClientShared: ZapClient;

export function initZapClient(port: number): ZapClient {
    return new ZapClient({
        apiKey: process.env.ZAP_APIKEY,
        proxy: `http://127.0.0.1:${port}`
    });
}

export function initZapClientShared(port: number): void {
    zapClientShared = initZapClient(port);
}

// BEGIN ZAP SPIDER
export async function spiderStart(url: string, config: any): Promise<string | undefined> {
    try {
        const result = await zapClientShared.spider.scan(
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

export async function spiderStop(scanId: string, removeScan?: boolean): Promise<void> {
    try {
        let res = await zapClientShared.spider.stop(scanId);
        if (res.Result === "OK") mainProc.info(`Scan ${scanId} stopped successfully`);
        else mainProc.error(`Failed to stop scan ${scanId}`);

        if (removeScan) {
            res = await zapClientShared.spider.removeScan(scanId);
            if (res.Result === "OK") mainProc.info(`Scan ${scanId} removed successfully`);
            else mainProc.error(`Failed to remove scan ${scanId}`);
        }
    } catch (err) {
        mainProc.error(`Error while stopping zap spider: ${err}`);
    }
}

export function spiderStatusStream(scanId: string): Observable<{status: string}> {
    return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
        switchMap(() => from(zapClientShared.spider.status(scanId)) as Observable<{status: string}>),
        retry(ZAP_POLL_MAX_RETRY),
        catchError(err => {
            throw `Error while polling zap spider status: ${err}`
        })
    );
}

export async function spiderResults(scanId: string, offset?: number): Promise<string[] | undefined> {
    try {
        const results: string[] = await zapClientShared.spider.results(scanId)
        .then((response: {results: string[]}) => response.results)
        .catch((error: any) => {
            mainProc.error(`Error while getting zap spider results: ${error}`);
            return [];
        });
        return offset ? results.slice(offset) : results;
    } catch (err) {
        mainProc.error(`Error while fetching zap spider result: ${err}`);
    }
}

export async function spiderFullResults(scanId: string, offset?: TZapSpiderFullResultsParams)
    : Promise<[{ urlsInScope: any[] }, { urlsOutOfScope: any[] }, { urlsIoError: any[] }] | undefined> {
    try {
        const results = (await zapClientShared.spider.fullResults(scanId)).fullResults;

        if (offset?.urlsInScopeOffset)
            results[0].urlsInScope.splice(offset.urlsInScopeOffset);
        if (offset?.urlsOutOfScopeOffset)
            results[1].urlsOutOfScope.splice(offset.urlsOutOfScopeOffset);
        if (offset?.urlsIoErrorOffset)
            results[2].urlsIoError.splice(offset.urlsIoErrorOffset);

        return results;
    } catch (err) {
        mainProc.error(`Error while fetching zap spider full results: ${err}`);
    }
}
// END ZAP SPIDER

// BEGIN ZAP AJAX
const ajaxZapClients: Map<string, ZapClient> = new Map();

export async function ajaxStart(url: string, config: any): Promise<string | undefined> {
    const client = initZapClient(await startZapProcess(ZAP_SESSION_TYPES.TEMP));
    const clientId = crypto.randomUUID();
    ajaxZapClients.set(clientId, client);

    try {
        // TODO: Only support chrome-headless for now
        let result = await client.ajaxSpider.setOptionBrowserId("chrome-headless");
        if (result.Result !== "OK") {
            mainProc.info(`Failed to set ajax scan option - id: ${clientId}`);
            await ajaxStop(clientId);
            return undefined;
        }

        result = await client.ajaxSpider.scan(
            url,
            config.inScope,
            config.contextName,
            config.subtreeOnly
        );

        if (result.Result !== "OK") {
            mainProc.info(`Failed to start ajax scan - id: ${clientId}`);
            await ajaxStop(clientId);
            return undefined;
        }

        mainProc.info("Ajax scan started successfully")
        return clientId;
    } catch (err) {
        mainProc.error(`ZapClient: ${client}\nError while init zap ajax: ${err}`);
        await ajaxStop(clientId);
    }
}

export async function ajaxStop(clientId: string): Promise<void> {
    if (!ajaxZapClients.has(clientId)) {
        mainProc.warn(`Stop ajax with wrong id: ${clientId}`);
        return;
    }

    const client: ZapClient = ajaxZapClients.get(clientId);
    try {
        let res = await client.ajaxSpider.stop();
        if (res.Result === "OK") mainProc.info("Ajax scan stopped successfully");
        else mainProc.error("Failed to stop ajax scan");

        await client.core.shutdown();
        mainProc.info("ZAP shut down after ajax scan")

        ajaxZapClients.delete(clientId);
    } catch (err) {
        mainProc.error(`ZapClient: ${client}\nError while stopping zap ajax: ${err}`);
    }
}

export function ajaxStatusStream(clientId: string): Observable<{status: "stopped" | "running"}> | undefined {
    if (!ajaxZapClients.has(clientId)) {
        mainProc.warn(`Get ajax status with wrong id: ${clientId}`);
        return undefined;
    }

    const client: ZapClient = ajaxZapClients.get(clientId);

    return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
        switchMap(_ => from(client.ajaxSpider.status()) as Observable<{status: "stopped" | "running"}>),
        retry(ZAP_POLL_MAX_RETRY),
        catchError(err => {
            throw `ZapClient: ${client}\nError while polling zap ajax status: ${err}`
        })
    );
}

export async function ajaxResults(clientId: string, offset?: number): Promise<any[] | undefined> {
    try {
        if (!ajaxZapClients.has(clientId)) {
            mainProc.error(`Get ajax result with wrong id: ${clientId}`);
            return undefined;
        }

        const client: ZapClient = ajaxZapClients.get(clientId);

        const results: string[] = await client.ajaxSpider.results()
            .then((response: {results: any[]}) => response.results)
            .catch((error: any) => {
                mainProc.error(`ZapClient: ${client}\nError while getting zap ajax results: ${error}`);
                return [];
            });

        return offset ? results.slice(offset) : results;
    } catch (err) {
        mainProc.error(`Error while fetching zap ajax result: ${err}`);
    }
}

export async function ajaxFullResults(clientId: string, offset?: TZapAjaxFullResultsConfig)
    : Promise<[{ inScope: any[] }, { outOfScope: any[] }, { errors: any[] }] | undefined> {
    if (!ajaxZapClients.has(clientId)) {
        mainProc.error(`Get ajax full result with wrong id: ${clientId}`);
        return undefined;
    }

    const client: ZapClient = ajaxZapClients.get(clientId);

    try {
        const results = (await client.ajaxSpider.fullResults()).fullResults;

        if (offset?.inScope)
            results[0].inScope.splice(offset.inScope);
        if (offset?.outOfScope)
            results[1].outOfScope.splice(offset.outOfScope);
        if (offset?.errors)
            results[2].errors.splice(offset.errors);

        return results;
    } catch (error) {
        mainProc.error(`ZapClient: ${client}\nError while getting zap ajax full results: ${error}`);
    }
}
// END ZAP AJAX