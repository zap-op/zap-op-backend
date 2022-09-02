import database from '../database.js';

export const SPIDER_SESSION_VERSION = 0;
export const SPIDER_SESSION_COLLECTION = 'spider_sessions' + (process.env.NODE_ENV === 'development' ? '_tests' : '');

export const spiderSessionSchema = new database.Schema({
    url: {
        type: String,
        required: true
    },
    id: {
        type: String,
        required: true,
        index: true,
    },
    maxChildren: {
        type: Number,
        min: 0
    },
    recurse: Boolean,
    subtreeOnly: Boolean,
    version: {
        type: Number,
        required: true,
        min: SPIDER_SESSION_VERSION,
        default: SPIDER_SESSION_VERSION
    }
});

export const spiderSessionModel = database.model(SPIDER_SESSION_COLLECTION, spiderSessionSchema);