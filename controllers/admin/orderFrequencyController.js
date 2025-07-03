const { orderFrequency,order,item,address,orderHistory,user,salesRep,shippingCompanies } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const {nextFrequencyDate} = require('../../utils/nextFrequencyDate'); 
const factory = require('../handlerFactory');
const { Op, literal, fn, col } = require('sequelize');
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
    console.log('ðŸš€ ~ exports.onlineAppointmentConfirm= ~ error:', error)
  }
}




//* Pending order according to their frequency cycle

const { setOrderFrequency } = require('../admin/orderFrequencyController');
console.log(typeof setOrderFrequency); 
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
  console.log("🚀 ~ exports.bookNewOrder=catchAsync ~ input:", input)
  if (input?.items?.length < 1 ) {
   throw new AppError('Cart is empty add products to place order', 404);
  }

   const credit = await salesRep.findOne({
    where: {
      id: req.params.srId,
    },
    attributes:[ 
      'creditLimit',
      [
          
            literal(`
              (
                SELECT SUM(items.price)
                FROM orders
                JOIN items ON items.orderId = orders.id
                WHERE orders.salesRepId = salesRep.id
                  AND orders.createdBy = 'sales-rep' AND orders.paymentStatus = 'pending'
              )
            `),
          
          'creditUsed',
        ],]
  });

  let percentage = (credit.dataValues.creditUsed / credit.creditLimit) * 100
  console.log("---------------------------------creaditUed",credit.dataValues.creditUsed)
  console.log("---------------------------------creditLimit",credit.creditLimit)
  if(percentage >= 80) {
     throw new AppError(`You've used over 80% of your credit limit. Please clear your balance before placing further orders.`, 404);
  }
  input.order.statusId = 1
  input.order.salesRepId = req.params?.srId
  input.order.createdBy = "sales-rep"
  input.order.totalBill = parseFloat(input.order.totalBill) + parseFloat(input.order.shippingCharges)
  const newOrder = await order.create(input?.order);

  await orderHistory.create({
    statusId:1,
    orderId:newOrder.id,
    on: Date.now(),
  });

  input?.items.forEach((element) => {
    element.orderId = newOrder.id;
    element.price = element.price * element.qty
    element.wholesalePrice = element.wholesalePrice * element.qty
    element.weight = element.weight * element.qty
 
      element.salerCommission = parseFloat(element.price) - parseFloat(element.wholesalePrice)

  });
  await item.bulkCreate(input?.items);
  
  if(newOrder?.frequency != 'just-onces')setOrderFrequency({orderData:newOrder,salesRepId:req.params?.srId})

  orderEvents({orderId:newOrder?.id})
  
  return res.status(200).json({
    status: 'success',   
    data: {id:newOrder?.id},
  });
});




const frequencyBookOrder = async ({id}) => { //orderData is 
  let productsPrice = 0;
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
                `(SELECT products.wholesalePrice FROM products WHERE products.id = items.productId LIMIT 1)`
              ),
              'wholesalePrice',
            ],
            [
             literal(
               `(SELECT products.weight FROM products WHERE products.id = items.productId LIMIT 1)`
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
      //  [
      //    literal(
      //      `(SELECT orders.orderFrequencyId FROM orders WHERE orders.id = orderFrequency.orderId LIMIT 1)`
      //    ),
      //    'orderFrequencyId',
      //  ], 
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
        'salesRepId',
      ],
    });
 
    const result = JSON.parse(JSON.stringify(doc));

    // let productsPrice = 0;
    let totalWeight = 0;

    result?.items.forEach(item => {
      productsPrice += parseFloat(item?.price) * item?.qty; // Multiply price by quantity
      totalWeight += parseFloat(item?.weight) * (item?.qty*1); // Multiply weight by 
      item.weight = parseFloat(item?.weight||0) * (item?.qty*1);
      item.price = parseFloat(item?.price) * (item?.qty*1);
     if(result?.salesRepId){
      item.salerCommission = (parseFloat(item?.price) * item?.qty) - (parseFloat(item?.wholesalePrice) * item?.qty) ; // Multiply weight by quantity
     }else{
      item.wholesalePrice = 0
     }
    });

    const shippingCompany = await shippingCompanies.findOne({
      where: {
        weightFrom: {
          [Op.lte]: totalWeight, // Less than or equal to the weight
        },
        weightTo: {
          [Op.gte]: totalWeight, // Greater than or equal to the weight
        },
      },
      attributes:['charges']
    });
    result.shippingCharges =  shippingCompany?.charges || 0
    
    console.log("🚀 ~ frequencyBookOrder ~ productsPrice:", productsPrice)
    console.log("🚀 ~ frequencyBookOrder ~ result:", result)
    // result.itemsPrice = productsPrice
    result.subTotal = productsPrice + parseFloat(result?.vat)
    result.totalBill = productsPrice + parseFloat(result?.vat || 0) + parseFloat(shippingCompany?.charges|| 0)
    result.totalWeight = totalWeight
    result.statusId = 1
    result.salesRepId = result?.salesRepId
    result.createdBy = 'sales-rep'
    
    
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
    
    console.log("ðŸš€ ~ frequencyBookOrder ~ result:", result)
 
  } catch (error) {
   console.log("ðŸš€ ~ exports.frequencyBookOrder = ~ error:", error)
  }
 };
 

exports.bookOrderAccordingToFrequency = catchAsync(async (req, res, next) => {
  const { ids } = req.body;

  if (!ids || ids.length === 0) {
    return next(new AppError('No IDs provided!', 400));
  }
  //!USED IN LAMDA FUNCTION
//  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

// const pendingOrder = await orderFrequency.findAll({
//   where: { nextOrderDate: today },
//   attributes:['id']
// });


  ids.forEach(id => {
    frequencyBookOrder({ id }) 
  }); 

  res.status(200).json({
    status: 'success',
    message: 'Orders booked according to frequency successfully.',
  });
});