import database from "../database";
import {scanSessionModel} from "./scan-session.model";
import {SCAN_TYPE} from "./scan-session.type";
import {TZapAjaxScanSession} from "../../submodules/utility/model";

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
