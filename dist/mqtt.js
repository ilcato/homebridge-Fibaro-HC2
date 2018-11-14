"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mqttws31_1 = require("ng2-mqtt/mqttws31");
class MqttConnection {
    constructor(host, port) {
        this.client = new mqttws31_1.Paho.MQTT.Client(host, port, 'homebridge-Fibaro-HC2');
        this.onMessage();
        this.onConnectionLost();
        this.client.connect({
            onSuccess: this.onConnected.bind(this),
            keepAliveInterval: 30,
            reconnect: true,
            reconnectInterval: 10 // Reconnect attempt interval : 10 seconds        
        });
    }
    onConnected() {
        console.log("Connected");
    }
    subscribeTopic(topic) {
        this.client.subscribe(topic);
    }
    sendMessage(message, topic) {
        let packet = new mqttws31_1.Paho.MQTT.Message(message);
        packet.destinationName = topic;
        this.client.send(packet);
    }
    onMessage() {
        this.client.onMessageArrived = (message) => {
            console.log('Message arrived : ' + message.payloadString);
        };
    }
    onConnectionLost() {
        this.client.onConnectionLost = (responseObject) => {
            console.log('Connection lost : ' + JSON.stringify(responseObject));
        };
    }
}
exports.MqttConnection = MqttConnection;
//# sourceMappingURL=mqtt.js.map