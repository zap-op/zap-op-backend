import database from "../database";

export const TARGET_COLLECTION =
"targets" + (process.env.NODE_ENV === "development" ? "_tests" : "");

export const targetModel = database!.model(
        TARGET_COLLECTION,
        new database!.Schema(
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
            }));
