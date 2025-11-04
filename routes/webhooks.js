const express = require('express');
const router = express.Router();
const Controller = require('../controllers/webhook/webhookController');

const catchAsync = require('../utils/catchAsync');

router.post(
  '/busy-beans-coffee',
  catchAsync(Controller.stripeSubscriptionWebhookEventHandler),
);

module.exports = router;
