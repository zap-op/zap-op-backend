import { Router } from "express";
import { Validator } from "express-json-validator-middleware";
import { JSONSchema7 } from "json-schema";
import { JWTRequest } from "../../../../../utils/middlewares";
import { targetModel, zapActiveScanSessionModel } from "../../../../../models";
import { MGMT_STATUS, SCAN_STATUS, ScanState, TUserModel } from "../../../../../utils/types";
import { isValidURL } from "../../../../../utils/validator";
import { activeSharedStatusStream, activeStartAndMonitor } from "../../../../../services/zapMonitor.service";
import { mainProc, userSession } from "../../../../../services/logging.service";
import { isValidObjectId } from "mongoose";
import { serializeSSEEvent } from "../../../../../utils/network";
import { activeFullResults, activeScanProgress } from "../../../../../services/zapClient.service";

export function getZapActiveRouter(): Router {
	const zapActiveRouter = Router();
	const validator = new Validator({});

	const postZapActiveSchema: JSONSchema7 = {
		type: "object",
		properties: {
			_id: {
				type: "string",
			},
			exploreType: {
				type: "string",
			},
			spiderConfig: {
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
			ajaxConfig: {
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
			scanConfig: {
				type: "object",
				properties: {
					recurse: {
						type: "boolean",
						default: true,
					},
					inScopeOnly: {
						type: "boolean",
						default: false,
					},
					scanPolicyName: {
						type: "string",
						default: "",
					},
					method: {
						type: "string",
						default: "",
					},
					postData: {
						type: "string",
						default: "",
					},
					contextId: {
						type: "string",
						default: "",
					},
				},
			},
		},
		required: ["_id", "exploreType"],
	};

	zapActiveRouter.post("/", validator.validate({ body: postZapActiveSchema }), async (req: JWTRequest, res) => {
		const body = req.body;

		const target = await targetModel.findById(body._id);
		if (!target) {
			return res.status(400).send(MGMT_STATUS.TARGET_FIND_FAILED);
		}

		const { target: url, _id: targetId } = target;
		if (typeof url !== "string" || !(await isValidURL(url))) {
			return res.status(400).send(SCAN_STATUS.INVAVLID_URL);
		}

		const scanSessionData = Object.assign(
			{},
			{
				targetPop: targetId,
				userPop: req.accessToken!.userId,
				status: {
					state: ScanState.PROCESSING,
				},
				exploreType: body.exploreType,
				scanConfig: { ...body.scanConfig },
			},
			body.exploreType === "spider" ? { spiderConfig: { ...body.spiderConfig } } ?? {} : {},
			body.exploreType === "ajax" ? { ajaxConfig: { ...body.ajaxConfig } } ?? {} : {},
		);
		const scanSession = new zapActiveScanSessionModel(scanSessionData);

		// emitDistinct is default to true
		const emitDistinct = req.query.emitDistinct !== "false";

		const startResult = await activeStartAndMonitor(scanSession._id, url, scanSession.exploreType, scanSession.exploreType === "spider" ? scanSession.spiderConfig : scanSession.ajaxConfig, scanSession.scanConfig, emitDistinct).catch((error) => {
			mainProc.error(`Error while starting active: ${error}`);
		});
		if (!startResult) {
			scanSession
				.set("status", {
					state: ScanState.FAILED,
					message: "Error while starting scan.",
				})
				.save()
				.catch((error) => {
					mainProc.error(`Error while update scan state to active session: ${error}`);
				});
			return res.status(500).send(SCAN_STATUS.ZAP_INITIALIZE_FAIL);
		}

		try {
			await scanSession.set("zapClientId", startResult.clientId).set("zapScanId", startResult.scanId).save();
		} catch (error) {
			mainProc.error(`Error while saving active client id: ${error}`);
			return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
		}
		return res.status(201).send(SCAN_STATUS.SESSION_INITIALIZE_SUCCEED);
	});

	zapActiveRouter.get("/", async (req: JWTRequest, res) => {
		const scanSession = req.query.scanSession;
		if (!scanSession || !isValidObjectId(scanSession)) {
			return res.status(400).send(SCAN_STATUS.INVALID_SESSION);
		}

		const zapClientId = req.query.zapClientId;
		if (typeof zapClientId !== "string" || zapClientId.length === 0) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		const zapScanId = req.query.zapScanId;
		if (typeof zapScanId !== "string" || zapScanId.length === 0) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		const headers = {
			"Content-Type": "text/event-stream",
			Connection: "keep-alive",
			"Cache-Control": "no-store",
			"X-Accel-Buffering": "no",
		};
		res.writeHead(200, headers);

		try {
			const scanSessionDoc = await zapActiveScanSessionModel.findById(scanSession).populate<{ userPop: TUserModel }>("userPop", "_id").exec();
			if (!scanSessionDoc || scanSessionDoc.userPop._id.toString() !== req.accessToken!.userId) {
				return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_SESSION));
			}

			const status$ = activeSharedStatusStream(zapClientId, zapScanId);
			if (!status$) {
				return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_ID));
			}

			const writer = status$.subscribe({
				next: (status) => res.write(serializeSSEEvent("status", status)),
				error: (err) => res.write(serializeSSEEvent("error", err)),
			});

			req.on("close", () => {
				userSession.info(`ZAP active session ${scanSessionDoc._id} disconnected`);
				writer.unsubscribe();
			});
		} catch (error) {
			mainProc.error(`Error while polling ZAP active progress: ${error}`);
			res.write(serializeSSEEvent("error", error));
		}
	});

	zapActiveRouter.get("/scanProgress", async (req, res) => {
		const zapClientId = req.query.zapClientId;
		if (typeof zapClientId !== "string" || isNaN(parseInt(zapClientId))) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		const zapScanId = req.query.zapScanId;
		if (typeof zapScanId !== "string" || isNaN(parseInt(zapScanId))) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		const offset = req.query.offset ?? "0";
		if (typeof offset !== "string" || isNaN(parseInt(offset))) {
			return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);
		}

		const results = await activeScanProgress(zapClientId, zapScanId, parseInt(offset));
		if (!results) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		return res.status(200).send(results);
	});

	zapActiveRouter.get("/fullResults", async (req, res) => {
		const zapClientId = req.query.zapClientId;
		if (typeof zapClientId !== "string" || isNaN(parseInt(zapClientId))) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		const offset = req.query.offset ?? "0";
		if (typeof offset !== "string" || isNaN(parseInt(offset))) {
			return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);
		}

		const results = await activeFullResults(zapClientId, parseInt(offset));
		if (!results) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		return res.status(200).send(results);
	});

	return zapActiveRouter;
}
