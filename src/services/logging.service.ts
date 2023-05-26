import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import { dirName } from "../utils/system";
import * as Transport from "winston-transport";

const LOG_DIR = path.join(dirName(import.meta), "..", "..", "logs");

enum INTERNAL_LOG_TYPES {
    MAIN_PROC = "mainProc",
    HTTP_REQUEST = "httpRequest",
    USER_SESSION = "userSession",
    ZAP_PROC = "zapProc"
}

const sharedLoggerOpt = function(logType: string) {
    return {
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.label({label: logType, message: true})
        ),
        level: "verbose",
        exitOnError: false,
        handleExceptions: true,
        handleRejections: true,
    };
};

export const sharedFileTransportOpt = function(logType: string) {
    return new winston.transports.DailyRotateFile({
        format: winston.format.simple(),
        filename: `${logType}-%DATE%`,
        dirname: LOG_DIR,
        datePattern: "YYYY-MM-DD-HH",
        maxSize: "10m",
        zippedArchive: true
    })
};

export const sharedConsoleTransportOpt = function() {
    return new winston.transports.Console({format: winston.format.cli()});
};

winston.loggers.add(INTERNAL_LOG_TYPES.MAIN_PROC, Object.assign(
    {},
    sharedLoggerOpt(INTERNAL_LOG_TYPES.MAIN_PROC),
    {
        transports: [
            sharedConsoleTransportOpt(),
            sharedFileTransportOpt(INTERNAL_LOG_TYPES.MAIN_PROC)
        ]
    }
));

winston.loggers.add(INTERNAL_LOG_TYPES.HTTP_REQUEST, Object.assign(
    {},
    sharedLoggerOpt(INTERNAL_LOG_TYPES.HTTP_REQUEST),
    {
        transports: [
            sharedFileTransportOpt(INTERNAL_LOG_TYPES.HTTP_REQUEST)
        ]
    }));

winston.loggers.add(INTERNAL_LOG_TYPES.USER_SESSION, Object.assign(
    {},
    sharedLoggerOpt(INTERNAL_LOG_TYPES.USER_SESSION),
    {
        transports: [
            sharedFileTransportOpt(INTERNAL_LOG_TYPES.USER_SESSION)
        ]
    }));

winston.loggers.add(INTERNAL_LOG_TYPES.ZAP_PROC, Object.assign(
    {},
    sharedLoggerOpt(INTERNAL_LOG_TYPES.ZAP_PROC),
    {
        transports: [
            sharedFileTransportOpt(INTERNAL_LOG_TYPES.ZAP_PROC)
        ]
    }));

export const mainProc = winston.loggers.get(INTERNAL_LOG_TYPES.MAIN_PROC);
export const httpRequest = winston.loggers.get(INTERNAL_LOG_TYPES.HTTP_REQUEST);
export const userSession = winston.loggers.get(INTERNAL_LOG_TYPES.USER_SESSION);
export const zapProc = winston.loggers.get(INTERNAL_LOG_TYPES.ZAP_PROC);

const customRegisteredLogger: winston.Logger[] = [];

export function registerCustomLogger(logType: string, transportsOpt: Transport[]): winston.Logger {
    winston.loggers.add(logType, Object.assign(
        {},
        sharedLoggerOpt(logType),
        {
            transports: transportsOpt
        }));

    const logger = winston.loggers.get(logType);
    customRegisteredLogger.push(logger);
    return logger;
}

export function endCustomLogger(logger: winston.Logger): void {
    if (customRegisteredLogger.splice(customRegisteredLogger.indexOf(logger), 1).length > 0)
        logger.end();
}

export function endAllLoggers(): void {
    mainProc.end();
    httpRequest.end();
    userSession.end();
    zapProc.end();
    customRegisteredLogger.forEach(logger => logger.end());
}
