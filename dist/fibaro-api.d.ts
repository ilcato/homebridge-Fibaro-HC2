export declare class FibaroClient {
    host: string;
    username: string;
    password: string;
    auth: string;
    headers: any;
    constructor(host: any, username: any, password: any);
    getScenes(): Promise<{}>;
    getRooms(): Promise<{}>;
    getDevices(): Promise<{}>;
    getDeviceProperties(ID: any): Promise<{}>;
    executeDeviceAction(ID: any, action: any, param: any): Promise<{}>;
    executeScene(ID: any): Promise<{}>;
    refreshStates(lastPoll: any): Promise<{}>;
    getGlobalVariable(globalVariableID: any): Promise<{}>;
    setGlobalVariable(globalVariableID: any, value: any): Promise<{}>;
}
