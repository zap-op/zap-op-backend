import express from "express";
import { Validator } from "express-json-validator-middleware";
import { JSONSchema7 } from "json-schema";
// @ts-ignore
import ZapClient from "zaproxy";
import { isValidURL } from "../../../../../utils/validator";
import { mainProc, userSession } from "../../../../../services/logging.service";
import { isValidObjectId } from "mongoose";
import { serializeSSEEvent } from "../../../../../utils/network";
import {
    ajaxFullResults,
    ajaxResults,
    ajaxScan,
    ajaxStatusStream,
    initZapClient,
} from "../../../../../utils/zapClient";
import { startZapProcess, ZAP_SESSION_TYPES } from "../../../../../utils/zapProc";
import { ProtectedRequest } from "../../../../../submodules/utility/auth";
import { SCAN_STATUS } from "../../../../../submodules/utility/status";
import { zapAjaxScanSessionModel } from "../../../../../models/scan-session.model";

export function initZapAjaxRouter() {
    const zapAjaxRouter = express.Router();
    const validator = new Validator({});

    const postZapAjaxSchema: JSONSchema7 = {
        type: "object",
        properties: {
            url: {
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
        required: ["url"],
    };

    zapAjaxRouter.post("/", validator.validate({body: postZapAjaxSchema}),
        async (req: ProtectedRequest, res) => {
            const body = req.body;

            if (!(await isValidURL(body.url)))
                return res.status(400).send(SCAN_STATUS.INVAVLID_URL);

            try {
                const scanSession = new zapAjaxScanSessionModel({
                    url: body.url,
                    userId: req.session.userId,
                    scanConfig: {
                        inScope: body.scanConfig.inScope,
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

    const tempZapClients: Map<number, ZapClient> = new Map();

    zapAjaxRouter.get("/", async (req: ProtectedRequest, res) => {
        const scanSession = req.query.scanSession;
        if (!scanSession || !isValidObjectId(scanSession))
            return res.status(400).send(SCAN_STATUS.INVALID_SESSION);

        const headers = {
            "Content-Type": "text/event-stream",
            "Connection": "keep-alive",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no"
        };
        res.writeHead(200, headers);

        try {
            const scanSessionDoc: any = await zapAjaxScanSessionModel
                .findById(scanSession);
            if (!scanSessionDoc || scanSessionDoc.userId.toString() !== req.session.userId)
                return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_SESSION));

            req.on("close", async () => {
                userSession.info(`ZAP ajax session ${scanSessionDoc._id} disconnected`);
                writer.unsubscribe();
                await zapClient.core.shutdown();
                tempZapClients.delete(zapClientId);
            });

            const zapClient = initZapClient(await startZapProcess(ZAP_SESSION_TYPES.TEMP));
            const zapClientId = Math.floor(Math.random() * 1000000);
            tempZapClients.set(zapClientId, zapClient);

            res.write(serializeSSEEvent("id", {id: zapClientId}));

            const scanId = await ajaxScan(zapClient, scanSessionDoc.url, scanSessionDoc.scanConfig);
            if (!scanId)
                return res.write(serializeSSEEvent("error", SCAN_STATUS.ZAP_INITIALIZE_FAIL));

            const writer = ajaxStatusStream(zapClient).subscribe({
                next: status => res.write(serializeSSEEvent("status", status)),
                error: err => res.write(serializeSSEEvent("error", err))
            });
        } catch (error) {
            mainProc.error(`Error while polling ZAP ajax results: ${error}`);
            res.write(serializeSSEEvent("error", error));
        }
    });

    zapAjaxRouter.get("/results", async (req, res) => {
        const zapClientId = req.query.id as string;
        if (!zapClientId || isNaN(parseInt(zapClientId)))
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        const offset = req.query.offet as string ?? 0;
        if (isNaN(parseInt(offset)))
            return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

        const results = await ajaxResults(parseInt(zapClientId), parseInt(offset));
        if (!results)
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        return res.status(200).send(results);
    });

    zapAjaxRouter.get("/fullResults", async (req, res) => {
        const zapClientId = req.query.id as string;
        if (!zapClientId || isNaN(parseInt(zapClientId)))
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        const inScope = req.query.inScope as string ?? 0;
        if (isNaN(parseInt(inScope)))
            return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

        const outOfScope = req.query.outOfScope as string ?? 0;
        if (isNaN(parseInt(outOfScope)))
            return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

        const errors = req.query.errors as string ?? 0;
        if (isNaN(parseInt(errors)))
            return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

        const results = await ajaxFullResults(parseInt(zapClientId), {
            inScope: parseInt(inScope),
            outOfScope: parseInt(outOfScope),
            errors: parseInt(errors)
        });
        if (!results)
            return res.status(400).send(SCAN_STATUS.INVALID_ID);

        return res.status(200).send(results);
    });

    return zapAjaxRouter;
}