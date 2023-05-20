import "dotenv/config";
import { httpRequest, mainProc } from "./services/logging.service";
import { setupProcessExitHooks } from "./utils/system";
import { startSharedZapProcess } from "./utils/zapProc";
import express from "express";
import cors from "cors";
import { initRoutes } from "./apis/route";
import { ValidationError } from "express-json-validator-middleware";
import { database } from "./services/database.service";
import { AddressInfo } from "net";
import session from "express-session";
import MongoStore from "connect-mongo";
import Keycloak from "keycloak-connect";
import { initZapSharedClient } from "./utils/zapClient";
import { isOnProduction } from "./utils/validator";

mainProc.info("Setup process exit hooks");
setupProcessExitHooks();

mainProc.info("Starting ZAP process");
const zapPort = await startSharedZapProcess();
initZapSharedClient(zapPort);
mainProc.info(`ZAP started and listening on port ${zapPort}`);

mainProc.info("Connecting to DB");
if (!database) throw Error("Failed to connect DB");
mainProc.info("DB connected");

mainProc.info("Starting server");
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

if (process.env.PROTOCOL && process.env.CORS_ORIGIN)
    app.use(cors({
        origin: `${process.env.PROTOCOL}://${process.env.CORS_ORIGIN}`,
        credentials: true,
    }));

if (!process.env.SESSION_SECRET)
    throw Error("SESSION_SECRET not found");

const sessionStore = MongoStore.create({ client: database.connection.getClient() });
app.use(session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    cookie: { maxAge: 1000 * 60 * 5 },
    rolling: true,
    resave: false,
    saveUninitialized: true,
}));

export const keycloak = new Keycloak({ store: sessionStore });
app.use(keycloak.middleware());
mainProc.info("Keycloak integrated");

if (!isOnProduction())
    app.use((req, res, next) => {
        httpRequest.info(`${req.ip} | ${req.method} | ${req.originalUrl}`);
        next();
    });

initRoutes(app);

app.use((req, res) => {
    res.status(404).json({
        msg: req.originalUrl + " not found",
    });
});

app.use((err: any, _req: any, res: any, next: any) => {
    if (res.headersSent) return next(err);

    if (!(err instanceof ValidationError)) return next(err);

    res.status(400).json({
        msg: err.validationErrors,
    });
    next();
});

const PORT = 8888;
const server = app.listen(PORT, () => {
    const addr = server.address();
    mainProc.info(`REST server listening on port ${(addr as AddressInfo | null)?.port}`);
});
