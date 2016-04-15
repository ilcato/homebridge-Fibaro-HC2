# homebridge-Fibaro-HC2
Homebridge plugin for Fibaro Home Center 2

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-fibaro-hc2) and should be installed "globally" by typing:

    npm install -g homebridge-fibaro-hc2
    
# Release notes
Version 0.6.5
+ Fixed bug in contact sensors detection

Version 0.6.4
+ Added support for Humidity sensors

Version 0.6.3
+ Bug fixes in room grouping

Version 0.6.2
+ Bug fixes in Windows Covering in iOs 9.3
+ Added configuration parameter "pollerperiod"

Version 0.6.1
+ Bug fixes
+ Managed versioning of Fibaro Motion Sensor devices
+ Better log

Version 0.6.0
+ Migrated to the new homebridge 2.0 API

Version 0.5.4
+ Added support for Forest Shuttle curtain system

Version 0.5.3
+ Added support for Horstmann thermostat (eg.: Horstmann HRT4-ZW, Secure SRT321, ...)

Version 0.5.2
+ Added configuration parameter "grouping": put "room" for grouping devices by room, "none" for no grouping at all

Version 0.5.1
+ Full support for Fibaro RGB controller
+ Full support for Danfoss Thermostat

Version 0.5.0
+ In order to cope with the limits of HomeKit accessory per bridge (100 maximum) the plugin now group Home Center devices into a single HomeKit accessory per room.
+ Virtual devices are managed in the old way: an Accessory for each virtual device that contains a push button for each virtual button
+ Initial support for Fibaro RGB (only on off commands works for now)
+ Initial support for Danfoss Thermostat (only temperature commands works for now)

# Configuration
Remember to configure the plugin in config.json in your home directory inside the .homebridge directory. Configuration parameters:
+ "host": "PUT IP ADDRESS OF YOUR HC2 HERE",
+ "username": "PUT USERNAME OF YOUR HC2 HERE",
+ "password": "PUT PASSWORD OF YOUR HC2 HERE",
+ "grouping": "PUT none OR room"
+ "pollerperiod": "PUT 0 FOR DISABLING POLLING, 1 - 100 INTERVAL IN SECONDS. 2 SECONDS IS THE DEFAULT"

Look for a sample config in [config.json example](https://github.com/ilcato/homebridge-Fibaro-HC2/blob/master/config.json)



