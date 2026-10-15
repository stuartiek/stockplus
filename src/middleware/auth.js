const User = require('../models/User');

// Check if user is logged in
const ensureAuthenticated = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  try {
    const user = await User.findById(req.session.userId).populate('stores.store');
    if (!user) {
      req.session.destroy();
      return res.redirect('/auth/login');
    }

    req.user = user;
    res.locals.currentUser = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.redirect('/auth/login');
  }
};

// Check if user is already logged in (redirect to dashboard)
const ensureGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  next();
};

// Role-based access control for current active store
const ensureRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user || !req.store) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'No active store or session found.',
      });
    }

    // Check user role in active store
    const storeMembership = req.user.stores.find(
      (s) => s.store._id ? s.store._id.toString() === req.store._id.toString() : s.store.toString() === req.store._id.toString()
    );

    const userRole = storeMembership ? storeMembership.role : 'cashier';
    req.userRole = userRole;
    res.locals.userRole = userRole;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).render('error', {
        title: 'Permission Denied',
        message: `Your role (${userRole}) does not have permission to access this area.`,
      });
    }

    next();
  };
};

module.exports = {
  ensureAuthenticated,
  ensureGuest,
  ensureRole,
};

