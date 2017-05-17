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
		this.username = username;
		this.password = password;
  		this.auth = "Basic " + new Buffer(this.username + ":" + this.password).toString("base64");
		this.headers = {
					"Authorization" : this.auth
		}
	}
	getScenes() {
		var p = new Promise((resolve, reject) => {
			var url = "http://"+this.host+"/api/scenes";
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
		var p = new Promise((resolve, reject) => {
			var url = "http://"+this.host+"/api/rooms";
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
		var p = new Promise((resolve, reject) => {
			var url = "http://"+this.host+"/api/devices";
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
		var p = new Promise((resolve, reject) => {
			var url = "http://"+this.host+"/api/devices/"+ID;
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
		var p = new Promise((resolve, reject) => {
			var url = "http://"+this.host+"/api/devices/"+ID+"/action/"+action;
			var body = param != undefined ? JSON.stringify({
				  "args": [	param ]
			}) : null;
			var method = "post";
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
		var p = new Promise((resolve, reject) =>  {
			var url = "http://"+this.host+"/api/scenes/"+ID+"/action/start";
			var body = null;
			var method = "post";
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
		var p = new Promise((resolve, reject) => {
			var url = "http://"+this.host +"/api/refreshStates?last=" + lastPoll;
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
		var p = new Promise((resolve, reject) => {
			var url = "http://"+this.host+"/api/globalVariables/"+globalVariableID;
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
}
