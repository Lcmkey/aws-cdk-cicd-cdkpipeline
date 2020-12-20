import express, { Application, Request, Response } from "express";
import { createHttpTerminator } from "http-terminator";

// Constants
const PORT = process.env.PORT || 8080;

// App
const app: Application = express();

app.get('/', (req: Request, res: Response): void => {
    console.log(`received request.`);
    res.send('Hello World');
});

app.get('/_health', (req: Request, res: Response): void => {
    console.log(`received health check.`);
    res.sendStatus(200);
})

const server = app.listen(PORT, (): void => {
    console.log(`listening on port ${PORT}`);
});

// Graceful app shutdown
const serverTerminator = createHttpTerminator({
    server: server,
});

const shutdown = async (signal: string) => {
    console.log(`Closing server by ${signal}`);
    await serverTerminator.terminate();
};

process.on('SIGHUP', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);