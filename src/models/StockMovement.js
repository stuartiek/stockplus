const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['purchase_in', 'sale_out', 'damage_loss', 'return_in', 'adjustment'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true, // positive for additions, negative for reductions
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    costPrice: {
      type: Number,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      default: '',
    },
    referenceId: {
      type: String,
      default: '', // e.g. receiptNumber, poNumber, or manual adjustment tag
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

stockMovementSchema.index({ store: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);

