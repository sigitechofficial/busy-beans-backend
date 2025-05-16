 
const sendQuotation = require('../../helper/sendQuotation')
 
exports.sendQuotationEvent = async ({email,data}) => {
  try {
      sendQuotation({email:email,data:data})
    console.log('🚀 ~~~~~ eventDrivenCommunication sendQuotation~~~~~~~ 🚀')
    return true
  } catch (error) {
    console.log('🚀 ~ exports.sendQuotation = ~ error:', error)
  }
}

 