import { router as loginRouter } from './routers/login-router/login.router.js';
import spiderScanRouterFactor from './routers/spider-router/spider.router.js';
import scanRouterFactor from './routers/scan-router/scan.router.js';

export function initRoutes(app) {
    app.use('/login', loginRouter);
    app.use(
        "/" + scanRouterFactor.scanRouterPath + "/" + spiderScanRouterFactor.spiderScanrouterPath,
        spiderScanRouterFactor.spiderScanRouter
    );
    app.use(
        "/" + scanRouterFactor.scanRouterPath,
        scanRouterFactor.scanRouter
    );
};