import {execSync, spawn} from "child_process";
import path from "path";
import {dirName} from "./system";
import os from "os";
import {mainProc, zapProc} from "./log";

const ZAP_ROOT = path.join(dirName(import.meta), "..", "..", "ZAP_2.12.0");
const ZAP_EXE = path.join(ZAP_ROOT, os.platform() === "win32" ? "zap.bat" : "zap.sh");

export function getZapVersion() {
    try {
        return execSync(`${ZAP_EXE} -version`).toString();
    } catch (e) {
        mainProc.warn("Failed to get ZAP version");
    }
}

if (!process.env.ZAP_APIKEY)
    throw "ZAP_APIKEY not found";

export function startZapProcess() {
    mainProc.info("Starting ZAP process");
    mainProc.info(`ZAP version: ${getZapVersion()}`);

    const zapOptions = [
        "-daemon", "-addoninstallall", "-addonupdate",
        "-config", `api.key=${process.env.ZAP_APIKEY}`,
        "-newsession", path.join(ZAP_ROOT, "zap-op-session", Date.now().toString())
    ];
    if (process.env.ZAP_PORT)
        zapOptions.push("-port", process.env.ZAP_PORT);

    const proc = spawn(ZAP_EXE, zapOptions);

    proc.stdout.on('data', (data) => {
        zapProc.info(data);
    });

    proc.stderr.on('data', (data) => {
        zapProc.error(data);
    });

    proc.on('close', (code) => {
        mainProc.info(`ZAP process exited with code ${code}`);
    });

    proc.on('error', (err) => {
        mainProc.error(`ZAP process encounter error: ${err}`);
    });
}