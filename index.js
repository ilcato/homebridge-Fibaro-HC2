// Fibaro Home Center 2 Platform plugin for HomeBridge
//
// Remember to add platform to config.json. Example:
// "platforms": [
//     {
//            "platform": "FibaroHC2",
//            "name": "FibaroHC2",
//            "host": "PUT IP ADDRESS OF YOUR HC2 HERE",
//            "username": "PUT USERNAME OF YOUR HC2 HERE",
//            "password": "PUT PASSWORD OF YOUR HC2 HERE"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict';

var Service, Characteristic;
var request = require("request");
var inherits = require('util').inherits;


function FibaroHC2Platform(log, config){
  	this.log          = log;
  	this.host     = config["host"];
  	this.username = config["username"];
  	this.password = config["password"];
  	this.auth = "Basic " + new Buffer(this.username + ":" + this.password).toString("base64");
  	this.url = "http://"+this.host+"/api/devices";
  	this.rooms = {};
}

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
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

  // End of custom Services and Characteristics


  homebridge.registerPlatform("homebridge-fibaro-hc2", "FibaroHC2", FibaroHC2Platform);
}

FibaroHC2Platform.prototype = {
  accessories: function(callback) {
    this.log("Fetching Fibaro Home Center rooms...");
    var that = this;
  	var url = "http://"+this.host+"/api/rooms";

    request.get({
      url: url,
      headers : {
            "Authorization" : this.auth
      },
      json: true
    }, function(err, response, json) {
      if (!err && response.statusCode == 200) {
        if (json != undefined) {
        	json.map(function(s, i, a) {
        		that.rooms[s.id] = s.name;
        	});
        	that.getFibaroDevices(callback);
        }
      }
    });
  },
  getFibaroDevices: function(callback) {
    this.log("Fetching Fibaro Home Center devices...");
    var that = this;
    var foundAccessories = [];

    request.get({
      url: this.url,
      headers : {
            "Authorization" : this.auth
      },
      json: true
    }, function(err, response, json) {
      if (!err && response.statusCode == 200) {
        if (json != undefined) {
		  // Order results by roomID
		  json.sort(function compare(a, b) {
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
          json.map(function(s, i, a) {
          	that.log("Found: " + s.type);
         	if (s.visible == true && s.name.charAt(0) != "_") {
          		if (s.roomID != currentRoomID) {
          			if (services.length != 0) {
						foundAccessories.push(that.createAccessory(services, that, currentRoomID));
						services = [];
					}
					currentRoomID = s.roomID;
				}
          		if (s.type == "com.fibaro.multilevelSwitch")
   					service = {controlService: new Service.Lightbulb(s.name), characteristics: [Characteristic.On, Characteristic.Brightness]};
				else if (s.type == "com.fibaro.FGRGBW441M" || s.type == "com.fibaro.colorController")
            		service = {controlService: new Service.Lightbulb(s.name), characteristics: [Characteristic.On, Characteristic.Brightness, Characteristic.Hue, Characteristic.Saturation]};
				else if (s.type == "com.fibaro.FGRM222" || s.type == "com.fibaro.FGR221")
            		service = {controlService: new Service.WindowCovering(s.name), characteristics: [Characteristic.CurrentPosition, Characteristic.TargetPosition, Characteristic.PositionState]};
				else if (s.type == "com.fibaro.binarySwitch" || s.type == "com.fibaro.developer.bxs.virtualBinarySwitch")
            		service = {controlService: new Service.Switch(s.name), characteristics: [Characteristic.On]};
				else if (s.type == "com.fibaro.FGMS001" || s.type == "com.fibaro.motionSensor")
            		service = {controlService: new Service.MotionSensor(s.name), characteristics: [Characteristic.MotionDetected]};
				else if (s.type == "com.fibaro.temperatureSensor")
            		service = {controlService: new Service.TemperatureSensor(s.name), characteristics: [Characteristic.CurrentTemperature]};
				else if (s.type == "com.fibaro.doorSensor" || s.type == "com.fibaro.windowSensor")
            		service = {controlService: new Service.ContactSensor(s.name), characteristics: [Characteristic.ContactSensorState]};
				else if (s.type == "com.fibaro.lightSensor")
            		service = {controlService: new Service.LightSensor(s.name), characteristics: [Characteristic.CurrentAmbientLightLevel]};
            	else if (s.type == "com.fibaro.FGWP101")
            		service = {controlService: new Service.Outlet(s.name), characteristics: [Characteristic.On, Characteristic.OutletInUse]};
            	else if (s.type == "com.fibaro.thermostatDanfoss")
            		service = {controlService: new Service.DanfossRadiatorThermostat(s.name), characteristics: [Characteristic.CurrentTemperature, Characteristic.TargetTemperature, Characteristic.TimeInterval]};
            	else if (s.type == "virtual_device") {
            		for (var r = 0; r < s.properties.rows.length; r++) {
            			if (s.properties.rows[r].type == "button") {
            				for (var e = 0; e < s.properties.rows[r].elements.length; e++) {
            					service = {
            						controlService: new Service.Switch(s.properties.rows[r].elements[e].caption),
            						characteristics: [Characteristic.On]
            					};
								service.controlService.subtype = s.id + "-" + s.properties.rows[r].elements[e].id; // For Virtual devices it is device_id + "-" + button_id
								service.controlService.isVirtual = true;
            					services.push(service);
            				}
            			} 
            		}
            		service = null;
            	}
            	if (service != null) {
					service.controlService.subtype = s.id + "-"; // For not Virtual devices it is device_id
   					services.push(service);
            		service = null;
            	}
			}
          });
		  if (services.length != 0) {
			foundAccessories.push(that.createAccessory(services, that, currentRoomID));
		  }
        }
//        Only for test purposes
/*          		var accessory = null;
           		accessory = new FibaroBridgedAccessory([{controlService: new Service.DanfossRadiatorThermostat("Prova termostato"), characteristics: [Characteristic.CurrentTemperature, Characteristic.TargetTemperature, Characteristic.TimeInterval]}]);
				accessory.getServices = function() {
					return that.getServices(accessory);
				};
				accessory.platform 			= that;
			  	accessory.remoteAccessory	= null;
				accessory.id 				= null;
				accessory.uuid_base			= null;
				accessory.name				= "Prova termostato";
				accessory.model				= "Danfoss Radiator Thermostat";
				accessory.manufacturer		= "Danfoss";
				accessory.serialNumber		= "<unknown>";
           		foundAccessories.push(accessory); */
//        End test
        callback(foundAccessories);
       	startPollingUpdate( that );

      } else {
        that.log("There was a problem connecting with FibaroHC2.");
      }
    });

  },
  createAccessory: function(services, that, currentRoomID) {
	var accessory = new FibaroBridgedAccessory(services);
	accessory.getServices = function() {
			return that.getServices(accessory);
	};
	accessory.platform 			= that;
//	accessory.remoteAccessory	= s;
//	accessory.id 				= s.id;
//	accessory.uuid_base			= s.id;
	accessory.name				= that.rooms[currentRoomID] + "-Devices";
	accessory.model				= "HomeCenterBridgedAccessory";
	accessory.manufacturer		= "IlCato";
	accessory.serialNumber		= "<unknown>";
	return accessory;
  },
  command: function(c,value, that, service, IDs) {
    var url = "http://"+this.host+"/api/devices/"+IDs[0]+"/action/"+c;
  	var body = value != undefined ? JSON.stringify({
		  "args": [	value ]
	}) : null;
	var method = "post";
    request({
	    url: url,
    	body: body,
		method: method,
        headers: {
            "Authorization" : this.auth
    	}
    }, function(err, response) {
      if (err) {
        that.platform.log("There was a problem sending command " + c + " to" + that.name);
        that.platform.log(url);
      } else {
        that.platform.log(that.name + " sent command " + c);
        that.platform.log(url);
      }
    });
  },
  getAccessoryValue: function(callback, returnBoolean, homebridgeAccessory, characteristic, service, IDs) {
  	var powerValue = false;
  	var intervalValue = false;
    var url = "http://"+homebridgeAccessory.platform.host+"/api/devices/"+IDs[0]+"/properties/";
	if (characteristic.UUID == (new Characteristic.OutletInUse()).UUID) {
    	url = url + "power";
    	powerValue = true;
	} else if (characteristic.UUID == (new Characteristic.TimeInterval()).UUID) {
    	url = url + "timestamp";
    	intervalValue = true;
	} else if (characteristic.UUID == (new Characteristic.TargetTemperature()).UUID)
    	url = url + "targetLevel";
    else    
    	url = url + "value";
    	
    request.get({
          headers : {
            "Authorization" : homebridgeAccessory.platform.auth
      },
      json: true,
      url: url
    }, function(err, response, json) {
      homebridgeAccessory.platform.log(url);
      if (!err && response.statusCode == 200) {
      	if (powerValue) {
      		callback(undefined, parseFloat(json.value) > 1.0 ? true : false);
      	} else if (returnBoolean)
      	   	callback(undefined, json.value == 0 ? 0 : 1);
		else if (intervalValue) {
			var t = (new Date()).getTime();
			t = json.value - t;
			if (t < 0) t = 0;
	      	callback(undefined, t);
	    } else
	    	callback(undefined, json.value);
      } else {
        homebridgeAccessory.platform.log("There was a problem getting value from" + service.controlService.subtype);
      }
    })
  },
  getInformationService: function(homebridgeAccessory) {
    var informationService = new Service.AccessoryInformation();
    informationService
                .setCharacteristic(Characteristic.Name, homebridgeAccessory.name)
				.setCharacteristic(Characteristic.Manufacturer, homebridgeAccessory.manufacturer)
			    .setCharacteristic(Characteristic.Model, homebridgeAccessory.model)
			    .setCharacteristic(Characteristic.SerialNumber, homebridgeAccessory.serialNumber);
  	return informationService;
  },
  bindCharacteristicEvents: function(characteristic, service, homebridgeAccessory) {
	var onOff = characteristic.props.format == "bool" ? true : false;
  	var readOnly = true;
  	for (var i = 0; i < characteristic.props.perms.length; i++)
		if (characteristic.props.perms[i] == "pw")
			readOnly = false;
	var IDs = service.controlService.subtype.split("-"); // IDs[0] is always device ID; for virtual device IDs[1] is the button ID
	if (!service.controlService.isVirtual) {
	    subscribeUpdate(service, characteristic, homebridgeAccessory, onOff); // TODO CHECK
	}
	if (!readOnly) {
    	characteristic
    	    .on('set', function(value, callback, context) {
        	            	if( context !== 'fromFibaro' && context !== 'fromSetValue') {
        	            		if (characteristic.UUID == (new Characteristic.On()).UUID && service.controlService.isVirtual) {
									// It's a virtual device so the command is pressButton and not turnOn or Off
									homebridgeAccessory.platform.command("pressButton", IDs[1], homebridgeAccessory, service, IDs);
									// In order to behave like a push button reset the status to off
							    	setTimeout( function(){
							    		characteristic.setValue(false, undefined, 'fromSetValue');
							    	}, 100 );
        	            		} else if (characteristic.UUID == (new Characteristic.On()).UUID) {
									homebridgeAccessory.platform.command(value == 0 ? "turnOff": "turnOn", null, homebridgeAccessory, service, IDs);
        	            		} else if (characteristic.UUID == (new Characteristic.TargetTemperature()).UUID) {
									homebridgeAccessory.platform.command("setTargetLevel", value, homebridgeAccessory, service, IDs);
        	            		} else if (characteristic.UUID == (new Characteristic.TimeInterval()).UUID) {
									homebridgeAccessory.platform.command("setTime", value + (new Date()).getTime(), homebridgeAccessory, service, IDs);
								} else if (characteristic.UUID == (new Characteristic.Hue()).UUID) {
									// TODO: implement characteristic, need to maintain the status of all 3 parameters
								} else if (characteristic.UUID == (new Characteristic.Saturation()).UUID) {
									// TODO: implement characteristic, need to maintain the status of all 3 parameters
								} else if (characteristic.UUID == (new Characteristic.Brightness()).UUID) {
									homebridgeAccessory.platform.command("setValue", value, homebridgeAccessory, service, IDs);
									// TODO: implement characteristic, need to maintain the status of all 3 parameters
								} else {
									homebridgeAccessory.platform.command("setValue", value, homebridgeAccessory, service, IDs);
								}
							} 
   	            			callback();
        	           }.bind(this) );
    }
    characteristic
        .on('get', function(callback) {
     	            	if (service.controlService.isVirtual) {
     	            		// a push button is normally off
					      	callback(undefined, false);
     	            	} else {
					  		homebridgeAccessory.platform.getAccessoryValue(callback, onOff, homebridgeAccessory, characteristic, service, IDs);
						}
                   }.bind(this) );
  },
  getServices: function(homebridgeAccessory) {
  	var services = [];
  	var informationService = homebridgeAccessory.platform.getInformationService(homebridgeAccessory);
  	services.push(informationService);
  	for (var s = 0; s < homebridgeAccessory.services.length; s++) {
		var service = homebridgeAccessory.services[s];
		for (var i=0; i < service.characteristics.length; i++) {
			var characteristic = service.controlService.getCharacteristic(service.characteristics[i]);
			if (characteristic == undefined)
				characteristic = service.controlService.addCharacteristic(service.characteristics[i]);
			homebridgeAccessory.platform.bindCharacteristicEvents(characteristic, service, homebridgeAccessory);
		}
		services.push(service.controlService);
    }
    return services;
  }  
}

function FibaroBridgedAccessory(services) {
    this.services = services;
}


var lastPoll=0;
var pollingUpdateRunning = false;

function startPollingUpdate( platform )
{
	if( pollingUpdateRunning )
    	return;
  	pollingUpdateRunning = true;
  	
  	var updateUrl = "http://"+platform.host+"/api/refreshStates?last="+lastPoll;

  	request.get({
      url: updateUrl,
      headers : {
            "Authorization" : platform.auth
      },
      json: true
    }, function(err, response, json) {
      	if (!err && response.statusCode == 200) {
        	if (json != undefined) {
        		lastPoll = json.last;
        		if (json.changes != undefined) {
          			json.changes.map(function(s) {
          				if (s.value != undefined) {
          					
          					var value=parseInt(s.value);
          					if (isNaN(value))
          						value=(s.value === "true");
          					for (var i=0;i<updateSubscriptions.length; i++) {
          						var subscription = updateSubscriptions[i];
          						if (subscription.id == s.id) {
								  	var powerValue = false;
  									var intervalValue = false;
									if (subscription.characteristic.UUID == (new Characteristic.OutletInUse()).UUID)
								    	powerValue = true;
									if (subscription.characteristic.UUID == (new Characteristic.TimeInterval()).UUID)
								    	intervalValue = true;
								    	
          							if (s.power != undefined && powerValue)
          								subscription.characteristic.setValue(parseFloat(s.power) > 1.0 ? true : false, undefined, 'fromFibaro');
          							else if ((subscription.onOff && typeof(value) == "boolean") || !subscription.onOff)
	    	      						subscription.characteristic.setValue(value, undefined, 'fromFibaro');
          							else
	    	      						subscription.characteristic.setValue(value == 0 ? false : true, undefined, 'fromFibaro');
          						}
          					}
          				}
          			});
          		}
        	}
      	} else {
        	platform.log("There was a problem connecting with FibaroHC2.");
      	}
	  	pollingUpdateRunning = false;
    	setTimeout( function(){startPollingUpdate(platform)}, 2000 );
    });

}

var updateSubscriptions = [];
function subscribeUpdate(service, characteristic, accessory, onOff)
{
// TODO: optimized management of updateSubscription data structure (no array with sequential access)
  var IDs = service.controlService.subtype.split("-"); // IDs[0] is always device ID; for virtual device IDs[1] is the button ID
  updateSubscriptions.push({ 'id': IDs[0], 'service': service, 'characteristic': characteristic, 'accessory': accessory, 'onOff': onOff });
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