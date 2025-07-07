// BCRYPT SETUP
const bcrypt = require('bcrypt');
const saltRounds = 10;



const multer = require('multer');
const path = require('path');

// Configure Multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images'); // Store images in the 'public/images' folder
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Use timestamp as the filename
    }
});

// Image filter for allowing only specific image types (optional)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Initialize Multer with storage options
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Limit file size to 5MB
});

// CONNECT TO MONGO
const MongoClient = require('mongodb-legacy').MongoClient;
const { ObjectId } = require('mongodb-legacy');
const url = 'mongodb://127.0.0.1:27017';
const client = new MongoClient(url);
const dbname = 'stockplus';

// LOAD NPM PACKAGES
let express = require('express');
let session = require('express-session');
const flash = require('connect-flash'); //REQUIRE connect-flash
let bodyParser = require('body-parser');
const app = express();

app.use(session({secret: 'example'}));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 2. CONFIGURE connect-flash (must be after session)
app.use(flash());

// 3. Global Vars Middleware (to pass messages to all templates)
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');

    // Make session data available in all templates
    res.locals.loggedin = req.session.loggedin;
    res.locals.currentuser = req.session.currentuser;
    res.locals.userType = req.session.accountType;
    next();
});
// CONNECT TO DB
let db;
connectDB();
async function connectDB(){
    await client.connect();
    console.log('Connected Successfully to Server');
    db = client.db(dbname);
    // CHANGE THE PORT FROM 80 to 3000
    app.listen(3000);
    console.log('Connected to Port: 3000');
};

// RENDER PAGES


// INDEX PAGE
app.get('/', function(req, res){
    res.render('pages/index');
});

const LOW_STOCK_THRESHOLD = 5;

// DASHBOARD
app.get('/dashboard', async function(req, res) {
    if (!req.session.loggedin) {
        res.redirect('/');
        return;
    }
    
    var currentuser = req.session.currentuser;

    try {
        // --- Existing Stats ---
        const totalStock = await db.collection('stock').countDocuments();
        const totalDocuments = await db.collection('documents').countDocuments();
        const totalUsers = await db.collection('users').countDocuments();

        // --- NEW: Find low stock items ---
        // The `$lt` operator means "less than"
        const lowStockItems = await db.collection('stock').find({ 
            qty: { $lt: LOW_STOCK_THRESHOLD } 
        }).toArray();

        // Render the dashboard with all the data
        res.render('pages/dashboard', {
            user: currentuser,
            totalStock,
            totalDocuments,
            totalUsers,
            lowStockItems, // Pass the new array to the template
            LOW_STOCK_THRESHOLD // Also pass the threshold value for display
        });
    } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        res.status(500).send("Error fetching dashboard data");
    }
});

// DOCUMENTS STOCK PAGE
app.get('/document/:id/stock', async function(req, res) {
    if (!req.session.loggedin) {
        res.redirect('/');
        return;
    }

    const documentId = req.params.id;
    
    // 1. Get the selected category from the URL query, default to empty string
    const selectedCategory = req.query.category || ''; 

    try {
        const document = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });

        if (!document) {
            console.log("❌ Document not found for ID:", documentId);
            return res.status(404).send("Document not found.");
        }

        // 2. Create a filter object to query the stock collection
        const filter = { 
            documentId: documentId 
        };

        // 3. If a category is selected, add it to the filter
        if (selectedCategory) {
            filter.category = selectedCategory;
        }

        // 4. Use the filter object in the find query
        const relatedStock = await db.collection('stock').find(filter).sort({ "published": -1 }).toArray();

        console.log(`✅ Fetched ${relatedStock.length} stock items for document: ${document.documentName}`);

        res.render('pages/documentStock', {
            document: document,
            stock: relatedStock,
            // 5. Pass selectedCategory to the EJS template so it is no longer undefined
            selectedCategory: selectedCategory 
        });

    } catch (err) {
        console.error("❌ Error fetching document or related stock:", err);
        res.status(500).send("Error fetching document details or stock data.");
    }
});

// UPDATE STOCK ITEM
app.post('/updateStock', async (req, res) => {
    if (!req.session.loggedin) {
        return res.redirect('/');
    }

    // Destructure all the data from the edit form
    const {
        originalBarcode,
        documentId,
        productName,
        productCode,
        Brand,
        Category,
        Qty,
        RRP,
        Price,
        Barcode
    } = req.body;

    // Validate that we have the necessary IDs to work with
    if (!originalBarcode || !documentId) {
        req.flash('error_msg', 'Could not update item. Required information is missing.');
        // Redirect to a safe page if documentId is missing
        return res.redirect('/documents');
    }

    try {
        // Use the original barcode to find the correct item to update
        const filter = { barcode: originalBarcode };

        // Create an object with all the new values
        const updatedValues = {
            $set: {
                productName: productName,
                productCode: productCode,
                brand: Brand,
                category: Category,
                qty: parseInt(Qty, 10) || 0, // Ensure quantity is a number
                rrp: RRP,
                price: Price,
                barcode: Barcode, // The barcode itself can be updated
                productURL: "/product/" + Barcode, // Update the URLs as well
                deleteURL: "/delete/" + Barcode,
            }
        };

        // Perform the update operation in the database
        const result = await db.collection('stock').updateOne(filter, updatedValues);

        if (result.modifiedCount === 1) {
            console.log(`✅ Stock item ${originalBarcode} updated successfully.`);
            req.flash('success_msg', 'Stock item updated successfully!');
        } else {
            console.log(`⚠️ Stock item ${originalBarcode} not found or no changes were made.`);
            req.flash('error_msg', 'Could not find the item to update, or no changes were made.');
        }

        // Redirect back to the same document stock page
        res.redirect(`/document/${documentId}/stock`);

    } catch (err) {
        console.error("❌ Error updating stock item:", err);
        req.flash('error_msg', 'An error occurred while updating the stock item.');
        res.redirect(`/document/${documentId}/stock`);
    }
});


// Define the limit of documents allowed
const MAX_DOCUMENTS = 50;

//CREATE DOCUMENT
app.post('/createDoc', async function(req, res){ // Make the function async
    try {
        // First, count how many documents already exist
        const currentDocCount = await db.collection('documents').countDocuments();

        // Check if the count is at or over the maximum limit
        if (currentDocCount >= MAX_DOCUMENTS) {
            // If so, set an error flash message and redirect
            console.log(`⚠️ Document creation blocked. Limit of ${MAX_DOCUMENTS} reached.`);
            req.flash('error_msg', `You have reached the maximum limit of ${MAX_DOCUMENTS} documents.`);
            return res.redirect('/documents'); // Stop execution and redirect
        }

        // If the limit is not reached, proceed with creating the document
        const isoDate = new Date();
        const ISO = isoDate.toISOString();
        var datatostore ={
            "documentName": req.body.documentName,
            "labelType": req.body.labelType,
            "published": ISO.slice(0 , 19)
        }
        
        await db.collection('documents').insertOne(datatostore);
        
        console.log("✅ - New Document Created:");
        // Set a success flash message
        req.flash('success_msg', 'Document created successfully!');
        res.redirect('/documents');

    } catch (err) {
        console.error("❌ Error creating document:", err);
        req.flash('error_msg', 'An error occurred while creating the document.');
        res.redirect('/documents');
    }
});

//DISPLAY DOCUMENTS
app.get('/documents', async function(req, res) {
    if (!req.session.loggedin) {
        res.redirect('/');
        return;
    }

    const docSort = { "published": -1 };

    console.log("🔍 Fetching documents with sort:", docSort);

    db.collection('documents').find().sort(docSort).toArray(function(err, result) {
        if (err) {
            console.error("❌ Error fetching documents:", err);
            throw err;
        }

        console.log("✅ documents fetched:", result.length);

        res.render('pages/documents', {
            documents: result,
        });
    });
});

///ADDS STOCK TO DATABASE
app.post('/addStock', upload.single('image'), function(req, res){

    const imageUrl = req.file ? '/images/' + req.file.filename : null;
    const isoDate = new Date();
    const ISO = isoDate.toISOString();

    // Get the documentId from the hidden form field
    const documentId = req.body.documentId;

    if (!documentId) {
        // Handle cases where the ID might be missing
        return res.status(400).send("Error: Document ID is missing.");
    }

    var datatostore = {
        "imageUrl": imageUrl,
        "productName": req.body.productName,
        "productCode": req.body.productCode,
        "brand": req.body.Brand,
        "category": req.body.Category,
        "qty": parseInt(req.body.Qty, 10) || 0,
        "rrp": req.body.RRP,
        "price": req.body.Price,
        "barcode": req.body.Barcode,
        "productURL": "/product/" + req.body.Barcode,
        "deleteURL": "/delete/" + req.body.Barcode,
        "documentId": documentId, // Now correctly using the ID from the form
        "published": ISO.slice(0, 19)
    };

    db.collection('stock').insertOne(datatostore, function(err, result){
        if (err) {
            console.error("Error saving stock to database:", err);
            return res.status(500).send("Database error.");
        }
        console.log("✅ - Stock item saved to database");
        
        // Redirect back to the specific document's stock page
        res.redirect('/document/' + documentId + '/stock');
    });
});

//GET PRODUCT

// app.get('/product', async (req, res) => {
//     const barcode = req.query.barcode;

//     console.log('🔍 Received barcode:', barcode);

//     db.collection('stock').findOne({ barcode }, (err, result) => {
//         if (err) throw err;

//         if (!result) {
//             console.log('❌ No product found for barcode:', barcode);
//             return res.status(404).send('Product not found');
//         }

//         res.render('pages/product', { stock: result });
//     });
// });


// VIEW SELECTED PRODUCTS
app.post('/selected', async (req, res) => {
    // Destructure both barcodes and the new documentId from the body
    const { selectedBarcodes, documentId } = req.body;

    if (!selectedBarcodes) {
        // If no items were selected, redirect back to documents
        return res.redirect('/documents');
    }

    const barcodeArray = Array.isArray(selectedBarcodes)
        ? selectedBarcodes.map(b => b.trim())
        : [selectedBarcodes.trim()];

    try {
        // Fetch the selected stock items (this part is the same)
        const selectedItems = await db.collection('stock')
            .find({ barcode: { $in: barcodeArray } })
            .toArray();
            
        // --- NEW LOGIC ---
        // Now, fetch the document to get its labelType
        let document = null;
        if (documentId && ObjectId.isValid(documentId)) {
            document = await db.collection('documents').findOne({ _id: new ObjectId(documentId) });
        }
        
        console.log(`Rendering ${selectedItems.length} labels for document type: ${document ? document.labelType : 'N/A'}`);

        // Pass both the items AND the document to the EJS template
        res.render('pages/selectedStock', { 
            selectedItems,
            document // This can be null if no ID was passed
        });

    } catch (error) {
        console.error('Error fetching selected items:', error);
        res.status(500).send('Server error fetching selected stock items.');
    }
});

//DELETE PRODUCT
app.post('/delete', async (req, res) => {
    const barcode = req.body.barcode;
    const documentId = req.body.documentId;

    try {
        const result = await db.collection('stock').deleteOne({ barcode });

        if (result.deletedCount === 0) {
            return res.status(404).send('Stock item not found');
        }

        console.log('Stock deleted:', barcode);

        // VALIDATE THE DOCUMENT ID BEFORE REDIRECTING
        // ObjectId.isValid() checks if a string is a valid 24-char hex ID.
        if (documentId && ObjectId.isValid(documentId)) {
            // If the ID is valid, redirect back to that document's page
            res.redirect('/document/' + documentId + '/stock');
        } else {
            // If the ID is missing or invalid, send the user to the main documents list
            console.log("⚠️ Invalid or missing documentId after delete. Redirecting to /documents.");
            res.redirect('/documents');
        }

    } catch (err) {
        // This will catch errors from the deleteOne operation itself
        console.error("Error during stock deletion:", err);
        res.status(500).send('Delete error');
    }
});

// DELETE A DOCUMENT AND ALL ITS ASSOCIATED STOCK
app.post('/delete-document', async (req, res) => {
    // Ensure user is logged in
    if (!req.session.loggedin) {
        res.redirect('/');
        return;
    }

    const { documentId } = req.body;

    // A crucial validation step to prevent errors
    if (!documentId || !ObjectId.isValid(documentId)) {
        return res.status(400).send("Invalid or missing Document ID.");
    }

    try {
        // Step 1: Delete all stock items linked to this documentId.
        // We use the string ID here because that's how it's stored in the stock collection.
        const stockDeleteResult = await db.collection('stock').deleteMany({ documentId: documentId });
        console.log(`✅ Deleted ${stockDeleteResult.deletedCount} stock item(s) for document ${documentId}`);

        // Step 2: Delete the main document itself.
        // We use the BSON ObjectId here because that's the primary key type.
        const docDeleteResult = await db.collection('documents').deleteOne({ _id: new ObjectId(documentId) });
        
        if (docDeleteResult.deletedCount === 1) {
            console.log(`✅ Successfully deleted document ${documentId}`);
        } else {
            console.log(`⚠️ Document ${documentId} not found for deletion.`);
        }

        // Step 3: Redirect back to the documents page to show the updated list.
        res.redirect('/documents');

    } catch (err) {
        console.error("❌ Error during cascading document deletion:", err);
        res.status(500).send("An error occurred while trying to delete the document and its stock.");
    }
});

//USERS PAGE
app.get('/users', function(req, res){
    if(!req.session.loggedin){res.redirect('/');return;}



    const userSort = { "created": -1 };

    console.log("🔍 Fetching Users with sort:", userSort);

    db.collection('users').find().sort(userSort).toArray(function(err, result) {
        if (err) {
            console.error("❌ Error fetching Users:", err);
            throw err;
        }

        console.log("✅ Users fetched:", result.length);

        res.render('pages/users', {
            users: result,
        });
    });
});


// SIGN-UP
app.post('/signUp', async function(req, res){

    const isoDate = new Date();
    const ISO = isoDate.toISOString();
    bcrypt.genSalt(saltRounds, function(err, salt){
        if(err) throw err;
        bcrypt.hash(req.body.psw, salt, function(err, hash){
            if(err) throw err;
            let datatostore = {
                "email": req.body.email,
                "login": {"username": req.body.uname, "password": hash},
                "accountType": req.body.accountType,
                "created": ISO.slice(0, 19)
            }

            let uname = req.body.uname;
            db.collection('users').findOne({"login.username":uname}, function(err, result){
                if(err) throw err;

                if(!result){
                    db.collection('users').insertOne(datatostore, function(err, result){
                        if(err) throw err;
                        req.flash('success_msg', 'User created successfully!');
                        console.log("User Created");
                        res.redirect('/');
                    });
                } else {
                    req.flash('error_msg', 'User Already Exists.');
                    console.log("User Already Exists");
                    res.redirect('/users');
                }
            });
        });
    });
});


// LOGIN
app.post('/login', async function(req, res){
    let username = req.body.username;
    let password = req.body.password;

    db.collection('users').findOne({"login.username":username}, function(err, userDoc){
        if (err) throw err;
        
        if(!userDoc){
            console.log('No User Found')
            return res.redirect('/');
        }
        
        // console.log('Full user document found in database:', userDoc);

        bcrypt.compare(password, userDoc.login.password, function(err, isMatch) {
            // Check if the passwords match
            if(isMatch){
                // Set session variables using the 'userDoc' object
                req.session.loggedin = true; 
                req.session.currentuser = username;
                req.session.accountType = userDoc.accountType; 

                console.log(`User ${username} logged in with account type: ${userDoc.accountType}`);
                res.redirect('/dashboard');
            } else {
                console.log('Password does not match.');
                res.redirect('/')
            }
        });
    });
});





//LOGOUT
app.get('/logout', function(req, res){
    req.session.loggedin = false;
    req.session.destroy();
    res.redirect('/');
});











const cron = require('node-cron');
const nodemailer = require('nodemailer');

// --- NOTIFICATION SETUP ---

// 1. Configure the email transporter.
// IMPORTANT: Use environment variables in a real app for security.

const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com", // Hostinger's SMTP server
    port: 465,                  // Port for SSL
    secure: true,               // Use SSL
    auth: {
        user: 'info@stockplus.abzdigitalgroup.com', // Your full Hostinger email address
        pass: 'jtdhJ35j26Mfg?2' // The password for that email account
    }
});

// 2. Define the low stock check and email function.
async function sendLowStockReport() {
    console.log('Running low stock check...');
    const LOW_STOCK_THRESHOLD = 5; // Or whatever threshold you prefer

    try {
        const lowStockItems = await db.collection('stock').find({
            qty: { $lt: LOW_STOCK_THRESHOLD }
        }).toArray();

        // Only send an email if there are low-stock items.
        if (lowStockItems.length > 0) {
            console.log(`Found ${lowStockItems.length} low-stock items. Preparing email.`);

            // Create a simple HTML list of the items.
            const itemsHtml = lowStockItems.map(item =>
                `<li><b>${item.productName}</b> (Code: ${item.productCode}) - Quantity: ${item.qty} - Barcode: ${item.barcode}</li>`
            ).join('');

            const mailOptions = {
                from: '"StockPlus Alerts" <info@stockplus.abzdigitalgroup.com>',
                to: 'stuartiek@gmail.com', // The email address to receive the alert
                subject: `🚨 Low Stock Alert - ${lowStockItems.length} Items Need Attention`,
                html: `
                    <h1>Low Stock Report</h1>
                    <p>The following items are below the threshold of ${LOW_STOCK_THRESHOLD}:</p>
                    <ul>
                        ${itemsHtml}
                    </ul>
                    <p>Please reorder soon.</p>
                `
            };

            // Send the email
            await transporter.sendMail(mailOptions);
            console.log('✅ Low stock report sent successfully.');
        } else {
            console.log('👍 Stock levels are sufficient. No report sent.');
        }
    } catch (error) {
        console.error('❌ Error sending low stock report:', error);
    }
}

// 3. Schedule the task.
// This cron expression '0 9 * * *' means "at 9:00 AM every day".
cron.schedule('22 18 * * *', sendLowStockReport, {
    scheduled: true,
    timezone: "Europe/London"
});

console.log('🗓️  Low stock notification task scheduled to run daily at 9:00 AM.');






/////////// TEST //////////

// RENDER THE POINT OF SALE PAGE
app.get('/pos', function(req, res) {
    if (!req.session.loggedin) {
        return res.redirect('/');
    }
    res.render('pages/pos');
});


// PROCESS A COMPLETED SALE
app.post('/process-sale', express.json(), async (req, res) => {
    if (!req.session.loggedin) {
        return res.status(401).json({ error: 'User not logged in' });
    }

    const { items } = req.body; // Expects an array of { barcode, quantity }

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in sale' });
    }

    try {
        // Use a loop to update each item in the database
        for (const item of items) {
            await db.collection('stock').updateOne(
                { barcode: item.barcode },
                { $inc: { qty: -item.quantity } } // Use $inc to decrement the quantity
            );
        }

        console.log(`✅ Sale processed successfully. ${items.length} item types updated.`);
        res.status(200).json({ message: 'Sale processed successfully!' });

    } catch (error) {
        console.error("❌ Error processing sale:", error);
        res.status(500).json({ error: 'An error occurred while processing the sale.' });
    }
});