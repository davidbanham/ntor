function TorrentListCtrl($scope, Torrent, Socket) {
	$scope.sort = {
		column: 'created',
		descending: true
	};
	$scope.selectedCls = function(column) {
		return column == $scope.sort.column && 'sort-' + $scope.sort.descending;
	};

	$scope.changeSorting = function(column) {
		var sort = $scope.sort;
		if (sort.column == column) {
			sort.descending = !sort.descending;
		} else {
			sort.column = column;
			sort.descending = false;
		}
	};
	$scope.torrents = Torrent.query(function(torrents) {
		mungeTorrents(torrents);
	});
	var mungeTorrents = function(torrents){
		for(item in torrents) {
			torrent = torrents[item];
			if (torrent.complete == 1) torrent.statusText = "Complete";
			else torrent.statusText = ((torrent.totalDown / torrent.size) * 100).toFixed(2) + '%';
			torrent.remoteButtons = [{type: "remove", method: "post", style: "btn-danger"}];
			if (torrent.active == 1) {
				torrent.remoteButtons.push({type: "stop", method: "post", style: "btn-primary"});
			} else {
				torrent.remoteButtons.push({type: "start", method: "post", style: "btn-info"});
			}
			if (torrent.complete === '1') {
				//torrent.remoteButtons.push({type: "queue", method: "post", style: "btn-info"});
			}
			torrent.localButtons = [];
			var pathSplit = torrent.path.split('.');
			var extension = pathSplit[pathSplit.length - 1]; 
			if (extension === 'mp4') torrent.localButtons.push({type: "stream", style: "btn-success"});
			else if (extension.length === 3) torrent.localButtons.push({type: "download", style: "btn-success"});
			else torrent.localButtons.push({text: "Download", type: "pack", style: "btn-success"}, {type: "explore", style: ""});
		};
		$scope.torrents = torrents;
	}
	Socket.on('torrentChange', function (data) {
		//deepMerge($scope.torrents, data);
		mungeTorrents(data);
	});
	$scope.remote = function(button, torrent) {
		Torrent[button.method]({action: button.type, hash: torrent.hash}, function(res) {
			if (res.error) console.error(res.error, res);
		});
	};
	$scope.local = function(button, torrent) {
		switch(button.type){
			case 'stream':
				window.location = '/streamFile/?path='+encodeURIComponent(torrent.path);
				break;
			case 'download':
				window.open('/incoming'+encodeURIComponent(torrent.path), '_blank');
				break;
			case 'explore':
				window.open('/incoming'+encodeURIComponent(torrent.path), '_blank');
				break;
			case 'pack':
				window.open('/tar?path='+encodeURIComponent(torrent.path), '_blank');
				break;
		}
	};
}
function DiskSpaceCtrl($scope, Socket) {
	Socket.on('diskSpace', function(data) {
		$scope.diskSpace = data;
	});
}
function FeedCtrl($scope, Feed, Tag) {
	$scope.feedTargets = Feed.query({action: 'target'});
	$scope.tags = Tag.query({action: 'all'});
	$scope.changeNotification = function(target) {
		console.log(target.notifyMe);
	}
	$scope.addTarget = function(newTarget) {
		newTarget.frequency = parseInt(newTarget.frequency) * 24 * 60 * 60 * 1000;
		Feed.save({action: 'target'}, newTarget, function(res) {
			$scope.feedTargets = Feed.query({action: 'target'});
		});
	}
	$scope.removeTarget = function(target) {
		Feed.remove({action: 'target', id: target.id}, function(res) {
			$scope.feedTargets = Feed.query({action: 'target'});
		});
	};
	$scope.toDate = function(ms) {
		if (ms < 5) return "Never";
		return new Date(ms).toDateString();
	};
	$scope.createDurationString = function(ms) {
		var x = ms / 1000
		seconds = x % 60
		x /= 60
		minutes = x % 60
		x /= 60
		hours = x % 24
		x /= 24
		days = x
		return days+' days, '+hours+' hours, '+minutes+' minutes, '+seconds+' seconds'
	};
}
function UtilityCtrl($scope, $dialog, Tag) {
	$scope.openChangePassword = function() {
		var opts = {
			templateUrl: 'partial/changePassword'
			, controller: 'ChangePasswordCtrl'
		}
		$dialog.dialog(opts).open()
	}
	$scope.openTagManager = function() {
		var opts = {
			backdrop: true
			, keyboard: true
			, backdropClick: true
			, modalFade: true
			, templateUrl: 'partial/tagModal'
			, controller: 'TagCtrl'
		};
		var d = $dialog.dialog(opts)
		d.open()
	};
};
function TagCtrl($scope, dialog, Tag){
	$scope.tags = Tag.query({action: 'all'});
	$scope.removeTag = function(tag) {
		Tag.save({action: 'remove', tag: tag}, function(res) {
			console.log(res);
			$scope.tags = Tag.query({action: 'all'});
		});
	};
	$scope.addTag = function(tag) {
		Tag.save({action: 'add', tag: tag}, function(res) {
			console.log(res);
			$scope.tags = Tag.query({action: 'all'});
		});
	};
	$scope.close = function(tag) {
		dialog.close(tag);
	};
};
function ChangePasswordCtrl($scope, $http, dialog) {
	$scope.close = function() {
		dialog.close();
	};
	$scope.changePass = function() {
		$http.post('/changePass', {oldPassword: $scope.oldPassword, newPassword: $scope.newPassword})
		.success(
			function(data) {
				$scope.status = data;
			}
		).error(
			function(data) {
				$scope.status = data;
			}
		);
	}
}
function SearchCtrl($scope, $dialog, Search, Tag) {
	$scope.search = function(engine, expression, marker) {
		Search.search({engine: engine, marker: marker, expression: expression}, function(res) {
			$scope.results = res.results;
			$scope.pagination = res.pagination;
		});
	}
	$scope.chooseTag = function(result) {
		var opts = {
			backdrop: true
			, keyboard: true
			, backdropClick: true
			, modalFade: true
			, templateUrl: 'partial/tagModal'
			, controller: 'TagCtrl'
		};
		var d = $dialog.dialog(opts)
		d.open().then(function(tag){
			Search.save({engine: $scope.engine}, {target: result.name, url: result.url, tag: tag, }, function(res) {
				console.log(res);
			});
		});
	}
};
  deepMerge = function(dst, src) {
    var dstv, k, srcv, _results;
    _results = [];
    for (k in src) {
      srcv = src[k];
      dstv = dst[k];
      if (typeof dstv === 'object' && typeof srcv === 'object') {
        if ((dstv instanceof Array) && (srcv instanceof Array) && dstv.length === srcv.length) {
          _results.push(deepMerge(dstv, srcv));
        } else if ((!dstv instanceof Array) && (!srcv instanceof Array)) {
          _results.push(deepMerge(dstv, srcv));
        } else {
          _results.push(dst[k] = srcv);
        }
      } else {
        _results.push(dst[k] = srcv);
      }
    }
    return _results;
  };
