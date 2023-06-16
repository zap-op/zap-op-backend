import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { isOnProduction } from "../utils/validator";
import { TScanFullResults, TZapActiveScanFullResultsModel, TZapAjaxScanFullResultsModel, TZapPassiveScanFullResultsModel, TZapSpiderScanFullResultsModel } from "../utils/types";

const SCAN_FULLRESULTS_COLLECTION = "scan_fullresults" + (!isOnProduction() ? "_tests" : "");

const FULL_RESULT_TYPE = {
	ZAP: {
		SPIDER: "ZAP_SPIDER_FULL_RESULTS",
		AJAX: "ZAP_AJAX_FULL_RESULTS",
		PASSIVE: "ZAP_PASSIVE_FULL_RESULTS",
		ACTIVE: "ZAP_ACTIVE_FULL_RESULTS",
	},
};

const scanFullResultsModel = database!.model<TScanFullResults>(
	SCAN_FULLRESULTS_COLLECTION,
	new database!.Schema<TScanFullResults>(
		{
			sessionId: {
				type: Schema.Types.ObjectId,
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

export const zapSpiderScanFullResultsModel = scanFullResultsModel.discriminator<TZapSpiderScanFullResultsModel>(
	FULL_RESULT_TYPE.ZAP.SPIDER,
	new database!.Schema<TZapSpiderScanFullResultsModel>({
		fullResults: {
			urlsInScope: {
				type: [Schema.Types.Mixed],
				default: [],
			},
			urlsOutOfScope: {
				type: [Schema.Types.Mixed],
				default: [],
			},
			urlsError: {
				type: [Schema.Types.Mixed],
				default: [],
			},
		},
	}),
);

export const zapAjaxScanFullResultsModel = scanFullResultsModel.discriminator<TZapAjaxScanFullResultsModel>(
	FULL_RESULT_TYPE.ZAP.AJAX,
	new database!.Schema<TZapAjaxScanFullResultsModel>({
		fullResults: {
			urlsInScope: {
				type: [Schema.Types.Mixed],
				default: [],
			},
			urlsOutOfScope: {
				type: [Schema.Types.Mixed],
				default: [],
			},
			urlsError: {
				type: [Schema.Types.Mixed],
				default: [],
			},
		},
	}),
);

export const zapPassiveScanFullResultsModel = scanFullResultsModel.discriminator<TZapPassiveScanFullResultsModel>(
	FULL_RESULT_TYPE.ZAP.PASSIVE,
	new database!.Schema<TZapPassiveScanFullResultsModel>({
		fullResults: {
			data: {
				type: [Schema.Types.Mixed],
				default: [],
			},
		},
	}),
);

export const zapActiveScanFullResultsModel = scanFullResultsModel.discriminator<TZapActiveScanFullResultsModel>(
	FULL_RESULT_TYPE.ZAP.ACTIVE,
	new database!.Schema<TZapActiveScanFullResultsModel>({
		fullResults: {
			data: {
				type: [Schema.Types.Mixed],
				default: [],
			},
		},
	}),
);
