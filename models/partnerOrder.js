const { DataTypes, Sequelize } = require("sequelize");

module.exports = (sequelize) => {
  const partnerOrder = sequelize.define("partnerOrder", {
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
    partnerOrderStatus: {
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
        "every-four-weeks"
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
  partnerOrder.associate = (models) => {
    partnerOrder.hasMany(models.partnerOrderItem);
    models.partnerOrderItem.belongsTo(partnerOrder);

    partnerOrder.hasMany(models.orderHistory);
    models.orderHistory.belongsTo(partnerOrder);

    partnerOrder.hasOne(models.chequeDetail);
    models.chequeDetail.belongsTo(partnerOrder);
  };

  return partnerOrder;
};
