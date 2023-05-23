import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { TScanSession, TZapAjaxScanSession, TZapSpiderScanSession } from "../utils/types";

const SCAN_SESSION_COLLECTION =
    "scan_sessions" + (process.env.NODE_ENV === "development" ? "_tests" : "");

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

export const zapSpiderScanSessionModel = scanSessionModel.discriminator<TZapSpiderScanSession>(
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
    })
);

export const zapAjaxScanSessionModel = scanSessionModel.discriminator<TZapAjaxScanSession>(
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
    })
);
