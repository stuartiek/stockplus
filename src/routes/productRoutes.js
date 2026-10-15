const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const { ensureAuthenticated } = require('../middleware/auth');
const { loadActiveStore } = require('../middleware/tenant');

// GET /products - List all products with dynamic custom field columns & filters
router.get('/', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { q, category, stockStatus, sort } = req.query;

    const filter = { store: storeId, status: 'active' };

    // Search query
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { name: regex },
        { sku: regex },
        { barcode: regex },
      ];
    }

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Stock status filter
    if (stockStatus === 'out') {
      filter.currentStock = { $lte: 0 };
    } else if (stockStatus === 'low') {
      // Products where currentStock <= reorderLevel
      filter.$expr = { $lte: ['$currentStock', '$reorderLevel'] };
    } else if (stockStatus === 'in_stock') {
      filter.currentStock = { $gt: 0 };
    }

    // Sort order
    let sortOption = { createdAt: -1 };
    if (sort === 'name_asc') sortOption = { name: 1 };
    if (sort === 'name_desc') sortOption = { name: -1 };
    if (sort === 'price_asc') sortOption = { sellingPrice: 1 };
    if (sort === 'price_desc') sortOption = { sellingPrice: -1 };
    if (sort === 'stock_asc') sortOption = { currentStock: 1 };
    if (sort === 'stock_desc') sortOption = { currentStock: -1 };

    const [products, categories] = await Promise.all([
      Product.find(filter).populate('category').populate('supplier').sort(sortOption),
      Category.find({ store: storeId }).sort({ name: 1 }),
    ]);

    // Determine which custom fields to show in the table
    const tableCustomFields = (req.store.customFields || []).filter((f) => f.showInTable);

    res.render('products/index', {
      title: 'Inventory Catalog',
      products,
      categories,
      tableCustomFields,
      filters: { q, category, stockStatus, sort },
    });
  } catch (error) {
    console.error('List Products Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load products list.',
    });
  }
});

// GET /products/new - Form to add new product
router.get('/new', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const [categories, suppliers] = await Promise.all([
      Category.find({ store: storeId }).sort({ name: 1 }),
      Supplier.find({ store: storeId }).sort({ name: 1 }),
    ]);

    res.render('products/new', {
      title: 'Add New Product',
      categories,
      suppliers,
      customFields: req.store.customFields || [],
      error: null,
      data: {},
    });
  } catch (error) {
    console.error('New Product Form Error:', error);
    res.redirect('/products');
  }
});

// POST /products - Create new product
router.post('/', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const {
      name,
      sku,
      barcode,
      category,
      supplier,
      description,
      costPrice,
      sellingPrice,
      initialStock,
      reorderLevel,
      unit,
      customFields = {},
    } = req.body;

    // Check required fields
    if (!name || !sellingPrice) {
      const [categories, suppliers] = await Promise.all([
        Category.find({ store: storeId }),
        Supplier.find({ store: storeId }),
      ]);
      return res.render('products/new', {
        title: 'Add New Product',
        categories,
        suppliers,
        customFields: req.store.customFields || [],
        error: 'Product name and selling price are required.',
        data: req.body,
      });
    }

    // Auto-generate SKU if blank
    let productSku = (sku || '').trim().toUpperCase();
    if (!productSku) {
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      productSku = `SKU-${Date.now().toString().slice(-4)}-${randomSuffix}`;
    }

    // Check SKU uniqueness for this store
    const existingSku = await Product.findOne({ store: storeId, sku: productSku });
    if (existingSku) {
      const [categories, suppliers] = await Promise.all([
        Category.find({ store: storeId }),
        Supplier.find({ store: storeId }),
      ]);
      return res.render('products/new', {
        title: 'Add New Product',
        categories,
        suppliers,
        customFields: req.store.customFields || [],
        error: `SKU "${productSku}" already exists in your store. Please use a unique SKU.`,
        data: req.body,
      });
    }

    // Auto-generate barcode if blank
    let productBarcode = (barcode || '').trim();
    if (!productBarcode) {
      productBarcode = productSku.replace(/[^A-Za-z0-9]/g, '');
    }

    const stockQty = Number(initialStock) || 0;

    const product = new Product({
      store: storeId,
      name: name.trim(),
      sku: productSku,
      barcode: productBarcode,
      category: category || null,
      supplier: supplier || null,
      description: (description || '').trim(),
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      currentStock: stockQty,
      reorderLevel: Number(reorderLevel) || req.store.lowStockThreshold || 5,
      unit: unit || 'pcs',
      customFields: customFields,
    });

    await product.save();

    // Log initial stock movement if quantity > 0
    if (stockQty > 0) {
      await StockMovement.create({
        store: storeId,
        product: product._id,
        type: 'purchase_in',
        quantity: stockQty,
        previousStock: 0,
        newStock: stockQty,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reason: 'Initial stock intake upon product creation',
        referenceId: 'INITIAL_INTAKE',
        performedBy: req.user._id,
      });
    }

    res.redirect(`/products/${product._id}`);
  } catch (error) {
    console.error('Create Product Error:', error);
    res.status(500).render('error', {
      title: 'Product Creation Failed',
      message: error.message || 'Failed to save product.',
    });
  }
});

// GET /products/:id - View product details, history & printable barcode
router.get('/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const product = await Product.findOne({ _id: req.params.id, store: storeId })
      .populate('category')
      .populate('supplier');

    if (!product) {
      return res.status(404).render('error', {
        title: 'Product Not Found',
        message: 'The requested product does not exist in this store.',
      });
    }

    // Fetch stock movements for this product
    const movements = await StockMovement.find({ store: storeId, product: product._id })
      .populate('performedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    // Generate QR Code data URL for the product
    const qrData = JSON.stringify({
      id: product._id,
      sku: product.sku,
      name: product.name,
      price: product.sellingPrice,
      store: req.store.name,
    });
    const qrCodeUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 180 });

    res.render('products/show', {
      title: `${product.name} - Details`,
      product,
      movements,
      qrCodeUrl,
      customFieldsConfig: req.store.customFields || [],
    });
  } catch (error) {
    console.error('View Product Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Could not load product details.',
    });
  }
});

// GET /products/:id/edit - Edit product form
router.get('/:id/edit', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const [product, categories, suppliers] = await Promise.all([
      Product.findOne({ _id: req.params.id, store: storeId }),
      Category.find({ store: storeId }).sort({ name: 1 }),
      Supplier.find({ store: storeId }).sort({ name: 1 }),
    ]);

    if (!product) {
      return res.status(404).render('error', {
        title: 'Product Not Found',
        message: 'The requested product does not exist in this store.',
      });
    }

    res.render('products/edit', {
      title: `Edit ${product.name}`,
      product,
      categories,
      suppliers,
      customFields: req.store.customFields || [],
      error: null,
    });
  } catch (error) {
    console.error('Edit Product Form Error:', error);
    res.redirect('/products');
  }
});

// PUT /products/:id - Update product
router.put('/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const {
      name,
      barcode,
      category,
      supplier,
      description,
      costPrice,
      sellingPrice,
      reorderLevel,
      unit,
      customFields = {},
    } = req.body;

    const product = await Product.findOne({ _id: req.params.id, store: storeId });
    if (!product) {
      return res.status(404).render('error', {
        title: 'Product Not Found',
        message: 'The product was not found.',
      });
    }

    product.name = name ? name.trim() : product.name;
    product.barcode = barcode !== undefined ? barcode.trim() : product.barcode;
    product.category = category || null;
    product.supplier = supplier || null;
    product.description = description !== undefined ? description.trim() : product.description;
    product.costPrice = costPrice !== undefined ? Number(costPrice) : product.costPrice;
    product.sellingPrice = sellingPrice !== undefined ? Number(sellingPrice) : product.sellingPrice;
    product.reorderLevel = reorderLevel !== undefined ? Number(reorderLevel) : product.reorderLevel;
    product.unit = unit || product.unit;

    // Merge custom fields
    product.customFields = {
      ...(product.customFields || {}),
      ...customFields,
    };

    product.markModified('customFields');
    await product.save();

    res.redirect(`/products/${product._id}`);
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).render('error', {
      title: 'Update Error',
      message: 'Failed to update product.',
    });
  }
});

// DELETE /products/:id - Delete product
router.delete('/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    await Product.findOneAndDelete({ _id: req.params.id, store: storeId });
    res.redirect('/products');
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.redirect('/products');
  }
});

// GET /products/:id/barcode - Printable shelf label / barcode
router.get('/:id/barcode', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const product = await Product.findOne({ _id: req.params.id, store: storeId }).populate('category');

    if (!product) {
      return res.status(404).send('Product not found');
    }

    const qrData = JSON.stringify({
      id: product._id,
      sku: product.sku,
      price: product.sellingPrice,
    });
    const qrCodeUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 140 });

    res.render('products/barcode-label', {
      title: `Label - ${product.sku}`,
      layout: false,
      product,
      qrCodeUrl,
    });
  } catch (error) {
    console.error('Barcode Print Error:', error);
    res.status(500).send('Error generating barcode label');
  }
});

module.exports = router;

