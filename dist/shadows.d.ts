export declare const pluginName = "homebridge-fibaro-hc2";
export declare const platformName = "FibaroHC2";
export declare class ShadowService {
    controlService: any;
    characteristics: any[];
    constructor(controlService: any, characteristics: any[]);
}
export declare class ShadowAccessory {
    name: string;
    roomID: string;
    services: ShadowService[];
    accessory: any;
    hapAccessory: any;
    hapService: any;
    hapCharacteristic: any;
    platform: any;
    isSecuritySystem: boolean;
    constructor(device: any, services: ShadowService[], hapAccessory: any, hapService: any, hapCharacteristic: any, platform: any, isSecurritySystem?: boolean);
    initAccessory(): void;
    removeNoMoreExistingServices(): void;
    addNewServices(platform: any): void;
    resgisterUpdateccessory(isNewAccessory: any, api: any): void;
    setAccessory(accessory: any): void;
    static createShadowAccessory(device: any, hapAccessory: any, hapService: any, hapCharacteristic: any, platform: any): ShadowAccessory | undefined;
    static createShadowSecuritySystemAccessory(device: any, hapAccessory: any, hapService: any, hapCharacteristic: any, platform: any): ShadowAccessory;
    static createShadowGlobalVariableSwitchAccessory(device: any, hapAccessory: any, hapService: any, hapCharacteristic: any, platform: any): ShadowAccessory;
}
