import express from "express";
import {zapSpiderRouter} from "./zap-spider-router/zap-spider.router";
import {authenAccessMdw, parseAccessTokenMdw, parseRefreshTokenMdw} from "../../../utils/middlewares";
import {zapSpiderTrialRouter} from "./trial-router/trial.router";

const scanRouter = express.Router();

scanRouter.use("/zap-spider", parseAccessTokenMdw(), parseRefreshTokenMdw(), authenAccessMdw, zapSpiderRouter);

scanRouter.use("/zap-spider-trial", zapSpiderTrialRouter);

export {scanRouter};
