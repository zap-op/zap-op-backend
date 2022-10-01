import database from '../database.js';

const SCAN_SESSION_COLLECTION = 'scan_sessions' + (process.env.NODE_ENV === 'development' ? '_tests' : '');

const scanType = { discriminatorKey: 'scanType' }

const scanSessionSchema = new database.Schema(
    {
        url: {
            type: String,
            required: true
        },
        session: {
            type: String,
            required: true,
            index: true
        },
        authId: {
            type: database.Schema.Types.ObjectId
            // ref:
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: false
        }
    },
    scanType
);

const scanSessionModel = database.model(SCAN_SESSION_COLLECTION, scanSessionSchema);

const scanSessionModelFactor = {
    SCAN_SESSION_COLLECTION,
    discriminator: scanType,
    scanSessionModel
};

export default scanSessionModelFactor;