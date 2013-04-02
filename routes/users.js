var fs = require('fs');
module.exports = function(app) {
	var  users = app.util.users;
	app.post('/user', app.util.requiresLevel(50), function(req,res) {
		var pass = app.util.hashPass(req.body.password);
		users[req.body.email] = { pass: pass, level: req.body.level };
		fs.writeFileSync('data/users.json', JSON.stringify(users));
		res.send({status: 'success'});
	});

	app.del('/user', app.util.requiresLevel(50), function(req,res) {
		delete users[req.query.email];
		fs.writeFileSync('data/users.json', JSON.stringify(users));
		res.send({status: 'success'});
	});

	app.get('/user', app.util.requiresLevel(50), function(req,res) {
		var userList = [];
		for ( var x in users ) {
			userList.push({email: x, level: users[x].level});
		}
		res.send(JSON.stringify(userList));
	});
};
