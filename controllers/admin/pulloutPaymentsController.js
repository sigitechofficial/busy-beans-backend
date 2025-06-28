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
 