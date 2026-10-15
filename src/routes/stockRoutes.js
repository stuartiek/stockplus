const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { ensureAuthenticated } = require('../middleware/auth');
const { loadActiveStore } = require('../middleware/tenant');

// GET /stock/movements - Full stock movement audit log / ledger
router.get('/movements', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { type, productId, page = 1 } = req.query;

    const filter = { store: storeId };
    if (type) filter.type = type;
    if (productId) filter.product = productId;

    const limit = 30;
    const skip = (Number(page) - 1) * limit;

    const [movements, totalCount, products] = await Promise.all([
      StockMovement.find(filter)
        .populate('product', 'name sku currentStock')
        .populate('performedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments(filter),
      Product.find({ store: storeId, status: 'active' }).select('name sku').sort({ name: 1 }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.render('stock/movements', {
      title: 'Stock Movement Ledger',
      movements,
      products,
      totalCount,
      currentPage: Number(page),
      totalPages,
      filters: { type, productId },
    });
  } catch (error) {
    console.error('Stock Movements Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load stock movements.',
    });
  }
});

// GET /stock/adjust - Stock adjustment form
router.get('/adjust', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const preselectedProductId = req.query.productId;

    const products = await Product.find({ store: storeId, status: 'active' })
      .populate('category')
      .sort({ name: 1 });

    res.render('stock/adjust', {
      title: 'Stock Adjustment & Cycle Count',
      products,
      preselectedProductId,
      error: null,
      success: req.query.success ? 'Stock adjustment successfully recorded.' : null,
    });
  } catch (error) {
    console.error('Stock Adjust Form Error:', error);
    res.redirect('/stock/movements');
  }
});

// POST /stock/adjust - Process stock adjustment
router.post('/adjust', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { productId, type, quantityChange, notes } = req.body;

    if (!productId || !type || quantityChange === undefined) {
      return res.redirect('/stock/adjust?error=Missing+required+fields');
    }

    const product = await Product.findOne({ _id: productId, store: storeId });
    if (!product) {
      return res.status(404).render('error', {
        title: 'Product Not Found',
        message: 'The selected product does not exist in this store.',
      });
    }

    const change = Number(quantityChange);
    if (isNaN(change) || change === 0) {
      return res.redirect('/stock/adjust?error=Invalid+quantity');
    }

    const previousStock = product.currentStock;
    const newStock = previousStock + change;

    // Prevent negative stock unless explicitly permitted or for audit adjustments
    product.currentStock = newStock;
    await product.save();

    // Log the movement
    await StockMovement.create({
      store: storeId,
      product: product._id,
      type: type, // 'purchase_in', 'damage_loss', 'return_in', 'adjustment'
      quantity: change,
      previousStock,
      newStock,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      reason: notes || `Manual stock adjustment (${type})`,
      referenceId: 'ADJUSTMENT',
      performedBy: req.user._id,
    });

    res.redirect('/stock/adjust?success=1');
  } catch (error) {
    console.error('Process Adjustment Error:', error);
    res.status(500).render('error', {
      title: 'Adjustment Error',
      message: 'Failed to record stock adjustment.',
    });
  }
});

// GET /stock/low - Dedicated low stock & restock alert view
router.get('/low', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const defaultThreshold = req.store.lowStockThreshold || 5;

    const lowStockProducts = await Product.find({
      store: storeId,
      status: 'active',
      $expr: { $lte: ['$currentStock', '$reorderLevel'] },
    })
      .populate('category')
      .populate('supplier')
      .sort({ currentStock: 1 });

    res.render('stock/low-stock', {
      title: 'Low Stock Alerts & Reorders',
      lowStockProducts,
      defaultThreshold,
    });
  } catch (error) {
    console.error('Low Stock View Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load low stock alerts.',
    });
  }
});

module.exports = router;

