const os = require("os");
const db = require("./models");
require("dotenv").config();
require("./redis_connect");
const server = require("./app");

const serverPort = process.env.PORT || 8011;
// 0.0.0.0 = listen on all interfaces so phones / other PCs on your LAN can reach this machine
const serverHost = process.env.HOST || "0.0.0.0";

const syncDb = 0;

if (syncDb) {
  db.sequelize
    .sync({ alter: true })
    .then(() => console.log("✅ Database synchronized successfully."))
    .catch((err) => console.error("❌ Error synchronizing database:", err));
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n🔴 Unhandled Rejection at:", promise);
  console.error("Reason:", reason, "\n");
});

process.on("uncaughtException", (err) => {
  console.error("\n🔴 Uncaught Exception:", err, "\n");
  process.exit(1);
});

const gracefulShutdown = () => {
  console.log("\n🟡 Received shutdown signal. Closing server...");
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

function lanIpv4Addresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const family = net.family;
      if ((family === "IPv4" || family === 4) && !net.internal) {
        out.push(net.address);
      }
    }
  }
  return out;
}

server.listen(serverPort, serverHost, (err) => {
  if (err) throw err;

  console.log("\n🟢 Server started successfully (local / LAN)!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🚀 Bound on:             http://${serverHost}:${serverPort}`);
  console.log(`🏠 This machine:         http://127.0.0.1:${serverPort}`);
  const lan = lanIpv4Addresses();
  if (lan.length) {
    console.log("🌐 On your network (use from phone / other PC):");
    lan.forEach((ip) =>
      console.log(`                         http://${ip}:${serverPort}`),
    );
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
