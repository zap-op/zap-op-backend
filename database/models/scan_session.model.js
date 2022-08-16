import database from '../database.js';

export const SCAN_SESSION_VERSION = 0;
export const SCAN_SESSION_COLLECTION = 'scan_sessions' + (process.env.NODE_ENV === 'development' ? '_tests' : '');

export const scanSessionSchema = new database.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    version: {
        type: Number,
        required: true,
        default: SCAN_SESSION_VERSION
    }
});

export const scanSessionModel = database.model(SCAN_SESSION_COLLECTION, scanSessionSchema);