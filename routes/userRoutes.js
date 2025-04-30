const express = require('express');
const authController = require('../controllers/customer/authController');
const orderController = require('../controllers/customer/orderController');
const manageOrderController = require('../controllers/admin/manageOrderController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/otp/verfication', authController.otpVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.post('/book-order', orderController.bookOrder);
router.get('/orders', manageOrderController.allOrder);
router.get('/order-details/:id', manageOrderController.orderDetails);

module.exports = router;
