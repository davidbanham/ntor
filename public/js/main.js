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
				console.log(target);
				console.log($(this).siblings());
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
		if (d.error) alert(d.error);
		else for ( var i = 0 ; i < d.length ; i++ ) {
			if (d[i].active === 1) var contextButton = '<button class="btn btn-mini btn-primary stopButton">Stop</button>';
			else var contextButton = '<button class="btn btn-mini btn-success startButton">Start</button>';
			if (d[i].complete === 1) var status = 'Complete';
			else var status = ((d[i].totalDown / d[i].size) * 100).toFixed(2) + '%';
			var buttons = '<div class="btn-group">'+contextButton+'<button class="btn btn-mini btn-danger removeButton">Remove</button></div>'
			torrents.fnAddData([
												 buttons
												 , status
												 , d[i].name
												 , d[i].hash
												 , d[i].created
			]);
		}
	});
};

var torrentsClickHandlers = function() {
	$(".stopButton").unbind('click.stopHandler');
	$(".stopButton").bind("click.stopHandler", function(e){
		var thisHash = getHash(this);
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
		var thisHash = getHash(this);
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
		var thisHash = getHash(this);
		$.ajax({
			type: 'post'
			, url: 'remove'
			, data:{ hash: thisHash }
		}).done(function(data) {
			fetchData();
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

var tagModal = function(options) {
	$('#tagDownload').unbind('click.tagSubmitHandler');
	$('#tagDownload').bind('click.tagSubmitHandler', function(e){
		if ($('#downloadNewTag').val() !== '' ) options.tag = $('#downloadNewTag').val();
		else options.tag = $('#downloadTag').val();
		console.log(options);
		loading(true);
		$.ajax({
			type: 'post'
			, url: 'download'
			, data: options
		}).done(function(data){
			console.log('download req returned');
			if(data.error) return alert(JSON.stringify(data.error));
			else {
				$('#tagModal').modal('hide');
				loading(false);
			};
		});
	});
	$('#tagModal').modal();
};

var getHash = function(node) {
	var td = $(node).closest('td');
	return($(td).siblings('.torHash')[0].innerHTML);
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
