const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  imageUrl: String,
  productName: String,
  productCode: String,
  brand: String,
  category: String,
  qty: String,
  rrp: String,
  price: String,
  barcode: String,
  productURL: String,
  deleteURL: String,
  published: String
}, { collection: 'stock' }); // 👈 This ensures it queries the correct collection

module.exports = mongoose.model('Stock', stockSchema);