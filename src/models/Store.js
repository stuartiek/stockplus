const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  label: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['text', 'number', 'date', 'select', 'boolean'],
    default: 'text',
  },
  options: [
    {
      type: String,
      trim: true,
    },
  ],
  required: {
    type: Boolean,
    default: false,
  },
  showInTable: {
    type: Boolean,
    default: true,
  },
  description: {
    type: String,
    default: '',
  },
});

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a store name'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    storeType: {
      type: String,
      enum: ['grocery', 'fashion', 'electronics', 'pharmacy', 'hardware', 'books', 'general'],
      default: 'general',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    currency: {
      type: String,
      default: '$',
      trim: true,
    },
    currencyCode: {
      type: String,
      default: 'USD',
      trim: true,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    brandColor: {
      type: String,
      default: '#2563eb', // Blue-600
    },
    logo: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    receiptSettings: {
      headerMessage: {
        type: String,
        default: 'Thank you for shopping with us!',
      },
      footerMessage: {
        type: String,
        default: 'Please retain receipt for returns/warranty. Goods sold in good condition.',
      },
      showTax: {
        type: Boolean,
        default: true,
      },
      showBarcode: {
        type: Boolean,
        default: true,
      },
      paperWidth: {
        type: String,
        default: '80mm',
      },
    },
    posSettings: {
      layout: {
        type: String,
        enum: ['cart-right', 'cart-left'],
        default: 'cart-right',
      },
      gridColumns: {
        type: String,
        enum: ['compact', 'standard', 'large'],
        default: 'standard',
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'high-contrast'],
        default: 'light',
      },
      enableOnScreenNumpad: {
        type: Boolean,
        default: true,
      },
      enableSoundEffects: {
        type: Boolean,
        default: true,
      },
      quickCashNotes: {
        type: [Number],
        default: [5, 10, 20, 50, 100],
      },
      quickDiscountButtons: {
        type: [Number],
        default: [5, 10, 15, 20],
      },
      showStockCountOnTile: {
        type: Boolean,
        default: true,
      },
      showSkuOnTile: {
        type: Boolean,
        default: true,
      },
      showCategoryTabs: {
        type: Boolean,
        default: true,
      },
      allowCustomLineItem: {
        type: Boolean,
        default: true,
      },
      touchButtonSize: {
        type: String,
        enum: ['regular', 'comfortable', 'jumbo'],
        default: 'comfortable',
      },
      quickButtons: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true },
          icon: { type: String, default: 'sparkles' },
          color: { type: String, default: 'emerald' },
          actionType: {
            type: String,
            enum: ['add_item', 'discount', 'popup_prompt', 'popup_submenu', 'info_modal'],
            default: 'popup_prompt',
          },
          actionData: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
          },
          order: { type: Number, default: 0 },
        },
      ],
    },
    customFields: [customFieldSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Store', storeSchema);

