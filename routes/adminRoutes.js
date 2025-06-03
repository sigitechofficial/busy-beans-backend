const express = require('express');
const categoryController = require('../controllers/admin/categoriesController');
const addressController = require('../controllers/admin/addressController');
const productController = require('../controllers/admin/productController');
const authController = require('../controllers/admin/authController');
const manageOrderController = require('../controllers/admin/manageOrderController');
const customerController = require('../controllers/admin/customerController');
const orderFrequencyController = require('../controllers/admin/orderFrequencyController');
const supplierController = require('../controllers/admin/supplierController');
const salesRepController = require('../controllers/admin/salesRepController');
const multer = require('multer');
const path = require('path');
const { createDestinationDirectory } = require('../utils/customFunctions');
const router = express.Router();
// const protect = require('../middlewares/accessCheck');
router.post('/login', authController.adminLogin);
router.post('/login/sales-rep', authController.salesRepLogin);
router.post('/login/supplier', authController.supplierLogin);

const productsImage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = './public/products';

    // Call the function to create the destination directory
    createDestinationDirectory(destinationPath, cb);
  },
  filename: (req, file, cb) => {
    cb(null, `product-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const supplierImage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = './public/suppliers';

    // Call the function to create the destination directory
    createDestinationDirectory(destinationPath, cb);
  },
  filename: (req, file, cb) => {
    cb(null, `supplier-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const salesRepImage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = './public/sales-rep';

    // Call the function to create the destination directory
    createDestinationDirectory(destinationPath, cb);
  },
  filename: (req, file, cb) => {
    cb(null, `sales-rep-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const uploadProductImage = multer({
  storage: productsImage,
});

const uploadSupplierImage = multer({
  storage: supplierImage,
});

const uploadSalesRepImage = multer({
  storage: salesRepImage,
});

router.post(
  '/product',
  uploadProductImage.single('image'),
  productController.addProduct,
);
router.get('/product', productController.getAllProducts);

// Category by ID routes
router
  .route('/product/:id')
  .get(productController.getProduct) // For fetching a product by ID
  .delete(productController.deleteProduct) // For deleting a product by ID
  .patch(uploadProductImage.single('image'), productController.updateProduct); // For updating a product (including image upload)

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
router.get('/order-details/:id', manageOrderController.orderDetails);

router.patch('/assign-supplier', manageOrderController.orderJourneryComplete);

router.patch(
  '/supplier-acknowledgement',
  manageOrderController.orderJourneryComplete,
);

router.patch(
  '/order-dispatch',
  manageOrderController.orderJourneryComplete,
);

router.patch(
  '/order-deliver',
  manageOrderController.orderJourneryComplete,
);


router.patch(
  '/order-cancel',
  manageOrderController.orderJourneryComplete,
);

router.patch(
  '/edit-order',
  manageOrderController.orderJourneryComplete,
);

router.patch(
  '/add-cheque',
  manageOrderController.orderJourneryComplete,
);

router.patch(
  '/edit-cheque',
  manageOrderController.eidtCheque,
);

//! Customer Management
router.get(
  '/customer-management/dahboard-cards',
  customerController.viewCustomersManagement,
);
router.get(
  '/customer-management/customer-list/:condition',
  customerController.customersList,
);

router.get(
  '/customer-management/customer-list/sale-rep/:sr',
  customerController.customersList,
);

router.get(
  '/customer-management/customer-list/sale-rep-id/:srId',
  
  customerController.customersList,
);

router.patch(
  '/customer-management/assign-sale-rep/:id',
  customerController.assignSalesRep,
);

router.get(
  '/customer-management/invoice-customers-balance',
  customerController.InvoiceCustomers
);

router.get(
  '/order-frequency/upcomming-orders',
  orderFrequencyController.orderAccordingToFrequency
);

router.get(
  '/order-frequency/upcomming-orders/sale-rep/:srId',
  orderFrequencyController.orderAccordingToFrequency
);

router.post(
  '/order-frequency/book-orders',
  orderFrequencyController.bookOrderAccordingToFrequency,
);

router.post(
  '/order-frequency/book-orders/sale-rep/:srId',
  orderFrequencyController.bookOrderAccordingToFrequency,
)

router.post(
  '/send-quotation',
  salesRepController.sendQuotation,
)

router.post(
  '/sales-rep/book-new-order/:srId',
  orderFrequencyController.bookNewOrder,
)

router.post(
  '/add-customer/sales-rep/:srId',
  salesRepController.addCustomer,
)

router.post(
  '/add-customer/sales-rep/:srId',
  salesRepController.addCustomer,
)


router.get(
  '/sales-rep/sales/:srId',
  salesRepController.salersMoney,
)

router.post(
  '/create-stripe-connect-account/:srId',
  salesRepController.stripeConnectAccount,
)


router.post(
  '/stripe-connect-account-url/:srId',
  salesRepController.stripeConnectAccountLink,
)

//! Supplier Management

router
  .route('/supplier/')
  .get(supplierController.getAllSuppliers) // For fetching all categories
  .post(uploadSupplierImage.single('image'), supplierController.createSupplier); // For creating a new category

// Category by ID routes
router
  .route('/supplier/:id')
  .get(supplierController.getSupplier) // For fetching a category by ID
  .patch(uploadSupplierImage.single('image'), supplierController.updateSupplier) // For updating category by ID
  .delete(supplierController.deleteSupplier); // For deleting a category by ID

router
.route('/sales-rep/')
.get(salesRepController.getAllSalesRep) // For fetching all categories
.post(uploadSalesRepImage.single('image'), salesRepController.createSalesRep); // For creating a new category

// Category by ID routes
router
.route('/sales-rep/:id')
.get(salesRepController.getSalesRep)  
.patch(uploadSalesRepImage.single('image'), salesRepController.updateSalesRep)  
.delete(salesRepController.deleteSalesRep);  

//! Country Management
router
  .route('/address-management/country/')
  .get(addressController.getAllCountries) // For fetching all  
  .post(addressController.createCountry); // For creating a new  

// Category by ID routes
router
  .route('/address-management/country/:id')
  .get(addressController.getCountry) // For fetching a   by ID
  .patch(addressController.updateCountry) // For updating   by ID
  .delete(addressController.deleteCountry); // For deleting a   by ID


  //! State Management
router
.route('/address-management/state/')
.get(addressController.getAllStates) //  
.post(addressController.createState); // 
 
// Category by ID routes
router
.route('/address-management/state/:id')
.get(addressController.getState)  
.patch(addressController.updateState)  
.delete(addressController.deleteState);  

 //! City Management

router
.route('/address-management/city/')
.get(addressController.getAllCities) //  
.post(addressController.createCity); // 

// Category by ID routes
router
.route('/address-management/city/:id')
.get(addressController.getCity)  
.patch(addressController.updateCity)  
.delete(addressController.deleteCity);  

 //! City Management

 router
 .route('/address-management/city/')
 .get(addressController.getAllCities) //  
 .post(addressController.createCity); // 
 
 // Category by ID routes
 router
 .route('/address-management/city/:id')
 .get(addressController.getCity)  
 .patch(addressController.updateCity)  
 .delete(addressController.deleteCity);  
 
 //! City Management

 router
 .route('/address-management/territory/')
 .get(addressController.getAllTerritory) //  
 .post(addressController.createTerritory); // 
 
 // Category by ID routes
 router
 .route('/address-management/territory/:id')
 .get(addressController.getTerritory)  
 .patch(addressController.updateTerritory)  
 .delete(addressController.deleteTerritory);  
 
router.patch(
  '/address-management/add-cities-in-territory/:t_id',
  addressController.addCitiesInTerritory,
)

module.exports = router;
