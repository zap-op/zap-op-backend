import mongoose from "mongoose";
// @ts-ignore
import addJsonSchema from "mongoose-schema-jsonschema";

let database: mongoose.Mongoose | undefined;

const connect = async function () {
    if (!process.env.MONGO_CONNECTION_STRING)
        console.error("MONGO_CONNECTION_STRING not found");
    else {
        try {
            database = await mongoose.connect(process.env.MONGO_CONNECTION_STRING, { autoIndex: true });
            database.connection.on("error", async () => {
                console.error("Mongo connection error");
                await connect();
            });
        } catch (err) {
            console.error(`Failed to connect mongo, error: ${err}`);
        }
    }
};
await connect();
addJsonSchema(database);

export default database;
