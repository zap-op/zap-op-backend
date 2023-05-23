import express from "express";
import { zapSpiderRouter } from "./zap-spider-router/zap-spider.router";
import { zapAjaxRouter } from "./zap-ajax-router/zap-ajax.router";

export const zapRouter = express.Router();

zapRouter.use("/spider", zapSpiderRouter);
zapRouter.use("/ajax", zapAjaxRouter);
