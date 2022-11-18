import loginRouter from "./routers/login-router/login.router";
import { scanRouter } from "./routers/scan-router/scan.router";
import { mgmtRouter } from "./routers/mgmt-router/mgmt.router";
import { Express } from "express-serve-static-core";

export function initRoutes(app: Express) {
  app.use("/login", loginRouter);
  app.use("/scan", scanRouter);
  app.use("/management", mgmtRouter);
}
