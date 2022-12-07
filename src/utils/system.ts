import {fileURLToPath} from "url";
import {dirname} from "path";
import {flushLoggers, mainProc} from "./log";

export function setupProcessExitHooks() {
    process.on("zapcleanup", () => {
        mainProc.info("Process custom zapcleanup event");
    });

    // Only works when there is no task running
    // Since we have a server always listening port, this handler will never execute
    process.on("beforeExit", (code) => {
        mainProc.info(`Process beforeExit event with code: ${code}`);
    });

    // Only works when the process normally exits
    // Ctrl-c will not trigger this handler (it is abnormal)
    process.on("exit", (code) => {
        (process.emit as Function)("zapcleanup");
        mainProc.info(`Process exit event with code: ${code}`);

        // Must run after all log operations
        flushLoggers();
    });

    // Works when user using "kill" command
    process.on("SIGTERM", (signal) => {
        mainProc.info(`Process ${process.pid} received SIGTERM signal`);
        process.exit(0);
    });

    // Works when user using Ctrl-c
    process.on("SIGINT", (signal) => {
        mainProc.info(`Process ${process.pid} received SIGINT signal`);
        process.exit(0);
    });

    process.on("uncaughtException", (err) => {
        mainProc.error(`Uncaught Exception: ${err.message}`);
        process.exit(1);
    });
}

export function dirName(fileMeta: any) {
    const fileName = fileURLToPath(fileMeta.url);
    return dirname(fileName);
}