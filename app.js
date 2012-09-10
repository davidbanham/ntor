/**
 * Module dependencies.
*/

var express = require('express')
, RTorrent = require('rtorrent')
, fs = require('fs')
, nt = require('nt')
, crypto = require('crypto')
, child = require('child_process')
, spawn = require('child_process').spawn
, nodemailer = require('nodemailer')
, mime = require('mime')
, finder = require('findit')
, conf = require('./config/conf.js')
, store = new express.session.MemoryStore
, basePath = __dirname+'/'
, extDomain = conf.general.extDomain
, pollerError = { error: true, details: "Not yet initialised" }
, polledTorrents = false
, downloadDir = ''
, tags = JSON.parse(fs.readFileSync('data/tags.json'))
, users = JSON.parse(fs.readFileSync('data/users.json'))
, feedTargets = JSON.parse(fs.readFileSync('data/feedTargets.json'))
, feedHits = JSON.parse(fs.readFileSync('data/feedHits.json'))

store.sessions = JSON.parse(fs.readFileSync('data/sessions.json'));
express.static.mime.define({'video/mkv': ['mkv']});

var rt = new RTorrent(conf.rtorrent);

rt.getBase(function(err, data) {
	if (err) throw "Error getting rtorrent base download directory: "+err;
	else downloadDir = data;
});

var smtpTransport = nodemailer.createTransport("SMTP",{
	service: "Gmail",
	auth: {
		user: conf.mail.username,
		pass: conf.mail.password
	}
});

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.set('view options', { layout: false, pretty: true });
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser());
	app.use(express.session({key: 'ntor.sid', secret: conf.general.cookieSecret, store: store, cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 } }));
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

var searchWorkers = {};

for (var i = 0 ; i < searchEngines.length ; i++) {
	var path = './plugins/search/'+searchEngines[i];
	searchWorkers[searchEngines[i]] = require(path);
};

var feedEngines = fs.readdirSync('./plugins/feeds');

var feedWorkers = {};

for ( var i = 0 ; i < feedEngines.length ; i++ ) {
	var path = './plugins/feeds/'+feedEngines[i];
	feedWorkers[feedEngines[i]] = require(path);
};

setInterval(function() {
	var feedKeys = Object.keys(feedWorkers);
	for ( var i = 0 ; i < feedKeys.length ; i++ ) {
		checkFeedWorker(feedWorkers[feedKeys[i]]);
	};
}, 5 * 60 * 1000);

var checkFeedWorker = function(worker) {
	worker.items(function(err, results){
		var matches = results.filter(function(elem){
			for ( var i = 0 ; i < feedTargets.length ; i++ ) {
				var now = new Date().getTime();
				if (now - feedTargets[i].lastHit < feedTargets[i].frequency) continue;
				if (elem.name.search(feedTargets[i].yes) > -1 ) {
					if (feedTargets[i].no !== '') {
						if (elem.name.search(feedTargets[i].no) < 0) dlFeed(elem.url, worker );
					} else {
						dlFeed(elem, worker, feedTargets[i]);
					}
				}
			};
		});
	});
};

var dlFeed = function(item, engine, feedTarget) {
	for ( var i = 0 ; i < feedHits.length ; i++ ) {
		if ( feedHits[i].url === item.url) return;
	};
	feedHits.push(item);
	fs.writeFileSync('data/feedHits.json', JSON.stringify(feedHits));
	feedTarget.lastHit = new Date().getTime();
	fs.writeFileSync('data/feedTargets.json', JSON.stringify(feedTargets));
	var relativePath = 'torrentBin/'+item.name+'.torrent';
	engine.download(item.url, relativePath, function(error) {
		if (error) console.error('Feed DL error '+JSON.stringify(feedTarget)+' '+JSON.stringify(engine));
		else {
			var fullFilePath = basePath+relativePath;
			getInfoHash(fullFilePath, function(infoHash) {
				rt.upload(fullFilePath, function(error) {
					if (error) return res.send({error:error});
					var fullDownloadPath = downloadDir+'/'+feedTarget.tag;
					createFullPath(fullDownloadPath, function() {
						if (error) return res.send({error:'Failed to create download directory'});
						rt.setPath(infoHash, fullDownloadPath, function(error, data) {
							rt.start(infoHash, function(error, data) {
								if (error) console.error('Hash error!'+error);
							});
						});
					});
				});
			});
			notify(feedTarget, item);
		};
	});
};

var notify = function(target, item) {
	if (mail.enabdled === 'false') return;
	for ( var i = 0 ; i < target.notificationList.length ; i++ ) {
		var mailOptions = {
			from: conf.mail.from
			, to: target.notificationList[i]
			, subject: 'NTOR - '+item.name
			, html: 'http://'+extDomain+'/incoming/'+encodeURIComponent(target.tag)+' <br><br>'+target.yes
			, text: 'http://'+extDomain+'/incoming/'+encodeURIComponent(target.tag)+' \n\n'+target.yes
		};
		smtpTransport.sendMail(mailOptions, function(error, response) {
			if(error){
				console.error(error);
			}else{
				console.log("Message sent: " + response.message);
			}
		});
	};
};

var poller = setInterval(function(){
	rt.details(function(err,torrents) {
		if (err) pollerError = { error: true, details: err };
		else {
			pollerError = false;
			for ( var i = 0 ; i < torrents.length ; i++ ) {
				torrents[i].path = torrents[i].path.replace(downloadDir, '');
			};
			polledTorrents = torrents;
		}
	});
}, 10 * 1000);

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
					} else res.redirect('/login', 401);
				} else res.redirect('/login', 401);
			});
		} else res.redirect('/login', 401);
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
			res.redirect('/');
		} else {
			res.send('fail', 403);
		}
	})
});

var fakeApache = function(req, res) {
	var path = './public/incoming/'+req.params[0];
	console.log(req.params);
	if (req.params[0][req.params[0].length - 4] === '.') return res.sendfile(path);
	console.log(	req.params[0][req.params[0].length - 4] )
console.log(req.params[0][req.params[0].length - 4] === '.');
	var fileList =  fs.readdir(path, function(err, files) {
		if (err) return res.send(err, 500);
		var fileObjects = [];
		for ( var i = 0 ; i < files.length ; i++ ) {
			var mimeType = mime.lookup(path+files[i]);
			var fileStat = fs.statSync(path+'/'+files[i]);
			if ( fileStat.size === 4096 ) var fileSize = '-';
			else var fileSize = stupidApacheBytesToSize(fileStat.size, 1);
			var mimePrime = mimeType.split('/')[0];
			var iconType = '';
			var altTag = '';
			switch(mimePrime){
				case 'video':
					iconType = 'movie';
					altTag = '[VID]';
					break;
				case 'text':
					iconType = 'text';
					altTag = '[TXT]';
					break;
				case 'application':
					iconType = 'folder';
					altTag = '[DIR]';
					break;
				default:
					iconType = 'unknown';
					altTag = '[DIR]';
			}
			if (iconType === 'folder') files[i] = files[i]+'/';
			fileObjects[i] = {
				name: files[i]
				, mimeType: mimeType
				, iconType: iconType
				, altTag: altTag
				, fileSize: fileSize
			};
		};
		res.render('apache', {
			files: fileObjects
			, dirname: 'something'
		});
	});
};

app.get('/apacheList', requiresLevel(0), function(req,res) {
	fakeApache(req,res);
});

app.get('/apacheList/*', requiresLevel(0), function(req,res) {
	fakeApache(req,res);
});

app.get('/streamFile/', requiresLevel(0), function(req,res) {
	var path = '/incoming' + req.query.path;
	res.render('stream', {
		path: path
	});
});

app.get('/feedTargets', requiresLevel(0), function(req,res) {
	var feedItems = [];
	for ( var i = 0 ; i < feedTargets.length ; i ++ ) {
		var item = {
			yes: feedTargets[i].yes
			, no: feedTargets[i].no
			, tag: feedTargets[i].tag
			, frequency: feedTargets[i].frequency
			, lastHit: feedTargets[i].lastHit
			, id: feedTargets[i].id
		};
		if ( feedTargets[i].notificationList.indexOf(req.session.user.email) >= 0 ) {
			item.notifyMe = true;
		} else {
			item.notifyMe = false;
		}
		feedItems.push(item);
	}
	res.send(feedItems);
});

app.post('/newFeedTarget', requiresLevel(0), function(req,res) {
	var maxId = 0;
	for (var i = 0 ; i < feedTargets.length ; i++ ) {
		if ( feedTargets[i].id > maxId ) maxId = feedTargets[i].id;
	}
	var notificationList = [];
	if (req.body.notify === 'true') notificationList.push(req.session.user.email);
	var newTarget = {
		yes: req.body.yes
		, no: req.body.no
		, notificationList: notificationList
		, tag: req.body.tag
		, frequency: req.body.frequency
		, id: maxId + 1
		, lastHit: 0
	};
	feedTargets.push(newTarget);
	fs.writeFileSync('data/feedTargets.json', JSON.stringify(feedTargets));
	res.send('success');
});

app.post('/deleteFeedTarget', requiresLevel(0), function(req,res) {
	var filteredTargets = feedTargets.filter(function(x) {
		return ( x.id != req.body.targetId );
	});
	feedTargets = filteredTargets;
	fs.writeFileSync('data/feedTargets.json', JSON.stringify(filteredTargets));
	res.send('success');
});

app.post('/removeNotificationTarget', requiresLevel(0), function(req,res) {
	for ( var i = 0 ; i < feedTargets.length ; i++ ) {
		if ( feedTargets[i].id == req.body.targetId ) {
			var notificationTargetPos = feedTargets[i].notificationList.indexOf(req.session.user.email);
			feedTargets[i].notificationList.splice(notificationTargetPos, 1);
		}
	};
	fs.writeFileSync('data/feedTargets.json', JSON.stringify(feedTargets));
	res.send('success');
});

app.post('/addNotificationTarget', requiresLevel(0), function(req,res) {
	for ( var i = 0 ; i < feedTargets.length ; i++ ) {
		if ( feedTargets[i].id == req.body.targetId ) {
			feedTargets[i].notificationList.push(req.session.user.email);
		}
	};
	fs.writeFileSync('data/feedTargets.json', JSON.stringify(feedTargets));
	res.send('success');
});

app.post('/addToQueue', requiresLevel(0), function(req,res) {
	if ( typeof users[req.session.user.email].queue === 'undefined' ) users[req.session.user.email].queue = [];
	if ( users[req.session.user.email].queue.indexOf(req.body.path) > -1 ) return res.send('duplicate');
	fs.exists(downloadDir+'/'+req.body.path, function(exists) {
		if ( exists ) {
			users[req.session.user.email].queue.push(req.body.path);
			fs.writeFileSync('data/users.json', JSON.stringify(users));
			res.send('success');
		} else {
			res.send('path does not exist');
		}
	});
});

app.get('/clearQueue', requiresLevel(0), function(req,res) {
	users[req.session.user.email].queue = [];
	fs.writeFileSync('data/users.json', JSON.stringify(users));
	res.send('success');
});

app.post('/removeFromQueue', requiresLevel(0), function(req,res) {
	if ( typeof users[req.session.user.email].queue === 'undefined' ) return res.send('queue undef');
	if ( users[req.session.user.email].queue.length === 0 ) return res.send('length 0');
	if ( req.body.path !== users[req.session.user.email].queue[0] ) return res.send('item not found');
	users[req.session.user.email].queue.shift();
	fs.writeFileSync('data/users.json', JSON.stringify(users));
	res.send(200);
});

app.get('/queueItem', requiresLevel(0), function(req,res) {
	if(typeof users[req.session.user.email].queue === 'undefined') return res.send('');
	if(typeof users[req.session.user.email].queue[0] === 'undefined') return res.send('');
	res.send(users[req.session.user.email].queue[0]);
});

app.get('/zip', requiresLevel(0), function(req,res) {
	// Options -r recursive -j ignore directory info - redirect to stdout
	var zip = spawn('zip', ['-r', '-', './'+req.query.path], {cwd:__dirname+'/public/incoming'});

	res.contentType('zip');

	// Keep writing stdout to res
	zip.stdout.on('data', function (data) {
		res.write(data);
	});

	zip.stderr.on('data', function (data) {
		// Uncomment to see the files being added
		//console.log('zip stderr: ' + data);
	});

	// End the response on zip exit
	zip.on('exit', function (code) {
		if(code !== 0) {
			res.statusCode = 500;
			console.log('zip process exited with code ' + code);
			res.end();
		} else {
			res.end();
		}
	});
});

app.get('/showQueue', requiresLevel(0), function(req,res) {
	res.send(users[req.session.user.email].queue);
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
	delete users[req.body.email];
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
	nt.read(path, function(err, torrent) {
		if(err) console.error('getInfoHash error'+err);
		else callback(nt.getInfoHash(torrent));
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
			if (error) return res.send({error:error.toString()});
			var fullFilePath = basePath+relativePath;
			getInfoHash(fullFilePath, function(infoHash) {
				rt.upload(fullFilePath, function(error) {
					if (error) return res.send({error:error.toString()});
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
	if (pollerError) res.send(pollerError);
	else res.send(polledTorrents);
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

setInterval(function(){
	fs.writeFileSync('data/sessions.json', JSON.stringify(store.sessions));
}, 2000);

