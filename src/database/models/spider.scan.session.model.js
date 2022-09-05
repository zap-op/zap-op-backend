import SCAN_TYPE from '../../utils/scan.type.js';
import database from '../database.js';
import scanSessionModelFactor from './scan.session.model.js';

const SPIDER_SCAN_SESSION_VERSION = 0;
const SPIDER_SCAN_SESSION_SCAN_TYPE = SCAN_TYPE.ZAP.SPIDER;

const spiderScanSessionSchema = new database.Schema(
    {
        scanType: {
            type: String,
            default: SCAN_TYPE.ZAP.SPIDER,
            immutable: true
        },
        scanConfig: {
            maxChildren: {
                type: Number,
                min: 0,
                default: 1
            },
            recurse: {
                type: Boolean,
                default: true
            },
            contextName: {
                type: String,
                default: ""
            },
            subtreeOnly: {
                type: Boolean,
                default: false
            }
            // version: {
            //     type: Number,
            //     required: true,
            //     min: SPIDER_SCAN_SESSION_VERSION,
            //     default: SPIDER_SCAN_SESSION_VERSION
            // }
        }
    },
    scanSessionModelFactor.discriminator
);

const spiderScanSessionModel = scanSessionModelFactor.scanSessionModel.discriminator(SPIDER_SCAN_SESSION_SCAN_TYPE, spiderScanSessionSchema);

const spiderScanModelFactor = {
    SPIDER_SCAN_SESSION_SCAN_TYPE,
    SPIDER_SCAN_SESSION_VERSION,
    spiderScanSessionModel
}

export default spiderScanModelFactor;