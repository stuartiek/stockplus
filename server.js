// BCRYPT SETUP
const bcrypt = require('bcrypt');
const saltRounds = 10;

// FILE UPLOAD SETUP
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx'); // For Excel import

// Configure Multer for standard image uploads (saving to disk)
const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const imageUpload = multer({ storage: imageStorage });

// Configure Multer for Excel import (processing in memory)
const excelImport = multer({ storage: multer.memoryStorage() });


// CONNECT TO MONGO
const MongoClient = require('mongodb-legacy').MongoClient;
const { ObjectId } = require('mongodb-legacy');
const url = 'mongodb://127.0.0.1:27017';
const client = new MongoClient(url);
const dbname = 'stockplus';

// LOAD NPM PACKAGES
let express = require('express');
let session = require('express-session');
const flash = require('connect-flash');
let bodyParser = require('body-parser');
const app = express();

// --- MIDDLEWARE SETUP ---
app.use(session({
    secret: 'example',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // To parse JSON bodies for API routes
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(flash());

// Global Middleware to pass session data to all templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.loggedin = req.session.loggedin;
    res.locals.currentuser = req.session.currentuser;
    res.locals.userType = req.session.accountType;
    next();
});

// --- DATABASE CONNECTION ---
let db;
connectDB();
async function connectDB(){
    await client.connect();
    console.log('✅ Connected Successfully to Server');
    db = client.db(dbname);
    app.listen(3000);
    console.log(`✅ StockPlus server listening on Port: 3000`);
};


// =================================================================
// --- PAGE RENDERING ROUTES ---
// =================================================================

// INDEX PAGE
app.get('/', (req, res) => {
    res.render('pages/index');
});

const LOW_STOCK_THRESHOLD = 5;

// DASHBOARD
app.get('/dashboard', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        const totalStock = await db.collection('stock').countDocuments();
        const totalDocuments = await db.collection('documents').countDocuments();
        const totalUsers = await db.collection('users').countDocuments();
        const lowStockItems = await db.collection('stock').find({ qty: { $lt: LOW_STOCK_THRESHOLD } }).toArray();

        res.render('pages/dashboard', {
            user: req.session.currentuser,
            totalStock,
            totalDocuments,
            totalUsers,
            lowStockItems,
            LOW_STOCK_THRESHOLD
        });
    } catch (err) {
        console.error("❌ Error fetching dashboard stats:", err);
        res.status(500).send("Error fetching dashboard data");
    }
});

// DISPLAY ALL DOCUMENTS
app.get('/documents', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        const documents = await db.collection('documents').find().sort({ "published": -1 }).toArray();
        res.render('pages/documents', { documents });
    } catch (err) {
        console.error("❌ Error fetching documents:", err);
        res.status(500).send("Error fetching documents.");
    }
});

// DISPLAY STOCK FOR A SPECIFIC DOCUMENT
app.get('/document/:id/stock', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    const { id } = req.params;
    const selectedCategory = req.query.category || ''; 

    try {
        const document = await db.collection('documents').findOne({ _id: new ObjectId(id) });
        if (!document) return res.status(404).send("Document not found.");

        const filter = { documentId: id };
        if (selectedCategory) {
            filter.category = selectedCategory;
        }

        const stock = await db.collection('stock').find(filter).sort({ "published": -1 }).toArray();
        res.render('pages/documentStock', { document, stock, selectedCategory });
    } catch (err) {
        console.error("❌ Error fetching document or related stock:", err);
        res.status(500).send("Error fetching document details.");
    }
});

// USERS PAGE
app.get('/users', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        const users = await db.collection('users').find().sort({ "created": -1 }).toArray();
        res.render('pages/users', { users });
    } catch (err) {
        console.error("❌ Error fetching users:", err);
        res.status(500).send("Error fetching users.");
    }
});

// POINT OF SALE (POS) PAGE
app.get('/pos', (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    res.render('pages/pos');
});


// =================================================================
// --- FORM SUBMISSION & API ROUTES ---
// =================================================================

// USER SIGN-UP
app.post('/signUp', async (req, res) => {
    const { email, uname, psw, accountType } = req.body;
    try {
        const existingUser = await db.collection('users').findOne({ "login.username": uname });
        if (existingUser) {
            req.flash('error_msg', 'User Already Exists.');
            return res.redirect('/users');
        }

        const hash = await bcrypt.hash(psw, saltRounds);
        const newUser = {
            email,
            login: { username: uname, password: hash },
            accountType,
            created: new Date().toISOString().slice(0, 19)
        };
        await db.collection('users').insertOne(newUser);
        req.flash('success_msg', 'User created successfully!');
        res.redirect('/');
    } catch (err) {
        console.error("❌ Error during sign-up:", err);
        res.redirect('/users');
    }
});

// USER LOGIN
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await db.collection('users').findOne({ "login.username": username });
        if (!userDoc) {
            console.log('No User Found');
            return res.redirect('/');
        }

        const isMatch = await bcrypt.compare(password, userDoc.login.password);
        if (isMatch) {
            req.session.loggedin = true;
            req.session.currentuser = username;
            req.session.accountType = userDoc.accountType;
            console.log(`✅ User ${username} logged in with account type: ${userDoc.accountType}`);
            res.redirect('/dashboard');
        } else {
            console.log('Password does not match.');
            res.redirect('/');
        }
    } catch (err) {
        console.error("❌ Error during login:", err);
        res.redirect('/');
    }
});

// USER LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// CREATE DOCUMENT
const MAX_DOCUMENTS = 50;
app.post('/createDoc', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    try {
        const currentDocCount = await db.collection('documents').countDocuments();
        if (currentDocCount >= MAX_DOCUMENTS) {
            req.flash('error_msg', `You have reached the maximum limit of ${MAX_DOCUMENTS} documents.`);
            return res.redirect('/documents');
        }
        const newDoc = {
            documentName: req.body.documentName,
            labelType: req.body.labelType,
            published: new Date().toISOString().slice(0, 19)
        };
        await db.collection('documents').insertOne(newDoc);
        req.flash('success_msg', 'Document created successfully!');
        res.redirect('/documents');
    } catch (err) {
        console.error("❌ Error creating document:", err);
        res.redirect('/documents');
    }
});

// ADD STOCK ITEM
app.post('/addStock', imageUpload.single('image'), async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    const { documentId, productName, productCode, Brand, Category, Qty, RRP, Price, Barcode } = req.body;
    if (!documentId) return res.status(400).send("Error: Document ID is missing.");
    
    const newStock = {
        imageUrl: req.file ? '/images/' + req.file.filename : null,
        productName,
        productCode,
        brand: Brand,
        category: Category,
        qty: parseInt(Qty, 10) || 0,
        rrp: RRP,
        price: Price,
        barcode: Barcode,
        productURL: "/product/" + Barcode,
        deleteURL: "/delete/" + Barcode,
        documentId,
        published: new Date().toISOString().slice(0, 19)
    };
    await db.collection('stock').insertOne(newStock);
    res.redirect(`/document/${documentId}/stock`);
});

// UPDATE STOCK ITEM
app.post('/updateStock', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    const { originalBarcode, documentId, productName, productCode, Brand, Category, Qty, RRP, Price, Barcode } = req.body;
    if (!originalBarcode || !documentId) {
        req.flash('error_msg', 'Could not update item. Required information is missing.');
        return res.redirect('/documents');
    }
    try {
        const filter = { barcode: originalBarcode };
        const updatedValues = {
            $set: { productName, productCode, brand: Brand, category: Category, qty: parseInt(Qty, 10) || 0, rrp: RRP, price: Price, barcode: Barcode, productURL: "/product/" + Barcode, deleteURL: "/delete/" + Barcode }
        };
        const result = await db.collection('stock').updateOne(filter, updatedValues);
        if (result.modifiedCount === 1) {
            req.flash('success_msg', 'Stock item updated successfully!');
        } else {
            req.flash('error_msg', 'Could not find the item to update, or no changes were made.');
        }
        res.redirect(`/document/${documentId}/stock`);
    } catch (err) {
        console.error("❌ Error updating stock item:", err);
        req.flash('error_msg', 'An error occurred while updating the stock item.');
        res.redirect(`/document/${documentId}/stock`);
    }
});

// DELETE STOCK ITEM
app.post('/delete', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    const { barcode, documentId } = req.body;
    try {
        await db.collection('stock').deleteOne({ barcode });
        if (documentId && ObjectId.isValid(documentId)) {
            res.redirect(`/document/${documentId}/stock`);
        } else {
            res.redirect('/documents');
        }
    } catch (err) {
        console.error("Error during stock deletion:", err);
        res.redirect('/documents');
    }
});

// DELETE DOCUMENT (AND ASSOCIATED STOCK)
app.post('/delete-document', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    const { documentId } = req.body;
    if (!documentId || !ObjectId.isValid(documentId)) return res.status(400).send("Invalid Document ID.");
    
    try {
        await db.collection('stock').deleteMany({ documentId: documentId });
        await db.collection('documents').deleteOne({ _id: new ObjectId(documentId) });
        res.redirect('/documents');
    } catch (err) {
        console.error("❌ Error during cascading document deletion:", err);
        res.redirect('/documents');
    }
});

// IMPORT STOCK FROM EXCEL
app.post('/import-stock', excelImport.single('stockFile'), async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    const { documentId } = req.body;
    if (!req.file || !documentId) {
        req.flash('error_msg', 'Please select a document and a file to import.');
        return res.redirect('/documents');
    }
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const stockToInsert = data.map(row => {
            if (!row.productName || !row.barcode) return null;
            return {
                productName: row.productName, productCode: row.productCode || '', brand: row.brand || '', category: row.category || 'Misc', qty: parseInt(row.qty, 10) || 0, rrp: String(row.rrp || '0.00'), price: String(row.price || '0.00'), barcode: String(row.barcode), documentId, published: new Date().toISOString().slice(0, 19), productURL: "/product/" + String(row.barcode), deleteURL: "/delete/" + String(row.barcode),
            };
        }).filter(item => item !== null);

        if (stockToInsert.length > 0) {
            await db.collection('stock').insertMany(stockToInsert);
            req.flash('success_msg', `Successfully imported ${stockToInsert.length} stock items.`);
        } else {
            req.flash('error_msg', 'No valid stock items found in the spreadsheet.');
        }
        res.redirect('/documents');
    } catch (error) {
        console.error("❌ Error importing stock from Excel:", error);
        req.flash('error_msg', 'An error occurred while processing the file.');
        res.redirect('/documents');
    }
});

// VIEW SELECTED PRODUCTS
app.post('/selected', async (req, res) => {
    const { selectedBarcodes, documentId } = req.body;

    if (!selectedBarcodes) {
        req.flash('error_msg', 'You did not select any items.');
        if (documentId) {
            return res.redirect(`/document/${documentId}/stock`);
        }
        return res.redirect('/documents');
    }

    const barcodeArray = Array.isArray(selectedBarcodes) ? selectedBarcodes : [selectedBarcodes];

    try {
        const selectedItems = await db.collection('stock')
            .find({ barcode: { $in: barcodeArray } })
            .toArray();
            
        let document = null;
        if (documentId && ObjectId.isValid(documentId)) {
            document = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });
        }
        
        res.render('pages/selectedStock', { 
            selectedItems,
            document
        });

    } catch (error) {
        console.error('❌ Error fetching selected items:', error);
        res.status(500).send('Server error fetching selected stock items.');
    }
});


// PROCESS A POS SALE
app.post('/process-sale', async (req, res) => {
    if (!req.session.loggedin) return res.status(401).json({ error: 'User not logged in' });
    const { items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in sale' });
    
    try {
        for (const item of items) {
            await db.collection('stock').updateOne({ barcode: item.barcode }, { $inc: { qty: -item.quantity } });
        }
        res.status(200).json({ message: 'Sale processed successfully!' });
    } catch (error) {
        console.error("❌ Error processing sale:", error);
        res.status(500).json({ error: 'An error occurred while processing the sale.' });
    }
});


// =================================================================
// --- AUTOMATED TASKS ---
// =================================================================

const cron = require('node-cron');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: {
        user: 'info@stockplus.abzdigitalgroup.com',
        pass: 'jtdhJ35j26Mfg?2' // IMPORTANT: Use environment variables for this in production
    }
});

async function sendLowStockReport() {
    console.log('Running daily low stock check...');
    try {
        const lowStockItems = await db.collection('stock').find({ qty: { $lt: LOW_STOCK_THRESHOLD } }).toArray();
        if (lowStockItems.length > 0) {
            const itemsHtml = lowStockItems.map(item => `<li><b>${item.productName}</b> (Code: ${item.productCode}) - Quantity: ${item.qty}</li>`).join('');
            const mailOptions = {
                from: '"StockPlus Alerts" <info@stockplus.abzdigitalgroup.com>',
                to: 'stuartiek@gmail.com',
                subject: `🚨 Low Stock Alert - ${lowStockItems.length} Items Need Attention`,
                html: `<h1>Low Stock Report</h1><p>The following items are below the threshold of ${LOW_STOCK_THRESHOLD}:</p><ul>${itemsHtml}</ul><p>Please reorder soon.</p>`
            };
            await transporter.sendMail(mailOptions);
            console.log('✅ Low stock report sent successfully.');
        } else {
            console.log('👍 Stock levels are sufficient. No report sent.');
        }
    } catch (error) {
        console.error('❌ Error sending low stock report:', error);
    }
}

// Schedule the task to run daily at 9:00 AM London time
cron.schedule('0 9 * * *', sendLowStockReport, {
    scheduled: true,
    timezone: "Europe/London"
});

console.log('🗓️  Low stock notification task scheduled to run daily at 9:00 AM.');
