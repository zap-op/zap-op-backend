import database from "../database";
import {scanSessionModel} from "./scan-session.model";
import {SCAN_TYPE} from "./scan-session.type";
import {TZapSpiderScanSession, TScanSession} from "../../submodules/utility/model";

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
    })
);
