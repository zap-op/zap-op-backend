import { Router } from "express";
import { JSONSchema7 } from "json-schema";
import { Validator } from "express-json-validator-middleware";
import { isValidObjectId } from "mongoose";
import { isValidURL } from "../../../../../utils/validator";
import { JWTRequest } from "../../../../../utils/middlewares";
import { mainProc } from "../../../../../services/logging.service";
import { serializeSSEEvent } from "../../../../../utils/network";
import { spiderSharedStatusStream, spiderStartAndMonitor } from "../../../../../services/zapMonitor.service";
import { sharedClientId, spiderResults } from "../../../../../services/zapClient.service";
import { targetModel, zapSpiderScanFullResultsModel, zapSpiderScanSessionModel } from "../../../../../models";
import { MGMT_STATUS, SCAN_STATUS, ScanState, TPOST, TScanSessionModel, TUserModel, TZapSpiderRequest } from "../../../../../utils/types";

export function getZapSpiderRouter(): Router {
	const zapSpiderRouter = Router();
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
						default: 0,
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
		if (!target) return res.status(400).send(MGMT_STATUS.TARGET_FIND_FAILED);

		const { target: url, _id: targetId } = target;
		if (typeof url !== "string" || !(await isValidURL(url))) return res.status(400).send(SCAN_STATUS.INVAVLID_URL);

		const scanSession = new zapSpiderScanSessionModel({
			targetPop: targetId,
			userPop: req.accessToken!.userId,
			status: {
				state: ScanState.PROCESSING,
			},
			scanConfig: { ...body.scanConfig },
		});

		// emitDistinct and removeOnDone are default to true
		const emitDistinct = req.query.emitDistinct !== "false";
		const removeOnDone = req.query.removeOnDone !== "false";

		const zapScanId = await spiderStartAndMonitor(scanSession._id, url, scanSession.scanConfig, emitDistinct, removeOnDone).catch((error) => {
			mainProc.error(`Error while starting spider: ${error}`);
		});
		if (!zapScanId) {
			scanSession
				.set("status", {
					state: ScanState.FAILED,
					message: "Error while starting scan.",
				})
				.save()
				.catch((error) => {
					mainProc.error(`Error while update scan state to session: ${error}`);
				});
			return res.status(500).send(SCAN_STATUS.ZAP_INITIALIZE_FAIL);
		}

		try {
			await scanSession.set("zapScanId", zapScanId).save();
		} catch (error) {
			mainProc.error(`Error while saving spider scan session: ${error}`);
			return res.status(500).send(SCAN_STATUS.SESSION_INITIALIZE_FAIL);
		}

		return res.status(201).send(SCAN_STATUS.SESSION_INITIALIZE_SUCCEED);
	});

	zapSpiderRouter.get("/", async (req: JWTRequest, res) => {
		const scanSession = req.query.scanSession;
		if (!scanSession || !isValidObjectId(scanSession)) return res.status(400).send(SCAN_STATUS.INVALID_SESSION);

		const zapScanId = req.query.zapScanId;
		if (typeof zapScanId !== "string" || isNaN(parseInt(zapScanId))) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		const headers = {
			"Content-Type": "text/event-stream",
			Connection: "keep-alive",
			"Cache-Control": "no-store",
			"X-Accel-Buffering": "no",
		};
		res.writeHead(200, headers);

		try {
			const scanSessionDoc = await zapSpiderScanSessionModel.findById(scanSession).then((session) => {
				if (session?.userPop.toString() !== req.accessToken?.userId) {
					return undefined;
				}
				return session;
			});
			if (!scanSessionDoc) {
				return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_SESSION));
			}

			const status$ = spiderSharedStatusStream(zapScanId);
			if (!status$) {
				return res.write(serializeSSEEvent("error", SCAN_STATUS.INVALID_ID));
			}

			const writer = status$.subscribe({
				next: (status) => res.write(serializeSSEEvent("status", status)),
				error: (err) => res.write(serializeSSEEvent("error", err)),
			});

			req.on("close", () => {
				writer.unsubscribe();
			});
		} catch (error) {
			mainProc.error(`Error while polling ZAP spider progress: ${error}`);
			res.write(serializeSSEEvent("error", error));
		}
	});

	zapSpiderRouter.get("/results", async (req, res) => {
		const scanId = req.query.id;
		if (typeof scanId !== "string" || isNaN(parseInt(scanId))) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		const offset = req.query.offet ?? "0";
		if (typeof offset !== "string" || isNaN(parseInt(offset))) return res.status(400).send(SCAN_STATUS.INVALID_RESULT_OFFSET);

		const results = await spiderResults(sharedClientId, scanId, parseInt(offset));
		if (!results) return res.status(400).send(SCAN_STATUS.INVALID_ID);

		return res.status(200).send(results);
	});

	zapSpiderRouter.get("/fullResults", async (req: JWTRequest, res) => {
		const scanSession = req.query.scanSession;
		if (!scanSession || !isValidObjectId(scanSession)) {
			return res.status(400).send(SCAN_STATUS.INVALID_SESSION);
		}

		const results = await zapSpiderScanFullResultsModel
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

	return zapSpiderRouter;
}
