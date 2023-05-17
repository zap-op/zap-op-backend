import { Schema } from "mongoose";
import { database } from "../services/database.service";
import { TUser } from "../utils/types";

const USER_COLLECTION = "users" + (process.env.NODE_ENV === "development" ? "_tests" : "");

export const userModel = database!.model<TUser>(USER_COLLECTION, new database!.Schema<TUser>(
    {
        sub: {
            type: Schema.Types.String,
            required: true,
            unique: true
        },
        email: {
            type: Schema.Types.String,
            required: true,
            unique: true
        },
        emailVerified: {
            type: Schema.Types.Boolean,
            required: true
        },
        name: {
            type: Schema.Types.String,
            required: true
        },
        picture: {
            type: Schema.Types.String,
            required: true
        },
        givenName: {
            type: Schema.Types.String,
            required: true
        },
        familyName: {
            type: Schema.Types.String,
            required: true
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: true,
        },
    }));