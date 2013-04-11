var levelup = require('levelup');
var userdb = levelup('./users');
var feeddb = levelup('./feeds');
var hitdb = levelup('./hits');
var tagdb = levelup('./tags');
var fs = require('fs');
var oldusers = JSON.parse(fs.readFileSync('./users.json').toString());
var oldfeeds = JSON.parse(fs.readFileSync('./feedTargets.json').toString());
var oldhits = JSON.parse(fs.readFileSync('./feedHits.json').toString());
var oldtags = JSON.parse(fs.readFileSync('./tags.json').toString());
for (user in oldusers) {
	oldusers[user].email = user;
	userdb.put(user, JSON.stringify(oldusers[user]));
}
for (var i = 0 ; i < oldfeeds.length ; i++ ) {
	var feed = oldfeeds[i];
	feeddb.put(feed.yes, JSON.stringify(feed));
}
for (var i = 0 ; i < oldhits.length ; i++ ) {
	var hit = oldhits[i];
	hitdb.put(hit.url, JSON.stringify(hit));
};
for (var i = 0 ; i < oldtags.length ; i++ ) {
	var tag = oldtags[i];
	tagdb.put(tag.elements.join('/'), JSON.stringify(tag));
};
