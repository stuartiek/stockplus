require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Store = require('./models/Store');
const Category = require('./models/Category');
const Supplier = require('./models/Supplier');
const Product = require('./models/Product');
const StockMovement = require('./models/StockMovement');
const PurchaseOrder = require('./models/PurchaseOrder');
const Sale = require('./models/Sale');

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stockplus';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB for seeding');

    // Clear existing collections
    await Promise.all([
      User.deleteMany({}),
      Store.deleteMany({}),
      Category.deleteMany({}),
      Supplier.deleteMany({}),
      Product.deleteMany({}),
      StockMovement.deleteMany({}),
      PurchaseOrder.deleteMany({}),
      Sale.deleteMany({}),
    ]);
    console.log('✓ Cleared existing database records');

    // 1. Create Demo User
    const adminUser = new User({
      name: 'Stuart Admin',
      email: 'admin@stockplus.com',
      password: 'password123',
    });
    await adminUser.save();
    console.log('✓ Created User: admin@stockplus.com (password123)');

    // 2. Create Store 1: Grocery Store
    const groceryStore = new Store({
      name: 'GreenLeaf Fresh Market',
      slug: 'greenleaf-fresh-market',
      storeType: 'grocery',
      owner: adminUser._id,
      currency: '$',
      currencyCode: 'USD',
      taxRate: 5,
      lowStockThreshold: 5,
      brandColor: '#059669', // Emerald
      phone: '+1 (555) 789-0123',
      email: 'orders@greenleafmarket.com',
      address: '742 Evergreen Terrace, Springfield',
      receiptSettings: {
        headerMessage: 'Thank you for supporting sustainable local produce!',
        footerMessage: 'Freshness guaranteed! Returns accepted within 7 days with receipt.',
        showTax: true,
        showBarcode: true,
      },
      posSettings: {
        layout: 'cart-right',
        gridColumns: 'standard',
        theme: 'light',
        enableOnScreenNumpad: true,
        enableSoundEffects: true,
        quickCashNotes: [5, 10, 20, 50, 100],
        quickDiscountButtons: [5, 10, 15, 20],
        showStockCountOnTile: true,
        showSkuOnTile: true,
        showCategoryTabs: true,
        allowCustomLineItem: true,
        touchButtonSize: 'comfortable',
        quickButtons: [
          {
            id: 'btn_grocery_bag',
            label: 'Paper Bag',
            icon: 'shopping-bag',
            color: 'emerald',
            actionType: 'add_item',
            actionData: {
              name: 'Eco Kraft Paper Bag',
              price: 0.15,
              sku: 'BAG-01',
            },
            order: 0,
          },
          {
            id: 'btn_grocery_drinks',
            label: 'Beverage Add-ons',
            icon: 'coffee',
            color: 'amber',
            actionType: 'popup_submenu',
            actionData: {
              title: 'Beverage & Bar Add-ons',
              items: [
                { name: 'Oat Milk Substitution', price: 0.75 },
                { name: 'Extra Espresso Shot', price: 1.00 },
                { name: 'Organic Vanilla Syrup', price: 0.50 },
                { name: 'Whipped Cream Topping', price: 0.60 },
              ],
            },
            order: 1,
          },
          {
            id: 'btn_grocery_bottle',
            label: 'Bottle Return / Fee',
            icon: 'recycle',
            color: 'blue',
            actionType: 'popup_prompt',
            actionData: {
              title: 'Recycle Deposit / Fee',
              defaultName: 'Glass Bottle Deposit Refund',
              defaultPrice: -0.20,
            },
            order: 2,
          },
          {
            id: 'btn_grocery_staff_disc',
            label: 'Staff 10% Off',
            icon: 'percent',
            color: 'rose',
            actionType: 'discount',
            actionData: {
              percentage: 10,
            },
            order: 3,
          },
          {
            id: 'btn_grocery_policy',
            label: 'Store Policy',
            icon: 'help-circle',
            color: 'purple',
            actionType: 'info_modal',
            actionData: {
              title: 'Fresh Produce Return Policy',
              content: 'Perishable goods are refundable within 48 hours with receipt. Sealed pantry goods can be exchanged within 14 days. Organic produce freshness is 100% guaranteed!',
            },
            order: 4,
          },
        ],
      },
      customFields: [
        {
          key: 'expiry_date',
          label: 'Expiry Date',
          type: 'date',
          required: true,
          showInTable: true,
          description: 'Perishable shelf expiration',
        },
        {
          key: 'batch_number',
          label: 'Batch / Lot #',
          type: 'text',
          required: true,
          showInTable: true,
          description: 'Traceability lot code',
        },
        {
          key: 'storage_temp',
          label: 'Storage Temp',
          type: 'select',
          options: ['Ambient / Shelf', 'Refrigerated (2-8°C)', 'Frozen (-18°C)'],
          required: false,
          showInTable: true,
          description: 'Storage requirements',
        },
        {
          key: 'is_organic',
          label: 'Organic Certified',
          type: 'boolean',
          required: false,
          showInTable: true,
          description: 'Certified organic sticker',
        },
      ],
    });
    await groceryStore.save();

    // 3. Create Store 2: Fashion Store
    const fashionStore = new Store({
      name: 'Apex Boutique & Apparel',
      slug: 'apex-boutique-apparel',
      storeType: 'fashion',
      owner: adminUser._id,
      currency: '$',
      currencyCode: 'USD',
      taxRate: 8.5,
      lowStockThreshold: 3,
      brandColor: '#4f46e5', // Indigo
      phone: '+1 (555) 345-6789',
      email: 'concierge@apexfashion.com',
      address: '450 Fashion Avenue, Suite 12B, New York, NY',
      receiptSettings: {
        headerMessage: 'Elegance in every stitch. Welcome to Apex.',
        footerMessage: 'Exchanges within 14 days with tags attached and receipt.',
        showTax: true,
        showBarcode: true,
      },
      posSettings: {
        layout: 'cart-left',
        gridColumns: 'large',
        theme: 'dark',
        enableOnScreenNumpad: true,
        enableSoundEffects: true,
        quickCashNotes: [20, 50, 100, 200],
        quickDiscountButtons: [10, 20, 30, 50],
        showStockCountOnTile: true,
        showSkuOnTile: true,
        showCategoryTabs: true,
        allowCustomLineItem: true,
        touchButtonSize: 'jumbo',
        quickButtons: [
          {
            id: 'btn_fashion_tailor',
            label: 'Tailoring / Hemming',
            icon: 'scissors',
            color: 'purple',
            actionType: 'popup_prompt',
            actionData: {
              title: 'Custom Alteration / Tailoring',
              defaultName: 'Trousers / Dress Hemming',
              defaultPrice: 15.00,
            },
            order: 0,
          },
          {
            id: 'btn_fashion_gift',
            label: 'Luxury Gift Box',
            icon: 'gift',
            color: 'rose',
            actionType: 'add_item',
            actionData: {
              name: 'Signature Velvet Gift Box & Ribbon',
              price: 8.50,
              sku: 'GIFT-BOX',
            },
            order: 1,
          },
          {
            id: 'btn_fashion_vip',
            label: 'VIP 15% Off',
            icon: 'tag',
            color: 'emerald',
            actionType: 'discount',
            actionData: {
              percentage: 15,
            },
            order: 2,
          },
          {
            id: 'btn_fashion_services',
            label: 'Styling Services',
            icon: 'sparkles',
            color: 'amber',
            actionType: 'popup_submenu',
            actionData: {
              title: 'Concierge Services & Fittings',
              items: [
                { name: 'Express Fitting Consultation', price: 25.00 },
                { name: 'Garment Steaming & Pressing', price: 12.00 },
                { name: 'Leather Conditioning Treatment', price: 18.00 },
                { name: 'Personal Shopper Appointment', price: 50.00 },
              ],
            },
            order: 3,
          },
          {
            id: 'btn_fashion_care',
            label: 'Fabric Care Guide',
            icon: 'info',
            color: 'blue',
            actionType: 'info_modal',
            actionData: {
              title: 'Luxury Fabric Care Guidelines',
              content: 'Silk & Cashmere items: dry clean only. Italian Wool suits should be aired on cedar hangers. Exchanges permitted within 14 days with original tags intact.',
            },
            order: 4,
          },
        ],
      },
      customFields: [
        {
          key: 'size',
          label: 'Size',
          type: 'select',
          options: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
          required: true,
          showInTable: true,
          description: 'Garment size',
        },
        {
          key: 'color',
          label: 'Color Variant',
          type: 'text',
          required: true,
          showInTable: true,
          description: 'Primary fabric color',
        },
        {
          key: 'material',
          label: 'Fabric Composition',
          type: 'text',
          required: false,
          showInTable: false,
          description: 'e.g. 100% Organic Cotton',
        },
        {
          key: 'gender',
          label: 'Department',
          type: 'select',
          options: ['Men', 'Women', 'Unisex'],
          required: false,
          showInTable: true,
          description: 'Target section',
        },
        {
          key: 'season',
          label: 'Collection / Season',
          type: 'text',
          required: false,
          showInTable: false,
          description: 'e.g. SS26 or FW26',
        },
      ],
    });
    await fashionStore.save();

    // Attach stores to user
    adminUser.stores = [
      { store: groceryStore._id, role: 'owner' },
      { store: fashionStore._id, role: 'owner' },
    ];
    adminUser.activeStore = groceryStore._id;
    await adminUser.save();
    console.log('✓ Created 2 Multi-Tenant Stores: Grocery and Fashion');

    // 4. Seed Grocery Store Data
    const catDairy = await Category.create({ store: groceryStore._id, name: 'Dairy & Eggs', color: '#3b82f6' });
    const catProduce = await Category.create({ store: groceryStore._id, name: 'Organic Produce', color: '#10b981' });
    const catBakery = await Category.create({ store: groceryStore._id, name: 'Bakery', color: '#f59e0b' });
    const catBeverage = await Category.create({ store: groceryStore._id, name: 'Beverages', color: '#06b6d4' });

    const supValley = await Supplier.create({
      store: groceryStore._id,
      name: 'Valley Organics Wholesalers',
      contactPerson: 'Sarah Jenkins',
      email: 'orders@valleyorganics.com',
      phone: '+1 (555) 901-2345',
      paymentTerms: 'Net 30',
      address: '100 Farm Road, Hudson Valley, NY',
    });

    const supDairy = await Supplier.create({
      store: groceryStore._id,
      name: 'Highland Meadow Dairy Co',
      contactPerson: 'David Miller',
      email: 'supply@highlanddairy.com',
      phone: '+1 (555) 456-7890',
      paymentTerms: 'Net 14',
      address: '88 Pasture Way, Vermont',
    });

    // Grocery Products with custom dynamic fields
    const gProd1 = await Product.create({
      store: groceryStore._id,
      name: 'Whole Grass-Fed Organic Milk 1L',
      sku: 'GRO-MLK-001',
      barcode: '789100010011',
      category: catDairy._id,
      supplier: supDairy._id,
      costPrice: 2.10,
      sellingPrice: 3.99,
      currentStock: 28,
      reorderLevel: 6,
      unit: 'bottle',
      customFields: {
        expiry_date: '2026-11-20',
        batch_number: 'LOT-2026-M4',
        storage_temp: 'Refrigerated (2-8°C)',
        is_organic: true,
      },
    });

    const gProd2 = await Product.create({
      store: groceryStore._id,
      name: 'Artisan Sourdough Loaf (800g)',
      sku: 'GRO-BKR-002',
      barcode: '789100010028',
      category: catBakery._id,
      costPrice: 1.80,
      sellingPrice: 4.50,
      currentStock: 3, // LOW STOCK!
      reorderLevel: 5,
      unit: 'loaf',
      customFields: {
        expiry_date: '2026-10-18',
        batch_number: 'BTH-SD-102',
        storage_temp: 'Ambient / Shelf',
        is_organic: true,
      },
    });

    const gProd3 = await Product.create({
      store: groceryStore._id,
      name: 'Hass Avocados (Pack of 4)',
      sku: 'GRO-PRD-003',
      barcode: '789100010035',
      category: catProduce._id,
      supplier: supValley._id,
      costPrice: 2.50,
      sellingPrice: 5.25,
      currentStock: 16,
      reorderLevel: 5,
      unit: 'pack',
      customFields: {
        expiry_date: '2026-10-25',
        batch_number: 'LOT-AV-99',
        storage_temp: 'Ambient / Shelf',
        is_organic: true,
      },
    });

    const gProd4 = await Product.create({
      store: groceryStore._id,
      name: 'Cold Pressed Orange Juice 500ml',
      sku: 'GRO-BEV-004',
      barcode: '789100010042',
      category: catBeverage._id,
      costPrice: 1.60,
      sellingPrice: 3.75,
      currentStock: 14,
      reorderLevel: 4,
      unit: 'bottle',
      customFields: {
        expiry_date: '2026-11-05',
        batch_number: 'LOT-OJ-303',
        storage_temp: 'Refrigerated (2-8°C)',
        is_organic: false,
      },
    });

    const gProd5 = await Product.create({
      store: groceryStore._id,
      name: 'Greek Plain Yogurt 500g',
      sku: 'GRO-MLK-005',
      barcode: '789100010059',
      category: catDairy._id,
      supplier: supDairy._id,
      costPrice: 2.20,
      sellingPrice: 4.99,
      currentStock: 1, // LOW STOCK!
      reorderLevel: 4,
      unit: 'tub',
      customFields: {
        expiry_date: '2026-11-15',
        batch_number: 'LOT-GY-401',
        storage_temp: 'Refrigerated (2-8°C)',
        is_organic: false,
      },
    });

    // Grocery Movements
    await StockMovement.create([
      {
        store: groceryStore._id,
        product: gProd1._id,
        type: 'purchase_in',
        quantity: 30,
        previousStock: 0,
        newStock: 30,
        costPrice: 2.10,
        sellingPrice: 3.99,
        reason: 'Initial delivery intake from Highland Meadow Dairy',
        referenceId: 'PO-2026-1001',
        performedBy: adminUser._id,
      },
      {
        store: groceryStore._id,
        product: gProd1._id,
        type: 'sale_out',
        quantity: -2,
        previousStock: 30,
        newStock: 28,
        costPrice: 2.10,
        sellingPrice: 3.99,
        reason: 'POS Sale REC-20261014-1102',
        referenceId: 'REC-20261014-1102',
        performedBy: adminUser._id,
      },
      {
        store: groceryStore._id,
        product: gProd2._id,
        type: 'damage_loss',
        quantity: -1,
        previousStock: 4,
        newStock: 3,
        costPrice: 1.80,
        sellingPrice: 4.50,
        reason: 'Packaging damaged during morning shelf replenishment',
        referenceId: 'DAMAGED_SHELF',
        performedBy: adminUser._id,
      },
    ]);

    // Grocery Sale
    await Sale.create({
      store: groceryStore._id,
      receiptNumber: 'REC-20261014-1102',
      items: [
        {
          product: gProd1._id,
          name: gProd1.name,
          sku: gProd1.sku,
          quantity: 2,
          unitPrice: 3.99,
          subtotal: 7.98,
        },
        {
          product: gProd3._id,
          name: gProd3.name,
          sku: gProd3.sku,
          quantity: 1,
          unitPrice: 5.25,
          subtotal: 5.25,
        },
      ],
      subtotal: 13.23,
      taxRate: 5,
      taxAmount: 0.66,
      discountAmount: 0,
      total: 13.89,
      paymentMethod: 'cash',
      cashReceived: 20.00,
      changeGiven: 6.11,
      customerName: 'Emma Watson',
      customerPhone: '+1 (555) 234-5678',
      cashier: adminUser._id,
    });

    // Grocery Purchase Order
    await PurchaseOrder.create({
      store: groceryStore._id,
      poNumber: 'PO-2026-1001',
      supplier: supDairy._id,
      status: 'received',
      items: [
        {
          product: gProd1._id,
          name: gProd1.name,
          sku: gProd1.sku,
          quantity: 30,
          unitCost: 2.10,
          totalCost: 63.00,
        },
      ],
      totalAmount: 63.00,
      expectedDate: new Date('2026-10-10'),
      receivedDate: new Date('2026-10-11'),
      notes: 'Delivered in refrigerated truck at 4°C.',
      createdBy: adminUser._id,
    });

    console.log('✓ Populated GreenLeaf Fresh Market catalog & transactions');

    // 5. Seed Fashion Store Data
    const catTops = await Category.create({ store: fashionStore._id, name: 'Tops & Shirts', color: '#6366f1' });
    const catDenim = await Category.create({ store: fashionStore._id, name: 'Denim & Trousers', color: '#3b82f6' });
    const catKnitwear = await Category.create({ store: fashionStore._id, name: 'Knitwear & Sweaters', color: '#ec4899' });

    const supApexMills = await Supplier.create({
      store: fashionStore._id,
      name: 'Apex Mills & Garment Works',
      contactPerson: 'Marco Rossi',
      email: 'm.rossi@apexmills.com',
      phone: '+1 (555) 678-1234',
      paymentTerms: 'Net 60',
      address: '77 Garment District, Milano / New York',
    });

    const fProd1 = await Product.create({
      store: fashionStore._id,
      name: 'Classic Oxford Button-Down Shirt',
      sku: 'APX-SHT-001',
      barcode: '890200020015',
      category: catTops._id,
      supplier: supApexMills._id,
      costPrice: 28.00,
      sellingPrice: 75.00,
      currentStock: 18,
      reorderLevel: 4,
      unit: 'pcs',
      customFields: {
        size: 'M',
        color: 'Oxford Sky Blue',
        material: '100% Combed Cotton',
        gender: 'Men',
        season: 'SS26',
      },
    });

    const fProd2 = await Product.create({
      store: fashionStore._id,
      name: 'Selvedge Raw Denim Jeans (Straight)',
      sku: 'APX-JNS-002',
      barcode: '890200020022',
      category: catDenim._id,
      supplier: supApexMills._id,
      costPrice: 45.00,
      sellingPrice: 135.00,
      currentStock: 2, // LOW STOCK!
      reorderLevel: 3,
      unit: 'pair',
      customFields: {
        size: 'L',
        color: 'Deep Indigo Raw',
        material: '13.5oz Japanese Kurabo Selvedge',
        gender: 'Unisex',
        season: 'All-Season',
      },
    });

    const fProd3 = await Product.create({
      store: fashionStore._id,
      name: 'Merino Wool Mockneck Sweater',
      sku: 'APX-KNT-003',
      barcode: '890200020039',
      category: catKnitwear._id,
      costPrice: 38.00,
      sellingPrice: 110.00,
      currentStock: 9,
      reorderLevel: 2,
      unit: 'pcs',
      customFields: {
        size: 'S',
        color: 'Heather Charcoal',
        material: '100% Extra-fine Merino Wool',
        gender: 'Women',
        season: 'FW26',
      },
    });

    await StockMovement.create([
      {
        store: fashionStore._id,
        product: fProd1._id,
        type: 'purchase_in',
        quantity: 20,
        previousStock: 0,
        newStock: 20,
        costPrice: 28.00,
        sellingPrice: 75.00,
        reason: 'SS26 collection stock intake',
        referenceId: 'PO-2026-F100',
        performedBy: adminUser._id,
      },
      {
        store: fashionStore._id,
        product: fProd1._id,
        type: 'sale_out',
        quantity: -2,
        previousStock: 20,
        newStock: 18,
        costPrice: 28.00,
        sellingPrice: 75.00,
        reason: 'Boutique Sale REC-20261014-9901',
        referenceId: 'REC-20261014-9901',
        performedBy: adminUser._id,
      },
    ]);

    await Sale.create({
      store: fashionStore._id,
      receiptNumber: 'REC-20261014-9901',
      items: [
        {
          product: fProd1._id,
          name: fProd1.name,
          sku: fProd1.sku,
          quantity: 2,
          unitPrice: 75.00,
          subtotal: 150.00,
        },
      ],
      subtotal: 150.00,
      taxRate: 8.5,
      taxAmount: 12.75,
      discountAmount: 10.00,
      total: 152.75,
      paymentMethod: 'card',
      cashReceived: 152.75,
      changeGiven: 0,
      customerName: 'Oliver Smith',
      customerPhone: '+1 (555) 987-6543',
      cashier: adminUser._id,
    });

    console.log('✓ Populated Apex Boutique & Apparel catalog & transactions');

    console.log('==================================================');
    console.log('✨ DATABASE SEEDING COMPLETED SUCCESSFULLY ✨');
    console.log('Log into StockPlus using:');
    console.log('Email:    admin@stockplus.com');
    console.log('Password: password123');
    console.log('Stores available: "GreenLeaf Fresh Market" & "Apex Boutique"');
    console.log('==================================================');
    process.exit(0);
  } catch (err) {
    console.error('Seeding Error:', err);
    process.exit(1);
  }
}

seed();

