import database from "../database";
import {TUser} from "../../utils/types";

export const USER_COLLECTION =
    "users" + (process.env.NODE_ENV === "development" ? "_tests" : "");

export const userModel = database!.model<TUser>(USER_COLLECTION, new database!.Schema<TUser>(
    {
        sub: {
            type: String,
            required: true,
            unique: true
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        emailVerified: {
            type: Boolean,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        picture: {
            type: String,
            required: true
        },
        givenName: {
            type: String,
            required: true
        },
        familyName: {
            type: String,
            required: true
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: true,
        },
    }));
