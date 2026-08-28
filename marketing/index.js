/**
 * Page Builder (Marketing) module — isolated from /api/v1 commerce routes.
 *
 * Mounted at: app.use("/api", marketingRouter)
 * Paths:      /api/auth, /api/admin/landing-pages, /api/public/*
 */
const routes = require("./routes");
const {
  startLandingPageScheduler,
  stopLandingPageScheduler,
} = require("./jobs/landingPageScheduler.job");

module.exports = {
  router: routes,
  startLandingPageScheduler,
  stopLandingPageScheduler,
};
