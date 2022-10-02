import { Response } from "express";
import SCAN_STATUS from "../../apis/routers/scan-router/scan.status.js";
import SCAN_TYPE from "../../database/models/scan-session.type.js";
import _validator from "../../utils/validator.js";
import ZAProxyClient from "./zapclient.js";

class ZAPService {
  private static _instance: ZAPService;

  private constructor() {}

  public static instance(): ZAPService {
    if (!ZAPService._instance) ZAPService._instance = new ZAPService();
    return ZAPService._instance;
  }

  private service = ZAProxyClient;

  /**
   * Start scan
   * @param {string} url URL to scan
   * @param {string} type Type scan code
   * @param {Object} config Scan's configuration object
   * @returns {Promise|Number} Scan ID at OWASP ZAP application
   */
  async scan(url: string, type: string, config: any) {
    if (type == SCAN_TYPE.ZAP.SPIDER) {
      return this.service.spider
        .scan(
          url,
          config.maxChildren,
          config.recurse,
          config.contextName,
          config.subtreeOnly
        )
        .then((result: any) => {
          return result.scan;
        })
        .catch((err: any) => {
          console.log(err);
        });
    }
    return undefined;
  }

  /**
   * Start emit data from scan
   * @param {Response} clientResponse
   * @param {string} type Scan type
   * @param {Number} scanId
   */
  async emit(clientResponse: Response, type: string, scanId: number) {
    if (type == SCAN_TYPE.ZAP.SPIDER) {
      try {
        let scanProgress = await this.service.spider
          .status(scanId)
          .then((result: any) => {
            return parseInt(result.status);
          });
        let preResults: number[] = [];
        let preScanProgress = 0;
        const timeInterval = 1000;
        const emitInterval = setInterval(async () => {
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

            const emitResults = results.filter(
              (result: any) => !preResults.includes(result)
            );
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
        // clearInterval(emitInterval);
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
