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
}, {
  collection: 'stock' // 👈 Explicitly tell Mongoose to use this collection
});

module.exports = mongoose.model('Stock', stockSchema);