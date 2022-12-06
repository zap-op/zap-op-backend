import mongoose from "mongoose";
// @ts-ignore
import addJsonSchema from "mongoose-schema-jsonschema";
import {mainProc} from "../utils/log";

let database: mongoose.Mongoose | undefined;

const connect = async function () {
    if (!process.env.MONGO_CONNECTION_STRING)
        mainProc.error("MONGO_CONNECTION_STRING not found");
    else {
        try {
            mongoose.set("strictQuery", false);
            database = await mongoose.connect(process.env.MONGO_CONNECTION_STRING, { autoIndex: true });
            database.connection.on("error", async () => {
                mainProc.warn("Mongo connection error - retrying...");
                await connect();
            });
        } catch (err) {
            mainProc.error(`Failed to connect mongo, error: ${err}`);
        }
    }
};
await connect();
addJsonSchema(database);

export default database;
