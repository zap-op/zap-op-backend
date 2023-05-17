import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { isOnProduction } from "../utils/validator";
import { TScanSession, TZapAjaxScanSession, TZapSpiderScanSession } from "../utils/types";

const SCAN_SESSION_COLLECTION =
    "scan_sessions" + (!isOnProduction() ? "_tests" : "");

export const SCAN_TYPE = {
    ZAP: {
        SPIDER: "ZAP_SPIDER",
        AJAX: "ZAP_AJAX"
    },
};
    
const scanSessionModel = database!.model<TScanSession>(
    SCAN_SESSION_COLLECTION,
    new database!.Schema<TScanSession>(
        {
            url: {
                type: Schema.Types.String,
                required: true,
            },
            userId: {
                type: Schema.Types.ObjectId,
                required: true,
            },
        },
        {
            timestamps: {
                createdAt: true,
                updatedAt: true,
            },
        }
    )
);

export const zapSpiderScanSessionModel = scanSessionModel.discriminator<TZapSpiderScanSession & TScanSession>(
    SCAN_TYPE.ZAP.SPIDER,
    new database!.Schema<TZapSpiderScanSession>({
        scanConfig: {
            maxChildren: {
                type: Schema.Types.Number,
                min: 0,
                default: 1,
            },
            recurse: {
                type: Schema.Types.Boolean,
                default: true,
            },
            contextName: {
                type: Schema.Types.String,
                default: "",
            },
            subtreeOnly: {
                type: Schema.Types.Boolean,
                default: false,
            },
        },
        fullResults: {
            inScope: {
                type: [Schema.Types.Mixed],
                default: []
            },
            outOfScope: {
                type: [Schema.Types.Mixed],
                default: []
            },
            error: {
                type: [Schema.Types.Mixed],
                default: []
            }
        }
    }));

export const zapAjaxScanSessionModel = scanSessionModel.discriminator<TZapAjaxScanSession & TScanSession>(
    SCAN_TYPE.ZAP.AJAX,
    new database!.Schema<TZapAjaxScanSession>({
        scanConfig: {
            inScope: {
                type: Schema.Types.Boolean,
                default: false,
            },
            contextName: {
                type: Schema.Types.String,
                default: "",
            },
            subtreeOnly: {
                type: Schema.Types.Boolean,
                default: false,
            },
        },
        fullResults: {
            inScope: {
                type: [Schema.Types.Mixed],
                default: []
            },
            outOfScope: {
                type: [Schema.Types.Mixed],
                default: []
            },
            error: {
                type: [Schema.Types.Mixed],
                default: []
            }
        }
    }));