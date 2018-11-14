export declare class MqttConnection {
    client: any;
    constructor(host: string, port: number);
    onConnected(): void;
    subscribeTopic(topic: string): void;
    sendMessage(message: string, topic: string): void;
    onMessage(): void;
    onConnectionLost(): void;
}
