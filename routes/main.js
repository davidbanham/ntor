module.exports = function(app) {
	app.get('/incoming/*', app.util.requiresLevel(0), function(req,res,next) {
		next();
	});

	app.get('/', app.util.requiresLevel(0), function(req,res) {
		res.render('index');
	});

	app.get('/partial/:name', app.util.requiresLevel(0), function(req,res) {
		console.log("trying to render partials/"+req.params.name);
		res.render('partials/'+req.params.name);
	});

};
