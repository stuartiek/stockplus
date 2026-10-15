const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { ensureAuthenticated } = require('../middleware/auth');
const { loadActiveStore } = require('../middleware/tenant');

// GET /purchase-orders - List all purchase orders
router.get('/', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { status } = req.query;

    const filter = { store: storeId };
    if (status) filter.status = status;

    const orders = await PurchaseOrder.find(filter)
      .populate('supplier', 'name email phone')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.render('purchase-orders/index', {
      title: 'Purchase Orders & Restock',
      orders,
      statusFilter: status || 'all',
    });
  } catch (error) {
    console.error('List POs Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load purchase orders.',
    });
  }
});

// GET /purchase-orders/new - Create PO form
router.get('/new', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const [suppliers, products] = await Promise.all([
      Supplier.find({ store: storeId }).sort({ name: 1 }),
      Product.find({ store: storeId, status: 'active' }).sort({ name: 1 }),
    ]);

    const today = new Date();
    const poNumber = `PO-${today.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    res.render('purchase-orders/new', {
      title: 'Create Purchase Order',
      suppliers,
      products,
      defaultPoNumber: poNumber,
      error: null,
    });
  } catch (error) {
    console.error('New PO Form Error:', error);
    res.redirect('/purchase-orders');
  }
});

// POST /purchase-orders - Save PO
router.post('/', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { poNumber, supplier, expectedDate, notes, items } = req.body;

    if (!supplier || !items || !Array.isArray(items) || items.length === 0) {
      return res.redirect('/purchase-orders/new?error=Please+include+a+supplier+and+at+least+one+item');
    }

    let totalAmount = 0;
    const poItems = [];

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, store: storeId });
      if (!product) continue;

      const qty = Number(item.quantity) || 1;
      const unitCost = Number(item.unitCost) !== undefined ? Number(item.unitCost) : product.costPrice;
      const totalCost = qty * unitCost;
      totalAmount += totalCost;

      poItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity: qty,
        unitCost,
        totalCost,
      });
    }

    const order = new PurchaseOrder({
      store: storeId,
      poNumber: poNumber || `PO-${Date.now().toString().slice(-6)}`,
      supplier,
      items: poItems,
      totalAmount,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes: (notes || '').trim(),
      createdBy: req.user._id,
      status: 'draft',
    });

    await order.save();
    res.redirect(`/purchase-orders/${order._id}`);
  } catch (error) {
    console.error('Save PO Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to create purchase order.',
    });
  }
});

// GET /purchase-orders/:id - View PO details
router.get('/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const order = await PurchaseOrder.findOne({ _id: req.params.id, store: storeId })
      .populate('supplier')
      .populate('createdBy', 'name');

    if (!order) {
      return res.status(404).render('error', {
        title: 'Purchase Order Not Found',
        message: 'The requested purchase order was not found.',
      });
    }

    res.render('purchase-orders/show', {
      title: `Purchase Order ${order.poNumber}`,
      order,
    });
  } catch (error) {
    console.error('View PO Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load purchase order.',
    });
  }
});

// POST /purchase-orders/:id/status - Update PO Status (e.g. Draft -> Ordered -> Cancelled)
router.post('/:id/status', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { status } = req.body;

    const order = await PurchaseOrder.findOne({ _id: req.params.id, store: storeId });
    if (!order) return res.redirect('/purchase-orders');

    if (['draft', 'ordered', 'cancelled'].includes(status)) {
      order.status = status;
      await order.save();
    }

    res.redirect(`/purchase-orders/${order._id}`);
  } catch (error) {
    console.error('Update PO Status Error:', error);
    res.redirect('/purchase-orders');
  }
});

// POST /purchase-orders/:id/receive - Receive goods into inventory
router.post('/:id/receive', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const order = await PurchaseOrder.findOne({ _id: req.params.id, store: storeId });

    if (!order) {
      return res.status(404).send('Order not found');
    }

    if (order.status === 'received') {
      return res.redirect(`/purchase-orders/${order._id}`);
    }

    // Process each item and add to inventory
    for (const item of order.items) {
      const product = await Product.findOne({ _id: item.product, store: storeId });
      if (!product) continue;

      const prevStock = product.currentStock;
      const newStock = prevStock + item.quantity;

      // Update product current stock and cost price if specified
      product.currentStock = newStock;
      if (item.unitCost > 0) {
        product.costPrice = item.unitCost;
      }
      await product.save();

      // Log movement
      await StockMovement.create({
        store: storeId,
        product: product._id,
        type: 'purchase_in',
        quantity: item.quantity,
        previousStock: prevStock,
        newStock: newStock,
        costPrice: item.unitCost,
        sellingPrice: product.sellingPrice,
        reason: `Received from Purchase Order ${order.poNumber}`,
        referenceId: order.poNumber,
        performedBy: req.user._id,
      });
    }

    order.status = 'received';
    order.receivedDate = new Date();
    await order.save();

    res.redirect(`/purchase-orders/${order._id}`);
  } catch (error) {
    console.error('Receive PO Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to receive purchase order.',
    });
  }
});

module.exports = router;

