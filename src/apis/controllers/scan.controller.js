import { v4 as uuidv4 } from 'uuid';
import { isScannableURL } from '../../utils/string.util.js'
import { scanSessionModel } from '../../database/models/scan_session.model.js';

export default {
    scan: async (req, res) => {
        const body = req.body;

        if (!body.url || typeof body.url !== 'string' || !isScannableURL(body.url))
            return res.status(400).send({ msg: 'URL not found' });

        const sessionId = uuidv4();

        const scanSession = new scanSessionModel({ id: sessionId });
        scanSession.save((err) => {
            if (err) {
                console.error(`Failed to create session document, error: ${err}`);
                return res.status(500).send({ msg: 'internal error' });
            }
            
            res.status(200).send({ 
                msg: 'succeed',
                url: body.url,
                id: sessionId
            });
        });
    }
};