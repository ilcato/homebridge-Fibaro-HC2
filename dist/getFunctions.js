"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GetFunctions {
    constructor(hapCharacteristic, platform) {
        this.hapCharacteristic = hapCharacteristic;
        this.getFunctionsMapping = new Map();
        this.platform = platform;
        this.getFunctionsMapping.set((new hapCharacteristic.On()).UUID, this.getBool);
        this.getFunctionsMapping.set((new hapCharacteristic.Brightness()).UUID, this.getBrightness);
        this.getFunctionsMapping.set((new hapCharacteristic.PositionState()).UUID, this.getPositionState);
        this.getFunctionsMapping.set((new hapCharacteristic.CurrentPosition()).UUID, this.getCurrentPosition);
        this.getFunctionsMapping.set((new hapCharacteristic.TargetPosition()).UUID, this.getCurrentPosition); // Manage the same as currentPosition
        this.getFunctionsMapping.set((new hapCharacteristic.MotionDetected()).UUID, this.getBool);
        this.getFunctionsMapping.set((new hapCharacteristic.CurrentTemperature()).UUID, this.getFloat);
        this.getFunctionsMapping.set((new hapCharacteristic.TargetTemperature()).UUID, this.getTargetTemperature);
        this.getFunctionsMapping.set((new hapCharacteristic.CurrentRelativeHumidity()).UUID, this.getFloat);
        this.getFunctionsMapping.set((new hapCharacteristic.ContactSensorState()).UUID, this.getContactSensorState);
        this.getFunctionsMapping.set((new hapCharacteristic.LeakDetected()).UUID, this.getLeakDetected);
        this.getFunctionsMapping.set((new hapCharacteristic.SmokeDetected()).UUID, this.getSmokeDetected);
        this.getFunctionsMapping.set((new hapCharacteristic.CurrentAmbientLightLevel()).UUID, this.getFloat);
        this.getFunctionsMapping.set((new hapCharacteristic.OutletInUse()).UUID, this.getOutletInUse);
        this.getFunctionsMapping.set((new hapCharacteristic.LockCurrentState()).UUID, this.getLockCurrentState);
        this.getFunctionsMapping.set((new hapCharacteristic.LockTargetState()).UUID, this.getLockCurrentState); // Manage the same as currentState
        this.getFunctionsMapping.set((new hapCharacteristic.CurrentHeatingCoolingState()).UUID, this.getCurrentHeatingCoolingState);
        this.getFunctionsMapping.set((new hapCharacteristic.TargetHeatingCoolingState()).UUID, this.getCurrentHeatingCoolingState); // Manage the same as currentState
        this.getFunctionsMapping.set((new hapCharacteristic.TemperatureDisplayUnits()).UUID, this.getTemperatureDisplayUnits);
        this.getFunctionsMapping.set((new hapCharacteristic.Hue()).UUID, this.getHue);
        this.getFunctionsMapping.set((new hapCharacteristic.Saturation()).UUID, this.getSaturation);
    }
    returnValue(r, callback, characteristic) {
        if (callback)
            callback(undefined, r);
        else
            characteristic.setValue(r, undefined, 'fromFibaro');
    }
    // Boolean getter
    getBool(callback, characteristic, service, IDs, properties) {
        let v = properties.value;
        let r = (v == "true" || v == "false") ?
            ((v == "false") ? false : true) :
            ((parseInt(v) == 0) ? false : true);
        this.returnValue(r, callback, characteristic);
    }
    // Float getter
    getFloat(callback, characteristic, service, IDs, properties) {
        let r = parseFloat(properties.value);
        this.returnValue(r, callback, characteristic);
    }
    getBrightness(callback, characteristic, service, IDs, properties) {
        if (service.HSBValue != null) {
            let hsv = this.updateHomeKitColorFromHomeCenter(properties.color, service);
            if (callback)
                callback(undefined, Math.round(hsv.v));
        }
        else {
            if (properties.value == 99)
                properties.value = 100;
            let r = parseFloat(properties.value);
            this.returnValue(r, callback, characteristic);
        }
    }
    getPositionState(callback, characteristic, service, IDs, properties) {
        if (callback)
            callback(undefined, this.hapCharacteristic.PositionState.STOPPED);
    }
    getCurrentPosition(callback, characteristic, service, IDs, properties) {
        let r = parseInt(properties.value);
        if (r >= characteristic.props.minValue && r <= characteristic.props.maxValue) {
            if (r == 99)
                r = 100;
            this.returnValue(r, callback, characteristic);
        }
        else {
            if (callback)
                callback("Error value window position", null);
        }
    }
    getTargetTemperature(callback, characteristic, service, IDs, properties) {
        let r = parseFloat(properties.targetLevel);
        this.returnValue(r, callback, characteristic);
    }
    getContactSensorState(callback, characteristic, service, IDs, properties) {
        let r = properties.value == "false" ? this.hapCharacteristic.ContactSensorState.CONTACT_DETECTED : this.hapCharacteristic.ContactSensorState.CONTACT_NOT_DETECTED;
        this.returnValue(r, callback, characteristic);
    }
    getLeakDetected(callback, characteristic, service, IDs, properties) {
        let r = properties.value == "true" ? this.hapCharacteristic.LeakDetected.LEAK_DETECTED : this.hapCharacteristic.LeakDetected.LEAK_NOT_DETECTED;
        this.returnValue(r, callback, characteristic);
    }
    getSmokeDetected(callback, characteristic, service, IDs, properties) {
        let r = properties.value == "true" ? this.hapCharacteristic.SmokeDetected.SMOKE_DETECTED : this.hapCharacteristic.SmokeDetected.SMOKE_NOT_DETECTED;
        this.returnValue(r, callback, characteristic);
    }
    getOutletInUse(callback, characteristic, service, IDs, properties) {
        let r = parseFloat(properties.power) > 1.0 ? true : false;
        this.returnValue(r, callback, characteristic);
    }
    getLockCurrentState(callback, characteristic, service, IDs, properties) {
        let r = properties.value == "true" ? this.hapCharacteristic.LockCurrentState.SECURED : this.hapCharacteristic.LockCurrentState.UNSECURED;
        this.returnValue(r, callback, characteristic);
    }
    getCurrentHeatingCoolingState(callback, characteristic, service, IDs, properties) {
        if (callback)
            callback(undefined, this.hapCharacteristic.TargetHeatingCoolingState.HEAT);
    }
    getTemperatureDisplayUnits(callback, characteristic, service, IDs, properties) {
        if (callback)
            callback(undefined, this.hapCharacteristic.TemperatureDisplayUnits.CELSIUS);
    }
    getHue(callback, characteristic, service, IDs, properties) {
        let hsv = this.updateHomeKitColorFromHomeCenter(properties.color, service);
        if (callback)
            callback(undefined, Math.round(hsv.h));
    }
    getSaturation(callback, characteristic, service, IDs, properties) {
        let hsv = this.updateHomeKitColorFromHomeCenter(properties.color, service);
        if (callback)
            callback(undefined, Math.round(hsv.s));
    }
    setSecuritySystemTargetState(callback, characteristic, service, IDs, securitySystemStatus) {
        let state;
        if (characteristic.UUID == (new this.hapCharacteristic.SecuritySystemCurrentState()).UUID) {
            switch (securitySystemStatus.value) {
                case "AwayArmed":
                    state = this.hapCharacteristic.SecuritySystemCurrentState.AWAY_ARM;
                    break;
                case "Disarmed":
                    state = this.hapCharacteristic.SecuritySystemCurrentState.DISARMED;
                    break;
                case "NightArmed":
                    state = this.hapCharacteristic.SecuritySystemCurrentState.NIGHT_ARM;
                    break;
                case "StayArmed":
                    state = this.hapCharacteristic.SecuritySystemCurrentState.STAY_ARM;
                    break;
                case "AlarmTriggered":
                    state = this.hapCharacteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
                    break;
                default:
                    state = this.hapCharacteristic.SecuritySystemCurrentState.DISARMED;
                    break;
            }
        }
        else if (characteristic.UUID == (new this.hapCharacteristic.SecuritySystemTargetState()).UUID) {
            switch (securitySystemStatus.value) {
                case "AwayArmed":
                    state = this.hapCharacteristic.SecuritySystemTargetState.AWAY_ARM;
                    break;
                case "Disarmed":
                    state = this.hapCharacteristic.SecuritySystemTargetState.DISARM;
                    break;
                case "NightArmed":
                    state = this.hapCharacteristic.SecuritySystemTargetState.NIGHT_ARM;
                    break;
                case "StayArmed":
                    state = this.hapCharacteristic.SecuritySystemTargetState.STAY_ARM;
                    break;
                default:
                    state = this.hapCharacteristic.SecuritySystemTargetState.DISARM;
                    break;
            }
        }
        callback(undefined, state);
    }
    updateHomeKitColorFromHomeCenter(color, service) {
        let colors = color.split(",");
        let r = parseInt(colors[0]);
        let g = parseInt(colors[1]);
        let b = parseInt(colors[2]);
        service.RGBValue.red = r;
        service.RGBValue.green = g;
        service.RGBValue.blue = b;
        let hsv = this.RGBtoHSV(r, g, b);
        service.HSBValue.hue = hsv.h;
        service.HSBValue.saturation = hsv.s;
        service.HSBValue.brightness = hsv.v;
        return hsv;
    }
    RGBtoHSV(r, g, b) {
        if (arguments.length === 1) {
            g = r.g, b = r.b, r = r.r;
        }
        var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h, s = (max === 0 ? 0 : d / max), v = max / 255;
        switch (max) {
            case min:
                h = 0;
                break;
            case r:
                h = (g - b) + d * (g < b ? 6 : 0);
                h /= 6 * d;
                break;
            case g:
                h = (b - r) + d * 2;
                h /= 6 * d;
                break;
            case b:
                h = (r - g) + d * 4;
                h /= 6 * d;
                break;
        }
        return {
            h: h * 360.0,
            s: s * 100.0,
            v: v * 100.0
        };
    }
}
exports.GetFunctions = GetFunctions;
