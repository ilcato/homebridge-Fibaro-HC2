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
//            "securitysystem": "PUT enabled OR disabled IN ORDER TO MANAGE THE AVAILABILITY OF THE SECURITY SYSTEM"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict'

import {FibaroClient} from './fibaro-api'
import {	pluginName,
			platformName, 
			ShadowService, 
			ShadowAccessory,
			ShadowSecuritySystem} from './shadows'
import {SetFunctions} from './setFunctions'
import {GetFunctions} from './getFunctions'
import {Poller} from './pollerupdate'

let Accessory: any,
	Service: any,
	Characteristic: any,
	UUIDGen: any;

export = function (homebridge) {
	Accessory = homebridge.platformAccessory
	Service = homebridge.hap.Service
	Characteristic = homebridge.hap.Characteristic
	UUIDGen = homebridge.hap.uuid
	homebridge.registerPlatform(pluginName, platformName, FibaroHC2, true)
}

class Config {
	host: string;
  	username: string;
  	password: string;
  	pollerperiod?: any;
  	securitysystem?: string;
}

class FibaroHC2 {
	log: (format: string, message: any) => void;
	config: Config;
  	api: any;
	accessories: Map<string, any>;
	updateSubscriptions: any[];
  	poller: Poller;
  	securitySystemScenes: any;
  	securitySystemService: any;
  	fibaroClient: FibaroClient;
  	setFunctions: SetFunctions;
  	getFunctions: GetFunctions;

	  	
  	constructor (log: (format: string, message: any) => void, config: Config, api) {
    	this.log = log;
    	this.api = api;

		this.accessories = new Map();
	  	this.updateSubscriptions = new Array();
	  	this.securitySystemScenes = {};
	  	this.securitySystemService = null;
		this.config = config;
		
  		if (this.config.pollerperiod == undefined)
  			this.config.pollerperiod = 5;
  		else
  			this.config.pollerperiod = parseInt(this.config.pollerperiod);
  		if (this.config.securitysystem == undefined || (this.config.securitysystem != "enabled" && this.config.securitysystem != "disabled"))
	  		this.config.securitysystem = "disabled";

		this.fibaroClient = new FibaroClient(this.config.host, this.config.username, this.config.password);
  		this.poller = new Poller(this, this.config.pollerperiod, Characteristic);

    	this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
    	
    	this.setFunctions = new SetFunctions(Characteristic, this);
    	this.getFunctions = new GetFunctions(Characteristic, this);
  	}
  	didFinishLaunching () { 
	    this.log('didFinishLaunching.', '')
		this.fibaroClient.getScenes()
			.then((scenes) => {
				this.mapSceneIDs(scenes);
				return this.fibaroClient.getDevices();
			})
			.then((devices) => {
				this.LoadAccessories(devices);    		
			})
			.catch((err) => {
				this.log("Error getting data from Home Center: ", err);
			});
  	}
  	configureAccessory (accessory) {
		for (let s = 0; s < accessory.services.length; s++) {
			let service = accessory.services[s];
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
			for (let i = 0; i < service.characteristics.length; i++) {
				let characteristic = service.characteristics[i];
				if (characteristic.props.needsBinding)
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
				this.addAccessory(ShadowAccessory.createShadowAccessory(s, Accessory, Service, Characteristic, this));
			}
		});
		// Create Security System accessory
		if (this.config.securitysystem == "enabled") {
			let device = {name: "FibaroSecuritySystem", roomID: 0, id: 0};
			let sa = new ShadowSecuritySystem(device, Accessory, Service, Characteristic, this);

			this.addAccessory(sa);
		}
		
		// Remove not reviewd accessories: cached accessories no more present in Home Center
		let accessories = this.accessories.values() // Iterator for accessories, key is the uniqueseed
		for (let a of accessories) {
			if (!a.reviewed) {
				this.removeAccessory(a);
			}
		}

		if (this.config.pollerperiod >= 1 && this.config.pollerperiod <= 100)
			this.startPollingUpdate();
  	}
  	addAccessory (shadowAccessory) {
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
		shadowAccessory.resgisterUpdateccessory(isNewAccessory, this.api);
		this.log("Added/changed accessory: ", shadowAccessory.name);
  	}

	removeAccessory (accessory) {
	    this.log('Remove accessory', accessory.displayName);
		this.api.unregisterPlatformAccessories(pluginName, platformName, [accessory]);
		this.accessories.delete(accessory.context.uniqueSeed);
	}
	
	bindCharacteristicEvents(characteristic, service) {
		let IDs = service.subtype.split("-"); // IDs[0] is always device ID; for virtual device IDs[1] is the button ID
		service.isVirtual = IDs[1] != "" ? true : false;
		if (!service.isVirtual) {
			var propertyChanged = "value"; // subscribe to the changes of this property
			if (service.HSBValue != undefined)
				propertyChanged = "color";	 		
			this.subscribeUpdate(service, characteristic, propertyChanged); 
		}
		characteristic.on('set', (value, callback, context) => {
			this.setCharacteristicValue(value, callback, context, characteristic, service, IDs);
		});
		characteristic.on('get', (callback) => {
			if (service.isVirtual) {
				// a push button is normally off
				callback(undefined, false);
			} else {
				this.getCharacteristicValue(callback, characteristic, service, IDs);
			}
		});
	}
	
	setCharacteristicValue(value, callback, context, characteristic, service, IDs) {
		if( context !== 'fromFibaro' && context !== 'fromSetValue') {
			let setFunction = this.setFunctions.setFunctionsMapping.get(characteristic.UUID);
			if (setFunction)
				setFunction.call(this.setFunctions, value, callback, context, characteristic, service, IDs);
		}
		callback();
	}
	
	getCharacteristicValue(callback, characteristic, service, IDs) {
		// Manage security system status
		if (IDs[0] == "0") { 
			this.fibaroClient.getGlobalVariable("SecuritySystem")
				.then((securitySystemStatus) => {
					this.getFunctions.setSecuritySystemTargetState(callback, characteristic, service, IDs, securitySystemStatus);
				})
				.catch((err) =>{
					this.log("There was a problem getting value from Global Variable: SecuritySystem", " - Err: " + err);
					callback(err, null);
				});
			return;
		}
		// Manage all other status
		this.fibaroClient.getDeviceProperties(IDs[0])
			.then((properties) => {
				this.log("Getting value from: ", IDs[0] + " " + characteristic.displayName);
				let getFunction = this.getFunctions.getFunctionsMapping.get(characteristic.UUID);
				if (getFunction)
					getFunction.call(this.getFunctions, callback, characteristic, service, IDs, properties);
			})
			.catch((err) => {
				this.log("There was a problem getting value from: ", IDs[0] + " - Err: " + err);
				callback(err, null);
			});
	}

	subscribeUpdate(service, characteristic, propertyChanged) {
		var IDs = service.subtype.split("-"); 							// IDs[0] is always device ID; for virtual device IDs[1] is the button ID
		this.updateSubscriptions.push({ 'id': IDs[0], 'service': service, 'characteristic': characteristic, "property": propertyChanged });
	}
	
	startPollingUpdate() {
		this.poller.poll();
	}

	mapSceneIDs(scenes) {
		if (this.config.securitysystem == "enabled") {
			scenes.map((s) => {
				switch (s.name) {
				case "SetStayArmed":
					this.securitySystemScenes.SetStayArmed = s.id;	
					break;
				case "SetAwayArmed":
					this.securitySystemScenes.SetAwayArmed = s.id;	
					break;
				case "SetNightArmed":
					this.securitySystemScenes.SetNightArmed = s.id;	
					break;
				case "SetDisarmed":
					this.securitySystemScenes.SetDisarmed = s.id;	
					break;
				case "SetAlarmTriggered":
					this.securitySystemScenes.SetAlarmTriggered = s.id;	
					break;
				default:
					break;
				}
			});
		}
	}
}

