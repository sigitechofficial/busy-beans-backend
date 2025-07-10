const express = require('express');
const router = express.Router();

// Example route
router.get('/pay-order-invoice', (req, res) => {
  res.render('pay'); // renders views/pay.ejs
});

router.get('/success', (req, res) => {
  res.render('success'); // renders views/pay.ejs
});

module.exports = router;
