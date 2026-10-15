# StockPlus 📦✨
> Multi-Tenant, Domain-Customizable Stock Management System for Stores

**StockPlus** is a fullstack web application built with **Node.js, Express, EJS, and MongoDB (Mongoose)** that provides complete inventory lifecycle management tailored to the unique operational needs of different store types (Groceries, Fashion Boutiques, Electronics, Pharmacies, Hardware, and General Retail).

---

## 🌟 Key Features

### 1. 🎛️ Dynamic Store Customization Engine
- **Custom Product Fields**: Stores can configure custom attributes (e.g. *Expiry Date*, *Batch #*, *Garment Size*, *Color*, *Material*, *Serial Number*, *Warranty*, *Rx Required*) supporting `text`, `number`, `date`, `select dropdowns`, and `boolean checkboxes`.
- **Dynamic Adaptive UI**: Product creation/edit forms and inventory catalog tables dynamically render and validate these custom fields based on the active store's configuration.
- **Industry Presets**: 1-click loaders for Grocery, Fashion & Apparel, Electronics, Pharmacy, and Hardware.
- **Store Branding Customizer**: Configurable currency symbols (`$`, `£`, `€`, `₹`, `₦`, etc.), tax rate (%), low-stock threshold default, brand theme color accent (injected dynamically via CSS variables), and thermal receipt headers/footers.

### 2. 🏬 Multi-Tenant Store Switching
- Single account owners can manage multiple distinct stores (e.g. a grocery branch and a fashion boutique) under one login and switch between them instantly using the top navigation dropdown.
- Complete data isolation per store (isolated stock, categories, suppliers, sales, and custom field schemas).

### 3. 📱 Touchscreen-Optimized POS & Terminal Customizer
- **Touch-First Interface**: Oversized touch targets (minimum 48px), category touch tabs, responsive touch tiles, and 1-tap cart adjustments.
- **On-Screen Touch Numpad & Calculator**: Type quantities, cash amounts, and discount percentages on-screen without requiring a physical keyboard.
- **Custom Movable Buttons with Dynamic Pop-ups**:
  - **Movable & Rearrangeable**: Cashiers and managers can toggle "Move Buttons" mode to drag and reorder action buttons directly on the POS screen (works with mouse drag-and-drop on desktop and touch-point dragging on tablets). The button arrangement persists automatically to the database (`Store.posSettings.quickButtons`).
  - **Dynamic Prompt Pop-ups (`popup_prompt`)**: Prompts cashier for a custom fee amount, reason, and notes (e.g., bottle deposit refunds, custom alteration charges, delivery surcharges) and injects it directly into the sale cart.
  - **Submenu Selection Modals (`popup_submenu`)**: Pops up a grid of optional add-ons or upsells (e.g., Beverage Add-ons: Oat milk, extra shot, syrup; or Alteration Services: Hemming, Steaming, Conditioning).
  - **Information & Staff Guidance Modals (`info_modal`)**: Displays store policies, returns/exchange guidelines, warranty terms, or staff instructions in a rich modal.
  - **Direct Line Items (`add_item`)**: 1-tap quick addition for high-frequency misc items (e.g., Paper Bag Fee, Luxury Gift Box).
  - **Preset Discount Buttons (`discount`)**: 1-tap percentage discounts (e.g., VIP 15% Off, Staff 10% Off).
  - **Sub Total & Dedicated Review & Payment Page (`/pos/payment`)**:
  - The cart displays a prominent **"SUB TOTAL: $XX.XX"** action button that transitions to a dedicated, full-featured review screen.
  - **Comprehensive Discounts Engine**:
    - **% Percentage Discounts**: 1-tap preset chips (e.g. 5%, 10%, 15%, 20%, 25%, 50%) or custom % input.
    - **$ Fixed Dollar Discounts**: Quick dollar savings (-$2, -$5, -$10, -$20) or custom dollar input.
    - **🎟️ Promo / Coupon Code Engine**: Validates customer promotion codes (`VIP15`, `STAFF20`, `SAVE5`, `SAVE10`, etc.).
    - **Discount Reason Tagging**: Tag discounts with audit reasons (e.g., VIP Loyalty, Staff Benefit, Clearance/Damaged, Price Match, Manager Override).
  - **1-Tap Tax Exempt Switch**: Easily zero out taxes for tax-exempt customers or non-profit organizations.
  - **Full Tender & Change Calculator**: Fast cash presets, custom tendered amount, and high-visibility live change calculation.
  - **Customer & Order Notes**: Capture customer name, phone, email for e-receipts, and special order instructions.
  - **"← Back to Register"**: Easily return to the register catalog anytime with 100% cart persistence via session storage.
- **In-Terminal Button Editor**: Create, edit, and delete buttons without leaving the POS screen.
- **Full POS Customization Engine (`/settings/pos`)**:
  - **Screen Layout**: Choose between *Cart on Right* (standard) or *Cart on Left* (for left-handed staff or specific register orientations).
  - **Grid Density**: *Large* (bold touch tiles for high-speed counter service), *Standard* (10"-15" touch displays), or *Compact* (dense catalog view).
  - **Color Themes**: *Crisp Light*, *Dark Mode* (for low-light bars, lounges, and night shifts), or *High Contrast* (outdoor/sunlight stalls).
  - **Customizable Quick Cash Bills**: Configure custom cash tender presets (e.g., $5, $10, $20, $50, $100) for instant 1-tap change calculation.
  - **Custom % Discounts**: 1-tap discount chips (e.g., 5%, 10%, 15%, 20%).
  - **Hold & Recall Orders**: Park an in-progress cart to serve another customer and recall it anytime.
  - **Custom / Misc Line Items**: Touch button to charge for repairs, tailoring, or custom services on the fly.
  - **Web Audio Touch Feedback**: Synthesized confirmation beeps on item scans and taps.
  - **Fullscreen Kiosk Mode**: 1-touch toggle to expand into dedicated tablet fullscreen mode.

### 4. 📜 Complete Stock Movement Ledger (Auditing & Traceability)
- Every physical quantity change is recorded in an audit trail:
  - `purchase_in` (Vendor intake & PO receiving)
  - `sale_out` (POS checkout sales)
  - `damage_loss` (Expired goods, broken/damaged packaging)
  - `return_in` (Customer returns & exchanges)
  - `adjustment` (Cycle count corrections)
- Captures timestamp, quantity delta, resulting stock, reason, reference tag, and staff member.

### 5. 🏷️ Barcodes & Shelf Labels
- Visual Code128 barcodes rendered via `JsBarcode`.
- Printable shelf sticker tags featuring barcode, QR code, SKU, price, and store name.

### 6. 🚚 Supplier Directory & Purchase Orders (PO)
- Vendor directory with contact details and payment terms (`Net 30`, `Net 60`, `COD`).
- Multi-line Purchase Orders workflow (`Draft` ➔ `Ordered` ➔ `Received` ➔ `Cancelled`).
- One-click **"Receive Shipment into Stock"** which automatically increments catalog stock and logs `purchase_in` ledger movements.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) running locally on `localhost:27017` or a MongoDB Atlas URI.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/stockplus
SESSION_SECRET=stockplus_super_secret_session_key_2026
NODE_ENV=development
```

### 3. Seed Realistic Demo Data
Populates a store owner account with two pre-configured stores:
1. **GreenLeaf Fresh Market** (Grocery store with Expiry Dates, Batches, Organic flags, and temperature settings)
2. **Apex Boutique & Apparel** (Fashion store with Sizes, Colors, Materials, and Departments)

```bash
npm run seed
```

**Demo Login Credentials:**
- **Email:** `admin@stockplus.com`
- **Password:** `password123`

### 4. Start the Application
```bash
npm start
# or for live reload during development:
npm run dev
```

Open your browser to: **`http://localhost:3000`**

---

## 📁 Project Architecture

```
stockplus/
├── src/
│   ├── config/
│   │   └── db.js                      # MongoDB connection handler
│   ├── models/
│   │   ├── User.js                    # Users & store memberships
│   │   ├── Store.js                   # Store profile, custom fields & branding
│   │   ├── Product.js                 # Products with dynamic customFields Map
│   │   ├── Category.js                # Color-tagged categories
│   │   ├── StockMovement.js           # Inventory ledger audit trail
│   │   ├── Supplier.js                # Vendor directory
│   │   ├── PurchaseOrder.js           # Restock orders & receiving workflow
│   │   └── Sale.js                    # POS orders, tender & receipts
│   ├── middleware/
│   │   ├── auth.js                    # Session authentication & RBAC
│   │   └── tenant.js                  # Multi-tenant active store loader
│   ├── routes/
│   │   ├── authRoutes.js              # Auth & store registration
│   │   ├── dashboardRoutes.js         # KPIs & analytics
│   │   ├── productRoutes.js           # Dynamic catalog & barcode labels
│   │   ├── stockRoutes.js             # Audit ledger, adjustment & low stock
│   │   ├── posRoutes.js               # POS checkout & thermal receipts
│   │   ├── supplierRoutes.js          # Supplier directory
│   │   ├── purchaseOrderRoutes.js     # PO workflows & restock intake
│   │   └── storeSettingsRoutes.js     # Dynamic custom fields builder & branding
│   ├── views/
│   │   ├── layout.ejs                 # Master EJS responsive layout
│   │   ├── auth/                      # Login, register, store setup
│   │   ├── dashboard/                 # Valuation cards & category chart
│   │   ├── products/                  # Dynamic table, forms, shelf labels
│   │   ├── stock/                     # Ledger, adjustment tool, low-stock center
│   │   ├── pos/                       # Interactive POS terminal & receipt
│   │   ├── suppliers/                 # Directory & vendor profiles
│   │   ├── purchase-orders/           # Dynamic PO line items & receiving
│   │   └── settings/                  # Custom field builder, presets, branding
│   ├── seed.js                        # Multi-store demo seeder
│   └── server.js                      # Express application entrypoint
├── package.json
└── README.md
```

---

## 🛡️ License
ISC