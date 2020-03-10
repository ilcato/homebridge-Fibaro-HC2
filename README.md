# homebridge-Fibaro-HC2 [![npm version](https://badge.fury.io/js/homebridge-fibaro-hc2.svg)](https://badge.fury.io/js/homebridge-fibaro-hc2)
Homebridge plugin for Fibaro Home Center 2

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-fibaro-hc2) and should be installed "globally" by typing:

    npm install -g homebridge-fibaro-hc2
    
# Configuration
Remember to configure the plugin in config.json in your home directory inside the .homebridge directory. Configuration parameters:
+ "host": "PUT IP ADDRESS OF YOUR HC2 HERE"
+ "username": "PUT USERNAME OF YOUR HC2 HERE"
+ "password": "PUT PASSWORD OF YOUR HC2 HERE"
+ "pollerperiod": "PUT 0 FOR DISABLING POLLING, 1 - 100 INTERVAL IN SECONDS. 2 SECONDS IS THE DEFAULT"
+ "securitysystem": "PUT enabled OR disabled IN ORDER TO MANAGE THE AVAILABILITY OF THE SECURITY SYSTEM"
+ "switchglobalvariables": "PUT A COMMA SEPARATED LIST OF HOME CENTER GLOBAL VARIABLES ACTING LIKE A BISTABLE SWITCH"
+ "thermostattimeout": "PUT THE NUMBER OF SECONDS FOR THE THERMOSTAT TIMEOUT, DEFAULT: 7200 (2 HOURS). PUT 0 FOR INFINITE"
+ "enablecoolingstatemanagemnt": "PUT on TO AUTOMATICALLY MANAGE HEATING STATE FOR THERMOSTAT, off TO DISABLE IT. DEFAULT off"
+ "doorlocktimeout": "PUT 0 FOR DISABLING THE CHECK. PUT A POSITIVE INTEGER N NUMBER ENABLE IT AFTER N SECONDS. DEFAULT 0"
+ "IFTTTmakerkey": "PUT KEY OF YOUR MAKER CHANNEL HERE (USED TO SIGNAL EVENTS TO THE OUTSIDE)"
+ "enableIFTTTnotification": "PUT all FOR ENABLING NOTIFICATIONS OF ALL KIND OF EVENTS, hc FOR CHANGE EVENTS COMING FROM HOME CENTER, hk FOR CHANGE EVENTS COMING FROM HOMEKIT, none FOR DISABLING NOTIFICATIONS; DEFAULT IS none"

Look for a sample config in [config.json example](https://github.com/ilcato/homebridge-Fibaro-HC2/blob/master/config.json)


# Release notes
Version 2.3.1
+ Added support for Fibaro FGRGBW442CC. Attention!!! It may broke support for other color controllers types. Please have a check and report an issue in case of mulfunctioning.

Version 2.3.0
+ Fix thermostat temperature reading.

Version 2.2.9
+ Manage fahrenheit units.

Version 2.2.8
+ Manage the case of absence of plugin configuration.
+ Max ambient light level to 100000

Version 2.2.7
+ Support for Fibaro Walli Roller Shutter, Smartplug and Switch.

Version 2.2.6
+ Support for Fibaro Walli dimmer.

Version 2.2.4
+ Support for lamellas position in Venetian blinds.
+ Accessory information - Manufacturer, model, serial and firmware.
+ Battery level support.

Version 2.2.3
+ Debug version for fixing Danalock Siri #136.

Version 2.2.2
+ Fixed support for Fibaro Roller Shutter 3

Version 2.2.1
+ Fixed Danalock Siri #136.
+ Satel plugin zone and output support
+ Fixed support for Fibaro Roller Shutter 3

Version 2.2.0
+ Fixed Aeon Labs Dimmer seen as switch.
+ Fixed flickering bug in Security System
+ Support for Fibaro Roller Shutter 3, Fibaro Door/Window Sensor 2 and Fibaro Double Switch 2

Version 2.1.9
+ Fixed not working poller period disabling.
+ Fixed Fibaro RGBW support.

Version 2.1.8
+ Added support for Fibaro FGWPG111.

Version 2.1.7
+ Added support for Harmony Hub Fibaro plugin.

Version 2.1.6
+ Fixed triggering a scene via global variable change #108.

Version 2.1.5
+ Fixed further Security System bug #74.

Version 2.1.4
+ Fixed Security System bug #74.

Version 2.1.3
+ Fixed thermostat setpoint management.

Version 2.1.2
+ Fixed temperature management in Remotec ZXT-120 AC IR Extender.

Version 2.1.1
+ Fixed mode management in Remotec ZXT-120 AC IR Extender.

Version 2.1.0
+ Added support for Remotec ZXT-120 AC IR Extender.
+ Minor bug fixes.

Version 2.0.9
+ Added support for generic Smoke Detector.
+ Added support for Fibaro Thermostat.
+ Added support for Fibaro CO Sensor.
+ Added support for IFTTT notification integration. See Wiki.
+ Added support for Lock error detection and notification via IFTTT.

Version 2.0.8
+ Added support for Garage Door Controllers. Tested only on Aeon Garage Door Controller.
+ Fix in RGBW mapping

Version 2.0.7
+ Various fixes

Version 2.0.6
+ Fix automatic cooling state management.

Version 2.0.5
+ New config parameter for enabling automatic cooling state management.

Version 2.0.4
+ New config parameter for setting thermostat timeout.

Version 2.0.3
+ Fixed support for Switch accessories mapped on Home Center global variable. See Wiki.

Version 2.0.2
+ Added support for FGMS001v2
+ Added support for Switch accessories mapped on Home Center global variable. See Wiki.

Version 2.0.1
+ Added management for Heating Cooling state for thermostats
+ Fixed poller update

Version 2.0.0
+ Rewritten in TypeScript
+ Fixed Security System management (see updated Wiki)
+ Removed room grouping support
+ Better maintainability and extensibility 

Version 1.1.2
+ Fixed RGBW

Version 1.1.1
+ Security system accessory fixed reading current status

Version 1.1.0
+ Security system accessory added - See wiki

Version 1.0.9
+ Thermostat logic fix.

Version 1.0.8
+ Thermostat logic cleanup and refactoring.

Version 1.0.7
+ Fixed Danfoss thermostat. Default 2 hours delay.

Version 1.0.6
+ Fixed Danfoss thermostat. It now correctly appears on Home app.

Version 1.0.5
+ Fixed problem with thermostat.

Version 1.0.4
+ Fixed problem displaying 0 lux luminosity sensor value.

Version 1.0.3
+ Added support for Fibaro Smoke detector

Version 1.0.2
+ Managed danalock correctly
+ Added support for new Fibaro wall plug

Version 1.0.1
+ Managed the case of Virtual Devices without any buttons in it: no accessory creation

Version 1.0.0
+ Managed automatic update of the additions, deletions and changes of Home Center devices into HomeBridge: simply restart HomeBridge every time you make a change in Home Center.  
This is the first (maybe the last) production ready version of the plugin.  
If an existing installation of the plugin exists you MUST delete the accessories folder within the .homebridge folder. This will invalidate existing homekit scenes or triggers that MUST be recreated.  

Version 0.7.0
+ Managed negative value for temperature sensors
+ Fixed bug in managing door/window sensor automatic status update

Version 0.6.9
+ Added support for flood/leak sensors (thanks to leoneleone)
+ Managed remapping of 99% to 100% between homekit and Home Center also for blinds (thanks ryanmaxwell)

Version 0.6.8
+ Added new type definition for Fibaro Dimmer 2
+ Managed remapping of 99% to 100% between homekit and Home Center
+ Managed automatic setting of manage devices for relay associated to lights

Version 0.6.7
+ Fixed contact sensor status detection
+ Fixed management of multiple devices with the same name

Version 0.6.6
+ Added support for Door Locks (tested on Danalock and Yale devices)

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

