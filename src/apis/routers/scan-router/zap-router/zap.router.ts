import { Router } from "express";
import { getZapSpiderRouter } from "./zap-spider-router/zap-spider.router";
import { getZapAjaxRouter } from "./zap-ajax-router/zap-ajax.router";
import { getZapPassiveRouter } from "./zap-passive-router/zap-passive.router";
import { getZapActiveRouter } from "./zap-active-router/zap-active.router";

export function getZapRouter(): Router {
	const zapRouter = Router();

	zapRouter.use("/spider", getZapSpiderRouter());
	zapRouter.use("/ajax", getZapAjaxRouter());
	zapRouter.use("/passive", getZapPassiveRouter());
	zapRouter.use("/active", getZapActiveRouter());

	return zapRouter;
}
