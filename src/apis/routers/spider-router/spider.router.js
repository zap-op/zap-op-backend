export const postSpiderSchema = {
    type: 'object',
    properties: {
        url: {
            type: 'string'
        },
        max_children: {
            type: 'integer',
            minimum: 1
        },
        recurse: {
            type: 'boolean'
        },
        subtree_only: {
            type: 'boolean'
        }
    },
    required: ['url']
};

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { isValidURL } from '../../../utils/string.util.js';
import { spiderSessionModel } from '../../../database/models/spider_session.model.js';
import { Validator } from 'express-json-validator-middleware';

export const router = express.Router();
const { validate } = new Validator();

router.post('/', validate({ body: postSpiderSchema }), async (req, res) => {
    const body = req.body;

    if (!isValidURL(body.url))
        return res.status(400).json({ msg: 'invalid URL' });

    const spiderOptions = {
        url: body.url,
        id: uuidv4()
    };

    if (typeof body.max_children === 'number')
        spiderOptions.maxChildren = body.max_children;

    if (typeof body.recurse === 'boolean')
        spiderOptions.recurse = body.recurse;

    if (typeof body.subtree_only === 'boolean')
        spiderOptions.subtreeOnly = body.subtree_only;

    const spiderSession = new spiderSessionModel(spiderOptions);

    try {
        await spiderSession.save();
        res.status(200).json(spiderOptions);
    } catch (error) {
        console.error(`Failed to create session document, error: ${err}`);
        res.status(500).json({ msg: 'internal error' });
    }
});