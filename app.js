
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , sio = require('socket.io');

/**
 * Application
 */
var app = express();

/**
 * Application configuration
 */
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

/**
 * Application routes
 */
app.get('/', routes.index);
app.get('/users', user.list);

/**
 * Application listens
 */
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

/**
 * Socket.IO server (single process)
 */
var io = sio.listen(server)
  , visitors_list = []
  , users_list = [];

io.configure('production', function(){
  io.enable('browser client minification');
  io.enable('browser client etag');
  io.enable('browser client gzip');
  io.set('log level', 1);

  io.set('transports', [
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
  ]);
});

io.configure('development', function(){
  io.set('transports', ['websocket']);
})

io.sockets.on('connection', function (socket) {

  // On visitor join,   
  socket.on('visitor_join', function (username) {

    // Store the username in the socket session for this client
    socket.username = username;

    // Set user info
    var visitor = {
      username: username
    };

    // Add the user to the list of connected users
    visitors_list.push(visitor);

    // Say to the client that he have connected
    socket.emit('notify', 'Welcome to the Node bootchat room !');

    // Tell other connected clients that someone connected
    socket.broadcast.emit('notify', visitor.username + ' has joined the room.');

    // Global broadcast of the updated user list
    io.sockets.emit('update_users_list', visitors_list, users_list);
  });

  // On user disconnection
  socket.on('disconnect', function() {
    // Remove the user from the global user list
    visitors_list = visitors_list.filter(function(el) { 
      return el.username != socket.username;
    });

    users_list = users_list.filter(function(el) { 
      return el.username != socket.username;
    });

    // Update the list of users for the clients
    io.sockets.emit('update_users_list', visitors_list, users_list);
    
    // Tell the others that the client has left
    socket.broadcast.emit('notify', socket.username + ' has disconnected.');
  })

  // On user send message
  socket.on('send_msg', function(recipient,msg) {
    if(recipient == 'conversation') {
      // Tell the clients to update the conversation with the sent message
      socket.broadcast.emit('update_conversation', socket.username, msg);
    } else {
      // Get the socket id from the recipient username
      for(var key in users_list){
        if(users_list[key].username == recipient) {
          var s_id = users_list[key].socket_id;
        }
      }
      io.sockets.socket(s_id).emit('update_pm', socket.username, msg);
    }
  });

  // On user sends username
  socket.on('send_username', function(username) {
    // Set new user info
    var user = {
      username: username,
      socket_id: socket.id
    };

    // Check if the username already exists
    for(var key in users_list){
      if(users_list[key].username == username) {
        var exists = 1;
      }
    }

    if(exists != 1) {
      // Remove from the visitors list
      visitors_list = visitors_list.filter(function(el) { 
        return el.username != socket.username;
      });

      // Add the user to the list of connected users
      users_list.push(user);

      // Replace socket name with the new one
      socket.username = username;

      // Send the new user list and the updated anonymous list
      io.sockets.emit('update_users_list', visitors_list, users_list)

      // Tell him that it's ok to choose this username
      socket.emit('good_username');
    } else {
      socket.emit('notify', 'Please choose another username');
    }
  });
});
