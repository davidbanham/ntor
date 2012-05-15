angular.module('torrents', ['ngResource']).
	factory('Torrent', function($resource){
	return $resource('torrent/:action', {}, {
		query: {method: 'GET', params: {action: 'all'}, isArray: true}
		, stop: {method: 'POST', params: {action: 'stop', hash: hash}}
		, stopAll: {method: 'POST', params: {action: 'stopAll', hash: hash}}
		, start: {method: 'POST', params: {action: 'start', hash: hash}}
		, remove: {method: 'POST', params: {action: 'remove', hash: hash}}
		, path: {method: 'POST', params: {action: 'path', hash: hash}}
		, peers: {method: 'POST', params: {action: 'peers', hash: hash}}
		, files: {method: 'POST', params: {action: 'files', hash: hash}}
	});
});
