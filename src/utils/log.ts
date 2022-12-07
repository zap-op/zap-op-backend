import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";
import {dirName} from "./system";

const LOG_DIR = path.join(dirName(import.meta), "..", "..", "logs");
const LOG_TYPE = {
    MAIN_PROC: "mainProc",
    HTTP_REQUEST: "httpRequest",
    USER_SESSION: "userSession",
    ZAP_PROC: "zapProc"
};

const sharedLoggerOption = {
    level: "verbose",
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
};

winston.loggers.add(LOG_TYPE.MAIN_PROC, Object.assign({}, sharedLoggerOption, {
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({label: LOG_TYPE.MAIN_PROC, message: true})
    ),
    transports: [
        new winston.transports.Console({format: winston.format.cli()}),
        new winston.transports.DailyRotateFile({
            format: winston.format.simple(),
            filename: `${LOG_TYPE.MAIN_PROC}-%DATE%`,
            dirname: LOG_DIR,
            datePattern: "YYYY-MM-DD-HH",
            maxSize: "10m",
            zippedArchive: true
        })
    ]
}));

winston.loggers.add(LOG_TYPE.HTTP_REQUEST, Object.assign({}, sharedLoggerOption, {
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({label: LOG_TYPE.HTTP_REQUEST, message: true})
    ),
    transports: [
        new winston.transports.DailyRotateFile({
            format: winston.format.simple(),
            filename: `${LOG_TYPE.HTTP_REQUEST}-%DATE%`,
            dirname: LOG_DIR,
            datePattern: "YYYY-MM-DD-HH",
            maxSize: "10m",
            zippedArchive: true
        })
    ]
}));

winston.loggers.add(LOG_TYPE.USER_SESSION, Object.assign({}, sharedLoggerOption, {
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({label: LOG_TYPE.USER_SESSION, message: true})
    ),
    transports: [
        new winston.transports.DailyRotateFile({
            format: winston.format.simple(),
            filename: `${LOG_TYPE.USER_SESSION}-%DATE%`,
            dirname: LOG_DIR,
            datePattern: "YYYY-MM-DD-HH",
            maxSize: "10m",
            zippedArchive: true
        })
    ]
}));

winston.loggers.add(LOG_TYPE.ZAP_PROC, Object.assign({}, sharedLoggerOption, {
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({label: LOG_TYPE.ZAP_PROC, message: true})
    ),
    transports: [
        new winston.transports.Console({format: winston.format.cli()}),
        new winston.transports.DailyRotateFile({
            format: winston.format.simple(),
            filename: `${LOG_TYPE.ZAP_PROC}-%DATE%`,
            dirname: LOG_DIR,
            datePattern: "YYYY-MM-DD-HH",
            maxSize: "10m",
            zippedArchive: true
        })
    ]
}));

export const mainProc = winston.loggers.get(LOG_TYPE.MAIN_PROC);
export const httpRequest = winston.loggers.get(LOG_TYPE.HTTP_REQUEST);
export const userSession = winston.loggers.get(LOG_TYPE.USER_SESSION);
export const zapProc = winston.loggers.get(LOG_TYPE.ZAP_PROC);

export function flushLoggers() {
    mainProc.end();
    httpRequest.end();
    userSession.end();
    zapProc.end();
}
