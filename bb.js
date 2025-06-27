const db = require('./models');
require('dotenv').config(); // Load environment variables from .env file

const server = require('./app');

const serverPort = 8011;

const syncDb = 0
; // Use environment variable for flexibility

if (syncDb) {
  db.sequelize
    .sync({ alter: true })
    .then(() => {
      console.log('Database synchronized successfully.');
    })
    .catch((err) => {
      console.error('Error synchronizing database:', err);
    });
}

// Handle unhandled promise rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally, restart the server or perform other actions
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  // Optionally, restart the server or perform other actions
  process.exit(1); // Exit the process to avoid undefined states
});

// Graceful Shutdown
const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully.');
  server.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error(
      'Could not close connections in time, forcefully shutting down.',
    );
    process.exit(1);
  }, 10000); 
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
 
server.listen(serverPort,'192.168.1.118', (err) => {
  if (err) throw err
  console.log(`Server is listening on 192.168.1.118 :${serverPort}`)
})