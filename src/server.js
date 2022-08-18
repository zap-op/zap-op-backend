// const express = require('express');
// const app = express();
// const routers = require('./routes/routes');
// const mongoose = require('mongoose')
// const cors = require('cors');
// const dotenv = require('dotenv');
// const ZapClient = require('zaproxy');

// dotenv.config()


// const zapOptions = {
//     apiKey: process.env.ZAP_API_KEY,
//     proxy: process.env.ZAP_HOST + ":" + process.env.ZAP_HOST_PORT
// }

// const zaproxy = new ZapClient(zapOptions);

// // zaproxy.spider.scan("https://www.zaproxy.org")

// zaproxy.spider.results(0, (err, res) => {
//     if (err) {
//         console.log(err);
//         return;
//     }
//     console.log(res.results.length);
// })

// zaproxy.spider.fullResults(0, (err, res) => {
//     if (err) {
//         console.log(err);
//         return;
//     }
//     console.log(res.fullResults[1].urlsOutOfScope.length);
//     console.log(res.fullResults[0].urlsInScope.length);
// })

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

import { initRoutes } from './apis/routes.js';
initRoutes(app);

app.use((req, res) => {
    res.status(404).send({ msg: req.originalUrl + ' not found' });
})

const port = process.env.PORT || 8888;
const server = app.listen(port, () => {
    const host = server.address().address;
    const port = server.address().port;
    console.log(`Started REST server on ${host}:${port}`);
});