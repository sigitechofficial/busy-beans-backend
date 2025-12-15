const Stripe = require("stripe");
const {
  subscription,
  addon,
  coffeeMachine,
  subscriptionAddon,
  subscriptionProduct,
  product,
  user,
} = require("../../models");
const {
  calculateSubscriptionPrice,
  toCents,
} = require("../../utils/priceCalculator");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const sendSubscriptionInvitationEmail = require("../../helper/subscriptionInvitation");

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a new subscription
 * POST /api/subscription/create
 */
exports.createSubscription = catchAsync(async (req, res, next) => {
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
  if (!customerEmail || !machineId) {
    return next(new AppError("customerEmail and machineId are required", 400));
  }

  // 1. Load machine
  const machine = await coffeeMachine.findByPk(machineId);
  if (!machine || machine.deleted) {
    return next(new AppError("Machine not found", 404));
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
      return next(
        new AppError("One or more products not found or inactive", 400)
      );
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
      return next(
        new AppError("One or more add-ons not found or inactive", 400)
      );
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

  // ==========================================
  // FLOW A: PENDING PAYMENT (No Payment Method)
  // ==========================================
  if (!paymentMethodId) {
    // Create subscription with PENDING_PAYMENT status
    const newSubscription = await subscription.create({
      customerEmail,
      userName,
      userId,
      machineId,
      subscriptionDays,
      machinePrice: machinePrice || 0,
      productsTotal: productsTotal || 0,
      addonsTotal: addonsTotal || 0,
      totalPrice: calculatedTotal,
      status: "pending_payment",
      // Stripe fields will be null initially
    });

    // Save subscription products
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

    // Save subscription add-ons
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

    // Send invitation email with payment link
    await sendSubscriptionInvitationEmail({
      data: {
        customerEmail,
        userName,
        subscriptionId: newSubscription.id,
        machine,
        products,
        addons,
        machinePrice: machinePrice || 0,
        productsTotal: productsTotal || 0,
        addonsTotal: addonsTotal || 0,
        totalPrice: calculatedTotal,
        subscriptionDays,
      },
    });

    return res.status(201).json({
      success: true,
      subscriptionId: newSubscription.id,
      status: "pending_payment",
      message: "Subscription created. Payment link sent to email.",
      totalPrice: calculatedTotal,
    });
  }

  // ==========================================
  // FLOW B: IMMEDIATE PAYMENT (With Payment Method)
  // ==========================================

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

  // Set as default payment method for the customer
  await stripe.customers.update(stripeCustomer.id, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  // 6. Create dynamic Stripe price
  const stripePrice = await stripe.prices.create({
    unit_amount: totalInCents,
    currency: "usd",
    recurring: {
      interval: "month",
    },
    product_data: {
      name: `Subscription for ${machine.name}`,
    },
  });

  console.log("✅ Created Stripe price:", stripePrice.id);

  // 7. Create Stripe subscription with immediate payment attempt
  // Since we're providing default_payment_method, Stripe will attempt to charge immediately
  // The subscription will be active if payment succeeds, or incomplete if payment requires action (3D Secure, etc.)
  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomer.id,
    items: [{ price: stripePrice.id }],
    default_payment_method: paymentMethodId,
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
});

/**
 * Complete payment for a pending subscription
 * POST /api/subscription/:id/complete-payment
 */
exports.completeSubscriptionPayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { paymentMethodId } = req.body;

  if (!paymentMethodId) {
    return next(new AppError("paymentMethodId is required", 400));
  }

  // 1. Find subscription with all details
  const subscriptionRecord = await subscription.findByPk(id, {
    include: [
      { model: coffeeMachine, as: "machine" },
      {
        model: addon,
        as: "addons",
        through: {
          attributes: ["type", "name", "quantity", "unitPrice", "totalPrice"],
        },
      },
      {
        // This assumes we fix the product association in getSubscription too
        model: product,
        as: "products",
        through: { attributes: ["sku", "quantity", "unitPrice", "totalPrice"] },
      },
    ],
  });

  if (!subscriptionRecord) {
    return next(new AppError("Subscription not found", 404));
  }

  // Allow completing payment if status is 'pending_payment' or 'incomplete'
  // (incomplete happens if Stripe auth failed previously)
  if (
    subscriptionRecord.status !== "pending_payment" &&
    subscriptionRecord.status !== "incomplete"
  ) {
    return next(
      new AppError(`Subscription is already ${subscriptionRecord.status}`, 400)
    );
  }

  // If already has Stripe subscription but status is incomplete/past_due, we might need a different flow (update payment method)
  // But for this "pending_payment" flow, we assume no Stripe subscription exists yet OR we create a new one.
  // Ideally, if it's "pending_payment", it has NO stripeSubscriptionId.

  if (subscriptionRecord.stripeSubscriptionId) {
    // If it already nas a Stripe ID, we should update the payment method instead of creating new
    // For simplicity, let's focus on the pending_payment case where stripeSubscriptionId is null
    if (subscriptionRecord.status !== "pending_payment") {
      // Logic for updating existing stripe sub could go here
    }
  }

  const machine = subscriptionRecord.machine;
  const productsList = subscriptionRecord.products || []; // from association
  // Note: Sequelize association parsing might put custom addons here if associated correctly,
  // but for now let's use the DB record's calculated price + description

  const totalInCents = toCents(subscriptionRecord.totalPrice);

  // 2. Create/Retrieve Customer
  let stripeCustomer;
  if (subscriptionRecord.stripeCustomerId) {
    stripeCustomer = await stripe.customers.retrieve(
      subscriptionRecord.stripeCustomerId
    );
  } else {
    // Search or create
    const existingCustomers = await stripe.customers.list({
      email: subscriptionRecord.customerEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomer = existingCustomers.data[0];
    } else {
      stripeCustomer = await stripe.customers.create({
        email: subscriptionRecord.customerEmail,
        name: subscriptionRecord.userName,
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }
  }

  // Attach payment method
  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomer.id,
    });
  } catch (err) {
    if (!err.message.includes("already been attached")) throw err;
  }

  await stripe.customers.update(stripeCustomer.id, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // 3. Create Price
  const stripePrice = await stripe.prices.create({
    unit_amount: totalInCents,
    currency: "usd",
    recurring: { interval: "month" },
    product_data: {
      name: `Subscription for ${machine.name}`,
      description: `Pending Subscription Payment`, // Simplified description
    },
  });

  // 4. Create Subscription
  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomer.id,
    items: [{ price: stripePrice.id }],
    default_payment_method: paymentMethodId,
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  });

  // 5. Update DB Record
  await subscriptionRecord.update({
    stripeCustomerId: stripeCustomer.id,
    stripeSubscriptionId: stripeSubscription.id,
    stripePriceId: stripePrice.id,
    status: stripeSubscription.status,
    currentPeriodStart: new Date(
      stripeSubscription.current_period_start * 1000
    ),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
  });

  const clientSecret =
    stripeSubscription.latest_invoice?.payment_intent?.client_secret;

  return res.status(200).json({
    success: true,
    stripeSubscriptionId: stripeSubscription.id,
    clientSecret,
    status: stripeSubscription.status,
    subscription: subscriptionRecord,
  });
});

/**
 * Create payment intent for subscription
 * GET /api/v1/users/subscription/:id/create-payment-intent/:userId
 * This endpoint allows users to create or retrieve a payment intent for their subscription
 * Public route - no authentication required
 */
exports.createPaymentIntent = catchAsync(async (req, res, next) => {
  const { id, userId } = req.params;
  const { paymentMethodId } = req.query; // Optional: for creating new payment intent

  // Get user by userId
  const userRecord = await user.findByPk(userId, {
    attributes: ["id", "name", "email", "stripeCustomerId"],
  });

  if (!userRecord) {
    return next(new AppError("User not found", 404));
  }

  // Get subscription with associations
  const subscriptionRecord = await subscription.findByPk(id, {
    include: [
      {
        model: coffeeMachine,
        as: "machine",
      },
    ],
  });

  if (!subscriptionRecord) {
    return next(new AppError("Subscription not found", 404));
  }

  // Verify subscription belongs to user
  if (
    subscriptionRecord.userId &&
    subscriptionRecord.userId !== parseInt(userId)
  ) {
    return next(
      new AppError(
        "This subscription does not belong to the specified user",
        403
      )
    );
  }

  // Check if subscription is in a state that allows payment
  const allowedStatuses = ["pending_payment", "incomplete", "past_due"];
  if (!allowedStatuses.includes(subscriptionRecord.status)) {
    return next(
      new AppError(
        `Cannot create payment intent for subscription with status: ${subscriptionRecord.status}`,
        400
      )
    );
  }

  try {
    let clientSecret;
    let stripeSubscription;
    let stripeCustomerId;

    // Step 1: Get or create Stripe customer for user
    if (userRecord.stripeCustomerId) {
      // User already has Stripe customer ID
      stripeCustomerId = userRecord.stripeCustomerId;
      console.log("✅ User has existing Stripe customer:", stripeCustomerId);
    } else {
      // Create new Stripe customer using addCustomer function
      const { addCustomer } = require("../controllers/stripe");
      stripeCustomerId = await addCustomer({
        name: userRecord.name || userRecord.email,
        email: userRecord.email,
      });

      // Save stripeCustomerId to user record
      await userRecord.update({
        stripeCustomerId: stripeCustomerId,
      });
      console.log(
        "✅ Created new Stripe customer and saved to user:",
        stripeCustomerId
      );
    }

    // Step 2: Handle subscription payment intent
    // Case 1: Subscription already has Stripe subscription ID
    if (subscriptionRecord.stripeSubscriptionId) {
      // Retrieve existing subscription from Stripe
      stripeSubscription = await stripe.subscriptions.retrieve(
        subscriptionRecord.stripeSubscriptionId,
        {
          expand: ["latest_invoice.payment_intent"],
        }
      );

      // Get client secret from latest invoice
      clientSecret =
        stripeSubscription.latest_invoice?.payment_intent?.client_secret;

      // If no client secret and payment method provided, update subscription
      if (!clientSecret && paymentMethodId) {
        // Attach payment method to customer
        try {
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: stripeCustomerId,
          });
        } catch (err) {
          if (!err.message.includes("already been attached")) {
            throw err;
          }
        }

        // Update subscription with new payment method
        stripeSubscription = await stripe.subscriptions.update(
          subscriptionRecord.stripeSubscriptionId,
          {
            default_payment_method: paymentMethodId,
          }
        );

        // Get the latest invoice
        const invoices = await stripe.invoices.list({
          subscription: subscriptionRecord.stripeSubscriptionId,
          limit: 1,
        });

        if (invoices.data.length > 0) {
          const latestInvoice = await stripe.invoices.retrieve(
            invoices.data[0].id,
            {
              expand: ["payment_intent"],
            }
          );
          clientSecret = latestInvoice.payment_intent?.client_secret;
        }
      }
    }
    // Case 2: Subscription doesn't have Stripe subscription yet (pending_payment)
    else {
      if (!paymentMethodId) {
        return next(
          new AppError(
            "Payment method ID is required to create payment intent for new subscription",
            400
          )
        );
      }

      // Retrieve Stripe customer
      const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);

      // Attach payment method to customer
      try {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId,
        });
      } catch (err) {
        if (!err.message.includes("already been attached")) {
          throw err;
        }
      }

      // Set as default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Convert total price to cents
      const totalInCents = toCents(parseFloat(subscriptionRecord.totalPrice));

      // Create Stripe price
      const stripePrice = await stripe.prices.create({
        unit_amount: totalInCents,
        currency: "usd",
        recurring: {
          interval: "month",
        },
        product_data: {
          name: `Subscription for ${subscriptionRecord.machine.name}`,
          description: `Machine: ${subscriptionRecord.machine.name}`,
        },
      });

      // Create Stripe subscription
      stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: stripePrice.id }],
        default_payment_method: paymentMethodId,
        payment_behavior: "default_incomplete",
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
      });

      // Update subscription record with Stripe IDs
      await subscriptionRecord.update({
        stripeCustomerId: stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: stripePrice.id,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ),
      });

      // Get client secret
      clientSecret =
        stripeSubscription.latest_invoice?.payment_intent?.client_secret;
    }

    if (!clientSecret) {
      return next(
        new AppError(
          "Unable to retrieve payment intent. Please try again or contact support.",
          500
        )
      );
    }

    return res.status(200).json({
      success: true,
      subscriptionId: subscriptionRecord.id,
      stripeSubscriptionId:
        stripeSubscription?.id || subscriptionRecord.stripeSubscriptionId,
      stripeCustomerId: stripeCustomerId,
      clientSecret,
      status: stripeSubscription?.status || subscriptionRecord.status,
      totalPrice: subscriptionRecord.totalPrice,
      message:
        "Payment intent created successfully. Use clientSecret to confirm payment.",
    });
  } catch (error) {
    console.error("❌ Create payment intent error:", error);
    return next(
      new AppError(
        error.message || "Failed to create payment intent",
        error.statusCode || 500
      )
    );
  }
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
