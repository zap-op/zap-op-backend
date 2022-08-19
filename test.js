import { Subject } from 'rxjs';
import ZapClient from 'zaproxy';

const zapOptions = {
    apiKey: '123',
    proxy: 'http://127.0.0.1:8080'
}
const zaproxy = new ZapClient(zapOptions);

let statusSubject = new Subject('0');

statusSubject.subscribe(async (val) => {
    console.log(val);

    if (val == 100) {
        const res = await zaproxy.spider.results(id.scan);
        console.log(res);
    }
    else {
        setTimeout(async () => {
            const status = await zaproxy.spider.status(id.scan);
            statusSubject.next(status.status);
        }, 5000);
    }
});

const id = await zaproxy.spider.scan('https://www.google.com', 50, false, null, true);

const status = await zaproxy.spider.status(id.scan);
statusSubject.next(status.status);

// zaproxy.spider.fullResults(0, (err, res) => {
//     if (err) {
//         console.log(err);
//         return;
//     }
//     console.log(res.fullResults[1].urlsOutOfScope.length);
//     console.log(res.fullResults[0].urlsInScope.length);
// })