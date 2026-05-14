const { DataTypes, Sequelize } = require("sequelize");

module.exports = (sequelize) => {
  const order = sequelize.define("order", {
    totalBill: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    subTotal: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    discountPrice: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    discountPercentage: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    itemsPrice: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    vat: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    totalWeight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // company Details
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    poNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invoiceNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentMethodId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentIntentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentStatus: {
      type: DataTypes.ENUM("pending", "done"),
      allowNull: true,
      defaultValue: "pending",
    },
    orderStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    trackingNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shippingCompany: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    frequency: {
      type: DataTypes.ENUM(
        "just-onces",
        "weekly",
        "every-two-weeks",
        "every-four-weeks",
      ),
      allowNull: true,
      defaultValue: "just-onces",
    },
    on: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      defaultValue: Sequelize.NOW,
    },
    createdBy: {
      type: DataTypes.ENUM("customer", "sales-rep", "admin"),
      allowNull: false,
      defaultValue: "customer",
    },
    invoiceId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hostedInvoiceUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invoicePdf: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Payment link (checkout session) tracking – when customer requests "pay online" URL
    paymentLinkOpenCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    paymentLinkFirstOpenedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paymentLinkLastOpenedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    invoiceEmailSentCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    supplierEmailSendCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    supplierEmailLastSentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    localPatnerCommission: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    adminReceivableAmount: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
    },
    adminReceivableStatus: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    shippingCharges: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    shippedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billingAddress: {
      type: DataTypes.STRING(),
      allowNull: true,
    },
    grossPartnerAmount: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    proportionalStripeFee: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    invoiceReminder: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    invoicePaidDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    pulloutDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    termDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 30,
    },
    pulloutIntentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pulloutIntentIdSynced: {
      type: DataTypes.ENUM("not-eligible", "eligible", "synced"),
      allowNull: false,
      defaultValue: "not-eligible",
    },
    quickBooksInvoiceId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    quickBooksInvoiceIdPartner: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    qboLastSync: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paymentSyncedToQBO: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    quickBooksPaymentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    quickBooksPaymentIdPartner: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    partnerRealmId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    adminRealmId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("direct-invoice", "regular-order"),
      allowNull: true,
      defaultValue: "regular-order",
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "employees",
        key: "id",
      },
    },
    employeeOf: {
      type: DataTypes.ENUM("admin", "direct-partner"),
      allowNull: true,
    },
    AppliedEmployeeCommisionPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    employeeCommisionAmount: {
      type: DataTypes.DECIMAL(20, 2),
      allowNull: true,
      defaultValue: 0,
    },
    employeeTransferId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    directPartnerEmployeePayoutId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    directPartnerEmployeePayoutStatus: {
      type: DataTypes.ENUM(
        "pending",
        "in_transit",
        "paid",
        "failed",
        "canceled",
      ),
      allowNull: true,
    },
    directPartnerEmployeePayoutFailureCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    directPartnerEmployeePayoutFailureMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    directPartnerEmployeePayoutCreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    directPartnerEmployeePayoutPaidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    directPartnerEmployeePayoutAttemptCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    directPartnerEmployeePayoutLastAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    directPartnerEmployeePayoutLastTriggerSource: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  // Hook to exclude deletedAt and updatedAt from query results
  // user.addHook('beforeFind', (options) => {
  //   if (options.attributes) {
  //     options.attributes.exclude = ['deletedAt', 'updatedAt'];
  //   }
  // });

  // // Hook to hash password before create or update
  // user.addHook('beforeCreate', async (input) => {
  //   if (input.password) {
  //     input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
  //   }
  // });

  // user.addHook('beforeUpdate', async (input) => {
  //   if (input.password) {
  //     input.password = await bcrypt.hash(input.password, 6); // Hash the password before saving
  //   }
  // });

  // Associations models
  order.associate = (models) => {
    order.hasMany(models.item);
    models.item.belongsTo(order);

    order.hasMany(models.orderHistory);
    models.orderHistory.belongsTo(order);

    order.hasOne(models.chequeDetail);
    models.chequeDetail.belongsTo(order);

    order.hasOne(models.orderFrequency);
    models.orderFrequency.belongsTo(order);

    order.hasOne(models.transfersToSalesRep);
    models.transfersToSalesRep.belongsTo(order);

    order.hasMany(models.emailLog, { foreignKey: "orderId" });
    models.emailLog.belongsTo(order, { foreignKey: "orderId" });

    order.belongsTo(models.employee, {
      foreignKey: "employeeId",
    });
  };

  return order;
};
