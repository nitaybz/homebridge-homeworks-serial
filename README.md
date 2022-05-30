# homebridge-homeworks-serial

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ text

 ==================================
 IN DEVELOPMENT - PLEASE BE PATIENT
 ==================================
            NOT TESTED
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

<img src="branding/lutron_hw_homebridge.png" width="500px">

&nbsp;

[![Downloads](https://img.shields.io/npm/dt/homebridge-homeworks-serial.svg?color=critical)](https://www.npmjs.com/package/homebridge-homeworks-serial)
[![Version](https://img.shields.io/npm/v/homebridge-homeworks-serial)](https://www.npmjs.com/package/homebridge-homeworks-serial)

[Homebridge](https://github.com/nfarina/homebridge) plugin for Lutron Homeworks using Serial Port (RS232)

Many Thanks to @cptechie who inspired me to create this plugin via his own plugin [homebridge-lutron-homeworks](https://github.com/cptechie/homebridge-lutron-homeworks) and to @davebeyer on the ideas on how to solve the huge amount of accessories via IPC and queue with his plugin [homebridge-lutron-hwi](https://github.com/davebeyer/homebridge-lutron-hwi)

## Config File

###### \* Do not copy-paste this code, it will not work

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ json
"platforms": [
  {
    "platform": "HomeworksSerial",
    "name": "Homeworks Serial",
    "discoveryLogs": true,
    "serialPath": "/dev/ttyUSB0",
    "baudRate": 115200,
    "loginRequired": false,
    "password": "jetski",
    "commandDelay": 100,
    "extended": false,
    "debug": false,
    "devices": [
        {
          "name": "Hallway Light",
          "type": "dimmer",
          "address": "01:01:00:02:04",
          "defaultBrightness": 100,
          "defaultFadeTime": 0
        },
        {
          "name": "Bathroom Light",
          "type": "switch",
          "address": "04:06:01",
          "buttonId": 2,
          "pressType": "single"
        },
        {
          "name": "Heater",
          "type": "outlet",
          "address": "04:06:01",
          "buttonId": 3,
          "pressType": "double"
        },
        {
          "name": "Chiller",
          "type": "switch",
          "address": "04:06:01",
          "buttonId": 1,
          "pressType": "hold"
        },
        {
          "name": "Shutters",
          "type": "windowCovering",
          "address": "04:06:01",
          "timeToOpen": 30,
          "timeToClose": 25,
          "openButtonId": 4,
          "closeButtonId": 5,
          "stopButtonId": 6,
          "pressType": "single"
        },
        {
          "name": "custom",
          "type": "switch",
          "address": "04:06:01",
          "buttonId": 1,
          "rawCommands": {
            "on": "KBP, [04:06:01], 1",
            "off": "KBP, [04:06:01], 2"
          },
          "rawStatus": {
            "on": "KBP, [04:06:01], 1",
            "off": "KBP, [04:06:01], 2"
          }
        },
        {
          "name": "Shutters2",
          "type": "windowCovering",
          "address": "01:01:00:02:04",
          "timeToOpen": 30,
          "timeToClose": 25,
          "rawCommands": {
            "open": "FADEDIM, 16, 0, 0, [01:01:00:02:04]",
            "close": "FADEDIM, 35, 0, 0, [01:01:00:02:04]",
            "stop": "FADEDIM, 0, 0, 0, [01:01:00:02:04]",
            "louver": "KBP, [04:06:01], 1"
          },
          "rawStatus": {
            "open": "DL, [01:01:00:02:04], 16",
            "close": "DL, [01:01:00:02:04], 35",
            "stop": "DL, [01:01:00:02:04], 0",
            "louver": "KBP, [04:06:01], 1"
          }
        },
        {
          "name": "Living Room Scene",
          "type": "button",
          "address": "04:06:01",
          "buttonId": 7
        }
    ]
  }
]
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## Issues & Debug

If you experience any issues with the plugins please refer to the [Issues](https://github.com/nitaybz/homebridge-homeworks-serial/issues) tab and check if your issue is already described there, if it doesn't, please report a new issue with as much detailed information as you can give (logs are crucial).\
if you want to even speed up the process, you can add `"debug": true` to your config, which will give me more details on the logs and speed up fixing the issue.

\
&nbsp;

## Support homebridge-homeworks-serial

**homebridge-homeworks-serial** is a free plugin under the MIT license. it was developed as a contribution to the homebridge/hoobs community with lots of love and thoughts.
Creating and maintaining Homebridge plugins consume a lot of time and effort and if you would like to share your appreciation, feel free to "Star" or donate.

[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue.svg?logo=paypal)](https://www.paypal.me/nitaybz)

[![Patreon](https://img.shields.io/badge/PATREON-Become%20a%20patron-red.svg?logo=patreon)](https://www.patreon.com/nitaybz)

[![Ko-Fi](https://img.shields.io/badge/Ko--Fi-Buy%20me%20a%20coffee-29abe0.svg?logo=ko-fi)](https://ko-fi.com/nitaybz)
