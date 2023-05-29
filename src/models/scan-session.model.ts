import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { isOnProduction } from "../utils/validator";
import { TARGET_COLLECTION } from "./target.model";
import { USER_COLLECTION } from "./user.model";
import {
	TScanSessionModel, //
	TZapAjaxScanSessionModel,
	TZapSpiderScanSessionModel,
} from "../utils/types";

const SCAN_SESSION_COLLECTION = "scan_sessions" + (!isOnProduction() ? "_tests" : "");

const SCAN_TYPE = {
	ZAP: {
		SPIDER: "ZAP_SPIDER_SCAN",
		AJAX: "ZAP_AJAX_SCAN",
	},
};

export const scanSessionModel = database!.model<TScanSessionModel>(
	SCAN_SESSION_COLLECTION,
	new database!.Schema<TScanSessionModel>(
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
			scanId: {
				type: Schema.Types.Number,
				default: -1,
			},
			status: {
				state: {
					type: Schema.Types.String,
					default: "",
				},
				message: {
					type: Schema.Types.String,
					default: "",
				},
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
