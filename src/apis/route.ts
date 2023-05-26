import { loginRouter } from "./routers/login-router/login.router";
import { scanRouter } from "./routers/scan-router/scan.router";
import { mgmtRouter } from "./routers/mgmt-router/mgmt.router";
import { Express } from "express-serve-static-core";
import { authenAccessMdw, parseAccessTokenMdw, parseRefreshTokenMdw } from "../utils/middlewares";

export function initRoutes(app: Express): void {
    app.use("/login", loginRouter);
    app.use("/scan", scanRouter);
    app.use("/management", parseAccessTokenMdw(), parseRefreshTokenMdw(), authenAccessMdw, mgmtRouter);
}
