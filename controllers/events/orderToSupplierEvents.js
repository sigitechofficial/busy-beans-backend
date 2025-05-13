 
const supplierNewOrder = require('../../helper/supplierNewOrder')
const {
dataForEmailAndNotifications
} = require('../../utils/emailsNotificationsData')

exports.supplierNewOrderEvent = async ({orderId}) => {
  try {
    const orderData = await dataForEmailAndNotifications(orderId)
    if (!orderData) return false
    const { detail } = orderData

    if (orderData?.email) {
      supplierNewOrder({
       email: orderData?.email,
       data: detail,
       stage: 'Confirmed',
      })
    }
   

    // const customerNotification = {
    //   title: `Appointment Cancellation`,
    //   body: `We regret to inform you that your appointment on ${dateTime} has been cancelled. Please contact us to reschedule.`,
    // }

    // const fullName = `${appointment.user.firstName} ${appointment.user.lastName}`

    // const salonNotification = {
    //   title: `Booking Cancellation Alert`,
    //   body: `The appointment with ${fullName} on ${dateTime} has been cancelled.`,
    // }
 
    // ThrowNotification(
    //   customerTokens,
    //   customerNotification,
    //   {
    //     appointment: appointment.id,
    //     name: orderData.salon.salonName,
    //     image: orderData.salon.image,
    //   },
    //   orderData?.client?.userId,
    // )

    console.log('🚀 ~~~~~ eventDrivenCommunication ~~~~~~~ 🚀')
    return true
  } catch (error) {
    console.log('🚀 ~ exports.supplierNewOrder= ~ error:', error)
  }
}

 