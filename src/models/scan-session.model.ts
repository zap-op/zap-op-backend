import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { isOnProduction } from "../utils/validator";
import { TARGET_COLLECTION } from "./target.model";
import { USER_COLLECTION } from "./user.model";
import { ScanType, TScanSessionModel, TZapActiveScanSessionModel, TZapAjaxScanSessionModel, TZapPassiveScanSessionModel, TZapSpiderScanSessionModel } from "../utils/types";

export const SCAN_SESSION_COLLECTION = "scan_sessions" + (!isOnProduction() ? "_tests" : "");

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
			zapClientId: {
				type: Schema.Types.String,
				default: "",
			},
			zapScanId: {
				type: Schema.Types.String,
				default: "",
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
				default: 0,
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
			maxCrawlDepth: {
				type: Schema.Types.Number,
				min: 0,
				default: 5,
			},
			maxDuration: {
				type: Schema.Types.Number,
				min: 0,
				default: 5,
			},
		},
	}),
);

export const zapPassiveScanSessionModel = scanSessionModel.discriminator<TZapPassiveScanSessionModel>(
	ScanType.ZAP_PASSIVE,
	new database!.Schema<TZapPassiveScanSessionModel>({
		exploreType: {
			type: Schema.Types.String,
			required: true,
		},
		spiderConfig: {
			maxChildren: {
				type: Schema.Types.Number,
				min: 0,
				default: 0,
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
		ajaxConfig: {
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
			maxCrawlDepth: {
				type: Schema.Types.Number,
				min: 0,
				default: 5,
			},
			maxDuration: {
				type: Schema.Types.Number,
				min: 0,
				default: 5,
			},
		},
	}),
);

export const zapActiveScanSessionModel = scanSessionModel.discriminator<TZapActiveScanSessionModel>(
	ScanType.ZAP_ACTIVE,
	new database!.Schema<TZapActiveScanSessionModel>({
		exploreType: {
			type: Schema.Types.String,
			required: true,
		},
		spiderConfig: {
			maxChildren: {
				type: Schema.Types.Number,
				min: 0,
				default: 0,
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
		ajaxConfig: {
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
			maxCrawlDepth: {
				type: Schema.Types.Number,
				min: 0,
				default: 5,
			},
			maxDuration: {
				type: Schema.Types.Number,
				min: 0,
				default: 5,
			},
		},
		scanConfig: {
			recurse: {
				type: Schema.Types.Boolean,
				default: true,
			},
			inScopeOnly: {
				type: Schema.Types.Boolean,
				default: false,
			},
			scanPolicyName: {
				type: Schema.Types.String,
				default: "",
			},
			method: {
				type: Schema.Types.String,
				default: "",
			},
			postData: {
				type: Schema.Types.String,
				default: "",
			},
			contextId: {
				type: Schema.Types.String,
				default: "",
			},
		},
	}),
);
