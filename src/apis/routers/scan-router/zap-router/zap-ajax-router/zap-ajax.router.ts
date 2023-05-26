import express, { Router } from "express";
import { Validator } from "express-json-validator-middleware";
import { JSONSchema7 } from "json-schema";
import { isValidURL } from "../../../../../utils/validator";
import { MGMT_STATUS, SCAN_STATUS } from "../../../../../utils/types";
import { JWTRequest } from "../../../../../utils/middlewares";
import { zapAjaxScanSessionModel } from "../../../../../models/scan-session.model";
import { mainProc, userSession } from "../../../../../services/logging.service";
import { isValidObjectId } from "mongoose";
import { serializeSSEEvent } from "../../../../../utils/network";
import { ajaxFullResults, ajaxResults } from "../../../../../services/zapClient.service";
import { ajaxSharedStatusStream, ajaxStartAndMonitor } from "../../../../../services/zapMonitor.service";
import { targetModel } from "../../../../../models/target.model";

export function getZapAjaxRouter(): Router {
    const zapAjaxRouter = express.Router();
    const validator = new Validator({});

    const postZapAjaxSchema: JSONSchema7 = {
        type: "object",
        properties: {
            _id: {
                type: "string",
            },
            scanConfig: {
                type: "object",
                properties: {
                    inScope: {
                        type: "boolean",
                        default: false,
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
        required: ["_id"],
    };

    zapAjaxRouter.post("/", validator.validate({body: postZapAjaxSchema}), async (req: JWTRequest, res) => {
        const body = req.body;

        const target = await targetModel.findById(body._id);
        if (!target)
            return res.status(400).send(MGMT_STATUS.TARGET_FIND_FAILED);

        const { target: url, _id: targetId } = target;
        if (typeof url !== "string" || !(await isValidURL(url)))
            return res.status(400).send(SCAN_STATUS.INVAVLID_URL);

        const scanSession = new zapAjaxScanSessionModel({
            targetId,
            url: url,
            userId: req.accessToken!.userId,
            scanConfig: {
                inScope: body.scanConfig.inScope,
                contextName: body.scanConfig.contextName,
                subtreeOnly: body.scanConfig.subtreeOnly,
            },
        });
        await scanSession.save().catch(error => {
            mainProc.error(error);
            return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
        });

        // emitDistinct is default to true
        const emitDistinct = req.query.emitDistinct !== "false";

        const zapClientId = await ajaxStartAndMonitor(scanSession.url, scanSession.scanConfig, emitDistinct).catch(error => {
            mainProc.error(error);
            return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
        });
        if (!zapClientId)
            return res.status(500).send(SCAN_STATUS.ZAP_INITIALIZE_FAIL);

        return res.status(201).send({
            scanSession: scanSession._id,
            zapClientId
        });
    });

    zapAjaxRouter.get("/", async (req: JWTRequest, res) => {
        const scanSession = req.query.scanSession;
        if (!scanSession || !isValidObjectId(scanSession))
            return res.status(400).send(SCAN_STATUS.INVALID_SESSION);

        const zapClientId = req.query.zapClientId;
        if (typeof zapClientId !== "string" || isNaN(parseInt(zapClientId)))
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        const headers = {
            "Content-Type": "text/event-stream",
            "Connection": "keep-alive",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no"
        };
        res.writeHead(200, headers);

        try {
            const scanSessionDoc = await zapAjaxScanSessionModel.findById(scanSession);
            if (!scanSessionDoc || scanSessionDoc.userId.toString() !== req.accessToken!.userId)
                return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_SESSION));

            const status$ = ajaxSharedStatusStream(zapClientId);
            if (!status$)
                return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_ID));

            const writer = status$.subscribe({
                next: status => res.write(serializeSSEEvent("status", status)),
                error: err => res.write(serializeSSEEvent("error", err))
            });

            req.on("close", () => {
                userSession.info(`ZAP ajax session ${scanSessionDoc._id} disconnected`);
                writer.unsubscribe();
            });
        } catch (error) {
            mainProc.error(`Error while polling ZAP ajax results: ${error}`);
            res.write(serializeSSEEvent("error", error));
        }
    });

    zapAjaxRouter.get("/results", async (req, res) => {
        const zapClientId = req.query.id;
        if (typeof zapClientId !== "string" || isNaN(parseInt(zapClientId)))
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        const offset = req.query.offet ?? "0";
        if (typeof offset !== "string" || isNaN(parseInt(offset)))
            return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

        const results = await ajaxResults(zapClientId, parseInt(offset));
        if (!results)
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        return res.status(200).send(results);
    });

    zapAjaxRouter.get("/fullResults", async (req, res) => {
        const zapClientId = req.query.id;
        if (typeof zapClientId !== "string" || isNaN(parseInt(zapClientId)))
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        const urlsInScopeOffset = req.query.inScope ?? "0";
        if (typeof urlsInScopeOffset !== "string" || isNaN(parseInt(urlsInScopeOffset)))
            return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

        const urlsOutOfScopeOffset = req.query.outOfScope ?? "0";
        if (typeof urlsOutOfScopeOffset !== "string" || isNaN(parseInt(urlsOutOfScopeOffset)))
            return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

        const urlsErrorOffset = req.query.errors ?? "0";
        if (typeof urlsErrorOffset !== "string" || isNaN(parseInt(urlsErrorOffset)))
            return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

        const results = await ajaxFullResults(zapClientId, {
            inScope: parseInt(urlsInScopeOffset),
            outOfScope: parseInt(urlsOutOfScopeOffset),
            errors: parseInt(urlsErrorOffset)
        });
        if (!results)
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        return res.status(200).send(results);
    });

    return zapAjaxRouter;
}