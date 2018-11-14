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
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const VALUE_GET = "hb_fhc2_value_get";
class Poller {
    constructor(platform, pollerPeriod, hapService, hapCharacteristic) {
        this.platform = platform;
        this.pollingUpdateRunning = false;
        this.lastPoll = 0;
        this.pollerPeriod = pollerPeriod;
        this.hapService = hapService;
        this.hapCharacteristic = hapCharacteristic;
    }
    poll() {
        if (this.pollingUpdateRunning) {
            return;
        }
        this.pollingUpdateRunning = true;
        this.platform.fibaroClient.refreshStates(this.lastPoll)
            .then((updates) => {
            if (updates.last != undefined)
                this.lastPoll = updates.last;
            if (updates.changes != undefined) {
                updates.changes.map((s) => {
                    if (s.value != undefined) {
                        this.manageValue(s);
                    }
                    else if (s["ui.startStopActivitySwitch.value"] != undefined) {
                        s.value = s["ui.startStopActivitySwitch.value"];
                        this.manageValue(s);
                    }
                    else if (s.color != undefined) {
                        this.manageColor(s);
                    }
                });
            }
            if (updates.events != undefined) {
                updates.events.map((s) => {
                    if (s.data.property == "mode") {
                        this.manageOperatingMode(s);
                    }
                });
            }
            // Manage Security System state
            if (this.platform.config.securitysystem == "enabled") {
                this.platform.fibaroClient.getGlobalVariable("SecuritySystem")
                    .then((securitySystemStatus) => {
                    if (this.platform.securitySystemService == undefined)
                        return;
                    let statec = this.platform.getFunctions.getCurrentSecuritySystemStateMapping.get(securitySystemStatus.value);
                    let statet = this.platform.getFunctions.getTargetSecuritySystemStateMapping.get(securitySystemStatus.value);
                    let c = this.platform.securitySystemService.getCharacteristic(this.hapCharacteristic.SecuritySystemCurrentState);
                    let t = this.platform.securitySystemService.getCharacteristic(this.hapCharacteristic.SecuritySystemTargetState);
                    if (c.value != statec)
                        c.updateValue(statec);
                    if (statet != this.hapCharacteristic.SecuritySystemCurrentState.ALARM_TRIGGERED && t.value != statet)
                        t.updateValue(statet);
                })
                    .catch((err) => {
                    this.platform.log("There was a problem getting value from Global Variable: SecuritySystem", ` - Err: ${err}`);
                });
            }
            // Manage global variable switches
            if (this.platform.config.switchglobalvariables != "") {
                let globalVariables = this.platform.config.switchglobalvariables.split(',');
                for (let i = 0; i < globalVariables.length; i++) {
                    this.platform.fibaroClient.getGlobalVariable(globalVariables[i])
                        .then((switchStatus) => {
                        this.platform.getFunctions.getBool(null, this.searchCharacteristic(globalVariables[i]), null, null, switchStatus);
                    })
                        .catch((err) => {
                        this.platform.log("There was a problem getting value from Global Variable: ", `${globalVariables[i]} - Err: ${err}`);
                    });
                }
            }
        })
            .catch((err) => {
            this.platform.log("Error fetching updates: ", err);
            if (err == 400) {
                this.lastPoll = 0;
            }
        });
        this.pollingUpdateRunning = false;
        setTimeout(() => { this.poll(); }, this.pollerPeriod * 1000);
    }
    manageValue(change) {
        for (let i = 0; i < this.platform.updateSubscriptions.length; i++) {
            let subscription = this.platform.updateSubscriptions[i];
            if (subscription.id == change.id && subscription.property == "value") {
                this.platform.log("Updating value for device: ", `${subscription.id}  parameter: ${subscription.characteristic.displayName}, value: ${change.value}`);
                if (this.platform.mqtt != undefined)
                    this.platform.notifyMQTT(VALUE_GET, subscription.id, subscription.characteristic.displayName.replace(" ", "_"), change.value);
                if (this.platform.config.enableIFTTTnotification == "all" || this.platform.config.enableIFTTTnotification == "hc")
                    this.platform.notifyIFTTT(VALUE_GET, subscription.id, subscription.characteristic.displayName.replace(" ", "_"), change.value);
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
                    subscription.characteristic.updateValue(hsv.v == 0 ? false : true);
                else if (subscription.characteristic.UUID == (new this.hapCharacteristic.Hue()).UUID)
                    subscription.characteristic.updateValue(Math.round(hsv.h));
                else if (subscription.characteristic.UUID == (new this.hapCharacteristic.Saturation()).UUID)
                    subscription.characteristic.updateValue(Math.round(hsv.s));
                else if (subscription.characteristic.UUID == (new this.hapCharacteristic.Brightness()).UUID)
                    subscription.characteristic.updateValue(Math.round(hsv.v));
            }
        }
    }
    manageOperatingMode(event) {
        for (let i = 0; i < this.platform.updateSubscriptions.length; i++) {
            let subscription = this.platform.updateSubscriptions[i];
            if (subscription.service.operatingModeId != undefined && subscription.service.operatingModeId == event.data.id && subscription.property == "mode") {
                this.platform.log("Updating value for device: ", `${subscription.service.operatingModeId}  parameter: ${subscription.characteristic.displayName}, value: ${event.data.newValue}`);
                let getFunction = this.platform.getFunctions.getFunctionsMapping.get(subscription.characteristic.UUID);
                if (getFunction)
                    getFunction.call(this.platform.getFunctions, null, subscription.characteristic, subscription.service, null, null);
            }
        }
    }
    searchCharacteristic(globalVariablesID) {
        let a = this.platform.accessories.get(globalVariablesID + "0");
        let s = a.getService(this.hapService.Switch);
        let c = s.getCharacteristic(this.hapCharacteristic.On);
        return c;
    }
}
exports.Poller = Poller;
//# sourceMappingURL=pollerupdate.js.map