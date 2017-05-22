export declare class GetFunctions {
    hapCharacteristic: any;
    getFunctionsMapping: Map<string, any>;
    getCurrentSecuritySystemStateMapping: Map<string, any>;
    getTargetSecuritySystemStateMapping: Map<string, any>;
    platform: any;
    constructor(hapCharacteristic: any, platform: any);
    returnValue(r: any, callback: any, characteristic: any): void;
    getBool(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getFloat(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getBrightness(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getPositionState(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getCurrentPosition(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getTargetTemperature(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getContactSensorState(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getLeakDetected(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getSmokeDetected(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getOutletInUse(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getLockCurrentState(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getCurrentHeatingCoolingState(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getTargetHeatingCoolingState(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getTemperatureDisplayUnits(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getHue(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getSaturation(callback: any, characteristic: any, service: any, IDs: any, properties: any): void;
    getSecuritySystemTargetState(callback: any, characteristic: any, service: any, IDs: any, securitySystemStatus: any): void;
    updateHomeKitColorFromHomeCenter(color: any, service: any): {
        h: number;
        s: number;
        v: number;
    };
    RGBtoHSV(r: any, g: any, b: any): {
        h: number;
        s: number;
        v: number;
    };
}
