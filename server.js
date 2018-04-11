var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
users = {};
connections = [];

server.listen(process.env.PORT || 3000);
console.log('Server running ...');

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
	connections.push(socket);
	console.log('Connected: %s sockets connected', connections.length);
	
	//disconnect
	socket.on('disconnect', function(data){
		delete users[socket.username];
		io.sockets.emit('new message', {msg: 'disconnected', user: socket.username, date: new Date()});
		updateUsernames();
		connections.splice(connections.indexOf(socket), 1);
		console.log('Disconnected: %s sockets connected', connections.length);
		
	});
	
	
	//Send Message
	socket.on('send message', function(data, callback){
		var msg = data.trim();
		if(msg.substr(0,4) === '/pm '){
			msg = msg.substr(4);
			var ind = msg.indexOf(' ');
			if(ind !== -1){
				var name = msg.substring(0, ind);
				var msg = msg.substring(ind + 1);
				if(name in users){
					users[name].emit('private message', {msg: msg, user: socket.username, date: new Date()});
				} else{
					callback('User not found!');
				}
			} else{
				callback('PM not found!');
			}
		} else{
			io.sockets.emit('new message', {msg: msg, user: socket.username, date: new Date()});
		}
	});
	
	//new user
	socket.on('new user', function(data, callback){
		if(data in users){
			callback(false);
		} else{
			callback(true);
			socket.username = data;
			users[socket.username]=socket;
			updateUsernames();
			io.sockets.emit('new message', {msg: 'joined the server', user: socket.username, date: new Date()});
		}
	});

	function updateUsernames(){
		io.sockets.emit('get users', Object.keys(users));
	}
	
});



