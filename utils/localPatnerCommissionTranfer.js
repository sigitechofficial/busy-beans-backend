const { order, orderHistory, item, transfersToSalesRep } = require('../models');
const { literal } = require('sequelize');
const { emailDateFormate } = require('./emailDateFormate');
const Stripe = require('../controllers/stripe');

exports.processTransferToLocalPartner = async ({ orderId }) => {
  try {
    console.log(
      '🚀 ~ exports.processTransferToLocalPartner= ~ orderId:',
      orderId,
    );
    const doc = await order.findOne({
      where: { id: orderId },
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
        'paymentIntentId',
      ],
    });
    const output = JSON.parse(JSON.stringify(doc));

    console.log(
      '🚀 ~ exports.processTransferToLocalPartner= ~ output?.paymentIntentId :',
      output?.invoiceId,
    );
    console.log(
      '🚀 ~ exports.processTransferToLocalPartner= ~ output?.paymentIntentId:',
      output?.paymentIntentId,
    );
    // Retrieve the connected account ID for the local partner
    console.log(
      '🚀 ~ exports.processTransferToLocalPartner= ~ output.paymentStatus:',
      output.paymentStatus,
    );
    if (
      output?.paymentIntentId ||
      (output?.invoiceId && output.paymentStatus == 'done')
    ) {
      const localPartnerAccount = output?.connectAccountId;
      console.log(
        '🚀 ~ exports.processTransferToLocalPartner= ~ localPartnerAccount:',
        localPartnerAccount,
      );
      const orderId = output?.id;
      console.log(
        '🚀 ~ exports.processTransferToLocalPartner= ~ orderId:',
        orderId,
      );
      const localPartnerId = output?.salesRepId;
      console.log(
        '🚀 ~ exports.processTransferToLocalPartner= ~ localPartnerId:',
        localPartnerId,
      );
      console.log(
        '🚀 ~ exports.processTransferToLocalPartner= ~ localPartnerAccount:',
        localPartnerAccount,
      );
      if (localPartnerAccount) {
        // Transfer the amount to the local partner's account
        const transfer = await Stripe.transferToLocalPatners({
          amount: output.totalSalerCommission,
          localPartnerAccountId: localPartnerAccount,
          orderId: orderId,
          invoiceId: output.invoiceId,
          paymentIntentId: output.paymentIntentId,
        });
        console.log(
          '🚀 ~ exports.processTransferToLocalPartner= ~ transfer:',
          transfer.netPartnerAmount,
        );
        console.log(
          '🚀 ~ exports.proportionalStripeFee= ~ transfer:',
          transfer.proportionalStripeFee,
        );

        // Create a record of the transfer in the transfersToSalesRep table
        if (transfer.transfer) {
          await transfersToSalesRep.create({
            amount: transfer.netPartnerAmount,
            tranferId: transfer.transfer?.id, // Stripe transfer ID
            salesRepId: localPartnerId,
            orderId: orderId,
            proportionalStripeFee: transfer.proportionalStripeFee,
            grossPartnerAmount: output.totalSalerCommission,
          });
        }
        // Update the order status and local partner's commission
        await order.update(
          {
            paymentStatus: 'done',
            localPatnerCommission: transfer.netPartnerAmount,
            proportionalStripeFee: transfer.proportionalStripeFee,
            grossPartnerAmount: output.totalSalerCommission,
          },
          { where: { id: orderId } },
        );
      }
    }

    return true;
  } catch (error) {
    console.error('Error processing transfer to local partner:', error);
    return false;
  }
};
