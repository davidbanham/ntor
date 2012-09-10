ntor
=====

ntor is a web based frontend for rtorrent.

Why bother?
=====

1. It's super simple to use.
2. It's social. Let your friends use it and discover the content everyone else is interested in.
3. It's really easy to write search and rss feed plugins for new sites.
4. It works great on mobile devices thanks to Twitter Bootstrap.
5. It has sweet integration with home theatre devices like the WD TV and XBMC.

You'll need:
=====

1. A linux based server.
2. rtorrent
3. nginx (or Apache or something else if you like)

Installation:
=====

Clone this repository.

Run npm install

Get rtorrent installed on your machine. Make sure it's compiled with XMLRPC support. Most packages seem to be compiled with it by default these days, so you're probably fine. Information is here: http://libtorrent.rakshasa.no/wiki/RTorrentXMLRPCGuide

Set up your web server. Instructions for nginx are as follows. If you're using something else you're on your own, but it's not hard.

Install nginx. ( sudo apt-get install nginx ) or similar

Include conf/ntor.nginx in your configuration. On Ubuntu, just place the file in /etc/nginx/sites-enabled

Edit the redirect in conf/ntor.nginx from ntor.example.com to whatever your domain is.

Create a htpasswd file to protect your rtorrent SCGI port. On Ubuntu:
	htpasswd -c -d /etc/nginx/htpasswd rtorrent
Then enter the password when prompted.

Copy conf/example.conf.js to conf/conf.js

Edit conf/conf.js and fill in the fields. You'll need to at least complete extDomain, cookieSecret and rtorrent.pass. extDomain is the domain name you will access ntor from, cookieSecret is any random string you like, rtorrent.pass is the password you entered earlier for htpasswd. Also, fill out the mail section with the details of whatever email account you want notification emails sent from.

Log in with the username admin@example.com and the password admin. Set up a new user and delete this one immediately. Users of level 100 are full administrators, level 0 are standard users. The only thing standard users are prevented from doing is managing other users.

Add some search and feed plugins. Just clone them into plugins/search and plugins/feeds and run npm install. There are two to get you started here:

https://github.com/davidbanham/ntor-search-linuxtracker

https://github.com/davidbanham/ntor-feeds-gameupdates

Download some torrents and invite some friends. Have fun! ntor is designed to get out of your way as much as possible. Poke around the interface and it should all make sense.

Goodies:
=====

Tags are intended to keep your files organised in subfolders. Give your files a tag hierarchy like movies/Casablanca or music/Radiohead/In Rainbows

To get your content onto XBMC just add a network location with the protocol "Web server directory (HTTPS)". Most fields are obvious, path is /apacheList/tagname/ you must enter a tag name (eg: movies) and you must include the trailing slash.

You can also clik the queue button next to items in the main table. This will add the directory to your queue of files to be downloaded. This is an API that lets a remote device (Say, a WD TV running WDLXTV) poll the server to see if there are any files it should be downloading, then do so. Streaming files directly from ntor is great, but sometimes files are too large to comfortably stream on a home connection. Queue the file to be downloaded and it will be waiting for you locally when you get home.o

The Auto tab polls the available feeds plugins and automatically downloads any files it matches to your search criteria, then notifies you. It will match anything that contains the string in the Yes column, but then discard it if it also matches the No column. It will only match once per n days, that you set. It will then download the file, applying the selected tags and notifying you via email if you so choose.

What next?
=====

ntor is designed to make it easy to add search workers for arbitrary trackers. I like interfaces like rutorrent, but was frustrated with how difficult it was to add new sites to the search. In ntor, each search engine or feed worker is implemented as a nodejs module. This means that whatever search your site uses, you can write an ntor plugin to handle it. Many sites don't expose a nice API, but node makes it easy to parse arbitrary HTML pages with jsdom and jquery. All kinds of authentication methods, cookies, etc can easily be handled with request. Take a look at the example plugins above to get started writing your own.

The main TODO is to redo the frontend code in something like Angular. At the moment it's a rats nest of event handlers.

Also, the routes in the app.js file could really use some logical organisation.
