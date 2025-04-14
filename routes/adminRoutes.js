const express = require('express');
const categoryController = require('../controllers/admin/categoriesController');
const productController = require('../controllers/admin/productController');
const authController = require('../controllers/admin/authController');
const manageOrderController = require('../controllers/admin/manageOrderController');
const customerController = require('../controllers/admin/customerController');
const supplierController = require('../controllers/admin/supplierController');
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
  .get(productController.getProduct) // For fetching a product by ID
  .delete(productController.deleteProduct) // For deleting a product by ID
  .patch(upload.single('image'), productController.updateProduct); // For updating a product (including image upload)

//! Category Management

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

//! Order Management

router.get('/orders', manageOrderController.allOrder);
router.patch('/assign-supplier', manageOrderController.assignSupplier);

//! Customer Management
router.get(
  '/customer-management/dahboard-cards',
  customerController.viewCustomersManagement,
);
router.get(
  '/customer-management/customer-list/:condition',
  customerController.customersList,
);

//! Supplier Management

router
  .route('/supplier/')
  .get(supplierController.getAllSuppliers) // For fetching all categories
  .post(supplierController.createSupplier); // For creating a new category

// Category by ID routes
router
  .route('/supplier/:id')
  .get(supplierController.getSupplier) // For fetching a category by ID
  .patch(supplierController.updateSupplier) // For updating category by ID
  .delete(supplierController.deleteSupplier); // For deleting a category by ID

module.exports = router;
