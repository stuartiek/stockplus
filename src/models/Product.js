const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    description: {
      type: String,
      default: '',
    },
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: 0,
    },
    currentStock: {
      type: Number,
      default: 0,
    },
    reorderLevel: {
      type: Number,
      default: 5,
      min: 0,
    },
    unit: {
      type: String,
      default: 'pcs',
      trim: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    // Dynamic store-customizable fields stored here as a flexible map/document
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// SKU must be unique per store
productSchema.index({ store: 1, sku: 1 }, { unique: true });
// Fast search indexes
productSchema.index({ store: 1, barcode: 1 });
productSchema.index({ store: 1, name: 'text', sku: 'text', barcode: 'text' });

module.exports = mongoose.model('Product', productSchema);

