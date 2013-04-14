/**
 * Module dependencies.
*/

var express = require('express')
, https = require('https')
, fs = require('fs')
, nt = require('nt')
, RTorrent = require('rtorrent')
, crypto = require('crypto')
, cookie = require('cookie')
, connect = require('connect')
, socketio = require('socket.io')
, conf = require('./config/conf.js')
, diff = require('jsondiffpatch')
, userService = require('./lib/user.js')
, LevelStore = require('connect-level')(express)
, store = new LevelStore
, basePath = __dirname+'/'
, freeDiskSpace = ''
, mungedDirectory = require('./lib/middleware/directory.js')

express.static.mime.define({'video/mkv': ['mkv']});

var app = module.exports = express();
var rt = new RTorrent(conf.rtorrent);
var server = https.createServer({key: fs.readFileSync('./server.key'), cert: fs.readFileSync('./server.crt')},app);
var io = socketio.listen(server);
io.set('log level', 1);
io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file
io.set('authorization', function (data, cb) {
	if (data.headers.cookie) var cook = cookie.parse(data.headers.cookie);
	if (data.query.sessu) {
		var cook = {};
		cook['ntor.sid'] = data.query.sessu;
	}
	var sessionID = connect.utils.parseSignedCookie(cook['ntor.sid'], conf.general.cookieSecret);
	data.sessionID = sessionID;
	if (cook['ntor.sid'] == sessionID) {
		return cb('Invalid cookie', false);
	}
	return cb(null, true);
});
io.sockets.on('connection', function(socket) {
	var handshake = socket.manager.handshaken;
	for (var id in handshake) {
		store.get(handshake[id].sessionID, function(err, sess) {
			if (typeof sess == "undefined") return null;
			sess.socketID = id;
			store.set(handshake[id].sessionID, sess);
			socket.join(sess.user.email);
			socket.on('online', function(data) {
				io.sockets.in(sess.user.email).emit('online', data);
			});
			socket.on('progress', function(data) {
				io.sockets.in(sess.user.email).volatile.emit('progress', data);
			});
		});
	}
	socket.emit('diskSpace', freeDiskSpace);
	socket.on('subscribe', function(data) { socket.join(data.room); });
	socket.on('unsubscribe', function(data) { socket.leave(data.room); });
});

diff.config.objectHash = function(obj) { obj.id || JSON.stringify(obj); };

var sessionMunger = function(req,res,next) {
	if ( typeof req.query.sessu !== 'undefined' ) {
		req.cookies['ntor.sid'] = req.query.sessu;
	}
	req.ntor = req.cookies['ntor.sid'];
	next();
};

var torrentChanges = function(changes) {
	io.sockets.in('torrentChanges').emit('torrentChange', changes);
};

// Configuration

app.configure(function(){
	app.set('views', __dirname + '/views');
	app.set('port', process.env.PORT || 3000);
	app.set('view engine', 'jade');
	app.set('view options', { layout: false, pretty: true });
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser());
	app.use(sessionMunger);
	app.use(express.session({key: 'ntor.sid', secret: conf.general.cookieSecret, store: store, cookie: { httpOnly: false, maxAge: 14 * 24 * 60 * 60 * 1000 } }));
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
	//app.use(express.directory(__dirname + '/public'));
	app.use(mungedDirectory(__dirname + '/public'));
});

app.configure('development', function(){
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
	app.use(express.errorHandler());
});

// Middleware
function requiresLevel(requiredLevel) {
	return function(req, res,next) {
		if ( typeof req.session.user !== 'undefined' ) {
			if (req.session.user.level >= requiredLevel) next();
		}
		else if ( typeof req.headers.authorization !== 'undefined' ) {
      // Brainfuck! Splits the authorization header into the bit we actually want, creates a buffer out of it, decodes that buffer into ascii, then splits that into an array of [username, password]      
			var authArray = new Buffer(req.headers.authorization.split(' ')[1], 'base64').toString('ascii').split(':');
			authenticate(authArray[0], authArray[1], function(user) {
				if(user) {
					if (user.level >= requiredLevel) {
						req.session.user = user;
						req.session.user.email = authArray[0];
						next();
					} else res.redirect('/login');
				} else res.redirect('/login');
			});
		} else res.redirect('/login');
	};
}

var bytesToSize = function (bytes, precision)
{  
	var kilobyte = 1024;
	var megabyte = kilobyte * 1024;
	var gigabyte = megabyte * 1024;
	var terabyte = gigabyte * 1024;

	if ((bytes >= 0) && (bytes < kilobyte)) {
		return bytes + ' B';

	} else if ((bytes >= kilobyte) && (bytes < megabyte)) {
		return (bytes / kilobyte).toFixed(precision) + ' KB';

	} else if ((bytes >= megabyte) && (bytes < gigabyte)) {
		return (bytes / megabyte).toFixed(precision) + ' MB';

	} else if ((bytes >= gigabyte) && (bytes < terabyte)) {
		return (bytes / gigabyte).toFixed(precision) + ' GB';

	} else if (bytes >= terabyte) {
		return (bytes / terabyte).toFixed(precision) + ' TB';

	} else {
		return bytes + ' B';
	}
};

var stupidApacheBytesToSize = function (bytes, precision)
{  
	var kilobyte = 1024;
	var megabyte = kilobyte * 1024;
	var gigabyte = megabyte * 1024;
	var terabyte = gigabyte * 1024;

	if ((bytes >= 0) && (bytes < kilobyte)) {
		return bytes + ' B';

	} else if ((bytes >= kilobyte) && (bytes < megabyte)) {
		return (bytes / kilobyte).toFixed(precision) + 'K';

	} else if ((bytes >= megabyte) && (bytes < gigabyte)) {
		return (bytes / megabyte).toFixed(precision) + 'M';

	} else if ((bytes >= gigabyte) && (bytes < terabyte)) {
		return (bytes / gigabyte).toFixed(precision) + 'G';

	} else if (bytes >= terabyte) {
		return (bytes / terabyte).toFixed(precision) + 'T';

	} else {
		return bytes + 'B';
	}
};

var authenticate = function(login, password, callback) {
	var pass = hashPass(password);
	userService.keys(function(err, users) {
		if (users.indexOf(login) > -1 ) {
			userService.get(login, function(err, user) {
				if(user.pass === pass) callback(user);
				else callback(null);
			});
		}
		else callback(null);
	});
};

var hashPass = function(password) {
	var cipher = crypto.createCipher('blowfish', password);
	var pass = cipher.final('base64');
	return pass;
};

var diskSpace = function(cb) {
	rt.getFreeDiskSpace(function(err,uniques,data) {
		var sizes = Object.keys(uniques);
		var sizeStrings = [];
		for ( var i = 0 ; i < sizes.length ; i++ ) {
			sizeStrings.push(bytesToSize(sizes[i]));
		}
		cb(sizeStrings);
	});
};

var getInfoHash = function(filePath, callback) {
	nt.read(filePath, function(err, torrent) {
		if(err) console.error('getInfoHash error'+err);
		else callback(torrent.infoHash());
	});
};

var createFullPath = function(filePath, callback) {
	var pathParts = filePath.split('/');
	var pathStr = '';
	for ( var i = 0; i < pathParts.length ; i++ ) {
		pathStr += pathParts[i] + '/';
		try{fs.mkdirSync(pathStr, 0755);}catch(err){ console.error("Error creating path: ", err); }
	}
	callback();
};

app.util = {
	requiresLevel: requiresLevel
	, authenticate: authenticate
	, hashPass: hashPass
	, diskSpace: diskSpace
	, io: io
	, conf: conf
	, downloadDir: ''
	, getInfoHash: getInfoHash
	, createFullPath: createFullPath
	, userService: userService
	, basePath: basePath
	, rt: rt
	, stupidApacheBytesToSize: stupidApacheBytesToSize
	, torrentChanges: torrentChanges
};

// Routes

require('./routes/main')(app);
require('./routes/auth')(app);
require('./routes/files')(app);
require('./routes/queue')(app);
require('./routes/feeds')(app);
require('./routes/users')(app);
require('./routes/search')(app);
require('./routes/torrents')(app);
require('./routes/tags')(app);

server.listen(app.get("port"), function() {
	return console.log("Express server listening on port " + app.get("port"));
});

setInterval(function() {
	diskSpace(function(space) {
		if (typeof diff.diff(freeDiskSpace, space) !== 'undefined') {
			freeDiskSpace = space;
			io.sockets.emit('diskSpace', space);
		}
	});
}, 10 * 1000);

