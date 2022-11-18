import database from "../database";

export const USER_COLLECTION =
"users" + (process.env.NODE_ENV === "development" ? "_tests" : "");

export const userModel = database!.model(USER_COLLECTION, new database!.Schema(
        {
            sub: {
                type: String,
                required: true,
            },
            email: {
                type: String,
                required: true,
                unique: true
            },
            email_verified: {
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
            given_name: {
                type: String,
                required: true
            },
            family_name: {
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
