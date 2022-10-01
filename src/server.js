import 'dotenv/config';
import database from './database/database.js';

if (!database)
    throw 'Failed to connect DB';
else
    console.log('Connected to DB');

import express from 'express';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CONFIG CORS POLICY
import cors from 'cors';
app.use(cors({
	origin: process.env.CORS_ORIGIN
}));

// CONFIG Cookie Parser to work with cookie
import cookieParser from 'cookie-parser';
app.use(cookieParser());

import { initRoutes } from './apis/route.js';
initRoutes(app);

app.use((req, res) => {
    res.status(404).json({ msg: req.originalUrl + ' not found' });
})

import { ValidationError } from 'express-json-validator-middleware';

app.use((err, req, res, next) => {
	if (res.headersSent)
		return next(err);

	if (!(err instanceof ValidationError))
		return next(err);

	res.status(400).json({
		errors: err.validationErrors
	});

	next();
});

const port = process.env.PORT || 8888;
const server = app.listen(port, () => {
    const host = server.address().address;
    const port = server.address().port;
    console.log(`Started REST server on ${host}:${port}`);
});