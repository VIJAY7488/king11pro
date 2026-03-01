import express, { Application } from 'express';
import routes from './routes';


const createApp = ():Application => {
    const app = express();

    app.use(express.json());



    // ── Routes ──────────────────────────────────────────────────────
    app.use('/api/v1', routes);

    return app;
}

export default createApp;