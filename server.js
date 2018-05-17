var express = require('express');
var mysql = require('mysql');
var app = express();
var bodyParser = require("body-parser");

var bcrypt = require('bcrypt');
const saltRounds = 10;

var fs = require('fs');
var server = require('https').createServer({
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem')
    },app);

var io = require('socket.io').listen(server);

app.use(express.static('public'));

var multer = require('multer');
var upload = multer({dest: 'public/uploads/'});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var profilpics;
var user;
users = {};
pics ={};
connections = [];
benutzer = [];
paswo = "";

var connectsql = mysql.createConnection({
	host: 'eu-cdbr-sl-lhr-01.cleardb.net',
	user: 'ba762a163ceca9',
	password: 'a22f6ff0',
	database: 'ibmx_08e1935b9edb780'
});

connectsql.connect(function(error){
	if(!!error){
		console.log('Error');
	}else{
		console.log('SQL Connected');
		databaseGetUserNames();
		profilpics = new Map();
	}
});


var ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');

var toneAnalyzer = new ToneAnalyzerV3({
  version: '2017-09-21',
  username: 'e20f5f7c-2313-4eea-86a4-075aa68c4562',
  password: 'yQeJuhRIQm2t'
});


var LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');
var languageTranslator = new LanguageTranslatorV2({
  username: '5d5c7383-6a98-4f81-871b-3b63bb9d9ef5',
  password: 'ahjHh0Iu2ubk',
  url: 'https://gateway-fra.watsonplatform.net/language-translator/api'
});




//wird verwendet um user hinzuzufügen
function databaseInsertUser(name, pw, pic){
	
	bcrypt.hash(pw, saltRounds, function(err, hash) {
		var sqlInsert = "INSERT INTO chatTable (username, password, picture) VALUES ('"+name+"', '"+hash+"', '"+pic+"')";
		console.log("Add to Database: "+sqlInsert);
		connectsql.query(sqlInsert, function (error) {
			if (!!error){
				console.log('Error in the Insert query');
			}else{
				console.log("1 record inserted");
			}
		});
	});
}


//returns all usernames in database
function databaseGetUserNames(){
	connectsql.query("SELECT username FROM chatTable", function(error, rows, fields){
		if(!!error){
			console.log('Error in the GetUserNames query');
			return "";
		}else{
			console.log('Sucessful GetUserNames query');
			var s = [];
			for (var i in rows) {
				s.push(rows[i].username);
			}
			benutzer = s;
		}
	});
}
	
//returns psw by username
function databaseGetPsw(callback){
	
	connectsql.query("SELECT password FROM chatTable WHERE username='"+paswo+"'", function(error, rows, fields){
		if(!!error){
			console.log('Error in the GetPsw query');
			callback("Error");
		}else{
			console.log('Sucessful GetPsw query');
			var s = "";
			for (var i in rows) {
				s += rows[i].password;
			}
			console.log("s is: "+s);
			setPsw(s);
			console.log("pw is: "+s);
			callback(s);
		}
	});
}

//returns bildpfad by username
function databaseGetPic(callback){
	connectsql.query("SELECT picture FROM chatTable WHERE username='"+paswo+"'", function(error, rows, fields){
		if(!!error){
			console.log('Error in the GetPicture query');
			callback("Error");
		}else{
			console.log('Sucessful GetPicture query');
			var s = "";
			for (var i in rows) {
				s += rows[i].picture;
			}
			console.log("pic is: "+s);
			callback(s);
		}
	});
}

function setPsw(value) {
  paswo = value;
  console.log(paswo+" was setted");
}


server.listen(process.env.PORT || 3000);
console.log('Server running ...');

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

//------
app.post('/', upload.single('file-to-upload'), function (req, res) {
   
   var path;
 
	if((benutzer.indexOf(req.body.user)>-1)){
		user=req.body.user;
	}
	
	path='uploads\\\\'+req.file.filename;
	 
	connectsql.query("UPDATE chatTable SET picture='"+path+"' WHERE username='"+user+"'", function(error, rows, fields){
		if(!!error){
			console.log('Error in the UpdatePicture query');
			return "";
		}else{
			console.log('Sucessful UpdatePicture query');
		}
		
	});
	res.redirect('/');
});

io.sockets.on('connection', function(socket){
	connections.push(socket);
	console.log('Connected: %s sockets connected', connections.length);
	
	//disconnect
	socket.on('disconnect', function(data){
		if(socket.username in users){
			console.log("disconnect");
			delete users[socket.username];
			io.sockets.emit('new message', {msg: 'disconnected', user: socket.username, date: new Date()});
			updateUsernames();
			connections.splice(connections.indexOf(socket), 1);
			console.log('Disconnected: %s sockets connected', connections.length);
		}
		
	});
	
	
	//Send Message
	socket.on('send message', function(data, callback){
		var msg = data.trim();
		console.log("Hier die msg: "+msg);
		var text = " "+msg;
		var stimmung;
		var pm;
		var name;
		var translateMSG
		
		var toneParams = {
		  'tone_input': { 'text': text },
		  'content_type': 'application/json'
		};

		toneAnalyzer.tone(toneParams, function (error, analysis) {
		  if (error) {
			console.log(error);
		  } else { 
			if(!(analysis.document_tone.tones[0] == null)){
			stimmung = analysis.document_tone.tones[0].tone_id;
			}
		  }
		  
		var parameters = {
		text: msg,
		model_id: 'en-es'
		};

		languageTranslator.translate(
		  parameters,
		  function(error, response) {
			if (error)
			  console.log(error)
			else{
				if(translateMSG){
					msg = JSON.stringify(response, null, 2);
				}
			}
			if(pm){
				users[name].emit('private message', {msg: msg, mood: stimmung, user: socket.username, date: new Date()});
			}else{
				io.sockets.emit('new message', {msg: msg, mood: stimmung, user: socket.username, date: new Date()});
			}
			
		  }
		);
		   
		})
		if(msg.substr(0,3) === '/t '){
			translateMSG = true
			msg = msg.substr(4);
		}
		if(msg.substr(0,4) === '/pm '){
			msg = msg.substr(4);
			var ind = msg.indexOf(' ');
			if(ind !== -1){
				name = msg.substring(0, ind);
				var msg = msg.substring(ind + 1);
				if(name in users){
					pm=true;
				} else{
					callback('User not found!');
				}
			} else{
				callback('PM not found!');
			}
		}
	});
	
	//Upload pic
	socket.on('upload image', function(){
		databaseGetPic(function(picdata){
					//picdata is bildpfad
					profilpics.set(socket.username, picdata);
					pics[picdata] = picdata;
					updateUsernames();
				});
	});
	
	//new user
	socket.on('new user', function(usernamedata, pswdata, callback){
		paswo=usernamedata;				//globale variable setzen damit mans oben in der getpsw verwenden kann
		var nameIsInDatabase = false;	//prüfen ob benutzername in datenbank 
		for (var i in benutzer){
			if(benutzer[i].toUpperCase()==usernamedata.toUpperCase()){
				nameIsInDatabase = true;
				break;
			}
		}
		databaseGetPsw(function(data){
			paswo = data;
		
			var pwIsCorrect;			//ist paswo von user in datenbank gleich des eingebenen
			
			if(bcrypt.compareSync(pswdata, data)){
				pwIsCorrect = true;
			}
			
			if(pswdata.length<=3 || usernamedata in users || usernamedata.length<2 || nameIsInDatabase && !pwIsCorrect){
				callback(false);
			} else{
				callback(true);
				if(!nameIsInDatabase){
					standard = "https://www.tagesspiegel.de/images/sulawesi/10310720/2-format6001.jpg";
					databaseInsertUser(usernamedata, pswdata, standard)	
				}
				paswo = usernamedata;
				databaseGetPic(function(picdata){
					//picdata is bildpfad
					profilpics.set(usernamedata, picdata);
					pics[picdata] = picdata;
					socket.username = usernamedata;
					users[socket.username]=socket;
					updateUsernames();
					io.sockets.emit('new message', {msg: 'joined the server', user: socket.username, date: new Date()});
				});
			}
		});
	});
	
	//in der updateUsers weil es hier mit dem getNamen funktionier getPSW aber nicht
	function updateUsernames(){
		console.log("#Update User");
		picsy = [];
		for(i = 0; i< profilpics.size;i++){
			picsy[i]=profilpics.get(Object.keys(users)[i]);
			console.log('##'+i+"##"+picsy[i]);
		}
		io.sockets.emit('get users', Object.keys(users), picsy);
		databaseGetUserNames();
	}
	
});



