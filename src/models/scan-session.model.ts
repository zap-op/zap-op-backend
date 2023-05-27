import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { isOnProduction } from "../utils/validator";
import { TScanSession, TZapAjaxScanSessionModel, TZapSpiderScanSessionModel } from "../utils/types";
import { TARGET_COLLECTION } from "./target.model";
import { USER_COLLECTION } from "./user.model";

const SCAN_SESSION_COLLECTION = "scan_sessions" + (!isOnProduction() ? "_tests" : "");

const SCAN_TYPE = {
	ZAP: {
		SPIDER: "ZAP_SPIDER_SCAN",
		AJAX: "ZAP_AJAX_SCAN",
	},
};

export const scanSessionModel = database!.model<TScanSession>(
	SCAN_SESSION_COLLECTION,
	new database!.Schema<TScanSession>(
		{
			userPop: {
				type: Schema.Types.ObjectId,
				ref: USER_COLLECTION,
				required: true,
			},
			targetPop: {
				type: Schema.Types.ObjectId,
				ref: TARGET_COLLECTION,
				required: true,
			},
		},
		{
			timestamps: {
				createdAt: true,
				updatedAt: true,
			},
		},
	),
);

export const zapSpiderScanSessionModel = scanSessionModel.discriminator<TZapSpiderScanSessionModel>(
	SCAN_TYPE.ZAP.SPIDER,
	new database!.Schema<TZapSpiderScanSessionModel>({
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
	}),
);

export const zapAjaxScanSessionModel = scanSessionModel.discriminator<TZapAjaxScanSessionModel>(
	SCAN_TYPE.ZAP.AJAX,
	new database!.Schema<TZapAjaxScanSessionModel>({
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
	}),
);
