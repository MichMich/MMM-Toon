
/* MMM-Toon
 * Node Helper
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

var ToonAPI = require("./ToonAPI.js");

module.exports = NodeHelper.create({
	// Subclass start method.
	start: function() {
		console.log("Starting module: " + this.name);
        this.config = {};
        this.fetcherRunning = false;
        this.status = false;
	},

	// Subclass socketNotificationReceived received.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "CONFIG") {
            console.log("Toon config received!");

			this.config = payload;
            if (this.config.apiKey && this.config.apiSecret) {
                ToonAPI.setApiKeySecret(this.config.apiKey, this.config.apiSecret);
            }

            if (this.config.username && this.config.password) {
                ToonAPI.setUsernamePassword(this.config.username, this.config.password);
            }

            if (this.config.apiKey && this.config.apiSecret && this.config.username && this.config.password) {
                if (!this.fetcherRunning) {
                    this.fetchStatus();
                }
            }

            if (this.status) {
                this.sendSocketNotification('STATUS', this.status);
            }
		}
	},

	/**
	 * fetchStatus
	 * Request new status drom the Toon API and broadcast it to the MagicMirror module if it's received.
	 */
    fetchStatus: function() {
        var self = this;
        this.fetcherRunning = true;
        ToonAPI.getStatus(function(status) {
            if (status && status.updated) {
                self.status = status;
                self.sendSocketNotification('STATUS', status);
            }

            setTimeout(function() {
                self.fetchStatus();
            }, self.config.updateInterval);
        });
    }
});
