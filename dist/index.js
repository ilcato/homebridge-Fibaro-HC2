//    Copyright 2017 ilcato
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
//            "thermostattimeout": "PUT THE NUMBER OF SECONDS FOR THE THERMOSTAT TIMEOUT, DEFAULT: 7200 (2 HOURS). PUT 0 FOR INFINITE",
//            "enablecoolingstatemanagemnt": "PUT on TO AUTOMATICALLY MANAGE HEATING STATE FOR THERMOSTAT, off TO DISABLE IT. DEFAULT off",
//            "doorlocktimeout": "PUT 0 FOR DISABLING THE CHECK. PUT A POSITIVE INTEGER N NUMBER ENABLE IT AFTER N SECONDS. DEFAULT 0",
//            "makerkey": "PUT KEY OF YOUR MAKER CHANNEL HERE (USED TO SIGNAL EVENTS TO THE OUTSIDE)"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.
'use strict';
const fibaro_api_1 = require("./fibaro-api");
const shadows_1 = require("./shadows");
const setFunctions_1 = require("./setFunctions");
const getFunctions_1 = require("./getFunctions");
const pollerupdate_1 = require("./pollerupdate");
const defaultPollerPeriod = 5;
const timeOffset = 2 * 3600;
const defaultEnableCoolingStateManagemnt = "off";
let Accessory, Service, Characteristic, UUIDGen;
class Config {
}
class FibaroHC2 {
    constructor(log, config, api) {
        this.log = log;
        this.api = api;
        this.accessories = new Map();
        this.updateSubscriptions = new Array();
        this.securitySystemScenes = {};
        this.securitySystemService = {};
        this.config = config;
        let pollerPeriod = this.config.pollerperiod ? parseInt(this.config.pollerperiod) : defaultPollerPeriod;
        if (isNaN(pollerPeriod) || pollerPeriod < 1 || pollerPeriod > 100)
            pollerPeriod = defaultPollerPeriod;
        if (this.config.securitysystem == undefined || (this.config.securitysystem != "enabled" && this.config.securitysystem != "disabled"))
            this.config.securitysystem = "disabled";
        if (this.config.switchglobalvariables == undefined)
            this.config.switchglobalvariables = "";
        if (this.config.thermostattimeout == undefined)
            this.config.thermostattimeout = timeOffset.toString();
        if (this.config.enablecoolingstatemanagemnt == undefined)
            this.config.enablecoolingstatemanagemnt = defaultEnableCoolingStateManagemnt;
        if (this.config.doorlocktimeout == undefined)
            this.config.doorlocktimeout = "0";
        if (this.config.makerkey == undefined)
            this.config.makerkey = "";
        this.fibaroClient = new fibaro_api_1.FibaroClient(this.config.host, this.config.username, this.config.password);
        this.poller = new pollerupdate_1.Poller(this, pollerPeriod, Service, Characteristic);
        this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
        this.getFunctions = new getFunctions_1.GetFunctions(Characteristic, this);
    }
    didFinishLaunching() {
        this.log('didFinishLaunching.', '');
        this.fibaroClient.getScenes()
            .then((scenes) => {
            this.mapSceneIDs(scenes);
            this.setFunctions = new setFunctions_1.SetFunctions(Characteristic, this); // There's a dependency in setFunction to Scene Mapping
            return this.fibaroClient.getDevices();
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
                var subtypeParams = service.subtype.split("-"); // "DEVICE_ID-VIRTUAL_BUTTON_ID-RGB_MARKER
                if (subtypeParams.length == 3 && subtypeParams[2] == "RGB") {
                    // For RGB devices add specific attributes for managing it
                    service.HSBValue = { hue: 0, saturation: 0, brightness: 0 };
                    service.RGBValue = { red: 0, green: 0, blue: 0 };
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
                this.addAccessory(shadows_1.ShadowAccessory.createShadowAccessory(s, Accessory, Service, Characteristic, this));
            }
        });
        // Create Security System accessory
        if (this.config.securitysystem == "enabled") {
            let device = { name: "FibaroSecuritySystem", roomID: 0, id: 0 };
            let sa = shadows_1.ShadowAccessory.createShadowSecuritySystemAccessory(device, Accessory, Service, Characteristic, this);
            this.addAccessory(sa);
        }
        // Create Global Variable Switches
        if (this.config.switchglobalvariables && this.config.switchglobalvariables != "") {
            let globalVariables = this.config.switchglobalvariables.split(',');
            for (let i = 0; i < globalVariables.length; i++) {
                let device = { name: globalVariables[i], roomID: 0, id: 0 };
                let sa = shadows_1.ShadowAccessory.createShadowGlobalVariableSwitchAccessory(device, Accessory, Service, Characteristic, this);
                this.addAccessory(sa);
            }
        }
        // Remove not reviewd accessories: cached accessories no more present in Home Center
        let accessories = this.accessories.values(); // Iterator for accessories, key is the uniqueseed
        for (let a of accessories) {
            if (!a.reviewed) {
                this.removeAccessory(a);
            }
        }
        // Start the poller update mechanism
        this.poller.poll();
    }
    addAccessory(shadowAccessory) {
        if (shadowAccessory == undefined)
            return;
        let uniqueSeed = shadowAccessory.name + shadowAccessory.roomID;
        let isNewAccessory = false;
        let a = this.accessories.get(uniqueSeed);
        if (a == null) {
            isNewAccessory = true;
            let uuid = UUIDGen.generate(uniqueSeed);
            a = new Accessory(shadowAccessory.name, uuid); // Create the HAP accessory
            a.context.uniqueSeed = uniqueSeed;
            this.accessories.set(uniqueSeed, a);
        }
        this.log("Unique seed: ", uniqueSeed);
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
        shadowAccessory.resgisterUpdateAccessory(isNewAccessory, this.api);
        this.log("Added/changed accessory: ", shadowAccessory.name);
    }
    removeAccessory(accessory) {
        this.log('Remove accessory', accessory.displayName);
        this.api.unregisterPlatformAccessories(shadows_1.pluginName, shadows_1.platformName, [accessory]);
        this.accessories.delete(accessory.context.uniqueSeed);
    }
    bindCharacteristicEvents(characteristic, service) {
        let IDs = service.subtype.split("-"); // IDs[0] is always device ID; for virtual device IDs[1] is the button ID
        service.isVirtual = IDs[1] != "" ? true : false;
        service.isSecuritySystem = IDs[0] == "0" ? true : false;
        service.isGlobalVariableSwitch = IDs[0] == "G" ? true : false;
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
            if (service.isVirtual && !service.isGlobalVariableSwitch) {
                // a push button is normally off
                callback(undefined, false);
            }
            else {
                this.getCharacteristicValue(callback, characteristic, service, IDs);
            }
        });
    }
    setCharacteristicValue(value, callback, context, characteristic, service, IDs) {
        if (context !== 'fromFibaro' && context !== 'fromSetValue') {
            let d = IDs[0] != "G" ? IDs[0] : IDs[1];
            this.log("Setting value to device: ", `${d}  parameter: ${characteristic.displayName}`);
            let setFunction = this.setFunctions.setFunctionsMapping.get(characteristic.UUID);
            if (setFunction)
                setFunction.call(this.setFunctions, value, callback, context, characteristic, service, IDs);
        }
        callback();
    }
    getCharacteristicValue(callback, characteristic, service, IDs) {
        this.log("Getting value from device: ", `${IDs[0]}  parameter: ${characteristic.displayName}`);
        // Manage security system status
        if (service.isSecuritySystem) {
            this.fibaroClient.getGlobalVariable("SecuritySystem")
                .then((securitySystemStatus) => {
                this.getFunctions.getSecuritySystemTargetState(callback, characteristic, service, IDs, securitySystemStatus);
            })
                .catch((err) => {
                this.log("There was a problem getting value from Global Variable: SecuritySystem", ` - Err: ${err}`);
                callback(err, null);
            });
            return;
        }
        // Manage global variable switches
        if (service.isGlobalVariableSwitch) {
            this.fibaroClient.getGlobalVariable(IDs[1])
                .then((switchStatus) => {
                this.getFunctions.getBool(callback, characteristic, service, IDs, switchStatus);
            })
                .catch((err) => {
                this.log("There was a problem getting value from Global Variable: ", `${IDs[1]} - Err: ${err}`);
                callback(err, null);
            });
            return;
        }
        // Manage all other status
        this.fibaroClient.getDeviceProperties(IDs[0])
            .then((properties) => {
            let getFunction = this.getFunctions.getFunctionsMapping.get(characteristic.UUID);
            if (getFunction)
                getFunction.call(this.getFunctions, callback, characteristic, service, IDs, properties);
        })
            .catch((err) => {
            this.log("There was a problem getting value from: ", `${IDs[0]} - Err: ${err}`);
            callback(err, null);
        });
    }
    subscribeUpdate(service, characteristic, propertyChanged) {
        var IDs = service.subtype.split("-"); // IDs[0] is always device ID; for virtual device IDs[1] is the button ID
        this.updateSubscriptions.push({ 'id': IDs[0], 'service': service, 'characteristic': characteristic, "property": propertyChanged });
    }
    mapSceneIDs(scenes) {
        if (this.config.securitysystem == "enabled") {
            scenes.map((s) => {
                this.securitySystemScenes[s.name] = s.id;
            });
        }
    }
}
module.exports = function (homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerPlatform(shadows_1.pluginName, shadows_1.platformName, FibaroHC2, true);
};
//# sourceMappingURL=index.js.map