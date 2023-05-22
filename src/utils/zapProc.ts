import { spawn } from "child_process";
import path from "path";
import { dirName } from "./system";
import os from "os";
import { endCustomLogger, mainProc, registerCustomLogger, sharedFileTransportOpt, zapProc } from "../services/logging.service";
import winston from "winston";
import crypto from "crypto";

if (!process.env.ZAP_APIKEY)
    throw "ZAP_APIKEY not found";

if (os.platform() === "win32")
    throw "win32 not supported";

const ZAP_ROOT = path.join(dirName(import.meta), "..", "..", "ZAP_2.12.0");
const ZAP_SESSIONS_DIR = path.join(ZAP_ROOT, "zap-session");
const ZAP_EXE = path.join(ZAP_ROOT, "zap.sh");
const ZAP_OPTS = ["-daemon", "-addoninstallall", "-addonupdate", "-config", `api.key=${process.env.ZAP_APIKEY}`];

export enum ZAP_SESSION_TYPES {
    SHARED = "shared",
    TEMP = "temp"
}

export function startZapProcess(type: ZAP_SESSION_TYPES, port?: number, relSessionDir?: string, logger?: winston.Logger) {
    const sessionDir = path.join(ZAP_SESSIONS_DIR, type, relSessionDir ?? Date.now().toString());
    const zapOptions = ZAP_OPTS.concat("-newsession", path.join(sessionDir, "data"));
    if (port)
        zapOptions.push("-port", port.toString());

    let loggerToUse: winston.Logger;
    if (type === ZAP_SESSION_TYPES.SHARED)
        loggerToUse = zapProc;
    else {
        if (!logger) {
            const loggerId = `zapTemp-${crypto.randomUUID()}`;
            logger = registerCustomLogger(loggerId, [sharedFileTransportOpt(loggerId)]);
        }
        loggerToUse = logger;
    }

    const proc = spawn(ZAP_EXE, zapOptions);

    return new Promise<number>((resolve, reject) => {
        proc.stdout.on("data", (data) => {
            loggerToUse.info(data);
            if (data.toString().includes("ZAP is now listening on")) {
                const port = parseInt(data.toString().split(":").pop());
                resolve(port);
            }
        });

        proc.stderr.on("data", (data) => {
            loggerToUse.error(data);
        });

        proc.on("close", (code) => {
            const msg = `ZAP ${type} process exited with code ${code}`;
            mainProc.info(msg);
            endCustomLogger(loggerToUse);
            reject(msg);
        });

        proc.on("error", (err) => {
            const msg = `ZAP ${type} process encounter error: ${err}`;
            mainProc.error(msg);
            endCustomLogger(loggerToUse);
            reject(msg);
        });
    })
}

export function startSharedZapProcess() {
    return startZapProcess(ZAP_SESSION_TYPES.SHARED);
}