import { initScanRouter } from "./routers/scan-router/scan.router";
import { initMgmtRouter } from "./routers/mgmt-router/mgmt.router";
import { Express } from "express-serve-static-core";
import { initLoginRouter } from "./routers/login-router/login.router";
import { keycloak } from "../server";

export function initRoutes(app: Express) {
    app.use("/login", keycloak.protect(), initLoginRouter());
    app.use("/scan", initScanRouter());
    app.use("/management", keycloak.protect(), initMgmtRouter());
}