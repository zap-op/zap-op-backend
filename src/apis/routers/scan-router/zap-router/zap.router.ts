import express from "express";
import {Validator} from "express-json-validator-middleware";
import {JSONSchema7} from "json-schema";
import {JWTRequest} from "../../../../utils/middlewares";
import {isValidURL} from "../../../../utils/validator";
import {SCAN_STATUS} from "../../../../submodules/utility/status";
import {zapSpiderScanSessionModel} from "../../../../database/models/zap-spider.scan-session.model";
import {isValidObjectId} from "mongoose";
import {initSpider, spiderProgressStream} from "../../../../scan-services/zap-service/zap.service";
import {serializeSSEEvent} from "../../../../utils/network";
import {mainProc, userSession} from "../../../../utils/log";

const zapRouter = express.Router();
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

zapRouter.post(
    "/spider",
    validator.validate({body: postZapSpiderSchema}),
    async (req: JWTRequest, res) => {
        const body = req.body;

        if (!isValidURL(body.url))
            return res.status(400).send(SCAN_STATUS.INVAVLID_URL);

        try {
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
            await scanSession.save();
            return res.status(201).send({
                scanSession: scanSession._id,
                scanStatus: SCAN_STATUS.SESSION_INITIALIZE_SUCCEED,
            });
        } catch (error) {
            mainProc.error(error);
            res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
        }
    }
);

zapRouter.get("/spider", async (req: JWTRequest, res) => {
    const scanSession = req.query.scanSession;
    if (!scanSession || !isValidObjectId(scanSession))
        return res.status(500).send(SCAN_STATUS.INVALID_SESSION);

    const headers = {
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    };
    res.writeHead(200, headers);

    try {
        const scanSessionDoc: any = await zapSpiderScanSessionModel
            .findById(scanSession);
        if (!scanSessionDoc || scanSessionDoc.userId.toString() !== req.accessToken!.userId)
            return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_SESSION));

        const scanId = await initSpider(scanSessionDoc.url, scanSessionDoc.scanConfig);
        if (!scanId)
            return res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_SPIDER_INITIALIZE_FAIL));

        const emitDistinct = req.query.emitDistinct === "true";
        const removeOnDone = req.query.removeOnDone === "true";
        const writer = spiderProgressStream(scanId, emitDistinct, removeOnDone).subscribe({
            next: status => res.write(serializeSSEEvent("status", status)),
            error: err => res.write(serializeSSEEvent("error", err))
        });

        req.on("close", () => {
            userSession.info(`ZAP spider session ${scanSessionDoc._id} disconnected`);
            writer.unsubscribe();
        });
    } catch (error) {
        mainProc.error(`Error while polling ZAP spider results: ${error}`);
        res.write(serializeSSEEvent("error", error));
    }
});

export {zapRouter};