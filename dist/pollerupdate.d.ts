export declare class Poller {
    platform: any;
    pollingUpdateRunning: boolean;
    lastPoll: number;
    pollerPeriod: number;
    hapService: any;
    hapCharacteristic: any;
    constructor(platform: any, pollerPeriod: any, hapService: any, hapCharacteristic: any);
    poll(): void;
    manageValue(change: any): void;
    manageColor(change: any): void;
    manageOperatingMode(event: any): void;
    searchCharacteristic(globalVariablesID: any): any;
}
