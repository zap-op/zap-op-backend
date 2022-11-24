import database from "../database";
import {scanSessionModel} from "./scan-session.model";
import {SCAN_TYPE} from "./scan-session.type";

export const zapSpiderScanSessionModel = scanSessionModel.discriminator(
  SCAN_TYPE.ZAP.SPIDER,
  new database!.Schema({
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
