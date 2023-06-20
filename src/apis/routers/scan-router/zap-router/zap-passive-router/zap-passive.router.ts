import { Router } from "express";
import { Validator } from "express-json-validator-middleware";
import { JSONSchema7 } from "json-schema";
import { JWTRequest } from "../../../../../utils/middlewares";
import { targetModel, zapPassiveScanFullResultsModel, zapPassiveScanSessionModel } from "../../../../../models";
import { MGMT_STATUS, SCAN_STATUS, ScanState, TScanSessionModel, TUserModel } from "../../../../../utils/types";
import { isValidURL } from "../../../../../utils/validator";
import { passiveSharedStatusStream, passiveStartAndMonitor } from "../../../../../services/zapMonitor.service";
import { mainProc, userSession } from "../../../../../services/logging.service";
import { isValidObjectId } from "mongoose";
import { serializeSSEEvent } from "../../../../../utils/network";
import { passiveAlerts } from "../../../../../services/zapClient.service";

export function getZapPassiveRouter(): Router {
	const zapPassiveRouter = Router();
	const validator = new Validator({});

	const postZapPassiveSchema: JSONSchema7 = {
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
		},
		required: ["_id", "exploreType"],
	};

	zapPassiveRouter.post("/", validator.validate({ body: postZapPassiveSchema }), async (req: JWTRequest, res) => {
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
			},
			body.exploreType === "spider" ? { spiderConfig: { ...body.spiderConfig } } ?? {} : {},
			body.exploreType === "ajax" ? { ajaxConfig: { ...body.ajaxConfig } } ?? {} : {},
		);
		const scanSession = new zapPassiveScanSessionModel(scanSessionData);

		// emitDistinct is default to true
		const emitDistinct = req.query.emitDistinct !== "false";

		const zapClientId = await passiveStartAndMonitor(scanSession._id, url, scanSession.exploreType, scanSession.exploreType === "spider" ? scanSession.spiderConfig : scanSession.ajaxConfig, emitDistinct).catch((error) => {
			mainProc.error(`Error while starting passive: ${error}`);
		});
		if (!zapClientId) {
			scanSession
				.set("status", {
					state: ScanState.FAILED,
					message: "Error while starting scan.",
				})
				.save()
				.catch((error) => {
					mainProc.error(`Error while update scan state to passive session: ${error}`);
				});
			return res.status(500).send(SCAN_STATUS.ZAP_INITIALIZE_FAIL);
		}

		try {
			await scanSession.set("zapClientId", zapClientId).save();
		} catch (error) {
			mainProc.error(`Error while saving passive client id: ${error}`);
			return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
		}
		return res.status(201).send(SCAN_STATUS.SESSION_INITIALIZE_SUCCEED);
	});

	zapPassiveRouter.get("/", async (req: JWTRequest, res) => {
		const scanSession = req.query.scanSession;
		if (!scanSession || !isValidObjectId(scanSession)) {
			return res.status(400).send(SCAN_STATUS.INVALID_SESSION);
		}

		const zapClientId = req.query.zapClientId;
		if (typeof zapClientId !== "string" || zapClientId.length === 0) {
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
			const scanSessionDoc = await zapPassiveScanSessionModel.findById(scanSession).then((session) => {
				if (session?.userPop.toString() !== req.accessToken?.userId) {
					return undefined;
				}
				return session;
			});
			if (!scanSessionDoc) {
				return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_SESSION));
			}

			const status$ = passiveSharedStatusStream(zapClientId);
			if (!status$) {
				return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_ID));
			}

			const writer = status$.subscribe({
				next: (status) => res.write(serializeSSEEvent("status", status)),
				error: (err) => res.write(serializeSSEEvent("error", err)),
			});

			req.on("close", () => {
				userSession.info(`ZAP passive session ${scanSessionDoc._id} disconnected`);
				writer.unsubscribe();
			});
		} catch (error) {
			mainProc.error(`Error while polling ZAP passive progress: ${error}`);
			res.write(serializeSSEEvent("error", error));
		}
	});

	zapPassiveRouter.get("/fullResults", async (req: JWTRequest, res) => {
		const scanSession = req.query.scanSession;
		if (typeof scanSession !== "string" || isNaN(parseInt(scanSession))) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		const results = await zapPassiveScanFullResultsModel
			.findOne({
				sessionPop: scanSession,
			})
			.populate<{
				sessionPop: Pick<TScanSessionModel, "userPop">;
			}>("sessionPop", "userPop")
			.then((res) => {
				if (res?.sessionPop.userPop.toString() !== req.accessToken?.userId) {
					return undefined;
				}
				return res;
			});
		if (!results) {
			return res.status(400).send(SCAN_STATUS.INVALID_ID);
		}

		return res.status(200).send(results);
	});

	return zapPassiveRouter;
}
