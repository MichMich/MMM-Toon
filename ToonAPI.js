var http = require('http');
var https = require('https');
var querystring = require('querystring');
var extend = require('util')._extend;

var ToonAPI = (function() {

	var self = this;

	// Private Properties
	var HOST = 'api.toonapi.com';
	var API = '/toon/api/v1/';
	var PORT = 443;
	var APIKEY = null;
	var APISECRET = null;

	var username = null;
	var password = null;

	var accessToken = false;
	var agreementSet = false;
	var accessTokenExpireTimer = false;
	var status = {updated:false};

	/// Private Methods

	function makeRequest(options) {

		if (!APIKEY || !APISECRET) {
			console.error('You haven\'t supplied the application with the needed APIKEY or APISECRET credentials');
		    process.exit(1);
		}

		if (!username || !password) {
			console.error('You haven\'t supplied the application with the needed username and password credentials');
		    process.exit(1);
		}

		var defaultOptions = {
			host: HOST,
			port: PORT,
			path: '/',
			method: 'GET', // GET | POST
			parameters: {},
			body: '',
			callback: function(){},
			contentType: 'application/json',
			authorization: 'bearer', // bearer | basic
			rejectUnauthorized: false,
			requestCert: true,
			agent: false,
			headers: {
				'Authorization': 'Bearer ' + accessToken
			}
		};

		options = extend(defaultOptions, options);

		//console.log("Make request: " + options.path + " (" + options.method + ")");

		// Update Content-Type header
		options.headers  = extend(options.headers, {
			'Content-Type' : options.contentType
		});

		// Encode body if contentType is json.
		if (options.contentType === 'application/json') {
			options.body = JSON.stringify(options.body);
		}

		// Make changed to the request options headers if Authorization is basic.
		if (options.authorization === 'basic') {
			options.headers  = extend(options.headers, {
				'Authorization' : 'Basic ' + new Buffer(APIKEY + ":" + APISECRET).toString('base64')
			});
		}

		// Make changes to the request options headers if method is POST
		if (options.method === 'POST') {
			options.headers  = extend(options.headers, {
				'Content-Length': Buffer.byteLength(options.body),
			});
		}

		//console.log(options);

		var request = https.request(options, function(response) {
			response.setEncoding('utf8');

			var str = '';

			//another chunk of data has been recieved, so append it to `str`
			response.on('data', function (chunk) {
				str += chunk;
			});

			//the whole response has been recieved, so we just print it out here
			response.on('end', function () {
				if (response.statusCode === 200) {
					if (str.length > 0) {
						options.callback(JSON.parse(str));
					} else {
						options.callback({});
					}
				} else if (response.statusCode === 401) {
					// Unauthorized

					console.log("Error performing request: Unauthorized. Access Token will be reset.");

					// Lets cleanup the accessToken, since this might be the reason for the error.
					// A new accessToken will be requested on the next request.

					accessToken = false;

					options.callback();

				} else if (response.statusCode === 500) {
					// Interal server error. This might be caused because the agreement is not properly set.
					// Let's reset it ...
					console.log("Error performing request (500): " + str);
					agreementSet = false;

					options.callback();

				} else if (response.statusCode === 503) {
					// Probably a message throttle issue ... lets wait a while before we contine...
					console.log("Exceeded quota. Waiting for 5 seconds.");
					setTimeout(function() {
						options.callback();
					}, 5000);

				} else {
					console.log("Error performing request: " + response.statusCode);
					console.log(str);
					options.callback();
				}
			});

			response.on('error', function(e) {
				console.log("Error performing request to endpoint: /" + endpoint);
				options.callback();
			});
		});

		if (options.method === 'POST') {
			request.write(options.body);
		}

		request.end();

	}

	function makeApiRequest(options) {
		if (!accessToken) {
			console.log("No Access Token. Request one ...");
			requestAccessToken(function() {
				makeApiRequest(options);
			});
			return;
		}

		if (!agreementSet && options.path !== 'agreements') {
			console.log("Agreement not set. Set it ...");
			activateFirstAgreement(function() {
				makeApiRequest(options);
			});
			return;
		}

		//console.log("All good. Let's make a request ...");

		options = extend(options, {
				path: API + options.path
		});

		makeRequest(options);
	}

	function makeSimpleApiRequest(endpoint, callback) {
		callback = callback || function() {};
		makeApiRequest({
			path: endpoint,
			callback: callback
		});
	}

	function requestAccessToken(callback) {
		console.log("Request Access Token.");

		callback = callback || function(){};

		var postData = querystring.stringify({
			'username': username,
			'password': password,
			'grant_type': 'password'
		});

		makeRequest({
			path: '/token',
			method: 'POST',
			body: postData,
			authorization: 'basic',
			callback: function(response) {
				if (!response) {
					//request failed.
					callback();
					return;
				}

				clearTimeout(accessTokenExpireTimer);
				accessTokenExpireTimer = false;

				accessToken = response.access_token;

				//schedule an access token to be removed if expired.
				accessTokenExpireTimer = setTimeout(function() {
					console.log("Access token expired.");
					accessToken = false;
				}, response.expires_in * 1000);


				callback(response);
			},
			errorCallback: function() {
				console.log("Requesting Access Token failed.");
			},
			contentType: 'application/x-www-form-urlencoded'
		});
	}

	function activateFirstAgreement(callback) {
		self.getAgreements(function(agreements) {
			if (agreements && agreements.length > 0) {
				self.setAgreement(agreements[0].agreementId, callback);
			} else {
				// No agreements or request failed.
				console.log("Agreements request failed.");
				callback();
			}
		});
	}

	/// Public Methods

	// Username & Password
	self.setUsernamePassword = function(u, p) {
		username = u;
		password = p;
	};

	self.setApiKeySecret = function(k, s) {
		accessToken = false;
		APIKEY = k;
		APISECRET = s;
	};

	// Agreements

	self.getAgreements = function(callback) {
		makeSimpleApiRequest('agreements', callback);
	};

	self.setAgreement = function(agreementId, callback) {
		console.log('Set agreement:' + agreementId);
		makeApiRequest({
			path: 'agreements',
			method: 'POST',
			body: {agreementId: agreementId},
			callback: function() {
				console.log("Agreement set: " + agreementId);
				agreementSet = true;
				callback();
			}
		});
	};

	// Consumption

	self.getConsumptionElectricityFlows = function(callback) {
		makeSimpleApiRequest('consumption/electricity/flows', callback);
	};

	self.getConsumptionElectricityData = function(callback) {
		makeSimpleApiRequest('consumption/electricity/data', callback);
	};

	self.getConsumptionDistrictheatData = function(callback) {
		makeSimpleApiRequest('consumption/districtheat/data', callback);
	};

	self.getConsumptionGasFlows = function(callback) {
		makeSimpleApiRequest('consumption/gas/flows', callback);
	};

	self.getConsumptionGasData = function(callback) {
		makeSimpleApiRequest('consumption/gas/data', callback);
	};

	// Temperature

	self.getTemperatureStates = function(callback) {
		makeSimpleApiRequest('temperature/states', callback);
	};

	self.getTemperaturePrograms = function(callback) {
		makeSimpleApiRequest('temperature/programs', callback);
	};

	// Status

	self.getStatus = function(callback) {
		makeSimpleApiRequest('status', function(data) {
			if (!data) {
				console.log("Error while fetching new status.");
				callback(status);
				return;
			}

			if (Object.keys(data).length !== 0) {
				status = extend(status, data);
				status.updated = true;
			} else {
				status.updated = false;
			}

			callback(status);
		});
	};

	return self;
})();

module.exports = ToonAPI;
