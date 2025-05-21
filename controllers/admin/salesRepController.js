const { salesRep,user } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { sendQuotationEvent } = require('../events/sendQuotationEvents');

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


exports.sendQuotation = catchAsync(async (req, res, next) => {
  sendQuotationEvent({email:req.body?.email,data:req.body?.order})
  return res.status(200).json({
    status: 'success',   
    data: {},
  });
});

