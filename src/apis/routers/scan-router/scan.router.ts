import express from "express";
import {trialRouter} from "./trial-router/trial.router";
import {zapRouter} from "./zap-router/zap.router";
import {authenAccessMdw, parseAccessTokenMdw, parseRefreshTokenMdw} from "../../../utils/middlewares";

const scanRouter = express.Router();

scanRouter.use("/zap", parseAccessTokenMdw(), parseRefreshTokenMdw(), authenAccessMdw, zapRouter);
scanRouter.use("/trial", trialRouter);

export {scanRouter};
