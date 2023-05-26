import express, { Router } from "express";
import { JSONSchema7 } from "json-schema";
import { Validator } from "express-json-validator-middleware";
import { isValidObjectId } from "mongoose";
import { isValidURL } from "../../../../../utils/validator";
import { JWTRequest } from "../../../../../utils/middlewares";
import { targetModel } from "../../../../../models/target.model";
import { zapSpiderScanSessionModel } from "../../../../../models/scan-session.model";
import { mainProc } from "../../../../../services/logging.service";
import { serializeSSEEvent } from "../../../../../utils/network";
import {
	spiderFullResults, //
	spiderResults,
} from "../../../../../services/zapClient.service";
import {
	MGMT_STATUS, //
	SCAN_STATUS,
	TPOST,
	TZapSpiderRequest,
	TZapSpiderResponse,
} from "../../../../../utils/types";
import { spiderSharedStatusStream, spiderStartAndMonitor } from "../../../../../services/zapMonitor.service";

export function getZapSpiderRouter(): Router {
	const zapSpiderRouter = express.Router();
	const validator = new Validator({});

	const postZapSpiderSchema: JSONSchema7 = {
		type: "object",
		properties: {
			_id: {
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
		required: ["_id"],
	};

	zapSpiderRouter.post("/", validator.validate({ body: postZapSpiderSchema }), async (req: JWTRequest, res) => {
		const body = req.body as TZapSpiderRequest<TPOST>;

		const target = await targetModel.findById(body._id);
		if (!target)
			return res.status(400).send(MGMT_STATUS.TARGET_FIND_FAILED);

		const { target: url, _id: targetId } = target;
		if (typeof url !== "string" || !(await isValidURL(url))) 
			return res.status(400).send(SCAN_STATUS.INVAVLID_URL);

		const scanSession = new zapSpiderScanSessionModel({
			targetId,
			url,
			userId: req.accessToken!.userId,
			scanConfig: {
				maxChildren: body.scanConfig.maxChildren,
				recurse: body.scanConfig.recurse,
				contextName: body.scanConfig.contextName,
				subtreeOnly: body.scanConfig.subtreeOnly,
			},
		});
		await scanSession.save().catch((error) => {
			mainProc.error(error);
			return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
		});

		// emitDistinct and removeOnDone are default to true
		const emitDistinct = req.query.emitDistinct !== "false";
		const removeOnDone = req.query.removeOnDone !== "false";

		const scanId = await spiderStartAndMonitor(scanSession.url, scanSession.scanConfig, emitDistinct, removeOnDone).catch((error: any) => {
			mainProc.error(error);
			return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
		});
		if (!scanId) return res.status(500).send(SCAN_STATUS.ZAP_INITIALIZE_FAIL);

		return res.status(201).send({
			scanSession: scanSession._id,
			scanId,
		} as TZapSpiderResponse<TPOST>);
	});

	zapSpiderRouter.get("/", async (req: JWTRequest, res) => {
		const scanSession = req.query.scanSession;
		if (!scanSession || !isValidObjectId(scanSession)) return res.status(400).send(SCAN_STATUS.INVALID_SESSION);

		const scanId = req.query.scanId;
		if (typeof scanId !== "string" || isNaN(parseInt(scanId))) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		const headers = {
			"Content-Type": "text/event-stream",
			Connection: "keep-alive",
			"Cache-Control": "no-store",
			"X-Accel-Buffering": "no",
		};
		res.writeHead(200, headers);

		try {
			const scanSessionDoc = await zapSpiderScanSessionModel.findById(scanSession);
			if (!scanSessionDoc || scanSessionDoc.userId.toString() !== req.accessToken!.userId) return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_SESSION));

			const status$ = spiderSharedStatusStream(scanId);
			if (!status$) return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_ID));

			const writer = status$.subscribe({
				next: (status) => res.write(serializeSSEEvent("status", status)),
				error: (err) => res.write(serializeSSEEvent("error", err)),
			});

			req.on("close", () => {
				writer.unsubscribe();
			});
		} catch (error) {
			mainProc.error(`Error while polling ZAP spider results: ${error}`);
			res.write(serializeSSEEvent("error", error));
		}
	});

	zapSpiderRouter.get("/results", async (req, res) => {
		const scanId = req.query.id;
		if (typeof scanId !== "string" || isNaN(parseInt(scanId))) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		const offset = req.query.offet ?? "0";
		if (typeof offset !== "string" || isNaN(parseInt(offset))) return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

		const results = await spiderResults(scanId, parseInt(offset));
		if (!results) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		return res.status(200).send(results);
	});

	zapSpiderRouter.get("/fullResults", async (req, res) => {
		const scanId = req.query.id;
		if (typeof scanId !== "string" || isNaN(parseInt(scanId))) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		const urlsInScopeOffset = req.query.urlsInScopeOffset ?? "0";
		if (typeof urlsInScopeOffset !== "string" || isNaN(parseInt(urlsInScopeOffset))) return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

		const urlsOutOfScopeOffset = req.query.urlsOutOfScopeOffset ?? "0";
		if (typeof urlsOutOfScopeOffset !== "string" || isNaN(parseInt(urlsOutOfScopeOffset))) return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

		const urlsIoErrorOffset = req.query.urlsIoErrorOffset ?? "0";
		if (typeof urlsIoErrorOffset !== "string" || isNaN(parseInt(urlsIoErrorOffset))) return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

		const results = await spiderFullResults(scanId, {
			urlsInScopeOffset: parseInt(urlsInScopeOffset),
			urlsOutOfScopeOffset: parseInt(urlsOutOfScopeOffset),
			urlsIoErrorOffset: parseInt(urlsIoErrorOffset),
		});
		if (!results) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		return res.status(200).send(results);
	});

	return zapSpiderRouter;
}