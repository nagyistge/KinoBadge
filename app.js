var express = require('express'),
  poolModule = require('generic-pool'),
  util = require('util'),
  fs = require('fs'),
  mongoDb = require('mongodb'),
  Db = mongoDb.Db,
  Connection = mongoDb.Connection,
 Server = mongoDb.Server,
  ObjectID = mongoDb.ObjectID;

var port = (process.env.VMC_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');

if (process.env.VCAP_SERVICES) {
  var env = JSON.parse(process.env.VCAP_SERVICES);
  var mongo = env['mongodb-1.8'][0]['credentials'];
}else {
  var mongo = {
    "hostname": "localhost",
    "port": 27017,
    "username": "",
    "password": "",
    "name": "",
    "db": "kino"
  }
}

/**
 * Prepare a Pool of mongodb connections
 */
var pool = poolModule.Pool({
  name: 'mongodb',
  /**
   * Creating a connection
   */
  create: function(callback) {
    var db = new Db(mongo.db, new Server(mongo.hostname, mongo.port, {
      'auto_reconnect': true,
      'poolSize': 5
    }));
    db.open(function(err, connection) {
      callback(null, connection);
    });
  },

  destroy: function(connection) {
    if (connection !== null) {
      connection.close();
    }
  },
  max: 10,
  min: 2,
  idleTimeoutMillis: 3000,
  log: false
});


var app = express();


/**
 * Serving static content
 * TODO figure out better way of serving static content
 */

var index_data;

fs.readFile('./index.html', function(err, data) {
    if (err) {
      throw err;
    }else{
      index_data = data;
    }
});

app.get('/index', function(request, response) {
  response.set('Content-Type', 'text/html');
  response.send(200, index_data);
});

var kino_client_js_data;

fs.readFile('./kino_client.js', function(err, data) {
  if (err) {
    throw err;
  }else{
    kino_client_js_data = data;
  }
});

app.get('/kino_client.js', function(request, response) {
  response.set('Content-Type', "application/javascript");
  response.send(kino_client_js_data);
});

app.get('/lib/backbone.js', function(request, response) {
  fs.readFile('./lib/backbone.js', function(err, data) {
    if (err) {
      throw err;
    }
    response.set('Content-Type', "application/javascript");
    response.send(data);
  });

});

app.get('/lib/jquery-1.8.1.js', function(request, response) {
  fs.readFile('./lib/jquery-1.8.1.js', function(err, data) {
    if (err) {
      throw err;
    }
    response.set('Content-Type', "application/javascript");
    response.send(data);
  });
});

app.get('/lib/underscore.js', function(request, response) {
  fs.readFile('./lib/underscore.js', function(err, data) {
    if (err) {
      throw err;
    }
    response.set('Content-Type', "application/javascript");
    response.send(data);
  });
});

app.get('/css/styles.css', function(request, response) {
  fs.readFile('./css/styles.css', function(err, data) {
    if (err) {
      throw err;
    }
    response.set('Content-Type', "text/css");
    response.send(data);
  });

});


/**
 * REST service route(s)
 */

app.get('/env',function(request,response){
  response.set('Content-Type', "application/json");
  response.send(200,JSON.stringify(process.env));
});

app.get('/user', function(request, response) {
  mongoDb.connect(mongourl, function(err, connection){
    if (err) {
      console.log("Error obtaining connection");
    } else {
      if (connection !== null) {
        // fetch the collection country
        connection.collection('User', function(err, collection) {
          collection.find(function(err, cursor) {
            cursor.toArray(function(err, docs) {
              response.set('Content-Type', "application/json");
              if (docs !== null) {
                response.send(JSON.stringify(docs));
              } else {
                response.send(200,JSON.stringify({"error" : "no records"}));
              }
            });
          });
        });

      } else {
        response.set('Content-Type', "application/json");
        response.send(500,"{error: 'unable to connect to db'}"); // Indicate internal server error
      }

    }
  });
});



var findOneUser = function(request, response) {
  // fetch all the records
  mongoDb.connect(mongourl, function(err, connection){
    if (err) {
      console.log("Error obtaining connection");
      response.send(500);
    } else {
      connection.collection('User', function(err, collection) {
        collection.findOne({"_id": new ObjectID(request.params.id)}, function(err, doc) {
          response.set('Content-Type', "application/json");
          if (doc !== null) {
            response.send(JSON.stringify(doc));
          } else {
            response.send(200, "{error : 'no results returned'}");
          }
        });
      })
    }
  });
}


app.get('/user/:id', findOneUser);

var saveOrUpdate = function(request, response) {
  // accept a record and save it ( if _id is present it would be simply updated)
  var body = '';

  request.on('data', function(data) {
    body += data;
  });

  request.on('end', function() {
    var document = JSON.parse(body);

    if (document._id) {
      document._id = new ObjectID(document._id);
    }

    mongoDb.connect(mongourl, function(err, connection){
      if (err) {
        console.log("Error obtaining connection");
      } else {
        // fetch the collection country
        connection.collection('User', function(err, collection) {
          response.set('Content-Type', "application/json");
          collection.save(document, function(err) {
            if (err == null) {
              response.send("document saved.");
            } else {
              response.send(500,"{error : 'unable to save'}");
            }
          });
        })
      }
    });
  });
}

app.post('/user', saveOrUpdate);     // As per REST specification do the INSERT with Post

app.put('/user', saveOrUpdate);    // As per REST specification do the UPDATE with PUT

app.delete('/user/:id', function(req, res) {
  var _id = new ObjectID(req.params.id);

  mongoDb.connect(mongourl, function(err, connection){
    if (err) {
      console.log("Error obtaining connection");
    } else {
      // fetch the collection country
      connection.collection('User', function(err, collection) {
        collection.remove({"_id": _id}, function(err) {
          response.set('Content-Type', "application/json");
          if (err == null) {
            res.send('{"success" : true}');
          } else {
            res.send(500,'{"success" : false}');
          }
        });
      });
    }
  });

});

var generate_mongo_url = function(obj) {
  obj.hostname = (obj.hostname || 'localhost');
  obj.port = (obj.port || 27017);
  obj.db = (obj.db || 'kino');

  if (obj.username && obj.password) {
    return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
  }
  else {
    return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
  }
}

var mongourl = generate_mongo_url(mongo);
var port = (process.env.VMC_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');

app.listen(port,host);