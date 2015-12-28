# homebridge-Fibaro-HC2
Homebridge plugin for Fibaro Home Center 2

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-fibaro-hc2) and should be installed "globally" by typing:

    npm install -g homebridge-fibaro-hc2
    
# Release notes
Version 0.5.0
+ In order to cope with the limits of HomeKit accessory per bridge (100 maximum) the plugin now group Home Center devices into a single HomeKit accessory per room.
+ Virtual devices are managed in the old way: an Accessory for each virtual device that contains a push button for each virtual button
+ Initial support for Fibaro RGB (only on off commands works for now)
+ Initial support for Danfoss Thermostat (only temperature commands works for now)

# Configuration
Remember to configure the plugin in config.json in your home directory inside the .homebridge directory.
Look for a sample config in [config.json example](https://github.com/ilcato/homebridge-Fibaro-HC2/blob/master/config.json)



