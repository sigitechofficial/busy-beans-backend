const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const order = sequelize.define(
    'order',
    {
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
        type: DataTypes.INTEGER,
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
        type: DataTypes.DECIMAL(10, 1),
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
      paymentMethodId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentIntentId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      paymentStatus: {
        type: DataTypes.ENUM('pending', 'done'),
        allowNull: true,
        defaultValue: 'pending',
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
          'just-onces',
          'weekly',
          'every-two-weeks',
          'every-four-weeks',
        ),
        allowNull: true,
        defaultValue: 'just-onces',
      },
      on: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: new Date(),
      },
      
      createdBy: {
        type: DataTypes.ENUM('customer', 'sales-rep', 'admin'),
        allowNull: false,
        defaultValue: 'customer',
      },
      invoiceId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      hostedInvoiceUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      invoicePdf: {
        type: DataTypes.STRING,
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

    },
    {
      tableName: 'orders',
      primaryKey: true,
      autoIncrement: true,
      paranoid: true,
      timestamps: true,
    },
  );

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
  };

  return order;
};
