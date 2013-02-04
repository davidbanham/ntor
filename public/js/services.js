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
	return $resource('torrent/:action/:hash', {action: '@action', hash: '@hash'}, {
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
	});
});
angular.module('stringSimilarity', []).
	service('stringSimilarityService', function() {
	return {
		target: '',
		setTarget: function(target) {
			this.target = target;
		},
		getTarget: function() {
			return this.target;
		},
		calc: function lcs(string1, string2) {
			// init max value
			var longestCommonSubstring = 0;
			// init 2D array with 0
			var table = Array(string1.length);
			for(a = 0; a <= string1.length; a++){
				table[a] = Array(string2.length);
				for(b = 0; b <= string2.length; b++){
					table[a][b] = 0;
				}
			}
			// fill table
			for(var i = 0; i < string1.length; i++){
				for(var j = 0; j < string2.length; j++){
					if(string1[i]==string2[j]){
						if(table[i][j] == 0){
							table[i+1][j+1] = 1;
						} else {
							table[i+1][j+1] = table[i][j] + 1;
						}
						if(table[i+1][j+1] > longestCommonSubstring){
							longestCommonSubstring = table[i+1][j+1];
						}
					} else {
						table[i+1][j+1] = 0;
					}
				}
			}
			return longestCommonSubstring;
		}
	}
});
angular.module('tagService', ['ngResource', 'SharedServices']).
	factory('Tag', function($resource){
	return $resource('tag/:action/', {action: '@action'}, {
	})
})
angular.module('feedService', ['ngResource', 'SharedServices']).
	factory('Feed', function($resource){
	return $resource('feed/:action/:id', {action: '@action', id: '@id'}, {
	})
})
angular.module('userService', ['ngResource', 'SharedServices']).
	factory('User', function($resource){
	return $resource('user/', {}, {
	})
})
angular.module('socketService', []).
	factory('Socket', function($rootScope) {
		var Socket = io.connect();
		return{
			on: function(eventName, callback) {
				Socket.on(eventName, function(data) {
					var args = arguments;
					$rootScope.$apply(function() {
						callback.apply(Socket, args);
					});
				});
			}
		};
	});
