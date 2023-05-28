import "dotenv/config";
import { httpRequest, mainProc } from "./services/logging.service";
import { setupProcessHooks } from "./utils/system";
import { startZapProcess, ZAP_SESSION_TYPES } from "./utils/zapProcess";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initRouter } from "./apis/route";
import { ValidationError } from "express-json-validator-middleware";
import { database } from "./services/database.service";
import { AddressInfo } from "net";
import { initZapClientShared } from "./services/zapClient.service";
import { isOnProduction } from "./utils/validator";

mainProc.info("Setup process hooks");
setupProcessHooks();

mainProc.info("Starting shared ZAP process");
const zapPort = await startZapProcess(ZAP_SESSION_TYPES.SHARED);
await initZapClientShared(zapPort);
mainProc.info(`Shared ZAP process started and listening on port ${zapPort}`);

mainProc.info("Connecting to DB");
if (!database) throw Error("Failed to connect DB");
mainProc.info("DB connected");

mainProc.info("Starting server");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

if (process.env.PROTOCOL && process.env.CORS_ORIGIN)
	app.use(cors({
		origin: `${process.env.PROTOCOL}://${process.env.CORS_ORIGIN}`,
		credentials: true,
	}));

if (!isOnProduction())
	app.use((req, res, next) => {
		httpRequest.info(`${req.ip} | ${req.method} | ${req.originalUrl}`);
		next();
	});

initRouter(app);

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

const server = app.listen(8888, () => {
	const addr = server.address();
	mainProc.info(`Started REST server on port ${(addr as AddressInfo | null)?.port}`);
});
