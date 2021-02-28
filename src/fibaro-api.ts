//    Copyright 2021 ilcato
// 
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
// 
//        http://www.apache.org/licenses/LICENSE-2.0
// 
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.

// Fibaro rest api client

'use strict';

import superagent = require('superagent');

declare const Buffer;

export class FibaroClient {

	url: string;
	host: string;
	auth: string;
	headers: any;

	constructor(host, username, password, log) {
		this.host = host;
		this.auth = "Basic " + new Buffer.from(username + ":" + password).toString("base64");
		this.headers = {
			"Authorization": this.auth
		};
	}
	composeURL(service) {
		return "http://" + this.host + service;
	}
	genericGet(service) {
		const url = this.composeURL(service);

		return superagent
			.get(url)
			.set('Authorization', this.auth)
			.set('accept', 'json');
	}
	genericPost(service, body) {
		const url = this.composeURL(service);
		return superagent
			.post(url)
			.send(body)
			.set('Authorization', this.auth)
			.set('accept', 'json');
	}
	genericPut(service, body) {
		const url = this.composeURL(service);
		return superagent
			.put(url)
			.send(body)
			.set('Authorization', this.auth)
			.set('accept', 'json');
	}

	getScenes() {
		return this.genericGet('/api/scenes');
	}
	getRooms() {
		return this.genericGet('/api/rooms');
	}
	getDevices() {
		return this.genericGet('/api/devices');
	}
	getDeviceProperties(ID) {
		return this.genericGet('/api/devices/' + ID);
	}
	refreshStates(lastPoll) {
		return this.genericGet('/api/refreshStates?last=' + lastPoll);
	}
	executeDeviceAction(ID, action, param) {
		const body = param !== null ? {
			"args": param,
			"delay": 0
		} : {};
		return this.genericPost('/api/devices/' + ID + '/action/' + action, body)
	}
	executeScene(ID) {
		const body = {};
		return this.genericPost('/api/scenes/' + ID + '/execute', body)
	}
	getGlobalVariable(globalVariableID) {
		return this.genericGet('/api/globalVariables/' + globalVariableID);
	}
	setGlobalVariable(globalVariableID, value) {
		const body = value !== null ? {
			"value": value,
			"invokeScenes": true
		} : null;
		return this.genericPut('/api/globalVariables/' + globalVariableID, body)
	}
}
