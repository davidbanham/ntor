$(function() {
	torrents = $('#torrentList').dataTable({
		"sDom": "<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>",                  
		"aaSorting": [[ 1, "asc" ], [ 4, "desc" ]],
		"sPaginationType": "bootstrap",
		"bPaginate": false,
		"oLanguage": {
			"sLengthMenu": "_MENU_ records per page",
			"sSearch": "Filter:"
		},            
		"aoColumnDefs": [
			{ "bSortable": false, "aTargets": [0] }
			, { "bSortable": true, "aTargets": [1] }
			, { "bSortable": true, "aTargets": [2] }                
			, { "sClass": "hidden torHash", "aTargets": [3] }
			, { "sClass": "hidden creationDate", "aTargets": [4] }
			, { "sClass": "hidden serverPath", "aTargets": [5] }
		],
		"fnDrawCallback": function() {
			torrentsClickHandlers();
		}     
	});   
	searchResults = $('#searchResults').dataTable({
		"sDom": "<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>",                  
		"sPaginationType": "bootstrap",
		"bPaginate": false,
		"oLanguage": {
			"sLengthMenu": "_MENU_ records per page",
			"sSearch": "Filter:"
		},            
		"aoColumnDefs": [
			{ "bSortable": false, "aTargets": [0] }
			, { "sClass": "resultName", "bSortable": true, "aTargets": [1] }
			, { "sClass": "hidden resultUrl", "aTargets": [2] }
			, { "sClass": "hidden resultEngine", "aTargets": [3] }
		],
		"fnDrawCallback": function() {
			resultsClickHandlers();
		}     
	});
	auto = $('#autoList').dataTable({
		"sDom": "<'row-fluid'<'span6'l><'span6'f>r>t<'row-fluid'<'span6'i><'span6'p>>",                  
		"sPaginationType": "bootstrap",
		"bPaginate": false,
		"oLanguage": {
			"sLengthMenu": "_MENU_ records per page",
			"sSearch": "Filter:"
		},            
		"aoColumnDefs": [
			{ "bSortable": false, "aTargets": [0] }
			, { "sClass": "autoYes", "bSortable": true, "aTargets": [1] }
			, { "sClass": "autoNo", "bSortable": true, "aTargets": [2] }
			, { "sClass": "autoNotify", "bSortable": true, "aTargets": [3] }
			, { "sClass": "autoTag", "bSortable": true, "aTargets": [4] }
			, { "sClass": "autoLastHit", "bSortable": true, "aTargets": [5] }
			, { "sClass": "autoFrequency", "bSortable": true, "aTargets": [6] }
			, { "sClass": "hidden autoId", "aTargets": [7] }
		],
		"fnDrawCallback": function() {
			autoClickHandlers();
		}     
	});

	$('#searchForm').submit(function(e) {
		e.preventDefault();
		var options = {
			marker: false
			, engine: $(this).children('select').val()
			, expression: $(this).children('input').val()
		};
		doSearch(options);
	});
	$('.changePassSubmit').click(function(e){
		var curElement = this;
		e.preventDefault();
		$.ajax({
			type: 'post'
			, url: 'changePass'
			, data: { oldPassword: $(this).siblings('.oldPass').val(), newPassword: $(this).siblings('.newPass').val() }
		}).done(function(data) {
			$(curElement).closest('form').append('<div class="alert fade in">'+data+'</div>');
		}).error(function(error) {
			$(curElement).closest('form').append('<div class="alert fade in alert-error">'+error.responseText+'</div>');
		});
	});
	$('#grabAuto').click(function(e){
		var curElement = this;
		$.ajax({
			type: 'get'
			, url: 'feedTargets'
		}).done(function(data) {
			var buttons = '';
			var buttons = '<div class="btn-group"><button class="btn btn-mini btn-danger deleteFeedTarget">Remove</button></div>'
			auto.fnClearTable();
			for ( var i = 0 ; i < data.length ; i++ ) {
				var durationString = createDurationString(data[i].frequency);
				var lastHit = 'Never';
				console.log(data[i].notifyMe);
				var checked = '';
				if (data[i].notifyMe === true) checked = 'checked = true';
				var notifyCheckbox = '<input class="notifyCheckbox" type="checkbox" name="notifyMe" '+checked+'">';
				if (data[i].lastHit >= 5) {
					lastHit = new Date(data[i].lastHit).toDateString();
				};
				auto.fnAddData([
											 buttons
											 , data[i].yes
											 , data[i].no
											 , notifyCheckbox
											 , data[i].tag
											 , lastHit
											 , durationString
											 , data[i].id
				])
			}
			$('.deleteFeedTarget').click(function(e){
				var curElement = this;
				$.ajax({
					type: 'post'
					, url: 'deleteFeedTarget'
					, data: { targetId: $(this).parent().parent().siblings('.autoId').text() }
				}).done(function() {
					$('#grabAuto').click();
				});
			});
		}).error(function(error) {
			$('body').prepend('<div class="alert fade in alert-error">'+error.responseText+'</div>');
		});
	});
	$('.newFeedTarget').click(function(e){
		e.preventDefault();
		console.log($(this).siblings('.notify').is(':checked'));
		$.ajax({
			type: 'post'
			, url: 'newFeedTarget'
			, data: {
				yes: $(this).siblings('.yes').val()
				, no: $(this).siblings('.no').val()
				, notify: $(this).siblings('.notify').is(':checked')
				, tag: $(this).siblings('.tag').val()
				, frequency: $(this).siblings('.frequency').val() * 24 * 60 * 60 * 1000
			}
		}).done(function() {
			$('#grabAuto').click();
		});
	});
	$('.addUserSubmit').click(function(e){
		var curElement = this;
		e.preventDefault();
		$.ajax({
			type: 'post'
			, url: 'addUser'
			, data: { email: $(this).siblings('.email').val(), password: $(this).siblings('.password').val(), level: $(this).siblings('.level').val() }
		}).done(function(data) {
			$(curElement).closest('form').append('<div class="alert fade in">'+data+'</div>');
		}).error(function(error) {
			$(curElement).closest('form').append('<div class="alert fade in alert-error">'+error.responseText+'</div>');
		});
	});
	$('.newTagSubmit').click(function(e){
		var curElement = this;
		e.preventDefault();
		$.ajax({
			type: 'post'
			, url: 'newTag'
			, data: { tag: $(this).siblings('.newTag').val() }
		}).done(function(data) {
			fetchTags();
			$(curElement).closest('form').append('<div class="alert alert-success fade in"><button class="close" data-dismiss="alert">x</button>Tag Added</div>');
		});
	});
	$('.tagRemove').click(function(e){
		var curElement = this;
		var targetElement = $(this).siblings('.tagSelector option:selected')
		var targetTag = targetElement.val();
		targetElement.remove();
		e.preventDefault();
		$.ajax({
			type: 'post'
			, url: 'removeTag'
			, data: { target: targetTag }
		}).done(function(data) {
			fetchTags();
			$(curElement).closest('form').append('<div class="alert alert-success fade in"><button class="close" data-dismiss="alert">x</button>Tag Removed</div>');
		});
	});
	$('.manageTags').click(function(e){
		e.preventDefault();
		$('#tagManager').modal();
	});
	$('.changePass').click(function(e){
		e.preventDefault();
		$('#changePass').modal();
	});
	$('.manageUsers').click(function(e){
		e.preventDefault();
		$('#manageUsers').modal();
		$.ajax({
			type: 'get'
			, url: 'listUsers'
		}).done(function(data) {
			var users = JSON.parse(data);
			var userTable = $('#userTable')
			var delButton = '<button class="delUser btn">Delete</button>';
			$("#userTable tr").remove();
			for ( var i = 0 ; i < users.length ; i++ ) {
				var str = '<tr><td class="userName">'+users[i].email+'</td><td>'+users[i].level+'</td><td>'+delButton+'</td></tr>'
				userTable.append(str);
			};
			$('.delUser').click(function(e){
				var sibs = $(this).parent().siblings();
				var target = $(this).parent().siblings('.userName').text();
				$.ajax({
					type: 'post'
					, url: 'delUser'
					, data: {email: target}
				}).done(function(data) {
					$('#userTable').prepend('<div class="alert fade in">User deleted</div>');
				});
			});
		}).error(function(data) {
			var userTable = $('#userTable')
			userTable.append('<tr>Unauthorised</tr>');
		});
	});
	fetchDiskInfo();
	fetchData();
	fetchTags();
	// This is a pretty gross way do to this but with dataTables it just works way better than it has any right to.
	var poll = setInterval(fetchData, 5 * 1000);
	var pollDisks = setInterval(fetchDiskInfo, 30 *	1000);
});

var fetchDiskInfo = function() {
	$.ajax({
		type: 'get'
		, url: 'freeDiskSpace'
	}).done(function(data) {
		$('.diskInfo').empty();
		$('.diskInfo').append('<li><a>Free space:</a></li>');
		for ( var i = 0 ; i < data.length ; i++ ) {
			$('.diskInfo').append('<li><a>'+data[i]+'</a></li>');
		};
	});
}

var fetchData = function(){
	$.get('/torrents', function(d) {
		torrents.fnClearTable();
		if (d.error) {
			console.log('Error polling rtorrent on server');
			torrents.fnAddData(['','Error polling rtorrent on server','','','','']);
		}
		else for ( var i = 0 ; i < d.length ; i++ ) {
			// We use badequals for a reason. Some versions of rtorrent return integers, some strings. I don't know why.
			if (d[i].active == 1) var contextButton = '<button class="btn btn-mini btn-primary stopButton">Stop</button>';
			else var contextButton = '<button class="btn btn-mini btn-info startButton">Start</button>';
			var pathSplit = d[i].path.split('.');
			var extension = pathSplit[pathSplit.length - 1];
			if (extension === 'mp4') var streamButton = '<button class="btn btn-mini btn-success streamButton">Stream</button>';
			else if (extension.length === 3) var streamButton = '<button class="btn btn-mini btn-success downloadFileButton">Download</button>';
			else var streamButton = '<button class="btn btn-mini btn-success exploreButton">Explore</button>';
			if (d[i].complete == 1) var status = 'Complete';
			else var status = ((d[i].totalDown / d[i].size) * 100).toFixed(2) + '%';
			var buttons = '<div class="btn-group">'+streamButton+contextButton+'<button class="btn btn-mini btn-danger removeButton">Remove</button><button class="btn btn-mini btn-info addToQueue">Queue</button></div>'
			torrents.fnAddData([
												 buttons
												 , status
												 , d[i].name
												 , d[i].hash
												 , d[i].created
												 , d[i].path
			]);
		}
	});
};

var torrentsClickHandlers = function() {
	$(".streamButton").unbind("click.streamHandler");
	$(".streamButton").bind("click.streamHandler", function(e){
		var thisPath = getAttr(this, '.serverPath');
		window.location = '/streamFile/?path='+thisPath;
	});
	$(".downloadFileButton").unbind("click.downloadFileHandler");
	$(".downloadFileButton").bind("click.downloadFileHandler", function(e){
		var thisPath = getAttr(this, '.serverPath');
		window.open('/incoming'+thisPath), '_blank';
	});
	$(".exploreButton").unbind("click.exploreHandler");
	$(".exploreButton").bind("click.exploreHandler", function(e){
		var thisPath = getAttr(this, '.serverPath');
		window.open('/incoming'+thisPath), '_blank';
	});
	$(".stopButton").unbind("click.stopHandler");
	$(".stopButton").bind("click.stopHandler", function(e){
		var thisHash = getAttr(this, '.torHash');
		$.ajax({
			type: 'post'
			, url: 'stop'
			, data:{ hash: thisHash }
		}).done(function(data) {
			fetchData();
		});
	});
	$(".startButton").unbind('click.startHandler');
	$(".startButton").bind("click.startHandler", function(e){
		var thisHash = getAttr(this, '.torHash');
		$.ajax({
			type: 'post'
			, url: 'start'
			, data:{ hash: thisHash }
		}).done(function(data) {
			fetchData();
		});
	});
	$(".removeButton").unbind('click.removeHandler');
	$(".removeButton").on("click.removeHandler", function(e){
		var thisHash = getAttr(this, '.torHash');
		$.ajax({
			type: 'post'
			, url: 'remove'
			, data:{ hash: thisHash }
		}).done(function(data) {
			fetchData();
		});
	});
	$(".addToQueue").unbind('click.queueHandler');
	$(".addToQueue").on("click.queueHandler", function(e){
		var thisPath = getAttr(this, '.serverPath');
		$.ajax({
			type: 'post'
			, url: 'addToQueue'
			, data:{ path: thisPath }
		}).done(function(data) {
			alert(data);
		});
	});
};

var resultsClickHandlers = function(){
	$(".downloadButton").unbind('click.downloadHandler');
	$(".downloadButton").bind('click.downloadHandler', function(e){
		var options = {
			url: $(this).closest('td').siblings('.resultUrl')[0].innerHTML
			, engine: $(this).closest('td').siblings('.resultEngine')[0].innerHTML
			, name: $(this).closest('td').siblings('.resultName')[0].innerHTML
		};
		tagModal(options);
	});
	$('.pagLink').unbind('click.paginationHandler');
	$('.pagLink').bind('click.paginationHandler', function(e){
		e.preventDefault()
		var options = $(this).data('pagination');
		doSearch(options);
	});
};

var autoClickHandlers = function(){
	$('.notifyCheckbox').unbind('click.notifyHandler');
	$('.notifyCheckbox').bind('click.notifyHandler', function() {
		if (this.checked) var endpoint = 'addNotificationTarget';
		else var endpoint = 'removeNotificationTarget';
		$.ajax({
			type: 'post'
			, url: endpoint
			, data: { targetId: $(this).parent().siblings('.autoId').text() }
		}).done(function(){
			$('#grabAuto').click();
		})
	});
};

var tagModal = function(options) {
	$('#tagDownload').unbind('click.tagSubmitHandler');
	$('#tagDownload').bind('click.tagSubmitHandler', function(e){
		if ($('#downloadNewTag').val() !== '' ) options.tag = $('#downloadNewTag').val();
		else options.tag = $('#downloadTag').val();
		loading(true);
		$.ajax({
			type: 'post'
			, url: 'download'
			, data: options
		}).done(function(data){
			if(data.error) return alert(JSON.stringify(data.error));
			else {
				$('#tagModal').modal('hide');
				loading(false);
			};
		});
	});
	$('#tagModal').modal();
};

var getAttr = function(node, className) {
	var td = $(node).closest('td');
	return($(td).siblings(className)[0].innerHTML);
};

var fetchTags = function() {
	$.ajax({
		type: 'get'
		, url: 'tags'
	}).done(function(data) {
		$('.tagSelector').empty();
		for ( var i = 0 ; i < data.length ; i++ ) {
			$('.tagSelector').append('<option>'+data[i]+'</option>')
		}
	});
};

var loading = function(state){
	if (state) $('#loadingModal').modal();
	else $('#loadingModal').modal('hide');
};

var doSearch = function(options) {
	loading(true);
	$.ajax({
		type: 'get'
		, url: 'search'
		, data: options
	}).done(function(data) {
		searchResults.fnClearTable();
		if(data.error) return alert(JSON.stringify(data.error));
		$('.pagContainer').remove();
		var pagString = '<div class="span6 pagContainer"></div>';
		$('.searchResultsContainer').append(pagString);
		if (data.pagination.prev !== false && typeof data.pagination.prev !== 'undefined') {
			$('.pagContainer').append('<a class="pagLink pagPrev">Prev</a>');
			$('.pagPrev').data('pagination', {
				marker: data.pagination.prev
				, engine: data.engine
				, expression: data.expression
			});
		}
		if (data.pagination.next !== false && typeof data.pagination.next !== 'undefined') {
			$('.pagContainer').append('<a class="pagLink pagNext">Next</a>');
			$('.pagNext').data('pagination', {
				marker: data.pagination.next
				, engine: data.engine
				, expression: data.expression
			});
		}
		var buttons = '<div class="btn-group"><button class="btn btn-primary downloadButton">Download</button></div>'
		for ( var i in data.results ) {
			var item = data.results[i];
			searchResults.fnAddData([
															buttons
															, item.name
															, item.url
															, data.engine
			])
		}
		loading(false);
	});
};

var createDurationString = function(ms) {
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
