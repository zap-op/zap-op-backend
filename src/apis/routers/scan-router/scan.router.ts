import express from "express";
import zapSpiderRouter from "./zap-spider-router/zap-spider.router";

const scanRouter = express.Router();

scanRouter.use("/zap-spider", zapSpiderRouter);

export default scanRouter;
