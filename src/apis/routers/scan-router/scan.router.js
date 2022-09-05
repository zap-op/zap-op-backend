import express from 'express';
import _validator from '../../../utils/validator.js';
import { Validator } from 'express-json-validator-middleware';
import SCAN_STATUS from '../../../utils/scan.status.js';
import SCAN_TYPE from '../../../utils/scan.type.js';
import cookieCrypto from '../../../utils/cookie.crypto.js';
import spiderScanModelFactor from '../../../database/models/spider.scan.session.model.js';
import scanSessionModelFactor from '../../../database/models/scan.session.model.js';

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

const scanSessionCookieName = "scan_session";

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
        let scanSessionCookie = undefined;
        while (true) {
            scanSessionCookie = cookieCrypto.generate();
            if (_validator.isDocExists_MONGODB(scanSessionModelFactor.scanSessionModel, "session", scanSessionCookie)) {
                continue;
            }
            break;
        }
        res.cookie(scanSessionCookieName, scanSessionCookie);
        // Factor scan
        let scanSession = undefined;
        if (body.type === SCAN_TYPE.ZAP.SPIDER) {
            scanSession = new spiderScanModelFactor.spiderScanSessionModel({
                url: body.url,
                session: scanSessionCookie,
                authId: body.authId,
                scanConfig: {
                    maxChildren: body.scanConfig.maxChildren,
                    recurse: body.scanConfig.recurse,
                    contextName: body.scanConfig.contextName,
                    subtreeOnly: body.scanConfig.subtreeOnly
                }
            });
            scanSession.save();
        }
        res.status(201).send(SCAN_STATUS.SESSION_INITIALIZED_SUCCEED);
    } catch (error) {
        console.error(error);
        res.status(500).send(SCAN_STATUS.SESSION_INITIALIZED_FAIL);
    }

    // const spiderOptions = {
    // 'secure' prevent Man-in-the-middle attacks in HTTPS || 'httpOnly' prevent Man-in-the-middle attacks in HTTP
    //     url: body.url,
    //     id: uuidv4()
    // };

    // if (typeof body.max_children === 'number')
    //     spiderOptions.maxChildren = body.max_children;

    // if (typeof body.recurse === 'boolean')
    //     spiderOptions.recurse = body.recurse;

    // if (typeof body.subtree_only === 'boolean')
    //     spiderOptions.subtreeOnly = body.subtree_only;

    // const spiderSession = new spiderSessionModel(spiderOptions);

    // try {
    //     await spiderSession.save();
    //     res.status(200).json(spiderOptions);s
    // } catch (error) {
    //     console.error(`Failed to create session document, error: ${err}`);
    //     res.status(500).json({ msg: 'internal error' });
    // }
});

const scanRouterFactor = { 
    scanRouter,
    scanRouterPath, 
    scanSessionCookieName 
};

export default scanRouterFactor;