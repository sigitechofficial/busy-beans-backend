const { supplier,order,salesRep,user,item } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
 
const { Op, literal, where, fn } = require('sequelize')
 
exports.partnerCommissionReport = catchAsync(async (req, res, next) => {
const doc = await salesRep.findAll({
    attributes: [
      'id', 
      'srName',
      [
        fn(
          'FORMAT',
          literal(
            `(SELECT SUM(orders.itemsPrice) FROM orders WHERE orders.salesRepId = salesRep.id  AND orders.createdBy = 'sales-rep')`,
          ),
          1,
        ),
        'totalSales',
      ],
     [
        fn(
          'FORMAT',
          literal(`
            (
              SELECT SUM(items.wholesalePrice)
              FROM orders
              JOIN items ON items.orderId = orders.id
              WHERE orders.salesRepId = salesRep.id
                AND orders.createdBy = 'sales-rep'
            )
          `),
          1
        ),
        'wholesalePriceCost',
      ],
       [
        fn(
          'FORMAT',
          literal(`
            (
              SELECT SUM(items.price - items.wholesalePrice)
              FROM orders
              JOIN items ON items.orderId = orders.id
              WHERE orders.salesRepId = salesRep.id
                AND orders.createdBy = 'sales-rep'
            )
          `),
          1
        ),
        'totalCommission'
      ],
      [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id AND orders.createdBy = 'sales-rep')`,
        ),
        'ordersPlaced',
      ],
      
    ],
  });
 
  res.status(200).json({
    status: 'success',
    data: doc,
  });

});

 
exports.partnerCreaditLimit = catchAsync(async (req, res, next) => {

  const doc = await salesRep.findAll({
      attributes: [
        'id', 
        'srName',
        'creditLimit',
      [
          fn(
            'FORMAT',
            literal(`
              (
                SELECT SUM(items.wholesalePrice)
                FROM orders
                JOIN items ON items.orderId = orders.id
                WHERE orders.salesRepId = salesRep.id
                  AND orders.createdBy = 'sales-rep' AND orders.paymentStatus = 'pending'
              )
            `),
            1
          ),
          'creditUsed',
        ],
        
      ],
    });


 
  res.status(200).json({
    status: 'success',
    data: doc,
  });

});


 
exports.unpaidPartnerbalanceReport = catchAsync(async (req, res, next) => {

  const doc = await salesRep.findAll({
      attributes: [
        'id', 
        'srName',
      [
          fn(
            'FORMAT',
            literal(`
              (
                SELECT SUM(items.wholesalePrice)
                FROM orders
                JOIN items ON items.orderId = orders.id
                WHERE orders.salesRepId = salesRep.id
                  AND orders.createdBy = 'sales-rep' AND orders.adminReceivableStatus = false
              )
            `),
            1
          ),
          'outstandingBalance',
        ],
        [
        literal(
          `(SELECT COUNT(*) FROM orders WHERE orders.salesRepId = salesRep.id AND orders.createdBy = 'sales-rep' AND orders.adminReceivableStatus = false)`,
        ),
        'ordersOnCredit',
      ],
        
      ],
    }); 
  res.status(200).json({
    status: 'success',
    data: doc,
  });

});