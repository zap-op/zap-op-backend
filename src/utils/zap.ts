import {execSync, spawn} from "child_process";
import path from "path";
import {dirName} from "./system";
import os from "os";

const ZAP_ROOT = path.join(dirName(import.meta), "..", "..", "ZAP_2.12.0");
const ZAP_EXE = path.join(ZAP_ROOT, os.platform() === "win32" ? "zap.bat" : "zap.sh");

export function getZapVersion() {
    try {
        return execSync(`${ZAP_EXE} -version`).toString();
    } catch (e) {
        console.log("Failed to get ZAP version");
    }
}

if (!process.env.ZAP_APIKEY)
    throw "ZAP_APIKEY not found";

export function startZapProcess() {
    console.log("Starting ZAP process");
    console.log(`ZAP version: ${getZapVersion()}`);

    const zapOptions = [
        "-daemon", "-addoninstallall", "-addonupdate",
        "-config", `api.key=${process.env.ZAP_APIKEY}`,
        "-newsession", path.join(ZAP_ROOT, "zap-op-session", Date.now().toString())
    ];
    if (process.env.ZAP_PORT)
        zapOptions.push("-port", process.env.ZAP_PORT);

    const proc = spawn(ZAP_EXE, zapOptions);

    proc.stdout.on('data', (data) => {
        console.log(`ZAP stdout: ${data}`);
    });

    proc.stderr.on('data', (data) => {
        console.error(`ZAP stderr: ${data}`);
    });

    proc.on('close', (code) => {
        console.log(`ZAP process exited with code ${code}`);
    });

    proc.on('error', (err) => {
        console.error(`ZAP process encounter error: ${err}`);
    });
}