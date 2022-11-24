import express from "express";
import zapSpiderRouter from "./zap-spider-router/zap-spider.router";

const SCAN_STATUS = {
    SESSION_INITIALIZE_SUCCEED: {
        statusCode: 0,
        msg: "Scan session initialize succeed!",
    },
    SESSION_INITIALIZE_FAIL: {
        statusCode: -1,
        msg: "Scan session initialize fail!",
    },
    INVAVLID_URL: {
        statusCode: -2,
        msg: "Invalid URL!",
    },
    INVALID_SESSION: {
        statusCode: -3,
        msg: "Invalid scan session!",
    },

    ZAP_SERVICE_ERROR: {
        statusCode: -4,
        msg: "ZAP service error!",
    },

    INTERNAL_ERROR: {
        statusCode: -5,
        msg: "Service internal error!",
    },
};

const scanRouter = express.Router();

scanRouter.use("/zap-spider", zapSpiderRouter);

export {scanRouter, SCAN_STATUS};
