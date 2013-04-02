var pollerError = { error: true, details: "Not yet initialised" }
, polledTorrents = false
, diff = require('jsondiffpatch');
diff.config.objectHash = function(obj) { obj.id || JSON.stringify(obj); };

module.exports = function(app) {
	app.util.rt.getBase(function(err, data) {
		if (err) throw "Error getting rtorrent base download directory: "+err;
		else app.util.downloadDir = data;
	});
	setInterval(function(){
		app.util.rt.details(function(err,torrents) {
			if (err) pollerError = { error: true, details: err };
			else {
				pollerError = false;
				for ( var i = 0 ; i < torrents.length ; i++ ) {
					torrents[i].path = torrents[i].path.replace(app.util.downloadDir, '');
				}
				var changes = diff.diff(polledTorrents, torrents);
				if (typeof changes !== "undefined") app.util.torrentChanges(changes);
				polledTorrents = torrents;
			}
		});
	}, 500);
	app.get('/torrent/all', app.util.requiresLevel(0), function(req,res) {
		if (pollerError) res.send(pollerError);
		else res.send(polledTorrents);
	});

	app.post('/torrent/stopAll', app.util.requiresLevel(0), function(req,res) {
		app.util.rt.details(function(err,torrents) {
			var errors = [];
			for ( var i = 0 ; i < torrents.length ; i++ ) {
				app.util.rt.stop(torrents[i].hash, function(err) {
					if (err) errors.push(err);
				});
			}
			if (errors.length > 0) res.send({error:true, details: errors});
			else res.send({success: true});
		});
	});

	app.post('/startAll', app.util.requiresLevel(0), function(req,res) {
		app.util.rt.details(function(err,torrents) {
			var errors = [];
			for ( var i = 0 ; i < torrents.length ; i++ ) {
				app.util.rt.start(torrents[i].hash, function(err) {
					if (err) errors.push(err);
				});
			}
			if (errors.length > 0) res.send({error:true, details: errors});
			else res.send({success: true});
		});
	});

	app.get('/torrent/:action/:hash', app.util.requiresLevel(0), function(req,res) {
		app.util.rt[req.params.action](req.params.hash, function(err, data) {
			if (err) res.send({error: true, details: err});
			else res.send({data: data});
		});
	});

	app.post('/torrent/:action/:hash', app.util.requiresLevel(0), function(req,res) {
		app.util.rt[req.params.action](req.params.hash, function(err) {
			if (err) res.send({error: true, details: err});
			else res.send({success: true});
		});
	});
};
