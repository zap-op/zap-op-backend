import "dotenv/config";
import {setupProcessExitHooks} from "./utils/system";
import {startZapProcess} from "./utils/zap";

setupProcessExitHooks();
// Only need to cleanup ZAP, not to explicitly kill ZAP when program exits
// As ZAP is a child process, it will be terminated as well
startZapProcess();

import database from "./database/database";
if (!database) throw Error("Failed to connect DB");

console.log("Connected to DB");

import express from "express";
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

import cors from "cors";
if (process.env.CORS_ORIGIN)
    app.use(cors({ 
        origin: process.env.CORS_ORIGIN,
        credentials:true,
    }));

import cookieParser from "cookie-parser";
app.use(cookieParser());

import {initRoutes} from "./apis/route";
initRoutes(app);

app.use((req, res) => {
    res.status(404).json({ msg: req.originalUrl + " not found" });
});

import {ValidationError} from "express-json-validator-middleware";
app.use((err: any, _req: any, res: any, next: any) => {
    if (res.headersSent) return next(err);

    if (!(err instanceof ValidationError)) return next(err);

    res.status(400).json({
        msg: err.validationErrors,
    });

    next();
});

const PORT = 8888;
const server = app.listen(PORT, () => {
    const addr = server.address();
    console.log("Started REST server", addr);
});
