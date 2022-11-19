import loginRouter from "./routers/login-router/login.router";
import {scanRouter} from "./routers/scan-router/scan.router";
import {mgmtRouter} from "./routers/mgmt-router/mgmt.router";
import {Express} from "express-serve-static-core";
import {parseAccessTokenMdw, renewAccessTokenMdw} from "../utils/middlewares";

export function initRoutes(app: Express) {
  app.use("/login", loginRouter);
  app.use("/scan", parseAccessTokenMdw(), renewAccessTokenMdw, scanRouter);
  app.use("/management", parseAccessTokenMdw(), renewAccessTokenMdw, mgmtRouter);
}
