angular.module('SharedServices', [])
    .config(function ($httpProvider) {
        $httpProvider.responseInterceptors.push('loadSpinner');
        var spinnerFunction = function (data, headersGetter) {
            // todo start the spinner here
            $('#loading').show();
            return data;
        };
        $httpProvider.defaults.transformRequest.push(spinnerFunction);
    })
    .factory('loadSpinner', function ($q, $window) {
        return function (promise) {
            return promise.then(function (response) {
                $('#loading').hide();
                return response;
            }, function (response) {
                $('#loading').hide();
                return $q.reject(response);
            });
        };
    })
angular.module('torrentsService', ['ngResource', 'SharedServices']).
	factory('Torrent', function($resource){
	return $resource('torrent/:action/:hash', {action: "@action", hash: "@hash"}, {
		query: {method: 'GET', params: {action: 'all'}, isArray: true}
		, action: {method: 'POST'}
		, post: {method: 'POST'}
		, get: {method: 'GET'}
	});
});

angular.module('searchService', ['ngResource', 'SharedServices']).
	factory('Search', function($resource){
	return $resource('search/:engine', {engine: "@engine"}, {
		search: {method: 'GET'}
		, download: {method: 'POST'}
	});
});

angular.module('tagService', ['ngResource', 'SharedServices']).
	factory('Tag', function($resource){
	return $resource('tag/:action/', {action: "@action", tag: "@tag"}, {
	})
})
angular.module('socketService', []).
	factory('Socket', function($rootScope) {
		var Socket = io.connect();
		return{
			on: function(eventName, callback) {
				Socket.on(eventName, function(data) {
					console.log("data is ", data);
					var args = arguments;
					console.log ("args is", args);
					$rootScope.$apply(function() {
						callback.apply(Socket, args);
					});
				});
			}
		};
	});
