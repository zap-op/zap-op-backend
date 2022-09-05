import SCAN_TYPE from '../utils/scan.type.js';
import _validator from '../utils/validator.js';
import ZAProxyClient from './zap.client.js';

class ZAPService {
    #service = ZAProxyClient;
    constructor() {
        if (ZAPService._instance) {
            return ZAPService._instance;
        }
        ZAPService._instance = this;
    }

    /**
     * Start scan
     * @param {string} url URL to scan
     * @param {string} type Type scan code
     * @param {Object} config Scan's configuration object
     * @returns {Promise|Number} Scan ID at OWASP ZAP application
     */
    async scan(url, type, config) {
        if (type == SCAN_TYPE.ZAP.SPIDER) {
            return this.#service.spider.scan(url, config.maxChildren, config.recurse, config.contextName, config.subtreeOnly)
                .then((result) => {
                    return result.scan;
                }).catch((err) => {
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
    async emit(clientResponse, type, scanId) {
        if (type == SCAN_TYPE.ZAP.SPIDER) {
            try {
                let scanProgress = await this.#service.spider.status(scanId)
                    .then((result) => {
                        return result.status;
                    });
                let preResults = [];
                let preScanProgress = 0;
                while (scanProgress < 100) {
                    await new Promise(res => setTimeout(res, 1000));
                    scanProgress = await this.#service.spider.status(scanId)
                        .then((result) => {
                            return result.status;
                        });
                    const results = await this.#service.spider.results(scanId)
                        .then((result) => {
                            return result.results;
                        });
                    const emitResults = results.filter(result => !preResults.includes(result));
                    if (_validator.isValidArray(emitResults) || scanProgress > preScanProgress) {
                        clientResponse.write(`data: ${JSON.stringify({
                            scanProgress: scanProgress,
                            results: emitResults
                        })}\n\n`);
                        preResults = results;
                        preScanProgress = scanProgress;
                    }
                }
                this.#service.spider.removeScan(scanId);
            } catch (error) {
                console.log(error);
            }
        }
    }
}


export default ZAPService;
// let statusSubject = new Subject('0');

// statusSubject.subscribe(async (val) => {
//     console.log(val);

//     if (val == 100) {
//         const res = await zaproxy.spider.results(id.scan);
//         console.log(res);
//     }
//     else {
//         setTimeout(async () => {
//             const status = await zaproxy.spider.status(id.scan);
//             statusSubject.next(status.status);
//         }, 5000);
//     }
// });

// const id = await zaproxy.spider.scan('https://www.google.com', 50, false, null, true);

// const status = await zaproxy.spider.status(id.scan);
// statusSubject.next(status.status);

// zaproxy.spider.fullResults(0, (err, res) => {
//     if (err) {
//         console.log(err);
//         return;
//     }
//     console.log(res.fullResults[1].urlsOutOfScope.length);
//     console.log(res.fullResults[0].urlsInScope.length);
// })