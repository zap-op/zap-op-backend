import ZapClient from 'zaproxy';

const ConfigOptions = {
    apiKey: process.env.ZAP_API_KEY,
    proxy: process.env.ZAP_HOST + ":" + process.env.ZAP_HOST_PORT
}

const ZAProxyClient = new ZapClient(ConfigOptions);

export default ZAProxyClient;