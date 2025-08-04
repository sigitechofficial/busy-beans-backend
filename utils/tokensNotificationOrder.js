const {
  order,
  orderHistory,
  item,
  address,
  user,
  salesRep,
  supplier,
  billingAddress,
  deviceToken,
} = require('../models');
const { literal } = require('sequelize');
const { emailDateFormate } = require('./emailDateFormate');

exports.tokensNotificationOrder = async (orderId) => {
  console.log(
    'ðŸš€ ~ exports.dataForEmailAndNotifications= ~ orderId:',
    orderId,
  );
  const doc = await order.findOne({
    where: { id: orderId },

    attributes: ['id', 'salesRepId', 'supplierId', 'userId'],
  });
  const output = JSON.parse(JSON.stringify(doc));
  console.log(
    'ðŸš€ ~ exports.dataForEmailAndNotifications= ~ output:',
    output.totalBill,
  );

  const tokenCondition = {
    [Op.or]: [
      { supplierId: output?.supperId },
      { salesRepId: output?.salesRepId },
      { accountId: 1 },
      { userId: output?.userId },
    ],
  };

  const dvtokens = await deviceToken.findAll({
    where: tokenCondition,
  });

  // Now split them into 4 arrays
  const adminTokens = dvtokens
    .filter((t) => t.accountId === 1)
    .map((t) => t.tokenId);

  const userTokens = dvtokens
    .filter((t) => t.userId === order.userId)
    .map((t) => t.tokenId);

  const supplierTokens = dvtokens
    .filter((t) => t.supplierId === order.supperId)
    .map((t) => t.tokenId);

  const salesRepTokens = dvtokens
    .filter((t) => t.salesRepId === order.salesRepId)
    .map((t) => t.tokenId);

  output.localPatnerCommission = await item.sum('salerCommission', {
    where: { orderId: output.id },
  });

  output.adminReceivableAmount =
    parseFloat(output?.totalBill || 0) -
    parseFloat(output.localPatnerCommission || 0);

  return {
    details: output,
    email: output?.email,
    adminTokens,
    userTokens,
    supplierTokens,
    salesRepTokens,
  };
};
