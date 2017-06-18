export declare const lowestTemp = 12;
export declare const stdTemp = 21;
export declare class SetFunctions {
    hapCharacteristic: any;
    setFunctionsMapping: Map<string, any>;
    getTargetSecuritySystemSceneMapping: Map<number, any>;
    platform: any;
    constructor(hapCharacteristic: any, platform: any);
    setOn(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    setBrightness(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    setTargetPosition(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    setLockTargetState(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    setTargetHeatingCoolingState(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    setTargetTemperature(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    setHue(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    setSaturation(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    setSecuritySystemTargetState(value: any, callback: any, context: any, characteristic: any, service: any, IDs: any): void;
    updateHomeCenterColorFromHomeKit(h: any, s: any, v: any, service: any): {
        r: number;
        g: number;
        b: number;
    };
    HSVtoRGB(hue: any, saturation: any, value: any): {
        r: number;
        g: number;
        b: number;
    };
    syncColorCharacteristics(rgb: any, service: any, IDs: any): void;
    command(c: any, value: any, service: any, IDs: any): void;
    scene(sceneID: any): void;
    setGlobalVariable(variableID: any, value: any): void;
}
