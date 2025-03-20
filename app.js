const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const app = express();
const server = require('http').createServer(app);
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const userRouter = require('./routes/userRoutes');

dotenv.config({ path: './.env' });
// Start express app
app.enable('trust proxy');

// app.set('view engine', 'pug');
// app.set('views', path.join(__dirname, 'views'));

// // 1) GLOBAL MIDDLEWARES
// // Implement CORS
// app.use(cors());
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
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.use(compression());

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// 3) ROUTES
app.use('/api/v1/users', userRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);
module.exports = server;
