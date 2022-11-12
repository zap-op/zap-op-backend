import express from "express";
import { Validator } from "express-json-validator-middleware";
import { JSONSchema7 } from "json-schema";
import { targetModel } from "../../../database/models/target.model";
import { isValidURL } from "../../../utils/validator";

const mgmtRouter = express.Router();
const validator = new Validator({});

const MGMT_STATUS = {
    TARGET_ADDED: {
        statusCode: 0,
        msg: "Target added successfully",
    },
    INVAVLID_URL: {
        statusCode: -1,
        msg: "Invalid URL for target",
    },
    TARGET_ADD_FAILED: {
        statusCode: -2,
        msg: "Target failed to add",
    },
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
                return res.status(400).send(MGMT_STATUS.INVAVLID_URL);

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

export { mgmtRouter, MGMT_STATUS };
