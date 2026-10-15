const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Sale = require('../models/Sale');
const Category = require('../models/Category');
const { ensureAuthenticated } = require('../middleware/auth');
const { loadActiveStore } = require('../middleware/tenant');

// GET / - Root redirect
router.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/auth/login');
});

// GET /dashboard
router.get('/dashboard', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;

    // Start of today in local time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Run dashboard metrics queries in parallel
    const [
      totalProducts,
      allProducts,
      todaySales,
      recentMovements,
      categories,
    ] = await Promise.all([
      Product.countDocuments({ store: storeId, status: 'active' }),
      Product.find({ store: storeId, status: 'active' }).populate('category'),
      Sale.find({ store: storeId, createdAt: { $gte: todayStart } }),
      StockMovement.find({ store: storeId })
        .populate('product', 'name sku')
        .populate('performedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(8),
      Category.find({ store: storeId }),
    ]);

    // Compute inventory valuation and low-stock count
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let lowStockProducts = [];

    allProducts.forEach((prod) => {
      const stock = Math.max(0, prod.currentStock);
      totalCostValue += stock * (prod.costPrice || 0);
      totalRetailValue += stock * (prod.sellingPrice || 0);

      const threshold = prod.reorderLevel !== undefined ? prod.reorderLevel : req.store.lowStockThreshold;
      if (prod.currentStock <= threshold) {
        lowStockProducts.push(prod);
      }
    });

    // Today's sales calculations
    const todaySalesTotal = todaySales.reduce((acc, sale) => acc + (sale.total || 0), 0);
    const todayTransactionsCount = todaySales.length;

    // Category distribution for visual charts
    const categoryCounts = {};
    allProducts.forEach((p) => {
      const catName = p.category ? p.category.name : 'Uncategorized';
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
    });

    res.render('dashboard/index', {
      title: `${req.store.name} - Dashboard`,
      metrics: {
        totalProducts,
        totalCostValue,
        totalRetailValue,
        lowStockCount: lowStockProducts.length,
        todaySalesTotal,
        todayTransactionsCount,
      },
      lowStockProducts: lowStockProducts.slice(0, 5),
      recentMovements,
      categoryDistribution: categoryCounts,
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).render('error', {
      title: 'Dashboard Error',
      message: 'Failed to load dashboard data. Please try again.',
    });
  }
});

module.exports = router;

