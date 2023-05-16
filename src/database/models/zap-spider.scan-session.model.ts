import database from "../database";
import {scanSessionModel} from "./scan-session.model";
import {SCAN_TYPE} from "./scan-session.type";
import {TZapSpiderScanSession} from "../../utils/types";

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
