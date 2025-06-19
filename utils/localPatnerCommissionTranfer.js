const {
  order,
  orderHistory,
  item,
  transfersToSalesRep,
} = require('../models')
const { literal } = require('sequelize')
const { emailDateFormate } = require('./emailDateFormate')
const Stripe = require('../controllers/stripe'); 

exports.processTransferToLocalPartner  = async ({orderId}) => {
 try {
  const doc = await order.findOne({
    where: { id : orderId },
    attributes: [
      'id',
      [
        literal(`COALESCE(
         (SELECT SUM(salerCommission)
          FROM items
          WHERE items.orderId = order.id ), 0)`),
        'totalSalerCommission',
      ],
      [
        literal(
          `(SELECT users.email FROM users WHERE users.id = order.userId LIMIT 1)`,
        ),
        'email',
      ],
      [
        literal(
          `(SELECT salesReps.srName FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        'srName',
      ],
      [
        literal(
          `(SELECT salesReps.connectAccountId FROM salesReps WHERE salesReps.id = order.salesRepId LIMIT 1)`,
        ),
        'connectAccountId',
      ],
      'totalBill',
      'subTotal',
      'discountPrice',
      'discountPercentage',
      'itemsPrice',
      'vat',
      'totalWeight',
      'note',
      'paymentMethod',
      'poNumber',
      'frequency',
      'statusId',
      'trackingNumber',
      'paymentStatus',
      'on',
      'salesRepId',
      'adminReceivableStatus',
      'adminReceivableAmount',
      'localPatnerCommission',
      'invoicePdf',
      'invoiceId',
      'createdBy',
      'paymentMethodId',
      'paymentIntentId'
    ],
  });
  const output = JSON.parse(JSON.stringify(doc))
        
// Retrieve the connected account ID for the local partner
  if(output?.paymentIntentId || (output?.invoiceId && output.paymentStatus == 'done')) {
   
    const localPartnerAccount = output?.connectAccountId;
    const orderId = output?.id;
    const localPartnerId = output?.salesRepId
    if (localPartnerAccount) {
   // Transfer the amount to the local partner's account
      const transfer = await Stripe.transferToLocalPatners({
        amount: output.totalSalerCommission,
        localPartnerAccountId: localPartnerAccount,
       orderId:orderId,
      });

      // Create a record of the transfer in the transfersToSalesRep table
      await transfersToSalesRep.create({
        amount: output.totalSalerCommission, // Amount in cents (e.g., USD)
        tranferId: transfer?.id, // Stripe transfer ID
        salesRepId: localPartnerId,
        orderId: orderId,
      });

      // Update the order status and local partner's commission
      await order.update(
        {
          paymentStatus: 'done',
          localPatnerCommission: output.totalSalerCommission,
        },
        { where: { orderId } }
      );
    }
  
  }

    return true; 
  } catch (error) {
    console.error('Error processing transfer to local partner:', error);
    return false;
  }
}
