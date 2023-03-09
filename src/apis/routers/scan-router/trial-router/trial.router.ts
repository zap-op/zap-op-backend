import express from "express";
import {isValidURL} from "../../../../utils/validator";
import {SCAN_STATUS} from "../../../../submodules/utility/status";
import {spiderResults, spiderScan, spiderStatusStream} from "../../../../scan-services/zap-service/zap.service";
import {serializeSSEEvent} from "../../../../utils/network";
import {mainProc, userSession} from "../../../../utils/log";

const trialRouter = express.Router();

trialRouter.get("/", async (req, res) => {
    const headers = {
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no"
    };
    res.writeHead(200, headers);

    const urlToScan = req.query.url;
    if (typeof urlToScan !== "string" || !(await isValidURL(urlToScan)))
        return res.write(serializeSSEEvent("error", SCAN_STATUS.INVAVLID_URL));

    try {
        const scanId = await spiderScan(urlToScan, {
            maxChildren: 5,
            recurse: true,
            contextName: "",
            subtreeOnly: false
        });
        if (!scanId)
            return res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_INITIALIZE_FAIL));

        res.write(serializeSSEEvent("id", {id: scanId}));

        const emitDistinct = req.query.emitDistinct === "true";
        const removeOnDone = req.query.removeOnDone === "true";
        const writer = spiderStatusStream(scanId, emitDistinct, removeOnDone).subscribe({
            next: status => res.write(serializeSSEEvent("status", status)),
            error: (err) => {
                mainProc.error(`Error while polling ZAP spider results: ${err}`);
                res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_INTERNAL_ERROR));
            }
        });

        req.on("close", () => {
            userSession.info("One trial session disconnected");
            writer.unsubscribe();
        });
    } catch (error) {
        mainProc.error(`Error while polling ZAP spider results: ${error}`);
        res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_INTERNAL_ERROR));
    }
});

trialRouter.get("/results", async (req, res) => {
    const scanId = req.query.id as string;
    if (!scanId || isNaN(parseInt(scanId)))
        return res.status(400).send(SCAN_STATUS.INVALID_ID);

    const offset = req.query.offset as string ?? 0;
    if (isNaN(parseInt(offset)))
        return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

    const results = await spiderResults(parseInt(scanId), parseInt(offset));
    if (!results)
        return res.status(400).send(SCAN_STATUS.INVALID_ID_OR_ZAP_INTERNAL_ERROR);

    return res.status(200).send(results);
});

export {trialRouter};
