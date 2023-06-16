import { Router } from "express";
import { getTrialRouter } from "./trial-router/trial.router";
import { getZapRouter } from "./zap-router/zap.router";
import { authenAccessMdw, parseAccessTokenMdw, parseRefreshTokenMdw } from "../../../utils/middlewares";

export function getScanRouter(): Router {
	const scanRouter = Router();

	scanRouter.use("/trial", getTrialRouter());
	scanRouter.use("/zap", parseAccessTokenMdw(), parseRefreshTokenMdw(), authenAccessMdw, getZapRouter());

	return scanRouter;
}
