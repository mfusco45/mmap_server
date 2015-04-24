// Initialization
var express = require('express');
var bodyParser = require('body-parser');
var validator = require('validator');
var app = express();

// Set up body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded( {extended: true }));

// Set up Mongo

var mongoURI = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost/test';
var MongoClient = require('mongodb').MongoClient, format = require('util').format;
var db = MongoClient.connect(mongoURI, function(error, databaseConnection) {
    db = databaseConnection;
});

// Set up CORS
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Use /public to get files
app.use(express.static('public'));

// POST request at /sendLocation
app.post('/sendLocation', function(request, response) {
    var this_login = request.body.login;
    var this_lat = parseFloat(request.body.lat);
    var this_lng = parseFloat(request.body.lng);
    var current_date = new Date();
    if (this_login == undefined || this_lat == undefined || this_lng == undefined)
        response.send({"error":"Whoops, something is wrong with your data!"});
    else {
        var toInsert = {
            "login": this_login,
            "lat": this_lat,
            "lng": this_lng,
            "created_at": current_date,
        };
        
        db.collection('locations', function(er, collection) {
            collection.find( {login: this_login }).toArray(function(err, cursor) {
                if ( cursor.length == 0 ) { // if login not in db
                    collection.insert(toInsert, function(err, saved) {
                        if (err) {
                            response.send(500);
                        }
                        else {
                            sendLocations();
                        }
                    });
                }
                else {
                    collection.update( // if login in db, just update the doc
                        { login: this_login },
                        {
                            $set : {
                                lat: this_lat,
                                lng: this_lng,
                                created_at: current_date,
                            },
                        }, sendLocations);
                }
            });
            function sendLocations() { // callback for after new info was addded
                collection.find().toArray(function(err, cursor) {
                    if (!err) {
                        response.json(cursor);
                    }
                    else response.send(500);
                });
            }
        });
    }
});

app.get('/location.json', function(request, response) {
    response.set('Content-Type', 'text/html');
    var this_login = request.query.login;
    if (this_login == undefined) // empty login
        response.send({});
    else {
        db.collection('locations', function(er, collection) {
            collection.find( { login: this_login }).toArray(function(err, cursor) {
                if (!err) {
                    if ( cursor.length == 0) { // login not in db
                        response.send({});
                    }
                    else {
                        response.json(cursor[0]);
                    }
                }
                else {
                    response.send(500);
                }
            });
        });
    }
});

// Home page
app.get('/', function(request, response) {
    response.set('Content-Type', 'text/html');
    var indexPage = '';
    // headers
    indexPage += '<!DOCTYPE HTML><html><head><title>Marauder&apos;s Log</title><link rel="stylesheet" type="text/css" href="styles.css" /></head><body>';
    indexPage+= '<h1>Marauder&apos;s Map Log!</h1>';
    indexPage += '<a class="link" href="updatePosition.html" target="_blank">Submit your position</a>';
    indexPage += '<br>';
    db.collection('locations', function(er, collection) {
        collection.find().toArray(function(err, cursor) {
            if (!err) {
                // sort array
                for (var first = 0; first < (cursor.length-1); first++) {
                    var index_of_max = first;
                    for (var rest = (first + 1); rest < cursor.length; rest++)
                        if (cursor[index_of_max].created_at.getTime() < cursor[rest].created_at.getTime())
                            index_of_max = rest;
                    var temp_first = cursor[first];
                    cursor[first] = cursor[index_of_max];
                    cursor[index_of_max] = temp_first;
                }
                for (var count = 0; count < cursor.length; count++) {
                // gmaps link opens in satellite view on lat/lng area
                indexPage += '<a href="https://www.google.com/maps/@' + cursor[count].lat + ',' + cursor[count].lng + ',1500m/data=!3m1!1e3" class="headline link" target="_blank">' + cursor[count].login + ' updated their position </a>';
                indexPage += '<p>Latitude: ' + cursor[count].lat + '  Longitute: ' + cursor[count].lng + '</p>';
                indexPage += '<p>' + cursor[count].created_at + '</p>';
                indexPage += '<br>';
                }
                sendHTML();
            }
            else {
                indexPage += 'Uh oh! There&apos;s a problem!';
                sendHTML();
            }
        });

    });
    
    function sendHTML() {
        indexPage += '</body></html>';
        response.send(indexPage);
    }
});

// Route to clear database.
app.get("/dbclear",function(req,res){
    //Grab route query parameters.
    var input = req.query;
    if(input.pswd === "schneer")
    {
        db.collection("locations", function(err1,coll){
            if(err1 === null)
            {
                coll.remove({},{},function(err2,arg2){
                    if(err2 === null)
                    {
                        res.set("Content-Type","text/html");
                        res.status(200);
                        res.send("Success: Database cleared.");
                    }
                    else
                    {
                        res.set("Content-Type","text/html");
                        res.status(500);
                        res.send("Failure: Couldn't remove from collection.");
                    }
                });
            }
            else
            {
                res.set("Content-Type","text/html");
                res.status(500);
                res.send("Failure: Couldn't open database collection.");
            }
        });
    }
    else
    {
        res.set("Content-Type","text/html");
        res.status(403);
        res.send("Failure: Access denied.");
    }
});


app.listen(process.env.PORT || 3000);
