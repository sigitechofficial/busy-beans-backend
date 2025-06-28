const { order, item,orderHistory,orderFrequency,user,product } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const factory = require('../handlerFactory');
const { response } = require('../../utils/response');
const { setOrderFrequency } = require('../admin/orderFrequencyController');
const {orderEvents} = require('../events/orderEvents')
const {createPaymentIntent} = require('../stripe')
const { Op } = require("sequelize");
exports.bookOrder = catchAsync(async (req, res, next) => {
  const input = req.body;
  if (input?.items?.length < 1 ) {
   throw new AppError('Cart is empty add products to place order', 404);
  }
  const customer = await user.findOne({where:{id:input?.order?.userId},attributes:['salesRepId']})
  input.order.statusId = 1
  input.order.salesRepId = customer?.salesRepId
  let itemsPrice  = 0
  let totalWeight  = 0
  let productIds = input?.items.map(item => item.productId);
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ productIds:", productIds)
  const products = await product.findAll({
  where: {
    id: {
      [Op.in]: productIds
    }
  }
});
// return res.json(products)
  console.log("🚀 ~ exports.bookOrder=catchAsync ~ products:", products.length)
const finalItems = products.map((obj) => {
    const element = {};
    element.productId = obj.id;
    // console.log("🚀 ~ finalItems ~ obj:", obj)

    // Find the matching product in input.items based on productId
    let prod = input?.items.find(item => item.productId == obj.id);

    // Set the qty from input.items or default to 1 if not found
    let qty = prod ? parseInt(prod.qty) : 1;
    console.log("🚀 ~ finalItems ~ qty:", qty)
    element.qty =  qty;
    // Calculate price, wholesalePrice, and weight for the item
    element.price = obj.price * qty;
    element.wholesalePrice = obj.wholesalePrice * qty;
    element.weight = obj.weight * qty;

    // Accumulate the total weight and price
    itemsPrice += element.price;
    totalWeight += element.weight;

    // Handle salesRep commission if applicable
    if (customer?.salesRepId) {
        element.salerCommission = parseFloat(element.price) - parseFloat(element.wholesalePrice );
    } else {
        element.wholesalePrice = 0;
    }
    return element; // Return the transformed element
});

  
  input.order.itemsPrice = itemsPrice
  input.order.totalWeight = totalWeight
  input.order.subTotal = itemsPrice + input.order.vat
  input.order.totalBill = itemsPrice + input.order.vat
 
  const newOrder = await order.create(input?.order);

  await orderHistory.create({
    statusId:1,
    orderId:newOrder.id,
    on: Date.now(),
  });
 
  
  finalItems.forEach((element) => {
    element.orderId = newOrder.id;
  });

  await item.bulkCreate(finalItems);
  
  // if(newOrder.frequency != 'just-onces')setOrderFrequency({orderData:newOrder,salesRepId:customer?.salesRepId})

  // orderEvents({orderId:newOrder?.id})
  return res.status(200).json({
    status: 'success',   
    data: {id:newOrder?.id},
  });
});

exports.paymentIntent = catchAsync(async (req, res, next) => {
  const output = await createPaymentIntent(req.body.amount)
  return res.status(200).json({
    status: 'success',   
    data: output,
  });
});

