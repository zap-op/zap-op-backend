import express from 'express';
import scanSessionModelFactor from '../../../database/models/scan.session.model.js';
import ZAPService from '../../../service/zap.js';
import ZAPError from '../../../utils/errors/zap.error.js';
import SCAN_STATUS from '../../../utils/scan.status.js';
import SCAN_TYPE from '../../../utils/scan.type.js';
import _validator from '../../../utils/validator.js';

const spiderScanRouter = express.Router();
const spiderScanrouterPath = SCAN_TYPE.ZAP.SPIDER;

spiderScanRouter.get('/', async (req, res) => {
    const scanSession = req.query.scanSession;
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    }

    res.writeHead(200, headers);

    try {
        if (_validator.isNullorUndenfined(scanSession)) {
            throw ReferenceError("scanSession is not defined")
        }
        const scanSessionDoc = await scanSessionModelFactor.scanSessionModel.findById(scanSession);
        if (_validator.isNullorUndenfined(scanSessionDoc)) {
            throw ReferenceError("scanSessionDoc is not defined");
        }

        const zap = new ZAPService();
        const scanId = await zap.scan(scanSessionDoc.url, scanSessionDoc.__t, scanSessionDoc.scanConfig);
        if (isNaN(scanId)) {
            throw new ZAPError("scanId type not suitable");
        }

        req.on('close', () => {
            console.log(`client session ${scanSessionDoc._id} disconnect`);
        });

        zap.emit(res, scanSessionDoc.__t, scanId);
    } catch (error) {
        console.log(error);
        if (error instanceof ReferenceError) {
            res.write(`event: error\ndata: ${JSON.stringify(SCAN_STATUS.INVALID_SESSION)}\n\n`);
        } else if (error instanceof ZAPError) {
            res.write(`event: error\ndata: ${JSON.stringify(SCAN_STATUS.ZAP_SERVICE_ERROR)}\n\n`);
        }
    }
});

const spiderScanRouterFactor = {
    spiderScanRouter,
    spiderScanrouterPath
};

export default spiderScanRouterFactor;