// Fibaro rest api client

'use strict';

var request = require("request");

function FibaroClient(host, username, password) {
	this.host = host;
	this.username = username;
	this.password = password;
  	this.auth = "Basic " + new Buffer(this.username + ":" + this.password).toString("base64");
}
FibaroClient.prototype.getRooms = function() {
	var that = this;
	var p = new Promise(function(resolve, reject) {
	  	var url = "http://"+that.host+"/api/rooms";
    	request.get({
      		url: url,
      		headers : {
            	"Authorization" : that.auth
      		},
      		json: true
    	}, function(err, response, json) {
      		if (!err && response.statusCode == 200)
        		resolve(json);
        	else
        		reject(err, response);
        });
	});
	return p;
}
FibaroClient.prototype.getDevices = function() {
	var that = this;
	var p = new Promise(function(resolve, reject) {
	  	var url = "http://"+that.host+"/api/devices";
	    request.get({
			url: url,
      		headers : {
            	"Authorization" : that.auth
      		},
      		json: true
    	}, function(err, response, json) {
      		if (!err && response.statusCode == 200) 
        		resolve(json);
        	else
        		reject(err, response);
        });
	});
	return p;
}
FibaroClient.prototype.getDeviceProperties = function(ID) {
	var that = this;
	var p = new Promise(function(resolve, reject) {
	    var url = "http://"+that.host+"/api/devices/"+ID;
	    request.get({
			url: url,
      		headers : {
            	"Authorization" : that.auth
      		},
      		json: true
    	}, function(err, response, json) {
      		if (!err && response.statusCode == 200) 
        		resolve(json.properties);
        	else
        		reject(err, response);
        });
	});
	return p;
}
FibaroClient.prototype.executeDeviceAction = function(ID, action, param) {
	var that = this;
	var p = new Promise(function(resolve, reject) {
		var url = "http://"+that.host+"/api/devices/"+ID+"/action/"+action;
		var body = param != undefined ? JSON.stringify({
			  "args": [	param ]
		}) : null;
		var method = "post";
		request({
			url: url,
			body: body,
			method: method,
			headers: {
				"Authorization" : that.auth
			}
    	}, function(err, response) {
      		if (!err && response.statusCode == 200) 
        		resolve(response);
        	else
        		reject(err, response);
        });
	});
	return p;
}
FibaroClient.prototype.refreshStates = function(lastPoll) {
	var that = this;
	var p = new Promise(function(resolve, reject) {
	  	var url = "http://"+that.host +"/api/refreshStates?last=" + lastPoll;
	    request.get({
			url: url,
      		headers : {
            	"Authorization" : that.auth
      		},
      		json: true
    	}, function(err, response, json) {
      		if (!err && response.statusCode == 200) 
        		resolve(json);
        	else
        		reject(err, response);
        });
	});
	return p;
}

module.exports.createClient = function(host, username, password) {
	return new FibaroClient(host, username, password);
}
