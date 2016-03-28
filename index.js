// Fibaro Home Center 2 Platform plugin for HomeBridge
//
// Remember to add platform to config.json. Example:
// "platforms": [
//     {
//            "platform": "FibaroHC2",
//            "name": "FibaroHC2",
//            "host": "PUT IP ADDRESS OF YOUR HC2 HERE",
//            "username": "PUT USERNAME OF YOUR HC2 HERE",
//            "password": "PUT PASSWORD OF YOUR HC2 HERE",
//            "grouping": "PUT none OR room"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict';

var Accessory, Service, Characteristic, UUIDGen;
var http = require('http');
var inherits = require('util').inherits;

module.exports = function(homebridge) {
	Accessory = homebridge.platformAccessory;
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	UUIDGen = homebridge.hap.uuid;
  
  	// Custom Services and Characteristics

	/**
	 * Custom Characteristic "Time Interval"
	 */

	Characteristic.TimeInterval = function() {
	  Characteristic.call(this, 'Time Interval', '2A6529B5-5825-4AF3-AD52-20288FBDA115');
	  this.setProps({
		format: Characteristic.Formats.FLOAT,
		unit: Characteristic.Units.SECONDS,
		maxValue: 21600, // 12 hours
		minValue: 0,
		minStep: 900, // 15 min
		perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
	  });
	  this.value = this.getDefaultValue();
	};
	inherits(Characteristic.TimeInterval, Characteristic);
	Characteristic.TimeInterval.UUID = '2A6529B5-5825-4AF3-AD52-20288FBDA115';

	/**
	 * Custom Service "Danfoss Radiator Thermostat"
	 */

	Service.DanfossRadiatorThermostat = function(displayName, subtype) {
	  Service.call(this, displayName, '0EB29E08-C307-498E-8E1A-4EDC5FF70607', subtype);

	  // Required Characteristics
	  this.addCharacteristic(Characteristic.CurrentTemperature);
	  this.addCharacteristic(Characteristic.TargetTemperature);
	  this.addCharacteristic(Characteristic.TimeInterval); // Custom Characteristic

	  // Optional Characteristics

	};
	inherits(Service.DanfossRadiatorThermostat, Service);
	Service.DanfossRadiatorThermostat.UUID = '0EB29E08-C307-498E-8E1A-4EDC5FF70607';

  	// End of custom Services and Characteristics

	homebridge.registerPlatform("homebridge-fibaro-hc2", "FibaroHC2", FibaroHC2Platform, true);
}

function FibaroHC2Platform(log, config, api){
	this.config = config || {};
	this.api = api;
	this.accessories = [];
  	this.log = log;
  	this.fibaroClient = require('./lib/fibaro-api').createClient(config["host"], config["username"], config["password"]);
  	this.grouping = config["grouping"];
  	this.rooms = {};
  	this.updateSubscriptions = [];
  	this.lastPoll=0;
  	this.pollingUpdateRunning = false;

	var self = this;
	this.requestServer = http.createServer();
	this.requestServer.on('error', function(err) {

    });
    this.requestServer.listen(18091, function() {
        self.log("Server Listening...");
    });
	
	if (api) {
    	// Save the API object as plugin needs to register new accessory via this object.
      	this.api = api;

      	// Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
	    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
      	// Or start discover new accessories
      	this.api.on('didFinishLaunching', function() {
        	console.log("Plugin - DidFinishLaunching");
			this.addAccessories();
      	}.bind(this));
 	}
}
FibaroHC2Platform.prototype.addAccessories = function() {
    this.log("Fetching Fibaro Home Center rooms ...");
    var that = this;
    this.fibaroClient.getRooms()
    	.then(function (rooms) {
        	rooms.map(function(s, i, a) {
        		that.rooms[s.id] = s.name;
        	});
		    that.log("Fetching Fibaro Home Center devices ...");
        	return that.fibaroClient.getDevices();
    	})
    	.then(function (devices) {
			that.HomeCenterDevices2HomeKitAccessories(devices);    		
    	})
    	.catch(function (err, response) {
			that.log("Error getting data from Home Center: " + err + " " + response);
    	});
}
FibaroHC2Platform.prototype.HomeCenterDevices2HomeKitAccessories = function(devices) {
    var foundAccessories = [];
	if (devices != undefined) {
	  // Order results by roomID
	  devices.sort(function compare(a, b) {
			if (a.roomID > b.roomID) {
				return -1;
			}
			if (a.roomID < b.roomID) {
				return 1;
			}
			return 0;
		}
	  );
	  var currentRoomID = "";
	  var services = [];
	  var service = null;
	  var that = this;
	  devices.map(function(s, i, a) {
		if (s.visible == true && s.name.charAt(0) != "_") {
			if (that.grouping == "room") {         	
				if (s.roomID != currentRoomID) {
					if (services.length != 0) {
						var a = that.createAccessory(services, null, currentRoomID)
						var name = a.name;
						var uuid = UUIDGen.generate(name);
						if (!that.accessories[uuid]) {
							that.addAccessory(a);
						}
						services = [];
					}
					currentRoomID = s.roomID;
				}
			}
			if (s.type == "com.fibaro.multilevelSwitch")
				service = {controlService: new Service.Lightbulb(s.name), characteristics: [Characteristic.On, Characteristic.Brightness]};
			else if (s.type == "com.fibaro.FGRGBW441M" || s.type == "com.fibaro.colorController") {
				service = {controlService: new Service.Lightbulb(s.name), characteristics: [Characteristic.On, Characteristic.Brightness, Characteristic.Hue, Characteristic.Saturation]};
				service.controlService.HSBValue = {hue: 0, saturation: 0, brightness: 0};
				service.controlService.RGBValue = {red: 0, green: 0, blue: 0};
				service.controlService.countColorCharacteristics = 0;
				service.controlService.timeoutIdColorCharacteristics = 0;
				service.controlService.subtype = "RGB"; // for RGB color add a subtype parameter; it will go into 3rd position: "DEVICE_ID-VIRTUAL_BUTTON_ID-RGB_MARKER
			} else if (s.type == "com.fibaro.FGRM222" || s.type == "com.fibaro.FGR221" || s.type == "com.fibaro.rollerShutter")
				service = {controlService: new Service.WindowCovering(s.name), characteristics: [Characteristic.CurrentPosition, Characteristic.TargetPosition, Characteristic.PositionState]};
			else if (s.type == "com.fibaro.binarySwitch" || s.type == "com.fibaro.developer.bxs.virtualBinarySwitch")
				service = {controlService: new Service.Switch(s.name), characteristics: [Characteristic.On]};
			else if (s.type.substring(0, 18) == "com.fibaro.FGMS001" || s.type == "com.fibaro.motionSensor")
				service = {controlService: new Service.MotionSensor(s.name), characteristics: [Characteristic.MotionDetected]};
			else if (s.type == "com.fibaro.temperatureSensor")
				service = {controlService: new Service.TemperatureSensor(s.name), characteristics: [Characteristic.CurrentTemperature]};
			else if (s.type == "com.fibaro.doorSensor" || s.type == "com.fibaro.windowSensor")
				service = {controlService: new Service.ContactSensor(s.name), characteristics: [Characteristic.ContactSensorState]};
			else if (s.type == "com.fibaro.lightSensor")
				service = {controlService: new Service.LightSensor(s.name), characteristics: [Characteristic.CurrentAmbientLightLevel]};
			else if (s.type == "com.fibaro.FGWP101")
				service = {controlService: new Service.Outlet(s.name), characteristics: [Characteristic.On, Characteristic.OutletInUse]};
			else if (s.type == "com.fibaro.thermostatDanfoss" || s.type == "com.fibaro.thermostatHorstmann")
				service = {controlService: new Service.DanfossRadiatorThermostat(s.name), characteristics: [Characteristic.CurrentTemperature, Characteristic.TargetTemperature, Characteristic.TimeInterval]};
			else if (s.type == "virtual_device") {
				var pushButtonServices = [];
				var pushButtonService = null;
				for (var r = 0; r < s.properties.rows.length; r++) {
					if (s.properties.rows[r].type == "button") {
						for (var e = 0; e < s.properties.rows[r].elements.length; e++) {
							pushButtonService  = {
								controlService: new Service.Switch(s.properties.rows[r].elements[e].caption),
								characteristics: [Characteristic.On]
							};
							pushButtonService.controlService.subtype = s.id + "-" + s.properties.rows[r].elements[e].id; // For Virtual devices it is device_id + "-" + button_id
							pushButtonServices.push(pushButtonService);
						}
					} 
				}
				var fa = that.createAccessory(pushButtonServices, s.name, null)
				var name = fa.name;
				var uuid = UUIDGen.generate(name);
				if (!that.accessories[uuid]) {
					that.addAccessory(fa);
				}
			}
			if (service != null) {
				if (service.controlService.subtype == undefined)
					service.controlService.subtype = "";
				service.controlService.subtype = s.id + "--" + service.controlService.subtype; // "DEVICE_ID-VIRTUAL_BUTTON_ID-RGB_MARKER
				services.push(service);
				service = null;
			}
			if (that.grouping == "none") {         	
				if (services.length != 0) {
					var a = that.createAccessory(services, s.name, currentRoomID)
					var name = a.name;
					var uuid = UUIDGen.generate(name);
					if (!that.accessories[uuid]) {
						that.addAccessory(a);
					}
					services = [];
				}
			}
		}
	  });
	}
	this.startPollingUpdate();
}
FibaroHC2Platform.prototype.createAccessory = function(services, name, currentRoomID) {
	var accessory = new FibaroBridgedAccessory(services);
	accessory.platform 			= this;
	accessory.name				= (name) ? name : this.rooms[currentRoomID] + "-Devices";
	accessory.uuid 				= UUIDGen.generate(accessory.name);
	accessory.model				= "HomeCenterBridgedAccessory";
	accessory.manufacturer		= "IlCato";
	accessory.serialNumber		= "<unknown>";
	return accessory;
}
FibaroHC2Platform.prototype.addAccessory = function(fibaroAccessory) {

	if (!fibaroAccessory) {
		return;
	}
  	var newAccessory = new Accessory(fibaroAccessory.name, fibaroAccessory.uuid);
  	fibaroAccessory.initAccessory(newAccessory);
	newAccessory.reachable = true;

	this.accessories[fibaroAccessory.UUID] = fibaroAccessory;
    this.log("Adding Accessory: " + fibaroAccessory.name);
	this.api.registerPlatformAccessories("homebridge-fibaro-hc2", "FibaroHC2", [newAccessory]);
}
FibaroHC2Platform.prototype.configureAccessory = function(accessory) {
	for (var s = 0; s < accessory.services.length; s++) {
		var service = accessory.services[s];
		if (service.subtype != undefined) {
			var subtypeParams = service.subtype.split("-"); // "DEVICE_ID-VIRTUAL_BUTTON_ID-RGB_MARKER
			if (subtypeParams.length == 3 && subtypeParams[2] == "RGB") {
				// For RGB devices add specific attributes for managing it
				service.HSBValue = {hue: 0, saturation: 0, brightness: 0};
				service.RGBValue = {red: 0, green: 0, blue: 0};
				service.countColorCharacteristics = 0;
				service.timeoutIdColorCharacteristics = 0;
			}
		}
		for (var i=0; i < service.characteristics.length; i++) {
			var characteristic = service.characteristics[i];
			if (characteristic.props.needsBinding)
				this.bindCharacteristicEvents(characteristic, service);
		}
	}
    this.log("Configuring Accessory: " + accessory.displayName);
	this.accessories[accessory.UUID] = accessory;
	accessory.reachable = true;
}
FibaroHC2Platform.prototype.bindCharacteristicEvents = function(characteristic, service) {
	var onOff = characteristic.props.format == "bool" ? true : false;
  	var readOnly = true;
  	for (var i = 0; i < characteristic.props.perms.length; i++)
		if (characteristic.props.perms[i] == "pw")
			readOnly = false;
	var IDs = service.subtype.split("-"); // IDs[0] is always device ID; for virtual device IDs[1] is the button ID
	service.isVirtual = IDs[1] != "" ? true : false;
	if (!service.isVirtual) {
		var propertyChanged = "value"; // subscribe to the changes of this property
		if (service.HSBValue != undefined)
			propertyChanged = "color";	 		
	    this.subscribeUpdate(service, characteristic, onOff, propertyChanged); // TODO CHECK
	}
	if (!readOnly) {
    	characteristic.on('set', function(value, callback, context) {
			if( context !== 'fromFibaro' && context !== 'fromSetValue') {
				if (characteristic.UUID == (new Characteristic.On()).UUID && service.isVirtual) {
					// It's a virtual device so the command is pressButton and not turnOn or Off
					this.command("pressButton", IDs[1], service, IDs);
					// In order to behave like a push button reset the status to off
					setTimeout( function(){
						characteristic.setValue(false, undefined, 'fromSetValue');
					}, 100 );
				} else if (characteristic.UUID == (new Characteristic.On()).UUID) {
					this.command(value == 0 ? "turnOff": "turnOn", null, service, IDs);
				} else if (characteristic.UUID == (new Characteristic.TargetTemperature()).UUID) {
					if (Math.abs(value - characteristic.value) >= 0.5) {
						value = parseFloat( (Math.round(value / 0.5) * 0.5).toFixed(1) );
						this.command("setTargetLevel", value, service, IDs);
						// automatically set the interval to 2 hours
						this.command("setTime", 2*3600 + Math.trunc((new Date()).getTime()/1000), service, IDs);
					} else {
						value = characteristic.value;
					}
					setTimeout( function(){
						characteristic.setValue(value, undefined, 'fromSetValue');
					}, 100 );
				} else if (characteristic.UUID == (new Characteristic.TimeInterval()).UUID) {
					this.command("setTime", value + Math.trunc((new Date()).getTime()/1000), service, IDs);
				} else if (characteristic.UUID == (new Characteristic.Hue()).UUID) {
					var rgb = this.updateHomeCenterColorFromHomeKit(value, null, null, service);
					this.syncColorCharacteristics(rgb, service, IDs);
				} else if (characteristic.UUID == (new Characteristic.Saturation()).UUID) {
					var rgb = this.updateHomeCenterColorFromHomeKit(null, value, null, service);
					this.syncColorCharacteristics(rgb, service, IDs);
				} else if (characteristic.UUID == (new Characteristic.Brightness()).UUID) {
					if (service.HSBValue != null) {
						var rgb = this.updateHomeCenterColorFromHomeKit(null, null, value, service);
						this.syncColorCharacteristics(rgb, service, IDs);
					} else {
						this.command("setValue", value, service, IDs);
					}
				} else {
					this.command("setValue", value, service, IDs);
				}
			} 
			callback();
		}.bind(this));
    }
    characteristic.on('get', function(callback) {
		if (service.isVirtual) {
			// a push button is normally off
			callback(undefined, false);
		} else {
			this.getAccessoryValue(callback, onOff, characteristic, service, IDs);
		}
    }.bind(this));
}
FibaroHC2Platform.prototype.getAccessoryValue = function(callback, returnBoolean, characteristic, service, IDs) {
	var that = this;
	this.fibaroClient.getDeviceProperties(IDs[0])
		.then(function(properties) {
			if (characteristic.UUID == (new Characteristic.OutletInUse()).UUID) {
				callback(undefined, parseFloat(properties.power) > 1.0 ? true : false);
			} else if (characteristic.UUID == (new Characteristic.TimeInterval()).UUID) {
				var t = (new Date()).getTime();
				t = parseInt(properties.timestamp) - t;
				if (t < 0) t = 0;
				callback(undefined, t);
			} else if (characteristic.UUID == (new Characteristic.TargetTemperature()).UUID) {
				callback(undefined, parseFloat(properties.targetLevel));
			} else if (characteristic.UUID == (new Characteristic.Hue()).UUID) {
				var hsv = that.updateHomeKitColorFromHomeCenter(properties.color, service);
				callback(undefined, Math.round(hsv.h));
			} else if (characteristic.UUID == (new Characteristic.Saturation()).UUID) {
				var hsv = that.updateHomeKitColorFromHomeCenter(properties.color, service);
				callback(undefined, Math.round(hsv.s));
			} else if (characteristic.UUID == (new Characteristic.ContactSensorState()).UUID) {
				callback(undefined, properties.value == "true" ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
			} else if (characteristic.UUID == (new Characteristic.Brightness()).UUID) {
				if (service.HSBValue != null) {
					var hsv = that.updateHomeKitColorFromHomeCenter(properties.color, service);
					callback(undefined, Math.round(hsv.v));
				} else {
					callback(undefined, parseFloat(properties.value));
				}
			} else if (characteristic.UUID == (new Characteristic.PositionState()).UUID) {
				callback(undefined, Characteristic.PositionState.STOPPED);
			} else if (returnBoolean) {
				var v = properties.value;
				if (v == "true" || v == "false") {
					callback(undefined, (v == "false") ? false : true);
				} else {
					callback(undefined, (parseInt(v) == 0) ? false : true);
				}
			} else {
				callback(undefined, parseFloat(properties.value));
			}
		})
		.catch(function(err, response) {
			that.log("There was a problem getting value from" + IDs[0] + "-" + err);
		});
}
FibaroHC2Platform.prototype.command = function(c,value, service, IDs) {
	var that = this;
	this.fibaroClient.executeDeviceAction(IDs[0], c, value)
		.then(function (response) {
			that.log("Command: " + c + ((value != undefined) ? ", value: " + value : ""));
		})
		.catch(function (err, response) {
			that.log("There was a problem sending command " + c + " to " + IDs[0]);
		});
}
FibaroHC2Platform.prototype.subscribeUpdate = function(service, characteristic, onOff, propertyChanged) {
// TODO: optimized management of updateSubscription data structure (no array with sequential access)
	var IDs = service.subtype.split("-"); // IDs[0] is always device ID; for virtual device IDs[1] is the button ID
  	this.updateSubscriptions.push({ 'id': IDs[0], 'service': service, 'characteristic': characteristic, 'onOff': onOff, "property": propertyChanged });
}
FibaroHC2Platform.prototype.startPollingUpdate = function() {
	if(this.pollingUpdateRunning ) {
    	return;
    }
  	this.pollingUpdateRunning = true;
  	
	var that = this;
  	this.fibaroClient.refreshStates(this.lastPoll)
  		.then(function(updates) {
			that.lastPoll = updates.last;
			if (updates.changes != undefined) {
				updates.changes.map(function(s) {
					if (s.value != undefined) {
						var value=parseInt(s.value);
						if (isNaN(value))
							value=(s.value === "true");
						for (var i=0; i < that.updateSubscriptions.length; i++) {
							var subscription = that.updateSubscriptions[i];
							if (subscription.id == s.id && subscription.property == "value") {
								var powerValue = false;
								var intervalValue = false;
								if (subscription.characteristic.UUID == (new Characteristic.OutletInUse()).UUID)
									powerValue = true;
								if (subscription.characteristic.UUID == (new Characteristic.TimeInterval()).UUID)
									intervalValue = true;
								if (subscription.characteristic.UUID == (new Characteristic.ContactSensorState()).UUID)
									subscription.characteristic.setValue(value == "true" ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED, undefined, 'fromFibaro');
								else if (s.power != undefined && powerValue)
									subscription.characteristic.setValue(parseFloat(s.power) > 1.0 ? true : false, undefined, 'fromFibaro');
								else if ((subscription.onOff && typeof(value) == "boolean") || !subscription.onOff)
									subscription.characteristic.setValue(value, undefined, 'fromFibaro');
								else
									subscription.characteristic.setValue(value == 0 ? false : true, undefined, 'fromFibaro');
							}
						}
					}
					if (s.color != undefined) {
						for (var i=0; i < that.updateSubscriptions.length; i++) {
							var subscription = that.updateSubscriptions[i];
							if (subscription.id == s.id && subscription.property == "color") {
								var hsv = that.updateHomeKitColorFromHomeCenter(s.color, subscription.service);
								if (subscription.characteristic.UUID == (new Characteristic.On()).UUID)
									subscription.characteristic.setValue(hsv.v == 0 ? false : true, undefined, 'fromFibaro');
								else if (subscription.characteristic.UUID == (new Characteristic.Hue()).UUID)
									subscription.characteristic.setValue(Math.round(hsv.h), undefined, 'fromFibaro');
								else if (subscription.characteristic.UUID == (new Characteristic.Saturation()).UUID)
									subscription.characteristic.setValue(Math.round(hsv.s), undefined, 'fromFibaro');
								else if (subscription.characteristic.UUID == (new Characteristic.Brightness()).UUID)
									subscription.characteristic.setValue(Math.round(hsv.v), undefined, 'fromFibaro');
							}
						}
					}
				});
			}
		  	that.pollingUpdateRunning = false;
    		setTimeout( function() { that.startPollingUpdate()}, 2000 );
  		})
  		.catch(function(err, response) {
 			that.log("Error fetching updates: " + err);
  		});
}
FibaroHC2Platform.prototype.updateHomeCenterColorFromHomeKit = function(h, s, v, service) {
	if (h != null)
		service.HSBValue.hue = h;
	if (s != null)
		service.HSBValue.saturation = s;
	if (v != null)
		service.HSBValue.brightness = v;
	var rgb = HSVtoRGB(service.HSBValue.hue, service.HSBValue.saturation, service.HSBValue.brightness);
	service.RGBValue.red = rgb.r;
	service.RGBValue.green = rgb.g;
	service.RGBValue.blue = rgb.b;
	return rgb;  	
}
FibaroHC2Platform.prototype.updateHomeKitColorFromHomeCenter = function(color, service) {
	var colors = color.split(",");
	var r = parseInt(colors[0]);
	var g = parseInt(colors[1]);
	var b = parseInt(colors[2]);
	service.RGBValue.red = r;
	service.RGBValue.green = g;
	service.RGBValue.blue = b;
	var hsv = RGBtoHSV(r, g, b);
	service.HSBValue.hue = hsv.h;
	service.HSBValue.saturation = hsv.s;
	service.HSBValue.brightness = hsv.v;
	return hsv;  	
}
FibaroHC2Platform.prototype.syncColorCharacteristics = function(rgb, service, IDs) {
	switch (--service.countColorCharacteristics) {
		case -1:
			service.countColorCharacteristics = 2;
			var that = this;
			service.timeoutIdColorCharacteristics = setTimeout(function () {
				if (service.countColorCharacteristics < 2)
					return;
				that.command("setR", rgb.r, service, IDs);
				that.command("setG", rgb.g, service, IDs);
				that.command("setB", rgb.b, service, IDs);
				service.countColorCharacteristics = 0;
				service.timeoutIdColorCharacteristics = 0;
			}, 1000);
			break;
		case 0:
			this.command("setR", rgb.r, service, IDs);
			this.command("setG", rgb.g, service, IDs);
			this.command("setB", rgb.b, service, IDs);
			service.countColorCharacteristics = 0;
			service.timeoutIdColorCharacteristics = 0;
			break;
		default:
			break;
	}
}

function FibaroBridgedAccessory(services) {
    this.services = services;
}
FibaroBridgedAccessory.prototype.initAccessory = function (newAccessory) {
	newAccessory.getService(Service.AccessoryInformation)
                    .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
                    .setCharacteristic(Characteristic.Model, this.model)
                    .setCharacteristic(Characteristic.SerialNumber, this.serialNumber);

  	for (var s = 0; s < this.services.length; s++) {
		var service = this.services[s];
		newAccessory.addService(service.controlService);
		for (var i=0; i < service.characteristics.length; i++) {
			var characteristic = service.controlService.getCharacteristic(service.characteristics[i]);
			characteristic.props.needsBinding = true;
			if (characteristic.UUID == (new Characteristic.CurrentAmbientLightLevel()).UUID) {
				characteristic.props.maxValue = 1000;
				characteristic.props.minStep = 1;
				characteristic.props.minValue = 1;
			}
			this.platform.bindCharacteristicEvents(characteristic, service.controlService);
		}
    }
}

function HSVtoRGB(hue, saturation, value) {
	var h = hue/360.0;
	var s = saturation/100.0;
	var v = value/100.0;
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}
function RGBtoHSV(r, g, b) {
    if (arguments.length === 1) {
        g = r.g, b = r.b, r = r.r;
    }
    var max = Math.max(r, g, b), min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
        case min: h = 0; break;
        case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
        case g: h = (b - r) + d * 2; h /= 6 * d; break;
        case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }

    return {
        h: h * 360.0,
        s: s * 100.0,
        v: v * 100.0
    };
}
