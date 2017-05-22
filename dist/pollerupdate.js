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
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
class Poller {
    constructor(platform, pollerPeriod, hapCharacteristic) {
        this.platform = platform;
        this.pollingUpdateRunning = false;
        this.lastPoll = 0;
        this.pollerPeriod = pollerPeriod;
        this.hapCharacteristic = hapCharacteristic;
    }
    poll() {
        if (this.pollingUpdateRunning) {
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
            // Manage Security System state
            if (this.platform.config.securitysystem == "enabled") {
                this.platform.fibaroClient.getGlobalVariable("SecuritySystem")
                    .then((securitySystemStatus) => {
                    if (this.platform.securitySystemService == undefined)
                        return;
                    let state = this.platform.getFunctions.getCurrentSecuritySystemStateMapping.get(securitySystemStatus.value);
                    let c = this.platform.securitySystemService.getCharacteristic(this.hapCharacteristic.SecuritySystemCurrentState);
                    if (state == this.hapCharacteristic.SecuritySystemCurrentState.ALARM_TRIGGERED && c.value != state)
                        c.setValue(state, undefined, 'fromFibaro');
                })
                    .catch((err) => {
                    this.platform.log("There was a problem getting value from Global Variable: SecuritySystem", ` - Err: ${err}`);
                });
            }
        })
            .catch((err) => {
            this.platform.log("Error fetching updates: ", +err);
        });
        this.pollingUpdateRunning = false;
        setTimeout(() => { this.poll(); }, this.pollerPeriod * 1000);
    }
    manageValue(change) {
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
exports.Poller = Poller;
//# sourceMappingURL=pollerupdate.js.map