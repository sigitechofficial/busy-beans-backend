/**
 * Per-request context (who is acting) for code that runs below the controllers, e.g. model hooks
 * logging "order created" / "paid" with the right person. Requests outside signed-in routes
 * (Stripe webhooks, jobs, public pay links) have no context and are recorded as the system.
 */
const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

/** Express middleware (after `protect`): run the rest of the request inside its context. */
const requestContext = (req, res, next) => storage.run({ user: req.user || null }, next);

const currentUser = () => storage.getStore()?.user || null;

module.exports = { requestContext, currentUser };
