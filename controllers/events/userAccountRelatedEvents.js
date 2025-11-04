const userAccountApprove = require('../../helper/userAccountApprove');
const userAccountCreated = require('../../helper/userAccountCreated');
const otpToUsers = require('../../helper/otpToUsers');
const otpToUsersForgotPassword = require('../../helper/otpToUsersForgotPassword');
const {
  dataForEmailAndNotifications,
} = require('../../utils/emailsNotificationsData');

exports.userAccountApproveEvent = async ({ email, name }) => {
  try {
    userAccountApprove({ email: email, name: name });
    console.log(
      '🚀 ~~~~~ eventDrivenCommunication userAccountApprove~~~~~~~ 🚀',
    );
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.userAccountApprove = ~ error:', error);
  }
};

exports.userAccountCreatedEvent = async ({ email, name }) => {
  try {
    userAccountCreated({ email: email, name: name });
    console.log(
      '🚀 ~~~~~ eventDrivenCommunication userAccountApprove~~~~~~~ 🚀',
    );
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.userAccountApprove = ~ error:', error);
  }
};

exports.otpToUsersEvent = async ({ email, name, otp }) => {
  try {
    otpToUsers({ email: email, name: name, otp: otp });
    console.log(
      '🚀 ~~~~~ eventDrivenCommunication userAccountApprove~~~~~~~ 🚀',
    );
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.userAccountApprove = ~ error:', error);
  }
};

exports.otpToUsersForgotPasswordEvent = async ({ email, name, otp }) => {
  try {
    otpToUsersForgotPassword({ email: email, name: name, otp: otp });
    console.log(
      '🚀 ~~~~~ eventDrivenCommunication userAccountApprove~~~~~~~ 🚀',
    );
    return true;
  } catch (error) {
    console.log('🚀 ~ exports.userAccountApprove = ~ error:', error);
  }
};
