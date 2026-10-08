const express = require("express");
const authController = require("../controllers/customer/authController");
const orderController = require("../controllers/customer/orderController");
const profileController = require("../controllers/customer/profileController");
const manageOrderController = require("../controllers/admin/manageOrderController");
const productController = require("../controllers/admin/productController");
const customerController = require("../controllers/admin/customerController");
const machineController = require("../controllers/admin/machineController");
const machineSubController = require("../controllers/customer/machineSubController");
const leadController = require("../controllers/admin/leadController");
const rateLimit = require("express-rate-limit");

// Public machine-lead form: a few submissions per minute per IP (bots / email abuse).
const publicLeadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.PUBLIC_LEAD_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again in a minute." },
});
const subscriptionController = require("../controllers/admin/subscriptionController");
const categoryController = require("../controllers/admin/categoriesController");
const userController = require("../controllers/userController");
const multiInvoiceCheckoutController = require("../controllers/customer/multiInvoiceCheckoutController");
const Authorization = require("../middlewares/protect");
const { requireOwnSubscription } = require("../middlewares/subscriptionAccess");
// Customers only reach their own records (staff: HQ any, partners their own customers).
const {
  ownCustomerParam,
  ownOrderParam,
  ownCustomerInBody,
  ownProfileAddresses,
} = require("../middlewares/customerAccess");
const { invoicePayAccess, payLinkLimiter } = require("../middlewares/invoicePayAccess");
const { requestContext } = require("../utils/requestContext");
const { auditRoute } = require("../utils/auditTrail");
const { hideMachinePrices, fillMachineLeadValue } = require("../middlewares/machinePricing");
const {
  signupRateLimiter,
  loginRateLimiter,
  forgotPasswordRateLimiter,
} = require("../middlewares/loginRateLimit");
const {
  setTemporaryBlockContext,
} = require("../middlewares/temporaryBlockFlow");
const router = express.Router();

/**
 * @swagger
 * /api/v1/users/product/{userId}:
 *   get:
 *     summary: Get all products for a specific user
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
// router.get(`/product/:userId`, productController.getAllProductsUser);

/**
 * @swagger
 * /api/v1/users/signup:
 *   post:
 *     summary: Register a new user
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
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *               name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *       400:
 *         description: Bad request - validation error
 */
router.post("/signup", signupRateLimiter, authController.signup);

/**
 * @swagger
 * /api/v1/users/subscription/{id}:
 *   get:
 *     summary: Get subscription details by ID
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription details
 *       404:
 *         description: Subscription not found
 */
router.get(
  "/subscription/:id",
  Authorization.protect,
  requireOwnSubscription,
  subscriptionController.getSubscription,
);

/**
 * @swagger
 * /api/v1/users/subscription/{id}/create-payment-intent/{userId}:
 *   get:
 *     summary: Create payment intent for subscription (GET)
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subscription ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Payment intent created
 */
router.get(
  "/subscription/:id/create-payment-intent/:userId",
  Authorization.protect,
  requireOwnSubscription,
  subscriptionController.createPaymentIntent,
);

/**
 * @swagger
 * /api/v1/users/subscription/{id}/create-payment-intent/{userId}:
 *   post:
 *     summary: Create payment intent for subscription (POST)
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subscription ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Payment intent created
 */
router.post(
  "/subscription/:id/create-payment-intent/:userId",
  Authorization.protect,
  requireOwnSubscription,
  subscriptionController.createPaymentIntent,
);

/**
 * @swagger
 * /api/v1/users/subscription/{id}/confirm-payment:
 *   post:
 *     summary: Confirm subscription payment
 *     tags: [Subscriptions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subscription ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment confirmed
 */
router.post(
  "/subscription/:id/confirm-payment",
  Authorization.protect,
  requireOwnSubscription,
  subscriptionController.confirmSubscriptionPayment,
);
/**
 * @swagger
 * /api/v1/users/login:
 *   post:
 *     summary: User login
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
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             description: JWT token in cookie
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 */
router.post(
  "/login",
  loginRateLimiter,
  setTemporaryBlockContext("login"),
  authController.login,
);

/**
 * @swagger
 * /api/v1/users/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", authController.logout);

/**
 * @swagger
 * /api/v1/users/otp/verfication:
 *   post:
 *     summary: Verify OTP
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
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post("/otp/verfication", authController.otpVerification);

/**
 * @swagger
 * /api/v1/users/forgot-password:
 *   post:
 *     summary: Request password reset
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
  forgotPasswordRateLimiter,
  setTemporaryBlockContext("forgot_password"),
  authController.forgotPassword,
);

/**
 * @swagger
 * /api/v1/users/reset-password:
 *   post:
 *     summary: Reset password with token
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
router.post("/reset-password", authController.resetPassword);

/**
 * @swagger
 * /api/v1/users/resend-otp/{type}:
 *   post:
 *     summary: Resend OTP
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: OTP type (signup, login, etc.)
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
 *         description: OTP resent successfully
 */
router.post("/resend-otp/:type", authController.resendOtp);

/**
 * @swagger
 * /api/v1/users/financial-connections-session/{id}:
 *   post:
 *     summary: Create Stripe ACH payment session
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Financial connection session created
 */
router.post(
  "/financial-connections-session/:id",
  authController.stripeAchPayment,
);

/**
 * @swagger
 * /api/v1/users/throw-notification:
 *   post:
 *     summary: Test notification endpoint
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Notification test
 */
router.post("/throw-notification", orderController.notificationTesting);

/**
 * @swagger
 * /api/v1/users/sync-customer-to-stripe:
 *   post:
 *     summary: Sync customer to Stripe
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Customer synced to Stripe
 */
router.post("/sync-customer-to-stripe", orderController.createStripeCustomers);

/**
 * @swagger
 * /api/v1/users/sheet-upload:
 *   post:
 *     summary: Upload sheet data
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Sheet uploaded successfully
 */
router.post("/sheet-upload", orderController.SheetUplod);

/**
 * @swagger
 * /api/v1/users/product:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of all products
 */

/**
 * @swagger
 * /api/v1/users/coffee-machine/contact:
 *   post:
 *     summary: Submit coffee machine contact form
 *     tags: [Users]
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
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contact form submitted
 */
router.post(
  "/coffee-machine/contact",
  publicLeadLimiter,
  machineSubController.coffeeMachineContact,
);

/**
 * @swagger
 * /api/v1/users/coffee-machine:
 *   get:
 *     summary: Get all coffee machines
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of coffee machines
 */
// The websites never show machine prices: returned without price / pricePer.
router.get(
  "/coffee-machine",
  hideMachinePrices,
  machineController.getAllMachines,
);

/**
 * @swagger
 * /api/v1/users/coffee-machine/{id}:
 *   get:
 *     summary: Get coffee machine by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Coffee machine details
 */
router.get(
  "/coffee-machine/:id",
  hideMachinePrices,
  machineController.getMachines,
);

/**
 * @swagger
 * /api/v1/users/create-lead:
 *   post:
 *     summary: Create a new lead
 *     tags: [Users]
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
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lead created successfully
 */
router.post("/create-lead", publicLeadLimiter, fillMachineLeadValue, leadController.createPublicLead);

/**
 * @swagger
 * /api/v1/users/get-in-touch:
 *   post:
 *     summary: Submit Get in Touch form (public)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               company:
 *                 type: string
 *               teamSize:
 *                 type: string
 *               date:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Submission saved and notification sent
 */
router.post("/get-in-touch", publicLeadLimiter, userController.getInTouch);

/**
 * @swagger
 * /api/v1/users/create-users-bulk:
 *   post:
 *     summary: Create multiple users in bulk
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               users:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Users created in bulk
 */
router.post("/create-users-bulk", orderController.createUsersBulk);

/**
 * @swagger
 * /api/v1/users/create-order-direct:
 *   post:
 *     summary: Create order directly
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               items:
 *                 type: array
 *     responses:
 *       200:
 *         description: Order created directly
 */
router.post("/create-order-direct", orderController.createOrderDirect);
router.use(Authorization.protect);
// Who is acting, for model hooks (order created / paid).
router.use(requestContext);

/**
 * @swagger
 * /api/v1/users/book-order/{id}:
 *   post:
 *     summary: Book an order (Protected Route)
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
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *               addressId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Order booked successfully
 *       401:
 *         description: Unauthorized - Authentication required
 */
router.post("/book-order/:id", ownCustomerInBody, orderController.bookOrder);

/**
 * @swagger
 * /api/v1/users/book-order:
 *   post:
 *     summary: Book an order without ID (Protected Route)
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
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *               addressId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Order booked successfully
 *       401:
 *         description: Unauthorized - Authentication required
 */
router.post("/book-order", ownCustomerInBody, orderController.bookOrder);

/**
 * @swagger
 * /api/v1/users/create-payment-intent:
 *   post:
 *     summary: Create payment intent for order
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
 *               amount:
 *                 type: number
 *               orderId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Payment intent created
 *       401:
 *         description: Unauthorized
 */
router.post("/create-payment-intent", ownCustomerInBody, orderController.paymentIntent);

/**
 * @swagger
 * /api/v1/users/orders:
 *   get:
 *     summary: Get all orders for authenticated user
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
 * /api/v1/users/invoices/:
 *   get:
 *     summary: Get all invoices for authenticated user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of invoices
 *       401:
 *         description: Unauthorized
 */
router.get("/invoices/", manageOrderController.allOrder);

/**
 * @swagger
 * /api/v1/users/order-details/{id}:
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
router.get("/order-details/:id", ownOrderParam("id"), manageOrderController.orderDetails);

/**
 * @swagger
 * /api/v1/users/drawer/update-profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
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
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put(
  "/drawer/update-profile",
  ownProfileAddresses,
  auditRoute("customer", "updated", (req) => req.user?.id),
  profileController.updateProfile,
);

/**
 * @swagger
 * /api/v1/users/address/add-new/{id}:
 *   post:
 *     summary: Add new address for user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Address added successfully
 *       401:
 *         description: Unauthorized
 */
router.post("/address/add-new/:id", ownCustomerParam("id"), profileController.addAddress);

/**
 * @swagger
 * /api/v1/users/address/view-all:
 *   get:
 *     summary: Get all addresses for authenticated user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of addresses
 *       401:
 *         description: Unauthorized
 */
router.get("/address/view-all", profileController.getAllAddress);
// router.get('/product', profileController.productController);

/**
 * @swagger
 * /api/v1/users/product:
 *   get:
 *     summary: Get all products (Protected)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of all products
 *       401:
 *         description: Unauthorized
 */
router.get(`/product/:userId`, productController.getAllProductsUser);
router.get(`/product`, productController.getAllProductsUser);
router.get("/category", categoryController.getAllCatagories);

/**
 * @swagger
 * /api/v1/users/view-customer-detail/{id}:
 *   get:
 *     summary: View customer details
 *     tags: [Users]
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
 *         description: Customer details
 *       401:
 *         description: Unauthorized
 */
router.get("/view-customer-detail/:id", ownCustomerParam("id"), customerController.customerDetail);

/**
 * @swagger
 * /api/v1/users/invoices/{orderId}/create-payment-intent:
 *   post:
 *     summary: Create payment intent for invoice
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
 *         description: Payment intent created for invoice
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/invoices/:orderId/create-payment-intent",
  payLinkLimiter,
  invoicePayAccess("orderId"),
  manageOrderController.createPaymentIntentForUser,
);

/**
 * @swagger
 * /api/v1/users/invoices/{orderId}/confirm-payment:
 *   post:
 *     summary: Confirm payment for invoice
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
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment confirmed
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/invoices/:orderId/confirm-payment",
  payLinkLimiter,
  manageOrderController.confirmPaymentForInvoiceIntent,
);

/**
 * @swagger
 * /api/v1/users/multi-invoice-checkout/fetch:
 *   post:
 *     summary: Create combined Stripe checkout for multiple unpaid invoices
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
 *             required:
 *               - orderIds
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Checkout session created or reused
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/multi-invoice-checkout/fetch",
  multiInvoiceCheckoutController.fetchMultiInvoiceCheckout,
);

/**
 * @swagger
 * /api/v1/users/subscriptions:
 *   get:
 *     summary: List all subscriptions for authenticated user
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of subscriptions
 *       401:
 *         description: Unauthorized
 */
router.get("/subscriptions", subscriptionController.listSubscriptions);

/**
 * @swagger
 * /api/v1/users/subscriptions/{id}/cancel:
 *   post:
 *     summary: Cancel a subscription
 *     tags: [Subscriptions]
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
 *         description: Subscription cancelled
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/subscriptions/:id/cancel",
  requireOwnSubscription,
  subscriptionController.cancelSubscription,
);

/**
 * @swagger
 * /api/v1/users/subscriptions/{id}/reactivate:
 *   post:
 *     summary: Reactivate a cancelled subscription
 *     tags: [Subscriptions]
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
 *         description: Subscription reactivated
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/subscriptions/:id/reactivate",
  requireOwnSubscription,
  subscriptionController.reactivateSubscription,
);

module.exports = router;
