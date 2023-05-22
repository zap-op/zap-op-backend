import { database } from "../services/database.service";
import { Schema } from "mongoose";
import { isOnProduction } from "../utils/validator";
import { TTargetModel } from "../submodules/utility/model";

const TARGET_COLLECTION =
    "targets" + (!isOnProduction() ? "_tests" : "");

const TARGET_TRASH_COLLECTION =
    "trashed_targets" + (!isOnProduction() ? "_tests" : "");

const targetSchema = new database!.Schema<TTargetModel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true
        },
        target: {
            type: String,
            required: true
        },
        tag: {
            type: [String]
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: true,
        },
    }).index({ userId: 1, name: 1 }, { unique: true });

export const targetModel = database!.model<TTargetModel>(TARGET_COLLECTION, targetSchema);

export const targetTrashModel = database!.model<TTargetModel>(TARGET_TRASH_COLLECTION, targetSchema);
