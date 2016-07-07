/* Magic Mirror
 * Module: MMM-Toon
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("MMM-Toon",{

	// Default module config.
	defaults: {
		apiKey: '',
		apiSecret: '',
		username: '',
		password: '',
		updateInterval: 3000
	},

	// Store the toon data in an object.
	toonData: {
		currentTemperature: 0,
		targetTemperature: 0,
		currentElectricity: 0,
		currentElectricityPercentage: 0,
		electricityToday: 0,
		electricityTodayPercentage: 0,
		gasToday: 0,
		gasTodayPercentage: 0
	},

	// A loading boolean.
	loading: true,

	// Subclass getStyles method.
	getStyles: function() {
	    return ['font-awesome.css','MMM-Toon.css'];
	},

	// Subclass getTranslations method.
	getTranslations: function() {
	    return {
	            en: "translations/en.json",
	            nl: "translations/nl.json"
	    };
	},

	// Subclass start method.
	start: function() {
		this.sendSocketNotification("CONFIG", this.config);
	},

	// Subclass socketNotificationReceived method.
	socketNotificationReceived: function(notification, payload) {
		if (notification === "STATUS") {
			var status = payload;

			if (status.thermostatInfo) {
				this.toonData.currentTemperature = status.thermostatInfo.currentDisplayTemp / 100;
				this.toonData.targetTemperature = status.thermostatInfo.currentSetpoint / 100;
			}

			if (status.powerUsage) {
				this.toonData.currentElectricity = status.powerUsage.value;
				this.toonData.currentElectricityPercentage = status.powerUsage.value / 2500 * 100;
				this.toonData.electricityToday = status.powerUsage.dayUsage;
				this.toonData.electricityTodayPercentage = status.powerUsage.dayUsage / status.powerUsage.avgDayValue * 100;
			}

			if (status.gasUsage) {
				this.toonData.gasToday = status.gasUsage.dayUsage;
				this.toonData.gasTodayPercentage = status.gasUsage.dayUsage / status.gasUsage.avgDayValue * 100;
			}

			this.loading = false;

			this.updateDom();
		}
	},

	// Override dom generator.
	getDom: function() {

		if (this.config.apiKey.length <= 0 ||
			this.config.apiSecret.length <= 0 ||
			this.config.username.length <= 0 ||
			this.config.password.length <= 0) {
				var errorWrapper = document.createElement("div");
				errorWrapper.innerHTML = this.translate("CONFIG_MISSING");
				errorWrapper.className = "small dimmed light";
				return errorWrapper;
		}

		if (this.loading) {
			var loadingWrapper = document.createElement("div");
			loadingWrapper.innerHTML = this.translate("LOADING");
			loadingWrapper.className = "small dimmed light";
			return loadingWrapper;
		}

		var wrapper = document.createElement("table");



		var temperatureRow = document.createElement("tr");

		var logoCell = document.createElement("td");
		temperatureRow.appendChild(logoCell);
		logoCell.colSpan = 2;

		var logo = document.createElement("img");
		logo.src = this.file('images/toon.png');
		logoCell.appendChild(logo);
		logo.className = "logo";

		var temperatureCell =  document.createElement("td");
		temperatureRow.appendChild(temperatureCell);
		temperatureCell.className = "";

		//Target Temperature
		var heatOnIcon = document.createElement("i");
		heatOnIcon.className = "fa fa-fire normal small heat-icon";

		var currentTemperature = document.createElement("span");
		currentTemperature.className = "bright normal current-temperature";
		currentTemperature.innerHTML += " " + this.toonData.currentTemperature + "°";

		var targetTemperature = document.createElement("span");
		targetTemperature.className = "small target-temperature";
		if (this.toonData.targetTemperature > this.toonData.currentTemperature) {
			targetTemperature.appendChild(heatOnIcon);
		}
		targetTemperature.innerHTML += " " + this.toonData.targetTemperature + "°";

		temperatureCell.appendChild(targetTemperature);
		temperatureCell.appendChild(currentTemperature);

		wrapper.appendChild(temperatureRow);
		wrapper.appendChild(this.createHeaderRow(this.translate("POWER_USAGE")));
		wrapper.appendChild(this.createBarGraphTR("power-off", this.toonData.currentElectricity + " W", this.toonData.currentElectricityPercentage));
		wrapper.appendChild(this.createBarGraphTR("plug", this.toonData.electricityToday + " kWh", this.toonData.electricityTodayPercentage));
		wrapper.appendChild(this.createHeaderRow(this.translate("GAS_USAGE")));
		wrapper.appendChild(this.createBarGraphTR("fire", this.toonData.gasToday + " m³", this.toonData.gasTodayPercentage));

		return wrapper;
	},


	createHeaderRow: function(header) {
		var tr = document.createElement('tr');
		var td = document.createElement('td');
		td.colSpan = 3;
		td.innerHTML = header;
		td.className = "header xsmall align-left dimmed";

		tr.appendChild(td);
		return tr;
	},

	/**
	 * createBarGraphTR
	 * This method creates a table row with a bar graph based on the icon, the lable and a percentage.
	 * @param  {string} icon       the font awesome icon. (without 'fa-')
	 * @param  {string} label      the label in front of the basr graph.
	 * @param  {number} percentage the percentage of the bar graph
	 * @return {dom object}            the table row
	 */
	createBarGraphTR: function(icon, label, percentage) {
		if (percentage > 100) {
			percentage = 100;
		}

		if (percentage < 0) {
			percentage = 0;
		}

		var iconWrapper = document.createElement("td");
		iconWrapper.className = "icon";
		var iconElement = document.createElement("i");
		iconElement.className = "dimmed fa fa-fw fa-" + icon;
		iconWrapper.appendChild(iconElement);

		var valueWrapper = document.createElement("td");
		valueWrapper.className = "small value bright";
		valueWrapper.innerHTML = label;

		var barWrapper = document.createElement("td");
		barWrapper.className = "graph";

		var barBackground = document.createElement("div");
		barBackground.className = "bar bar-background";
		barWrapper.appendChild(barBackground);

		var barForeground = document.createElement("div");
		barForeground.className = "bar bar-foreground";
		barForeground.style.width = percentage + "%";
		barWrapper.appendChild(barForeground);

		var tr = document.createElement("tr");
		tr.appendChild(iconWrapper);
		tr.appendChild(valueWrapper);
		tr.appendChild(barWrapper);

		return tr;
	}
});
