# Busy Beans Backend - Complete Project Overview

## 📋 Project Summary

**Busy Beans Coffee** is a comprehensive B2B coffee distribution platform backend built with Node.js, Express, and MySQL (via Sequelize ORM). The system manages coffee product sales, orders, customer relationships, lead management, and integrates with QuickBooks Online (QBO) and Stripe for accounting and payments.

---

## 🏗️ Architecture Overview

### Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL with Sequelize ORM
- **Caching**: Redis (ioredis)
- **Authentication**: JWT (jsonwebtoken), bcryptjs
- **Payment Processing**: Stripe
- **Accounting Integration**: QuickBooks Online (intuit-oauth)
- **Email**: Nodemailer with EJS templates
- **File Upload**: Multer with Sharp for image processing
- **PDF Generation**: Puppeteer
- **Security**: Helmet, express-rate-limit, express-mongo-sanitize, hpp

### Server Configuration

- **Entry Point**: `bb.js` (starts the server)
- **App Configuration**: `app.js` (Express app setup)
- **Port**: 8011 (default)
- **Host**: 192.168.18.21 (configured for local network)
- **Database Sync**: Controlled via `syncDb` flag in `bb.js`

---

## 📁 Project Structure

```
busy-beans-backend/
├── app.js                    # Express app configuration
├── bb.js                     # Server entry point
├── redis_connect.js          # Redis connection setup
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (gitignored)
│
├── config/                   # Configuration files
│   └── config.json          # Database config (gitignored)
│
├── models/                   # Sequelize models (37 files)
│   ├── index.js             # Model loader and associations
│   ├── user.js              # Customer/user model
│   ├── Lead.js              # Lead management model
│   ├── order.js             # Order model
│   ├── salesRep.js          # Sales representative/local partner
│   ├── product.js           # Product catalog
│   ├── supplier.js          # Supplier management
│   ├── employee.js          # Employee management
│   ├── coffeeMachine.js     # Coffee machine catalog
│   └── ... (34 more models)
│
├── controllers/             # Business logic
│   ├── admin/              # Admin-specific controllers (21 files)
│   │   ├── leadController.js
│   │   ├── customerController.js
│   │   ├── manageOrderController.js
│   │   ├── salesRepController.js
│   │   ├── productController.js
│   │   └── ...
│   ├── customer/           # Customer-facing controllers
│   ├── events/             # Event handlers (9 files)
│   ├── webhook/            # Webhook handlers
│   ├── errorController.js  # Global error handling
│   ├── handlerFactory.js   # CRUD factory functions
│   ├── quickBooksInvoice.js
│   ├── stripe.js           # Stripe payment handling
│   └── userController.js
│
├── routes/                  # API route definitions
│   ├── adminRoutes.js      # Admin API routes (730 lines)
│   ├── userRoutes.js       # User/customer routes
│   ├── leadRoutes.js       # Lead management routes
│   ├── qboRoutes.js        # QuickBooks integration routes
│   ├── webhooks.js         # Webhook routes
│   └── viewRoutes.js       # EJS view routes
│
├── services/               # Business services (12 files)
│   ├── orderService.js
│   ├── qboAuthService.js
│   ├── qboCustomerService.js
│   ├── qboInvoice.js
│   ├── qboInvoiceUpdate.js
│   ├── paymentSyncService.js
│   └── ...
│
├── middlewares/            # Custom middleware
│   ├── protect.js          # JWT authentication
│   ├── qboAuth.js          # QuickBooks auth
│   └── qboConnected.js     # QuickBooks connection check
│
├── helper/                 # Email templates & helpers (28 files)
│   ├── transpoter.js       # Nodemailer config
│   ├── coffeeMachineQuotation.js
│   ├── orderEmailtoCustomer.js
│   ├── sentInvoiceEmail.js
│   ├── userAccountCreated.js
│   └── ... (24 more email templates)
│
├── utils/                  # Utility functions (18 files)
│   ├── appError.js         # Custom error class
│   ├── catchAsync.js       # Async error wrapper
│   ├── apiFeatures.js      # Query features (filter, sort, paginate)
│   ├── response.js         # Standard response format
│   ├── encryption.js       # Data encryption
│   ├── redisHandling.js    # Redis operations
│   └── ...
│
├── views/                  # EJS templates
│   └── ... (4 view files)
│
└── public/                 # Static files
    ├── products/           # Product images
    ├── suppliers/          # Supplier images
    ├── sales-rep/          # Sales rep images
    └── machines/           # Coffee machine images
```

---

## 🗄️ Database Models (37 Models)

### Core User Models

#### 1. **user** (`user.js`)
Customer/end-user accounts
- **Key Fields**: name, email, password, phoneNumber, companyName, stripeCustomerId, qboCustomerId
- **Features**: Password hashing (bcrypt), email validation, soft delete (paranoid)
- **Associations**: addresses, orders, orderFrequencies, billingAddresses, deviceTokens, userDiscounts

#### 2. **salesRep** (`salesRep.js`)
Local partners/sales representatives
- **Key Fields**: srName, email, password, territoryName, partnerType (direct/dropship), connectAccountId, creditLimit
- **Features**: Stripe Connect integration, QuickBooks sync
- **Associations**: users, orders, partnerOrders, employees, addresses, qboCredentials

#### 3. **supplier** (`supplier.js`)
Coffee suppliers
- **Key Fields**: name, email, address, contact info
- **Associations**: skuSuppliers, orders

#### 4. **employee** (`employee.js`)
Employees under admin or sales reps
- **Key Fields**: name, email, role, permissions
- **Associations**: employeePermissions, salesRep

### Product & Catalog Models

#### 5. **product** (`product.js`)
Coffee products
- **Key Fields**: name, quantity, weight, unit, price, wholesalePrice, sku, grind, productCode
- **Associations**: items, partnerOrderItems, skuSuppliers, userDiscounts

#### 6. **category** (`category.js`)
Product categories
- **Associations**: products

#### 7. **coffeeMachine** (`coffeeMachine.js`)
Coffee machine catalog for quotations
- **Key Fields**: name, description, specifications, image

### Order Management Models

#### 8. **order** (`order.js`)
Customer orders
- **Key Fields**: 
  - Pricing: totalBill, subTotal, discountPrice, vat, shippingCharges
  - Payment: paymentMethod, paymentStatus, invoiceNumber, paymentIntentId
  - Status: orderStatus, trackingNumber, shippingCompany
  - Frequency: frequency (just-once, weekly, every-two-weeks, every-four-weeks)
  - QuickBooks: quickBooksInvoiceId, qboLastSync
  - Commission: localPatnerCommission, adminReceivableAmount
- **Associations**: items, orderHistory, chequeDetail, orderFrequency, transfersToSalesRep, user, salesRep

#### 9. **item** (`item.js`)
Order line items
- **Associations**: order, product

#### 10. **partnerOrder** (`partnerOrder.js`)
Orders placed by local partners (wholesale)
- **Similar structure to order model**
- **Associations**: partnerOrderItems, salesRep

#### 11. **orderFrequency** (`orderFrequency.js`)
Recurring order schedules
- **Key Fields**: frequency, nextOrderDate, status
- **Associations**: order, user, salesRep

#### 12. **orderHistory** (`orderHistory.js`)
Order status change logs
- **Associations**: order

### Lead Management Models

#### 13. **Lead** (`Lead.js`)
Sales leads and enquiries
- **Key Fields**:
  - Contact: company, contactName, contactPhone, contactEmail
  - Address: addressLineOne, city, state, country, zipCode
  - Tracking: leadSource, leadDate, status, tag (Hot/Warm/Cold)
  - Pipeline: status (New Enquiry → Contacted → Quoted → Demo → Negotiation → Nurture → WON/LOST)
  - Follow-up: followUpNextDate, followUpNeeded, followUpFeedback
  - Quotation: quotationSent, quotationAmount, quotationDateSent
  - Site Visit: siteVisitScheduled, siteVisitDate, siteVisitCompleted
  - Machine Info: machineId, machineName
  - Lost Lead: lostReason, customerFeedback
- **Associations**: LeadLog (activity logs)

### Address Models

#### 14. **address** (`address.js`)
Shipping addresses
- **Associations**: user, salesRep

#### 15. **billingAddress** (`billingAddress.js`)
Billing addresses
- **Associations**: user, salesRep

#### 16. **countryInSystem** (`countryInSystem.js`)
Countries available in system

#### 17. **stateInSystem** (`stateInSystem.js`)
States/provinces
- **Associations**: salesRep (territory assignment)

#### 18. **cityInSystem** (`cityInSystem.js`)
Cities

#### 19. **territory** (`territory.js`)
Sales territories

### Payment & Financial Models

#### 20. **cheque** (`cheque.js`)
Cheque payment details
- **Associations**: order

#### 21. **transfersToSalesRep** (`transfersToSalesRep.js`)
Commission transfers to sales reps
- **Associations**: order, salesRep

#### 22. **salesFromPatners** (`salesFromPatners.js`)
Sales tracking from partners
- **Associations**: salesRep

### QuickBooks Integration Models

#### 23. **qboCredientials** (`qboCredientials.js`)
QuickBooks credentials
- **Associations**: salesRep

#### 24. **qboToken** (`qboToken.js`)
QuickBooks OAuth tokens
- **Associations**: salesRep

#### 25. **qboCustomerMap** (`qboCustomerMap.js`)
Mapping between local users and QBO customers
- **Associations**: user, salesRep

### System Models

#### 26. **logs** (`logs.js`)
System activity logs

#### 27. **statuses** (`statuses.js`)
Order status definitions

#### 28. **shippingCompanies** (`shippingCompanies.js`)
Shipping company configurations

#### 29. **deviceToken** (`deviceToken.js`)
Push notification tokens
- **Associations**: user, salesRep

#### 30. **pushNotifications** (`pushNotifications.js`)
Push notification logs

#### 31. **userDiscount** (`userDiscount.js`)
Customer-specific product discounts
- **Associations**: user, product

#### 32. **skuSupplier** (`skuSupplier.js`)
Product-supplier mappings
- **Associations**: product, supplier

#### 33. **permission** (`permission.js`)
Permission definitions

#### 34. **employeePermission** (`employeePermission.js`)
Employee permission assignments
- **Associations**: employee, permission

#### 35. **account** (`account.js`)
Account management

---

## 🛣️ API Routes

### Main Route Groups

1. **`/api/v1/users`** - User/customer routes
2. **`/api/v1/admin`** - Admin routes (extensive)
3. **`/api/v1/leads`** - Lead management routes
4. **`/qbo`** - QuickBooks integration routes
5. **`/webhook`** - Webhook handlers (Stripe, etc.)
6. **`/view`** - EJS view routes

### Admin Routes Breakdown (`adminRoutes.js`)

#### Authentication
- `POST /api/v1/admin/login` - Admin login
- `POST /api/v1/admin/login/sales-rep` - Sales rep login
- `POST /api/v1/admin/login/supplier` - Supplier login
- `POST /api/v1/admin/forgot-password` - Password reset
- `POST /api/v1/admin/otp-verification` - OTP verification

#### Product Management
- `GET /api/v1/admin/product` - Get all products
- `POST /api/v1/admin/product` - Create product (with image upload)
- `GET /api/v1/admin/product/:id` - Get product by ID
- `PATCH /api/v1/admin/product/:id` - Update product
- `DELETE /api/v1/admin/product/:id` - Delete product

#### Category Management
- `GET /api/v1/admin/category` - Get all categories
- `POST /api/v1/admin/category` - Create category
- `PATCH /api/v1/admin/category/:id` - Update category
- `DELETE /api/v1/admin/category/:id` - Delete category

#### Order Management
- `GET /api/v1/admin/orders` - Get all orders
- `GET /api/v1/admin/order-details/:id` - Get order details
- `PATCH /api/v1/admin/order-management/update-order/:orderId` - Update order
- `DELETE /api/v1/admin/order-management/delete-order/:orderId` - Delete order
- `POST /api/v1/admin/order-management/send-invoice/:orderId` - Send invoice
- `PATCH /api/v1/admin/assign-supplier` - Assign supplier to order
- `PATCH /api/v1/admin/order-dispatch` - Mark order as dispatched
- `PATCH /api/v1/admin/order-deliver` - Mark order as delivered
- `PATCH /api/v1/admin/order-cancel` - Cancel order

#### Customer Management
- `GET /api/v1/admin/customer-management/customer-list/:condition` - Get customers
- `PATCH /api/v1/admin/customer-update/:id` - Update customer
- `PATCH /api/v1/admin/customer-management/assign-sale-rep/:id` - Assign sales rep
- `GET /api/v1/admin/customer-management/invoice-customers-balance` - Invoice balances
- `GET /api/v1/admin/view-customer-detail/:id` - Customer details
- `DELETE /api/v1/admin/delete-customer/:id` - Delete customer

#### Sales Rep Management
- `GET /api/v1/admin/sales-rep` - Get all sales reps
- `POST /api/v1/admin/sales-rep` - Create sales rep
- `GET /api/v1/admin/sales-rep/:id` - Get sales rep
- `PATCH /api/v1/admin/sales-rep/:id` - Update sales rep
- `DELETE /api/v1/admin/sales-rep/:id` - Delete sales rep
- `POST /api/v1/admin/add-customer` - Add customer
- `POST /api/v1/admin/send-quotation` - Send quotation

#### Supplier Management
- `GET /api/v1/admin/supplier` - Get all suppliers
- `POST /api/v1/admin/supplier` - Create supplier
- `GET /api/v1/admin/supplier/:id` - Get supplier
- `PATCH /api/v1/admin/supplier/:id` - Update supplier
- `DELETE /api/v1/admin/supplier/:id` - Delete supplier

#### Employee Management
- `POST /api/v1/admin/employee` - Create employee
- `GET /api/v1/admin/employees` - Get all employees
- `GET /api/v1/admin/employee/:employeeId` - Get employee
- `PATCH /api/v1/admin/employee/:employeeId` - Update employee
- `DELETE /api/v1/admin/employee/:employeeId` - Delete employee

#### Coffee Machine Management
- `GET /api/v1/admin/coffee-machine` - Get all machines
- `POST /api/v1/admin/coffee-machine` - Create machine
- `GET /api/v1/admin/coffee-machine/requests` - Get machine enquiries
- `PATCH /api/v1/admin/coffee-machine/:id` - Update machine
- `DELETE /api/v1/admin/coffee-machine/:id` - Delete machine

#### Reports
- `GET /api/v1/admin/admin-reports/partner-commission` - Partner commission report
- `GET /api/v1/admin/admin-reports/customer-report` - Customer report
- `GET /api/v1/admin/admin-reports/product-sales` - Product sales report
- `GET /api/v1/admin/supplier-reports/assigned-orders-report/:supId` - Supplier orders
- `GET /api/v1/admin/sales-rep-reports/commission-summary-report/:srId` - Commission summary

#### Dashboards
- `GET /api/v1/admin/dashboard` - Admin dashboard
- `GET /api/v1/admin/sales-rep-dashboard/:srId` - Sales rep dashboard
- `GET /api/v1/admin/supplier-dashboard/:id` - Supplier dashboard

### Lead Routes (`leadRoutes.js`)

All routes require authentication and role restriction (admin, salesRep, localPartner)

- `GET /api/v1/leads` - Get all leads (with pagination, filtering, sorting)
- `POST /api/v1/leads` - Create new lead
- `GET /api/v1/leads/kanban` - Get leads in Kanban format (grouped by status)
- `GET /api/v1/leads/stats` - Get lead statistics
- `GET /api/v1/leads/:id` - Get lead by ID
- `PATCH /api/v1/leads/:id` - Update lead
- `DELETE /api/v1/leads/:id` - Delete lead
- `POST /api/v1/leads/:id/follow-up` - Schedule follow-up
- `POST /api/v1/leads/:id/quotation` - Send quotation
- `POST /api/v1/leads/:id/site-visit` - Schedule site visit
- `PATCH /api/v1/leads/:id/won` - Mark lead as won
- `PATCH /api/v1/leads/:id/lost` - Mark lead as lost

---

## 🔐 Authentication & Authorization

### Middleware (`middlewares/protect.js`)

- **`protect`**: JWT token verification
- **`restrictTo(...roles)`**: Role-based access control

### User Roles

1. **admin** - Full system access
2. **salesRep** / **localPartner** - Sales representative access
3. **supplier** - Supplier-specific access
4. **customer** - End customer access
5. **employee** - Employee under admin/sales rep

---

## 💳 Payment Integration

### Stripe (`controllers/stripe.js`)

- Payment intent creation
- Card management
- Subscription handling
- Stripe Connect for sales reps
- Webhook handling

### QuickBooks Online Integration

#### Services (`services/`)

- **qboAuthService.js**: OAuth authentication
- **qboCustomerService.js**: Customer sync
- **qboInvoice.js**: Invoice creation
- **qboInvoiceUpdate.js**: Invoice updates
- **paymentSyncService.js**: Payment synchronization

#### Features

- Customer sync to QBO
- Invoice creation and sync
- Payment recording
- Multi-realm support (admin + partner QBO accounts)

---

## 📧 Email System

### Email Templates (`helper/`)

28 email templates using EJS:

1. **coffeeMachineQuotation.js** - Machine quotation to customer
2. **coffeeMachineQuotationAdmin.js** - Machine quotation to admin
3. **orderEmailtoCustomer.js** - Order confirmation
4. **orderEmailtoLocalPatner.js** - Order notification to partner
5. **orderDispatch.js** - Dispatch notification
6. **orderShipped.js** - Shipping notification
7. **sentInvoiceEmail.js** - Invoice email
8. **paidInvoiceEmail.js** - Payment confirmation
9. **userAccountCreated.js** - Welcome email
10. **userAccountApprove.js** - Account approval
11. **otpToUsers.js** - OTP for verification
12. **inviteEmployee.js** - Employee invitation
13. And 16 more...

### Email Transporter (`helper/transpoter.js`)

Nodemailer configuration with SMTP settings

---

## 🔧 Utility Functions

### Key Utilities (`utils/`)

- **apiFeatures.js**: Query filtering, sorting, pagination
- **catchAsync.js**: Async error handling wrapper
- **appError.js**: Custom error class
- **response.js**: Standardized API responses
- **encryption.js**: Data encryption/decryption
- **redisHandling.js**: Redis cache operations
- **emailsNotificationsData.js**: Email data preparation
- **throwNotification.js**: Push notification sender
- **generateInvoicePdf.js**: PDF invoice generation

---

## 🎯 Key Features

### 1. Lead Management System

- Complete lead pipeline (New → Contacted → Quoted → Demo → Negotiation → Nurture → WON/LOST)
- Lead tagging (Hot/Warm/Cold)
- Follow-up scheduling
- Quotation management
- Site visit scheduling
- Activity logging (LeadLog model)
- Kanban board view
- Lead statistics and analytics

### 2. Order Management

- Customer orders and partner orders (wholesale)
- Recurring orders (frequency-based)
- Order status tracking
- Supplier assignment
- Shipping integration
- Invoice generation and sending
- Payment tracking (Stripe + Cheque)
- QuickBooks sync

### 3. Multi-Tenant Support

- Admin realm
- Sales rep realms (local partners)
- Each can have their own QBO account
- Territory-based customer assignment

### 4. Commission System

- Automatic commission calculation for sales reps
- Partner commission tracking
- Payment pullouts from connected bank accounts
- Credit limit management

### 5. Discount Management

- Customer-specific discounts
- Product-level discounts
- Percentage-based pricing

### 6. Reporting

- Partner commission reports
- Customer reports
- Product sales reports
- Supplier order reports
- Sales rep performance reports

---

## 🚀 Running the Application

### Scripts (`package.json`)

```bash
npm start          # Production start (node bb.js)
npm run dev        # Development with nodemon
npm run start:prod # Production with NODE_ENV=production
npm run debug      # Debug with ndb
npm run ngrok      # Expose via ngrok
npm run dev:ngrok  # Dev + ngrok concurrently
```

### Environment Variables (`.env`)

Required variables (check `.env` file):
- Database credentials
- JWT secret
- Stripe keys
- QuickBooks OAuth credentials
- Email SMTP settings
- Redis connection

---

## 🔄 Database Synchronization

In `bb.js`:

```javascript
const syncDb = 0; // Set to 1 to sync database schema
```

**⚠️ Warning**: Setting `syncDb = 1` with `{ alter: true }` will modify database schema to match models.

---

## 📊 Data Flow Examples

### 1. Lead to Customer Conversion

```
Lead Created → Follow-ups → Quotation Sent → Site Visit → 
Mark as WON → Create User Account → First Order
```

### 2. Order Processing

```
Order Created → Supplier Assigned → Supplier Acknowledges → 
Order Dispatched → Order Delivered → Invoice Sent → 
Payment Received → Sync to QuickBooks
```

### 3. Sales Rep Commission

```
Order Placed → Commission Calculated → 
Payment Pullout Scheduled → Transfer to Sales Rep → 
Record in QuickBooks
```

---

## 🔒 Security Features

- JWT authentication
- Password hashing (bcrypt, 12 rounds)
- Helmet for HTTP headers
- Rate limiting
- Input sanitization (express-mongo-sanitize)
- HPP (HTTP Parameter Pollution) protection
- CORS configuration
- Soft deletes (paranoid mode)

---

## 📝 Notes

- **Database**: Uses MySQL with Sequelize ORM
- **Caching**: Redis for session and data caching
- **File Uploads**: Multer with organized storage (products, suppliers, sales-reps, machines)
- **Image Processing**: Sharp for image optimization
- **PDF Generation**: Puppeteer for invoices
- **Real-time**: Potential for Socket.io (server setup exists)
- **Error Handling**: Centralized error controller with custom AppError class
- **Logging**: Console-based with emojis for better visibility

---

## 🎨 Frontend Integration

The backend is designed to serve:
- Admin dashboard
- Sales rep portal
- Supplier portal
- Customer portal
- Mobile apps (push notifications supported)

---

## 🔗 External Integrations

1. **Stripe**: Payment processing, Connect for partners
2. **QuickBooks Online**: Accounting sync
3. **Firebase**: Push notifications (firebase-admin)
4. **Ngrok**: Local development tunneling
5. **Email**: SMTP via Nodemailer

---

## 📈 Scalability Considerations

- Redis caching layer
- Database indexing on key fields (email, name)
- Soft deletes for data retention
- Pagination on all list endpoints
- Background job support (Lambda functions for recurring orders, payment pullouts)

---

## 🐛 Error Handling

- Global error handler (`errorController.js`)
- Custom AppError class
- Async error wrapper (catchAsync)
- Unhandled rejection/exception handlers in `bb.js`
- Graceful shutdown on SIGTERM/SIGINT

---

## 📚 Recent Development History

Based on conversation history:

1. **Lead Management Integration** (Dec 3, 2025)
   - Updated email quotation system
   - Integrated new lead data structure
   - Modified `coffeeMachineQuotation.js`

2. **Enquiry Logs Model** (Dec 3, 2025)
   - Created `enquiryLogs.js` model
   - Fields: line, status, note, description

---

## 🎯 Next Steps for Development

Common tasks you might work on:

1. **Lead Management Enhancements**
   - Lead scoring algorithms
   - Automated follow-up reminders
   - Lead assignment rules

2. **Order Automation**
   - Automatic recurring order creation (Lambda function exists)
   - Inventory management
   - Supplier auto-assignment

3. **Reporting Enhancements**
   - Advanced analytics
   - Custom report builder
   - Export to Excel/PDF

4. **Mobile App Support**
   - Push notification improvements
   - Mobile-specific endpoints
   - Offline sync capabilities

---

This overview provides a comprehensive understanding of the Busy Beans backend architecture, models, routes, and features. You can now proceed with any development tasks with full context! 🚀☕
