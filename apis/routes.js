import rootController from './controllers/root.controller.js';
import scanController from './controllers/scan.controller.js';

export function initRoutes(app) {
    app.route('/login')
        .post(rootController.login);
    
    app.route('/scan')
        .post(scanController.scan);
};