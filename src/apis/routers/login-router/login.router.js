import express from 'express';

export const router = express.Router()

router.post('/', (req, res) => {
    res.status(200).json({ msg: 'succeed' });
});