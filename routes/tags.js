var fs = require('fs');
module.exports = function(app) {
	app.get('/tag/all', app.util.requiresLevel(0), function(req,res) {
		res.send(app.util.tags);
	});

	app.post('/tag/remove', app.util.requiresLevel(0), function(req,res) {
		var pos = app.util.tags.indexOf(req.params.tag);
		app.util.tags.splice(pos, 1);
		res.send({success: true});
	});

	app.post('/tag/add', app.util.requiresLevel(0), function(req,res) {
		app.util.tags.push(req.body.tag);
		fs.writeFileSync('data/tags.json', JSON.stringify(app.util.tags));
		res.send({success: true});
	});

};
