const Stripe = require("stripe");
const {
  subscription,
  addon,
  coffeeMachine,
  subscriptionAddon,
  subscriptionProduct,
  product,
} = require("../models");
const {
  calculateSubscriptionPrice,
  toCents,
} = require("../utils/priceCalculator");

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
      userName,
      paymentMethodId,
      stripeCustomerId,
      machineId,
      machineName,
      machinePrice,
      userId,
      subscriptionDays = 30,
      products = [],
      productsTotal = 0,
      addons = [],
      addonsTotal = 0,
      totalAmount,
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

    // 2. Validate products if provided
    if (products.length > 0) {
      const productIds = products.map((p) => p.productId);
      const foundProducts = await product.findAll({
        where: {
          id: productIds,
          status: true,
          deleted: false,
        },
      });

      if (foundProducts.length !== productIds.length) {
        return res.status(400).json({
          success: false,
          error: "One or more products not found or inactive",
        });
      }
    }

    // 3. Validate addons of type "addon" (with addonId)
    const addonTypeAddons = addons.filter((a) => a.type === "addon");
    if (addonTypeAddons.length > 0) {
      const addonIds = addonTypeAddons.map((a) => a.addonId);
      const foundAddons = await addon.findAll({
        where: {
          id: addonIds,
          status: true,
          deleted: false,
        },
      });

      if (foundAddons.length !== addonIds.length) {
        return res.status(400).json({
          success: false,
          error: "One or more add-ons not found or inactive",
        });
      }
    }

    // 4. Calculate total price
    const calculatedTotal =
      totalAmount || machinePrice + productsTotal + addonsTotal;
    const totalInCents = toCents(calculatedTotal);

    console.log("💰 Subscription Price Breakdown:", {
      machinePrice,
      productsTotal,
      addonsTotal,
      total: calculatedTotal,
    });

    // 5. Create or retrieve Stripe customer
    let stripeCustomer;

    // If stripeCustomerId is provided, use it
    if (stripeCustomerId) {
      try {
        stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
        console.log("✅ Using provided Stripe customer:", stripeCustomer.id);
      } catch (error) {
        console.log("⚠️ Provided customer ID not found, creating new customer");
        stripeCustomer = null;
      }
    }

    // If no customer found, search by email or create new
    if (!stripeCustomer) {
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
          name: userName,
          payment_method: paymentMethodId,
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
        console.log("✅ Created new Stripe customer:", stripeCustomer.id);
      }
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

    // 6. Create dynamic Stripe price (one cycle = subscriptionDays, e.g. 60 days = one charge every 60 days)
    const cycleDays = Math.max(
      1,
      Math.min(365, parseInt(subscriptionDays, 10) || 30)
    );
    const productDescription =
      products.length > 0 ? `${products.length} product(s)` : "no products";
    const addonDescription =
      addons.length > 0 ? `${addons.length} addon(s)` : "no addons";

    const stripePrice = await stripe.prices.create({
      unit_amount: totalInCents,
      currency: "usd",
      recurring: {
        interval: "day",
        interval_count: cycleDays,
      },
      product_data: {
        name: `Subscription for ${machine.name}`,
        description: `Machine: ${machine.name} + ${productDescription} + ${addonDescription}`,
      },
    });

    console.log("✅ Created Stripe price:", stripePrice.id);

    // 7. Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomer.id,
      items: [{ price: stripePrice.id }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
    });

    console.log("✅ Created Stripe subscription:", stripeSubscription.id);

    // 8. Save subscription in database
    const newSubscription = await subscription.create({
      customerEmail,
      stripeCustomerId: stripeCustomer.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: stripePrice.id,
      totalPrice: calculatedTotal,
      status: stripeSubscription.status,
      machineId,
      userId,
      userName,
      subscriptionDays,
      machinePrice: machinePrice || 0,
      productsTotal: productsTotal || 0,
      addonsTotal: addonsTotal || 0,
      currentPeriodStart: new Date(
        stripeSubscription.current_period_start * 1000
      ),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });

    // 9. Save subscription products
    if (products.length > 0) {
      const subscriptionProductRecords = products.map((prod) => ({
        subscriptionId: newSubscription.id,
        productId: prod.productId,
        sku: prod.sku,
        quantity: prod.quantity,
        unitPrice: prod.unitPrice,
        totalPrice: prod.totalPrice,
      }));
      await subscriptionProduct.bulkCreate(subscriptionProductRecords);
    }

    // 10. Save subscription add-ons
    if (addons.length > 0) {
      const subscriptionAddonRecords = addons.map((addonItem) => ({
        subscriptionId: newSubscription.id,
        addonId: addonItem.addonId || null,
        type: addonItem.type,
        name: addonItem.name || null,
        quantity: addonItem.quantity,
        unitPrice: addonItem.unitPrice,
        totalPrice: addonItem.totalPrice,
      }));
      await subscriptionAddon.bulkCreate(subscriptionAddonRecords);
    }

    console.log("✅ Subscription saved to database:", newSubscription.id);

    // 11. Get client secret for frontend
    const clientSecret =
      stripeSubscription.latest_invoice?.payment_intent?.client_secret;

    // 12. Return response
    return res.status(201).json({
      success: true,
      subscriptionId: newSubscription.id,
      stripeSubscriptionId: stripeSubscription.id,
      clientSecret,
      totalPrice: calculatedTotal,
      breakdown: {
        machinePrice,
        productsTotal,
        addonsTotal,
      },
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
          through: {
            attributes: ["type", "name", "quantity", "unitPrice", "totalPrice"],
          },
        },
        {
          model: product,
          as: "products",
          through: {
            attributes: ["sku", "quantity", "unitPrice", "totalPrice"],
          },
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
          through: {
            attributes: ["type", "name", "quantity", "unitPrice", "totalPrice"],
          },
        },
        {
          model: product,
          as: "products",
          through: {
            attributes: ["sku", "quantity", "unitPrice", "totalPrice"],
          },
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
