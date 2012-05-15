/**
 * Module dependencies.
 */

var express = require('express')
	, RTorrent = require('rtorrent')
	, fs = require('fs')
	, nt = require('nt')
	, crypto = require('crypto')
	, child = require('child_process')
	, basePath = '/home/davidbanham/ntor/'
	, downloadDir = '~'
	, tags = JSON.parse(fs.readFileSync('data/tags.json'))
	, users = JSON.parse(fs.readFileSync('data/users.json'))

var rt = new RTorrent({
	host: '127.0.0.1'
	, user: 'rtorrent'
	, pass: 'Yww18iwSngbO'
	, path: '/RPC2'
	, port: 81
});

rt.getBase(function(err, data) {
	if (err) throw "Error getting rtorrent base download directory: "+err
	else downloadDir = data;
});

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
	app.set('view options', { layout: false });
  app.use(express.bodyParser());
  app.use(express.methodOverride());
	app.use(express.cookieParser());
	app.use(express.session({key: 'ntor.sid', secret: 'tH9tsMnsJrSv' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.use(express.directory(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Plugins

var searchEngines = fs.readdirSync('./plugins/search');

var searchWorkers = [];

for (var i = 0 ; i < searchEngines.length ; i++) {
	var path = './plugins/search/'+searchEngines[i];
	searchWorkers[searchEngines[i]] = require(path);
};


// Middleware
function requiresLevel(requiredLevel) {
	return function(req, res,next) {
		if ( typeof req.session.user !== 'undefined' ) {
			if (req.session.user.level >= requiredLevel) next();
		}
		else res.redirect('/login', 401);
	};
};

// Routes

app.get('/incoming/*', requiresLevel(0), function(req,res,next) {
	next();
});

app.get('/', requiresLevel(0), function(req,res) {
	res.render('index', {
		searchEngines: searchEngines
	});
});

app.get('/login', function(req,res) {
	res.render('login');
});

app.post('/login', function(req,res) {
	authenticate(req.body.username, req.body.password, function(user) {
		if (user) {
			req.session.user = user;
			req.session.user.email = req.body.username;
			console.log(req.session.user);
			res.redirect('/');
		} else {
			res.send('fail', 403);
		}
	})
});

app.post('/changePass', requiresLevel(0), function(req,res) {
	var pass = hashPass(req.body.oldPassword);
	if ( pass !== users[req.session.user.email].pass ) return res.send('Old password was wrong', 403);
	var pass = hashPass(req.body.newPassword);
	users[req.session.user.email].pass = pass;
	fs.writeFileSync('data/users.json', JSON.stringify(users));
	res.send('success');
});

app.post('/adduser', requiresLevel(50), function(req,res) {
	var pass = hashPass(req.body.password);
	users[req.body.email] = { pass: pass, level: req.body.level };
	fs.writeFileSync('data/users.json', JSON.stringify(users));
	res.send('success');
});

app.post('/delUser', requiresLevel(50), function(req,res) {
	console.log(users);
	console.log(users[req.body.email]);
	delete users[req.body.email];
	console.log(users);
	fs.writeFileSync('data/users.json', JSON.stringify(users));
	res.send('success');
});

app.get('/listUsers', requiresLevel(50), function(req,res) {
	var userList = [];
	for ( var x in users ) {
		userList.push({email: x, level: users[x].level});
	};
	res.send(JSON.stringify(userList));
});

app.get('/freeDiskSpace', requiresLevel(0), function(req,res) {
	child.exec('stat -f / -c %f_%s', function(err,data) {
		var arr = data.split('_');
		var free = parseInt(arr[0]);
		var block = parseInt(arr[1]);
		var sizeString = bytesToSize(free * block);
		res.send([sizeString]);
	});
// NFI why this isn't working right
//	rt.getFreeDiskSpace(function(err,uniques,data) {
//		var sizes = Object.keys(uniques);
//		var sizeStrings = [];
//		for ( var i = 0 ; i < sizes.length ; i++ ) {
//			sizeStrings.push(bytesToSize(sizes[i]));
//		}
//		res.send(sizeStrings);
//	});
});

app.get('/search', requiresLevel(0), function(req,res) {
	if (typeof req.query.marker === 'undefined') req.query.marker = false;
	try{
		searchWorkers[req.query.engine].search(req.query.expression, req.query.marker, function(error, results, pagination){
			if (error) return res.send({error: error});
			else res.send({
				results: results
				, pagination: pagination
				, engine: req.query.engine
				, expression: req.query.expression
			});
		});
	} catch(err) {
		console.error(err);
		res.send({error:"The search engine failed. It was: "+req.query.engine});
	};
});

var getInfoHash = function(path, callback) {
	console.log(path);
	nt.read(path, function(err, torrent) {
		console.log(err);
		console.log('read completed');
		callback(nt.getInfoHash(torrent));
	});
};

var createFullPath = function(path, callback) {
	var pathParts = path.split('/');
	var pathStr = '';
	for ( var i = 0; i < pathParts.length ; i++ ) {
		pathStr += pathParts[i] + '/';
		try{fs.mkdirSync(pathStr, 0755)}catch(err){ console.error(err) };
	};
	callback();
};


app.post('/download', requiresLevel(0), function(req,res) {
	var fileName = req.body.name;
	var relativePath = 'torrentBin/'+fileName+'.torrent';
	try{
		searchWorkers[req.body.engine].download(req.body.url, relativePath, function(error) {
			if (error) return res.send({error:error});
			var fullFilePath = basePath+relativePath;
			getInfoHash(fullFilePath, function(infoHash) {
				rt.upload(fullFilePath, function(error) {
					if (error) return res.send({error:error});
					var fullDownloadPath = downloadDir+'/'+req.body.tag;
					createFullPath(fullDownloadPath, function() {
						if (error) return res.send({error:'Failed to create download directory'});
						rt.setPath(infoHash, fullDownloadPath, function(error, data) {
							rt.start(infoHash, function(error, data) {
								if (error) return res.send({error:error});
								res.send({success:true});
							});
						});
					});
				});
			});
		});
	} catch(err) {
		res.send({error:"The search engine failed. It was: "+req.body.engine});
	};
});

app.get('/torrents', requiresLevel(0), function(req,res) {
	rt.details(function(err,torrents) {
		if (err) res.send({error: true, details: err});
		else res.send(torrents);
	});
});

app.get('/tags', requiresLevel(0), function(req,res) {
	res.send(tags);
});

app.post('/removeTag', requiresLevel(0), function(req,res) {
	var pos = tags.indexOf(req.body.target);
	tags.splice(pos, 1);
	res.send({success: true});
});

app.post('/newTag', requiresLevel(0), function(req,res) {
	tags.push(req.body.tag);
	fs.writeFileSync('data/tags.json', JSON.stringify(tags));
	res.send({success: true});
});

app.post('/start', requiresLevel(0), function(req,res) {
	rt.start(req.body.hash, function(err) {
		if (err) res.send({error: true, details: err});
		else res.send({success: true});
	})
});

app.post('/stop', requiresLevel(0), function(req,res) {
	rt.stop(req.body.hash, function(err) {
		if (err) res.send({error: true, details: err});
		else res.send({success: true});
	})
});

app.post('/stopAll', requiresLevel(0), function(req,res) {
	rt.details(function(err,torrents) {
		errors = [];
		for ( var i = 0 ; i < torrents.length ; i++ ) {
			rt.stop(torrents[i].hash, function(err) {
				if (err) errors.push(err);
			});
		};
		if (errors.length > 0) res.send({error:true, details: errors});
		else res.send({success: true});
	})
});

app.post('/startAll', requiresLevel(0), function(req,res) {
	rt.details(function(err,torrents) {
		errors = [];
		for ( var i = 0 ; i < torrents.length ; i++ ) {
			rt.start(torrents[i].hash, function(err) {
				if (err) errors.push(err);
			});
		};
		if (errors.length > 0) res.send({error:true, details: errors});
		else res.send({success: true});
	})
});

app.post('/remove', requiresLevel(0), function(req,res) {
	rt.remove(req.body.hash, function(err) {
		if (err) res.send({error: true, details: err});
		else res.send({success: true});
	})
});

app.get('/path', requiresLevel(0), function(req,res) {
	rt.getPath(req.query.hash, function(err, data) {
		if (err) res.send({error: true, details: err});
		else res.send(data);
	});
});

app.get('/peers', requiresLevel(0), function(req,res) {
	rt.remove(req.query.hash, function(err, peers) {
		if (err) res.send({error: true, details: err});
		else res.send({success: true, peers: peers});
	})
});

app.get('/files', requiresLevel(0), function(req,res) {
	rt.remove(req.query.hash, function(err, files) {
		if (err) res.send({error: true, details: err});
		else res.send({success: true, files: files});
	})
});

app.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

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
}

function authenticate(login, password, callback) {
	var pass = hashPass(password);
	if (typeof users[login] !== 'undefined') {
		if(users[login].pass === pass) callback(users[login]);
		else callback(null);
	}
	else callback(null);
};

function hashPass(password) {
  var cipher = crypto.createCipher('blowfish', password);
  var pass = cipher.final('base64');
	return pass;
};

