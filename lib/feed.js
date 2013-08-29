var levelup = require('levelup');
var path = require('path');
var db = levelup(path.join(__dirname, '../data/feeds'));
module.exports = {
	get: function(key, cb) {
		db.get(name, function(err, value) {
			cb(err, JSON.parse(value));
		});
	}
	, store: function(feed, cb) {
		db.put(feed.yes, JSON.stringify(feed), cb);
	}
	, del: function(key, cb) {
		db.del(key, cb);
	}
	, keys: function(cb) {
		keys = [];
		db.createKeyStream()
		.on('data', function(data) {
			keys.push(data)
		}).on('end', function() {
			cb(null, keys);
		})
	}
	, all: function(cb) {
		var res = {};
		db.createReadStream()
		.on('data', function(data) {
			res[data.key] = JSON.parse(data.value)
		}).on('end', function() {
			cb(null, res);
		})
	}
};
