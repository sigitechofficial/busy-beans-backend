const { salesRep,user,address,order,item,salesFromPatners} = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const Stripe = require('../stripe');
const factory = require('../handlerFactory');
const { sendQuotationEvent } = require('../events/sendQuotationEvents');
const { response } = require('../../utils/response');
const { Op, literal, fn, col } = require('sequelize');

exports.getAllSalesRep = factory.getAll(salesRep);
exports.getSalesRep = factory.getOne(salesRep);
exports.createSalesRep = factory.createOne(salesRep);
exports.updateSalesRep = factory.updateOne(salesRep);

exports.deleteSalesRep = catchAsync(async (req, res, next) => {
 
    await salesRep.update({deleted:true},{
      where: { id: req.params.id },
    });

    await user.update({salesRepId:null},{
      where: { salesRepId: req.params.id },
    });
    
  res.status(200).json({
    status: 'success',
    data: {},
  });
});

    
exports.addCustomer = catchAsync(async (req, res, next) => {
 
  req.body.info.verifiedAt = new Date();
  console.log("🚀 ~ exports.addCustomer=catchAsync ~ req.body:", req.body)
  req.body.info.salesRepId = req.params.srId
  req.body.info.createdBy = 'sales-rep'
  const newUser = await user.create(req.body?.info);

  req.body.address.userId = newUser?.id;
  const defaultAddress = await address.create(req.body?.address);
  
  console.log("🚀 ~ exports.signup=catchsasdsadasdasdasdsdAsync ~ req.body?.address:", defaultAddress)

  const stripeCustomerId = await Stripe.addCustomer({email:newUser?.email,name:newUser?.name})
  newUser.stripeCustomerId = stripeCustomerId
  await newUser.save()

  return res.status(200).json(
      response({
        data: {
          message: 'Customer added successfully.',
          data: {id:newUser.id},
        },
      }),
  );
  
});


exports.sendQuotation = catchAsync(async (req, res, next) => {
  console.log(req.body);
  
  req.body.order.items = req.body?.items
  sendQuotationEvent({email:req.body?.email,data:req.body?.order})
  return res.status(200).json({
    status: 'success',   
    data: {},
  });
});



exports.salersMoney = catchAsync(async (req, res, next) => {
const doc = await item.findOne({
  attributes: [
    [literal('SUM(`Item`.`price`)'), 'totalSales'],
    [literal('SUM(`Item`.`salerCommission`)'), 'salerCommission'],
    [literal('SUM(`Item`.`wholesalePrice`)'), 'wholesalePrice'],
    [literal('SUM(`Item`.`qty`)'), 'numberOfSoldProducts']
  ],
  include: [
    {
      model: order,
      where: { salesRepId: req.params.srId },
      attributes: []
    }
  ],
  raw: true,
});

   if (!doc) {
      return next(new AppError('Data not Found!', 404));
    }
const result = JSON.parse(JSON.stringify(doc))
const paidToAdmin = await salesFromPatners.sum('amount', {
  where: {
    salesRepId: req.params.srId,
  },
});

const toBePaid = parseFloat(result.wholesalePrice) - parseFloat(paidToAdmin || 0)


  // Return response
  res.status(200).json({
    status: 'success',
    data: {...doc,toBePaid , paidToAdmin : paidToAdmin||0},
  });

});