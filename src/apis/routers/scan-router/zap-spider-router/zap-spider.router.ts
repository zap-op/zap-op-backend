import express from "express";
import {Validator} from "express-json-validator-middleware";
import {JSONSchema7} from "json-schema";
import {isValidURL} from "../../../../utils/validator";
import {zapSpiderScanSessionModel} from "../../../../database/models/zap-spider.scan-session.model";
import {ZAPError} from "../../../../utils/errors/zap.error";
import ZAPService from "../../../../scan-services/zap-service/zap.service";
import {SCAN_STATUS} from "../scan.router";
import {isValidObjectId} from "mongoose";
import {JWTRequest} from "../../../../utils/middlewares";

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

zapSpiderRouter.post(
    "/",
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
            console.error(error);
            res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
        }
    }
);

zapSpiderRouter.get("/", async (req: JWTRequest, res) => {
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
            throw ReferenceError("scanSessionDoc is not defined");

        req.on("close", () => {
            console.log(`client session ${scanSessionDoc._id} disconnect`);
        });

        const zap = ZAPService.instance();
        const scanId: number = await zap.scan(
            scanSessionDoc.url,
            scanSessionDoc.__t,
            scanSessionDoc.scanConfig
        );

        if (isNaN(scanId))
            throw new ZAPError("scanId type not suitable");

        zap.emitProgress(res, scanSessionDoc.__t, scanId);
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

export {zapSpiderRouter};
