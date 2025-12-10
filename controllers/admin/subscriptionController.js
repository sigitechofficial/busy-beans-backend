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

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a new subscription
 * POST /api/subscription/create
 */
exports.createSubscription = async (req, res) => {
  try {
    const {
      customerEmail,
      paymentMethodId,
      machineId,
      addonIds = [],
    } = req.body;

    // Validate required fields
    if (!customerEmail || !paymentMethodId || !machineId) {
      return res.status(400).json({
        success: false,
        error: "customerEmail, paymentMethodId, and machineId are required",
      });
    }

    // 1. Load machine
    const machine = await coffeeMachine.findByPk(machineId);
    if (!machine || machine.deleted) {
      return res.status(404).json({
        success: false,
        error: "Machine not found",
      });
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
        return res.status(400).json({
          success: false,
          error: "One or more add-ons not found or inactive",
        });
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
  } catch (error) {
    console.error("❌ Create subscription error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create subscription",
    });
  }
};

/**
 * Get subscription by ID
 * GET /api/subscription/:id
 */
exports.getSubscription = async (req, res) => {
  try {
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
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }

    return res.status(200).json({
      success: true,
      subscription: subscriptionRecord,
    });
  } catch (error) {
    console.error("❌ Get subscription error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to retrieve subscription",
    });
  }
};

/**
 * Cancel subscription
 * POST /api/subscription/:id/cancel
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const subscriptionRecord = await subscription.findByPk(id);

    if (!subscriptionRecord) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
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
  } catch (error) {
    console.error("❌ Cancel subscription error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to cancel subscription",
    });
  }
};

/**
 * List all subscriptions
 * GET /api/subscription/list
 */
exports.listSubscriptions = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("❌ List subscriptions error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to list subscriptions",
    });
  }
};

/**
 * List all available add-ons
 * GET /api/subscription/addons
 */
exports.listAddons = async (req, res) => {
  try {
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
  } catch (error) {
    console.error("❌ List addons error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to list add-ons",
    });
  }
};
