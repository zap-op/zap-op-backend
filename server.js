const express = require('express');
const app = express();
const routers = require('./routes/routes');
const mongoose = require('mongoose')
const cors = require('cors');
const dotenv = require('dotenv');
const ZapClient = require('zaproxy');

dotenv.config()


const zapOptions = {
    apiKey: process.env.ZAP_API_KEY,
    proxy: process.env.ZAP_HOST + ":" + process.env.ZAP_HOST_PORT
}

const zaproxy = new ZapClient(zapOptions);

// zaproxy.spider.scan("https://www.zaproxy.org")

zaproxy.spider.results(0, (err, res) => {
    if (err) {
        console.log(err);
        return;
    }
    console.log(res.results.length);
})

zaproxy.spider.fullResults(0, (err, res) => {
    if (err) {
        console.log(err);
        return;
    }
    console.log(res.fullResults[1].urlsOutOfScope.length);
    console.log(res.fullResults[0].urlsInScope.length);
})