import { database } from "../services/database.service";
import { Schema } from "mongoose";
import { TTargetModel } from "../utils/types";
import { isOnProduction } from "../utils/validator";

export const TARGET_COLLECTION = "targets" + (isOnProduction() ? "" : "_tests");

export const TARGET_TRASH_COLLECTION = "trashed_targets" + (isOnProduction() ? "" : "_tests");

const targetSchema = new database!.Schema<TTargetModel>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		target: {
			type: Schema.Types.String,
			required: true,
		},
		tag: {
			type: [Schema.Types.String],
		},
		isDeleted: {
			type: Schema.Types.Boolean,
			default: false,
		},
	},
	{
		timestamps: {
			createdAt: true,
			updatedAt: true,
		},
	},
).index({ userId: 1, name: 1 }, { unique: true });

export const targetModel = database!.model<TTargetModel>(TARGET_COLLECTION, targetSchema);

export const targetTrashModel = database!.model<TTargetModel>(TARGET_TRASH_COLLECTION, targetSchema);
