const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  // your fields  
  productName: String,
  productCode: String,
  brand: String,
  category: String,
  qty: Number,
  rrp: Number,
  price: Number,
  barcode: String,
  imageUrl: String

}, { collection: 'stock' });
