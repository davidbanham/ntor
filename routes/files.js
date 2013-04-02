var fs = require('fs')
, spawn = require('child_process').spawn
, mime = require('mime')
, path = require('path');

module.exports = function(app) {
	var fakeApache = function(req, res) {
		var incomingPath = './public/incoming/'+req.params[0];
		if (req.params[0][req.params[0].length - 4] === '.') return res.sendfile(incomingPath);
		fs.readdir(incomingPath, function(err, files) {
			if (err) return res.send(err, 500);
			var fileObjects = [];
			var fileSize;
			for ( var i = 0 ; i < files.length ; i++ ) {
				var mimeType = mime.lookup(incomingPath+files[i]);
				var fileStat = fs.statSync(incomingPath+'/'+files[i]);
				if ( fileStat.size === 4096 ) fileSize = '-';
				else fileSize = app.util.stupidApacheBytesToSize(fileStat.size, 1);
				var mimePrime = mimeType.split('/')[0];
				var iconType = '';
				var altTag = '';
				switch(mimePrime){
					case 'video':
						iconType = 'movie';
					altTag = '[VID]';
					break;
					case 'text':
						iconType = 'text';
					altTag = '[TXT]';
					break;
					case 'application':
						iconType = 'folder';
					altTag = '[DIR]';
					break;
					default:
						iconType = 'unknown';
					altTag = '[DIR]';
				}
				if (iconType === 'folder') files[i] = files[i]+'/';
				fileObjects[i] = {
					name: files[i]
					, mimeType: mimeType
					, iconType: iconType
					, altTag: altTag
					, fileSize: fileSize
				};
			}
			res.render('apache', {
				files: fileObjects
				, dirname: 'something'
			});
		});
	};

	app.get('/apacheList', app.util.requiresLevel(0), function(req,res) {
		fakeApache(req,res);
	});

	app.get('/apacheList/*', app.util.requiresLevel(0), function(req,res) {
		fakeApache(req,res);
	});

	app.get('/streamFile/', app.util.requiresLevel(0), function(req,res) {
		var incomingPath = '/incoming' + req.query.path;
		res.render('stream', {
			path: incomingPath
		});
	});
	app.get('/tar', app.util.requiresLevel(0), function(req,res) {
		// Options -r recursive -c stream tp stdout
		var tar = spawn('tar', ['-c', './'+req.query.path], {cwd:app.util.basePath+'public/incoming'});

		res.contentType('tar');
		var fileName = path.basename(req.query.path);
		res.setHeader('Content-Disposition', 'attachment; filename='+fileName+'.tar');

		// Keep writing stdout to res
		tar.stdout.pipe(res,{ end: false });

		tar.stderr.on('data', function (data) {
			// Uncomment to see the files being added
			//console.log('tar stderr: ' + data);
		});

		// End the response on tar exit
		tar.on('exit', function (code) {
			if(code !== 0) {
				res.statusCode = 500;
				console.log('tar process exited with code ' + code);
				res.end();
			} else {
				res.end();
			}
		});

		// End the tar on request exit
		res.on('close', function() {
			tar.kill();
		});
	});

	app.get('/freeDiskSpace', app.util.requiresLevel(0), function(req,res) {
		app.util.diskSpace(function(space) {
			res.send(space);
		});
	});
};
