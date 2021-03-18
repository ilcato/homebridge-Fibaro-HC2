//    Copyright 2018 ilcato
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.

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
//            "pollerperiod": "PUT 0 FOR DISABLING POLLING, 1 - 100 INTERVAL IN SECONDS. 5 SECONDS IS THE DEFAULT",
//            "securitysystem": "PUT enabled OR disabled IN ORDER TO MANAGE THE AVAILABILITY OF THE SECURITY SYSTEM",
//            "switchglobalvariables": "PUT A COMMA SEPARATED LIST OF HOME CENTER GLOBAL VARIABLES ACTING LIKE A BISTABLE SWITCH",
//            "adminUsername": "PUT ADMIN USERNAME OF YOUR HC2 HERE TO SET GLOBAL VARIABLES",
//            "adminPassword": "PUT ADMIN PASSWORD OF YOUR HC2 HERE TO SET GLOBAL VARIABLES",
//            "thermostattimeout": "PUT THE NUMBER OF SECONDS FOR THE THERMOSTAT TIMEOUT, DEFAULT: 7200 (2 HOURS). PUT 0 FOR INFINITE",
//            "enablecoolingstatemanagemnt": "PUT on TO AUTOMATICALLY MANAGE HEATING STATE FOR THERMOSTAT, off TO DISABLE IT. DEFAULT off",
//            "doorlocktimeout": "PUT 0 FOR DISABLING THE CHECK. PUT A POSITIVE INTEGER N NUMBER ENABLE IT AFTER N SECONDS. DEFAULT 0",
//            "IFTTTmakerkey": "PUT KEY OF YOUR MAKER CHANNEL HERE (USED TO SIGNAL EVENTS TO THE OUTSIDE)",
//            "enableIFTTTnotification": "PUT all FOR ENABLING NOTIFICATIONS OF ALL KIND OF EVENTS, hc FOR CHANGE EVENTS COMING FROM HOME CENTER, hk FOR CHANGE EVENTS COMING FROM HOMEKIT, none FOR DISABLING NOTIFICATIONS; DEFAULT IS none",
//            "LockCurrentStateDelay": "PUT THE NUMBER OF SECONDS (DEFAULT 2) TO DELAY THE UPDATE OF LockCurrentState READ EVENT",
//            "LockTargetStateDelay": "PUT THE NUMBER OF SECONDS (DEFAULT 2) TO DELAY THE UPDATE OF LockTargetState READ EVENT",
//            "FibaroTemperatureUnit": "PUT TEMPERATURE UNIT C OR F, C IS THE DEFAULT"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict'

import request = require("request");

import { FibaroClient } from './fibaro-api'
import {
	pluginName,
	platformName,
	ShadowAccessory
} from './shadows'
import { SetFunctions } from './setFunctions'
import { GetFunctions } from './getFunctions'
import { Poller } from './pollerupdate'

const defaultPollerPeriod = 5;
const timeOffset = 2 * 3600;
const defaultEnableCoolingStateManagemnt = "off";

let Accessory,
	Service,
	HapStatusError,
	HAPStatus,
	Characteristic,
	UUIDGen;

export = function (homebridge) {
	Accessory = homebridge.platformAccessory
	Service = homebridge.hap.Service
	HapStatusError = homebridge.hap.HapStatusError
	HAPStatus = homebridge.hap.HAPStatus;
	Characteristic = homebridge.hap.Characteristic
	UUIDGen = homebridge.hap.uuid
	homebridge.registerPlatform(pluginName, platformName, FibaroHC2, true)
}

class Config {
	name: string;
	host: string;
	username: string;
	password: string;
	pollerperiod?: string;
	securitysystem?: string;
	switchglobalvariables?: string;
	adminUsername?: string;
	adminPassword?: string;
	thermostattimeout?: string;
	enablecoolingstatemanagemnt?: string;
	doorlocktimeout?: string;
	IFTTTmakerkey?: string;
	enableIFTTTnotification?: string;
	LockCurrentStateDelay?: string;
	LockTargetStateDelay?: string;
	FibaroTemperatureUnit?: string;
	constructor() {
		this.name = "";
		this.host = "";
		this.username = "";
		this.password = "";
	}
}

class FibaroHC2 {
	log: (format: string, message: any) => void;
	config: Config;
	api: any;
	accessories: Map<string, any>;
	updateSubscriptions: Array<Object>;
	poller?: Poller;
	securitySystemScenes: Object;
	securitySystemService: Object;
	fibaroClient?: FibaroClient;
	setFunctions?: SetFunctions;
	getFunctions?: GetFunctions;


	constructor(log: (format: string, message: any) => void, config: Config, api: any) {
		this.log = log;
		this.api = api;

		this.accessories = new Map();
		this.updateSubscriptions = new Array();
		this.securitySystemScenes = {};
		this.securitySystemService = {};
		this.config = config;

		if (!config) {
			this.log('Fibaro HC2 configuration:', 'cannot find configuration for the plugin');
			return;
		}
		let pollerPeriod = this.config.pollerperiod ? parseInt(this.config.pollerperiod) : defaultPollerPeriod;
		if (isNaN(pollerPeriod) || pollerPeriod < 0 || pollerPeriod > 100)
			pollerPeriod = defaultPollerPeriod;
		if (this.config.securitysystem == undefined || (this.config.securitysystem != "enabled" && this.config.securitysystem != "disabled"))
			this.config.securitysystem = "disabled";
		if (this.config.switchglobalvariables == undefined)
			this.config.switchglobalvariables = "";
		if (this.config.adminUsername == undefined)
			this.config.adminUsername = this.config.username;
		if (this.config.adminPassword == undefined)
			this.config.adminPassword = this.config.password;
		if (this.config.thermostattimeout == undefined)
			this.config.thermostattimeout = timeOffset.toString();
		if (this.config.enablecoolingstatemanagemnt == undefined)
			this.config.enablecoolingstatemanagemnt = defaultEnableCoolingStateManagemnt;
		if (this.config.doorlocktimeout == undefined)
			this.config.doorlocktimeout = "0";
		if (this.config.IFTTTmakerkey == undefined)
			this.config.IFTTTmakerkey = "";
		if (this.config.enableIFTTTnotification == undefined || this.config.enableIFTTTnotification == "")
			this.config.enableIFTTTnotification = "none";
		if (this.config.LockCurrentStateDelay == undefined)
			this.config.LockCurrentStateDelay = "2";
		if (this.config.LockTargetStateDelay == undefined)
			this.config.LockTargetStateDelay = "2";
		if (this.config.FibaroTemperatureUnit == undefined)
			this.config.FibaroTemperatureUnit = "C";
		this.fibaroClient = new FibaroClient(this.config.host, this.config.username, this.config.password, this.config.adminUsername, this.config.adminPassword);
		if (pollerPeriod != 0)
			this.poller = new Poller(this, pollerPeriod, Service, Characteristic);
		this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));

		this.getFunctions = new GetFunctions(Characteristic, this);
	}
	didFinishLaunching() {
		this.log('didFinishLaunching.', '');
		if (!this.fibaroClient)
			return;
		this.fibaroClient.getScenes()
			.then((scenes) => {
				this.mapSceneIDs(scenes);
				this.setFunctions = new SetFunctions(Characteristic, this);	// There's a dependency in setFunction to Scene Mapping
				return this.fibaroClient ? this.fibaroClient.getDevices() : {};
			})
			.then((devices) => {
				this.LoadAccessories(devices);
			})
			.catch((err) => {
				this.log("Error getting data from Home Center: ", err);
				throw new Error("Startup error: get scenes or devices");
			});
	}
	configureAccessory(accessory) {
		for (let s = 0; s < accessory.services.length; s++) {
			let service = accessory.services[s];
			if (service.subtype != undefined) {
				let subtypeParams = service.subtype.split("-"); // DEVICE_ID-VIRTUAL_BUTTON_ID-RGB_MARKER-OPERATING_MODE_ID-FLOAT_SVC_ID
				if (subtypeParams.length >= 3 && subtypeParams[2] == "RGB") {
					// For RGB devices add specific attributes for managing it
					service.HSBValue = { hue: 0, saturation: 0, brightness: 0 };
					service.RGBValue = { red: 0, green: 0, blue: 0 };
					service.countColorCharacteristics = 2;
					service.timeoutIdColorCharacteristics = 0;
				}
				if (subtypeParams.length >= 4) {
					service.operatingModeId = subtypeParams[3];
				}
				if (subtypeParams.length >= 5) {
					service.floatServiceId = subtypeParams[4];
				}
			}
			for (let i = 0; i < service.characteristics.length; i++) {
				let characteristic = service.characteristics[i];
				this.bindCharacteristicEvents(characteristic, service);
			}
		}
		this.log("Configured Accessory: ", accessory.displayName);
		this.accessories.set(accessory.context.uniqueSeed, accessory);
		accessory.reachable = true;
	}
	LoadAccessories(devices) {
		this.log('Loading accessories', '');
		devices.map((s, i, a) => {
			if (s.visible == true && s.name.charAt(0) != "_") {
				let siblings = this.findSiblingDevices(s, a);
				this.addAccessory(ShadowAccessory.createShadowAccessory(s, siblings, Accessory, Service, Characteristic, this));
			}
		});

		// Create Thermostats based on heating and AC zones

		// Create Security System accessory
		if (this.config.securitysystem == "enabled") {
			let device = { name: "FibaroSecuritySystem", roomID: 0, id: 0 };
			let sa = ShadowAccessory.createShadowSecuritySystemAccessory(device, Accessory, Service, Characteristic, this);
			this.addAccessory(sa);
		}

		// Create Global Variable Switches
		if (this.config.switchglobalvariables && this.config.switchglobalvariables != "") {
			let globalVariables = this.config.switchglobalvariables.replace(/\s/g, "").split(',');
			for (let i = 0; i < globalVariables.length; i++) {
				let device = { name: globalVariables[i], roomID: 0, id: 0 };
				let sa = ShadowAccessory.createShadowGlobalVariableSwitchAccessory(device, Accessory, Service, Characteristic, this);
				this.addAccessory(sa);
			}
		}
		// Remove not reviewd accessories: cached accessories no more present in Home Center
		let accessories = this.accessories.values() // Iterator for accessories, key is the uniqueseed
		for (let a of accessories) {
			if (!a.reviewed) {
				this.removeAccessory(a);
			}
		}
		// Start the poller update mechanism
		if (this.poller)
			this.poller.poll();
	}

	addAccessory(shadowAccessory) {
		if (shadowAccessory == undefined)
			return;
		let uniqueSeed = shadowAccessory.name + shadowAccessory.roomID;
		let isNewAccessory = false;
		let a: any = this.accessories.get(uniqueSeed);
		if (a == null) {
			isNewAccessory = true;
			let uuid = UUIDGen.generate(uniqueSeed);
			a = new Accessory(shadowAccessory.name, uuid); // Create the HAP accessory
			a.context.uniqueSeed = uniqueSeed;
			this.accessories.set(uniqueSeed, a);
		}
		// Store SecuritySystem Accessory
		if (this.config.securitysystem == "enabled" && shadowAccessory.isSecuritySystem) {
			this.securitySystemService = a.getService(Service.SecuritySystem);
		}
		shadowAccessory.setAccessory(a);
		// init accessory
		shadowAccessory.initAccessory();
		// Remove services existing in HomeKit, device no more present in Home Center
		shadowAccessory.removeNoMoreExistingServices();
		// Add services present in Home Center and not existing in Homekit accessory
		shadowAccessory.addNewServices(this);
		// Register or update platform accessory
		shadowAccessory.registerUpdateAccessory(isNewAccessory, this.api);
		this.log("Added/changed accessory: ", shadowAccessory.name);
	}

	removeAccessory(accessory) {
		this.log('Remove accessory', accessory.displayName);
		this.api.unregisterPlatformAccessories(pluginName, platformName, [accessory]);
		this.accessories.delete(accessory.context.uniqueSeed);
	}

	bindCharacteristicEvents(characteristic, service) {
		if (service.subtype == undefined) return;
		let IDs = service.subtype.split("-"); // IDs[0] is always device ID; for virtual device IDs[1] is the button ID
		service.isVirtual = IDs[1] != "" ? true : false;
		service.isSecuritySystem = IDs[0] == "0" ? true : false;
		service.isGlobalVariableSwitch = IDs[0] == "G" ? true : false;
		service.isHarmonyDevice = (IDs.length >= 4 && IDs[4] == "HP") ? true : false;
		service.isLockSwitch = (IDs.length >= 4 && IDs[4] == "LOCK") ? true : false;

		if (!service.isVirtual) {
			var propertyChanged = "value"; // subscribe to the changes of this property
			if (service.HSBValue != undefined)
				propertyChanged = "valueandcolor";
			if (service.operatingModeId != undefined) {
				if (characteristic.UUID == (new Characteristic.CurrentHeatingCoolingState()).UUID || characteristic.UUID == (new Characteristic.TargetHeatingCoolingState()).UUID) {
					propertyChanged = "mode";
				}
			}
			if (service.UUID == (Service.WindowCovering.UUID) && (characteristic.UUID == (new Characteristic.CurrentHorizontalTiltAngle).UUID)) {
				propertyChanged = "value2";
			}
			if (service.UUID == (Service.WindowCovering.UUID) && (characteristic.UUID == (new Characteristic.TargetHorizontalTiltAngle).UUID)) {
				propertyChanged = "value2";
			}
			this.subscribeUpdate(service, characteristic, propertyChanged);
		}
		characteristic.on('set', (value, callback, context) => {
			this.setCharacteristicValue(value, callback, context, characteristic, service, IDs);
		});
		characteristic.on('get', (callback) => {
			if (characteristic.UUID == (new Characteristic.Name()).UUID) {
				callback(undefined, characteristic.value);
				return;
			}
			if (service.isVirtual && !service.isGlobalVariableSwitch) {
				// a push button is normally off
				callback(undefined, false);
			} else {
				this.getCharacteristicValue(callback, characteristic, service, IDs);
			}
		});
	}

	setCharacteristicValue(value, callback, context, characteristic, service, IDs) {
		if (context !== 'fromFibaro' && context !== 'fromSetValue') {
			let d = IDs[0] != "G" ? IDs[0] : IDs[1];
			this.log("Setting value to device: ", `${d}  parameter: ${characteristic.displayName}`);
			if (this.setFunctions) {
				let setFunction = this.setFunctions.setFunctionsMapping.get(characteristic.UUID);
				if (setFunction)
					setFunction.call(this.setFunctions, value, callback, context, characteristic, service, IDs);
			}
		}
		callback();
	}

	getCharacteristicValue(callback, characteristic, service, IDs) {
		this.log("Getting value from device: ", `${IDs[0]}  parameter: ${characteristic.displayName}`);
		// Manage security system status
		if (service.isSecuritySystem) {
			if (!this.fibaroClient) return;
			this.fibaroClient.getGlobalVariable("SecuritySystem")
				.then((securitySystemStatus) => {
					if (this.getFunctions)
						this.getFunctions.getSecuritySystemState(null, characteristic, service, IDs, securitySystemStatus);				})
				.catch((err) => {
					this.log("There was a problem getting value from Global Variable: SecuritySystem", ` - Err: ${err}`);
				});
			callback(undefined, characteristic.value);
			return;
		}
		// Manage global variable switches
		if (service.isGlobalVariableSwitch) {
			if (!this.fibaroClient) return;
			this.fibaroClient.getGlobalVariable(IDs[1])
				.then((switchStatus) => {
					if (this.getFunctions)
						this.getFunctions.getBool(null, characteristic, service, IDs, switchStatus);
				})
				.catch((err) => {
					this.log("There was a problem getting value from Global Variable: ", `${IDs[1]} - Err: ${err}`);
				});
			callback(undefined, characteristic.value);
			return;
		}
		// Manage all other status
		if (!this.getFunctions) return;
		let getFunction = this.getFunctions.getFunctionsMapping.get(characteristic.UUID);
		if (getFunction) {
			setTimeout(() => {
				if (!this.fibaroClient) return;
				this.fibaroClient.getDeviceProperties(IDs[0])
					.then((properties: any) => {
						if (getFunction.function) {
							if (this.config.FibaroTemperatureUnit == "F") {
								if (characteristic.displayName == 'Current Temperature') {
									properties.value = (properties.value - 32) * 5 / 9;
								}
							}
							if (properties.hasOwnProperty('dead') && properties.dead === false) {
								characteristic.updateValue(new HapStatusError(HAPStatus.SERVICE_COMMUNICATION_FAILURE))
							} else {
								getFunction.function.call(this.getFunctions, null, characteristic, service, IDs, properties);
							}
							characteristic.updateValue()
						}
						else
							this.log("No get function defined for: ", `${characteristic.displayName}`);
					})
					.catch((err) => {
						this.log("There was a problem getting value from: ", `${IDs[0]} - Err: ${err}`);
					});
			}, getFunction.delay * 1000);
		}
		callback(undefined, characteristic.value);
	}

	subscribeUpdate(service, characteristic, propertyChanged) {
		var IDs = service.subtype.split("-"); 							// IDs[0] is always device ID; for virtual device IDs[1] is the button ID
		this.updateSubscriptions.push({ 'id': IDs[0], 'service': service, 'characteristic': characteristic, "property": propertyChanged });
	}

	mapSceneIDs(scenes) {
		if (this.config.securitysystem == "enabled") {
			scenes.map((s) => {
				this.securitySystemScenes[s.name] = s.id;
			});
		}
	}
	findSiblingDevices(device, devices) {
		let siblings = new Map<string, object>();

		devices.map((s, i, a) => {
			if (s.visible == true && s.name.charAt(0) != "_") {
				if (device.parentId == s.parentId && device.id != s.id) {
					siblings.set(s.type, s);
				}
			}
		});

		return siblings;
	}

	notifyIFTTT(e, val1, val2, val3) {
		if (this.config.IFTTTmakerkey == "") return;
		if (val2 == undefined) val2 = "";
		if (val3 == undefined) val3 = "";

		var url = "https://maker.ifttt.com/trigger/" + e + "/with/key/" + this.config.IFTTTmakerkey + "?value1=" + val1 + "&value2=" + val2 + "&value3=" + val3;
		var method = "get";
		var that = this;
		request({
			url: url,
			method: method
		}, function (err, response) {
			if (err) {
				that.log("There was a problem sending event: ", `${e}, to: ${that.config.IFTTTmakerkey} - Err: ${err}`);
			} else {
				that.log("Sent event: ", `${e}, to: ${that.config.IFTTTmakerkey}, for ${val1}`);
			}
		});
	}

}
