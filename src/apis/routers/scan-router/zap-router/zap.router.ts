import express, { Router } from "express";
import { getZapSpiderRouter } from "./zap-spider-router/zap-spider.router";
import { getZapAjaxRouter } from "./zap-ajax-router/zap-ajax.router";

export function getZapRouter(): Router {
    const zapRouter = express.Router();

    zapRouter.use("/spider", getZapSpiderRouter());
    zapRouter.use("/ajax", getZapAjaxRouter());

    return zapRouter;
}