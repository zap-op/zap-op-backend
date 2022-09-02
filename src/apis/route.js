import { router as loginRouter } from './routers/login-router/login.router.js';
import { router as spiderRouter } from './routers/spider-router/spider.router.js';
import scanRouter from './routers/scan-router/scan.router.js';

export function initRoutes(app) {
    app.use('/login', loginRouter);
    app.use('/spider', spiderRouter);
    app.use('/scan', scanRouter);
};