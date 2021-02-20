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

'use strict'

export const pluginName = 'homebridge-fibaro-hc2'
export const platformName = 'FibaroHC2'

export class ShadowService {
	controlService: any;
	characteristics: any[];

	constructor(controlService, characteristics: any[]) {
		this.controlService = controlService;
		this.characteristics = characteristics;
	}
}

export class ShadowAccessory {

	name: string;
	roomID: string;
	services: ShadowService[];
	accessory: any;
	hapAccessory: any;
	hapService: any;
	hapCharacteristic: any;
	platform: any;
	isSecuritySystem: boolean;
	device: any;

	constructor(device: any, services: ShadowService[], hapAccessory: any, hapService: any, hapCharacteristic: any, platform, isSecurritySystem?: boolean) {
		this.name = device.name;
		this.roomID = device.roomID;
		this.services = services;
		this.accessory = null;
		this.hapAccessory = hapAccessory;
		this.hapService = hapService;
		this.hapCharacteristic = hapCharacteristic;
		this.platform = platform;
		this.isSecuritySystem = isSecurritySystem ? isSecurritySystem : false;
		this.device = { id: device.id, name: device.name, type: device.type, properties: device.properties };

		for (let i = 0; i < services.length; i++) {
			if (services[i].controlService.subtype == undefined)
				services[i].controlService.subtype = device.id + "----"			// DEVICE_ID-VIRTUAL_BUTTON_ID-RGB_MARKER-OPERATING_MODE_ID-PLUGIN_MARKER
		}
	}

	initAccessory() {
		const properties = this.device.properties || {};
		const manufacturer = (properties.zwaveCompany || "IlCato").replace("Fibargroup", "Fibar Group");
		this.accessory.getService(this.hapService.AccessoryInformation)
			.setCharacteristic(this.hapCharacteristic.Manufacturer, manufacturer)
			.setCharacteristic(this.hapCharacteristic.Model, `${this.device.type || "HomeCenterBridgedAccessory"}`)
			.setCharacteristic(this.hapCharacteristic.SerialNumber, `${properties.serialNumber || "<unknown>"}`)
			.setCharacteristic(this.hapCharacteristic.FirmwareRevision, "-");
	}
	removeNoMoreExistingServices() {
		for (let t = 0; t < this.accessory.services.length; t++) {
			let found = false;
			for (let s = 0; s < this.services.length; s++) {
				// TODO: check why test for undefined
				if (this.accessory.services[t].displayName == undefined || this.services[s].controlService.displayName == this.accessory.services[t].displayName) {
					found = true;
					break;
				}
			}
			if (!found && this.accessory.services[t].UUID !== "0000003E-0000-1000-8000-0026BB765291") { // Accessory Information must be present
				this.accessory.removeService(this.accessory.services[t]);
			}
		}
	}

	addNewServices(platform) {
		for (let s = 0; s < this.services.length; s++) {
			let service = this.services[s];
			let serviceExists = this.accessory.getService(service.controlService.displayName);
			if (!serviceExists) {
				this.accessory.addService(service.controlService);
				for (let i = 0; i < service.characteristics.length; i++) {
					let characteristic = service.controlService.getCharacteristic(service.characteristics[i]);
					characteristic.props.needsBinding = true;
					if (characteristic.UUID == (new this.hapCharacteristic.CurrentAmbientLightLevel()).UUID) {
						characteristic.props.maxValue = 100000;
						characteristic.props.minStep = 1;
						characteristic.props.minValue = 0;
					}
					if (characteristic.UUID == (new this.hapCharacteristic.CurrentTemperature()).UUID) {
						characteristic.props.minValue = -50;
					}
					platform.bindCharacteristicEvents(characteristic, service.controlService);
				}
			}
		}
	}

	registerUpdateAccessory(isNewAccessory, api) {
		if (isNewAccessory)
			api.registerPlatformAccessories(pluginName, platformName, [this.accessory]);
		else
			api.updatePlatformAccessories([this.accessory]);
		this.accessory.reviewed = true; // Mark accessory as reviewed in order to remove the not reviewed ones
	}

	setAccessory(accessory) {
		this.accessory = accessory;
	}

	static createShadowAccessory(device, siblings, hapAccessory, hapService, hapCharacteristic, platform) {
		let ss;
		let controlService, controlCharacteristics;

		switch (device.type) {
			case "com.fibaro.multilevelSwitch":
			case "com.fibaro.FGD212":
			case "com.fibaro.FGWD111":
				switch (device.properties.deviceControlType) {
					case "2": // Lighting
					case "23": // Lighting
						controlService = new hapService.Lightbulb(device.name);
						controlCharacteristics = [hapCharacteristic.On, hapCharacteristic.Brightness];
						break;
					default:
						controlService = new hapService.Switch(device.name);
						controlCharacteristics = [hapCharacteristic.On];
						break;
				}
				ss = [new ShadowService(controlService, controlCharacteristics)];
				break;
			case "com.fibaro.binarySwitch":
			case "com.fibaro.developer.bxs.virtualBinarySwitch":
			case "com.fibaro.satelOutput":
			case "com.fibaro.FGWDS221":
				switch (device.properties.deviceControlType) {
					case "2": // Lighting
					case "5": // Bedside Lamp
					case "7": // Wall Lamp
						controlService = new hapService.Lightbulb(device.name);
						controlCharacteristics = [hapCharacteristic.On];
						break;
					case "25": // Video gate open
						controlService = new hapService.LockMechanism(device.name);
						controlService.subtype = device.id + "----" + "LOCK";
						controlCharacteristics = [hapCharacteristic.LockCurrentState, hapCharacteristic.LockTargetState];
						break;
					default:
						controlService = new hapService.Switch(device.name);
						controlCharacteristics = [hapCharacteristic.On];
						break;
				}
				ss = [new ShadowService(controlService, controlCharacteristics)];
				break;
			case "com.fibaro.barrier":
			case "com.fibaro.baseShutter":
					ss = [new ShadowService(new hapService.GarageDoorOpener(device.name), [hapCharacteristic.CurrentDoorState, hapCharacteristic.TargetDoorState, hapCharacteristic.ObstructionDetected])];
				break;
			case "com.fibaro.FGR221":
			case "com.fibaro.FGRM222":
			case "com.fibaro.FGR223":
			case "com.fibaro.rollerShutter":
			case "com.fibaro.FGWR111":
				controlService = new hapService.WindowCovering(device.name);
				controlCharacteristics = [
					hapCharacteristic.CurrentPosition,
					hapCharacteristic.TargetPosition,
					hapCharacteristic.PositionState
				];
				//if (device.actions.setValue2 == 1) {
				if (parseInt(device.properties.deviceControlType) === 55) {
					controlCharacteristics.push(
						hapCharacteristic.CurrentHorizontalTiltAngle,
						hapCharacteristic.TargetHorizontalTiltAngle
					);
				}
				ss = [new ShadowService(controlService, controlCharacteristics)];
				break;
			case "com.fibaro.FGMS001":
			case "com.fibaro.FGMS001v2":
			case "com.fibaro.motionSensor":
				ss = [new ShadowService(new hapService.MotionSensor(device.name), [hapCharacteristic.MotionDetected])];
				break;
			case "com.fibaro.temperatureSensor":
				ss = [new ShadowService(new hapService.TemperatureSensor(device.name), [hapCharacteristic.CurrentTemperature])];
				break;
			case "com.fibaro.humiditySensor":
				ss = [new ShadowService(new hapService.HumiditySensor(device.name), [hapCharacteristic.CurrentRelativeHumidity])];
				break;
			case "com.fibaro.doorSensor":
			case "com.fibaro.FGDW002":
			case "com.fibaro.windowSensor":
			case "com.fibaro.satelZone":
				ss = [new ShadowService(new hapService.ContactSensor(device.name), [hapCharacteristic.ContactSensorState])];
				break;
			case "com.fibaro.FGFS101":
			case "com.fibaro.floodSensor":
				ss = [new ShadowService(new hapService.LeakSensor(device.name), [hapCharacteristic.LeakDetected])];
				break;
			case "com.fibaro.FGSS001":
			case "com.fibaro.smokeSensor":
				ss = [new ShadowService(new hapService.SmokeSensor(device.name), [hapCharacteristic.SmokeDetected])];
				break;
			case "com.fibaro.FGCD001":
				ss = [new ShadowService(new hapService.CarbonMonoxideSensor(device.name), [hapCharacteristic.CarbonMonoxideDetected, hapCharacteristic.CarbonMonoxideLevel, hapCharacteristic.CarbonMonoxidePeakLevel, hapCharacteristic.BatteryLevel])];
				break;
			case "com.fibaro.lightSensor":
				ss = [new ShadowService(new hapService.LightSensor(device.name), [hapCharacteristic.CurrentAmbientLightLevel])];
				break;
			case "com.fibaro.FGWP101":
			case "com.fibaro.FGWP102":
			case "com.fibaro.FGWPG111":
			case "com.fibaro.FGWOEF011":
				ss = [new ShadowService(new hapService.Outlet(device.name), [hapCharacteristic.On, hapCharacteristic.OutletInUse])];
				break;
			case "com.fibaro.doorLock":
			case "com.fibaro.gerda":
				ss = [new ShadowService(new hapService.LockMechanism(device.name), [hapCharacteristic.LockCurrentState, hapCharacteristic.LockTargetState])];
				break;
			case "com.fibaro.setPoint":
			case "com.fibaro.FGT001":
			case "com.fibaro.thermostatDanfoss":
			case "com.fibaro.com.fibaro.thermostatHorstmann":
				controlService = new hapService.Thermostat(device.name);
				controlCharacteristics = [hapCharacteristic.CurrentTemperature, hapCharacteristic.TargetTemperature, hapCharacteristic.CurrentHeatingCoolingState, hapCharacteristic.TargetHeatingCoolingState, hapCharacteristic.TemperatureDisplayUnits];
				// Check the presence of an associated operating mode device
				let m = siblings.get("com.fibaro.operatingMode");
				if (m) {
					controlService.operatingModeId = m.id;
					controlService.subtype = device.id + "---" + m.id;
				}
				// Check if there's a temperature Sensor and use it instead of the provided float value
				let t = siblings.get("com.fibaro.temperatureSensor");
				if (t) {
					controlService.floatServiceId = t.id;
					if (controlService.subtype) {
						controlService.subtype = controlService.subtype + "-" + t.id;
					} else {
						controlService.subtype = device.id + "----" + t.id;
					}
				}
				ss = [new ShadowService(controlService, controlCharacteristics)];
				break;
			case "virtual_device":
				let pushButtonServices: Array<ShadowService> = new Array();
				let pushButtonService: ShadowService;
				for (let r = 0; r < device.properties.rows.length; r++) {
					if (device.properties.rows[r].type == "button") {
						for (let e = 0; e < device.properties.rows[r].elements.length; e++) {
							pushButtonService = new ShadowService(new hapService.Switch(device.properties.rows[r].elements[e].caption), [hapCharacteristic.On]);
							pushButtonService.controlService.subtype = device.id + "-" + device.properties.rows[r].elements[e].id;
							pushButtonServices.push(pushButtonService);
						}
					}
				}
				if (pushButtonServices.length > 0)
					ss = pushButtonServices;
				break;
			case "com.fibaro.FGRGBW441M":
			case "com.fibaro.colorController":
			case "com.fibaro.FGRGBW442CC":
				let service = { controlService: new hapService.Lightbulb(device.name), characteristics: [hapCharacteristic.On, hapCharacteristic.Brightness, hapCharacteristic.Hue, hapCharacteristic.Saturation] };
				service.controlService.HSBValue = { hue: 0, saturation: 0, brightness: 100 };
				service.controlService.RGBValue = { red: 0, green: 0, blue: 0, white: 0 };
				service.controlService.countColorCharacteristics = 2;
				service.controlService.timeoutIdColorCharacteristics = 0;
				service.controlService.subtype = device.id + "--RGB";
				ss = [service];
				break;
			case "com.fibaro.logitechHarmonyActivity":
				controlService = new hapService.Switch(device.name);
				controlService.subtype = device.id + "----" + "HP"; 					// HP: Harmony Plugin		
				ss = [new ShadowService(controlService, [hapCharacteristic.On])];
				break;
			default:
				break
		}
		if (!ss) {
			return undefined;
		}

		if (device.interfaces && device.interfaces.includes("battery")) {
			ss.push(new ShadowService(new hapService.BatteryService(device.name), [hapCharacteristic.BatteryLevel, hapCharacteristic.ChargingState, hapCharacteristic.StatusLowBattery]))
		}

		return new ShadowAccessory(device, ss, hapAccessory, hapService, hapCharacteristic, platform);
	}
	static createShadowSecuritySystemAccessory(device, hapAccessory, hapService, hapCharacteristic, platform) {
		let service = new ShadowService(new hapService.SecuritySystem("FibaroSecuritySystem"), [hapCharacteristic.SecuritySystemCurrentState, hapCharacteristic.SecuritySystemTargetState]);
		service.controlService.subtype = "0--";
		return new ShadowAccessory(device, [service], hapAccessory, hapService, hapCharacteristic, platform, true);
	}
	static createShadowGlobalVariableSwitchAccessory(device, hapAccessory, hapService, hapCharacteristic, platform) {
		let service = new ShadowService(new hapService.Switch(device.name), [hapCharacteristic.On]);
		service.controlService.subtype = `G-${device.name}-`;
		return new ShadowAccessory(device, [service], hapAccessory, hapService, hapCharacteristic, platform, true);
	}
}
