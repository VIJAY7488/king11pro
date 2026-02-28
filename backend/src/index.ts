import express from "express";
import dotenv from "dotenv";
import { connectDB, disconnectDB } from "./config/db.config.ts";
import createApp from "./app.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.send("Backend running with TypeScript 🚀");
});


const bootstrap = async(): Promise<void> => {
  // 1. Connect to MongoDB before accepting traffic
  await connectDB();

  // 2. Spin up the HTTP server
  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`✅ Server running in [${PORT}] mode on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/v1/health`);
  });


  // ── Graceful Shutdown ───────────────────────────────────────────
  const shutdown = async(signal: string): Promise<void> => {
    console.log(`\n⚠️  ${signal} received — shutting down gracefully...`);

    // Stop accepting new HTTP connections first
    server.close(async() => {
      console.log('✅ HTTP server closed.');

      // Then drain the DB connection pool
      await disconnectDB();
      process.exit(0);
    });


    // Force exit if shutdown stalls
    setTimeout(() => {
      console.error('❌ Forced exit after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));


  process.on('unhandledRejection', (reason: unknown) => {
    console.error('❌ Unhandled Rejection:', reason);
    server.close(() => process.exit(1));
  });

  process.on('unhandledRejection', (error: Error) => {
    console.error('❌ Uncaught Exception:', error.message);
    process.exit(1);
  });

};

bootstrap();
