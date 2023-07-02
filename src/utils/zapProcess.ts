import { spawn } from "child_process";
import path from "path";
import { dirName, sleep } from "./system";
import os from "os";
import { endCustomLogger, mainProc, registerCustomLogger, sharedFileTransportOpt, zapProc } from "../services/logging.service";
import winston from "winston";
import { zapReturnUsedPort } from "../services/zapMonitor.service";

if (!process.env.ZAP_APIKEY) throw "ZAP_APIKEY not found";

const ZAP_ROOT = path.join(dirName(import.meta), "..", "..", "ZAP_2.12.0");
const ZAP_EXE = path.join(ZAP_ROOT, os.type() === "Windows_NT" ? "zap.bat" : "zap.sh");
const ZAP_OPTS = ["-daemon", "-addoninstallall", "-addonupdate", "-config", `api.key=${process.env.ZAP_APIKEY}`];
const ZAP_SESSIONS_DIR = path.join(ZAP_ROOT, "zap-session");

export enum ZAP_SESSION_TYPES {
	SHARED = "shared",
	PRIVATE = "private",
}

let dbLockedOnZapInit = false;

export async function startZapProcess(type: ZAP_SESSION_TYPES, clientId: string, port: number): Promise<void> {
	const sessionDir = path.join(ZAP_SESSIONS_DIR, type, clientId);
	const zapOptions = ZAP_OPTS.concat("-port", port.toString(), "-newsession", path.join(sessionDir, "data"));

	let loggerToUse: winston.Logger;
	if (type === ZAP_SESSION_TYPES.SHARED) loggerToUse = zapProc;
	else {
		const customLoggerName = `zapPrivate-${clientId}`;
		loggerToUse = registerCustomLogger(customLoggerName, [sharedFileTransportOpt(customLoggerName)]);
	}

	while (dbLockedOnZapInit)
		await sleep(5000);

	dbLockedOnZapInit = true;
	const proc = spawn(ZAP_EXE, zapOptions);

	return new Promise<void>((resolve, reject) => {
		proc.stdout.on("data", (data) => {
			loggerToUse.info(data);
			if (data.toString().includes("ZAP is now listening on")) {
				dbLockedOnZapInit = false;
				resolve();
			}
		});

		proc.stderr.on("data", (data) => {
			loggerToUse.error(data);
		});

		proc.on("close", (code) => {
			const msg = `ZAP ${type} process with id ${clientId} exited with code ${code}`;
			mainProc.info(msg);
			dbLockedOnZapInit = false;
			reject(msg);

			zapReturnUsedPort(port);
			endCustomLogger(loggerToUse);
		});

		proc.on("error", (err) => {
			const msg = `ZAP ${type} process with id ${clientId} encounter error: ${err}`;
			mainProc.error(msg);
			dbLockedOnZapInit = false;
			reject(msg);

			zapReturnUsedPort(port);
			endCustomLogger(loggerToUse);
		});
	});
}
