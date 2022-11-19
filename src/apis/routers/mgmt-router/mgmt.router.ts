import express from "express";
import {Validator} from "express-json-validator-middleware";
import {JSONSchema7} from "json-schema";
import {targetModel, targetTrashModel} from "../../../database/models/target.model";
import {isValidURL} from "../../../utils/validator";

const mgmtRouter = express.Router();
const validator = new Validator({});

const MGMT_STATUS = {
    TARGET_ADDED: {
        statusCode: 0,
        msg: "Target added successfully",
    },
    TARGET_DELETEED: {
        statusCode: 1,
        msg: "Target deleted successfully",
    },
    TARGET_INVAVLID_URL: {
        statusCode: -1,
        msg: "Invalid URL for target",
    },
    TARGET_ADD_FAILED: {
        statusCode: -2,
        msg: "Target failed to add",
    },
    TARGET_INVALID_ID: {
        statusCode: -3,
        msg: "Invalid ID for target",
    },
    TARGET_FIND_FAILED: {
        statusCode: -4,
        msg: "Target failed to find",
    },
    TARGET_DELETE_FAILED: {
        statusCode: -5,
        msg: "Target failed to delete",
    }
};

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

mgmtRouter.get("/targets", async (_req, res) => {
    const targets = await targetModel.find();
    res.status(200).json(targets);
});

mgmtRouter.post(
        "/target",
        validator.validate({ body: postTargetSchema }),
        async (req, res) => {
            const body = req.body;

            if (!isValidURL(body.target))
                return res.status(400).send(MGMT_STATUS.TARGET_INVAVLID_URL);

            try {
                const newTarget = new targetModel({
                    name: body.name,
                    target: body.target,
                    tag: body.tag ?? []
                });
                await newTarget.save();

                return res.status(201).send({
                    msg: MGMT_STATUS.TARGET_ADDED,
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ msg: MGMT_STATUS.TARGET_ADD_FAILED });
            }
        });

mgmtRouter.delete(
        "/target",
        async (req, res) => {
            if (!req.query.id)
                return res.status(400).send(MGMT_STATUS.TARGET_INVALID_ID);

            try {
                const target = await targetModel.findById(req.query.id);
                if (!target)
                    return res.status(400).send(MGMT_STATUS.TARGET_FIND_FAILED);

                const trashedTarget = new targetTrashModel(target.toObject());

                await trashedTarget.save();
                await target.deleteOne();

                return res.status(201).send({
                    msg: MGMT_STATUS.TARGET_DELETEED,
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({ msg: MGMT_STATUS.TARGET_DELETE_FAILED });
            }
        });

export { mgmtRouter, MGMT_STATUS };
