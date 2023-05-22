import express from "express";
import { Validator } from "express-json-validator-middleware";
import { JSONSchema7 } from "json-schema";
import { targetModel, targetTrashModel } from "../../../models/target.model";
import { isValidURL } from "../../../utils/validator";
import { mainProc } from "../../../services/logging.service";
import { ProtectedRequest } from "../../../submodules/utility/auth";
import { MGMT_STATUS } from "../../../submodules/utility/status";

export function initMgmtRouter() {
    const mgmtRouter = express.Router();
    const validator = new Validator({});

    mgmtRouter.get("/targets", async (req: ProtectedRequest, res) => {
        const targets = await targetModel.find({"userId": req.session.userId});
        res.status(200).json(targets);
    });

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
                    "type": "string"
                }
            }
        },
        required: ["name", "target"],
    };

    mgmtRouter.post(
        "/target",
        validator.validate({body: postTargetSchema}),
        async (req: ProtectedRequest, res) => {
            const body = req.body;

            if (!(await isValidURL(body.target)))
                return res.status(400).send(MGMT_STATUS.TARGET_INVAVLID_URL);

            try {
                if (await targetModel.findOne({
                    userId: req.session.userId,
                    name: body.name
                }))
                    return res.status(400).send(MGMT_STATUS.TARGET_NAME_DUPLICATE);

                const newTarget = new targetModel({
                    userId: req.session.userId,
                    name: body.name,
                    target: body.target,
                    tag: body.tag ?? []
                });
                await newTarget.save();

                return res.status(201).send(MGMT_STATUS.TARGET_ADDED);
            } catch (error) {
                mainProc.error(error);
                res.status(500).send(MGMT_STATUS.TARGET_ADD_FAILED);
            }
        });

    mgmtRouter.delete(
        "/target",
        async (req: ProtectedRequest, res) => {
            if (!req.query.id)
                return res.status(400).send(MGMT_STATUS.TARGET_INVALID_ID);

            try {
                const target = await targetModel.findById(req.query.id);
                if (!target || target.userId.toString() !== req.session.userId)
                    return res.status(400).send(MGMT_STATUS.TARGET_FIND_FAILED);

                const trashedTarget = new targetTrashModel(target.toObject());

                await trashedTarget.save();
                await target.deleteOne();

                return res.status(200).send(MGMT_STATUS.TARGET_MOVED_TO_TRASH);
            } catch (error) {
                mainProc.error(error);
                res.status(500).send(MGMT_STATUS.TARGET_DELETE_FAILED);
            }
        });

    return mgmtRouter;
}
