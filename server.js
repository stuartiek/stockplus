
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

    res.render('pages/dashboard', {
        user: currentuser
    })
});

//PROFILE PAGE
app.get('/profile', function(req, res){
    res.render('pages/profile')
});

//REGISTER PAGE
app.get('/stock', function(req, res){
    res.render('pages/stock')
});

//REGISTER PAGE
app.get('/users', function(req, res){
    res.render('pages/users')
});

// error = new Error('data and salt arguments required');

// SIGN-UP
app.post('/signUp', async function(req, res){

    // let passwordHash = req.body.password;
    bcrypt.genSalt(saltRounds, function(err, salt){
        bcrypt.hash(req.body.psw, salt, function(err, hash){
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
                        console.log(hash);
                        res.redirect('/');
                    });
                } else {
                    console.log("User Already Exists");
                    res.redirect('/users');
                }
            });
        });
    });
    // const salt = await bcrypt.genSalt()
    // const passwordHash = await bcrypt.hash(req.body.password, salt)
    // console.log(passwordHash);
    
    
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


        bcrypt.compare(result.login.password, password, function(err, result) {
        // result == true
        //CHECKS PASSWORD AGAINST USER
            if(result == true){
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