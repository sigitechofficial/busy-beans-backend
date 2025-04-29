const { orderFrequency,order,item } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const {nextFrequencyDate} = require('../../utils/nextFrequencyDate');
const factory = require('../handlerFactory');

exports.setOrderFrequency = async (orderData) => { //orderData is 
  try {
    if(!orderData) return false 
   const input  = JSON.parse(JSON.stringify(orderData))

   input.orderId = orderData.id
   input.orderId = orderData.id
   input.orderDate = new Date()
   input.nextOrderDate = nextFrequencyDate({currentDate:new Date(),frequency:input.frequency})
 
    const frequency = await orderFrequency.create(input);
    order.update({orderFrequencyId : frequency?.id},{where:{id:orderData?.id}})
    item.update({orderFrequencyId : frequency?.id},{where:{orderId:orderData?.id}})

    return true
  } catch (error) {
    console.log('🚀 ~ exports.onlineAppointmentConfirm= ~ error:', error)
  }
}
exports.getAllSuppliers = factory.getAll(supplier);
 
