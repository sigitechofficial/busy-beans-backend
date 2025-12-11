const Stripe = require("stripe");
const {
  subscription,
  addon,
  coffeeMachine,
  subscriptionAddon,
} = require("../../models");
const {
  calculateSubscriptionPrice,
  toCents,
} = require("../../utils/priceCalculator");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a new subscription
 * POST /api/subscription/create
 */
exports.createSubscription = catchAsync(async (req, res, next) => {
  const { customerEmail, paymentMethodId, machineId, addonIds = [] } = req.body;

  // Validate required fields
  if (!customerEmail || !paymentMethodId || !machineId) {
    return next(
      new AppError(
        "customerEmail, paymentMethodId, and machineId are required",
        400
      )
    );
  }

  // 1. Load machine
  const machine = await coffeeMachine.findByPk(machineId);
  if (!machine || machine.deleted) {
    return next(new AppError("Machine not found", 404));
  }

  // 2. Load add-ons
  let addons = [];
  if (addonIds.length > 0) {
    addons = await addon.findAll({
      where: {
        id: addonIds,
        status: true,
        deleted: false,
      },
    });

    if (addons.length !== addonIds.length) {
      return next(
        new AppError("One or more add-ons not found or inactive", 400)
      );
    }
  }

  // 3. Calculate total price
  const pricing = calculateSubscriptionPrice({ machine, addons });
  const totalInCents = toCents(pricing.total);

  console.log("💰 Subscription Price Breakdown:", pricing);

  // 4. Create or retrieve Stripe customer
  let stripeCustomer;
  const existingCustomers = await stripe.customers.list({
    email: customerEmail,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    stripeCustomer = existingCustomers.data[0];

    console.log("✅ Using existing Stripe customer:", stripeCustomer.id);
  } else {
    stripeCustomer = await stripe.customers.create({
      email: customerEmail,
      payment_method: paymentMethodId,
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    console.log("✅ Created new Stripe customer:", stripeCustomer.id);
  }

  // Attach payment method to customer if not already attached
  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomer.id,
    });
  } catch (err) {
    // Payment method might already be attached
    if (!err.message.includes("already been attached")) {
      throw err;
    }
  }

  // 5. Create dynamic Stripe price
  const stripePrice = await stripe.prices.create({
    unit_amount: totalInCents,
    currency: "usd",
    recurring: {
      interval: "month",
    },
    product_data: {
      name: `Subscription for ${machine.name}`,
      description: `Machine: ${machine.name} + ${addons.length} add-on(s)`,
    },
  });

  console.log("✅ Created Stripe price:", stripePrice.id);

  // 6. Create Stripe subscription
  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomer.id,
    items: [{ price: stripePrice.id }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  });

  console.log("✅ Created Stripe subscription:", stripeSubscription.id);

  // 7. Save subscription in database
  const newSubscription = await subscription.create({
    customerEmail,
    stripeCustomerId: stripeCustomer.id,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: stripePrice.id,
    totalPrice: pricing.total,
    status: stripeSubscription.status,
    machineId,
    currentPeriodStart: new Date(
      stripeSubscription.current_period_start * 1000
    ),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
  });

  // 8. Save subscription add-ons
  if (addons.length > 0) {
    const subscriptionAddonRecords = addons.map((addon) => ({
      subscriptionId: newSubscription.id,
      addonId: addon.id,
    }));
    await subscriptionAddon.bulkCreate(subscriptionAddonRecords);
  }

  console.log("✅ Subscription saved to database:", newSubscription.id);

  // 9. Get client secret for frontend
  const clientSecret =
    stripeSubscription.latest_invoice?.payment_intent?.client_secret;

  // 10. Return response
  return res.status(201).json({
    success: true,
    subscriptionId: newSubscription.id,
    stripeSubscriptionId: stripeSubscription.id,
    clientSecret,
    totalPrice: pricing.total,
    breakdown: pricing.breakdown,
    status: stripeSubscription.status,
  });
});

/**
 * Get subscription by ID
 * GET /api/subscription/:id
 */
exports.getSubscription = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const subscriptionRecord = await subscription.findByPk(id, {
    include: [
      {
        model: coffeeMachine,
        as: "machine",
      },
      {
        model: addon,
        as: "addons",
        through: { attributes: [] },
      },
    ],
  });

  if (!subscriptionRecord) {
    return next(new AppError("Subscription not found", 404));
  }

  return res.status(200).json({
    success: true,
    subscription: subscriptionRecord,
  });
});

/**
 * Cancel subscription
 * POST /api/subscription/:id/cancel
 */
exports.cancelSubscription = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const subscriptionRecord = await subscription.findByPk(id);

  if (!subscriptionRecord) {
    return next(new AppError("Subscription not found", 404));
  }

  // Cancel in Stripe
  const stripeSubscription = await stripe.subscriptions.update(
    subscriptionRecord.stripeSubscriptionId,
    {
      cancel_at_period_end: true,
    }
  );

  // Update in database
  await subscriptionRecord.update({
    status: "canceled",
    canceledAt: new Date(),
  });

  console.log("✅ Subscription canceled:", id);

  return res.status(200).json({
    success: true,
    message: "Subscription will be canceled at period end",
    subscription: subscriptionRecord,
    periodEnd: new Date(stripeSubscription.current_period_end * 1000),
  });
});

/**
 * List all subscriptions
 * GET /api/subscription/list
 */
exports.listSubscriptions = catchAsync(async (req, res, next) => {
  const { customerEmail, status } = req.query;

  const where = {};
  if (customerEmail) where.customerEmail = customerEmail;
  if (status) where.status = status;

  const subscriptions = await subscription.findAll({
    where,
    include: [
      {
        model: coffeeMachine,
        as: "machine",
      },
      {
        model: addon,
        as: "addons",
        through: { attributes: [] },
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return res.status(200).json({
    success: true,
    count: subscriptions.length,
    subscriptions,
  });
});

/**
 * List all available add-ons
 * GET /api/subscription/addons
 */
exports.listAddons = catchAsync(async (req, res, next) => {
  const addons = await addon.findAll({
    where: {
      status: true,
      deleted: false,
    },
    order: [["name", "ASC"]],
  });

  return res.status(200).json({
    success: true,
    count: addons.length,
    addons,
  });
});
