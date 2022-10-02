import loginRouter from "./routers/login-router/login.router.js";
import scanRouter from "./routers/scan-router/scan.router.js";
import { Express } from "express-serve-static-core";

export function initRoutes(app: Express) {
  app.use("/login", loginRouter);
  app.use("/scan", scanRouter);
}
