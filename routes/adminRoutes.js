const express = require("express");

const categoryController = require("../controllers/admin/categoriesController");
const addressController = require("../controllers/admin/addressController");
const productController = require("../controllers/admin/productController");
const authController = require("../controllers/admin/authController");
const manageOrderController = require("../controllers/admin/manageOrderController");
const customerController = require("../controllers/admin/customerController");
const orderFrequencyController = require("../controllers/admin/orderFrequencyController");
const supplierController = require("../controllers/admin/supplierController");
const salesRepController = require("../controllers/admin/salesRepController");
const adminReportsController = require("../controllers/admin/adminReportsController");
const supplierReportsController = require("../controllers/admin/supplierReportsController");
const salesRepReportsController = require("../controllers/admin/salesRepReportsController");
const dashboardsController = require("../controllers/admin/dashboardsController");
const shippingCompanyController = require("../controllers/admin/shippingCompanyController");
const employeeController = require("../controllers/admin/employeeController");
const adminController = require("../controllers/admin/adminController");
const patnerOrderController = require("../controllers/admin/partnerOrderController");

const pulloutPaymentsController = require("../controllers/admin/pulloutPaymentsController");

const multer = require("multer");
const path = require("path");
const { createDestinationDirectory } = require("../utils/customFunctions");
const auth = require("../middlewares/protect");
const { protect } = auth;
const router = express.Router();
// LAMDA FUNCTION

router.post(
  "/order-management/fetch-invoice/:orderId",
  manageOrderController.fetchInvoice
);

router.post(
  "/login",
  (req, res, next) => {
    req.params.entity = "admin";
    next();
  },
  authController.adminLogin
);
router.post(
  "/login/sales-rep",
  (req, res, next) => {
    req.params.entity = "localPartner";
    next();
  },
  authController.salesRepLogin
);
router.post(
  "/login/supplier",
  (req, res, next) => {
    req.params.entity = "supplier";
    next();
  },
  authController.supplierLogin
);

router.post("/forgot-password", authController.adminForgotPassword);
router.post(
  "/forgot-password/sales-rep",
  authController.salesRepForgotPassword
);
router.post("/forgot-password/supplier", authController.supplierForgotPassword);

router.post("/resend-otp", authController.adminResendOtp);
router.post("/resend-otp/sales-rep", authController.salesRepResendOtp);
router.post("/resend-otp/supplier", authController.supplierResendOtp);

router.post("/otp-verification", authController.adminOtpVerification);
router.post(
  "/otp-verification/sales-rep",
  authController.salesRepOtpVerification
);
router.post(
  "/otp-verification/supplier",
  authController.supplierOtpVerification
);

router.post("/reset-password", authController.adminResetPassword);
router.post("/reset-password/sales-rep", authController.salesRepResendOtp);
router.post("/reset-password/supplier", authController.supplierResetPassword);

router.get("/product", productController.getAllProducts);
router.post(
  "/lambda-function/pending-pullout-fromlocal-patner-banks",
  pulloutPaymentsController.processAllLocalPartnersForPaymentPullouts
);
router.post(
  "/lambda-function/create-upcomming-orders",
  orderFrequencyController.bookOrderAccordingToFrequencyLamdaFunction
);

//! Country Management
router.get("/address-management/country/", addressController.getAllCountries);
router.get("/address-management/country/:id", addressController.getCountry);

//! State Management
router.get("/address-management/state/", addressController.getAllStates);
router.get("/address-management/state/:id", addressController.getState);

//! City Management
router.get("/address-management/city/", addressController.getAllCities);
router.get("/address-management/city/:id", addressController.getCity);

//! Territory Management
router.get("/address-management/territory/", addressController.getAllTerritory);
router.get("/address-management/territory/:id", addressController.getTerritory);

// Create Employee (Admin or SalesRep can create employees)
router.post(
  "/employee",
  auth.protect,
  auth.restrictTo("admin", "localPartner"),
  employeeController.createEmployee
);
// routes/employeeRoutes.js
router.get(
  "/employee/:employeeId",
  auth.protect,
  auth.restrictTo("admin", "localPartner"),
  employeeController.getEmployee
);

router.get(
  "/employees",
  auth.protect,
  auth.restrictTo("admin", "localPartner"),
  employeeController.getAllEmployee
);
// routes/employeeRoutes.js
router.patch(
  "/employee/:employeeId",
  auth.protect,
  auth.restrictTo("admin", "localPartner"),
  employeeController.updateEmployee
);

// routes/employeeRoutes.js
router.delete(
  "/employee/:employeeId",
  auth.protect,
  auth.restrictTo("admin", "localPartner"),
  employeeController.deleteEmployee
);

// routes/employeeRoutes.js
router.put(
  "/employee/:employeeId",
  auth.protect,
  auth.restrictTo("admin", "salesRep"),
  employeeController.updateEmployee
);

router.get("/category/", categoryController.getAllCatagories);

//!MIDDLEWARE PRIVATE ROUTES
router.use(protect);

router.get(
  "/profile/",
  auth.restrictTo("admin", "salesRep"),
  adminController.getAdmin
);
router.patch(
  "/profile-update/:id",
  auth.restrictTo("admin", "salesRep"),
  adminController.updateAdmin
);
// router.get('/profile/', adminController.getAdmin);

const productsImage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = "./public/products";
    // Call the function to create the destination directory
    createDestinationDirectory(destinationPath, cb);
  },
  filename: (req, file, cb) => {
    cb(null, `product-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const supplierImage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = "./public/suppliers";

    // Call the function to create the destination directory
    createDestinationDirectory(destinationPath, cb);
  },
  filename: (req, file, cb) => {
    cb(null, `supplier-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const salesRepImage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = "./public/sales-rep";

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
  "/product",
  uploadProductImage.single("image"),
  productController.addProduct
);

// Category by ID routes
router
  .route("/product/:id")
  .get(productController.getProduct) // For fetching a product by ID
  .delete(productController.deleteProduct) // For deleting a product by ID
  .patch(uploadProductImage.single("image"), productController.updateProduct); // For updating a product (including image upload)

//! Category Management

router.route("/category/").post(categoryController.createCatagory); // For creating a new category

// Category by ID routes
router
  .route("/category/:id")
  .get(categoryController.getCatagory) // For fetching a category by ID
  .patch(categoryController.updateCatagory) // For updating category by ID
  .delete(categoryController.deleteCatagory); // For deleting a category by ID

//! Order Management

router.get("/orders", manageOrderController.allOrder);
router.post(
  "/order-management/send-invoice/:orderId",
  manageOrderController.sendInvoice
);

router.post(
  "/order-management/send-invoice",
  manageOrderController.sendInvoiceMultiple
);

router.patch(
  "/order-management/update-order/:orderId",
  manageOrderController.updateOrder
);
router.delete(
  "/order-management/delete-order/:orderId",
  manageOrderController.deleteOrder
);
router.get("/order-details/:id", manageOrderController.orderDetails);

router.patch("/assign-supplier", manageOrderController.orderJourneryComplete);

router.patch(
  "/supplier-acknowledgement",
  manageOrderController.orderJourneryComplete
);

router.patch("/order-dispatch", manageOrderController.orderJourneryComplete);

router.patch("/order-deliver", manageOrderController.orderJourneryComplete);

router.patch("/order-cancel", manageOrderController.orderJourneryComplete);

router.patch("/edit-order", manageOrderController.orderJourneryComplete);

router.patch("/add-cheque", manageOrderController.orderJourneryComplete);

router.patch("/edit-cheque", manageOrderController.eidtCheque);

//! Customer Management

router.get(
  "/customer-management/payment-cards/:id",
  customerController.fetchSavedCards
);

router.get(
  "/customer-management/dahboard-cards",
  customerController.viewCustomersManagement
);

router.patch("/customer-update/:id", customerController.updateCutomer);

router.get(
  "/customer-management/customer-list/:condition",
  customerController.customersList
);

router.get(
  "/customer-management/customer-list/sale-rep/:sr",
  customerController.customersList
);

router.get(
  "/customer-management/customer-list/sale-rep-id/:srId",
  customerController.customersList
);

router.get(
  "/customer-management/customer-list/employee-id/:empId",
  customerController.customersList
);

router.patch(
  "/customer-management/assign-sale-rep/:id",
  customerController.assignSalesRep
);

router.get(
  "/customer-management/invoice-customers-balance",
  customerController.InvoiceCustomers
);

router.get(
  "/customer-management/invoice-customers-balance/sales-rep/:srId",
  customerController.InvoiceCustomers
);

router.get(
  "/order-frequency/upcomming-orders",
  orderFrequencyController.orderAccordingToFrequency
);

router.get(
  "/order-frequency/upcomming-orders/sale-rep/:srId",
  orderFrequencyController.orderAccordingToFrequency
);

router.post(
  "/order-frequency/book-orders",
  orderFrequencyController.bookOrderAccordingToFrequency
);

router.post(
  "/order-frequency/book-orders/sale-rep/:srId",
  orderFrequencyController.bookOrderAccordingToFrequency
);

router.post("/send-quotation", salesRepController.sendQuotation);
router.post(
  "/send-quotation/sales-rep/:srId",
  salesRepController.sendQuotation
);

router.post("/book-new-order", orderFrequencyController.bookNewOrder);

router.post(
  "/sales-rep/book-new-order/:srId",
  orderFrequencyController.bookNewOrder
);

router.post("/add-customer/sales-rep/:srId", salesRepController.addCustomer);
router.post("/add-customer", salesRepController.addCustomer);

router.post(
  "/create-bank-setup-intent/sales-rep/:srId",
  salesRepController.createFinancialConnectionsSession
);

router.post(
  "/attach-bank-account-setup/sales-rep/:srId",
  salesRepController.attachBankAccount
);

router.get("/sales-rep/sales/:srId", salesRepController.salersMoney);

router.post(
  "/create-stripe-connect-account/:srId",
  salesRepController.stripeConnectAccount
);

router.post(
  "/stripe-connect-account-url/:srId",
  salesRepController.stripeConnectAccountLink
);

router.get(
  "/stripe-connect-account-dashboard/:srId",
  salesRepController.stripeConnectAccountDashboard
);

router.get(
  "/stripe-connect-account-retrieve/:srId",
  salesRepController.stripeConnectAccountRetrive
);

//! Supplier Management

router
  .route("/supplier/")
  .get(supplierController.getAllSuppliers) // For fetching all categories
  .post(uploadSupplierImage.single("image"), supplierController.createSupplier); // For creating a new category

// Category by ID routes
router
  .route("/supplier/:id")
  .get(supplierController.getSupplier) // For fetching a category by ID
  .patch(uploadSupplierImage.single("image"), supplierController.updateSupplier) // For updating category by ID
  .delete(supplierController.deleteSupplier); // For deleting a category by ID

router.patch(
  "/sales-rep/address-update/:srId",
  salesRepController.updateAddresses
);

router.get(
  "/sales-rep/for-order-creation",
  salesRepController.getSalesRepForOrderCreation
);

router.get(
  "/sales-rep/for-order-creation/:srId",
  salesRepController.getSalesRepForOrderCreation
);

router
  .route("/sales-rep/")
  .get(salesRepController.getAllSalesRep) // For fetching all categories
  .post(uploadSalesRepImage.single("image"), salesRepController.createSalesRep); // For creating a new category

// Category by ID routes
router
  .route("/sales-rep/:id")
  .get(salesRepController.getSalesRep)
  .patch(uploadSalesRepImage.single("image"), salesRepController.updateSalesRep)
  .delete(salesRepController.deleteSalesRep);

//! Address Management

router.patch(
  "/address-management/update-address/:id",
  addressController.updateAddress
);

router.patch(
  "/address-management/update-billing-address/:id",
  addressController.updateBillingAddress
);

//! Country Management
router
  .route("/address-management/country/")
  .post(addressController.createCountry);

router
  .route("/address-management/country/:id")
  .patch(addressController.updateCountry)
  .delete(addressController.deleteCountry);

//! State Management
router.route("/address-management/state/").post(addressController.createState);

router
  .route("/address-management/state/:id")
  .patch(addressController.updateState)
  .delete(addressController.deleteState);

//! City Management
router.route("/address-management/city/").post(addressController.createCity);

router
  .route("/address-management/city/:id")
  .patch(addressController.updateCity)
  .delete(addressController.deleteCity);

//! Territory Management
router
  .route("/address-management/territory/")
  .post(addressController.createTerritory);

router
  .route("/address-management/territory/:id")
  .patch(addressController.updateTerritory)
  .delete(addressController.deleteTerritory);

router.patch(
  "/address-management/add-cities-in-territory/:t_id",
  addressController.addCitiesInTerritory
);

router.get(
  "/admin-reports/partner-commission",
  adminReportsController.partnerCommissionReport
);

router.get(
  "/admin-reports/customer-report",
  adminReportsController.customerReport
);

router.get(
  "/admin-reports/product-sales",
  adminReportsController.productSalesReport
);

router.get(
  "/admin-reports/partner-commission",
  adminReportsController.partnerCommissionReport
);

router.get(
  "/admin-reports/partner-creadit-limit",
  adminReportsController.partnerCreaditLimit
);

router.get(
  "/admin-reports/unpaid-partner-balance",
  adminReportsController.unpaidPartnerbalanceReport
);

//! SUPPLIER REPORTS SECTION

router.get(
  "/supplier-reports/assigned-orders-report/:supId",
  supplierReportsController.assignedOrdersReport
);

router.get(
  "/supplier-reports/top-products-ordered-report/:supId",
  supplierReportsController.topProductsOrderedReport
);

router.get(
  "/supplier-reports/top-products-ordered-report/:supId",
  supplierReportsController.topProductsOrderedReport
);

//! SALESREP REPORTS SECTION

router.get(
  "/sales-rep-reports/orders-placed-report/:supId",
  salesRepReportsController.ordersPlacedReport
);

router.get(
  "/sales-rep-reports/commission-summary-report/:srId",
  salesRepReportsController.commissionSummaryReport
);

router.get(
  "/sales-rep-reports/customer-report/:srId",
  salesRepReportsController.customerReport
);

router.get(
  "/sales-rep-reports/partner-creadit-limit/:srId",
  salesRepReportsController.partnerCreaditLimit
);

//! DashBoard SECTION

router.get("/dashboard", dashboardsController.adminDashboard);

router.get(
  "/sales-rep-dashboard/:srId",
  dashboardsController.salesRepDashboard
);

router.get(
  "/dashboard/local-partner-employee",
  dashboardsController.employeeDashboardlocalPartner
);

router.get(
  "/dashboard/admin-employee",
  dashboardsController.employeeDashboardAdmin
);
router.get("/supplier-dashboard/:id", dashboardsController.supplierDashboard);

router.get(
  "/orders-pending-pullouts/:srId",
  manageOrderController.ordersPendingPullouts
);

router.post(
  "/pull-payments-from-patners-banka-account/:srId",
  pulloutPaymentsController.pullPaymentsFromPatnersBankAccounts
);

router.post(
  "/shipping-charges-on-weight",
  manageOrderController.findShippingCompanyForWeight
);

router.post(
  "/shipping-charges-on-weight/customer/:id",
  manageOrderController.findShippingCompanyForWeight
);

router.get(
  "/shipping-charges-list",
  shippingCompanyController.getAllShippingCompany
);

router.patch(
  "/shipping-charges-update",
  shippingCompanyController.updateShippingCompany
);

router.get(
  "/order-navigation-counts",
  manageOrderController.orderNavigationCounts
);

router.get(
  "/order-navigation-counts/sales-rep/:srId",
  manageOrderController.orderNavigationCountsLocalPatner
);

router.get(
  "/order-navigation-counts/supplier/:id",
  manageOrderController.orderNavigationCountsSupplier
);

router.get("/view-customer-detail/:id", customerController.customerDetail);

router.delete("/delete-customer/:id", customerController.deleteCustomer);

router.delete("/customer-discounts/:userId", customerController.dicounts);

router.post(
  "/partner-order/book-new-order",
  patnerOrderController.bookNewPartnerOrder
);

router.get("/partner-order/orders-list", patnerOrderController.allPartnerOrder);
router.get(
  "/partner-order/order-details/:id",
  patnerOrderController.partnerOrderDetails
);

module.exports = router;
