import { Router } from "express";
import { Validator } from "express-json-validator-middleware";
import { JSONSchema7 } from "json-schema";
import { isValidURL } from "../../../utils/validator";
import { JWTRequest } from "../../../utils/middlewares";
import { mainProc } from "../../../services/logging.service";
import { targetModel, targetTrashModel, scanSessionModel } from "../../../models";
import { MGMT_STATUS, TTargetModel } from "../../../utils/types";

export function getMgmtRouter(): Router {
	const mgmtRouter = Router();
	const validator = new Validator({});

	const postTargetSchema: JSONSchema7 = {
		type: "object",
		properties: {
			name: {
				type: "string",
			},
			target: {
				type: "string",
			},
			tag: {
				type: "array",
				items: {
					type: "string",
				},
			},
		},
		required: ["name", "target"],
	};

	mgmtRouter.get("/targets", async (req: JWTRequest, res) => {
		const targets = await targetModel
			.find({
				userId: req.accessToken!.userId,
			})
			.sort({
				updatedAt: -1,
			});
		res.status(200).json(targets);
	});

	mgmtRouter.post("/target", validator.validate({ body: postTargetSchema }), async (req: JWTRequest, res) => {
		const body = req.body;

		if (!(await isValidURL(body.target))) {
			return res.status(400).send(MGMT_STATUS.TARGET_INVAVLID_URL);
		}

		try {
			if (
				await targetModel.findOne({
					userId: req.accessToken!.userId,
					name: body.name,
				})
			) {
				return res.status(400).send(MGMT_STATUS.TARGET_NAME_DUPLICATE);
			}

			const newTarget = new targetModel({
				userId: req.accessToken!.userId,
				name: body.name,
				target: body.target,
				tag: body.tag ?? [],
			});
			await newTarget.save();

			return res.status(201).send(MGMT_STATUS.TARGET_ADDED);
		} catch (error) {
			mainProc.error(`Error while adding new target: ${error}`);
			res.status(500).send(MGMT_STATUS.TARGET_ADD_FAILED);
		}
	});

	mgmtRouter.delete("/target", async (req: JWTRequest, res) => {
		if (!req.query.id) {
			return res.status(400).send(MGMT_STATUS.TARGET_INVALID_ID);
		}

		try {
			const target = await targetModel.findById(req.query.id);
			if (!target || target.userId.toString() !== req.accessToken!.userId) {
				return res.status(400).send(MGMT_STATUS.TARGET_FIND_FAILED);
			}

			const trashedTarget = new targetTrashModel(target.toObject());

			await trashedTarget.save();
			await target.deleteOne();

			return res.status(200).send(MGMT_STATUS.TARGET_MOVED_TO_TRASH);
		} catch (error) {
			mainProc.error(`Error while deleting target: ${error}`);
			res.status(500).send(MGMT_STATUS.TARGET_DELETE_FAILED);
		}
	});

	mgmtRouter.get("/scanSessions", async (req: JWTRequest, res) => {
		const scanSessions = await scanSessionModel
			.find({
				userPop: req.accessToken!.userId,
			})
			.populate<{
				targetPop: TTargetModel;
			}>("targetPop", "name target")
			.sort({
				updatedAt: -1,
			})
			.exec();
		res.status(200).json(scanSessions);
	});

	return mgmtRouter;
}
