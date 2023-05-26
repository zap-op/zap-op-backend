import { fileURLToPath } from "url";
import { dirname } from "path";
import { endAllLoggers, mainProc } from "../services/logging.service";

export function setupProcessExitHooks(): void {
    // Only works when there is no task running
    // Since we have a server always listening port, this handler will never execute
    process.on("beforeExit", (code) => {
        mainProc.info(`Process beforeExit event with code: ${code}`);
    });

    // Only works when the process normally exits
    // Ctrl-c will not trigger this handler (it is abnormal)
    process.on("exit", (code) => {
        mainProc.info(`Process exit event with code: ${code}`);

        // Must run after all log operations
        endAllLoggers();
    });

    // Works when user using "kill" command
    process.on("SIGTERM", () => {
        mainProc.info(`Process ${process.pid} received SIGTERM signal`);
        process.exit(0);
    });

    // Works when user using Ctrl-c
    process.on("SIGINT", () => {
        mainProc.info(`Process ${process.pid} received SIGINT signal`);
        process.exit(0);
    });

    process.on("uncaughtException", (err) => {
        mainProc.error(`Uncaught Exception: ${err.message}`);
        process.exit(1);
    });
}

export function dirName(fileMeta: any): string {
    const fileName = fileURLToPath(fileMeta.url);
    return dirname(fileName);
}