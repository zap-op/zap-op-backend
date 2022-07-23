const dotenv = require('dotenv')
const ZapClient = require('zaproxy')

dotenv.config()


const zapOptions = {
    apiKey: process.env.ZAP_API_KEY,
    proxy: process.env.ZAP_HOST + ":" + process.env.ZAP_HOST_PORT
}

const zaproxy = new ZapClient(zapOptions);

// zaproxy.spider.scan("https://phamgiahuy0501.github.io/thefrecklestudios-content-generator")

zaproxy.spider.results(0, (err, res) => {
    if (err) {
        console.log(err);
        return;
    }
    console.log(res);
})