const Stripe = require("stripe");
const { Sequelize } = require("sequelize");
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

  // 3. Validate addons
  // Check that "extra" type addons don't have addonId
  const extraTypeAddons = addons.filter((a) => a.type === "extra");
  for (const extraAddon of extraTypeAddons) {
    if (extraAddon.addonId != null) {
      return next(
        new AppError(
          `addonId should not be provided for addons of type "extra". Addon "${extraAddon.name || "unnamed"}" has addonId: ${extraAddon.addonId}`,
          400
        )
      );
    }
  }

  // Validate addons of type "addon" (with addonId)
  const addonTypeAddons = addons.filter((a) => a.type === "addon");
  if (addonTypeAddons.length > 0) {
    const addonIds = addonTypeAddons
      .map((a) => a.addonId)
      .filter((id) => id != null); // Filter out null/undefined values

    // Check if all addonIds are provided
    if (addonIds.length !== addonTypeAddons.length) {
      return next(
        new AppError("addonId is required for addons of type 'addon'", 400)
      );
    }

    // Validate that all addonIds exist and are active
    const foundAddons = await addon.findAll({
      where: {
        id: addonIds,
        status: true,
        deleted: false,
      },
    });

    console.log("🔍 Addon Validation:", {
      requestedAddonIds: addonIds,
      foundAddonIds: foundAddons.map((a) => a.id),
      foundCount: foundAddons.length,
      requestedCount: addonIds.length,
    });

    if (foundAddons.length !== addonIds.length) {
      // Find which addonIds are missing
      const foundAddonIds = foundAddons.map((a) => a.id);
      const missingAddonIds = addonIds.filter(
        (id) => !foundAddonIds.includes(id)
      );
      console.error(
        "❌ Addon validation failed. Missing addon IDs:",
        missingAddonIds
      );
      return next(
        new AppError(
          `One or more add-ons not found or inactive. Missing addon IDs: ${missingAddonIds.join(", ")}`,
          400
        )
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
      // Separate "addon" type (with addonId) and "extra" type (without addonId)
      // Insert them separately to avoid MySQL foreign key constraint issues
      const addonTypeRecords = [];
      const extraTypeRecords = [];

      for (const addonItem of addons) {
        const record = {
          subscriptionId: newSubscription.id,
          type: addonItem.type,
          name: addonItem.name || null,
          quantity: addonItem.quantity,
          unitPrice: addonItem.unitPrice,
          totalPrice: addonItem.totalPrice,
        };

        if (addonItem.type === "addon") {
          // For "addon" type, addonId is required and should be valid
          if (!addonItem.addonId) {
            return next(
              new AppError(
                `addonId is required for addon type "addon" but was not provided`,
                400
              )
            );
          }
          record.addonId = addonItem.addonId;
          addonTypeRecords.push(record);
        } else if (addonItem.type === "extra") {
          // For "extra" type, store record for raw SQL insert with NULL addonId
          extraTypeRecords.push(record);
        }
      }

      console.log("📝 Creating subscription addons:", {
        addonType: addonTypeRecords.length,
        extraType: extraTypeRecords.length,
      });

      // Insert "addon" type records first (with valid addonIds)
      if (addonTypeRecords.length > 0) {
        try {
          await subscriptionAddon.bulkCreate(addonTypeRecords);
        } catch (error) {
          if (
            error.name === "SequelizeForeignKeyConstraintError" &&
            error.fields?.includes("addonId")
          ) {
            console.error(
              "❌ Foreign key constraint error for addonId:",
              error
            );
            const problematicAddonId = addonTypeRecords.find(
              (r) => r.addonId != null
            )?.addonId;
            return next(
              new AppError(
                `Invalid addon ID: ${problematicAddonId || "unknown"}. This addon does not exist in the database or is inactive.`,
                400
              )
            );
          }
          throw error;
        }
      }

      // Insert "extra" type records separately using raw SQL
      // Note: For "extra" type, addonId should be NULL (not from addons table)
      if (extraTypeRecords.length > 0) {
        try {
          // Use raw SQL to insert with explicit NULL for addonId
          const now = new Date().toISOString().slice(0, 19).replace("T", " ");
          const values = extraTypeRecords
            .map((record) => {
              const escapedName = record.name
                ? record.name.replace(/'/g, "''").replace(/\\/g, "\\\\")
                : "";
              return `('${record.subscriptionId}', NULL, '${record.type}', ${record.name ? `'${escapedName}'` : "NULL"}, ${record.quantity}, ${record.unitPrice}, ${record.totalPrice}, '${now}', '${now}')`;
            })
            .join(", ");

          const sql = `INSERT INTO \`subscriptionAddons\` (\`subscriptionId\`, \`addonId\`, \`type\`, \`name\`, \`quantity\`, \`unitPrice\`, \`totalPrice\`, \`createdAt\`, \`updatedAt\`) VALUES ${values}`;

          await subscriptionAddon.sequelize.query(sql);
        } catch (error) {
          console.error("❌ Error creating extra type addons:", error);
          // If foreign key constraint fails, provide helpful error message
          if (
            error.code === "ER_NO_REFERENCED_ROW_2" ||
            error.code === "ER_BAD_NULL_ERROR"
          ) {
            return next(
              new AppError(
                "Database schema issue: addonId column must allow NULL for 'extra' type addons. Please run the migration script to fix this: ALTER TABLE subscriptionAddons DROP FOREIGN KEY subscriptionaddons_ibfk_14; ALTER TABLE subscriptionAddons MODIFY COLUMN addonId INT NULL; ALTER TABLE subscriptionAddons ADD CONSTRAINT subscriptionaddons_ibfk_14 FOREIGN KEY (addonId) REFERENCES addons(id) ON DELETE CASCADE ON UPDATE CASCADE;",
                500
              )
            );
          }
          throw error;
        }
      }
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
    // Separate "addon" type (with addonId) and "extra" type (without addonId)
    // Insert them separately to avoid MySQL foreign key constraint issues
    const addonTypeRecords = [];
    const extraTypeRecords = [];

    for (const addonItem of addons) {
      const record = {
        subscriptionId: newSubscription.id,
        type: addonItem.type,
        name: addonItem.name || null,
        quantity: addonItem.quantity,
        unitPrice: addonItem.unitPrice,
        totalPrice: addonItem.totalPrice,
      };

      if (addonItem.type === "addon") {
        // For "addon" type, addonId is required and should be valid
        if (!addonItem.addonId) {
          return next(
            new AppError(
              `addonId is required for addon type "addon" but was not provided`,
              400
            )
          );
        }
        record.addonId = addonItem.addonId;
        addonTypeRecords.push(record);
      } else if (addonItem.type === "extra") {
        // For "extra" type, store record for raw SQL insert with NULL addonId
        extraTypeRecords.push(record);
      }
    }

    console.log("📝 Creating subscription addons:", {
      addonType: addonTypeRecords.length,
      extraType: extraTypeRecords.length,
    });

    // Insert "addon" type records first (with valid addonIds)
    if (addonTypeRecords.length > 0) {
      try {
        await subscriptionAddon.bulkCreate(addonTypeRecords);
      } catch (error) {
        if (
          error.name === "SequelizeForeignKeyConstraintError" &&
          error.fields?.includes("addonId")
        ) {
          console.error("❌ Foreign key constraint error for addonId:", error);
          const problematicAddonId = addonTypeRecords.find(
            (r) => r.addonId != null
          )?.addonId;
          return next(
            new AppError(
              `Invalid addon ID: ${problematicAddonId || "unknown"}. This addon does not exist in the database or is inactive.`,
              400
            )
          );
        }
        throw error;
      }
    }

    // Insert "extra" type records separately using raw SQL
    // Note: For "extra" type, addonId should be NULL (not from addons table)
    if (extraTypeRecords.length > 0) {
      try {
        // Use raw SQL to insert with explicit NULL for addonId
        const now = new Date().toISOString().slice(0, 19).replace("T", " ");
        const values = extraTypeRecords
          .map((record) => {
            const escapedName = record.name
              ? record.name.replace(/'/g, "''").replace(/\\/g, "\\\\")
              : "";
            return `('${record.subscriptionId}', NULL, '${record.type}', ${record.name ? `'${escapedName}'` : "NULL"}, ${record.quantity}, ${record.unitPrice}, ${record.totalPrice}, '${now}', '${now}')`;
          })
          .join(", ");

        const sql = `INSERT INTO \`subscriptionAddons\` (\`subscriptionId\`, \`addonId\`, \`type\`, \`name\`, \`quantity\`, \`unitPrice\`, \`totalPrice\`, \`createdAt\`, \`updatedAt\`) VALUES ${values}`;

        await subscriptionAddon.sequelize.query(sql);
      } catch (error) {
        console.error("❌ Error creating extra type addons:", error);
        // If foreign key constraint fails, provide helpful error message
        if (
          error.code === "ER_NO_REFERENCED_ROW_2" ||
          error.code === "ER_BAD_NULL_ERROR"
        ) {
          return next(
            new AppError(
              "Database schema issue: addonId column must allow NULL for 'extra' type addons. Please run the migration script to fix this: ALTER TABLE subscriptionAddons DROP FOREIGN KEY subscriptionaddons_ibfk_14; ALTER TABLE subscriptionAddons MODIFY COLUMN addonId INT NULL; ALTER TABLE subscriptionAddons ADD CONSTRAINT subscriptionaddons_ibfk_14 FOREIGN KEY (addonId) REFERENCES addons(id) ON DELETE CASCADE ON UPDATE CASCADE;",
              500
            )
          );
        }
        throw error;
      }
    }
  }

  console.log("✅ Subscription saved to database:", newSubscription.id);

  // 11. Get client secret for frontend
  const clientSecret =
    stripeSubscription.latest_invoice?.payment_intent?.client_secret;

  // 12. Send email if subscription requires 3D Secure authentication (incomplete status)
  if (stripeSubscription.status === "incomplete" && clientSecret) {
    console.log(
      "📧 Subscription requires 3D Secure authentication. Sending payment completion email..."
    );

    // Get subscription with all associations for email
    const subscriptionWithDetails = await subscription.findByPk(
      newSubscription.id,
      {
        include: [
          { model: coffeeMachine, as: "machine" },
          {
            model: product,
            as: "products",
            through: {
              attributes: ["sku", "quantity", "unitPrice", "totalPrice"],
            },
          },
          {
            model: addon,
            as: "addons",
            through: {
              attributes: [
                "type",
                "name",
                "quantity",
                "unitPrice",
                "totalPrice",
              ],
            },
          },
        ],
      }
    );

    // Prepare products and addons for email
    // Note: Sequelize accesses through model data using the model name
    // The through model is "subscriptionProduct", so access via .subscriptionProduct (lowercase)
    const emailProducts =
      subscriptionWithDetails.products
        ?.map((prod) => {
          // Access through data - Sequelize uses lowercase model name for through associations
          // Try multiple possible property names in order
          const throughData =
            prod.subscriptionProduct ||
            prod.SubscriptionProduct ||
            prod.dataValues?.subscriptionProduct;

          if (!throughData) {
            console.warn(
              `⚠️ No through data found for product ${prod.id}. Available keys:`,
              Object.keys(prod)
            );
            return null;
          }
          return {
            productId: prod.id,
            sku: throughData.sku || prod.sku,
            quantity: throughData.quantity,
            unitPrice: throughData.unitPrice,
            totalPrice: throughData.totalPrice,
          };
        })
        .filter(Boolean) || [];

    const emailAddons =
      subscriptionWithDetails.addons
        ?.map((addonItem) => {
          // Access through data - Sequelize uses lowercase model name for through associations
          // Try multiple possible property names in order
          const throughData =
            addonItem.subscriptionAddon ||
            addonItem.SubscriptionAddon ||
            addonItem.dataValues?.subscriptionAddon;

          if (!throughData) {
            console.warn(
              `⚠️ No through data found for addon ${addonItem.id}. Available keys:`,
              Object.keys(addonItem)
            );
            return null;
          }
          return {
            addonId: addonItem.id || null,
            type: throughData.type,
            name: throughData.name || addonItem.name || null,
            quantity: throughData.quantity,
            unitPrice: throughData.unitPrice,
            totalPrice: throughData.totalPrice,
          };
        })
        .filter(Boolean) || [];

    // Send 3D Secure payment completion email
    await sendSubscriptionInvitationEmail({
      data: {
        customerEmail,
        userName,
        subscriptionId: newSubscription.id,
        machine: subscriptionWithDetails.machine,
        products: emailProducts,
        addons: emailAddons,
        machinePrice: machinePrice || 0,
        productsTotal: productsTotal || 0,
        addonsTotal: addonsTotal || 0,
        totalPrice: calculatedTotal,
        subscriptionDays,
        requires3DSecure: true, // Flag to indicate 3D Secure email
      },
    });

    console.log(
      "✅ 3D Secure payment completion email sent to:",
      customerEmail
    );
  }

  // 13. Return response
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
    requiresAction:
      stripeSubscription.status === "incomplete" && !!clientSecret,
    message:
      stripeSubscription.status === "incomplete" && clientSecret
        ? "Subscription created but requires 3D Secure authentication. Payment completion email sent to customer."
        : stripeSubscription.status === "active"
          ? "Subscription created and payment processed successfully!"
          : "Subscription created successfully.",
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
  // Accept paymentMethodId from query (GET) or body (POST/PUT)
  const paymentMethodId =
    req.body?.paymentMethodId || req.query?.paymentMethodId;

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
  if (
    !allowedStatuses.includes(subscriptionRecord?.status || "pending_payment")
  ) {
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
      const { addCustomer } = require("../stripe");
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

      // If subscription is incomplete (3D Secure required), we need to return the existing clientSecret
      // The frontend should use this to confirm payment with stripe.confirmCardPayment(), NOT create a setup intent
      if (
        subscriptionRecord.status === "incomplete" ||
        stripeSubscription.status === "incomplete"
      ) {
        // If clientSecret wasn't found via expand, try to retrieve it from the latest invoice manually
        if (!clientSecret) {
          console.log(
            "⚠️ ClientSecret not found in expanded invoice, retrieving from latest invoice..."
          );
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

        // If we have a clientSecret, return it for 3D Secure confirmation
        if (clientSecret) {
          console.log(
            `✅ Subscription is incomplete. Returning existing payment intent clientSecret for 3D Secure confirmation.`
          );

          // Check if subscription has a payment method attached
          let hasPaymentMethod = !!(
            stripeSubscription.default_payment_method ||
            stripeSubscription.default_source
          );

          // Also check payment intent for payment method
          let paymentMethodId = null;
          if (stripeSubscription.latest_invoice?.payment_intent) {
            const paymentIntent =
              stripeSubscription.latest_invoice.payment_intent;
            paymentMethodId = paymentIntent.payment_method;
            if (paymentMethodId) {
              hasPaymentMethod = true;
            }
          }

          // If not found in expanded data, retrieve payment intent directly
          if (!paymentMethodId && clientSecret) {
            try {
              // Extract payment intent ID from client secret
              const paymentIntentId = clientSecret.split("_secret_")[0];
              const paymentIntent =
                await stripe.paymentIntents.retrieve(paymentIntentId);
              paymentMethodId = paymentIntent.payment_method;
              if (paymentMethodId) {
                hasPaymentMethod = true;
              }
            } catch (err) {
              console.warn("Could not retrieve payment intent:", err.message);
            }
          }

          // Return immediately with clientSecret for 3D Secure confirmation
          // IMPORTANT: This is a PAYMENT INTENT clientSecret, NOT a setup intent
          // If payment method exists, use stripe.confirmCardPayment() directly (no payment sheet)
          // If no payment method, use Payment Element to collect card first
          return res.status(200).json({
            success: true,
            subscriptionId: subscriptionRecord.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: stripeCustomerId,
            status: stripeSubscription.status,
            clientSecret: clientSecret, // Payment Intent clientSecret for 3D Secure confirmation
            requiresAction: true,
            isPaymentIntent: true, // Explicitly mark this as a payment intent, not setup intent
            hasPaymentMethod: hasPaymentMethod, // Indicates if payment method is already attached
            paymentMethodId:
              paymentMethodId ||
              stripeSubscription.default_payment_method ||
              null, // Payment method ID if available
            setupIntentClientSecret: undefined, // Explicitly set to undefined to avoid confusion
            message: hasPaymentMethod
              ? "Payment method found. 3D Secure authentication required. Use stripe.confirmCardPayment() with existing payment method - NO payment sheet needed."
              : "Payment requires 3D Secure authentication. Use Payment Element to collect card, then confirm payment.",
            totalPrice: subscriptionRecord.totalPrice,
          });
        } else {
          // If no clientSecret found, this is unexpected for incomplete subscriptions
          console.warn(
            `⚠️ Subscription is incomplete but no clientSecret found. This might indicate a payment issue.`
          );
          return next(
            new AppError(
              "Unable to retrieve payment confirmation details. Please contact support.",
              500
            )
          );
        }
      }

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
      // If no paymentMethodId, create a setup intent for frontend to collect card
      if (!paymentMethodId) {
        // Create a setup intent that allows frontend to collect and save payment method
        const setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomerId,
          payment_method_types: ["card"],
          usage: "off_session", // For future payments
        });

        console.log(
          `✅ Created setup intent for customer ${stripeCustomerId} to collect payment method`
        );

        // Return setup intent client secret so frontend can collect card details
        return res.status(200).json({
          success: true,
          setupIntentClientSecret: setupIntent.client_secret,
          isPaymentIntent: false, // Explicitly mark this as a setup intent, not payment intent
          clientSecret: undefined, // Explicitly set to undefined to avoid confusion
          message:
            "Use the setupIntentClientSecret with Stripe Elements to collect card details. Then call this endpoint again with the paymentMethodId.",
          requiresPaymentMethod: true,
        });
      }

      // Validate paymentMethodId format
      if (
        typeof paymentMethodId !== "string" ||
        paymentMethodId.trim() === ""
      ) {
        return next(
          new AppError(
            "Invalid payment method ID format. Please provide a valid payment method ID.",
            400
          )
        );
      }

      // Retrieve Stripe customer
      const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);

      // Attach payment method to customer (this attaches the user's card)
      try {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomerId,
        });
        console.log(
          `✅ Attached payment method ${paymentMethodId} to customer ${stripeCustomerId}`
        );
      } catch (err) {
        if (!err.message.includes("already been attached")) {
          // If attach fails for other reasons, throw the error
          console.error(`❌ Failed to attach payment method: ${err.message}`);
          throw err;
        }
        console.log(
          `ℹ️ Payment method ${paymentMethodId} already attached to customer`
        );
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
        },
      });

      // Create Stripe subscription with the attached payment method
      // Stripe will attempt to charge immediately when default_payment_method is set
      // If 3D Secure is required, subscription will be incomplete and clientSecret will be available
      stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: stripePrice.id }],
        default_payment_method: paymentMethodId,
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

      // Get client secret for 3D Secure authentication if needed
      // If subscription is active, payment was successful and no clientSecret needed
      // If subscription is incomplete, clientSecret is needed for 3D Secure
      clientSecret =
        stripeSubscription.latest_invoice?.payment_intent?.client_secret;
    }

    // Prepare response based on subscription status
    const subscriptionStatus =
      stripeSubscription?.status || subscriptionRecord.status;
    const response = {
      success: true,
      subscriptionId: subscriptionRecord.id,
      stripeSubscriptionId:
        stripeSubscription?.id || subscriptionRecord.stripeSubscriptionId,
      stripeCustomerId: stripeCustomerId,
      status: subscriptionStatus,
      totalPrice: subscriptionRecord.totalPrice,
    };

    // Always include clientSecret if available (needed for 3D Secure confirmation)
    // For 3D Secure cards, subscription will be "incomplete" until payment is confirmed
    if (clientSecret) {
      response.clientSecret = clientSecret;
      response.isPaymentIntent = true; // Explicitly mark this as a payment intent
      response.setupIntentClientSecret = undefined; // Explicitly set to undefined to avoid confusion
      if (subscriptionStatus === "incomplete") {
        response.message =
          "Payment requires 3D Secure authentication. Use clientSecret with stripe.confirmCardPayment() to complete the payment. DO NOT use stripe.confirmSetup().";
        response.requiresAction = true;
      } else {
        response.message =
          "Subscription created. Payment confirmation may be required.";
      }
    } else if (subscriptionStatus === "active") {
      response.message =
        "Subscription created and payment processed successfully!";
    } else {
      response.message = "Subscription created successfully.";
    }

    return res.status(200).json(response);
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
 * Update subscription status after payment confirmation
 * POST /api/v1/users/subscription/:id/confirm-payment
 * Called after frontend confirms payment with stripe.confirmCardPayment()
 */
exports.confirmSubscriptionPayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Find subscription in database
  const subscriptionRecord = await subscription.findByPk(id);

  if (!subscriptionRecord) {
    return next(new AppError("Subscription not found", 404));
  }

  // If no Stripe subscription ID, can't sync
  if (!subscriptionRecord.stripeSubscriptionId) {
    return next(
      new AppError("Subscription does not have a Stripe subscription ID", 400)
    );
  }

  try {
    // Retrieve latest subscription status from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscriptionRecord.stripeSubscriptionId,
      {
        expand: ["latest_invoice.payment_intent"],
      }
    );

    // Update subscription status in database
    await subscriptionRecord.update({
      status: stripeSubscription.status,
      currentPeriodStart: new Date(
        stripeSubscription.current_period_start * 1000
      ),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });

    console.log(
      `✅ Subscription ${id} status updated to: ${stripeSubscription.status}`
    );

    return res.status(200).json({
      success: true,
      subscriptionId: subscriptionRecord.id,
      status: stripeSubscription.status,
      message:
        stripeSubscription.status === "active"
          ? "Payment confirmed! Subscription is now active."
          : `Subscription status: ${stripeSubscription.status}`,
    });
  } catch (error) {
    console.error("❌ Error syncing subscription status:", error);
    return next(
      new AppError(
        error.message || "Failed to sync subscription status",
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

  // Initialize default values for reactivation fields
  let reactivationAvailable = false;
  let cancelAtPeriodEnd = false;
  let scheduledCancelAt = null;

  // Fetch Stripe subscription if stripeSubscriptionId exists
  if (subscriptionRecord.stripeSubscriptionId) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscriptionRecord.stripeSubscriptionId
      );

      // Set cancelAtPeriodEnd from Stripe
      cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end === true;

      // Compute reactivationAvailable:
      // true only if status === "active" AND cancel_at_period_end === true
      // false for canceled, incomplete, past_due, unpaid, etc.
      if (
        stripeSubscription.status === "active" &&
        stripeSubscription.cancel_at_period_end === true
      ) {
        reactivationAvailable = true;
      } else {
        reactivationAvailable = false;
      }

      // Compute scheduledCancelAt:
      // Prefer cancel_at if set, otherwise use current_period_end when cancel_at_period_end === true
      if (stripeSubscription.cancel_at) {
        // cancel_at is a Unix timestamp in seconds
        scheduledCancelAt = new Date(
          stripeSubscription.cancel_at * 1000
        ).toISOString();
      } else if (
        stripeSubscription.cancel_at_period_end === true &&
        stripeSubscription.current_period_end
      ) {
        // current_period_end is a Unix timestamp in seconds
        scheduledCancelAt = new Date(
          stripeSubscription.current_period_end * 1000
        ).toISOString();
      } else {
        scheduledCancelAt = null;
      }
    } catch (error) {
      // If Stripe fetch fails, log but don't fail the entire request
      // The fields will remain as default values (false, null)
      console.error("❌ Error fetching Stripe subscription:", error.message);
    }
  }

  // Convert subscription record to JSON to allow modification
  const subscriptionData = subscriptionRecord.toJSON();

  // Add the new fields to the subscription data
  subscriptionData.reactivationAvailable = reactivationAvailable;
  subscriptionData.cancelAtPeriodEnd = cancelAtPeriodEnd;
  subscriptionData.scheduledCancelAt = scheduledCancelAt;

  return res.status(200).json({
    success: true,
    subscription: subscriptionData,
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
 * Reactivate subscription
 * POST /api/subscription/:id/reactivate
 * Reactivates a subscription that was scheduled to cancel at period end
 */
exports.reactivateSubscription = catchAsync(async (req, res, next) => {
  // Get subscriptionId from route param or body
  const subscriptionId = req.params.id || req.body.subscriptionId;

  // Basic validation
  if (!subscriptionId) {
    return next(new AppError("subscriptionId is required", 400));
  }

  // Find subscription in database
  const subscriptionRecord = await subscription.findByPk(subscriptionId);

  if (!subscriptionRecord) {
    return next(new AppError("Subscription not found", 404));
  }

  // Check if subscription has Stripe subscription ID
  if (!subscriptionRecord.stripeSubscriptionId) {
    return next(
      new AppError("Subscription does not have a Stripe subscription ID", 400)
    );
  }

  try {
    // Fetch the Stripe subscription by id
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscriptionRecord.stripeSubscriptionId
    );

    // Reactivation is allowed only if:
    // 1. subscription.status === "active" (still active)
    // 2. subscription.cancel_at_period_end === true (it's scheduled to cancel)
    const isActive = stripeSubscription.status === "active";
    const isScheduledToCancel =
      stripeSubscription.cancel_at_period_end === true;

    if (!isActive || !isScheduledToCancel) {
      // Return error with details including status and cancel_at_period_end
      return res.status(409).json({
        success: false,
        status: "conflict",
        message:
          "Subscription reactivation is not available at this point. Please create a new subscription.",
        details: {
          currentStatus: stripeSubscription.status,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          reason: !isActive
            ? "Subscription is not active"
            : "Subscription is not scheduled to cancel",
        },
      });
    }

    // Update the subscription to remove scheduled cancellation
    const updatedStripeSubscription = await stripe.subscriptions.update(
      subscriptionRecord.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    // Update database record if needed (optional - you may want to update status or clear canceledAt)
    await subscriptionRecord.update({
      status: "active",
      canceledAt: null,
    });

    console.log("✅ Subscription reactivated:", subscriptionId);

    // Return success response with updated subscription fields
    return res.status(200).json({
      success: true,
      message: "Subscription reactivated successfully",
      subscription: {
        id: subscriptionRecord.id,
        status: updatedStripeSubscription.status,
        cancel_at_period_end: updatedStripeSubscription.cancel_at_period_end,
        current_period_start: new Date(
          updatedStripeSubscription.current_period_start * 1000
        ),
        current_period_end: new Date(
          updatedStripeSubscription.current_period_end * 1000
        ),
      },
      stripeSubscription: {
        id: updatedStripeSubscription.id,
        status: updatedStripeSubscription.status,
        cancel_at_period_end: updatedStripeSubscription.cancel_at_period_end,
        current_period_start: new Date(
          updatedStripeSubscription.current_period_start * 1000
        ),
        current_period_end: new Date(
          updatedStripeSubscription.current_period_end * 1000
        ),
      },
    });
  } catch (error) {
    // Handle Stripe errors and return clean API error response
    console.error("❌ Error reactivating subscription:", error);

    // Check if it's a Stripe error
    if (error.type && error.type.startsWith("Stripe")) {
      return next(
        new AppError(
          `Stripe error: ${error.message || "Failed to reactivate subscription"}`,
          error.statusCode || 400
        )
      );
    }

    // Generic error
    return next(
      new AppError(
        error.message || "Failed to reactivate subscription",
        error.statusCode || 500
      )
    );
  }
});

/**
 * List all subscriptions
 * GET /api/subscription/list
 */
exports.listSubscriptions = catchAsync(async (req, res, next) => {
  const { customerEmail, status } = req.query;

  const where = {};

  // If user entity is 'user', filter by userId
  if (req.user?.entity === "user") {
    where.userId = req.user.id;
  }

  if (customerEmail) where.customerEmail = customerEmail;
  if (status) where.status = status;

  const subscriptions = await subscription.findAll({
    where,
    include: [
      {
        model: coffeeMachine,
        as: "machine",
        attributes: ["id", "image", "name"],
      },
      //   {
      //     model: addon,
      //     as: "addons",
      //     through: {
      //       attributes: ["type", "name", "quantity", "unitPrice", "totalPrice"],
      //     },
      //   },
      //   {
      //     model: product,
      //     as: "products",
      //     through: {
      //       attributes: ["sku", "quantity", "unitPrice", "totalPrice"],
      //     },
      //   },
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
