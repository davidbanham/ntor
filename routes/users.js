var fs = require('fs');
module.exports = function(app) {
	var userService = app.util.userService;
	app.post('/user', app.util.requiresLevel(50), function(req,res) {
		var pass = app.util.hashPass(req.body.password);
		user = { pass: pass, level: req.body.level };
		userService.store(user, function(err) {
			if (err) return res.send(500, {status:"fail"});
			res.send({status: 'success'});
		});
	});

	app.del('/user', app.util.requiresLevel(50), function(req,res) {
		delete users[req.query.email];
		userService.del(req.query.email, function(err) {
			if (err) return res.send(500, {status:"fail"});
			res.send({status: 'success'});
		});
	});

	app.get('/user', app.util.requiresLevel(50), function(req,res) {
		var userList = [];
		var users = userService.all(function(err, users) {
			for ( var x in users ) {
				userList.push({email: x, level: users[x].level});
			}
			res.send(JSON.stringify(userList));
		});
	});
};
