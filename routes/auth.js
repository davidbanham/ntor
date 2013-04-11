var fs = require('fs')
, cookie = require('cookie');
module.exports = function(app) {
	var userService = app.util.userService
	, hashPass = app.util.hashPass;
	app.get('/checkAuth', function(req,res) {
		if (req.session.user) res.send(200, {sid: cookie.parse(req.headers.cookie)['ntor.sid'], email: req.session.user.email});
		else res.send(403);
	});
	
	app.get('/login', function(req,res) {
		res.render('login');
	});
	
	app.post('/login', function(req,res) {
		app.util.authenticate(req.body.username, req.body.password, function(user) {
			if (user) {
				req.session.user = user;
				req.session.user.email = req.body.username;
				res.redirect('/');
			} else {
				res.send('fail', 403);
			}
		});
	});
	
	app.get('/logout', function(req,res) {
		req.session.destroy();
		res.redirect('/login');
	});

	app.post('/changePass', app.util.requiresLevel(0), function(req,res) {
		var pass = hashPass(req.body.oldPassword);
		if ( pass !== req.session.user.pass ) return res.send('Old password was wrong', 403);
		pass = hashPass(req.body.newPassword);
		req.session.user.pass = pass;
		userService.store(req.session.user, function(err) {
			if (err) return res.send(500, {status: 'fail'});
			res.send({status: 'success'});
		});
	});

};
