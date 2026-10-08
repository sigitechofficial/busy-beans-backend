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
const salesRepProductPriceController = require("../controllers/admin/salesRepProductPriceController");
const adminReportsController = require("../controllers/admin/adminReportsController");
const supplierReportsController = require("../controllers/admin/supplierReportsController");
const salesRepReportsController = require("../controllers/admin/salesRepReportsController");
const dashboardsController = require("../controllers/admin/dashboardsController");
const shippingCompanyController = require("../controllers/admin/shippingCompanyController");
const employeeController = require("../controllers/admin/employeeController");
const subAdminController = require("../controllers/admin/subAdminController");
const adminController = require("../controllers/admin/adminController");
const machineController = require("../controllers/admin/machineController");
const leadController = require("../controllers/admin/leadController");
const supplierEmailReminderController = require("../controllers/admin/supplierEmailReminderController");

const patnerOrderController = require("../controllers/admin/partnerOrderController");

const pulloutPaymentsController = require("../controllers/admin/pulloutPaymentsController");
const emailLogController = require("../controllers/admin/emailLogController");
const emailSettingsController = require("../controllers/admin/emailSettingsController");
const bulkEmailController = require("../controllers/admin/bulkEmailController");
const qboCustomFieldSyncController = require("../controllers/admin/qboCustomFieldSyncController");
const dailyEodDigestController = require("../controllers/admin/dailyEodDigestController");
const qboUnsyncedPaidPaymentSyncController = require("../controllers/admin/qboUnsyncedPaidPaymentSyncController");

const multer = require("multer");
const path = require("path");
const { createDestinationDirectory } = require("../utils/customFunctions");
const auth = require("../middlewares/protect");
const { protect, STAFF_ENTITIES, ADMIN_STAFF_ENTITIES } = auth;
// Invoice edit / send: admin-panel staff only (ownership checked in the controllers).
const { INVOICE_EDITOR_ENTITIES } = require("../utils/orderAccess");
// Invoice payment page: pay link code, owner / staff login, or job key (middlewares/invoicePayAccess.js).
const { invoicePayAccess, payLinkLimiter } = require("../middlewares/invoicePayAccess");
// Order / invoice activity history (who did what, when): utils/orderActivity.js
const { activityOnSuccess, describeJourney } = require("../utils/orderActivity");
const orderActivityController = require("../controllers/admin/orderActivityController");
const logJourney = activityOnSuccess(describeJourney);
// Audit trail: customers, local partners, suppliers, sub-admins, employees (utils/auditTrail.js)
const { auditRoute, auditPriceList } = require("../utils/auditTrail");
const auditController = require("../controllers/admin/auditController");
const { requestContext } = require("../utils/requestContext");
// "Order created" / "paid" for every path (incl. Stripe webhooks and jobs) via model hooks.
require("../utils/orderActivity").registerOrderHooks();
// Scheduled jobs / internal calls: job key (INTERNAL_JOB_API_KEY) or a staff token. See docs/API_ACCESS.md.
const { jobKeyOrStaff } = require("../middlewares/requireJobKey");
// Customers (`user` tokens) must never read admin prices or edit the catalog.
const staffOnly = auth.restrictTo(...STAFF_ENTITIES);
const catalogAdminOnly = auth.restrictTo(...ADMIN_STAFF_ENTITIES);
const { loginRateLimiter } = require("../middlewares/loginRateLimit");
const {
  setTemporaryBlockContext,
} = require("../middlewares/temporaryBlockFlow");
const router = express.Router();
// LAMDA FUNCTION

/**
 * @swagger
 * /api/v1/admin/order-management/fetch-invoice/{orderId}:
 *   post:
 *     summary: Fetch invoice for order (Lambda function)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice fetched
 */
router.post(
  "/order-management/fetch-invoice/:orderId",
  payLinkLimiter,
  invoicePayAccess("orderId"),
  manageOrderController.fetchInvoice,
);

/**
 * @swagger
 * /api/v1/admin/order-management/email-helper:
 *   post:
 *     summary: Email helper endpoint (Lambda function)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Email sent
 */
router.post(
  "/order-management/email-helper",
  jobKeyOrStaff,
  manageOrderController.emailHelper,
);

/**
 * @swagger
 * /api/v1/admin/order-management/bulk-email-helper:
 *   post:
 *     summary: Send emails for multiple orders (batch email helper)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ordersToSentEmail:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     orderId: { type: integer }
 *                     orderType: { type: string, enum: [customer, local-partner] }
 *                     emailType:
 *                       type: string
 *                       enum:
 *                         - order-confirmation
 *                         - paid-invoice
 *                         - invoice-sent
 *                         - invoice-reminder
 *                         - order-dispatch
 *                         - order-shipped
 *                         - order-ship-supplier
 *     responses:
 *       200:
 *         description: Per-order send results and summary
 */
router.post(
  "/order-management/bulk-email-helper",
  jobKeyOrStaff,
  bulkEmailController.bulkEmailHelper,
);

/**
 * @swagger
 * /api/v1/admin/order-management/ensure-invoice-pdfs:
 *   post:
 *     summary: Ensure invoice PDFs exist for pending orders with invoice date (creates if missing)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Summary of created, skipped, and errors
 */
router.post(
  "/order-management/ensure-invoice-pdfs",
  jobKeyOrStaff,
  manageOrderController.ensurePendingInvoicePdfs,
);

/**
 * @swagger
 * /api/v1/admin/order-management/resend-unopened-supplier-emails:
 *   post:
 *     summary: Resend supplier new-order emails when unopened for X hours and statusId is 2 (Lambda/job endpoint)
 *     tags: [Admin]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minHours:
 *                 type: integer
 *                 default: 24
 *               maxRetry:
 *                 type: integer
 *                 default: 3
 *     responses:
 *       200:
 *         description: Job summary
 */
router.post(
  "/order-management/resend-unopened-supplier-emails",
  jobKeyOrStaff,
  supplierEmailReminderController.resendUnopenedSupplierEmails,
);

/**
 * @swagger
 * /api/v1/admin/order-management/pending-pdfs-list:
 *   get:
 *     summary: List orders with pending PDFs (payment pending, invoice date set, updated > 7 days ago)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of orders
 */
router.get(
  "/order-management/pending-pdfs-list",
  jobKeyOrStaff,
  manageOrderController.listPendingPdfs,
);

/**
 * @swagger
 * /api/v1/admin/order-management/email-log:
 *   get:
 *     summary: List email log (success and failed) with filters (protected). Local partners only see logs for their salesRep orders.
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: emailType
 *         schema: { type: string }
 *         description: invoice_sent | invoice_reminder | paid_receipt | paid_receipt_admin | supplier_new_order | order_shipped | order_confirmation
 *       - in: query
 *         name: orderId
 *         schema: { type: integer }
 *       - in: query
 *         name: emailSent
 *         schema: { type: string }
 *         description: Success | Failed
 *       - in: query
 *         name: retrySuccess
 *         schema: { type: string }
 *         description: true | false | null (initial send, not a retry)
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Start date YYYY-MM-DD
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: End date YYYY-MM-DD
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of email log entries
 */
router.get(
  "/order-management/email-log",
  protect,
  //   auth.restrictTo("admin", "adminEmployee"),
  emailLogController.getEmailLog,
);

/**
 * @swagger
 * /api/v1/admin/order-management/email-log/{id}:
 *   get:
 *     summary: Get single email log entry by id (protected)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Email log entry
 *       404:
 *         description: Not found
 */
router.get(
  "/order-management/email-log/:id",
  protect,
  //   auth.restrictTo("admin", "adminEmployee"),
  emailLogController.getEmailLogById,
);

router.get(
  "/email-settings/catalog",
  protect,
  auth.restrictTo("admin"),
  emailSettingsController.getCatalog,
);

router.get(
  "/email-settings",
  protect,
  auth.restrictTo("admin"),
  emailSettingsController.getSettings,
);

router.get(
  "/email-settings/recipients",
  protect,
  auth.restrictTo("admin"),
  emailSettingsController.getRecipients,
);

router.patch(
  "/email-settings/recipients",
  protect,
  auth.restrictTo("admin"),
  emailSettingsController.updateRecipients,
);

router.patch(
  "/email-settings/default-supplier",
  protect,
  auth.restrictTo("admin"),
  emailSettingsController.setDefaultSupplier,
);

router.patch(
  "/email-settings",
  protect,
  auth.restrictTo("admin"),
  emailSettingsController.updateSetting,
);

/**
 * @swagger
 * /api/v1/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  "/login",
  loginRateLimiter,
  setTemporaryBlockContext("login"),
  (req, res, next) => {
    req.params.entity = "admin";
    next();
  },
  authController.adminLogin,
);

/**
 * @swagger
 * /api/v1/admin/login/sales-rep:
 *   post:
 *     summary: Sales rep login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post(
  "/login/sales-rep",
  loginRateLimiter,
  setTemporaryBlockContext("login"),
  (req, res, next) => {
    req.params.entity = "localPartner";
    next();
  },
  authController.salesRepLogin,
);

/**
 * @swagger
 * /api/v1/admin/login/supplier:
 *   post:
 *     summary: Supplier login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post(
  "/login/supplier",
  loginRateLimiter,
  setTemporaryBlockContext("login"),
  (req, res, next) => {
    req.params.entity = "supplier";
    next();
  },
  authController.supplierLogin,
);

/**
 * @swagger
 * /api/v1/admin/forgot-password:
 *   post:
 *     summary: Admin forgot password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post(
  "/forgot-password",
  setTemporaryBlockContext("forgot_password"),
  authController.adminForgotPassword,
);

/**
 * @swagger
 * /api/v1/admin/forgot-password/sales-rep:
 *   post:
 *     summary: Sales rep forgot password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post(
  "/forgot-password/sales-rep",
  setTemporaryBlockContext("forgot_password"),
  authController.salesRepForgotPassword,
);

/**
 * @swagger
 * /api/v1/admin/forgot-password/supplier:
 *   post:
 *     summary: Supplier forgot password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post(
  "/forgot-password/supplier",
  setTemporaryBlockContext("forgot_password"),
  authController.supplierForgotPassword,
);

/**
 * @swagger
 * /api/v1/admin/resend-otp:
 *   post:
 *     summary: Resend OTP for admin
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent
 */
router.post("/resend-otp", authController.adminResendOtp);

/**
 * @swagger
 * /api/v1/admin/resend-otp/sales-rep:
 *   post:
 *     summary: Resend OTP for sales rep
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent
 */
router.post("/resend-otp/sales-rep", authController.salesRepResendOtp);

/**
 * @swagger
 * /api/v1/admin/resend-otp/supplier:
 *   post:
 *     summary: Resend OTP for supplier
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent
 */
router.post("/resend-otp/supplier", authController.supplierResendOtp);

/**
 * @swagger
 * /api/v1/admin/otp-verification:
 *   post:
 *     summary: Verify OTP for admin
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 */
router.post("/otp-verification", authController.adminOtpVerification);

/**
 * @swagger
 * /api/v1/admin/otp-verification/sales-rep:
 *   post:
 *     summary: Verify OTP for sales rep
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 */
router.post(
  "/otp-verification/sales-rep",
  authController.salesRepOtpVerification,
);

/**
 * @swagger
 * /api/v1/admin/otp-verification/supplier:
 *   post:
 *     summary: Verify OTP for supplier
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 */
router.post(
  "/otp-verification/supplier",
  authController.supplierOtpVerification,
);

/**
 * @swagger
 * /api/v1/admin/reset-password:
 *   post:
 *     summary: Reset password for admin
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post("/reset-password", authController.adminResetPassword);

/**
 * @swagger
 * /api/v1/admin/reset-password/sales-rep:
 *   post:
 *     summary: Reset password for sales rep
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post("/reset-password/sales-rep", authController.salesRepResetPassword);

/**
 * @swagger
 * /api/v1/admin/reset-password/supplier:
 *   post:
 *     summary: Reset password for supplier
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post("/reset-password/supplier", authController.supplierResetPassword);

/**
 * @swagger
 * /api/v1/admin/product:
 *   get:
 *     summary: Get all products with prices (staff only)
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of all products
 */
router.get("/product", protect, staffOnly, productController.getAllProducts);
/**
 * @swagger
 * /api/v1/admin/lambda-function/pending-pullout-fromlocal-patner-banks:
 *   post:
 *     summary: Process pending pullouts from local partner banks (Lambda function)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Pullouts processed
 */
router.post(
  "/lambda-function/pending-pullout-fromlocal-patner-banks",
  jobKeyOrStaff,
  pulloutPaymentsController.processAllLocalPartnersForPaymentPullouts,
);

/**
 * @swagger
 * /api/v1/admin/lambda-function/create-upcomming-orders:
 *   post:
 *     summary: Create upcoming orders based on frequency (Lambda function)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Upcoming orders created
 */
router.post(
  "/lambda-function/create-upcomming-orders",
  jobKeyOrStaff,
  orderFrequencyController.bookOrderAccordingToFrequencyLamdaFunction,
);

/**
 * @swagger
 * /api/v1/admin/lambda-function/send-daily-eod-digests:
 *   post:
 *     summary: Send end-of-day admin and partner digest emails (Lambda / cron)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: reportDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional YYYY-MM-DD (defaults to America/New_York today)
 *       - in: query
 *         name: forceRetryFailed
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Retry previously failed digest slots only (never resends successful ones)
 *     responses:
 *       200:
 *         description: Digest job completed (idempotent per recipient per reportDate)
 */
router.post(
  "/lambda-function/send-daily-eod-digests",
  jobKeyOrStaff,
  dailyEodDigestController.sendDailyEodDigests,
);

/**
 * @swagger
 * /api/v1/admin/lambda-function/sync-unsynced-paid-customer-payments:
 *   post:
 *     summary: Sync missing QBO invoices then payments for paid customer orders (Lambda / cron)
 *     description: >
 *       Paid orders only. With salesRepId syncs partner invoice (if missing) then partner payment;
 *       without salesRep syncs admin invoice (if missing) then admin payment. Max 10 per run.
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, return candidates and planned actions only (no QBO calls)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 10
 *         description: Max orders to process per run (capped at 10)
 *       - in: query
 *         name: syncSide
 *         schema:
 *           type: string
 *           enum: [admin, partner, both]
 *           default: both
 *         description: Filter to admin-path (no salesRep), partner-path (has salesRep), or both
 *     responses:
 *       200:
 *         description: Job completed (may be partial-success if some syncs failed)
 *       401:
 *         description: Unauthorized when LAMBDA_JOB_SECRET is set and missing/invalid
 */
router.post(
  "/lambda-function/sync-unsynced-paid-customer-payments",
  jobKeyOrStaff,
  qboUnsyncedPaidPaymentSyncController.syncUnsyncedPaidCustomerPayments,
);

//! Country Management

/**
 * @swagger
 * /api/v1/admin/address-management/country/:
 *   get:
 *     summary: Get all countries
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of countries
 */
router.get("/address-management/country/", addressController.getAllCountries);

/**
 * @swagger
 * /api/v1/admin/address-management/country/{id}:
 *   get:
 *     summary: Get country by ID
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Country details
 */
router.get("/address-management/country/:id", addressController.getCountry);

//! State Management

/**
 * @swagger
 * /api/v1/admin/address-management/state/:
 *   get:
 *     summary: Get all states
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of states
 */
router.get("/address-management/state/", addressController.getAllStates);

/**
 * @swagger
 * /api/v1/admin/address-management/state/{id}:
 *   get:
 *     summary: Get state by ID
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: State details
 */
router.get("/address-management/state/:id", addressController.getState);

//! City Management

/**
 * @swagger
 * /api/v1/admin/address-management/city/:
 *   get:
 *     summary: Get all cities
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of cities
 */
router.get("/address-management/city/", addressController.getAllCities);

/**
 * @swagger
 * /api/v1/admin/address-management/city/{id}:
 *   get:
 *     summary: Get city by ID
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: City details
 */
router.get("/address-management/city/:id", addressController.getCity);

//! Territory Management

/**
 * @swagger
 * /api/v1/admin/address-management/territory/:
 *   get:
 *     summary: Get all territories
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of territories
 */
router.get("/address-management/territory/", addressController.getAllTerritory);

/**
 * @swagger
 * /api/v1/admin/address-management/territory/{id}:
 *   get:
 *     summary: Get territory by ID
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Territory details
 */
router.get("/address-management/territory/:id", addressController.getTerritory);

// Create Employee (Admin or SalesRep can create employees)

/**
 * @swagger
 * /api/v1/admin/employee:
 *   post:
 *     summary: Create a new employee
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       201:
 *         description: Employee created
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/employee",
  auth.protect,
  auth.restrictTo("admin", "localPartner", "subAdmin"),
  auditRoute("employee", "created"),
  employeeController.createEmployee,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}:
 *   get:
 *     summary: Get employee by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee details
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/employee/:employeeId",
  auth.protect,
  auth.restrictTo("admin", "localPartner", "subAdmin"),
  employeeController.getEmployee,
);

/**
 * @swagger
 * /api/v1/admin/employees:
 *   get:
 *     summary: Get all employees
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of employees
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/employees",
  auth.protect,
  auth.restrictTo("admin", "localPartner", "subAdmin"),
  employeeController.getAllEmployee,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}:
 *   patch:
 *     summary: Update employee (Admin/LocalPartner)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Employee updated
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/employee/:employeeId",
  auth.protect,
  auth.restrictTo("admin", "localPartner", "subAdmin"),
  auditRoute("employee", "updated", (req) => req.params.employeeId),
  employeeController.updateEmployee,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}:
 *   delete:
 *     summary: Delete employee
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee deleted
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/employee/:employeeId",
  auth.protect,
  auth.restrictTo("admin", "localPartner", "subAdmin"),
  auditRoute("employee", "deleted", (req) => req.params.employeeId),
  employeeController.deleteEmployee,
);

router.post(
  "/sub-admin",
  auth.protect,
  auth.restrictTo("admin", "subAdmin"),
  auditRoute("subAdmin", "created"),
  subAdminController.createSubAdmin,
);
router.get(
  "/sub-admins",
  auth.protect,
  auth.restrictTo("admin", "subAdmin"),
  subAdminController.getAllSubAdmins,
);
router.get(
  "/sub-admin/me",
  auth.protect,
  auth.restrictTo("subAdmin"),
  subAdminController.getMyProfile,
);
router.patch(
  "/sub-admin/me",
  auth.protect,
  auth.restrictTo("subAdmin"),
  auditRoute("subAdmin", "updated", (req) => req.user?.id),
  subAdminController.updateMyProfile,
);
router.get(
  "/sub-admin/:id",
  auth.protect,
  auth.restrictTo("admin", "subAdmin"),
  subAdminController.getSubAdmin,
);
router.patch(
  "/sub-admin/:id",
  auth.protect,
  auth.restrictTo("admin", "subAdmin"),
  auditRoute("subAdmin", "updated"),
  subAdminController.updateSubAdmin,
);
router.delete(
  "/sub-admin/:id",
  auth.protect,
  auth.restrictTo("admin", "subAdmin"),
  auditRoute("subAdmin", "deleted"),
  subAdminController.deleteSubAdmin,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}:
 *   put:
 *     summary: Update employee (Admin/SalesRep)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Employee updated
 *       401:
 *         description: Unauthorized
 */
router.put(
  "/employee/:employeeId",
  auth.protect,
  auth.restrictTo("admin", "salesRep", "subAdmin"),
  auditRoute("employee", "updated", (req) => req.params.employeeId),
  employeeController.updateEmployee,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}/stripe-connect-account:
 *   post:
 *     summary: Create Stripe Connect account for admin employee
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               returnUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stripe Connect account created
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/employee/:employeeId/stripe-connect-account",
  auth.protect,
  auth.restrictTo("admin", "adminEmployee"),
  employeeController.stripeConnectAccount,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}/stripe-connect-account-link:
 *   post:
 *     summary: Get Stripe Connect account onboarding link
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               returnUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stripe Connect account link
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/employee/:employeeId/stripe-connect-account-link",
  auth.protect,
  auth.restrictTo("admin", "adminEmployee"),
  employeeController.stripeConnectAccountLink,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}/stripe-connect-account-dashboard:
 *   get:
 *     summary: Get Stripe Connect account dashboard link
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Stripe Connect dashboard link
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/employee/:employeeId/stripe-connect-account-dashboard",
  auth.protect,
  auth.restrictTo("admin", "adminEmployee"),
  employeeController.stripeConnectAccountDashboard,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}/direct-partner-bank-account:
 *   post:
 *     summary: Attach employee bank account to direct-partner connected account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               externalAccountToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Employee bank account attached
 */
router.post(
  "/employee/:employeeId/direct-partner-bank-account",
  auth.protect,
  auth.restrictTo("localPartner", "partnerEmployee"),
  employeeController.attachDirectPartnerEmployeeBankAccount,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}/direct-partner-bank-account:
 *   get:
 *     summary: Get employee bank account linked to direct-partner connected account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee bank account details
 */
router.get(
  "/employee/:employeeId/direct-partner-bank-account",
  auth.protect,
  auth.restrictTo("localPartner", "partnerEmployee"),
  employeeController.getDirectPartnerEmployeeBankAccount,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}/direct-partner-bank-account:
 *   delete:
 *     summary: Remove employee bank account from direct-partner connected account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Employee bank account removed
 */
router.delete(
  "/employee/:employeeId/direct-partner-bank-account",
  auth.protect,
  auth.restrictTo("localPartner", "partnerEmployee"),
  employeeController.deleteDirectPartnerEmployeeBankAccount,
);

/**
 * @swagger
 * /api/v1/admin/direct-partner-employee-payout/retry/{orderId}:
 *   post:
 *     summary: Retry direct-partner employee payout for an order
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Retry payout created
 */
router.post(
  "/direct-partner-employee-payout/retry/:orderId",
  auth.protect,
  auth.restrictTo("localPartner", "partnerEmployee"),
  employeeController.retryDirectPartnerEmployeePayout,
);

router.get(
  "/direct-partner-employee-payout/orders",
  auth.protect,
  auth.restrictTo("localPartner", "partnerEmployee"),
  employeeController.getDirectPartnerEmployeePayoutOrders,
);

/**
 * @swagger
 * /api/v1/admin/employee/{employeeId}/commission:
 *   patch:
 *     summary: Update employee commission percentage
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commissionPercentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Commission percentage updated
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/employee/:employeeId/commission",
  auth.protect,
  auth.restrictTo("admin", "localPartner"),
  auditRoute("employee", "updated", (req) => req.params.employeeId),
  employeeController.updateCommission,
);

/**
 * @swagger
 * /api/v1/admin/employee-commission-orders:
 *   get:
 *     summary: Get orders with employee commission (transferred/not-transferred)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [transferred, not-transferred]
 *         description: Filter by transfer status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Orders with employee commission
 *       400:
 *         description: Invalid status parameter
 *       403:
 *         description: Only admin can access
 */
router.get(
  "/employee-commission-orders/:status",
  auth.protect,
  auth.restrictTo("admin", "adminEmployee"),
  employeeController.getEmployeeCommissionOrders,
);

/**
 * @swagger
 * /api/v1/admin/transfer-commission-to-employee:
 *   post:
 *     summary: Transfer commission to employees for multiple orders
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderIds
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of order IDs to transfer commission for
 *                 example: [123, 456, 789]
 *     responses:
 *       200:
 *         description: Transfer results
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Only admin and admin employees can access
 */
router.post(
  "/transfer-commission-to-employee",
  auth.protect,
  auth.restrictTo("admin", "adminEmployee"),
  employeeController.transferCommissionToEmployeeController,
);

/**
 * @swagger
 * /api/v1/admin/bulk-transfer-commission-to-employee:
 *   post:
 *     summary: Bulk transfer commission to employees - sums all commissions per employee and transfers once
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderIds
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of order IDs that have employee commission data
 *                 example: [123, 456, 789]
 *     responses:
 *       200:
 *         description: Bulk transfer results grouped by employee
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Only admin and admin employees can access
 */
router.post(
  "/bulk-transfer-commission-to-employee",
  auth.protect,
  auth.restrictTo("admin", "adminEmployee"),
  employeeController.bulkTransferCommissionToEmployeeController,
);

/**
 * @swagger
 * /api/v1/admin/category/:
 *   get:
 *     summary: Get all categories
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get("/category/", categoryController.getAllCatagories);

//!MIDDLEWARE PRIVATE ROUTES
router.use(protect);
// What each kind of account may reach here (customers, suppliers, partners: their own data only).
router.use(require("../middlewares/adminAccess"));
// Who is acting, for model hooks (order created / paid).
router.use(requestContext);

/** History of a customer / local partner / supplier / sub-admin / employee (who changed what, when). */
router.get("/audit/:entityPath/:entityId", auditController.list);

/**
 * @swagger
 * /api/v1/admin/profile/:
 *   get:
 *     summary: Get admin/sales rep profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile details
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/profile/",
  auth.restrictTo("admin", "salesRep"),
  adminController.getAdmin,
);

/**
 * @swagger
 * /api/v1/admin/profile-update/{id}:
 *   patch:
 *     summary: Update admin/sales rep profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/profile-update/:id",
  auth.restrictTo("admin", "salesRep"),
  adminController.updateAdmin,
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

const machineImage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destinationPath = "./public/machines";

    // Call the function to create the destination directory
    createDestinationDirectory(destinationPath, cb);
  },
  filename: (req, file, cb) => {
    cb(null, `sales-rep-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadMachineImage = multer({
  storage: machineImage,
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

/**
 * @swagger
 * /api/v1/admin/product:
 *   post:
 *     summary: Add a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Product created
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/product",
  catalogAdminOnly,
  auditRoute("product", "created"),
  uploadProductImage.single("image"),
  productController.addProduct,
);

// Category by ID routes

/**
 * @swagger
 * /api/v1/admin/product/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product details
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product deleted
 *       401:
 *         description: Unauthorized
 *   patch:
 *     summary: Update product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Product updated
 *       401:
 *         description: Unauthorized
 */
router
  .route("/product/:id")
  .get(staffOnly, productController.getProduct) // For fetching a product by ID
  .delete(catalogAdminOnly, auditRoute("product", "deleted"), productController.deleteProduct) // For deleting a product by ID
  .patch(catalogAdminOnly, auditRoute("product", "updated"), uploadProductImage.single("image"), productController.updateProduct); // For updating a product (including image upload)

//! Sales Rep Product Price Management
/**
 * @swagger
 * /api/v1/admin/sales-rep-product-price:
 *   post:
 *     summary: Create sales rep product prices (bulk)
 *     tags: [Sales Rep Product Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - productId
 *                 - salesRepId
 *                 - price
 *               properties:
 *                 productId:
 *                   type: integer
 *                 salesRepId:
 *                   type: integer
 *                 price:
 *                   type: number
 *                 status:
 *                   type: boolean
 *                   default: true
 *     responses:
 *       201:
 *         description: Prices created successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product or Sales Rep not found
 *       409:
 *         description: Duplicate pricing entry exists
 */
router.post(
  "/sales-rep-product-price",
  protect,
  auditPriceList(),
  salesRepProductPriceController.createSalesRepProductPrices,
);

/**
 * @swagger
 * /api/v1/admin/sales-rep-product-price:
 *   patch:
 *     summary: Update sales rep product prices (bulk)
 *     tags: [Sales Rep Product Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required:
 *                 - productId
 *                 - salesRepId
 *               properties:
 *                 productId:
 *                   type: integer
 *                 salesRepId:
 *                   type: integer
 *                 price:
 *                   type: number
 *                 status:
 *                   type: boolean
 *     responses:
 *       200:
 *         description: Prices updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Pricing entries not found
 */
router.patch(
  "/sales-rep-product-price",
  protect,
  auditPriceList(),
  salesRepProductPriceController.updateSalesRepProductPrices,
);

/**
 * @swagger
 * /api/v1/admin/sales-rep-product-price:
 *   get:
 *     summary: Get all sales rep product prices
 *     tags: [Sales Rep Product Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: integer
 *         description: Filter by product ID
 *       - in: query
 *         name: salesRepId
 *         schema:
 *           type: integer
 *         description: Filter by sales rep ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: boolean
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Sort field and order (e.g., "price,asc" or "-createdAt")
 *     responses:
 *       200:
 *         description: List of pricing entries
 */
router.get(
  "/products/sales-rep",
  protect,
  staffOnly,
  salesRepProductPriceController.getAllSalesRepProductPrices,
);

router.get(
  "/products/sales-rep/import",
  protect,
  staffOnly,
  salesRepProductPriceController.productsFromAdminForSalesRep,
);

router.get(
  "/products/sales-rep/import/:srId",
  protect,
  staffOnly,
  salesRepProductPriceController.productsFromAdminForSalesRep,
);

/**
 * @swagger
 * /api/v1/admin/sales-rep-product-price/products-for-order/{salesRepId}:
 *   post:
 *     summary: Get products with custom wholesale prices for partner order creation
 *     tags: [Sales Rep Product Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salesRepId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Sales rep/local partner ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productIds
 *             properties:
 *               productIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3, 4, 5]
 *     responses:
 *       200:
 *         description: Products with wholesale prices (custom if set, default otherwise)
 *       400:
 *         description: Validation error (missing salesRepId or productIds)
 */
router.post(
  "/sales-rep-products-for-order-creation/:salesRepId",
  protect,
  salesRepProductPriceController.getProductsForPartnerOrder,
);

/**
 * @swagger
 * /api/v1/admin/sales-rep-product-price/{id}:
 *   get:
 *     summary: Get sales rep product price by ID
 *     tags: [Sales Rep Product Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Pricing entry ID
 *     responses:
 *       200:
 *         description: Pricing entry details
 *       404:
 *         description: Pricing entry not found
 */
router.get(
  "/sales-rep-product-price/:id",
  protect,
  salesRepProductPriceController.getSalesRepProductPrice,
);

/**
 * @swagger
 * /api/v1/admin/sales-rep-product-price/{id}:
 *   delete:
 *     summary: Delete sales rep product price by ID (hard delete - permanent)
 *     tags: [Sales Rep Product Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Pricing entry ID
 *     responses:
 *       200:
 *         description: Pricing entry deleted successfully
 *       404:
 *         description: Pricing entry not found
 */
router.delete(
  "/sales-rep-product-price/:id",
  protect,
  auditPriceList(),
  salesRepProductPriceController.deleteSalesRepProductPrice,
);

/**
 * @swagger
 * /api/v1/admin/sales-rep-product-price:
 *   delete:
 *     summary: Delete sales rep product prices (bulk hard delete - permanent)
 *     tags: [Sales Rep Product Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               oneOf:
 *                 - required:
 *                     - id
 *                   properties:
 *                     id:
 *                       type: integer
 *                 - required:
 *                     - productId
 *                     - salesRepId
 *                   properties:
 *                     productId:
 *                       type: integer
 *                     salesRepId:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Prices deleted successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: No pricing entries found to delete
 */
router.delete(
  "/sales-rep-product-price",
  protect,
  auditPriceList(),
  salesRepProductPriceController.deleteSalesRepProductPrices,
);

//! Category Management

/**
 * @swagger
 * /api/v1/admin/category/:
 *   post:
 *     summary: Create a new category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 *       401:
 *         description: Unauthorized
 */
router.route("/category/").post(catalogAdminOnly, categoryController.createCatagory); // For creating a new category

// Category by ID routes

/**
 * @swagger
 * /api/v1/admin/category/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category details
 *       401:
 *         description: Unauthorized
 *   patch:
 *     summary: Update category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Category updated
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete category
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category deleted
 *       401:
 *         description: Unauthorized
 */
router
  .route("/category/:id")
  .get(categoryController.getCatagory) // For fetching a category by ID
  .patch(catalogAdminOnly, categoryController.updateCatagory) // For updating category by ID
  .delete(catalogAdminOnly, categoryController.deleteCatagory); // For deleting a category by ID

//! Order Management

/**
 * @swagger
 * /api/v1/admin/orders:
 *   get:
 *     summary: Get all orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of orders
 *       401:
 *         description: Unauthorized
 */
router.get("/orders", manageOrderController.allOrder);

/**
 * @swagger
 * /api/v1/admin/quickbooks-customer-order-management/{qbo}:
 *   get:
 *     summary: Get orders filtered by QuickBooks status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: qbo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of orders
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/quickbooks-customer-order-management/:qbo",
  manageOrderController.allOrder,
);

/**
 * @swagger
 * /api/v1/admin/order-management/send-invoice/{orderId}:
 *   post:
 *     summary: Send invoice for an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice sent
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/order-management/send-invoice/:orderId",
  auth.restrictTo(...INVOICE_EDITOR_ENTITIES),
  activityOnSuccess((req) => ({
    ...(req.body?.order?.partnerOrderId ? { partnerOrderId: req.params.orderId } : { orderId: req.params.orderId }),
    action: "invoice_sent",
    summary: "Invoice emailed",
  })),
  manageOrderController.sendInvoice,
);

/** Activity history of an order or partner order (who did what, when). */
router.get(
  "/order-management/activity/:orderType/:orderId",
  orderActivityController.list,
);

/**
 * @swagger
 * /api/v1/admin/order-management/send-invoice:
 *   post:
 *     summary: Send invoices for multiple orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Invoices sent
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/order-management/send-invoice",
  auth.restrictTo(...INVOICE_EDITOR_ENTITIES),
  activityOnSuccess((req) =>
    (Array.isArray(req.body?.order) ? req.body.order : []).map((o) => ({
      orderId: o?.orderId,
      action: "invoice_sent",
      summary: "Invoice emailed (bulk send)",
    })),
  ),
  manageOrderController.sendInvoiceMultiple,
);

/**
 * @swagger
 * /api/v1/admin/order-management/update-order/{orderId}:
 *   patch:
 *     summary: Update an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Order updated
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/order-management/update-order/:orderId",
  auth.restrictTo(...INVOICE_EDITOR_ENTITIES),
  manageOrderController.updateOrder,
);

/**
 * @swagger
 * /api/v1/admin/order-management/delete-order/{orderId}:
 *   delete:
 *     summary: Delete an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order deleted
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/order-management/delete-order/:orderId",
  activityOnSuccess((req) => ({ orderId: req.params.orderId, action: "order_deleted", summary: "Order deleted" })),
  manageOrderController.deleteOrder,
);

/**
 * @swagger
 * /api/v1/admin/order-management/delete-invoice:
 *   post:
 *     summary: Delete invoice for an order (clear issue date, reminder, expire checkout session if not paid, delete PDF)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderType, id]
 *             properties:
 *               orderType:
 *                 type: string
 *                 enum: [order, partnerOrder]
 *                 description: Order type - "order" for admin orders, "partnerOrder" for local partner orders
 *               id:
 *                 type: integer
 *                 description: Order id
 *     responses:
 *       200:
 *         description: Invoice deleted successfully
 *       400:
 *         description: Invoice is paid or validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 */
router.post(
  "/order-management/delete-invoice",
  activityOnSuccess((req) => ({
    ...(req.body?.orderType === "partnerOrder" ? { partnerOrderId: req.body?.id } : { orderId: req.body?.id }),
    action: "invoice_deleted",
    summary: "Invoice deleted (payment link cancelled)",
  })),
  manageOrderController.deleteInvoice,
);

router.get(
  "/order-management/invoice-tracking/:orderType/:orderId",
  manageOrderController.invoiceTracking,
);

/**
 * @swagger
 * /api/v1/admin/order-management/update-tracking-number:
 *   patch:
 *     summary: Update order tracking number
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, trackingNumber]
 *             properties:
 *               orderId:
 *                 type: integer
 *                 description: Order id
 *               trackingNumber:
 *                 type: string
 *                 description: Tracking number to set on the order
 *               orderType:
 *                 type: string
 *                 enum: [customer-order, partner-order, local-partner]
 *                 description: Optional. Use partner-order/local-partner for partner orders; defaults to customer order
 *     responses:
 *       200:
 *         description: Tracking number updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order not found
 */
router.patch(
  "/order-management/update-tracking-number",
  activityOnSuccess((req) => ({
    ...(["local-partner", "partner-order"].includes(req.body?.orderType) ? { partnerOrderId: req.body?.orderId } : { orderId: req.body?.orderId }),
    action: "tracking_updated",
    summary: `Tracking number set${req.body?.trackingNumber ? `: ${String(req.body.trackingNumber).slice(0, 60)}` : ""}`,
  })),
  manageOrderController.updateTrackingNumber,
);

/**
 * @swagger
 * /api/v1/admin/order-details/{id}:
 *   get:
 *     summary: Get order details by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Order details
 *       401:
 *         description: Unauthorized
 */
router.get("/order-details/:id", manageOrderController.orderDetails);

/**
 * @swagger
 * /api/v1/admin/assign-supplier:
 *   patch:
 *     summary: Assign supplier to order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Supplier assigned
 *       401:
 *         description: Unauthorized
 */
router.patch("/assign-supplier", logJourney, manageOrderController.orderJourneryComplete);

/**
 * @swagger
 * /api/v1/admin/supplier-acknowledgement:
 *   patch:
 *     summary: Update supplier acknowledgement
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Acknowledgement updated
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/supplier-acknowledgement",
  logJourney,
  manageOrderController.orderJourneryComplete,
);

/**
 * @swagger
 * /api/v1/admin/order-dispatch:
 *   patch:
 *     summary: Mark order as dispatched
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Order dispatched
 *       401:
 *         description: Unauthorized
 */
router.patch("/order-dispatch", logJourney, manageOrderController.orderJourneryComplete);

/**
 * @swagger
 * /api/v1/admin/order-deliver:
 *   patch:
 *     summary: Mark order as delivered
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Order delivered
 *       401:
 *         description: Unauthorized
 */
router.patch("/order-deliver", logJourney, manageOrderController.orderJourneryComplete);

/**
 * @swagger
 * /api/v1/admin/order-cancel:
 *   patch:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Order cancelled
 *       401:
 *         description: Unauthorized
 */
router.patch("/order-cancel", logJourney, manageOrderController.orderJourneryComplete);

/**
 * @swagger
 * /api/v1/admin/edit-order:
 *   patch:
 *     summary: Edit order details
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Order edited
 *       401:
 *         description: Unauthorized
 */
router.patch("/edit-order", logJourney, manageOrderController.orderJourneryComplete);

/**
 * @swagger
 * /api/v1/admin/add-cheque:
 *   patch:
 *     summary: Add cheque to order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cheque added
 *       401:
 *         description: Unauthorized
 */
router.patch("/add-cheque", logJourney, manageOrderController.orderJourneryComplete);

/**
 * @swagger
 * /api/v1/admin/edit-cheque:
 *   patch:
 *     summary: Edit cheque details
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cheque edited
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/edit-cheque",
  activityOnSuccess(async (req) => {
    // eslint-disable-next-line global-require
    const { chequeDetail } = require("../models");
    const row = req.body?.chequeId
      ? await chequeDetail.findOne({ where: { id: req.body.chequeId }, attributes: ["orderId", "partnerOrderId"], raw: true })
      : null;
    if (!row) return null;
    return {
      orderId: row.orderId,
      partnerOrderId: row.partnerOrderId,
      action: "cheque_edited",
      summary: "Cheque details edited",
      details: { number: req.body?.cheque?.chequeNumber, bank: req.body?.cheque?.bankName, status: req.body?.cheque?.chequeStatus },
    };
  }),
  manageOrderController.eidtCheque,
);

//! Customer Management

/**
 * @swagger
 * /api/v1/admin/customer-management/payment-cards/{id}:
 *   get:
 *     summary: Get saved payment cards for customer
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment cards
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/customer-management/payment-cards/:id",
  customerController.fetchSavedCards,
);

/**
 * @swagger
 * /api/v1/admin/customer-management/dahboard-cards:
 *   get:
 *     summary: Get customer management dashboard cards
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard cards data
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/customer-management/dahboard-cards",
  customerController.viewCustomersManagement,
);

/**
 * @swagger
 * /api/v1/admin/customer-update/{id}:
 *   patch:
 *     summary: Update customer details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Customer updated
 *       401:
 *         description: Unauthorized
 */
router.patch("/customer-update/:id", auditRoute("customer", "updated"), customerController.updateCutomer);
router.patch("/customer-approve/:id", auditRoute("customer", "updated"), customerController.approveCustomer);

/**
 * @swagger
 * /api/v1/admin/customer-management/customer-list/{sr}:
 *   get:
 *     summary: Get customer list by sales rep
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: sr
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer list
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/customer-management/customer-list/:sr",
  customerController.customersList,
);

/**
 * @swagger
 * /api/v1/admin/qbo-customer-management/customer-list/{condition}:
 *   get:
 *     summary: Get customer list by QuickBooks status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: condition
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer list
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/qbo-customer-management/customer-list/:condition",
  customerController.customersListByQboStatus,
);

/**
 * @swagger
 * /api/v1/admin/qbo/synced-orders-admin-before-march-2026:
 *   get:
 *     summary: List orders with admin QBO invoice created before March 2026
 *     description: Returns customer and partner orders with quickBooksInvoiceId (admin) and quickBooksPaymentId, plus customerOrdersIdsOnly and partnerOrdersIdsOnly. Query date as DD-MM-YYYY (date param) or ISO (cutoff). Default cutoff 2026-03-01 UTC.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, example: "01-03-2026" }
 *         description: Optional. DD-MM-YYYY — orders with createdAt before start of that day (UTC). Overrides cutoff if both sent.
 *       - in: query
 *         name: cutoff
 *         schema: { type: string, example: "2026-03-01T00:00:00.000Z" }
 *         description: Optional. Exclusive upper bound for createdAt (ISO 8601).
 *     responses:
 *       200:
 *         description: Lists and counts
 *       403:
 *         description: Forbidden
 */
router.get(
  "/qbo/synced-orders-admin-before-march-2026",
  manageOrderController.listAdminQboSyncedOrdersBeforeMarch2026,
);

/**
 * @swagger
 * /api/v1/admin/qbo/payments/delete-admin:
 *   post:
 *     summary: Delete admin QBO payments for orders and update DB
 *     description: Uses each order's quickBooksPaymentId; clears quickBooksPaymentId, paymentSyncedToQBO, updates qboLastSync on success.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderIds]
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items: { type: integer }
 *               orderType:
 *                 type: string
 *                 enum: [customer, local-partner]
 *                 default: customer
 *     responses:
 *       200:
 *         description: deletedPayments, failedPayments, skipped, summary
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 */
router.post(
  "/qbo/payments/delete-admin",
  manageOrderController.deleteAdminQboPaymentsForOrders,
);

/**
 * @swagger
 * /api/v1/admin/qbo/payments/sync-admin:
 *   post:
 *     summary: Sync admin QBO payments for orders (bulk)
 *     description: Creates admin QBO payments only; partner QBO untouched. Requires payment done, admin invoice id, adminRealmId, and no admin payment id yet.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderIds]
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items: { type: integer }
 *               orderType:
 *                 type: string
 *                 enum: [customer, local-partner]
 *                 default: customer
 *     responses:
 *       200:
 *         description: synced, failed, skipped, ordersNotFound, summary
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 */
router.post(
  "/qbo/payments/sync-admin",
  manageOrderController.syncAdminQboPaymentsForOrders,
);

/**
 * @swagger
 * /api/v1/admin/qbo/invoices/delete-admin:
 *   post:
 *     summary: Delete admin QBO invoices for orders and update DB
 *     description: Uses quickBooksInvoiceId. Clears quickBooksInvoiceId, quickBooksPaymentId, paymentSyncedToQBO; sets qboLastSync. Remove linked QBO payments first if delete fails.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderIds]
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items: { type: integer }
 *               orderType:
 *                 type: string
 *                 enum: [customer, local-partner]
 *                 default: customer
 *     responses:
 *       200:
 *         description: deletedInvoices, failedInvoices, skipped, summary
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 */
router.post(
  "/qbo/invoices/delete-admin",
  manageOrderController.deleteAdminQboInvoicesForOrders,
);

/**
 * @swagger
 * /api/v1/admin/qbo/invoices/update-admin:
 *   post:
 *     summary: Update admin QBO invoices for orders (bulk)
 *     description: Pushes latest order data to existing quickBooksInvoiceId in admin QBO only. Skips orders with no admin invoice. Does not touch partner QBO.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderIds]
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items: { type: integer }
 *               orderType:
 *                 type: string
 *                 enum: [customer, local-partner]
 *                 default: customer
 *     responses:
 *       200:
 *         description: updatedOrderIds, failed, skipped, ordersNotFound, summary
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 */
router.post(
  "/qbo/invoices/update-admin",
  manageOrderController.updateAdminQboInvoicesForOrders,
);

/**
 * @swagger
 * /api/v1/admin/customer-management/customer-list/sale-rep/{sr}:
 *   get:
 *     summary: Get customer list by sales rep name
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: sr
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer list
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/customer-management/customer-list/sale-rep/:sr",
  customerController.customersList,
);

/**
 * @swagger
 * /api/v1/admin/customer-management/customer-list/sale-rep-id/{srId}:
 *   get:
 *     summary: Get customer list by sales rep ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: srId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer list
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/customer-management/customer-list/sale-rep-id/:srId",
  customerController.customersList,
);

/**
 * @swagger
 * /api/v1/admin/customer-management/customer-list/employee-id/{empId}:
 *   get:
 *     summary: Get customer list by employee ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: empId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Customer list
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/customer-management/customer-list/employee-id/:empId",
  customerController.customersList,
);

/**
 * @swagger
 * /api/v1/admin/customer-management/assign-sale-rep/{id}:
 *   patch:
 *     summary: Assign sales rep to customer
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               salesRepId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Sales rep assigned
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/customer-management/assign-sale-rep/:id",
  auditRoute("customer", "updated"),
  customerController.assignSalesRep,
);

/**
 * @swagger
 * /api/v1/admin/customer-management/invoice-customers-balance:
 *   get:
 *     summary: Get invoice customers balance
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Invoice customers balance
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/customer-management/invoice-customers-balance",
  customerController.InvoiceCustomers,
);

/**
 * @swagger
 * /api/v1/admin/customer-management/invoice-customers-balance/sales-rep/{srId}:
 *   get:
 *     summary: Get invoice customers balance by sales rep
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: srId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice customers balance
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/customer-management/invoice-customers-balance/sales-rep/:srId",
  customerController.InvoiceCustomers,
);

router.get(
  "/order-frequency/upcomming-orders",
  orderFrequencyController.orderAccordingToFrequency,
);

router.get(
  "/order-frequency/upcomming-orders/sale-rep/:srId",
  orderFrequencyController.orderAccordingToFrequency,
);

router.post(
  "/order-frequency/book-orders",
  orderFrequencyController.bookOrderAccordingToFrequency,
);

router.post(
  "/order-frequency/book-orders/sale-rep/:srId",
  orderFrequencyController.bookOrderAccordingToFrequency,
);

router.post("/send-quotation", salesRepController.sendQuotation);
router.post(
  "/send-quotation/sales-rep/:srId",
  salesRepController.sendQuotation,
);

router.post("/book-new-order", orderFrequencyController.bookNewOrder);

router.post(
  "/sales-rep/book-new-order/:srId",
  orderFrequencyController.bookNewOrder,
);

router.post("/add-customer/sales-rep/:srId", auditRoute("customer", "created"), salesRepController.addCustomer);
router.post("/add-customer", auditRoute("customer", "created"), salesRepController.addCustomer);

router.post(
  "/create-bank-setup-intent/sales-rep/:srId",
  salesRepController.createFinancialConnectionsSession,
);

router.post(
  "/attach-bank-account-setup/sales-rep/:srId",
  salesRepController.attachBankAccount,
);

router.get("/sales-rep/sales/:srId", salesRepController.salersMoney);

router.post(
  "/create-stripe-connect-account/:srId",
  salesRepController.stripeConnectAccount,
);

router.post(
  "/stripe-connect-account-url/:srId",
  salesRepController.stripeConnectAccountLink,
);

router.get(
  "/stripe-connect-account-dashboard/:srId",
  salesRepController.stripeConnectAccountDashboard,
);

router.get(
  "/stripe-connect-account-retrieve/:srId",
  salesRepController.stripeConnectAccountRetrive,
);

//! Supplier Management

router
  .route("/supplier/")
  .get(supplierController.getAllSuppliers) // For fetching all categories
  .post(auditRoute("supplier", "created"), uploadSupplierImage.single("image"), supplierController.createSupplier);

// Category by ID routes
router
  .route("/supplier/:id")
  .get(supplierController.getSupplier) // For fetching a category by ID
  .patch(auditRoute("supplier", "updated"), uploadSupplierImage.single("image"), supplierController.updateSupplier)
  .delete(auditRoute("supplier", "deleted"), supplierController.deleteSupplier);

router.patch(
  "/sales-rep/address-update/:srId",
  auditRoute("partner", "updated", (req) => req.params.srId),
  salesRepController.updateAddresses,
);

router.get(
  "/sales-rep/for-order-creation",
  salesRepController.getSalesRepForOrderCreation,
);

router.get(
  "/sales-rep/for-order-creation/:srId",
  salesRepController.getSalesRepForOrderCreation,
);

router
  .route("/sales-rep/")
  .get(salesRepController.getAllSalesRep) // For fetching all categories
  .post(auditRoute("partner", "created"), uploadSalesRepImage.single("image"), salesRepController.createSalesRep);

// Category by ID routes
router
  .route("/sales-rep/:id")
  .get(salesRepController.getSalesRep)
  .patch(auditRoute("partner", "updated"), uploadSalesRepImage.single("image"), salesRepController.updateSalesRep)
  .delete(auditRoute("partner", "deleted"), salesRepController.deleteSalesRep);

//! Address Management

router.patch(
  "/address-management/update-address/:id",
  addressController.updateAddress,
);

router.patch(
  "/address-management/update-billing-address/:id",
  addressController.updateBillingAddress,
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
  addressController.addCitiesInTerritory,
);

router.get(
  "/admin-reports/partner-commission",
  adminReportsController.partnerCommissionReport,
);

router.get(
  "/admin-reports/customer-report",
  adminReportsController.customerReport,
);

router.get(
  "/admin-reports/product-sales",
  adminReportsController.productSalesReport,
);

router.get(
  "/admin-reports/partner-commission",
  adminReportsController.partnerCommissionReport,
);

router.get(
  "/admin-reports/partner-creadit-limit",
  adminReportsController.partnerCreaditLimit,
);

router.get(
  "/admin-reports/unpaid-partner-balance",
  adminReportsController.unpaidPartnerbalanceReport,
);

router.get(
  "/admin-reports/direct-partner-summary",
  adminReportsController.directPartnerReportSummary,
);

router.get(
  "/admin-reports/customer-sales-report",
  adminReportsController.customerSalesSummary,
);

router.get(
  "/admin-reports/customer-detail-report/:userId",
  adminReportsController.customerDetailsSummary,
);

router.get(
  "/admin-reports/category-wise-product-sales-report",
  adminReportsController.categoryWiseProductSalesSummary,
);
/**
 * @swagger
 * /api/v1/admin/admin-reports/pulled-orders-receivable:
 *   get:
 *     summary: Get pulled orders receivable report with fallback intent id
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-01-01"
 *         description: Start date in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-01-31"
 *         description: End date in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
 *       - in: query
 *         name: salesRepId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Optional filter by sales rep id
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Pulled receivable orders list with pagination
 *       400:
 *         description: Validation error
 */
router.get(
  "/admin-reports/pulled-orders-receivable",
  adminReportsController.pulledOrdersReceivableReport,
);

/**
 * @swagger
 * /api/v1/admin/admin-reports/pullout-intent-unsynced-orders:
 *   get:
 *     summary: List dropship-partner regular orders by PulloutIntentId sync state
 *     description: |
 *       Returns customer orders that satisfy every gate required to push the
 *       `PulloutIntentId` custom field to admin QBO, optionally filtered by
 *       sync state.
 *
 *       Static filters applied:
 *         - `orders.deleted = 0`
 *         - `orders.paymentMethod = 'Bank Check'` (case-insensitive via MySQL default collation)
 *         - `orders.userId`, `orders.salesRepId`, `orders.pulloutIntentId` all present
 *         - `orders.quickBooksInvoiceId` is not null
 *         - `orders.type = 'regular-order'`
 *         - `salesRep.partnerType = 'dropship-partner'`
 *
 *       Sync-state filter — `syncStatus` query param (default `unsynced`):
 *         - `unsynced` -> `pulloutIntentIdSynced <> 'synced'` (i.e. `not-eligible` or `eligible`)
 *         - `synced`   -> `pulloutIntentIdSynced = 'synced'` (audit view of already-synced orders)
 *         - `all`      -> no filter on sync state
 *
 *       Optional query filters: `startDate`/`endDate` (on `orders.on`) and `salesRepId`.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: syncStatus
 *         required: false
 *         schema:
 *           type: string
 *           enum: [unsynced, synced, all]
 *           default: unsynced
 *         description: |
 *           Which sync-state bucket to return.
 *           - `unsynced` (default): orders whose Pullout custom field still
 *             needs to be pushed to admin QBO.
 *           - `synced`: orders whose Pullout custom field has already been
 *             confirmed on admin QBO. Useful for an "Already synced" audit tab.
 *           - `all`: both buckets together.
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-01-01"
 *         description: Optional start date in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS. Must be paired with endDate.
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-01-31"
 *         description: Optional end date in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS. Must be paired with startDate.
 *       - in: query
 *         name: salesRepId
 *         required: false
 *         schema:
 *           type: integer
 *         description: Optional filter by sales rep id
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Pullout custom-field orders list with pagination
 *       400:
 *         description: Validation error
 */
router.get(
  "/admin-reports/pullout-intent-unsynced-orders",
  qboCustomFieldSyncController.pulloutIntentUnsyncedOrdersReport,
);

/**
 * @swagger
 * /api/v1/admin/qbo/pullout-custom-field/sync:
 *   post:
 *     summary: Bulk-push the PulloutIntentId custom field to admin QBO invoices for the selected orders
 *     description: |
 *       Accepts a list of `orderIds` selected from the
 *       `pullout-intent-unsynced-orders` report and, for each one, runs the
 *       sparse-update flow against the admin's QBO invoice via
 *       `services/qboInvoiceCustomFieldPatch.js::patchAdminInvoiceCustomFields`.
 *
 *       Per-order failures never break the batch — every order is processed
 *       inside its own try/catch and the endpoint always returns HTTP 200
 *       with a detailed summary plus per-order results.
 *
 *       Behaviour per order:
 *         - Gates fail (no Bank Check / no pulloutIntentId / admin-skip / etc.) -> `outcome: "skipped"`.
 *         - Invoice paid (Balance 0) -> `outcome: "skipped"` with reason `"invoice_already_paid"`.
 *         - QBO already carries the same value -> `outcome: "skipped"` with reason `"pullout_already_set"` (DB state is reconciled to `synced`).
 *         - Sparse patch succeeds -> `outcome: "synced"`, DB state moves to `pulloutIntentIdSynced='synced'`.
 *         - No admin invoice yet (rare since the report filters those out) -> `outcome: "synced"` and the admin invoice is created from scratch.
 *         - Any error (QBO down, customer mapping missing, etc.) -> `outcome: "failed"` with a descriptive `reason`.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderIds]
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 maxItems: 100
 *                 example: [1092, 1234, 1500]
 *                 description: Positive integer order ids selected on the report. Max 100 per request.
 *               orderType:
 *                 type: string
 *                 enum: [customer, local-partner]
 *                 default: customer
 *                 description: Which Sequelize model the ids belong to. Defaults to "customer".
 *     responses:
 *       200:
 *         description: Sync results for every requested order id.
 *       400:
 *         description: Validation error (empty array, too many ids, invalid id, invalid orderType).
 */
router.post(
  "/qbo/pullout-custom-field/sync",
  qboCustomFieldSyncController.bulkSyncPulloutCustomField,
);

//! SUPPLIER REPORTS SECTION

router.get(
  "/supplier-reports/assigned-orders-report/:supId",
  supplierReportsController.assignedOrdersReport,
);

router.get(
  "/supplier-reports/top-products-ordered-report/:supId",
  supplierReportsController.topProductsOrderedReport,
);

router.get(
  "/supplier-reports/top-products-ordered-report/:supId",
  supplierReportsController.topProductsOrderedReport,
);

//! SALESREP REPORTS SECTION

router.get(
  "/sales-rep-reports/orders-placed-report/:srId",
  salesRepReportsController.ordersPlacedReport,
);

router.get(
  "/sales-rep-reports/commission-summary-report/:srId",
  salesRepReportsController.commissionSummaryReport,
);

router.get(
  "/sales-rep-reports/customer-report/:srId",
  salesRepReportsController.customerReport,
);

router.get(
  "/sales-rep-reports/partner-creadit-limit/:srId",
  salesRepReportsController.partnerCreaditLimit,
);

//! DashBoard SECTION

router.get("/dashboard", dashboardsController.adminDashboard);

router.get(
  "/sales-rep-dashboard/:srId",
  dashboardsController.salesRepDashboard,
);

router.get(
  "/dashboard/local-partner-employee",
  dashboardsController.employeeDashboardlocalPartner,
);

router.get(
  "/dashboard/admin-employee",
  dashboardsController.employeeDashboardAdmin,
);
router.get("/supplier-dashboard/:id", dashboardsController.supplierDashboard);

router.get("/dashboard/sales", dashboardsController.getSalesDashboard);

router.get(
  "/dashboard/franchisee-sales",
  dashboardsController.getFranchiseeSalesDashboard,
);

router.get(
  "/dashboard/local-partner-sales/:srId",
  dashboardsController.getLocalPartnerSalesDashboard,
);

router.get(
  "/orders-pending-pullouts/:srId",
  manageOrderController.ordersPendingPullouts,
);

router.post(
  "/pull-payments-from-patners-banka-account/:srId",
  pulloutPaymentsController.pullPaymentsFromPatnersBankAccounts,
);

router.post(
  "/shipping-charges-on-weight",
  manageOrderController.findShippingCompanyForWeight,
);

router.post(
  "/shipping-charges-on-weight/customer/:id",
  manageOrderController.findShippingCompanyForWeight,
);

router.get(
  "/shipping-charges-list",
  shippingCompanyController.getAllShippingCompany,
);

router.patch(
  "/shipping-charges-update",
  shippingCompanyController.updateShippingCompany,
);

router.get(
  "/order-navigation-counts",
  manageOrderController.orderNavigationCounts,
);

router.get(
  "/order-navigation-counts/sales-rep/:srId",
  manageOrderController.orderNavigationCountsLocalPatner,
);

router.get(
  "/order-navigation-counts/supplier/:id",
  manageOrderController.orderNavigationCountsSupplier,
);

router.get("/view-customer-detail/:id", customerController.customerDetail);

router.delete("/delete-customer/:id", auditRoute("customer", "deleted"), customerController.deleteCustomer);

router.delete("/customer-discounts/:userId", auditRoute("customer", "updated", (req) => req.params.userId), customerController.dicounts);

router.post(
  "/partner-order/book-new-order",
  patnerOrderController.bookNewPartnerOrder,
);

router.get("/partner-order/orders-list", patnerOrderController.allPartnerOrder);
router.get(
  "/quickbooks-partner-order-management/:qbo",
  patnerOrderController.allPartnerOrder,
);

router.get(
  "/partner-order/order-details/:id",
  patnerOrderController.partnerOrderDetails,
);

router.patch(
  "/partner-order/update-order/:orderId",
  auth.restrictTo(...INVOICE_EDITOR_ENTITIES),
  patnerOrderController.updatePartnerOrder,
);

router.get(
  "/local-partner/payment-methods/:id",
  patnerOrderController.fetchSavedPaymentMethods,
);

router.get(
  "/partner-order-navigation-counts",
  patnerOrderController.partnerOrderNavigationCounts,
);

router.get(
  "/partner-order-navigation-counts/sales-rep/:srId",
  patnerOrderController.partnerOrderNavigationCountsLocalPatner,
);

router.get(
  "/partner-order-navigation-counts/supplier/:id",
  patnerOrderController.partnerOrderNavigationCountsSupplier,
);

router.post(
  "/partner-order/pull-payment-from-bank/:partnerOrderId",
  activityOnSuccess((req) => ({ partnerOrderId: req.params.partnerOrderId, action: "payment_pulled", summary: "Bank payment pulled from partner" })),
  patnerOrderController.pullPartnerOrderPayment,
);

// Admin-panel inboxes (HQ only; customers, suppliers and partners also hold valid tokens).
router.get("/coffee-machine/requests", auth.restrictTo("admin", "subAdmin", "adminEmployee"), machineController.coffeeMachineQuries);
router.get("/get-in-touch", auth.restrictTo("admin", "subAdmin", "adminEmployee"), leadController.getAllGetInTouch);
router.delete("/get-in-touch/:id", auth.restrictTo("admin", "subAdmin", "adminEmployee"), leadController.deleteGetInTouch);

router
  .route("/coffee-machine")
  .get(machineController.getAllMachines) // For fetching a product by ID
  .post(uploadMachineImage.single("image"), machineController.createMachines); // For deleting a product by ID

// Category by ID routes
router
  .route("/coffee-machine/:id")
  .get(machineController.getMachines) // For fetching a product by ID
  .delete(machineController.deleteMachines) // For deleting a product by IDWWW
  .patch(uploadMachineImage.single("image"), machineController.updateMachines); // For updating a product (including image upload);

router.post(
  "/order-management/create-payment-intent-for-user",
  manageOrderController.createPaymentIntentForUser,
);

module.exports = router;
