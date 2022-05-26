const storage = require('node-persist')
const path = require('path')
const lutronHW = require('./lib/lutron-hw')
const fs = require('fs');
const PLUGIN_NAME = 'homebridge-homeworks-serial'
const PLATFORM_NAME = 'HomeworksSerial'
module.exports = (api) => {
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HomeworksSerialPlatform)
}

class HomeworksSerialPlatform {

	constructor(log, config, api) {
		this.api = api
		this.log = log
		this.config = config

		this.accessories = []
		this.homeworksDevices = []
		this.PLUGIN_NAME = PLUGIN_NAME
		this.PLATFORM_NAME = PLATFORM_NAME
		this.name = config.name || PLATFORM_NAME
		this.devices = config.devices || []
		this.debug = config.debug || false
		this.extended = config.extended || false 
		this.storage = storage
		this.persistPath = path.join(this.api.user.persistPath(), '/../homeworks-serial-persist')
		if (!fs.existsSync(this.persistPath))
			fs.mkdirSync(this.persistPath)

		
		// define debug method to output debug logs when enabled in the config
		this.log.easyDebug = (...content) => {
			if (this.debug) {
				this.log(content.reduce((previous, current) => {
					return previous + ' ' + current
				}))
			} else
				this.log.debug(content.reduce((previous, current) => {
					return previous + ' ' + current
				}))
		}


		this.api.on('didFinishLaunching', async () => {

			lutronHW.homekitSync.bind(this)

			await this.storage.init({
				dir: this.persistPath,
				forgiveParseErrors: true
			})
	
			this.cachedState = await this.storage.getItem('hw-serial-state') || {}

			if (this.extended)
				this.rs232 = lutronHW.initIPCClient.bind(this)
			else
				this.rs232 = lutronHW.initPort.bind(this)
		})

	}

	configureAccessory(accessory) {
		this.log.easyDebug(`Found Cached Accessory: ${accessory.displayName} (${accessory.context.deviceId}) `)
		this.accessories.push(accessory)
	}
}