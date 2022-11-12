import express from "express";
import { targetModel } from "../../../database/models/target.model";

const mgmtRouter = express.Router();

mgmtRouter.get("/targets", async (_req, res) => {
    const targets = await targetModel.find();
    res.status(200).json(targets);
});

mgmtRouter.post("/targets", (_req, res) => {
    res.status(200).json({ msg: "succeed" });
});

export default mgmtRouter;
