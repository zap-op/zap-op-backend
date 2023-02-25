import "dotenv/config";
import {mainProc} from "./utils/log";
import {setupProcessExitHooks} from "./utils/system";
import {startSharedZapProcess} from "./utils/zapProc";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {initRoutes} from "./apis/route";
import {ValidationError} from "express-json-validator-middleware";
import database from "./database/database";
import {AddressInfo} from "net";
import {connectZapServiceShared} from "./scan-services/zap-service/zap.service";

mainProc.info("Setup process exit hooks");
setupProcessExitHooks();

mainProc.info("Starting ZAP process");
const zapPort = await startSharedZapProcess();
connectZapServiceShared(zapPort);
mainProc.info(`ZAP started and listening on port ${zapPort}`);

mainProc.info("Connecting to DB");
if (!database) throw Error("Failed to connect DB");
mainProc.info("DB connected");

mainProc.info("Starting server");
const app = express();
app.use(express.urlencoded({extended: true}));
app.use(express.json());

if (process.env.PROTOCOL && process.env.CORS_ORIGIN)
    app.use(cors({
        origin: `${process.env.PROTOCOL}://${process.env.CORS_ORIGIN}`,
        credentials: true,
    }));

app.use(cookieParser());

initRoutes(app);

app.use((req, res) => {
    res.status(404).json({msg: req.originalUrl + " not found"});
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
    mainProc.info(`Started REST server on port ${(addr as AddressInfo | null)?.port}`);
});
