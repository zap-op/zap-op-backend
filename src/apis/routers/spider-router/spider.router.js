import express from 'express';
import scanSessionModelFactor from '../../../database/models/scan.session.model.js';
import ZAPService from '../../../service/zap.js';
import SCAN_STATUS from '../../../utils/scan.status.js';
import SCAN_TYPE from '../../../utils/scan.type.js';
import _validator from '../../../utils/validator.js';
import scanRouterFactor from '../scan-router/scan.router.js';

const spiderScanRouter = express.Router();
const spiderScanrouterPath = SCAN_TYPE.ZAP.SPIDER;

spiderScanRouter.get('/', async (req, res) => {
    const scanSessionCookie = req.cookies[scanRouterFactor.scanSessionCookieName];
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    }

    res.writeHead(200, headers);

    try {
        if (_validator.isUndenfined(scanSessionCookie)) {
            throw TypeError("scanSessionCookie is not defined")
        }

        const scanSession = await scanSessionModelFactor.scanSessionModel.findOne({
            session: scanSessionCookie
        });

        if (_validator.isUndenfined(scanSession)) {
            throw TypeError("scanSession is not defined");
        }

        const zap = new ZAPService();
        const scanId = await zap.scan(scanSession.url, scanSession.scanType, scanSession.scanConfig);
        if (isNaN(scanId)) {
            throw TypeError("scanId type not suitable");
        }

        req.on('close', () => {
            console.log(`client session ${scanSession.session} disconnect`);
        });

        zap.emit(res, scanSession.scanType, scanId);
    } catch (error) {
        console.log(error);
        res.write(JSON.stringify(SCAN_STATUS.INVALID_SESSION));
    }

});

const spiderScanRouterFactor = {
    spiderScanRouter,
    spiderScanrouterPath
};

export default spiderScanRouterFactor;