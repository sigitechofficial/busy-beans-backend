const express = require('express');
const authController = require('../controllers/customer/authController');
const orderController = require('../controllers/customer/orderController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

router.post('/book-order', orderController.bookOrder);

module.exports = router;
