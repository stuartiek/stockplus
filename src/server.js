require('dotenv').config();
const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const methodOverride = require('method-override');
const morgan = require('morgan');

const connectDB = require('./config/db');

// Route handlers
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const productRoutes = require('./routes/productRoutes');
const stockRoutes = require('./routes/stockRoutes');
const posRoutes = require('./routes/posRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const storeSettingsRoutes = require('./routes/storeSettingsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// EJS View Engine Setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// Middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride((req) => {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    const method = req.body._method;
    delete req.body._method;
    return method;
  }
  return req.query ? req.query._method : undefined;
}));

// Session Configuration with MongoStore
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'stockplus_secure_session_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockplus',
      ttl: 14 * 24 * 60 * 60, // 14 days
    }),
    cookie: {
      maxAge: 14 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

// Global view variables
app.use((req, res, next) => {
  res.locals.appName = 'StockPlus';
  res.locals.currentYear = new Date().getFullYear();
  res.locals.currentUser = null;
  res.locals.currentStore = null;
  res.locals.userStores = [];
  res.locals.brandColor = '#2563eb';
  res.locals.currency = '$';
  res.locals.currentPath = req.path;
  next();
});

// Mount Routes
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/products', productRoutes);
app.use('/stock', stockRoutes);
app.use('/pos', posRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/purchase-orders', purchaseOrderRoutes);
app.use('/settings', storeSettingsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found - 404',
    message: `The requested URL "${req.originalUrl}" was not found on this server.`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).render('error', {
    title: 'Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 StockPlus is running on http://localhost:${PORT}`);
  console.log(`✨ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});
