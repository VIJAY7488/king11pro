import express, { Application } from 'express';


const createApp = ():Application => {
    const app = express();

    return app;
}

export default createApp;