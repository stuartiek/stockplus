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



// SIGN-UP
app.post('/registerUser', async function(req, res){

    const hash = await bcrypt.hash(req.body.password, 10);
    
    let datatostore = {
        "email": req.body.email,
        "login": {"username": req.body.username, "password": hash},
        "profile_pic": req.body.profilePic,
        "background":"https://www.solidbackgrounds.com/images/1920x1080/1920x1080-battleship-grey-solid-color-background.jpg"
    }

    let username = req.body.username;
    db.collection('users').findOne({"login.username": username}, function(err, result){
        if(err) throw err;

        if(!result){
            db.collection('users').insertOne(datatostore, function(err, result){
                if(err) throw err;
                console.log("User Create");
                console.log(hash);
                res.redirect('/');
            });
        } else {
            console.log("User Already Exists");
            res.redirect('/');
        }
    });
});


// LOGIN
app.post('/login', function(req, res){
    let username = req.body.username;
    let password = req.body.password;

    db.collection('users').findOne({"login.username":username}, function(err, result){
        if (err) throw err;
        
        //IF NO USER REDIRECT TO INDEX
        if(!result){res.redirect('/');
            console.log('No User Found')
        return}

        //CHECKS PASSWORD AGAINST USER
        if(result.login.password == password){
            req.session.loggedin = true; 
            req.session.currentuser = username;
            res.redirect('/dashboard');
        } else {
            redirect('/')
        }
    });
});

//LOGOUT
app.get('/logout', function(req, res){
    req.session.loggedin = false;
    req.session.destroy();
    res.redirect('/');
});