const { supplier,order,salesRep,user,item,product } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
 const factory = require('../handlerFactory');
const { Op, literal, where, fn } = require('sequelize')
const APIFeatures = require('../../utils/apiFeatures');
const Stripe = require('../stripe');
 

//TODO creaete a model where we save that paymentintent and the amount update all order and add pulloutsId against them . pull out has status processiong we will add webhook if succeedd than status change orther wise set all order pulloutsId null so we can pull again 


exports.pullPaymentsFromPatnersBankAccounts = catchAsync(async (req, res, next) => {
  const patner = await salesRep.findOne({where:{id:req.params.srId }});

  const { amount , orderList} = req.body
  console.log("🚀 ~ exports.pullPaymentsFromPatnersBankAccounts=catchAsync ~ orderList:", orderList)

  const orderIds = orderList.map(order => order.id);

  if(!patner.defaultBankAccount){
    return next(new AppError('Payments can’t be pulled because the partner has no default bank account attached.', 400));
  }

  const pullouts = await Stripe.pullAmountPaymentIntentFromBankAccount(
    {amount,customerId:patner?.stripeCustomerId,savedPaymentMethodId:patner?.defaultBankAccount}
  )
    
  if(pullouts){
    order.update({adminReceivableStatus:true},{where:{id:orderIds}}) 
    for (const ele of orderList) {
      await order.update(
        {
          adminReceivableAmount: ele.adminReceivableAmount,
          localPatnerCommission: ele.localPatnerCommission
        },
        { where: { id: ele.id } }
      );
    }

  }

  res.status(200).json({
    status: 'success',
    data: {},
  });

});
 



const pullPaymentsFromPartnersBank = async ({ amount, orderList, patner }) => {
  try {
    console.log("🚀 ~ pullPaymentsFromPartnersBank ~ orderList:", orderList);

    const orderIds = orderList.map(order => order.id);

    // Step 1: Check if partner has a default bank account
    if (!patner?.defaultBankAccount) {
      throw new AppError('Payments can’t be pulled because the partner has no default bank account attached.', 400);
    }

    // Step 2: Pull amount from partner using Stripe Financial Connections
    const pullouts = await Stripe.pullAmountPaymentIntentFromBankAccount({
      amount,
      customerId: patner.stripeCustomerId,
      savedPaymentMethodId: patner.defaultBankAccount,
    });

    // Step 3: If payment successful, update orders
    if (pullouts) {
      // Set adminReceivableStatus true for all involved orders
      await order.update(
        { adminReceivableStatus: true },
        { where: { id: orderIds } }
      );

      // Update adminReceivableAmount and localPatnerCommission per order
      for (const ele of orderList) {
        await order.update(
          {
            adminReceivableAmount: ele.adminReceivableAmount,
            localPatnerCommission: ele.localPatnerCommission,
            proportionalStripeFee:0,
            grossPartnerAmount:ele.localPatnerCommission,
          },
          { where: { id: ele.id } }
        );
      }
    }

    return { success: true, pullouts };
  } catch (error) {
    console.error("❌ Error in pullPaymentsFromPartnersBank:", error);
    throw new AppError(error.message || 'Payment pulling failed.', 500);
  }
};

 
async function getOrdersForLocalPartner({localPatner}) {
  try {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const condition = {
    invoiceId: null,
    paymentMethodId: null,
    adminReceivableStatus: false,
    localPatnerCommission: 0.00,
    salesRepId: localPatner.id,
    statusId: {
      [Op.in]: [1,2,3,4, 5],
    },
    on: {
      [Op.lte]: oneMonthAgo, // only include orders from the past 1 month
    },
  };

    console.log("🚀 ~ getOrdersForLocalPartner ~ condition:", condition);

    const doc = await order.findAll({
      where: condition,
      include: [
        {
          model: item,
          attributes: [
            'id',
            [
              literal(`(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`),
              'product',
            ],
            'qty',
            'price',
            'discount',
            'orderId',
            'productId',
            'wholesalePrice',
          ],
        },
      ],
      attributes: [
        'id',
        [
          literal(`COALESCE(
            (SELECT SUM(salerCommission)
             FROM items
             WHERE items.orderId = order.id ), 0)`),
          'localPatnerCommission',
        ],
        [
          literal(`COALESCE(order.totalBill, 0) - COALESCE((
            SELECT SUM(salerCommission)
            FROM items
            WHERE items.orderId = order.id
          ), 0)`),
          'adminReceivableAmount',
        ],
      
        [
          literal(`COALESCE(
            (SELECT SUM(wholesalePrice)
             FROM items
             WHERE items.orderId = order.id ), 0)`),
          'wholesalePrice',
        ],
        'paymentStatus',
        'adminReceivableStatus',
        'shippingCharges',
      ],
    });

    if(!doc || doc.length < 1 ){
      console.log("🚀 ~ NOR ORDER ARE TEHRE TO PULL OUT MONEY FROM:", false)
      return false
    }

    const input = JSON.parse(JSON.stringify(doc));

// Calculate total adminReceivableAmount
    const totalAdminReceivableAmount = input.reduce((sum, order) => {
      const value = parseFloat(order.adminReceivableAmount) || 0;
      return sum + value;
    }, 0);

    pullPaymentsFromPartnersBank({amount:totalAdminReceivableAmount,orderList:input,patner:localPatner})
    
    return input.length;
  } catch (error) {
    console.error("❌ Error in getOrdersForLocalPartner:", error);
    throw new AppError(error.message, 500);
  }
}


async function processAllLocalPartners() {
  try {
    // Step 1: Get all active (non-deleted) sales reps
    const patners = await salesRep.findAll({ where: { deleted: 0 } });

    if (!patners || patners.length === 0) {
      console.log("❗ No local partners found.");
      return;
    }

    // Step 2: Loop through each partner and process their orders
    for (const ele of patners) {
      console.log(`🔄 Processing orders for local partner: ${ele?.srName || ele.id}`);

      // Call your order-fetching function
      const orders = await getOrdersForLocalPartner(ele.id);

      // Optional: log or handle the returned orders
      console.log(`✅ Found ${orders} orders for ${ele?.srName || ele.id}`);
    }

  } catch (error) {
    console.error("❌ Error in processAllLocalPartners:", error);
    throw new AppError(error.message, 500);
  }
}
