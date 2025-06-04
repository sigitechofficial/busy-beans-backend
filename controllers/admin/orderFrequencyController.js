const { orderFrequency,order,item,address,orderHistory } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const {nextFrequencyDate} = require('../../utils/nextFrequencyDate'); 
const factory = require('../handlerFactory');
const { Op, literal, fn, col } = require('sequelize');
const { setOrderFrequency } = require('../admin/orderFrequencyController');
const {orderEvents} = require('../events/orderEvents')

exports.setOrderFrequency = async ({orderData,salesRepId}) => { //orderData is 
  try {
    if(!orderData) return false 
   const input  = JSON.parse(JSON.stringify(orderData))

  const {nextOrderDate,visibilityDate} =  nextFrequencyDate({currentDate:new Date(),frequency:input.frequency}); 
   input.orderId = orderData.id
   input.orderId = orderData.id
   input.salesRepId = salesRepId
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
  if (req.params.srId) condition.salesRepId = req.params.srId;

  // Add visibilityDate condition
  condition.visibilityDate = {
    [Op.lte]: new Date(), // or moment().toDate()
  };

  const doc = await orderFrequency.findAll({
    where: {
      ...condition,
      nextOrderDate: {
        [Op.notIn]: literal(`
          (SELECT DATE(orders.on) FROM orders WHERE DATE(orders.on) = DATE(orderFrequency.nextOrderDate) AND orders.userId = orderFrequency.userId)
        `),
      },
    },
    include: [
      {
        model: item,
        attributes: [
          [
            literal(
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
            ),
            'product',
          ],
          [
            literal(
              `(SELECT products.price FROM products WHERE products.id = items.productId LIMIT 1)`
            ),
            'price',
          ],
          'qty',
          'productId',
        ],
      },
              {
        model: item,
        attributes: [
          [
            literal(
              `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
            ),
            'product',
          ],
          [
            literal(
              `(SELECT products.price FROM products WHERE products.id = items.productId LIMIT 1)`
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
          `(SELECT users.name FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`
        ),
        'customerName',
      ],
      [
        literal(
          `(SELECT users.email FROM users WHERE users.id = orderFrequency.userId LIMIT 1)`
        ),
        'email',
      ],
      'status',
      'orderDate',
      'nextOrderDate',
      'frequency',
      'visibilityDate',
    ],

  });

  res.status(200).json({
    status: 'success',
    data: {
      order: doc,
    },
  });
});

exports.bookNewOrder = catchAsync(async (req, res, next) => {

  const input = req.body;
  if (input?.items?.length < 1 ) {
   throw new AppError('Cart is empty add products to place order', 404);
  }
  input.order.statusId = 1
  input.order.salesRepId = req.params?.srId
  input.order.createdBy = "sales-rep"
  const newOrder = await order.create(input?.order);

  await orderHistory.create({
    statusId:1,
    orderId:newOrder.id,
    on: Date.now(),
  });

  input?.items.forEach((element) => {
    element.orderId = newOrder.id;
  });
  await item.bulkCreate(input?.items);
  
  if(newOrder.frequency != 'just-onces')setOrderFrequency({orderData:newOrder,salesRepId:req.params?.srId})

  orderEvents({orderId:newOrder?.id})
  
  return res.status(200).json({
    status: 'success',   
    data: {id:newOrder?.id},
  });
});




const frequencyBookOrder = async ({id}) => { //orderData is 
  try {
    const doc = await orderFrequency.findByPk(id,{
      include: [
        {
          model: item,
          attributes: [
            [
              literal(
                `(SELECT products.name FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              'product',
            ],
            [
              literal(
                `(SELECT products.price FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              'price',
            ],
            [
             literal(
               `(SELECT products.quantity FROM products WHERE products.id = items.productId LIMIT 1)`
             ),
             'weight',
           ],
            'qty',
            'productId',
          ],
        },
      ],
      attributes: [
        ['id','orderFrequencyId'],
        [
         literal(
           `(SELECT orders.addressId FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
         ),
         'addressId',
       ], 
       [
         literal(
           `(SELECT orders.orderFrequencyId FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
         ),
         'orderFrequencyId',
       ], 
        [
         literal(
           `(SELECT orders.paymentMethodId FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
         ),
         'paymentMethodId',
       ], 
       [
         literal(
           `(SELECT orders.paymentMethod FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
         ),
         'paymentMethod',
       ],
       [
         literal(
           `(SELECT orders.on FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
         ),
         'on',
       ],
       [
         literal(
           `(SELECT orders.vat FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
         ),
         'vat',
       ], 
        ['nextOrderDate','on'],
        'frequency',
        'userId',
      ],
    });
 
    const result = JSON.parse(JSON.stringify(doc));

    let itemsPrice = 0;
    let totalWeight = 0;

    result?.items.forEach(item => {
      itemsPrice += parseFloat(item?.price) * item?.qty; // Multiply price by quantity
      totalWeight += parseFloat(item?.weight) * item?.qty; // Multiply weight by quantity
    });

    result.itemsPrice = itemsPrice
    result.subTotal = itemsPrice + parseFloat(result?.vat)
    result.totalBill = itemsPrice + parseFloat(result?.vat)
    result.totalWeight = totalWeight
    result.totalWeight = totalWeight
    result.statusId = 1
    
    const newOrder= await order.create(result)
    
    result?.items.forEach(item => {
      item.orderId = newOrder.id
    });
    
    item.bulkCreate(result.items)
    
    orderHistory.create({
      statusId:1,
      orderId:newOrder?.id,
      on: Date.now(),
    });
    
    const {nextOrderDate,visibilityDate} =  nextFrequencyDate({currentDate:result?.on,frequency:result.frequency}); 
    
    const updateFrequencyData = {
      nextOrderDate,
      visibilityDate,
      orderDate:result?.on
    }
    
    orderFrequency.update(updateFrequencyData,{where:{id:id}})
    
    console.log("🚀 ~ frequencyBookOrder ~ result:", result)
 
  } catch (error) {
   console.log("🚀 ~ exports.frequencyBookOrder = ~ error:", error)
  }
 };
 

exports.bookOrderAccordingToFrequency = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  if (!ids || ids.length === 0) {
    return next(new AppError('No IDs provided!', 400));
  }
 
  ids.forEach(id => {
    frequencyBookOrder({ id }) 
  }); 

  res.status(200).json({
    status: 'success',
    message: 'Orders booked according to frequency successfully.',
  });
});