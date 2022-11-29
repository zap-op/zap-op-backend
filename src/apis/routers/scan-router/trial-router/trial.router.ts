import express from "express";
import {isValidURL} from "../../../../utils/validator";
import {ZAPError} from "../../../../utils/errors/zap.error";
import ZAPService from "../../../../scan-services/zap-service/zap.service";
import {SCAN_STATUS} from "../scan.router";
import {SCAN_TYPE} from "../../../../database/models/scan-session.type";

const zapSpiderTrialRouter = express.Router();

zapSpiderTrialRouter.get("/", async (req, res) => {
    const urlToScan = req.query.url;
    if (typeof urlToScan !== "string" || !isValidURL(urlToScan))
        return res.status(400).send(SCAN_STATUS.INVAVLID_URL);

    const headers = {
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    };
    res.writeHead(200, headers);

    try {
        req.on("close", () => {
            console.log(`trial session disconnect`);
        });

        const zap = ZAPService.instance();
        const scanId: number = await zap.scan(
                urlToScan,
                SCAN_TYPE.ZAP.SPIDER,
                {
                    maxChildren: 1,
                    recurse: true,
                    contextName: "",
                    subtreeOnly: false
                });

        if (isNaN(scanId))
            throw new ZAPError("scanId type not suitable");

        zap.emitProgress(res, SCAN_TYPE.ZAP.SPIDER, scanId);
    } catch (error) {
        console.log(error);

        let errData: object = SCAN_STATUS.INTERNAL_ERROR;

        if (error instanceof Error) {
            if (error instanceof ReferenceError)
                errData = SCAN_STATUS.INVALID_SESSION;
            else if (error instanceof ZAPError)
                errData = SCAN_STATUS.ZAP_SERVICE_ERROR;

            errData = {...errData, exception: error.message};
        }

        res.write(`event: error\ndata: ${JSON.stringify(errData)}\n\n`);
    }
});

export {zapSpiderTrialRouter};
