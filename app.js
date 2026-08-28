const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const cors = require("cors");
const bodyParser = require("body-parser");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const app = express();

const server = require("http").createServer(app);
const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/errorController");
const userRouter = require("./routes/userRoutes");
const adminRouter = require("./routes/adminRoutes");
const webhookRoute = require("./routes/webhooks");
const qboRoutes = require("./routes/qboRoutes");
const leadRoutes = require("./routes/leadRoutes");
const subscriptionRouter = require("./routes/subscriptionRoutes");
const { router: marketingRouter } = require("./marketing");

app.use((req, res, next) => {
  console.log(`📥 Incoming Request: ${req.method} ${req.originalUrl}`);
  const safeHeaders = {
    "content-type": req.headers["content-type"],
    "user-agent": req.headers["user-agent"],
    host: req.headers.host,
    authorization: req.headers.authorization
      ? `${req.headers.authorization.slice(0, 24)}...`
      : undefined,
    "x-zepto-webhook-secret": req.headers["x-zepto-webhook-secret"]
      ? `${String(req.headers["x-zepto-webhook-secret"]).slice(0, 12)}...`
      : undefined,
  };
  console.log(`📥 Incoming Header: ${JSON.stringify(safeHeaders)}`);
  next();
});

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");
const viewRoute = require("./routes/viewRoutes");

app.use("/view", viewRoute);

// Stripe webhook needs raw body for signature verification
// Meta webhook needs JSON body parser
// Apply raw body parser only to Stripe route
app.use(
  "/webhook/busy-beans-coffee",
  bodyParser.raw({ type: "application/json" }),
  webhookRoute,
);

// Meta webhook routes use JSON parser
app.use("/webhook", express.json(), webhookRoute);

dotenv.config({ path: "./.env" });
// Start express app
app.enable("trust proxy");

// app.set('view engine', 'pug');
// app.set('views', path.join(__dirname, 'views'));

// // 1) GLOBAL MIDDLEWARES
// // Implement CORS
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      return callback(null, true); // reflect the requested origin
    },
    credentials: true, // <-- REQUIRED to allow cookies
  }),
);
app.use(cookieParser());
// // Access-Control-Allow-Origin *
// // api.natours.com, front-end natours.com
// // app.use(cors({
// //   origin: 'https://www.natours.com'
// // }))

// app.options('*', cors());
// // app.options('/api/v1/tours/:id', cors());

// // Serving static files
// app.use(express.static(path.join(__dirname, 'public')));

// // Set security HTTP headers
// app.use(helmet());

// // Limit requests from same API
// const limiter = rateLimit({
//   max: 100,
//   windowMs: 60 * 60 * 1000,
//   message: 'Too many requests from this IP, please try again in an hour!',
// });
// app.use('/api', limiter);

// Stripe webhook, BEFORE body-parser, because stripe needs the body as stream

// Body parser, reading data from body into req.body
// app.use(express.json({ limit: '10kb' }));
// app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(compression());

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "BusyBeans backend is live!",
  });
});

// Swagger Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Busy Beans Coffee API Documentation",
  }),
);

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// 3) ROUTES
app.use("/api/v1/users", userRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/leads", leadRoutes);
app.use("/qbo", qboRoutes);
app.use("/api/v1/subscription", subscriptionRouter);
// Page Builder module (marketing) — /api/auth, /api/admin/*, /api/public/*
app.use("/api", marketingRouter);
app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);
module.exports = server;
