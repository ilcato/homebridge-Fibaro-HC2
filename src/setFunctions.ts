
export class SetFunctions {
	hapCharacteristic: any;
	setFunctionsMapping: Map<string, any>;
	platform: any	;
	
	constructor(hapCharacteristic, platform) {
		this.hapCharacteristic = hapCharacteristic;
		this.setFunctionsMapping = new Map();
		this.platform = platform;
		
		this.setFunctionsMapping.set((new hapCharacteristic.On()).UUID, this.setOn);
		this.setFunctionsMapping.set((new hapCharacteristic.Brightness()).UUID, this.setBrightness);
		this.setFunctionsMapping.set((new hapCharacteristic.TargetPosition()).UUID, this.setValue); // Normal command
		this.setFunctionsMapping.set((new hapCharacteristic.LockTargetState()).UUID, this.setLockTargetState);
		this.setFunctionsMapping.set((new hapCharacteristic.TargetTemperature()).UUID, this.setTargetTemperature);
		this.setFunctionsMapping.set((new hapCharacteristic.Hue()).UUID, this.setHue);
		this.setFunctionsMapping.set((new hapCharacteristic.Saturation()).UUID, this.setSaturation);
		this.setFunctionsMapping.set((new hapCharacteristic.SecuritySystemTargetState()).UUID, this.setSecuritySystemTargetState);
	}

  	
	setOn(value, callback, context, characteristic, service, IDs) {
		if (service.isVirtual) {
			// It's a virtual device so the command is pressButton and not turnOn or Off
			this.command("pressButton", IDs[1], service, IDs);
			// In order to behave like a push button reset the status to off
			setTimeout( () => {
				characteristic.setValue(0, undefined, 'fromSetValue');
			}, 100 );
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
	// Normal command
	setValue(value, callback, context, characteristic, service, IDs) {
		this.command("setValue", value, service, IDs);
	}
	setLockTargetState(value, callback, context, characteristic, service, IDs) {
		var action = value == this.hapCharacteristic.LockTargetState.UNSECURED ? "unsecure" : "secure";
		this.command(action, 0, service, IDs);
	}
	setTargetTemperature(value, callback, context, characteristic, service, IDs) {
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
		let sceneID;
		switch (value) {
			case this.hapCharacteristic.SecuritySystemTargetState.AWAY_ARM:
				sceneID = this.platform.securitySystemScenes.SetAwayArmed;
				break
			case this.hapCharacteristic.SecuritySystemTargetState.DISARM:
				sceneID = this.platform.securitySystemScenes.SetDisarmed;
				value = this.hapCharacteristic.SecuritySystemCurrentState.DISARMED;
				break
			case this.hapCharacteristic.SecuritySystemTargetState.NIGHT_ARM:
				sceneID = this.platform.securitySystemScenes.SetNightArmed;
				break;
			case this.hapCharacteristic.SecuritySystemTargetState.STAY_ARM:
				sceneID = this.platform.securitySystemScenes.SetStayArmed;
				break;
			default:
				break;
		}
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

}

