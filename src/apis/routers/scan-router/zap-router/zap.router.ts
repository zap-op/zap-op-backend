import express from "express";
import { initZapSpiderRouter } from "./zap-spider-router/zap-spider.router";
import { initZapAjaxRouter } from "./zap-ajax-router/zap-ajax.router";

export function initZapRouter() {
    const zapRouter = express.Router();

    zapRouter.use("/spider", initZapSpiderRouter());
    zapRouter.use("/ajax", initZapAjaxRouter());

    return zapRouter;
}