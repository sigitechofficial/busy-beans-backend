const express = require('express');
const categoryController = require('../controllers/admin/categoriesController');
const productController = require('../controllers/admin/productController');
const authController = require('../controllers/admin/authController');
const multer = require('multer');
const path = require('path');
const { createDestinationDirectory } = require('../utils/customFunctions');
const router = express.Router();
// const protect = require('../middlewares/accessCheck');
router.post('/login', authController.login);

const serviceTypeImage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = './public/products';

    // Call the function to create the destination directory
    createDestinationDirectory(destinationPath, cb);
  },
  filename: (req, file, cb) => {
    cb(null, `product-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: serviceTypeImage,
});

router.post('/product', upload.single('image'), productController.addProduct);
router.get('/product', productController.getAllProducts);

// Category by ID routes
router
  .route('/product/:id')
  .get(productController.getProduct) // For fetching a category by ID
  .patch(productController.updateProduct) // For updating category by ID
  .delete(productController.deleteProduct); // For deleting a category by ID

router
  .route('/category/')
  .get(categoryController.getAllCatagories) // For fetching all categories
  .post(categoryController.createCatagory); // For creating a new category

// Category by ID routes
router
  .route('/category/:id')
  .get(categoryController.getCatagory) // For fetching a category by ID
  .patch(categoryController.updateCatagory) // For updating category by ID
  .delete(categoryController.deleteCatagory); // For deleting a category by ID

module.exports = router;
