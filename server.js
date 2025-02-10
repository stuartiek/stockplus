// BCRYPT SETUP
const bcrypt = require('bcrypt');
const saltRounds = 10;

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
app.set('view engine', 'ejs');

// CONNECT TO DB
let db;
connectDB();
async function connectDB(){
    await client.connect();
    console.log('Connected Successfully to Server');
    db = client.db(dbname);
    app.listen(8080);
    console.log('Connected to Port: 8080');
};

// RENDER PAGES


// INDEX PAGE
app.get('/', function(req, res){
    res.render('pages/index');
});

// DASHBOARD PAGE
app.get('/dashboard', function(req, res){
    if(!req.session.loggedin){res.redirect('/');return;}
    //Gets current user
    var currentuser = req.session.currentuser;

    db.collection('stock').countDocuments(function(err, count){

        res.render('pages/dashboard', {
            user: currentuser,
            stockCount: count
        })
    });
   
});

//LABELS PAGE
app.get('/labels', function(req, res){
    if(!req.session.loggedin){res.redirect('/');return;}


    res.render('pages/labels')
});

//STOCK PAGE
app.get('/stock', function(req, res){
    if(!req.session.loggedin){res.redirect('/');return;}

    var stockSort = { 
        "published": -1 
    };
    db.collection('stock').find().sort(stockSort).toArray(function(err, result){
        if (err) throw err;


        db.collection('stock').countDocuments(function(err, count){

    
            res.render('pages/stock', {
                stock: result,
                stockCount: count
            });
        });
    });
});

// app.post('deleteStock', function(req, res){
//     var queryDelete = document.getElementById("id_delete");
//     function deleteStock(){
//         db.collection("stock").deleteOne(queryDelete, function(err, obj){
        
//         });
//     }
    
// });

//ADDS STOCK TO DATABASE
app.post('/addStock', function(req, res){
    //data needs stored
    const isoDate = new Date();
    const ISO = isoDate.toISOString();
    var datatostore = {
        "productName":req.body.productName,
        "productCode":req.body.productCode,
        "brand":req.body.Brand,
        "category":req.body.Category,
        "qty":req.body.Qty,
        "rrp":req.body.RRP,
        "price":req.body.Price,
        "barcode":req.body.Barcode,
        "published":ISO.slice(0 , 19) // Cuts out unwanted date information
    }
    db.collection('stock').insertOne(datatostore, function(err, result){
        if (err) throw err;
            console.log("saved to database");
            //when complete redirect back to index
        res.redirect('/stock');
    });
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
                    db.collection('users').insertOne(datatostore, function(err, result){
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






app.post('/delete/:id', async (req, res) => {

    //await db.collection('stock').deleteOne({ _id: 'D'});
    await stock.deleteOne({_id: req.params.id})
        res.redirect('/')
});






//LOGOUT
app.get('/logout', function(req, res){
    req.session.loggedin = false;
    req.session.destroy();
    res.redirect('/');
});