import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { isOnProduction } from "../utils/validator";
import { TScanSession, TZapAjaxScanSession, TZapSpiderScanSession } from "../submodules/utility/model";

const SCAN_SESSION_COLLECTION =
    "scan_sessions" + (!isOnProduction() ? "_tests" : "");

const scanSessionModel = database!.model<TScanSession>(
    SCAN_SESSION_COLLECTION,
    new database!.Schema<TScanSession>(
        {
            url: {
                type: String,
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

const SCAN_TYPE = {
    ZAP: {
        SPIDER: "ZAP_SPIDER",
        AJAX: "ZAP_AJAX"
    },
};

export const zapSpiderScanSessionModel = scanSessionModel.discriminator<TZapSpiderScanSession & TScanSession>(
    SCAN_TYPE.ZAP.SPIDER,
    new database!.Schema<TZapSpiderScanSession>({
        scanConfig: {
            maxChildren: {
                type: Number,
                min: 0,
                default: 1,
            },
            recurse: {
                type: Boolean,
                default: true,
            },
            contextName: {
                type: String,
                default: "",
            },
            subtreeOnly: {
                type: Boolean,
                default: false,
            },
        },
        result: {
            inScope: {
                type: [String],
                default: []
            },
            outOfScope: {
                type: [String],
                default: []
            },
            error: {
                type: [String],
                default: []
            }
        }
    }));

export const zapAjaxScanSessionModel = scanSessionModel.discriminator<TZapAjaxScanSession & TScanSession>(
    SCAN_TYPE.ZAP.AJAX,
    new database!.Schema<TZapAjaxScanSession>({
        scanConfig: {
            inScope: {
                type: Boolean,
                default: false,
            },
            contextName: {
                type: String,
                default: "",
            },
            subtreeOnly: {
                type: Boolean,
                default: false,
            },
        },
        result: {
            inScope: {
                type: [String],
                default: []
            },
            outOfScope: {
                type: [String],
                default: []
            },
            error: {
                type: [String],
                default: []
            }
        }
    }));