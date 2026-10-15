const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const { ensureAuthenticated } = require('../middleware/auth');
const { loadActiveStore } = require('../middleware/tenant');

// GET /suppliers - List suppliers
router.get('/', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const suppliers = await Supplier.find({ store: storeId }).sort({ name: 1 });

    res.render('suppliers/index', {
      title: 'Suppliers Directory',
      suppliers,
    });
  } catch (error) {
    console.error('List Suppliers Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load suppliers list.',
    });
  }
});

// GET /suppliers/new - Create supplier form
router.get('/new', ensureAuthenticated, loadActiveStore, (req, res) => {
  res.render('suppliers/new', {
    title: 'Add New Supplier',
    error: null,
    data: {},
  });
});

// POST /suppliers - Save new supplier
router.post('/', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { name, contactPerson, email, phone, address, paymentTerms, notes } = req.body;

    if (!name || !name.trim()) {
      return res.render('suppliers/new', {
        title: 'Add New Supplier',
        error: 'Supplier name is required.',
        data: req.body,
      });
    }

    const supplier = new Supplier({
      store: storeId,
      name: name.trim(),
      contactPerson: (contactPerson || '').trim(),
      email: (email || '').trim().toLowerCase(),
      phone: (phone || '').trim(),
      address: (address || '').trim(),
      paymentTerms: paymentTerms || 'Net 30',
      notes: (notes || '').trim(),
    });

    await supplier.save();
    res.redirect('/suppliers');
  } catch (error) {
    console.error('Create Supplier Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to create supplier.',
    });
  }
});

// GET /suppliers/:id - View supplier profile & orders
router.get('/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const supplier = await Supplier.findOne({ _id: req.params.id, store: storeId });

    if (!supplier) {
      return res.status(404).render('error', {
        title: 'Supplier Not Found',
        message: 'The requested supplier does not exist.',
      });
    }

    const [orders, products] = await Promise.all([
      PurchaseOrder.find({ store: storeId, supplier: supplier._id }).sort({ createdAt: -1 }),
      Product.find({ store: storeId, supplier: supplier._id, status: 'active' }),
    ]);

    res.render('suppliers/show', {
      title: `${supplier.name} - Profile`,
      supplier,
      orders,
      products,
    });
  } catch (error) {
    console.error('View Supplier Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load supplier details.',
    });
  }
});

// GET /suppliers/:id/edit - Edit supplier form
router.get('/:id/edit', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const supplier = await Supplier.findOne({ _id: req.params.id, store: storeId });

    if (!supplier) {
      return res.status(404).render('error', {
        title: 'Supplier Not Found',
        message: 'The requested supplier was not found.',
      });
    }

    res.render('suppliers/edit', {
      title: `Edit ${supplier.name}`,
      supplier,
      error: null,
    });
  } catch (error) {
    console.error('Edit Supplier Error:', error);
    res.redirect('/suppliers');
  }
});

// PUT /suppliers/:id - Update supplier
router.put('/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    const { name, contactPerson, email, phone, address, paymentTerms, notes } = req.body;

    const supplier = await Supplier.findOne({ _id: req.params.id, store: storeId });
    if (!supplier) {
      return res.status(404).render('error', {
        title: 'Supplier Not Found',
        message: 'Supplier not found.',
      });
    }

    supplier.name = name ? name.trim() : supplier.name;
    supplier.contactPerson = contactPerson !== undefined ? contactPerson.trim() : supplier.contactPerson;
    supplier.email = email !== undefined ? email.trim().toLowerCase() : supplier.email;
    supplier.phone = phone !== undefined ? phone.trim() : supplier.phone;
    supplier.address = address !== undefined ? address.trim() : supplier.address;
    supplier.paymentTerms = paymentTerms || supplier.paymentTerms;
    supplier.notes = notes !== undefined ? notes.trim() : supplier.notes;

    await supplier.save();
    res.redirect(`/suppliers/${supplier._id}`);
  } catch (error) {
    console.error('Update Supplier Error:', error);
    res.status(500).render('error', {
      title: 'Update Error',
      message: 'Failed to update supplier.',
    });
  }
});

// DELETE /suppliers/:id - Delete supplier
router.delete('/:id', ensureAuthenticated, loadActiveStore, async (req, res) => {
  try {
    const storeId = req.store._id;
    await Supplier.findOneAndDelete({ _id: req.params.id, store: storeId });
    res.redirect('/suppliers');
  } catch (error) {
    console.error('Delete Supplier Error:', error);
    res.redirect('/suppliers');
  }
});

module.exports = router;

