import express from 'express';
import _validator from '../../../utils/validator.js';
import { Validator } from 'express-json-validator-middleware';
import SCAN_STATUS from '../../../utils/scan.status.js';
import SCAN_TYPE from '../../../utils/scan.type.js';
import spiderScanModelFactor from '../../../database/models/spider.scan.session.model.js';

const postScanSchema = {
    type: 'object',
    properties: {
        url: {
            type: 'string'
        },
        type: {
            type: 'string'
        },
        scanConfig: {
            type: 'object'
        }
    },
    required: ['url', 'type', 'scanConfig']
};

const scanRouter = express.Router();
const scanRouterPath = "scan";
const validator = new Validator();

scanRouter.post("/", validator.validate({ body: postScanSchema }), async (req, res) => {
    // const reqRemoteIp = req.headers['x-forwarded-for'] || req.socket.remoteFamily;
    // const reqRemotePort = req.socket.remotePort;
    // const reqLocalAddress = req.socket.localAddress;
    // const reqLocalPort = req.socket.localPort;
    const body = req.body;
    if (!_validator.isValidURL(body.url)) {
        res.status(400).send(SCAN_STATUS.INVAVLID_URL);
        return;
    }
    try {
        let scanSession = undefined;
        if (body.type === SCAN_TYPE.ZAP.SPIDER) {
            scanSession = new spiderScanModelFactor.spiderScanSessionModel({
                url: body.url,
                authId: body.authId,
                scanConfig: {
                    maxChildren: body.scanConfig.maxChildren,
                    recurse: body.scanConfig.recurse,
                    contextName: body.scanConfig.contextName,
                    subtreeOnly: body.scanConfig.subtreeOnly
                }
            });
            await scanSession.save();
        }
        res.status(201).send({
            scanSession: scanSession._id,
            scanStatus: SCAN_STATUS.SESSION_INITIALIZED_SUCCEED
        });
    } catch (error) {
        console.error(error);
        res.status(500).send(SCAN_STATUS.SESSION_INITIALIZED_FAIL);
    }
});

const scanRouterFactor = { 
    scanRouter,
    scanRouterPath, 
};

export default scanRouterFactor;