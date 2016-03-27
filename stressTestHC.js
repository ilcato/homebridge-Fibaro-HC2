var fibaroClient = require('./lib/fibaro-api').createClient("10.0.0.16", "admin", "1tehran");
var lastPoll = 0;
var counter = 100;


function test1() {
  	fibaroClient.refreshStates(lastPoll)
  		.then(function (updates) {
			lastPoll = updates.last;
  			console.log(JSON.stringify(updates));
  			if (counter--) {
	    		setTimeout( 
	    			function() {
	    			 	test1();
	    			}, 1000 );
  			}
  		})
  		.catch(function(err, response) {
  			console.log(err);
  			console.log(response);
  		});
}
function test2() {
	for (var i=0; i<1000000;i++) {
  		console.log(i + " iteration");
	  	fibaroClient.refreshStates(lastPoll);
	};
}

test1();