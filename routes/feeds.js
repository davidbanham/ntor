var fs = require('fs')
, nodemailer = require('nodemailer');
var feedTargets = JSON.parse(fs.readFileSync('data/feedTargets.json'))
, feedHits = JSON.parse(fs.readFileSync('data/feedHits.json'));

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

	var feedEngines = fs.readdirSync('./plugins/feeds');

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
				}
			});
		});
	};

	var dlFeed = function(item, engine, feedTarget) {
		for ( var i = 0 ; i < feedHits.length ; i++ ) {
			if ( feedHits[i].url === item.url) return;
		}
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
						if (error) return console.error(error);
						var fullDownloadPath = app.util.downloadDir+'/'+feedTarget.tag.elements.join('/');
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
				notify(feedTarget, item);
			}
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

	app.post('/feed/target', app.util.requiresLevel(0), function(req,res) {
		var maxId = 0;
		for (var i = 0 ; i < feedTargets.length ; i++ ) {
			if ( feedTargets[i].id > maxId ) maxId = feedTargets[i].id;
		}
		var notificationList = [];
		if (req.body.notify === true) notificationList.push(req.session.user.email);
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

	app.del('/feed/target/:id', app.util.requiresLevel(0), function(req,res) {
		var filteredTargets = feedTargets.filter(function(x) {
			return ( x.id != req.params.id );
		});
		feedTargets = filteredTargets;
		fs.writeFileSync('data/feedTargets.json', JSON.stringify(filteredTargets));
		res.send('success');
	});

	app.post('/removeNotificationTarget', app.util.requiresLevel(0), function(req,res) {
		for ( var i = 0 ; i < feedTargets.length ; i++ ) {
			if ( feedTargets[i].id == req.body.targetId ) {
				var notificationTargetPos = feedTargets[i].notificationList.indexOf(req.session.user.email);
				feedTargets[i].notificationList.splice(notificationTargetPos, 1);
			}
		}
		fs.writeFileSync('data/feedTargets.json', JSON.stringify(feedTargets));
		res.send('success');
	});

	app.post('/addNotificationTarget', app.util.requiresLevel(0), function(req,res) {
		for ( var i = 0 ; i < feedTargets.length ; i++ ) {
			if ( feedTargets[i].id == req.body.targetId ) {
				feedTargets[i].notificationList.push(req.session.user.email);
			}
		}
		fs.writeFileSync('data/feedTargets.json', JSON.stringify(feedTargets));
		res.send('success');
	});
};
