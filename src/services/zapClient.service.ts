// @ts-ignore
import ZapClient from "zaproxy";
import { catchError, from, Observable, retry, switchMap, timer } from "rxjs";
import { mainProc } from "./logging.service";
import { TZapAjaxFullResultsConfig, TZapSpiderFullResultsParams } from "../submodules/utility/api";
import { startZapProcess, ZAP_SESSION_TYPES } from "../utils/zapProcess";
import crypto from "crypto";
import { zapGetAvailablePort } from "./zapMonitor.service";
import { isInRiskLevelEnum, RiskLevel, TAlertDetail, TAlertsByRisk, TRisk, TZapAjaxStreamStatus } from "../utils/types";
import { sleep } from "../utils/system";

const ZAP_POLL_DELAY = 5000;
const ZAP_POLL_INTERVAL = 5000;
const ZAP_POLL_MAX_RETRY = 5;

const zapClients: Map<string, ZapClient> = new Map();

export const sharedClientId = crypto.randomUUID();

export function initZapClient(port: number): ZapClient {
	return new ZapClient({
		apiKey: process.env.ZAP_APIKEY,
		proxy: `http://127.0.0.1:${port}`,
	});
}

export async function initZapClientShared(port: number): Promise<void> {
	const zapClientShared = initZapClient(port);

	// Disable passive scanners
	const res = await zapClientShared.pscan.setEnabled("false");
	if (res.Result !== "OK") mainProc.error("Failed to disable passive scan of shared ZAP process");

	zapClients.set(sharedClientId, zapClientShared);
}

async function newPrivateZapClient(): Promise<`${string}-${string}-${string}-${string}-${string}`> {
	const port = zapGetAvailablePort();
	await startZapProcess(ZAP_SESSION_TYPES.PRIVATE, port);
	const client = initZapClient(port);
	const clientId = crypto.randomUUID();
	zapClients.set(clientId, client);
	return clientId;
}

export async function stopZapClient(clientId: string): Promise<void> {
	if (!zapClients.has(clientId)) {
		mainProc.warn(`Stop client with wrong id: ${clientId}`);
		return;
	}

	try {
		await zapClients.get(clientId).core.shutdown();
		mainProc.info("ZAP shut down after ajax scan");
		zapClients.delete(clientId);
	} catch (err) {
		mainProc.error(`ZapClient: ${clientId}\nError while stopping zap client: ${err}`);
	}
}

export function signalStopAllZapClient(): void {
	zapClients.forEach((client) => client.core.shutdown());
	zapClients.clear();
	mainProc.info("Shutting down all ZAP clients");
}

// BEGIN ZAP SPIDER
export async function spiderStart(clientId: string | undefined, url: string, config: any): Promise<{ scanId: string; clientId: string } | undefined> {
	let createNewClient = false;
	if (clientId === undefined) {
		clientId = await newPrivateZapClient();
		createNewClient = true;
	} else if (!zapClients.has(clientId)) {
		mainProc.error(`Start spider with wrong id: ${clientId}`);
		return undefined;
	}

	try {
		const result = await zapClients.get(clientId).spider.scan(url, config.maxChildren, config.recurse, config.contextName, config.subtreeOnly);
		return { scanId: result.scan, clientId };
	} catch (err) {
		mainProc.error(`Error while init zap spider: ${err}`);
		if (createNewClient) {
			mainProc.error(`Stop zap client: ${clientId} duo to failed to init zap spider`);
			await stopZapClient(clientId);
		}
		return undefined;
	}
}

export async function spiderStop(clientId: string, scanId: string, removeScan?: boolean): Promise<void> {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Stop spider with wrong id: ${clientId}`);
		return;
	}

	try {
		const client = zapClients.get(clientId);

		let res = await client.spider.stop(scanId);
		if (res.Result === "OK") mainProc.info(`Scan ${scanId} of client ${clientId} stopped successfully`);
		else mainProc.error(`Failed to stop scan ${scanId} of client ${clientId}`);

		if (removeScan) {
			res = await client.spider.removeScan(scanId);
			if (res.Result === "OK") mainProc.info(`Scan ${scanId} of client ${clientId} removed successfully`);
			else mainProc.error(`Failed to remove scan ${scanId} of client ${clientId}`);
		}
	} catch (err) {
		mainProc.error(`Error while stopping zap spider of client ${clientId}: ${err}`);
	}
}

export function spiderStatusStream(clientId: string, scanId: string): Observable<{ status: string }> | undefined {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get spider status with wrong id: ${clientId}`);
		return undefined;
	}

	const client = zapClients.get(clientId);
	return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
		switchMap(() => from(client.spider.status(scanId)) as Observable<{ status: string }>),
		retry(ZAP_POLL_MAX_RETRY),
		catchError((err) => {
			throw `Error while polling zap spider status of client ${clientId}: ${err}`;
		}),
	);
}

export async function spiderResults(clientId: string, scanId: string, offset?: number): Promise<string[] | undefined> {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get spider results with wrong id: ${clientId}`);
		return undefined;
	}

	try {
		const results: string[] = await zapClients
			.get(clientId)
			.spider.results(scanId)
			.then((response: { results: string[] }) => response.results)
			.catch((error: any) => {
				mainProc.error(`Error while getting zap spider results of client ${clientId}: ${error}`);
				return [];
			});
		return offset ? results.slice(offset) : results;
	} catch (err) {
		mainProc.error(`Error while fetching zap spider results of client ${clientId}: ${err}`);
		return undefined;
	}
}

export async function spiderFullResults(clientId: string, scanId: string, offset?: TZapSpiderFullResultsParams): Promise<[{ urlsInScope: any[] }, { urlsOutOfScope: any[] }, { urlsIoError: any[] }] | undefined> {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get spider full results with wrong id: ${clientId}`);
		return undefined;
	}

	try {
		const results = (await zapClients.get(clientId).spider.fullResults(scanId)).fullResults;

		if (offset?.urlsInScopeOffset) results[0].urlsInScope.splice(offset.urlsInScopeOffset);
		if (offset?.urlsOutOfScopeOffset) results[1].urlsOutOfScope.splice(offset.urlsOutOfScopeOffset);
		if (offset?.urlsIoErrorOffset) results[2].urlsIoError.splice(offset.urlsIoErrorOffset);

		return results;
	} catch (err) {
		mainProc.error(`Error while fetching zap spider full results of client ${clientId}: ${err}`);
		return undefined;
	}
}
// END ZAP SPIDER

// BEGIN ZAP AJAX
export async function ajaxStart(clientId: string | undefined, url: string, config: any): Promise<string | undefined> {
	let createNewClient = false;
	if (clientId === undefined) {
		clientId = await newPrivateZapClient();
		createNewClient = true;
	} else if (!zapClients.has(clientId)) {
		mainProc.error(`Start ajax with wrong id: ${clientId}`);
		return undefined;
	}

	try {
		const client = zapClients.get(clientId);

		// TODO: Only support chrome-headless for now
		let result = await client.ajaxSpider.setOptionBrowserId("chrome-headless");
		if (result.Result !== "OK") {
			mainProc.info(`Failed to set ajax scan option of client: ${clientId}`);
			await stopZapClient(clientId);
			return undefined;
		}

		result = await client.ajaxSpider.scan(url, config.inScope, config.contextName, config.subtreeOnly);
		if (result.Result !== "OK") {
			mainProc.info(`Failed to start ajax scan of client: ${clientId}`);
			await stopZapClient(clientId);
			return undefined;
		}

		mainProc.info("Ajax scan started successfully");
		return clientId;
	} catch (err) {
		mainProc.error(`Error while init zap ajax: ${err}`);
		if (createNewClient) {
			mainProc.error(`Stop zap client: ${clientId} duo to failed to init zap ajax`);
			await stopZapClient(clientId);
		}
		return undefined;
	}
}

export function ajaxStatusStream(clientId: string): Observable<{ status: TZapAjaxStreamStatus }> | undefined {
	if (!zapClients.has(clientId)) {
		mainProc.warn(`Get ajax status with wrong id: ${clientId}`);
		return undefined;
	}

	const client: ZapClient = zapClients.get(clientId);
	return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
		switchMap((_) => from(client.ajaxSpider.status()) as Observable<{ status: TZapAjaxStreamStatus }>),
		retry(ZAP_POLL_MAX_RETRY),
		catchError((err) => {
			throw `Error while polling zap ajax status of client ${clientId}: ${err}`;
		}),
	);
}

export async function ajaxResults(clientId: string, offset?: number): Promise<any[] | undefined> {
	try {
		if (!zapClients.has(clientId)) {
			mainProc.error(`Get ajax results with wrong id: ${clientId}`);
			return undefined;
		}

		const results: string[] = await zapClients
			.get(clientId)
			.ajaxSpider.results()
			.then((response: { results: any[] }) => response.results)
			.catch((error: any) => {
				mainProc.error(`Error while getting zap ajax results of client ${clientId}: ${error}`);
				return [];
			});

		return offset ? results.slice(offset) : results;
	} catch (err) {
		mainProc.error(`Error while fetching zap ajax results of client ${clientId}: ${err}`);
		return undefined;
	}
}

export async function ajaxFullResults(clientId: string): Promise<{ inScope: any[]; outOfScope: any[]; errors: any[] } | undefined> {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get ajax full result with wrong id: ${clientId}`);
		return undefined;
	}

	const client: ZapClient = zapClients.get(clientId);

	try {
		const results = (await client.ajaxSpider.fullResults()).fullResults;
		return results;
	} catch (error) {
		mainProc.error(`Error while getting zap ajax full results of client ${clientId}: ${error}`);
		return undefined;
	}
}
// END ZAP AJAX

// BEGIN ZAP PASSIVE
export async function passiveStart(url: string, exploreType: "spider" | "ajax", exploreConfig: any): Promise<string | undefined> {
	const clientId = await newPrivateZapClient();

	try {
		const client = zapClients.get(clientId);

		let result = await client.pscan.setEnabled("true");
		if (result.Result !== "OK") {
			mainProc.info("Failed to enable passive scan - Stopping client");
			await stopZapClient(clientId);
			return undefined;
		}

		result = await client.pscan.enableAllScanners();
		if (result.Result !== "OK") {
			mainProc.info("Failed to enable passive scanners - Stopping client");
			await stopZapClient(clientId);
			return undefined;
		}

		result = await client.pscan.setScanOnlyInScope("true");
		if (result.Result !== "OK") {
			mainProc.info("Failed to set passive scan only in scope - Stopping client");
			await stopZapClient(clientId);
			return undefined;
		}

		result = exploreType === "spider" ? await spiderStart(clientId, url, exploreConfig) : await ajaxStart(clientId, url, exploreConfig);
		if (result === undefined) {
			mainProc.info("Failed to explore before passive scan - Stopping client");
			await stopZapClient(clientId);
			return undefined;
		}

		mainProc.info(`Passive scan started successfully of client ${clientId}`);
		return clientId;
	} catch (err) {
		mainProc.error(`Error while init zap passive with exploreType ${exploreType}: ${err} - Stopping client`);
		await stopZapClient(clientId);
	}
}

export function passiveStatusStream(clientId: string): Observable<{ recordsToScan: string }> | undefined {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get passive status with wrong id: ${clientId}`);
		return undefined;
	}

	const client = zapClients.get(clientId);
	return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
		switchMap(() => from(client.pscan.recordsToScan()) as Observable<{ recordsToScan: string }>),
		retry(ZAP_POLL_MAX_RETRY),
		catchError((err) => {
			throw `Error while polling zap passive status of client ${clientId}: ${err}`;
		}),
	);
}

export async function passiveFullResults(clientId: string, offset?: number): Promise<any[] | undefined> {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get passive full results with wrong id: ${clientId}`);
		return undefined;
	}

	try {
		return (await zapClients.get(clientId).core.alert(null, offset ?? 0)).alerts;
	} catch (error) {
		mainProc.error(`Error while getting zap passive full results of client ${clientId}: ${error}`);
		return undefined;
	}
}
// END ZAP PASSIVE

// BEGIN ZAP ACTIVE
export async function activeStart(url: string, exploreType: "spider" | "ajax", exploreConfig: any, activeConfig: any): Promise<{ scanId: string; clientId: string } | undefined> {
	const clientId = await newPrivateZapClient();

	try {
		const client = zapClients.get(clientId);

		let result = await client.ascan.enableAllScanners();
		if (result.Result !== "OK") {
			mainProc.info("Failed to enable active scanners - Stopping client");
			await stopZapClient(clientId);
			return undefined;
		}

		result = exploreType === "spider" ? await spiderStart(clientId, url, exploreConfig) : await ajaxStart(clientId, url, exploreConfig);
		if (result === undefined) {
			mainProc.info("Failed to explore before active scan - Stopping client");
			await stopZapClient(clientId);
			return undefined;
		}

		await sleep(5000);

		result = await client.ascan.scan(url, activeConfig.recurse, activeConfig.inScopeOnly, activeConfig.scanPolicyName, activeConfig.method, activeConfig.postdata, activeConfig.contextId);

		mainProc.info(`Active scan with id ${result.scan} started successfully of client ${clientId}`);
		return { scanId: result.scan, clientId };
	} catch (err) {
		mainProc.error(`Error while init zap active with exploreType ${exploreType}: ${err} - Stopping client`);
		await stopZapClient(clientId);
		return undefined;
	}
}

export function activeStatusStream(clientId: string, scanId: string): Observable<{ status: string }> | undefined {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get active status with wrong id: ${clientId}`);
		return undefined;
	}

	const client = zapClients.get(clientId);
	return timer(ZAP_POLL_DELAY, ZAP_POLL_INTERVAL).pipe(
		switchMap(() => from(client.ascan.status(scanId)) as Observable<{ status: string }>),
		retry(ZAP_POLL_MAX_RETRY),
		catchError((err) => {
			throw `Error while polling zap active status of client ${clientId}: ${err}`;
		}),
	);
}

export async function activeScanProgress(clientId: string, scanId: string, offset?: number): Promise<any[] | undefined> {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get active scan progress with wrong id: ${clientId}`);
		return undefined;
	}

	try {
		const results = (await zapClients.get(clientId).ascan.scanProgress(scanId)).scanProgress[1].HostProcess;
		return offset ? results.slice(offset) : results;
	} catch (error) {
		mainProc.error(`Error while getting zap active scan progress of client ${clientId}: ${error}`);
		return undefined;
	}
}

export async function activeAlertsByRisk(clientId: string): Promise<TAlertsByRisk | undefined> {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get active alert by risk with wrong id: ${clientId}`);
		return undefined;
	}
	try {
		// Get alerts by risk result
		const alertsByRiskResult: Record<RiskLevel, Record<string, TAlertDetail[]>[]>[] = (await zapClients.get(clientId).requestPromise("/alert/view/alertsByRisk/", {})).alertsByRisk;

		const alertsByRiskResultTransformed: TAlertsByRisk = {};
		// Transform alerts by risk result
		alertsByRiskResult.forEach((typeAlertObj) => {
			Object.entries(typeAlertObj).forEach(([key, riskObjArray]) => {
				if (isInRiskLevelEnum(key)) {
					const transformedValue: TRisk[] = [];
					riskObjArray.forEach((riskObj) => {
						const riskKey = Object.keys(riskObj)[0];
						const riskValueArr = riskObj[riskKey];
						transformedValue.push({
							key: riskKey,
							value: riskValueArr,
						});
					});
					alertsByRiskResultTransformed[key] = transformedValue;
				}
			});
		});
		return alertsByRiskResultTransformed;
	} catch (error) {
		mainProc.error(`Error while getting zap active alert by risk of client ${clientId}: ${error}`);
		return undefined;
	}
}

export async function activeAlerts(clientId: string): Promise<any[] | undefined> {
	if (!zapClients.has(clientId)) {
		mainProc.error(`Get active full results with wrong id: ${clientId}`);
		return undefined;
	}

	try {
		return (await zapClients.get(clientId).requestPromise("/alert/view/alerts/", {})).alerts;
	} catch (error) {
		mainProc.error(`Error while getting zap active full results of client ${clientId}: ${error}`);
		return undefined;
	}
}
// END ZAP ACTIVE