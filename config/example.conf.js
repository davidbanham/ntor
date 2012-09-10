module.exports = {
	general: {
		// eg: extDomain: 'ntor.example.com'
		extDomain: 'ntor.example.com'
		, cookieSecret: 'supersecretpassword'
	}

	, rtorrent: {
		host: '127.0.0.1'
		, user: 'rtorrent'
		, pass: 'supersecretpassword'
		, path: '/RPC2'
		, port: 81
	}

	, mail: {
		enabled: true
		, username: 'ntor@example.com'
		, password: 'supersecretpassword'
		, from: 'ntor@example.com'
	}
};
