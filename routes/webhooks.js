const express = require('express')
const router = express.Router()
const Controller = require('../controllers/Webhook/webhookController') 

const catchAsync = require('../utils/catchAsync') 

router.post(
  '/financial-connections',
  catchAsync(Controller.stripeSubscriptionWebhookEventHandler),
)

module.exports = router
