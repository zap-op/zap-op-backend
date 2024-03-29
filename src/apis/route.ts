import { getAuthRouter } from "./routers/auth-router/auth.router";
import { getScanRouter } from "./routers/scan-router/scan.router";
import { getMgmtRouter } from "./routers/mgmt-router/mgmt.router";
import { Express } from "express-serve-static-core";
import { authenAccessMdw, parseAccessTokenMdw, parseRefreshTokenMdw } from "../utils/middlewares";

export function initRouter(app: Express): void {
	app.use("/auth", getAuthRouter());
	app.use("/management", parseAccessTokenMdw(), parseRefreshTokenMdw(), authenAccessMdw, getMgmtRouter());
	app.use("/scan", getScanRouter());
}
