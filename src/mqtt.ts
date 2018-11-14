import { Paho } from 'ng2-mqtt/mqttws31';

export class MqttConnection {
  client;

  constructor(host: string, port: number) {
    this.client = new Paho.MQTT.Client(host, port, 'homebridge-Fibaro-HC2');

    this.onMessage();
    this.onConnectionLost();
    this.client.connect(
      {
        onSuccess: this.onConnected.bind(this),
        keepAliveInterval: 30,
        reconnect: true,         // Enable automatic reconnect
        reconnectInterval: 10     // Reconnect attempt interval : 10 seconds        
      });
  }

  onConnected() {
    console.log("Connected");
  }

  subscribeTopic(topic: string) {
    this.client.subscribe(topic);
  }

  sendMessage(message: string, topic: string) {
    let packet = new Paho.MQTT.Message(message);
    packet.destinationName = topic;
    this.client.send(packet);
  }

  onMessage() {
    this.client.onMessageArrived = (message: Paho.MQTT.Message) => {
      console.log('Message arrived : ' + message.payloadString);
    };
  }

  onConnectionLost() {
    this.client.onConnectionLost = (responseObject: Object) => {
      console.log('Connection lost : ' + JSON.stringify(responseObject));
    };
  }
}
