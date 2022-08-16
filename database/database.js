import mongoose from 'mongoose';

let database = undefined;

const connect = async function() {
    if (!process.env.MONGO_CONNECTION_STRING)
        console.error('MONGO_CONNECTION_STRING not found');
    else {
        try {
            database = await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
            database.connection.on('error', async () => { 
                console.error('Mongo connection error');
                await connect();
            });
        }
        catch(err) {
            console.error(`Failed to connect mongo, error: ${err}`);
        }
    }
};
await connect();

export default database;