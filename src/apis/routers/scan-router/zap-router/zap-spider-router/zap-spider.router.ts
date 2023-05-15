import express from "express";
import {JSONSchema7} from "json-schema";
import {Validator} from "express-json-validator-middleware";
import {JWTRequest} from "../../../../../utils/middlewares";
import {isValidURL} from "../../../../../utils/validator";
import {SCAN_STATUS} from "../../../../../submodules/utility/status";
import {zapSpiderScanSessionModel} from "../../../../../database/models/zap-spider.scan-session.model";
import {mainProc, userSession} from "../../../../../utils/log";
import {isValidObjectId} from "mongoose";
import {serializeSSEEvent} from "../../../../../utils/network";
import {
    spiderFullResults,
    spiderResults,
    spiderScan,
    spiderStatusStream
} from "../../../../../scan-services/zap-service/zap.service";

const zapSpiderRouter = express.Router();
const validator = new Validator({});

export const postZapSpiderSchema: JSONSchema7 = {
    type: "object",
    properties: {
        url: {
            type: "string",
        },
        scanConfig: {
            type: "object",
            properties: {
                maxChildren: {
                    type: "number",
                    minimum: 0,
                    default: 1,
                },
                recurse: {
                    type: "boolean",
                    default: true,
                },
                contextName: {
                    type: "string",
                    default: "",
                },
                subtreeOnly: {
                    type: "boolean",
                    default: false,
                },
            },
        },
    },
    required: ["url"],
};

zapSpiderRouter.post("/", validator.validate({body: postZapSpiderSchema}),
    async (req: JWTRequest, res) => {
        const body = req.body;

        if (!(await isValidURL(body.url)))
            return res.status(400).send(SCAN_STATUS.INVAVLID_URL);

        const scanSession = new zapSpiderScanSessionModel({
            url: body.url,
            userId: req.accessToken!.userId,
            scanConfig: {
                maxChildren: body.scanConfig.maxChildren,
                recurse: body.scanConfig.recurse,
                contextName: body.scanConfig.contextName,
                subtreeOnly: body.scanConfig.subtreeOnly,
            },
        });
        await scanSession.save().catch(error => {
            mainProc.error(error);
            return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
        });

        const scanId = await spiderScan(scanSession.url, scanSession.scanConfig).catch(error => {
            mainProc.error(error);
            return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
        });
        if (!scanId)
            return res.status(500).send(SCAN_STATUS.ZAP_INITIALIZE_FAIL);

        return res.status(201).send({
            scanSession: scanSession._id,
            scanStatus: SCAN_STATUS.SESSION_INITIALIZE_SUCCEED,
            scanId
        });
    }
);

zapSpiderRouter.get("/", async (req: JWTRequest, res) => {
    const scanSession = req.query.scanSession;
    if (!scanSession || !isValidObjectId(scanSession))
        return res.status(400).send(SCAN_STATUS.INVALID_SESSION);

    const scanId = req.query.scanId as string;
    if (!scanId || isNaN(parseInt(scanId)))
        return res.status(400).send(SCAN_STATUS.INVALID_ID);

    const headers = {
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no"
    };
    res.writeHead(200, headers);

    try {
        const scanSessionDoc = await zapSpiderScanSessionModel.findById(scanSession);
        if (!scanSessionDoc || scanSessionDoc.userId.toString() !== req.accessToken!.userId)
            return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_SESSION));

        req.on("close", () => {
            userSession.info(`ZAP spider session ${scanSessionDoc._id} disconnected`);
            writer.unsubscribe();
        });

        const emitDistinct = req.query.emitDistinct === "true";
        const removeOnDone = req.query.removeOnDone === "true";
        const writer = spiderStatusStream(parseInt(scanId), emitDistinct, removeOnDone).subscribe({
            next: status => res.write(serializeSSEEvent("status", status)),
            error: err => res.write(serializeSSEEvent("error", err))
        });
    } catch (error) {
        mainProc.error(`Error while polling ZAP spider results: ${error}`);
        res.write(serializeSSEEvent("error", error));
    }
});

zapSpiderRouter.get("/results", async (req, res) => {
    const scanId = req.query.id as string;
    if (!scanId || isNaN(parseInt(scanId)))
        return res.status(400).send(SCAN_STATUS.INVALID_ID);

    const offset = req.query.offet as string ?? 0;
    if (isNaN(parseInt(offset)))
        return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

    const results = await spiderResults(parseInt(scanId), parseInt(offset));
    if (!results)
        return res.status(400).send(SCAN_STATUS.INVALID_ID);

    return res.status(200).send(results);
});

zapSpiderRouter.get("/fullResults", async (req, res) => {
    const scanId = req.query.id as string;
    if (!scanId || isNaN(parseInt(scanId)))
        return res.status(400).send(SCAN_STATUS.INVALID_ID);

    const urlsInScopeOffset = req.query.urlsInScope as string ?? 0;
    if (isNaN(parseInt(urlsInScopeOffset)))
        return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

    const urlsOutOfScopeOffset = req.query.urlsOutOfScope as string ?? 0;
    if (isNaN(parseInt(urlsOutOfScopeOffset)))
        return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

    const urlsIoErrorOffset = req.query.urlsIoError as string ?? 0;
    if (isNaN(parseInt(urlsIoErrorOffset)))
        return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

    const results = await spiderFullResults(parseInt(scanId), {
        urlsInScope: parseInt(urlsInScopeOffset),
        urlsOutOfScope: parseInt(urlsOutOfScopeOffset),
        urlsIoError: parseInt(urlsIoErrorOffset)
    });
    if (!results)
        return res.status(400).send(SCAN_STATUS.INVALID_ID);

    return res.status(200).send(results);
});

export {zapSpiderRouter};