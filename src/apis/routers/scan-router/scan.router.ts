import express from "express";
import { initTrialRouter } from "./trial-router/trial.router";
import { initZapRouter } from "./zap-router/zap.router";
import { keycloak } from "../../../server";

export function initScanRouter() {
    const scanRouter = express.Router();

    scanRouter.use("/trial", initTrialRouter());
    scanRouter.use("/zap", keycloak.protect(), initZapRouter());

    return scanRouter;
}