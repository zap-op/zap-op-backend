import database from "../database";
import {Schema} from "mongoose";
import {TTargetModel} from "../../utils/types";

export const TARGET_COLLECTION =
    "targets" + (process.env.NODE_ENV === "development" ? "_tests" : "");

export const TARGET_TRASH_COLLECTION =
    "trashed_targets" + (process.env.NODE_ENV === "development" ? "_tests" : "");

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
    }).index({userId: 1, name: 1}, {unique: true});

export const targetModel = database!.model<TTargetModel>(TARGET_COLLECTION, targetSchema);

export const targetTrashModel = database!.model<TTargetModel>(TARGET_TRASH_COLLECTION, targetSchema);
