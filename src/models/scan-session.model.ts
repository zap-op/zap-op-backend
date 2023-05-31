import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { isOnProduction } from "../utils/validator";
import { TARGET_COLLECTION } from "./target.model";
import { USER_COLLECTION } from "./user.model";
import {
	ScanType,
	TScanSessionModel, //
	TZapAjaxScanSessionModel,
	TZapSpiderScanSessionModel,
} from "../utils/types";

const SCAN_SESSION_COLLECTION = "scan_sessions" + (!isOnProduction() ? "_tests" : "");

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
				type: Schema.Types.String,
				default: "",
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
	ScanType.ZAP_SPIDER,
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
	ScanType.ZAP_AJAX,
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
