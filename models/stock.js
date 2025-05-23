const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  productName: String,
  productCode: String,
  brand: String,
  category: String,
  qty: Number,
  rrp: Number,
  price: Number,
  barcode: String,
  imageUrl: String
});

module.exports = mongoose.model('Stock', stockSchema);