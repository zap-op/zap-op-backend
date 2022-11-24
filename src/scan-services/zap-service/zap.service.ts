import {Response} from "express";
// @ts-ignore
import ZapClient from "zaproxy";
import {SCAN_TYPE} from "../../database/models/scan-session.type";
import {SCAN_STATUS} from "../../apis/routers/scan-router/scan.router";

class ZAPService {
    private static _instance: ZAPService;

    private service: any;

    private constructor() {
        const opts = {
            apiKey: process.env.ZAP_API_KEY,
            proxy: (process.env.ZAP_HOST || "localhost") + ":" + (process.env.ZAP_HOST_PORT || 8080),
        };
        this.service = new ZapClient(opts);
    }

    public static instance(): ZAPService {
        if (!ZAPService._instance) ZAPService._instance = new ZAPService();
        return ZAPService._instance;
    }

    async scan(url: string, type: string, config: any) {
        if (type == SCAN_TYPE.ZAP.SPIDER) {
            try {
                const result = await this.service.spider.scan(
                    url,
                    config.maxChildren,
                    config.recurse,
                    config.contextName,
                    config.subtreeOnly
                );
                return result.scan;
            } catch (err) {
                console.log(err);
            }
        }
        return undefined;
    }

    async emitProgress(clientResponse: Response, type: string, scanId: number) {
        if (type == SCAN_TYPE.ZAP.SPIDER) {
            try {
                let scanProgress: number = await this.service.spider
                    .status(scanId)
                    .then((result: any) => {
                        return parseInt(result.status);
                    });
                let preResults: string[] = [];
                let preScanProgress: number = 0;
                const timeInterval: number = 1000;
                const emitInterval: NodeJS.Timer = setInterval(async () => {
                    try {
                        scanProgress = await this.service.spider
                            .status(scanId)
                            .then((result: any) => {
                                return parseInt(result.status);
                            });
                        const results = await this.service.spider
                            .results(scanId)
                            .then((result: any) => {
                                return result.results;
                            });

                        const emitResults = results.filter((result: any) => !preResults.includes(result));
                        if (emitResults.length > 0 || scanProgress > preScanProgress) {
                            clientResponse.write(
                                `data: ${JSON.stringify({
                                    scanProgress: scanProgress,
                                    results: emitResults,
                                })}\n\n`
                            );
                            preResults = results;
                            preScanProgress = scanProgress;
                        }
                        if (scanProgress === 100) {
                            clearInterval(emitInterval);
                            this.service.spider.removeScan(scanId);
                        }
                    } catch (error: any) {
                        clientResponse.write(
                            `event: error\ndata: ${JSON.stringify(
                                SCAN_STATUS.ZAP_SERVICE_ERROR
                            )}\n\n`
                        );
                        clearInterval(emitInterval);
                        if (error.name === "StatusCodeError") {
                            console.log(error.statusCode, error.error);
                        } else {
                            console.log(error);
                            this.service.spider.removeScan(scanId);
                        }
                    }
                }, timeInterval);
            } catch (error: any) {
                clientResponse.write(
                    `event: error\ndata: ${JSON.stringify(
                        SCAN_STATUS.ZAP_SERVICE_ERROR
                    )}\n\n`
                );
                if (error.name === "StatusCodeError") {
                    console.log(error.statusCode, error.error);
                } else {
                    console.log(error);
                    this.service.spider.removeScan(scanId);
                }
            }
        }
    }
}

export default ZAPService;
