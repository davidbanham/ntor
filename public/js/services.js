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
angular.module('levenshtein', []).
	service('levenshteinDistanceService', function() {
	return {
		target: '',
		setTarget: function(target) {
			this.target = target;
		},
		getTarget: function() {
			return this.target;
		},
		calc: function(a, b){
			if(a.length == 0) return b.length; 
			if(b.length == 0) return a.length; 

			var matrix = [];

			// increment along the first column of each row
			var i;
			for(i = 0; i <= b.length; i++){
				matrix[i] = [i];
			}

			// increment each column in the first row
			var j;
			for(j = 0; j <= a.length; j++){
				matrix[0][j] = j;
			}

			// Fill in the rest of the matrix
			for(i = 1; i <= b.length; i++){
				for(j = 1; j <= a.length; j++){
					if(b.charAt(i-1) == a.charAt(j-1)){
						matrix[i][j] = matrix[i-1][j-1];
					} else {
						matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
													 Math.min(matrix[i][j-1] + 1, // insertion
													 matrix[i-1][j] + 1)); // deletion
					}
				}
			}

			return matrix[b.length][a.length];
		}
	}
});
angular.module('tagService', ['ngResource', 'SharedServices']).
	factory('Tag', function($resource){
	return $resource('tag/:action/', {}, {
	})
})
angular.module('feedService', ['ngResource', 'SharedServices']).
	factory('Feed', function($resource){
	return $resource('feed/:action/:id', {}, {
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
