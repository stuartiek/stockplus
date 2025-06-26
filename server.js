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
const {Console, profile} = require('console');
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
    next();
});
// CONNECT TO DB
let db;
connectDB();
async function connectDB(){
    await client.connect();
    console.log('Connected Successfully to Server');
    db = client.db(dbname);
    app.listen(80);
    console.log('Connected to Port: 80');
};

// RENDER PAGES


// INDEX PAGE
app.get('/', function(req, res){
    res.render('pages/index');
});

// DASHBOARD
app.get('/dashboard', async function(req, res) {
    if (!req.session.loggedin) {
        res.redirect('/');
        return;
    }
    // Gets current user
    var currentuser = req.session.currentuser;

    // Aggregate the stats from the database
    try {
        const totalStock = await db.collection('stock').countDocuments();
        const totalDocuments = await db.collection('documents').countDocuments();
        // Render the dashboard with stock stats
        res.render('pages/dashboard', {
            user: currentuser,
            totalStock,
            toaltDocuments
        });
    } catch (err) {
        console.error("Error fetching stock stats:", err);
        res.status(500).send("Error fetching stock data");
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

// Define the limit of documents allowed
const MAX_DOCUMENTS = 5;

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
        "qty": req.body.Qty,
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
//     const barcode = req.query.barcode;

//     console.log('🔍 Received barcode:', barcode);

//     db.collection('stock').findOne({ barcode }, (err, result) => {
//         if (err) throw err;

//         if (!result) {
//             console.log('❌ No product found for barcode:', barcode);
//             return res.status(404).send('Product not found');
//         }

//         res.render('pages/product', { stock: result });
//     });
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


    res.render('pages/users')
});


// SIGN-UP
app.post('/signUp', async function(req, res){

    bcrypt.genSalt(saltRounds, function(err, salt){
        if(err) throw err;
        bcrypt.hash(req.body.psw, salt, function(err, hash){
            if(err) throw err;
            let datatostore = {
                "email": req.body.email,
                "login": {"username": req.body.uname, "password": hash},
            }

            let uname = req.body.uname;
            db.collection('users').findOne({"login.username":uname}, function(err, result){
                if(err) throw err;

                if(!result){
                    db.collection('users').insertOne(datatostore, function(err, result){https://open.spotify.com/album/3pv30z3VATTE260rWIhWdE
                        if(err) throw err;
                        console.log("User Created");
                        res.redirect('/');
                    });
                } else {
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

    db.collection('users').findOne({"login.username":username}, function(err, result){
        if (err) throw err;
        
        //IF NO USER REDIRECT TO INDEX
        if(!result){res.redirect('/');
            console.log('No User Found')
        return
        }

        bcrypt.compare(password, result.login.password, function(err, result) {
        // result == true
        console.log(result);
        //CHECKS PASSWORD AGAINST USER
            if(result == true){
                console.log("true")
                console.log(result);
                req.session.loggedin = true; 
                req.session.currentuser = username;
                res.redirect('/dashboard');
            } else {
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








/////////// TEST //////////
