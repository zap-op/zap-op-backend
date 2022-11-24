import database from "../database";

export const TARGET_COLLECTION =
    "targets" + (process.env.NODE_ENV === "development" ? "_tests" : "");

export const TARGET_TRASH_COLLECTION =
    "trashed_targets" + (process.env.NODE_ENV === "development" ? "_tests" : "");

const targetSchema = new database!.Schema(
    {
        name: {
            type: String,
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
    });

export const targetModel = database!.model(TARGET_COLLECTION, targetSchema);

export const targetTrashModel = database!.model(TARGET_TRASH_COLLECTION, targetSchema);
