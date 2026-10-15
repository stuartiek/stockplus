const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Store = require('../models/Store');
const { ensureAuthenticated, ensureGuest } = require('../middleware/auth');

// Presets for store types
const STORE_PRESETS = {
  grocery: [
    { key: 'expiry_date', label: 'Expiry Date', type: 'date', required: true, showInTable: true, description: 'Shelf life / expiry date' },
    { key: 'batch_number', label: 'Batch / Lot #', type: 'text', required: false, showInTable: true, description: 'Manufacturer batch or harvest code' },
    { key: 'weight_volume', label: 'Net Weight / Volume', type: 'text', required: false, showInTable: false, description: 'e.g. 500g, 1L, 2kg' },
    { key: 'is_organic', label: 'Organic Certified', type: 'boolean', required: false, showInTable: false, description: 'Is certified organic' },
  ],
  fashion: [
    { key: 'size', label: 'Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', '2XL', 'One Size'], required: true, showInTable: true, description: 'Garment or shoe size' },
    { key: 'color', label: 'Color', type: 'text', required: true, showInTable: true, description: 'Color / Wash variant' },
    { key: 'material', label: 'Fabric / Material', type: 'text', required: false, showInTable: false, description: 'e.g. 100% Cotton, Denim' },
    { key: 'gender', label: 'Department / Gender', type: 'select', options: ['Men', 'Women', 'Unisex', 'Kids'], required: false, showInTable: true, description: 'Target department' },
  ],
  electronics: [
    { key: 'brand', label: 'Brand / Manufacturer', type: 'text', required: true, showInTable: true, description: 'e.g. Sony, Apple, Samsung' },
    { key: 'model_number', label: 'Model Number', type: 'text', required: false, showInTable: true, description: 'Specific hardware model' },
    { key: 'warranty_months', label: 'Warranty (Months)', type: 'number', required: false, showInTable: true, description: 'Warranty duration in months' },
    { key: 'serial_tracking', label: 'Serial Tracking Required', type: 'boolean', required: false, showInTable: false, description: 'Track individual serial numbers' },
  ],
  pharmacy: [
    { key: 'active_ingredient', label: 'Active Ingredient / Generic', type: 'text', required: true, showInTable: true, description: 'Chemical or generic compound' },
    { key: 'dosage', label: 'Strength / Dosage', type: 'text', required: true, showInTable: true, description: 'e.g. 500mg, 10ml' },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date', required: true, showInTable: true, description: 'Drug expiration date' },
    { key: 'batch_number', label: 'Batch Number', type: 'text', required: true, showInTable: true, description: 'Regulatory batch number' },
    { key: 'requires_prescription', label: 'Prescription Required (Rx)', type: 'boolean', required: false, showInTable: true, description: 'Regulated prescription item' },
  ],
  general: [
    { key: 'brand', label: 'Brand', type: 'text', required: false, showInTable: true, description: 'Product Brand' },
    { key: 'model', label: 'Model / Variant', type: 'text', required: false, showInTable: false, description: 'Model or variant name' },
  ],
};

// GET /auth/register
router.get('/auth/register', ensureGuest, (req, res) => {
  res.render('auth/register', {
    title: 'Create Account - StockPlus',
    layout: false,
    error: null,
  });
});

// POST /auth/register
router.post('/auth/register', ensureGuest, async (req, res) => {
  try {
    const { name, email, password, storeName, storeType, currency, brandColor } = req.body;

    if (!name || !email || !password || !storeName) {
      return res.render('auth/register', {
        title: 'Create Account - StockPlus',
        layout: false,
        error: 'Please fill in all required fields.',
        data: req.body,
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Create Account - StockPlus',
        layout: false,
        error: 'An account with that email address already exists.',
        data: req.body,
      });
    }

    // Create user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
    });
    await user.save();

    // Select custom fields presets according to selected store type
    const presetFields = STORE_PRESETS[storeType] || STORE_PRESETS.general;

    // Create primary store
    const store = new Store({
      name: storeName,
      slug: storeName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      storeType: storeType || 'general',
      owner: user._id,
      currency: currency || '$',
      brandColor: brandColor || '#2563eb',
      customFields: presetFields,
    });
    await store.save();

    // Associate store with user as owner
    user.stores.push({ store: store._id, role: 'owner' });
    user.activeStore = store._id;
    await user.save();

    // Establish session
    req.session.userId = user._id;
    req.session.activeStoreId = store._id;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration Error:', error);
    res.render('auth/register', {
      title: 'Create Account - StockPlus',
      layout: false,
      error: 'An error occurred during account setup. Please try again.',
      data: req.body,
    });
  }
});

// GET /auth/login
router.get('/auth/login', ensureGuest, (req, res) => {
  res.render('auth/login', {
    title: 'Sign In - StockPlus',
    layout: false,
    error: null,
  });
});

// POST /auth/login
router.post('/auth/login', ensureGuest, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Sign In - StockPlus',
        layout: false,
        error: 'Please provide both email and password.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.render('auth/login', {
        title: 'Sign In - StockPlus',
        layout: false,
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Sign In - StockPlus',
        layout: false,
        error: 'Invalid email or password.',
      });
    }

    // Set session
    req.session.userId = user._id;
    if (user.activeStore) {
      req.session.activeStoreId = user.activeStore;
    } else if (user.stores.length > 0) {
      req.session.activeStoreId = user.stores[0].store;
    }

    const returnTo = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (error) {
    console.error('Login Error:', error);
    res.render('auth/login', {
      title: 'Sign In - StockPlus',
      layout: false,
      error: 'An error occurred during sign in. Please try again.',
    });
  }
});

// GET /auth/logout
router.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

// GET /stores/setup - Create an additional store or initial store
router.get('/stores/setup', ensureAuthenticated, async (req, res) => {
  res.render('auth/setup-store', {
    title: 'Create Store - StockPlus',
    error: null,
  });
});

// POST /stores/setup - Create an additional store
router.post('/stores/setup', ensureAuthenticated, async (req, res) => {
  try {
    const { name, storeType, currency, brandColor } = req.body;
    if (!name) {
      return res.render('auth/setup-store', {
        title: 'Create Store - StockPlus',
        error: 'Please provide a store name.',
      });
    }

    const presetFields = STORE_PRESETS[storeType] || STORE_PRESETS.general;

    const newStore = new Store({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      storeType: storeType || 'general',
      owner: req.user._id,
      currency: currency || '$',
      brandColor: brandColor || '#2563eb',
      customFields: presetFields,
    });
    await newStore.save();

    // Add to user's stores
    req.user.stores.push({ store: newStore._id, role: 'owner' });
    req.user.activeStore = newStore._id;
    await req.user.save();

    req.session.activeStoreId = newStore._id;
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Store Setup Error:', error);
    res.render('auth/setup-store', {
      title: 'Create Store - StockPlus',
      error: 'Failed to create store. Please try again.',
    });
  }
});

module.exports = router;

