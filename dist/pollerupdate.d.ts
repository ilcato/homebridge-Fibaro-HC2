export declare class Poller {
    platform: any;
    pollingUpdateRunning: boolean;
    lastPoll: number;
    pollerPeriod: number;
    hapCharacteristic: any;
    constructor(platform: any, pollerPeriod: any, hapCharacteristic: any);
    poll(): void;
    manageValue(change: any): void;
    manageColor(change: any): void;
}
