const Store = require('../models/Store');
const User = require('../models/User');

const loadActiveStore = async (req, res, next) => {
  // Pass current url path to views for active menu highlighting
  res.locals.currentPath = req.originalUrl.split('?')[0];

  // If not logged in, continue
  if (!req.user) {
    return next();
  }

  try {
    let activeStoreId = req.query.switchStore || req.session.activeStoreId || req.user.activeStore;

    // Check if user requested a store switch via query parameter
    if (req.query.switchStore) {
      activeStoreId = req.query.switchStore;
      req.session.activeStoreId = activeStoreId;
      req.user.activeStore = activeStoreId;
      await User.findByIdAndUpdate(req.user._id, { activeStore: activeStoreId });
      // Redirect back to same URL without the query parameter to keep URL clean
      const cleanUrl = req.originalUrl.replace(/([&?])switchStore=[^&]+(&|$)/, '$1').replace(/[&?]$/, '');
      return res.redirect(cleanUrl || '/dashboard');
    }

    // If still no store id, default to the user's first store
    if (!activeStoreId && req.user.stores && req.user.stores.length > 0) {
      activeStoreId = req.user.stores[0].store._id || req.user.stores[0].store;
      req.session.activeStoreId = activeStoreId;
    }

    // If user has no stores at all, check if we're on the setup page
    if (!activeStoreId) {
      if (req.originalUrl.startsWith('/stores/setup') || req.originalUrl.startsWith('/auth')) {
        return next();
      }
      return res.redirect('/stores/setup');
    }

    // Fetch the active store details
    const store = await Store.findById(activeStoreId);
    if (!store) {
      // If stored ID not found, remove and prompt setup
      req.session.activeStoreId = null;
      if (req.originalUrl.startsWith('/stores/setup') || req.originalUrl.startsWith('/auth')) {
        return next();
      }
      return res.redirect('/stores/setup');
    }

    // Attach active store to request and response locals
    req.store = store;
    res.locals.currentStore = store;
    res.locals.brandColor = store.brandColor || '#2563eb';
    res.locals.currency = store.currency || '$';

    // Populate all stores user belongs to for the store switcher dropdown
    const userStores = await Store.find({
      _id: { $in: req.user.stores.map((s) => s.store._id || s.store) },
    }).select('name slug storeType brandColor');

    res.locals.userStores = userStores;

    // Compute user role in active store
    const membership = req.user.stores.find(
      (s) => (s.store._id ? s.store._id.toString() : s.store.toString()) === store._id.toString()
    );
    const userRole = membership ? membership.role : 'cashier';
    req.userRole = userRole;
    res.locals.userRole = userRole;

    // Helper functions for EJS views
    res.locals.formatMoney = (amount) => {
      const num = Number(amount) || 0;
      return `${store.currency || '$'}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    res.locals.formatDate = (date) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    res.locals.formatDateTime = (date) => {
      if (!date) return '-';
      return new Date(date).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    next();
  } catch (error) {
    console.error('Tenant Middleware Error:', error);
    next(error);
  }
};

module.exports = {
  loadActiveStore,
};

