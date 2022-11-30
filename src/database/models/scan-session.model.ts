import {Schema} from "mongoose";
import database from "../database";
import {TScanSession} from "../../submodules/utility/model";

export const SCAN_SESSION_COLLECTION =
    "scan_sessions" + (process.env.NODE_ENV === "development" ? "_tests" : "");

export const scanSessionModel = database!.model<TScanSession>(
    SCAN_SESSION_COLLECTION,
    new database!.Schema<TScanSession>(
        {
            url: {
                type: String,
                required: true,
            },
            userId: {
                type: Schema.Types.ObjectId,
                required: true,
            },
        },
        {
            timestamps: {
                createdAt: true,
                updatedAt: true,
            },
        }
    )
);
