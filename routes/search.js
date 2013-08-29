var fs = require('fs');
var path = require('path');

var searchEngines = fs.readdirSync(path.join(__dirname, '../plugins/search'));

var searchWorkers = {};

for (var i = 0 ; i < searchEngines.length ; i++) {
	if (searchEngines[i] === '.blank') continue;
	if (searchEngines[i] === '.gitignore') continue;
	var searchEnginePath = '../plugins/search/'+searchEngines[i];
	searchWorkers[searchEngines[i]] = require(searchEnginePath);
}
module.exports = function(app) {
	app.get('/search/all', app.util.requiresLevel(0), function(req,res) {
		var engines = [];
		for ( var worker in searchWorkers ) {
			engines.push({name: worker});
		}
		res.send(engines);
	});

	app.get('/search/:engine', app.util.requiresLevel(0), function(req,res) {
		if (typeof req.query.marker === 'undefined') req.query.marker = false;
		try{
			searchWorkers[req.params.engine].search(req.query.expression, req.query.marker, function(error, results, pagination){
				if (error) return res.send({error: error});
				else res.send({
					results: results
					, pagination: pagination
					, engine: req.params.engine
					, expression: req.query.expression
				});
			});
		} catch(err) {
			console.error("Search worker error: ", err, req.query);
			res.send({error:"The search engine failed. It was: "+req.params.engine});
		}
	});

	app.post('/search/:engine', app.util.requiresLevel(0), function(req,res) {
		if (typeof req.body.tag == 'undefined') return res.send('Tag required', 400);
		var fileName = req.body.target;
		var relativePath = 'torrentBin/'+fileName+'.torrent';
		try{
			searchWorkers[req.params.engine].download(req.body.url, relativePath, function(error) {
				if (error) return res.send({error:error.toString()});
				var fullFilePath = app.util.basePath+relativePath;
				app.util.getInfoHash(fullFilePath, function(infoHash) {
					app.util.rt.upload(fullFilePath, function(error) {
						if (error) return res.send({error:error.toString()});
						var fullDownloadPath = app.util.downloadDir+'/'+req.body.tag.elements.join('/');
						app.util.createFullPath(fullDownloadPath, function() {
							if (error) return res.send({error:'Failed to create download directory'});
							app.util.rt.setPath(infoHash, fullDownloadPath, function(error, data) {
								app.util.rt.start(infoHash, function(error, data) {
									if (error) return res.send({error:error});
									res.send({success:true});
								});
							});
						});
					});
				});
			});
		} catch(err) {
			console.log("Search worker error: ", err);
			res.send({error:"The search engine failed. It was: "+req.params.engine});
		}
	});
};
