var tagService = require('../lib/tag.js');
module.exports = function(app) {
	app.get('/tag/all', app.util.requiresLevel(0), function(req,res) {
		tagService.all(function(err, tags) {
			return res.send(tags);
		});
	});

	app.post('/tag/remove', app.util.requiresLevel(0), function(req,res) {
		tagService.del(req.body.tag, function(err) {
			if (err) return res.send(500);
			return res.send({success: true});
		});
	});

	app.post('/tag/add', app.util.requiresLevel(0), function(req,res) {
		tagService.store(req.body.tag, function(err) {
			if (err) return res.send(500);
			return res.send({success: true});
		});
	});

};
