 
const connectStripeAccountLocalPatner = require('../../helper/connectStripeAccountLocalPatner')
const {salesRep} = require('../../models');
const Stripe = require('../stripe'); 

exports.connectStripeAccountEvent = async ({ patner, returnUrl }) => {
  try {
    console.log("🚀 ~ exports.connectStripeAccountEvent= ~ connectStripeAccountEvent:",patner.email)
    const connectAccount = await Stripe.createConnectAccount({
      email: patner.email,
      returnUrl: returnUrl,
    });
    console.log("🚀 ~ exports.connectStripeAccountEvent= ~ connectAccount:", connectAccount?.accountId)
    console.log("🚀 ~ exports.connectStripeAccountEvent= ~ patner.id:", patner.id)

    await salesRep.update({connectAccountId:connectAccount?.accountId},{where:{id:patner.id}}) 

    connectStripeAccountLocalPatner({
      email: patner.email,
      name: patner.srName,
      boardingLink: connectAccount.accountLink?.url, // Assumes this is returned by Stripe
    });

    console.log('🚀 ~~~~~ eventDrivenCommunication ~~~~~~~ 🚀');
    return true;
  } catch (error) {
    console.log('🚀 ~ connectStripeAccountEvent ~ error:', error);
    return false;
  }
};
 


 