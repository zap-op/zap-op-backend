import { database } from "../services/database.service";
import { isOnProduction } from "../utils/validator";
import { TUser } from "../submodules/utility/model";

const USER_COLLECTION =
    "users" + (!isOnProduction() ? "_tests" : "");

export const userModel = database!.model<TUser>(USER_COLLECTION, new database!.Schema<TUser>(
    {
        verifiedEmail: {
            type: String,
            required: true,
            unique: true
        },
        username: {
            type: String,
            required: true
        },
        givenName: {
            type: String,
            default: ""
        },
        familyName: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: true,
        },
    }));
