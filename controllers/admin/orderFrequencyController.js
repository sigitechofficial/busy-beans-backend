const { orderFrequency,order,item,address } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const {nextFrequencyDate} = require('../../utils/nextFrequencyDate');
const factory = require('../handlerFactory');
const { Op, literal, fn, col } = require('sequelize');


exports.setOrderFrequency = async ({orderData}) => { //orderData is 
  try {
    if(!orderData) return false 
   const input  = JSON.parse(JSON.stringify(orderData))

  const {nextOrderDate,visibilityDate} =  nextFrequencyDate({currentDate:new Date(),frequency:input.frequency}); 
   input.orderId = orderData.id
   input.orderId = orderData.id
   input.orderDate = new Date()
   input.nextOrderDate = nextOrderDate
   input.visibilityDate = visibilityDate
 
    const frequency = await orderFrequency.create(input);
    order.update({orderFrequencyId : frequency?.id},{where:{id:orderData?.id}})
    item.update({orderFrequencyId : frequency?.id},{where:{orderId:orderData?.id}})

    return true
  } catch (error) {
    console.log('🚀 ~ exports.onlineAppointmentConfirm= ~ error:', error)
  }
}
 
 
//* Pending order according to their frequency cycle

exports.orderAccordingToFrequency = catchAsync(async (req, res, next) => {
  let condition = {};
  if (req.params.id) condition.id = req.params.id;
  
  console.log("🚀 ~ exports.allOrder=catchAsync ~ condition:", condition)

  const doc = await orderFrequency.findAll({
    where: condition,
    include: [

      {
        model: item,
        attributes: [
          [
            literal(
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            'product',
          ],
          [
            literal(
              `(SELECT products.price FROM products WHERE products.id = items.productId LIMIT 1)`,
            ),
            'price',
          ],
          'qty',  
          'productId',
        ],
      },
       
    ],
    attributes: [
      'id',
      [
        literal(
          `(SELECT users.name FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`,
        ),
        'customerName',
      ],
      [
        literal(
          `(SELECT users.email FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`,
        ),
        'email',
      ],
     `status`, `orderDate`, `nextOrderDate`, `frequency`,`visibilityDate`
    ],
  });
  res.status(200).json({
    status: 'success',
    data: {
      order: doc,
    },
  });
});
