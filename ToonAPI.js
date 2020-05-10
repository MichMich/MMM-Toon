let http = require('http');
let https = require('https');
let querystring = require('querystring');
let extend = require('util')._extend;

let ToonAPI = (function () {

    let self = this;

    // Private Properties
    let HOST = 'api.toon.eu';
    let API = '/toon/v3/';
    let PORT = 443;
    let APIKEY = null;
    let APISECRET = null;
    let ACCESSTOKEN = null;
    let X_COMMONNAME = null;
    let X_AGREEMENT_ID = null;

    let agreementSet = false;

    let status = {updated: false};

    /**
     * makeRequest
     * Makes a request to the Toon API server. It can be used for both the API requests as well as the oAuth requests.
     * @param  {Object} options request options.
     */
    /**
     * makeRequest
     * Makes a request to the Toon API server. It can be used for both the API requests as well as the oAuth requests.
     * @param  {Object} options request options.
     */
    function makeRequest(options) {

        if (!APIKEY || !APISECRET) {
            console.error('You haven\'t supplied the application with the needed APIKEY or APISECRET credentials');
            process.exit(1);
        }

        let defaultOptions = {
            host: HOST,
            port: PORT,
            path: '/',
            method: 'GET', // GET | POST
            parameters: {},
            body: '',
            callback: function () {
            },
            contentType: 'application/json',
            headers: {
                'Authorization': 'Bearer ' + ACCESSTOKEN,
            }
        };

        options = extend(defaultOptions, options);

        console.log("Make request: " + options.path + " (" + options.method + ")");

        // Update Content-Type header
        options.headers = extend(options.headers, {
            'Content-Type': options.contentType
        });

        // Update Header if agreement has been set
        if (agreementSet === true) {
            options.headers = extend(options.headers, {
                'X-CommonName': X_COMMONNAME,
                'X-Agreement-ID': X_AGREEMENT_ID

            });
        }

        // Encode body if contentType is json.
        if (options.contentType === 'application/json') {
            options.body = JSON.stringify(options.body);
        }

        // Make changes to the request options headers if method is POST
        if (options.method === 'POST') {
            options.headers = extend(options.headers, {
                'Content-Length': Buffer.byteLength(options.body),
            });
        }


        let request = https.request(options, function (response) {
            response.setEncoding('utf8');

            let str = '';


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
                    throw new Error("Error performing request: Unauthorized. Check your config file.");

                } else if (response.statusCode === 500) {
                    // Interal server error. This might be caused because the agreement is not properly set.
                    // Let's reset it ...
                    throw new Error("Error performing request (500): " + str);

                } else if (response.statusCode === 503) {
                    // Probably a message throttle issue ... lets wait a while before we contine...
                    console.log("Exceeded quota. Waiting for 5 seconds.");
                    setTimeout(function () {
                        options.callback();
                    }, 5000);

                } else {
                    console.log("Error performing request: " + response.statusCode);
                    console.log(str);
                    options.callback();
                }
            });

            response.on('error', function (e) {
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
        if (!ACCESSTOKEN) {
            throw new Error("No Access Token. Please check your config file.");
        }

        if (!agreementSet && options.path !== 'agreements') {
            console.log("Agreement not set. Set it ...");
            activateFirstAgreement(function () {
                makeApiRequest(options);
            });
            return;
        }
        console.log("All good. Let's make a request ...");

        if(!agreementSet) {
        options = extend(options, {
            path: API + options.path
        });
		}else{
        	options = extend(options, {
        		path: API + X_AGREEMENT_ID + "/" + options.path
			})
		}

        makeRequest(options);
    }

    /**
     * makeSimpleApiRequest
     * @param  {string}   endpoint The endpoint of the API.
     * @param  {Function} callback The callback after completion.
     */
    function makeSimpleApiRequest(endpoint, callback) {
        callback = callback || function () {
        };
        makeApiRequest({path: endpoint, callback: callback});
    }

    /**
     * activateFirstAgreement
     * Activates the first agreement for the current user.
     * @param  {Function} callback Callback after the agreement is activted.
     */
    function activateFirstAgreement(callback) {
        self.getAgreements(function (agreements) {
            if (agreements && agreements.length > 0) {
                self.setAgreement(agreements[0].agreementId, agreements[0].displayCommonName, callback);
            } else {
                // No agreements or request failed.
                console.log("Agreements request failed.");
                callback();
            }
        });
    }

    /// Public Methods

    /**
     * setApiKeySecret
     * Set the API Key and Secret.
     * @param  {string} k API Key.
     * @param  {string} s API Secret.
     * @param  {string} a Access Token
     */
    self.setApiKeySecret = function (k, s, a) {
        ACCESSTOKEN = a;
        APIKEY = k;
        APISECRET = s;
    };

    // Agreements

    /**
     * getAgreements
     * Get the all the agreements for the current user.
     * @param  {Function} callback The callback after the agreements are received.
     */
    self.getAgreements = function (callback) {
        makeSimpleApiRequest('agreements', callback);
    };

    /**
     * setAgreement
     * Set an agreement as the active agreement.
     * @param  {string}   agreementId The agreementId for the desired active agreement.
     * @param  {string}  displayCommonName the x-CommonName for the desired active agreement
     * @param  {Function} callback    The callback after the agreement is activated.
     */
    self.setAgreement = function (agreementId, displayCommonName, callback) {
        console.log('Set agreementID: ' + agreementId + " CommonName: " + displayCommonName);
        // makeApiRequest({
        // 	path: 'agreements',
        // 	method: 'POST',
        // 	headers: {"X-Agreement-ID": agreementId, "X-CommonName": displayCommonName, authorization: "bearer" + APIKEY},
        // 	callback: function() {
        // 		console.log("Agreement set: " + agreementId + ", X-CommonName set: " + displayCommonName);
        // 		agreementSet = true;
        // 		callback();
        // 	}
        // });
        // Update headers for agreement
        X_AGREEMENT_ID = agreementId;
        X_COMMONNAME = displayCommonName;
        console.log("Agreement set: " + agreementId + ", X-CommonName set: " + displayCommonName);
        agreementSet = true;
        callback();

    };

    // Consumption

    /**
     * getConsumptionElectricityFlows
     * Request the consumption electricity flows.
     * @param  {Function} callback The callback after the data is received.
     */
    self.getConsumptionElectricityFlows = function (callback) {
        makeSimpleApiRequest('consumption/electricity/flows', callback);
    };

    /**
     * getConsumptionElectricityData
     * Request the consumption electricity data.
     * @param  {Function} callback The callback after the data is received.
     */
    self.getConsumptionElectricityData = function (callback) {
        makeSimpleApiRequest('consumption/electricity/data', callback);
    };

    /**
     * getConsumptionDistrictheatData
     * Request the consumption district heat data.
     * @param  {Function} callback The callback after the data is received.
     */
    self.getConsumptionDistrictheatData = function (callback) {
        makeSimpleApiRequest('consumption/districtheat/data', callback);
    };

    /**
     * getConsumptionGasFlows
     * Request the consumption gas flows.
     * @param  {Function} callback The callback after the data is received.
     */
    self.getConsumptionGasFlows = function (callback) {
        makeSimpleApiRequest('consumption/gas/flows', callback);
    };

    /**
     * getConsumptionGasData
     * Request the consumption gas data.
     * @param  {Function} callback The callback after the data is received.
     */
    self.getConsumptionGasData = function (callback) {
        makeSimpleApiRequest('consumption/gas/data', callback);
    };

    // Temperature

    /**
     * getTemperatureStates
     * Request the temperature states.
     * @param  {Function} callback The callback after the data is received.
     */
    self.getTemperatureStates = function (callback) {
        makeSimpleApiRequest('temperature/states', callback);
    };

    /**
     * getTemperaturePrograms
     * Request the temperature programs.
     * @param  {Function} callback The callback after the data is received.
     */
    self.getTemperaturePrograms = function (callback) {
        makeSimpleApiRequest('temperature/programs', callback);
    };

    // Status

    /**
	 * getStatus
	 * Request the current status.
	 * @param  {Function} callback The callback after the data is received.
	 */
    self.getStatus = function (callback) {
        makeSimpleApiRequest('status', function (data) {
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
