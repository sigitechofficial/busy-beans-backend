const { salesRep } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { sendQuotationEvent } = require('../events/sendQuotationEvents');

exports.getAllSalesRep = factory.getAll(salesRep);
exports.getSalesRep = factory.getOne(salesRep);
exports.createSalesRep = factory.createOne(salesRep);
exports.updateSalesRep = factory.updateOne(salesRep);
exports.deleteSalesRep = factory.deleteOne(salesRep);


exports.sendQuotation = catchAsync(async (req, res, next) => {
  sendQuotationEvent({email:req.body?.email,data:req.body?.order})
  return res.status(200).json({
    status: 'success',   
    data: {},
  });
});

