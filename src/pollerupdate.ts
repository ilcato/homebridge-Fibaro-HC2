export class Poller {

	platform: any;
	pollingUpdateRunning: boolean;
	lastPoll: number;
	pollerPeriod: number;
	hapCharacteristic: any;

	constructor(platform, pollerPeriod, hapCharacteristic) {
		this.platform = platform;
		this.pollingUpdateRunning = false;
		this.lastPoll = 0;
		this.pollerPeriod = pollerPeriod;
		this.hapCharacteristic = hapCharacteristic;
	}
	
	poll() {
		if(this.pollingUpdateRunning ) {
			return;
		}
		this.pollingUpdateRunning = true;
	
		this.platform.fibaroClient.refreshStates(this.lastPoll)
			.then((updates) => {
				this.lastPoll = updates.last;
				if (updates.changes != undefined) {
					updates.changes.map((s) => {
						if (s.value != undefined) {
							this.manageValue(s);
						}
						if (s.color != undefined) {
							this.manageColor(s);
						} 
					});
				}
				this.pollingUpdateRunning = false;
				setTimeout( () => { this.poll()}, this.pollerPeriod * 1000);
			})
			.catch((err) => {
				this.platform.log("Error fetching updates: ", + err);
			});
	}
	
	manageValue(change) {
		// Set Security System to triggered if a Fibaro Alert is present
		if (this.platform.config.securitysystem == "enabled") {
			if (change.fibaroAlarm == "true") {
				this.platform.setFunctions.scene(this.platform.securitySystemScenes.SetAlarmTriggered);
				this.platform.securitySystemService.setCharacteristic(this.hapCharacteristic.SecuritySystemCurrentState, this.hapCharacteristic.SecuritySystemCurrentState.ALARM_TRIGGERED);
			}
		}
		for (let i = 0; i < this.platform.updateSubscriptions.length; i++) {
			let subscription = this.platform.updateSubscriptions[i];
			if (subscription.id == change.id && subscription.property == "value") {
				let getFunction = this.platform.getFunctions.getFunctionsMapping.get(subscription.characteristic.UUID);
				if (getFunction)
					getFunction.call(this.platform.getFunctions, null, subscription.characteristic, subscription.service, null, change);
			}
		}
	}	

	manageColor(change) {
		for (let i = 0; i < this.platform.updateSubscriptions.length; i++) {
			let subscription = this.platform.updateSubscriptions[i];
			if (subscription.id == change.id && subscription.property == "color") {
				let hsv = this.platform.getFunctions.updateHomeKitColorFromHomeCenter(change.color, subscription.service);
				if (subscription.characteristic.UUID == (new this.hapCharacteristic.On()).UUID)
					subscription.characteristic.setValue(hsv.v == 0 ? false : true, undefined, 'fromFibaro');
				else if (subscription.characteristic.UUID == (new this.hapCharacteristic.Hue()).UUID)
					subscription.characteristic.setValue(Math.round(hsv.h), undefined, 'fromFibaro');
				else if (subscription.characteristic.UUID == (new this.hapCharacteristic.Saturation()).UUID)
					subscription.characteristic.setValue(Math.round(hsv.s), undefined, 'fromFibaro');
				else if (subscription.characteristic.UUID == (new this.hapCharacteristic.Brightness()).UUID)
					subscription.characteristic.setValue(Math.round(hsv.v), undefined, 'fromFibaro');
			}
		}
	}
}