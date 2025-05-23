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


const mongoose = require('mongoose');

// Replace with your actual MongoDB URI
mongoose.connect('mongodb://127.0.0.1:27017/stock', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

// CONNECT TO MONGO
const MongoClient = require('mongodb-legacy').MongoClient;
const url = 'mongodb://127.0.0.1:27017';
const client = new MongoClient(url);
const dbname = 'stockplus';

// LOAD NPM PACKAGES
let express = require('express');
let session = require('express-session');
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
        
        // Render the dashboard with stock stats
        res.render('pages/dashboard', {
            user: currentuser,
            totalStock,
        });
    } catch (err) {
        console.error("Error fetching stock stats:", err);
        res.status(500).send("Error fetching stock data");
    }
});

//LABELS PAGE
app.get('/labels', function(req, res){
    if(!req.session.loggedin){res.redirect('/');return;}


    res.render('pages/labels')
});

app.get('/stock', async function(req, res){
    if (!req.session.loggedin) {
        res.redirect('/');
        return;
    }

    var stockSort = { 
        "published": -1 
    };

    console.log("🔍 Fetching stock with sort:", stockSort);

    db.collection('stock').find().sort(stockSort).toArray(function(err, result) {
        if (err) {
            console.error("❌ Error fetching stock:", err);
            throw err;
        }

        console.log("🔍 Stock items fetched:", result);  // Logs the fetched stock

        res.render('pages/stock', {
            stock: result
        });
    });
});

//ADDS STOCK TO DATABASE
app.post('/addStock', upload.single('image'), function(req, res){

    const imageUrl = req.file ? '/images/' + req.file.filename : null; // Save the image path if file uploaded
    //data needs stored
    const isoDate = new Date();
    const ISO = isoDate.toISOString();
    var datatostore = {
        "imageUrl": imageUrl, // Save the image URL to the database
        "productName":req.body.productName,
        "productCode":req.body.productCode,
        "brand":req.body.Brand,
        "category":req.body.Category,
        "qty":req.body.Qty,
        "rrp":req.body.RRP,
        "price":req.body.Price,
        "barcode":req.body.Barcode,
        "productURL": "/product/" + req.body.Barcode,
        "deleteURL": "/delete/" + req.body.Barcode,
        "published":ISO.slice(0 , 19) // Cuts out unwanted date information

    }
    db.collection('stock').insertOne(datatostore, function(err, result){
        if (err) throw err;
            console.log("saved to database");
            //when complete redirect back to index
        res.redirect('/stock');
    });
});

//GET PRODUCT

app.get('/product', async (req, res) => {
    const barcode = req.query.barcode;

    console.log('🔍 Received barcode:', barcode);

    db.collection('stock').findOne({ barcode }, (err, result) => {
        if (err) throw err;

        if (!result) {
            console.log('❌ No product found for barcode:', barcode);
            return res.status(404).send('Product not found');
        }

        res.render('pages/product', { stock: result });
    });
});


//VIEW SELECTED PRODUCTS

// app.post('/selected', (req, res) => {
//   console.log('req.body:', req.body);
//   res.send('Check console');
// });

const Stock = require('./models/Stock');

app.post('/selected', async (req, res) => {
  const selectedBarcodes = req.body.selectedBarcodes;

  if (!selectedBarcodes) {
    return res.redirect('/stock');
  }

   // Ensure it's always an array and trim whitespace
  const barcodeArray = Array.isArray(selectedBarcodes)
    ? selectedBarcodes.map(b => b.trim())
    : [selectedBarcodes.trim()];

  try {
    // Fetch items with matching barcodes
    const selectedItems = await Stock.find({
      barcode: { $in: barcodeArray }
    });
    console.log('Running query:', { barcode: { $in: barcodeArray } });
    console.log('Barcodes received:', barcodeArray);
    console.log('Found items:', selectedItems);

    res.render('pages/selectedStock', { selectedItems });
  } catch (error) {
    console.error('Error fetching selected items:', error);
    res.status(500).send('Server error fetching selected stock items.');
  }
});


//DELETE PRODUCT

app.post('/delete', async (req, res) => {
    const barcode = req.body.barcode;

    try {
        const result = await db.collection('stock').deleteOne({ barcode });

        if (result.deletedCount === 0) {
            return res.status(404).send('Stock item not found');
        }

        console.log('Stock deleted:', barcode);
        res.redirect('/stock');
    } catch (err) {
        console.error(err);
        res.status(500).send('Delete error');
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

app.get('/test-stock', async (req, res) => {
  try {
    const items = await Stock.find({ barcode: '5012035589624' });
    console.log('Test query results:', items);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});



app.get('/test-native', async (req, res) => {
  const db = mongoose.connection.db; // get native db object
  const collection = db.collection('stock');

  const results = await collection.find({ barcode: { $in: ['5012035589624', '5012035927592'] } }).toArray();
  console.log('Native driver results:', results);

  res.json(results);
});

app.get('/test-mongoose', async (req, res) => {
  try {
    const testBarcodes = ['5012035589624', '5012035927592'];
    const results = await Stock.find({ barcode: { $in: testBarcodes } });
    console.log('Mongoose test query results:', results);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});