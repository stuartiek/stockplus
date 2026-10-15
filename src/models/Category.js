const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    color: {
      type: String,
      default: '#3b82f6',
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure category names are unique per store
categorySchema.index({ store: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);

