const db = require("./models");
require("dotenv").config();
require("./redis_connect");
const server = require("./app");
const {
  startLandingPageScheduler,
  stopLandingPageScheduler,
} = require("./marketing");

const serverPort = process.env.PORT || 8011;
const serverHost = process.env.HOST || "127.0.0.1"; // Accept connections from anywhere
// const serverHost = "192.168.1.25";

//
const syncDb = 0;

if (syncDb) {
  db.sequelize
    .sync({ alter: true })
    .then(() => console.log("✅ Database synchronized successfully."))
    .catch((err) => console.error("❌ Error synchronizing database:", err));
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("\n🔴 Unhandled Rejection at:", promise);
  console.error("Reason:", reason, "\n");
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("\n🔴 Uncaught Exception:", err, "\n");
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("\n🟡 Received shutdown signal. Closing server...");
  stopLandingPageScheduler();
  server.close(() => {
    console.log("✅ Server closed successfully.\n");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("❌ Force shutdown: Timed out.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start the server
server.listen(serverPort, serverHost, (err) => {
  if (err) throw err;

  const localURL = `http://${serverHost}:${serverPort}`;
  console.log("\n🟢 Server started successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🚀 Listening on:         ${localURL}`);
  // console.log('🌐 To expose publicly:   Run the following command:');
  // console.log(`                         ngrok http ${serverPort}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  startLandingPageScheduler();
});
