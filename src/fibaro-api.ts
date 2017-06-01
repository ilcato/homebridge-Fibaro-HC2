//    Copyright 2017 ilcato
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

import request = require("request");

declare const Buffer;	

export class FibaroClient {

	host: string;
	username: string;
	password: string;
	auth: string;
	headers: any;
	
	constructor(host, username, password) {
		this.host = host;
  		this.auth = "Basic " + new Buffer(username + ":" + password).toString("base64");
		this.headers = {
					"Authorization" : this.auth
		}
	}
	getScenes() {
		let p = new Promise((resolve, reject) => {
			let url = "http://"+this.host+"/api/scenes";
			request.get({
				url: url,
				headers : this.headers,
				json: true
			}, function(err, response, json) {
				if (!err && response.statusCode == 200)
					resolve(json);
				else
					reject(err);
			});
		});
		return p;
	}
	getRooms() {
		let p = new Promise((resolve, reject) => {
			let url = "http://"+this.host+"/api/rooms";
			request.get({
				url: url,
				headers : this.headers,
				json: true
			}, function(err, response, json) {
				if (!err && response.statusCode == 200)
					resolve(json);
				else
					reject(err);
			});
		});
		return p;
	}
	getDevices() {
		let p = new Promise((resolve, reject) => {
			let url = "http://"+this.host+"/api/devices";
			request.get({
				url: url,
				headers : this.headers,
				json: true
			}, function(err, response, json) {
				if (!err && response.statusCode == 200) 
					resolve(json);
				else
					reject(err);
			});
		});
		return p;
	}
	getDeviceProperties(ID) {
		let p = new Promise((resolve, reject) => {
			let url = "http://"+this.host+"/api/devices/"+ID;
			request.get({
				url: url,
				headers : this.headers,
				json: true
			}, function(err, response, json) {
				if (!err && response.statusCode == 200) 
					resolve(json.properties);
				else
					reject(err);
			});
		});
		return p;
	}
	executeDeviceAction(ID, action, param) {
		let p = new Promise((resolve, reject) => {
			let url = "http://"+this.host+"/api/devices/"+ID+"/action/"+action;
			let body = param != undefined ? JSON.stringify({
				  "args": [	param ]
			}) : null;
			let method = "post";
			request({
				url: url,
				body: body,
				method: method,
				headers: this.headers
			}, function(err, response) {
				if (!err && (response.statusCode == 200 || response.statusCode == 202)) 
					resolve(response);
				else
					reject(err);
			});
		});
		return p;
	}
	executeScene(ID) {
		let p = new Promise((resolve, reject) =>  {
			let url = "http://"+this.host+"/api/scenes/"+ID+"/action/start";
			let body = null;
			let method = "post";
			request({
				url: url,
				body: body,
				method: method,
				headers: this.headers
			}, function(err, response) {
				if (!err && (response.statusCode == 200 || response.statusCode == 202)) 
					resolve(response);
				else
					reject(err);
			});
		});
		return p;
	}
	refreshStates(lastPoll) {
		let p = new Promise((resolve, reject) => {
			let url = "http://"+this.host +"/api/refreshStates?last=" + lastPoll;
			request.get({
				url: url,
				headers : this.headers,
				json: true
			}, function(err, response, json) {
				if (!err && response.statusCode == 200) 
					resolve(json);
				else
					reject(err);
			});
		});
		return p;
	}
	getGlobalVariable(globalVariableID) {
		let p = new Promise((resolve, reject) => {
			let url = "http://"+this.host+"/api/globalVariables/"+globalVariableID;
			request.get({
				url: url,
				headers : this.headers,
				json: true
			}, function(err, response, json) {
				if (!err && response.statusCode == 200) 
					resolve(json);
				else
					reject(err);
			});
		});
		return p;
	}
	setGlobalVariable(globalVariableID, value) {
		let p = new Promise((resolve, reject) => {
			let url = "http://"+this.host+"/api/globalVariables/"+globalVariableID;
			let body = value != undefined ? JSON.stringify({
				  "value": value
			}) : null;

			let method = "PUT";

			request({
				url: url,
				headers : this.headers,
				body: body,
				method: method
			}, function(err, response) {
				if (!err && response.statusCode == 200) 
					resolve(response);
				else
					reject(err);
			});
		});
		return p;
	}
	
}
