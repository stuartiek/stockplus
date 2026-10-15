const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const StockMovement = require('../models/StockMovement');
const { ensureAuthenticated } = require('../middleware/auth');
const { loadActiveStore } = require('../middleware/tenant');

const Category = require('../models/Category');

// GET /pos - Interactive Touchscreen Point of Sale terminal
router.get('/', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const [categories, allProducts] = await Promise.all([
      Category.find({ store: storeId }).sort({ name: 1 }),
      Product.find({ store: storeId, status: 'active' })
        .populate('category')
        .sort({ updatedAt: -1 })
        .limit(100),
    ]);

    const posSettings = req.store.posSettings || {
      layout: 'cart-right',
      gridColumns: 'standard',
      theme: 'light',
      enableOnScreenNumpad: true,
      enableSoundEffects: true,
      quickCashNotes: [5, 10, 20, 50, 100],
      quickDiscountButtons: [5, 10, 15, 20],
      showStockCountOnTile: true,
      showSkuOnTile: true,
      showCategoryTabs: true,
      allowCustomLineItem: true,
      touchButtonSize: 'comfortable',
    };

    res.render('pos/index', {
      title: `${req.store.name} - Point of Sale (POS)`,
      categories,
      products: allProducts,
      posSettings,
    });
  } catch (error) {
    console.error('POS Error:', error);
    res.status(500).render('error', {
      title: 'POS Error',
      message: 'Failed to initialize POS screen.',
    });
  }
});

// GET /pos/payment - Dedicated Checkout, Review & Discount page
router.get('/payment', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const posSettings = req.store.posSettings || {
      theme: 'light',
      quickCashNotes: [5, 10, 20, 50, 100],
      quickDiscountButtons: [5, 10, 15, 20],
      enableSoundEffects: true,
      touchButtonSize: 'comfortable',
    };

    res.render('pos/payment', {
      title: `${req.store.name} - Checkout, Discounts & Payment`,
      posSettings,
    });
  } catch (error) {
    console.error('POS Payment Error:', error);
    res.status(500).render('error', {
      title: 'Payment Error',
      message: 'Failed to initialize payment screen.',
    });
  }
});

// GET /pos/search - API for real-time item lookup by barcode, SKU, or name
router.get('/search', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { term } = req.query;

    if (!term || !term.trim()) {
      return res.json([]);
    }

    const regex = new RegExp(term.trim(), 'i');
    const products = await Product.find({
      store: storeId,
      status: 'active',
      $or: [
        { barcode: term.trim() },
        { sku: regex },
        { name: regex },
      ],
    })
      .populate('category', 'name color')
      .limit(20);

    res.json(products);
  } catch (error) {
    console.error('POS Search Error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /pos/checkout - Process POS transaction
router.post('/checkout', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const {
      items,
      paymentMethod,
      cashReceived,
      customerName,
      customerPhone,
      customerEmail,
      discountAmount = 0,
      discountReason = '',
      notes = '',
      isTaxExempt = false,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart cannot be empty.' });
    }

    let subtotal = 0;
    const saleItems = [];
    const stockUpdates = [];

    // Verify each item and check stock availability
    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      const isCustom = item.isCustom || (typeof item.productId === 'string' && item.productId.startsWith('custom-'));

      if (isCustom) {
        // Handle custom line item
        const unitPrice = Number(item.unitPrice) || 0;
        const itemSubtotal = qty * unitPrice;
        subtotal += itemSubtotal;

        saleItems.push({
          product: null,
          name: (item.name || 'Custom Item').trim(),
          sku: item.sku || 'MISC',
          quantity: qty,
          unitPrice: unitPrice,
          subtotal: itemSubtotal,
        });
      } else {
        const product = await Product.findOne({ _id: item.productId, store: storeId });
        if (!product) {
          return res.status(400).json({ success: false, message: `Product not found: ${item.name || item.productId}` });
        }

        const unitPrice = Number(item.unitPrice) !== undefined ? Number(item.unitPrice) : product.sellingPrice;
        const itemSubtotal = qty * unitPrice;
        subtotal += itemSubtotal;

        saleItems.push({
          product: product._id,
          name: product.name,
          sku: product.sku,
          quantity: qty,
          unitPrice: unitPrice,
          subtotal: itemSubtotal,
        });

        stockUpdates.push({
          product,
          qty,
        });
      }
    }

    const storeTaxRate = (isTaxExempt === true || isTaxExempt === 'true') ? 0 : (req.store.taxRate || 0);
    const discount = Math.max(0, Number(discountAmount) || 0);
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const taxAmount = (discountedSubtotal * storeTaxRate) / 100;
    const total = discountedSubtotal + taxAmount;

    // Generate unique receipt number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `REC-${dateStr}-${randomSuffix}`;

    const paidCash = Number(cashReceived) || total;
    const changeGiven = Math.max(0, paidCash - total);

    // Save Sale record
    const sale = new Sale({
      store: storeId,
      receiptNumber,
      items: saleItems,
      subtotal,
      taxRate: storeTaxRate,
      taxAmount,
      discountAmount: discount,
      discountReason: discountReason || '',
      notes: notes || '',
      total,
      paymentMethod: paymentMethod || 'cash',
      cashReceived: paidCash,
      changeGiven: changeGiven,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      cashier: req.user._id,
    });

    await sale.save();

    // Deduct stock quantities and create audit movements
    for (const update of stockUpdates) {
      const { product, qty } = update;
      const prevStock = product.currentStock;
      const newStock = prevStock - qty;

      product.currentStock = newStock;
      await product.save();

      await StockMovement.create({
        store: storeId,
        product: product._id,
        type: 'sale_out',
        quantity: -qty,
        previousStock: prevStock,
        newStock: newStock,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reason: `Sale receipt ${receiptNumber}`,
        referenceId: receiptNumber,
        performedBy: req.user._id,
      });
    }

    res.json({
      success: true,
      saleId: sale._id,
      receiptNumber: sale.receiptNumber,
      total: sale.total,
      changeGiven: sale.changeGiven,
    });
  } catch (error) {
    console.error('Checkout Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Checkout failed.' });
  }
});

// GET /pos/receipt/:id - Printable receipt view
router.get('/receipt/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const sale = await Sale.findOne({ _id: req.params.id, store: storeId }).populate('cashier', 'name');

    if (!sale) {
      return res.status(404).render('error', {
        title: 'Receipt Not Found',
        message: 'The requested receipt could not be found.',
      });
    }

    res.render('pos/receipt', {
      title: `Receipt #${sale.receiptNumber}`,
      layout: false,
      sale,
    });
  } catch (error) {
    console.error('Receipt View Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to display receipt.',
    });
  }
});

// GET /pos/sales - Sales History & Transactions
router.get('/sales', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { page = 1 } = req.query;

    const limit = 25;
    const skip = (Number(page) - 1) * limit;

    const [sales, totalCount] = await Promise.all([
      Sale.find({ store: storeId })
        .populate('cashier', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Sale.countDocuments({ store: storeId }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.render('pos/sales-list', {
      title: 'Sales & Transactions',
      sales,
      totalCount,
      currentPage: Number(page),
      totalPages,
    });
  } catch (error) {
    console.error('Sales List Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load sales transactions.',
    });
  }
});

// POST /pos/buttons - Create a new custom POS button
router.post('/buttons', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const store = req.store;
    if (!store.posSettings) store.posSettings = {};
    if (!store.posSettings.quickButtons) store.posSettings.quickButtons = [];

    const { label, icon, color, actionType, actionData } = req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ success: false, message: 'Button label is required.' });
    }

    const newButton = {
      id: `btn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: label.trim(),
      icon: icon || 'sparkles',
      color: color || 'emerald',
      actionType: actionType || 'popup_prompt',
      actionData: actionData || {},
      order: store.posSettings.quickButtons.length,
    };

    store.posSettings.quickButtons.push(newButton);
    await store.save();

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({ success: true, button: newButton });
    }
    res.redirect('/pos');
  } catch (error) {
    console.error('Create Button Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create button.' });
  }
});

// PUT /pos/buttons/:buttonId - Update a custom POS button
router.put('/buttons/:buttonId', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const store = req.store;
    if (!store.posSettings || !store.posSettings.quickButtons) {
      return res.status(404).json({ success: false, message: 'No buttons found.' });
    }

    const btnIndex = store.posSettings.quickButtons.findIndex((b) => b.id === req.params.buttonId);
    if (btnIndex === -1) {
      return res.status(404).json({ success: false, message: 'Button not found.' });
    }

    const { label, icon, color, actionType, actionData } = req.body;

    if (label) store.posSettings.quickButtons[btnIndex].label = label.trim();
    if (icon) store.posSettings.quickButtons[btnIndex].icon = icon;
    if (color) store.posSettings.quickButtons[btnIndex].color = color;
    if (actionType) store.posSettings.quickButtons[btnIndex].actionType = actionType;
    if (actionData) store.posSettings.quickButtons[btnIndex].actionData = actionData;

    store.markModified('posSettings');
    await store.save();

    res.json({ success: true, button: store.posSettings.quickButtons[btnIndex] });
  } catch (error) {
    console.error('Update Button Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update button.' });
  }
});

// DELETE /pos/buttons/:buttonId - Remove a custom POS button
router.delete('/buttons/:buttonId', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const store = req.store;
    if (!store.posSettings || !store.posSettings.quickButtons) {
      return res.json({ success: true });
    }

    store.posSettings.quickButtons = store.posSettings.quickButtons.filter((b) => b.id !== req.params.buttonId);
    store.markModified('posSettings');
    await store.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Delete Button Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete button.' });
  }
});

// POST /pos/buttons/reorder - Persist drag-and-drop moved button order
router.post('/buttons/reorder', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const store = req.store;
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || !store.posSettings || !store.posSettings.quickButtons) {
      return res.status(400).json({ success: false, message: 'Invalid reorder array.' });
    }

    const currentMap = new Map();
    store.posSettings.quickButtons.forEach((b) => currentMap.set(b.id, b));

    const reordered = [];
    orderedIds.forEach((id, idx) => {
      const btn = currentMap.get(id);
      if (btn) {
        btn.order = idx;
        reordered.push(btn);
        currentMap.delete(id);
      }
    });

    // Add any remaining buttons that weren't in orderedIds
    currentMap.forEach((btn) => {
      btn.order = reordered.length;
      reordered.push(btn);
    });

    store.posSettings.quickButtons = reordered;
    store.markModified('posSettings');
    await store.save();

    res.json({ success: true, count: reordered.length });
  } catch (error) {
    console.error('Reorder Buttons Error:', error);
    res.status(500).json({ success: false, message: 'Failed to save button order.' });
  }
});

module.exports = router;

