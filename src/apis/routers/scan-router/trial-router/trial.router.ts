import express from "express";
import {isValidURL} from "../../../../utils/validator";
import {SCAN_STATUS} from "../../../../submodules/utility/status";
import {initSpider, spiderProgressStream} from "../../../../scan-services/zap-service/zap.service";
import {serializeSSEEvent} from "../../../../utils/network";

const trialRouter = express.Router();

trialRouter.get("/", async (req, res) => {
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
        const scanId = await initSpider(urlToScan, {
            maxChildren: 1,
            recurse: true,
            contextName: "",
            subtreeOnly: false
        });
        if (!scanId)
            return res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_SPIDER_INITIALIZE_FAIL));

        const emitDistinct = req.query.emitDistinct === "true";
        const removeOnDone = req.query.removeOnDone === "true";
        const writer = spiderProgressStream(scanId, emitDistinct, removeOnDone).subscribe({
            next: status => res.write(serializeSSEEvent("status", status)),
            error: err => res.write(serializeSSEEvent("error", err))
        });

        req.on("close", () => {
            console.log("ZAP spider trial session disconnected");
            writer.unsubscribe();
        });
    } catch (error) {
        console.error(`Error while polling ZAP spider results: ${error}`);
        res.write(serializeSSEEvent("error", error));
    }
});

export {trialRouter};
