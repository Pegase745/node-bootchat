
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
  , usernames = {};

io.sockets.on('connection', function (socket) {

  // when the client emits 'sendchat', this listens and executes
  socket.on('sendchat', function (data) {
    // we tell the client to execute 'updatechat' with 2 parameters
    io.sockets.emit('updatechat', socket.username, data);
  });

  socket.on('iswriting', function() {
    socket.broadcast.emit('iswriting', socket.username);
  });

  socket.on('stoppedwriting', function() {
    socket.broadcast.emit('stoppedwriting', socket.username);
  });

  // when the client emits 'adduser', this listens and executes
  socket.on('adduser', function(username){
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    // echo to client they've connected
    socket.emit('notify', 'You are now connected to the server.');
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('notify', username + ' has joined the chat.')
    // update the list of users in chat, client-side
    io.sockets.emit('updateusers', usernames);
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function(){
    // remove the username from global usernames list
    delete usernames[socket.username];
    // update list of users in chat, client-side
    io.sockets.emit('updateusers', usernames);
    // echo globally that this client has left
    socket.broadcast.emit('notify', socket.username + ' has disconnected.');
  });
});
