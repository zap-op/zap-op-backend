import {fileURLToPath} from "url";
import {dirname} from 'path';

export function setupProcessExitHooks() {
    process.on("zapcleanup", () => {
        console.log("Process custom zapcleanup event");
    });

    // Only works when there is no task running
    // Since we have a server always listening port, this handler will never execute
    process.on("beforeExit", (code) => {
        console.log(`Process beforeExit event with code: ${code}`);
    });

    // Only works when the process normally exits
    // Ctrl-c will not trigger this handler (it is abnormal)
    process.on("exit", (code) => {
        (process.emit as Function)("zapcleanup");
        console.log(`Process exit event with code: ${code}`);
    });

    // Works when user using "kill" command
    process.on("SIGTERM", (signal) => {
        console.log(`Process ${process.pid} received SIGTERM signal`);
        process.exit(0);
    });

    // Works when user using Ctrl-c
    process.on("SIGINT", (signal) => {
        console.log(`Process ${process.pid} received SIGINT signal`);
        process.exit(0);
    });

    process.on("uncaughtException", (err) => {
        console.log(`Uncaught Exception: ${err.message}`);
        process.exit(1);
    });
}

export function dirName(fileMeta: any) {
    const __filename = fileURLToPath(fileMeta.url);
    return dirname(__filename);
}