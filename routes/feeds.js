var fs = require('fs')
, path = require('path')
, nodemailer = require('nodemailer');

var feedService = require('../lib/feed.js');
var hitService = require('../lib/hit.js');

module.exports = function(app) {
	var basePath = app.util.basePath
	, getInfoHash = app.util.getInfoHash
	, rt = app.util.rt;

	var smtpTransport = nodemailer.createTransport("SMTP",{
		service: "Gmail",
		auth: {
			user: app.util.conf.mail.username,
			pass: app.util.conf.mail.password
		}
	});

	var feedEngines = fs.readdirSync(path.join(__dirname, './plugins/feeds'));

	var feedWorkers = {};

	for ( var i = 0 ; i < feedEngines.length ; i++ ) {
		if (feedEngines[i] === '.blank') continue;
		if (feedEngines[i] === '.gitignore') continue;
		var feedEnginePath = '../plugins/feeds/'+feedEngines[i];
		feedWorkers[feedEngines[i]] = require(feedEnginePath);
	}

	setInterval(function() {
		var feedKeys = Object.keys(feedWorkers);
		for ( var i = 0 ; i < feedKeys.length ; i++ ) {
			checkFeedWorker(feedWorkers[feedKeys[i]]);
		}
	}, 5 * 60 * 1000);

	var checkFeedWorker = function(worker) {
		worker.items(function(err, results){
			feedService.all(function(err, targets) {
				var matches = results.filter(function(elem){
					for (key in targets) {
						var target = targets[key];
						var now = new Date().getTime();
						if (now - target.lastHit < target.frequency) return;
						if (elem.name.search(target.yes) > -1 ) {
							if (elem.name.search(target.no) < 0 ) dlFeed(elem, worker, target);
						}
					}
				});
			});
		});
	};

	var dlFeed = function(item, engine, target) {
		hitService.get(item.url, function(err, hit) {
			if (typeof hit !== 'undefined') return;
			hitService.store(item);
			target.lastHit = new Date().getTime();
			feedService.store(target);
			var relativePath = 'torrentBin/'+item.name+'.torrent';
			engine.download(item.url, relativePath, function(error) {
				if (error) console.error('Feed DL error '+JSON.stringify(target)+' '+JSON.stringify(engine));
				else {
					var fullFilePath = basePath+relativePath;
					getInfoHash(fullFilePath, function(infoHash) {
						rt.upload(fullFilePath, function(error) {
							if (error) return console.error(error);
							var fullDownloadPath = app.util.downloadDir+'/'+target.tag.elements.join('/');
							app.util.createFullPath(fullDownloadPath, function() {
								if (error) return console.error('Failed to create download directory');
								rt.setPath(infoHash, fullDownloadPath, function(error, data) {
									rt.start(infoHash, function(error, data) {
										if (error) console.error('Hash error!'+error);
									});
								});
							});
						});
					});
					notify(target, item);
				}
			});
		});
	};
	var notify = function(target, item) {
		if (app.util.conf.mail.enabled === 'false') return;
		for ( var i = 0 ; i < target.notificationList.length ; i++ ) {
			var mailOptions = {
				from: app.util.conf.mail.from
				, to: target.notificationList[i]
				, subject: 'NTOR - '+item.name
				, html: 'http://'+app.util.conf.extDomain+'/incoming/'+encodeURIComponent(target.tag.elements.join('/'))+' <br><br>'+target.yes
				, text: 'http://'+app.util.conf.extDomain+'/incoming/'+encodeURIComponent(target.tag.elements.join('/'))+' \n\n'+target.yes
			};
			smtpTransport.sendMail(mailOptions, function(error, response) {
				if(error){
					console.error(error);
				}else{
					console.log("Message sent: " + response.message);
				}
			});
		}
	};
	app.get('/feed/target', app.util.requiresLevel(0), function(req,res) {
		var feedItems = [];
		feedService.all(function(err, feeds) {
			for (key in feeds) {
				var feed = feeds[key];
				var item = {
					yes: feed.yes
					, no: feed.no
					, tag: feed.tag
					, frequency: feed.frequency
					, lastHit: feed.lastHit
					, id: feed.yes
				};
				if ( feed.notificationList.indexOf(req.session.user.email) >= 0 ) {
					item.notifyMe = true;
				} else {
					item.notifyMe = false;
				}
				feedItems.push(item);
			};
			res.send(feedItems);
		});
	});

	app.post('/feed/target', app.util.requiresLevel(0), function(req,res) {
		var notificationList = [];
		if (req.body.notify === true) notificationList.push(req.session.user.email);
		var newTarget = {
			yes: req.body.yes
			, no: req.body.no
			, notificationList: notificationList
			, tag: req.body.tag
			, frequency: req.body.frequency
			, lastHit: 0
		};
		feedService.store(newTarget, function(err) {
			if (err) return res.send(500, 'fail');
			return res.send('success');
		});
	});

	app.del('/feed/target/:id', app.util.requiresLevel(0), function(req,res) {
		feedService.del(req.params.id, function(err) {
			if (err) return res.send(500, 'fail');
			return res.send('success');
		});
	});

	app.post('/removeNotificationTarget', app.util.requiresLevel(0), function(req,res) {
		feedService.get(req.body.targetId, function(err, target) {
			var notificationTargetPos = target.notificationList.indexOf(req.session.user.email);
			target.notificationList.splice(notificationTargetPos, 1);
			feedService.store(target, function(err) {
				if (err) return res.send(500, 'fail');
				return res.send('success');
			});
		});
	});

	app.post('/addNotificationTarget', app.util.requiresLevel(0), function(req,res) {
		feedService.get(req.body.targetId, function(err, target) {
			if ( target.notificationList.indexOf(req.session.user.email) > -1 ) return res.send(409, 'duplicate');
			target.notificationList.push(req.session.user.email);
			feedService.store(target, function(err) {
				if (err) return res.send(500, 'fail');
				return res.send('success');
			});
		});
	});
};
