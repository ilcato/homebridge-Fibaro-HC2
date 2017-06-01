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

'use strict'

const timeOffset = 2*3600;
export const lowestTemp = 12;
export const stdTemp = 21;


export class SetFunctions {
	hapCharacteristic: any;
	setFunctionsMapping: Map<string, any>;
	getTargetSecuritySystemSceneMapping: Map<number, any>;

	platform: any;
	
	constructor(hapCharacteristic, platform) {
		this.hapCharacteristic = hapCharacteristic;
		this.platform = platform;
		
		this.setFunctionsMapping = new Map([
			[(new hapCharacteristic.On()).UUID, 							this.setOn],
			[(new hapCharacteristic.Brightness()).UUID, 					this.setBrightness],
			[(new hapCharacteristic.TargetPosition()).UUID, 				this.setTargetPosition],	
			[(new hapCharacteristic.LockTargetState()).UUID, 				this.setLockTargetState],
			[(new hapCharacteristic.TargetHeatingCoolingState()).UUID, 		this.setTargetHeatingCoolingState],
			[(new hapCharacteristic.TargetTemperature()).UUID, 				this.setTargetTemperature],
			[(new hapCharacteristic.Hue()).UUID, 							this.setHue],
			[(new hapCharacteristic.Saturation()).UUID, 					this.setSaturation],
			[(new hapCharacteristic.SecuritySystemTargetState()).UUID, 		this.setSecuritySystemTargetState],
		]);

		this.getTargetSecuritySystemSceneMapping = new Map([
			[this.hapCharacteristic.SecuritySystemTargetState.AWAY_ARM, 	this.platform.securitySystemScenes.SetAwayArmed],
			[this.hapCharacteristic.SecuritySystemTargetState.DISARM, 		this.platform.securitySystemScenes.SetDisarmed],
			[this.hapCharacteristic.SecuritySystemTargetState.NIGHT_ARM, 	this.platform.securitySystemScenes.SetNightArmed],
			[this.hapCharacteristic.SecuritySystemTargetState.STAY_ARM, 	this.platform.securitySystemScenes.SetStayArmed]
		]);

	}

  	
	setOn(value, callback, context, characteristic, service, IDs) {
		if (service.isVirtual && !service.isGlobalVariableSwitch) {
			// It's a virtual device so the command is pressButton and not turnOn or Off
			this.command("pressButton", IDs[1], service, IDs);
			// In order to behave like a push button reset the status to off
			setTimeout( () => {
				characteristic.setValue(0, undefined, 'fromSetValue');
			}, 100 );
		} else if (service.isGlobalVariableSwitch) {
			this.setGlobalVariable(IDs[1], value == true ? "true": "false");
		} else {
			if (characteristic.value == true && value == 0 || characteristic.value == false && value == 1)
				this.command(value == 0 ? "turnOff": "turnOn", null, service, IDs);
		}
	}
	setBrightness(value, callback, context, characteristic, service, IDs) {
		if (service.HSBValue != null) {
			;
			let rgb = this.updateHomeCenterColorFromHomeKit(null, null, value, service);
			this.syncColorCharacteristics(rgb, service, IDs);
		} else {
			this.command("setValue", value, service, IDs);
		}
	}
	setTargetPosition(value, callback, context, characteristic, service, IDs) {
		this.command("setValue", value, service, IDs);
	}
	setLockTargetState(value, callback, context, characteristic, service, IDs) {
		var action = value == this.hapCharacteristic.LockTargetState.UNSECURED ? "unsecure" : "secure";
		this.command(action, 0, service, IDs);
	}
	setTargetHeatingCoolingState(value, callback, context, characteristic, service, IDs) {
		let temp = 0;
		if (value == this.hapCharacteristic.TargetHeatingCoolingState.OFF) {
			temp = lowestTemp;
		} else {
			temp = stdTemp;
			value = this.hapCharacteristic.TargetHeatingCoolingState.HEAT; // force the target state to HEAT because we are not managing other staes beside OFF and HEAT
		} 
		this.command("setTargetLevel", temp, service, IDs);
		this.command("setTime", 0 + Math.trunc((new Date()).getTime()/1000), service, IDs);

		setTimeout( () => {
			characteristic.setValue(value, undefined, 'fromSetValue');
			// set also current state
			let currentHeatingCoolingStateCharacteristic = service.getCharacteristic(this.hapCharacteristic.CurrentHeatingCoolingState);
			currentHeatingCoolingStateCharacteristic.setValue(value, undefined, 'fromSetValue');			
		}, 100 );
	}
	setTargetTemperature(value, callback, context, characteristic, service, IDs) {
		if (Math.abs(value - characteristic.value) >= 0.5) {
			value = parseFloat( (Math.round(value / 0.5) * 0.5).toFixed(1) );
			this.command("setTargetLevel", value, service, IDs);
			this.command("setTime", timeOffset + Math.trunc((new Date()).getTime()/1000), service, IDs);
		} else {
			value = characteristic.value;
		}
		setTimeout( () => {
			characteristic.setValue(value, undefined, 'fromSetValue');
		}, 100 );
	}
	setHue(value, callback, context, characteristic, service, IDs) {
		let rgb = this.updateHomeCenterColorFromHomeKit(value, null, null, service);
		this.syncColorCharacteristics(rgb, service, IDs);
	}
	setSaturation(value, callback, context, characteristic, service, IDs) {
		let rgb = this.updateHomeCenterColorFromHomeKit(null, value, null, service);
		this.syncColorCharacteristics(rgb, service, IDs);
	}
	setSecuritySystemTargetState(value, callback, context, characteristic, service, IDs) {
		let sceneID = this.getTargetSecuritySystemSceneMapping.get(value);
		if (value == this.hapCharacteristic.SecuritySystemTargetState.DISARM)
			value = this.hapCharacteristic.SecuritySystemCurrentState.DISARMED;
		if (sceneID == undefined)
			return;
		service.setCharacteristic(this.hapCharacteristic.SecuritySystemCurrentState, value);
		this.scene(sceneID);
	}
	
	updateHomeCenterColorFromHomeKit(h, s, v, service) {
		if (h != null)
			service.HSBValue.hue = h;
		if (s != null)
			service.HSBValue.saturation = s;
		if (v != null)
			service.HSBValue.brightness = v;
		var rgb = this.HSVtoRGB(service.HSBValue.hue, service.HSBValue.saturation, service.HSBValue.brightness);
		service.RGBValue.red = rgb.r;
		service.RGBValue.green = rgb.g;
		service.RGBValue.blue = rgb.b;
		return rgb;  	
	}
	HSVtoRGB(hue, saturation, value) {
		let h = hue/360.0;
		let s = saturation/100.0;
		let v = value/100.0;
		let r, g, b, i, f, p, q, t;
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
	syncColorCharacteristics(rgb, service, IDs) {
		switch (--service.countColorCharacteristics) {
			case -1:
				service.countColorCharacteristics = 2;
				service.timeoutIdColorCharacteristics = setTimeout( () => {
					if (service.countColorCharacteristics < 2)
						return;
					this.command("setR", rgb.r, service, IDs);
					this.command("setG", rgb.g, service, IDs);
					this.command("setB", rgb.b, service, IDs);
					if(rgb.r == rgb.g && rgb.g == rgb.b)
						this.command("setW", rgb.r, service, IDs);
					service.countColorCharacteristics = 0;
					service.timeoutIdColorCharacteristics = 0;
				}, 1000);
				break;
			case 0:
				this.command("setR", rgb.r, service, IDs);
				this.command("setG", rgb.g, service, IDs);
				this.command("setB", rgb.b, service, IDs);
				if(rgb.r == rgb.g && rgb.g == rgb.b)
					this.command("setW", rgb.r, service, IDs);
				service.countColorCharacteristics = 0;
				service.timeoutIdColorCharacteristics = 0;
				break;
			default:
				break;
		}
	}
	

	command(c,value, service, IDs) {
		this.platform.fibaroClient.executeDeviceAction(IDs[0], c, value)
			.then( (response) => {
				this.platform.log("Command: ", c + ((value != undefined) ? ", value: " + value : "") + ", to: " + IDs[0]);
			})
			.catch( (err, response) => {
				this.platform.log("There was a problem sending command ", c + " to " + IDs[0]);
			});
	}
	
	scene(sceneID) {
		this.platform.fibaroClient.executeScene(sceneID)
			.then((response) => {
				this.platform.log("Executed scene: ", sceneID);
			})
			.catch((err, response) => {
				this.platform.log("There was a problem executing scene: ", sceneID);
			});
	}

	setGlobalVariable(variableID, value) {
		this.platform.fibaroClient.setGlobalVariable(variableID, value)
			.then( (response) => {
				this.platform.log("Setting variable: ", `${variableID} to ${value}`);
			})
			.catch( (err, response) => {
				this.platform.log("There was a problem setting variable: ", `${variableID} to ${value}`);
			});
	}
}

