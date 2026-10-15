const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const Category = require('../models/Category');
const { ensureAuthenticated, ensureRole } = require('../middleware/auth');
const { loadActiveStore } = require('../middleware/tenant');

// Industry preset templates for custom fields
const INDUSTRY_PRESETS = {
  grocery: {
    title: 'Supermarket & Grocery',
    fields: [
      { key: 'expiry_date', label: 'Expiry Date', type: 'date', required: true, showInTable: true, description: 'Perishable shelf life expiration date' },
      { key: 'batch_number', label: 'Batch / Lot #', type: 'text', required: false, showInTable: true, description: 'Manufacturer batch code' },
      { key: 'weight_volume', label: 'Pack Size / Volume', type: 'text', required: false, showInTable: false, description: 'e.g. 500g, 1L, 2kg pack' },
      { key: 'storage_temp', label: 'Storage Temp', type: 'select', options: ['Ambient / Shelf', 'Refrigerated (2-8°C)', 'Frozen (-18°C)'], required: false, showInTable: false, description: 'Recommended storage temperature' },
      { key: 'is_organic', label: 'Organic Certified', type: 'boolean', required: false, showInTable: false, description: 'Certified organic product' },
    ],
  },
  fashion: {
    title: 'Apparel & Fashion Boutique',
    fields: [
      { key: 'size', label: 'Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size'], required: true, showInTable: true, description: 'Clothing or shoe size' },
      { key: 'color', label: 'Color / Shade', type: 'text', required: true, showInTable: true, description: 'Primary garment color' },
      { key: 'material', label: 'Material / Fabric', type: 'text', required: false, showInTable: false, description: 'e.g. 100% Organic Cotton, Wool, Silk' },
      { key: 'gender', label: 'Department', type: 'select', options: ['Men', 'Women', 'Unisex', 'Kids', 'Accessories'], required: false, showInTable: true, description: 'Department category' },
      { key: 'season', label: 'Season / Collection', type: 'text', required: false, showInTable: false, description: 'e.g. SS26, Autumn / Winter' },
    ],
  },
  electronics: {
    title: 'Electronics & Gadgets',
    fields: [
      { key: 'brand', label: 'Brand / Manufacturer', type: 'text', required: true, showInTable: true, description: 'Brand name' },
      { key: 'model_number', label: 'Model Number', type: 'text', required: false, showInTable: true, description: 'Factory model identifier' },
      { key: 'warranty_months', label: 'Warranty (Months)', type: 'number', required: false, showInTable: true, description: 'Manufacturer warranty length' },
      { key: 'voltage_power', label: 'Power Rating / Voltage', type: 'text', required: false, showInTable: false, description: 'e.g. 220V, 65W USB-C' },
      { key: 'requires_serial', label: 'Track Serial Numbers', type: 'boolean', required: false, showInTable: false, description: 'Capture unique serial on checkout' },
    ],
  },
  pharmacy: {
    title: 'Pharmacy & Healthcare',
    fields: [
      { key: 'active_ingredient', label: 'Generic / Active Substance', type: 'text', required: true, showInTable: true, description: 'Active pharmaceutical ingredient' },
      { key: 'dosage', label: 'Strength / Dosage', type: 'text', required: true, showInTable: true, description: 'e.g. 500mg, 10mg/5ml' },
      { key: 'expiry_date', label: 'Expiry Date', type: 'date', required: true, showInTable: true, description: 'Mandatory medication expiration date' },
      { key: 'batch_number', label: 'Lot / Batch Number', type: 'text', required: true, showInTable: true, description: 'Traceability batch code' },
      { key: 'requires_prescription', label: 'Prescription Required (Rx)', type: 'boolean', required: false, showInTable: true, description: 'Cannot be dispensed OTC' },
    ],
  },
  hardware: {
    title: 'Hardware & Tools',
    fields: [
      { key: 'dimensions', label: 'Dimensions / Gauge', type: 'text', required: false, showInTable: true, description: 'e.g. 10mm x 50mm, 1/2 inch' },
      { key: 'material_grade', label: 'Material Grade', type: 'text', required: false, showInTable: false, description: 'e.g. Stainless Steel 316, Brass' },
      { key: 'weight_kg', label: 'Weight (KG)', type: 'number', required: false, showInTable: false, description: 'Weight for shipping or load calculations' },
    ],
  },
};

// GET /settings/store - Store profile and branding settings
router.get('/store', ensureAuthenticated, loadActiveStore, ensureRole(['owner', 'manager']), async (req, res) => {
  res.render('settings/store', {
    title: 'Store Settings & Branding',
    success: req.query.success ? 'Store settings saved successfully.' : null,
    error: null,
  });
});

// PUT /settings/store - Update store profile, branding and receipt settings
router.put('/store', ensureAuthenticated, loadActiveStore, ensureRole(['owner']), async (req, res) => {
  try {
    const store = req.store;
    const {
      name,
      storeType,
      currency,
      currencyCode,
      taxRate,
      lowStockThreshold,
      brandColor,
      phone,
      email,
      address,
      headerMessage,
      footerMessage,
      showTax,
      showBarcode,
    } = req.body;

    if (name) store.name = name.trim();
    if (storeType) store.storeType = storeType;
    if (currency) store.currency = currency.trim();
    if (currencyCode) store.currencyCode = currencyCode.trim().toUpperCase();
    if (taxRate !== undefined) store.taxRate = Math.max(0, Math.min(100, Number(taxRate) || 0));
    if (lowStockThreshold !== undefined) store.lowStockThreshold = Math.max(0, Number(lowStockThreshold) || 5);
    if (brandColor) store.brandColor = brandColor;
    if (phone !== undefined) store.phone = phone.trim();
    if (email !== undefined) store.email = email.trim();
    if (address !== undefined) store.address = address.trim();

    store.receiptSettings = {
      headerMessage: headerMessage || 'Thank you for shopping with us!',
      footerMessage: footerMessage || 'Please retain receipt for returns or warranty.',
      showTax: showTax === 'on' || showTax === true,
      showBarcode: showBarcode === 'on' || showBarcode === true,
      paperWidth: '80mm',
    };

    await store.save();
    res.redirect('/settings/store?success=1');
  } catch (error) {
    console.error('Update Store Settings Error:', error);
    res.render('settings/store', {
      title: 'Store Settings & Branding',
      error: 'Failed to update store settings.',
      success: null,
    });
  }
});

// GET /settings/custom-fields - Dynamic custom fields builder
router.get('/custom-fields', ensureAuthenticated, loadActiveStore, ensureRole(['owner', 'manager']), async (req, res) => {
  res.render('settings/custom-fields', {
    title: 'Custom Product Fields',
    customFields: req.store.customFields || [],
    presets: INDUSTRY_PRESETS,
    success: req.query.success ? 'Custom fields updated successfully.' : null,
    error: req.query.error || null,
  });
});

// POST /settings/custom-fields - Add a new custom field to store
router.post('/custom-fields', ensureAuthenticated, loadActiveStore, ensureRole(['owner']), async (req, res) => {
  try {
    const store = req.store;
    const { key, label, type, options, required, showInTable, description } = req.body;

    if (!key || !label) {
      return res.redirect('/settings/custom-fields?error=Field+key+and+label+are+required');
    }

    const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Check if key already exists
    const exists = store.customFields.some((f) => f.key === cleanKey);
    if (exists) {
      return res.redirect(`/settings/custom-fields?error=Field+with+key+"${cleanKey}"+already+exists`);
    }

    // Parse options if type is select
    let parsedOptions = [];
    if (type === 'select' && options) {
      parsedOptions = options
        .split(',')
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);
    }

    store.customFields.push({
      key: cleanKey,
      label: label.trim(),
      type: type || 'text',
      options: parsedOptions,
      required: required === 'on' || required === true,
      showInTable: showInTable === 'on' || showInTable === true,
      description: (description || '').trim(),
    });

    await store.save();
    res.redirect('/settings/custom-fields?success=1');
  } catch (error) {
    console.error('Add Custom Field Error:', error);
    res.redirect('/settings/custom-fields?error=Failed+to+add+custom+field');
  }
});

// DELETE /settings/custom-fields/:fieldId - Remove a custom field
router.delete('/custom-fields/:fieldId', ensureAuthenticated, loadActiveStore, ensureRole(['owner']), async (req, res) => {
  try {
    const store = req.store;
    store.customFields = store.customFields.filter((f) => f._id.toString() !== req.params.fieldId);
    await store.save();
    res.redirect('/settings/custom-fields?success=Field+removed');
  } catch (error) {
    console.error('Delete Custom Field Error:', error);
    res.redirect('/settings/custom-fields?error=Failed+to+delete+field');
  }
});

// POST /settings/custom-fields/apply-preset - Apply an industry preset
router.post('/custom-fields/apply-preset', ensureAuthenticated, loadActiveStore, ensureRole(['owner']), async (req, res) => {
  try {
    const store = req.store;
    const { presetName, replaceExisting } = req.body;

    const preset = INDUSTRY_PRESETS[presetName];
    if (!preset) {
      return res.redirect('/settings/custom-fields?error=Invalid+preset+selected');
    }

    if (replaceExisting === 'on' || replaceExisting === true) {
      store.customFields = preset.fields;
    } else {
      // Merge: only add fields that don't already exist
      for (const field of preset.fields) {
        if (!store.customFields.some((f) => f.key === field.key)) {
          store.customFields.push(field);
        }
      }
    }

    store.storeType = presetName;
    await store.save();
    res.redirect('/settings/custom-fields?success=Preset+applied+successfully');
  } catch (error) {
    console.error('Apply Preset Error:', error);
    res.redirect('/settings/custom-fields?error=Failed+to+apply+preset');
  }
});

// GET /settings/categories - Manage categories
router.get('/categories', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const categories = await Category.find({ store: req.store._id }).sort({ name: 1 });
    res.render('settings/categories', {
      title: 'Product Categories',
      categories,
      error: req.query.error || null,
      success: req.query.success || null,
    });
  } catch (error) {
    console.error('List Categories Error:', error);
    res.redirect('/dashboard');
  }
});

// POST /settings/categories - Add category
router.post('/categories', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const { name, color, description } = req.body;
    if (!name || !name.trim()) {
      return res.redirect('/settings/categories?error=Category+name+is+required');
    }

    const category = new Category({
      store: req.store._id,
      name: name.trim(),
      color: color || '#3b82f6',
      description: (description || '').trim(),
    });

    await category.save();
    res.redirect('/settings/categories?success=Category+created');
  } catch (error) {
    console.error('Create Category Error:', error);
    res.redirect('/settings/categories?error=Category+already+exists+or+invalid');
  }
});

// DELETE /settings/categories/:id - Delete category
router.delete('/categories/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    await Category.findOneAndDelete({ _id: req.params.id, store: req.store._id });
    res.redirect('/settings/categories?success=Category+deleted');
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.redirect('/settings/categories?error=Failed+to+delete+category');
  }
});

// GET /settings/pos - POS Touchscreen Customizer
router.get('/pos', ensureAuthenticated, loadActiveStore, ensureRole(['owner', 'manager']), async (req, res) => {
  res.render('settings/pos', {
    title: 'POS Screen Customizer',
    posSettings: req.store.posSettings || {},
    success: req.query.success ? 'POS screen preferences saved successfully.' : null,
    error: req.query.error || null,
  });
});

// Handler for saving POS Touchscreen Customizer settings
const updatePosSettings = async (req, res) => {
  try {
    const store = req.store;
    const {
      layout,
      gridColumns,
      theme,
      enableOnScreenNumpad,
      enableSoundEffects,
      quickCashNotes,
      quickDiscountButtons,
      showStockCountOnTile,
      showSkuOnTile,
      showCategoryTabs,
      allowCustomLineItem,
      touchButtonSize,
    } = req.body;

    // Parse cash notes
    let parsedNotes = [5, 10, 20, 50, 100];
    if (quickCashNotes) {
      parsedNotes = quickCashNotes
        .split(',')
        .map((n) => parseFloat(n.trim()))
        .filter((n) => !isNaN(n) && n > 0);
    }

    // Parse discount buttons
    let parsedDiscounts = [5, 10, 15, 20];
    if (quickDiscountButtons) {
      parsedDiscounts = quickDiscountButtons
        .split(',')
        .map((d) => parseFloat(d.trim()))
        .filter((d) => !isNaN(d) && d > 0);
    }

    const existingButtons = (store.posSettings && store.posSettings.quickButtons) ? store.posSettings.quickButtons : [];

    store.posSettings = {
      layout: layout || 'cart-right',
      gridColumns: gridColumns || 'standard',
      theme: theme || 'light',
      enableOnScreenNumpad: enableOnScreenNumpad === 'on' || enableOnScreenNumpad === true,
      enableSoundEffects: enableSoundEffects === 'on' || enableSoundEffects === true,
      quickCashNotes: parsedNotes,
      quickDiscountButtons: parsedDiscounts,
      showStockCountOnTile: showStockCountOnTile === 'on' || showStockCountOnTile === true,
      showSkuOnTile: showSkuOnTile === 'on' || showSkuOnTile === true,
      showCategoryTabs: showCategoryTabs === 'on' || showCategoryTabs === true,
      allowCustomLineItem: allowCustomLineItem === 'on' || allowCustomLineItem === true,
      touchButtonSize: touchButtonSize || 'comfortable',
      quickButtons: existingButtons,
    };

    await store.save();
    res.redirect('/settings/pos?success=1');
  } catch (error) {
    console.error('Update POS Settings Error:', error);
    res.redirect('/settings/pos?error=Failed+to+save+POS+preferences');
  }
};

router.put('/pos', ensureAuthenticated, loadActiveStore, ensureRole(['owner', 'manager']), updatePosSettings);
router.post('/pos', ensureAuthenticated, loadActiveStore, ensureRole(['owner', 'manager']), updatePosSettings);

module.exports = router;

