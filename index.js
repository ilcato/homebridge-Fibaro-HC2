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
//            "grouping": "PUT none OR room",
//            "pollerperiod": "PUT 0 FOR DISABLING POLLING, 1 - 100 INTERVAL IN SECONDS. 5 SECONDS IS THE DEFAULT"
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
  
	homebridge.registerPlatform("homebridge-fibaro-hc2", "FibaroHC2", FibaroHC2Platform, true);
}

function FibaroHC2Platform(log, config, api){
	this.config = config || {};
	this.api = api;
	this.accessories = [];
  	this.log = log;
  	this.fibaroClient = require('./lib/fibaro-api').createClient(config["host"], config["username"], config["password"]);
  	this.grouping = config["grouping"];
  	if (this.grouping == undefined || this.grouping == "") {
		this.grouping = "none"
  	}
  	this.rooms = {};
  	this.updateSubscriptions = [];
  	this.lastPoll=0;
  	this.pollingUpdateRunning = false;
  	this.pollerPeriod = config["pollerperiod"];
  	if (typeof this.pollerPeriod == 'string')
  		 this.pollerPeriod = parseInt(this.pollerPeriod);
  	else if (this.pollerPeriod == undefined)
  		 this.pollerPeriod = 5;

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
    var that = this;
    this.fibaroClient.getRooms()
    	.then(function (rooms) {
        	rooms.map(function(s, i, a) {
        		that.rooms[s.id] = s.name;
        	});
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
						that.addAccessory(services, null, currentRoomID, null)
						services = [];
					}
					currentRoomID = s.roomID;
				}
			}
			if (s.type == "com.fibaro.multilevelSwitch" || s.type == "com.fibaro.FGD212")
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
			else if (s.type == "com.fibaro.binarySwitch" || s.type == "com.fibaro.developer.bxs.virtualBinarySwitch") {
				var controlService;
				switch (s.properties.deviceControlType) {
				case "2": // Lighting
				case "5": // Bedside Lamp
				case "7": // Wall Lamp
					controlService = new Service.Lightbulb(s.name);
					break;
				default:
					controlService = new Service.Switch(s.name)
					break;
				}
				service = {controlService: controlService, characteristics: [Characteristic.On]};			
			} else if (s.type.substring(0, 18) == "com.fibaro.FGMS001" || s.type == "com.fibaro.motionSensor")
				service = {controlService: new Service.MotionSensor(s.name), characteristics: [Characteristic.MotionDetected]};
			else if (s.type == "com.fibaro.temperatureSensor")
				service = {controlService: new Service.TemperatureSensor(s.name), characteristics: [Characteristic.CurrentTemperature]};
			else if (s.type == "com.fibaro.humiditySensor")
				service = {controlService: new Service.HumiditySensor(s.name), characteristics: [Characteristic.CurrentRelativeHumidity]};
			else if (s.type == "com.fibaro.doorSensor" || s.type == "com.fibaro.windowSensor")
				service = {controlService: new Service.ContactSensor(s.name), characteristics: [Characteristic.ContactSensorState]};
			else if (s.type == "com.fibaro.FGFS101" || s.type == "com.fibaro.floodSensor")
				service = {controlService: new Service.LeakSensor(s.name), characteristics: [Characteristic.LeakDetected]};
			else if (s.type == "com.fibaro.FGSS001")
				service = {controlService: new Service.SmokeSensor(s.name), characteristics: [Characteristic.SmokeDetected]};
			else if (s.type == "com.fibaro.lightSensor")
				service = {controlService: new Service.LightSensor(s.name), characteristics: [Characteristic.CurrentAmbientLightLevel]};
			else if (s.type == "com.fibaro.FGWP101" || s.type == "com.fibaro.FGWP102")
				service = {controlService: new Service.Outlet(s.name), characteristics: [Characteristic.On, Characteristic.OutletInUse]};
			else if (s.type == "com.fibaro.doorLock" || s.type == "com.fibaro.gerda")
				service = {controlService: new Service.LockMechanism(s.name), characteristics: [Characteristic.LockCurrentState, Characteristic.LockTargetState]};
			else if (s.type == "com.fibaro.setPoint")
				service = {controlService: new Service.Thermostat(s.name), characteristics: [Characteristic.CurrentTemperature, Characteristic.TargetTemperature]};
			else if (s.type == "com.fibaro.thermostatDanfoss" || s.type == "com.fibaro.thermostatHorstmann"){
				service = {controlService: new Service.Thermostat(s.name), characteristics: [
									Characteristic.CurrentHeatingCoolingState,
									Characteristic.TargetHeatingCoolingState,
									Characteristic.CurrentTemperature,
									Characteristic.TargetTemperature,
									Characteristic.TemperatureDisplayUnits
						 ]};
			}
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
				if (pushButtonServices.length > 0) {
					that.addAccessory(pushButtonServices, s.name, s.roomID, s.ID)
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
					that.addAccessory(services, s.name, s.roomID, s.ID)
					services = [];
				}
			}
		}
	  });
	}
	if (that.grouping == "room") {         	
		if (services.length != 0) {
			that.addAccessory(services, null, currentRoomID, null)
		}
	}
	// Remove not reviewd accessories: cached accessories no more present in Home Center
	for (var a in this.accessories) {
		if (!this.accessories[a].reviewed) {
		    this.log("Removing Accessory: " + this.accessories[a].displayName);
			this.api.unregisterPlatformAccessories("homebridge-fibaro-hc2", "FibaroHC2", [this.accessories[a]]);
		}
	}

	if (this.pollerPeriod >= 1 && this.pollerPeriod <= 100)
		this.startPollingUpdate();
}
FibaroHC2Platform.prototype.addAccessory = function(services, name, currentRoomID, deviceID) {
	var accessoryName = (name) ? name : this.rooms[currentRoomID] + "-Devices";
	var uniqueSeed = accessoryName + currentRoomID;
	var a = this.existingAccessory(uniqueSeed);
	var isNewAccessory = false;
	if (a == null) {
		isNewAccessory = true;
		var uuid = UUIDGen.generate(uniqueSeed);
	  	a = new Accessory(accessoryName, uuid);
		a.context.uniqueSeed = uniqueSeed;
		this.accessories[uuid] = a;
	}
  	// init accessory
	a.getService(Service.AccessoryInformation)
                    .setCharacteristic(Characteristic.Manufacturer, "IlCato")
                    .setCharacteristic(Characteristic.Model, "HomeCenterBridgedAccessory")
                    .setCharacteristic(Characteristic.SerialNumber, "<unknown>");

	// Remove services existing in HomeKit accessory no more present in Home Center
  	for (var t = 0; t < a.services.length; t++) {
  		var found = false;
	  	for (var s = 0; s < services.length; s++) {
	  		if (a.services[t].displayName == undefined || services[s].controlService.displayName == a.services[t].displayName) {
				found = true;
				break;	  		
	  		}
		}
		if (!found) {
			a.removeService(a.services[t]);
		}
	}    
	// Add services present in Home Center and not existing in Homekit accessory
  	for (var s = 0; s < services.length; s++) {
		var service = services[s];
		var serviceExists = a.getService(service.controlService.displayName);
		if (!serviceExists) {
			a.addService(service.controlService);
			for (var i=0; i < service.characteristics.length; i++) {
				var characteristic = service.controlService.getCharacteristic(service.characteristics[i]);
				characteristic.props.needsBinding = true;
				if (characteristic.UUID == (new Characteristic.CurrentAmbientLightLevel()).UUID) {
					characteristic.props.maxValue = 10000;
					characteristic.props.minStep = 1;
					characteristic.props.minValue = 0;
				}
				if (characteristic.UUID == (new Characteristic.CurrentTemperature()).UUID) {
					characteristic.props.minValue = -50;
				}
				this.bindCharacteristicEvents(characteristic, service.controlService);
			}
		}
    }
	
	a.reachable = true;
	if (isNewAccessory) {
	    this.log("Adding Accessory: " + accessoryName);
		this.api.registerPlatformAccessories("homebridge-fibaro-hc2", "FibaroHC2", [a]);
	} else {
		this.log("Updating Accessory: " + accessoryName);
		this.api.updatePlatformAccessories([a]);
	}
	a.reviewed = true;
	// Mark accessory as reviewed in order to remove the not reviewed ones
}
FibaroHC2Platform.prototype.existingAccessory = function(uniqueSeed) {
	for (var a in this.accessories) {
		if (this.accessories[a].context.uniqueSeed == uniqueSeed) {
			return this.accessories[a];
		}
	}
	return null;
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
						characteristic.setValue(0, undefined, 'fromSetValue');
					}, 100 );
				} else if (characteristic.UUID == (new Characteristic.On()).UUID) {
					if (characteristic.value == true && value == 0 || characteristic.value == false && value == 1)
						this.command(value == 0 ? "turnOff": "turnOn", null, service, IDs);
				} else if (characteristic.UUID == (new Characteristic.TargetTemperature()).UUID) {
					if (Math.abs(value - characteristic.value) >= 0.5) {
						value = parseFloat( (Math.round(value / 0.5) * 0.5).toFixed(1) );
						this.command("setTargetLevel", value, service, IDs);
						this.command("setTime", 2*3600 + Math.trunc((new Date()).getTime()/1000), service, IDs);
					} else {
						value = characteristic.value;
					}
					setTimeout( function(){
						characteristic.setValue(value, undefined, 'fromSetValue');
					}, 100 );
				} else if (characteristic.UUID == (new Characteristic.LockTargetState()).UUID) {
					var action = value == Characteristic.LockTargetState.UNSECURED ? "unsecure" : "secure";
					this.command(action, 0, service, IDs);
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
			that.log("Getting value from: " + IDs[0] + " " + characteristic.displayName + " " + properties.value);
			if (characteristic.UUID == (new Characteristic.OutletInUse()).UUID) {
				callback(undefined, parseFloat(properties.power) > 1.0 ? true : false);
			} else if (characteristic.UUID == (new Characteristic.CurrentHeatingCoolingState()).UUID) {
				callback(undefined, Characteristic.TargetHeatingCoolingState.HEAT);
			} else if (characteristic.UUID == (new Characteristic.TargetHeatingCoolingState()).UUID) {
				callback(undefined, Characteristic.TargetHeatingCoolingState.HEAT);
			} else if (characteristic.UUID == (new Characteristic.TemperatureDisplayUnits()).UUID) {
				callback(undefined, Characteristic.TemperatureDisplayUnits.CELSIUS);
			} else if (characteristic.UUID == (new Characteristic.CurrentTemperature()).UUID) {
				callback(undefined, parseFloat(properties.value));
			} else if (characteristic.UUID == (new Characteristic.TargetTemperature()).UUID) {
				callback(undefined, parseFloat(properties.targetLevel));
			} else if (characteristic.UUID == (new Characteristic.Hue()).UUID) {
				var hsv = that.updateHomeKitColorFromHomeCenter(properties.color, service);
				callback(undefined, Math.round(hsv.h));
			} else if (characteristic.UUID == (new Characteristic.Saturation()).UUID) {
				var hsv = that.updateHomeKitColorFromHomeCenter(properties.color, service);
				callback(undefined, Math.round(hsv.s));
			} else if (characteristic.UUID == (new Characteristic.ContactSensorState()).UUID) {
				callback(undefined, properties.value == "false" ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
			} else if (characteristic.UUID == (new Characteristic.LeakDetected()).UUID) {
				callback(undefined, properties.value == "true" ? Characteristic.LeakDetected.LEAK_DETECTED : Characteristic.LeakDetected.LEAK_NOT_DETECTED);
			} else if (characteristic.UUID == (new Characteristic.SmokeDetected()).UUID) {
				callback(undefined, properties.value == "true" ? Characteristic.SmokeDetected.SMOKE_DETECTED : Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
			} else if (characteristic.UUID == (new Characteristic.Brightness()).UUID) {
				if (service.HSBValue != null) {
					var hsv = that.updateHomeKitColorFromHomeCenter(properties.color, service);
					callback(undefined, Math.round(hsv.v));
				} else {
					if (properties.value == 99) properties.value = 100;
					callback(undefined, parseFloat(properties.value));
				}
			} else if (characteristic.UUID == (new Characteristic.PositionState()).UUID) {
				callback(undefined, Characteristic.PositionState.STOPPED);
			} else if (characteristic.UUID == (new Characteristic.LockCurrentState()).UUID || characteristic.UUID == (new Characteristic.LockTargetState()).UUID) {
				callback(undefined, properties.value == "true" ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED);
			} else if (characteristic.UUID == (new Characteristic.CurrentPosition()).UUID || characteristic.UUID == (new Characteristic.TargetPosition()).UUID) {
				var v = parseInt(properties.value);
				if (v >= characteristic.props.minValue && v <= characteristic.props.maxValue) {
					if (v == 99) v = 100;
					callback(undefined, v);
				} else {
					that.log("There was a problem getting value for blind" + IDs[0] + ", value = " + v);
					callback("Error value window position", null);
				}
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
			that.log("There was a problem getting value from: " + IDs[0] + " - Err: " + err + " - Response: " + response);
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
	if (characteristic.UUID == (new Characteristic.PositionState()).UUID)
		return;

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
								if (subscription.characteristic.UUID == (new Characteristic.OutletInUse()).UUID)
									powerValue = true;
								if (subscription.characteristic.UUID == (new Characteristic.ContactSensorState()).UUID)
									subscription.characteristic.setValue(value == false ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED, undefined, 'fromFibaro');
								else if (subscription.characteristic.UUID == (new Characteristic.CurrentHeatingCoolingState()).UUID)
									subscription.characteristic.setValue(Characteristic.TargetHeatingCoolingState.HEAT);
								else if (subscription.characteristic.UUID == (new Characteristic.TargetHeatingCoolingState()).UUID)
									subscription.characteristic.setValue(Characteristic.TargetHeatingCoolingState.HEAT);
								else if (subscription.characteristic.UUID == (new Characteristic.TemperatureDisplayUnits()).UUID)
									subscription.characteristic.setValue(Characteristic.TemperatureDisplayUnits.CELSIUS);
								else if (subscription.characteristic.UUID == (new Characteristic.CurrentTemperature()).UUID)
									subscription.characteristic.setValue(parseFloat(s.value));
								else if (subscription.characteristic.UUID == (new Characteristic.TargetTemperature()).UUID)
									subscription.characteristic.setValue(parseFloat(properties.targetLevel));
								else if (subscription.characteristic.UUID == (new Characteristic.LeakDetected()).UUID)
									subscription.characteristic.setValue(value == true ? Characteristic.LeakDetected.LEAK_DETECTED : Characteristic.LeakDetected.LEAK_NOT_DETECTED, undefined, 'fromFibaro');
								else if (subscription.characteristic.UUID == (new Characteristic.SmokeDetected()).UUID)
									subscription.characteristic.setValue(value == true ? Characteristic.SmokeDetected.SMOKE_DETECTED : Characteristic.SmokeDetected.SMOKE_NOT_DETECTED, undefined, 'fromFibaro');
								else if (subscription.characteristic.UUID == (new Characteristic.LockCurrentState()).UUID || subscription.characteristic.UUID == (new Characteristic.LockTargetState()).UUID)
									subscription.characteristic.setValue(value == true ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED, undefined, 'fromFibaro');
								else if (subscription.characteristic.UUID == (new Characteristic.CurrentPosition()).UUID || subscription.characteristic.UUID == (new Characteristic.TargetPosition()).UUID) {
									if (value >= subscription.characteristic.props.minValue && value <= subscription.characteristic.props.maxValue) {
										if (value == 99) value = 100;
										subscription.characteristic.setValue(value, undefined, 'fromFibaro');
									}
								} else if (s.power != undefined && powerValue) {
									subscription.characteristic.setValue(parseFloat(s.power) > 1.0 ? true : false, undefined, 'fromFibaro');
								} else if (subscription.characteristic.UUID == (new Characteristic.Brightness()).UUID) {
									 if (value == 99) value = 100;								
									 subscription.characteristic.setValue(value, undefined, 'fromFibaro');
								} else if ((subscription.onOff && typeof(value) == "boolean") || !subscription.onOff) {
									 subscription.characteristic.setValue(value, undefined, 'fromFibaro');
								} else {
									subscription.characteristic.setValue(value == 0 ? false : true, undefined, 'fromFibaro');
								}
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
    		setTimeout( function() { that.startPollingUpdate()}, that.pollerPeriod * 1000);
  		})
  		.catch(function(err, response) {
 			that.log("Error fetching updates: " + err + response);
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