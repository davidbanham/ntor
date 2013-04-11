var fs = require('fs');
module.exports = function(app) {
	var users = app.util.users;
	var userService = app.util.userService;
	app.get('/queue', app.util.requiresLevel(0), function(req,res) {
		res.send(req.session.user.queue);
	});

	app.post('/queue/item', app.util.requiresLevel(0), function(req,res) {
		if ( typeof req.session.user.queue === 'undefined' ) req.session.user.queue = [];
		var existingQueue = req.session.user.queue;
		for (var i = 0 ; i < existingQueue.length ; i++) {
			if (existingQueue[i].path === req.body.path) return res.send('duplicate');
		}
		if (req.body.path === '') res.send(400, 'path blank');
		fs.exists(app.util.downloadDir+'/'+req.body.path, function(exists) {
			if (typeof req.body.name === 'undefined') {
				var parts = req.body.path.split('/');
				req.body.name = parts[parts.length - 1];
			}
			if (typeof req.body.size === 'undefined') {
				req.body.size = fs.statSync(app.util.downloadDir+'/'+req.body.path).size;
			}
			var item = {
				path: req.body.path
				, added: new Date().toISOString()
				, claimed: false
				, name: req.body.name
				, size: req.body.size
				, downloaded: 0
			};
			if ( exists ) {
				req.session.user.queue.push(item);
				userService.store(req.session.user, function(err) {
					if (err) return res.send(500, {status: "fail"});
					res.send({status: 'success'});
				});
			} else {
				res.send(400, 'path does not exist');
			}
		});
	});

	app.post('/queue/item/claim', app.util.requiresLevel(0), function(req,res) {
		var queue = req.session.user.queue;
		var found, conflict = false;
		if ( typeof queue === 'undefined' ) return res.send('queue undef');
		if ( queue.length === 0 ) return res.send('length 0');
		for (var i = 0 ; i < queue.length ; i++) {
			if ( queue[i].path === req.body.path ) {
				found = queue[i];
				if ( found.claimed === req.body.claimed ) conflict = true;
				found.claimed = req.body.claimed;
				break;
			}
		}
		if ( !found ) return res.send('item not found');
		if ( conflict === true) return res.send(409, found);
		res.send(found);
	});

	app.get('/clearQueue', app.util.requiresLevel(0), function(req,res) {
		req.session.user.queue = [];
		userService.store(req.session.user, function(err) {
			if (err) return res.send(500, {status: "fail"});
			res.send({status: 'success'});
		});
	});

	app.post('/queue/remove', app.util.requiresLevel(0), function(req,res) {
		var queue = req.session.user.queue;
		if ( typeof queue === 'undefined' ) return res.send(400, {status: 'error', message: 'queue undef'});
		if ( queue.length === 0 ) return res.send(400, {status: 'error', message: 'Nothing in the queue'});
		var pos = -1;
		for ( var i = 0 ; i < queue.length ; i++ ) {
			if (queue[i].path == req.body.path) {
				pos = i;
				break;
			}
		}
		if ( pos < 0 ) return res.send(400, {status: 'error', message: 'item not found'});
		queue.splice(pos, 1);
		userService.store(req.session.user, function(err) {
			if (err) return res.send(500, {status: "fail"});
			app.util.io.sockets.in(req.session.user.email).emit('queueItem', {action: 'delete', path: req.body.path});
			res.send({status: 'success'});
		});
	});

	app.get('/queue/item', app.util.requiresLevel(0), function(req,res) {
		if(typeof req.session.user.queue === 'undefined') return res.send('');
		if(typeof req.session.user.queue[0] === 'undefined') return res.send('');
		res.send(req.session.user.queue[0]);
	});

	app.get('/queue/item/path', app.util.requiresLevel(0), function(req,res) {
		if(typeof req.session.user.queue === 'undefined') return res.send('');
		if(typeof req.session.user.queue[0] === 'undefined') return res.send('');
		res.send(req.session.user.queue[0].path);
	});
};
