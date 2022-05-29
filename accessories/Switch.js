let Characteristic, Service
const stateManager = require('../lib/stateManager')

class Switch {
	constructor(device, platform) {
		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic
		
		this.rs232 = platform.rs232
		this.log = platform.log
		this.api = platform.api
		this.cachedState = platform.cachedState
		this.address = device.address
		this.buttonId = device.buttonId
		this.pressType = device.pressType || 'single'
		this.id = `${this.address}.${this.buttonId}.${this.pressType}`
		this.name = device.name || this.id
		this.serial = this.id
		this.type = device.type
		this.manufacturer = 'Lutron Homeworks'
		this.model = 'Switch'
		this.displayName = this.name
			
		this.state = {
			On: false
		}

		this.processing = false
		
		this.UUID = this.api.hap.uuid.generate(this.id)
		this.accessory = platform.accessories.find(accessory => accessory.UUID === this.UUID)

		if (!this.accessory) {
			this.log(`Creating New ${this.type} (${this.model}) Accessory: "${this.name}"`)
			this.accessory = new this.api.platformAccessory(this.name, this.UUID)
			this.accessory.context.type = this.type
			this.accessory.context.id = this.id
			this.accessory.context.lastState = this.state

			platform.accessories.push(this.accessory)
			// register the accessory
			this.api.registerPlatformAccessories(platform.PLUGIN_NAME, platform.PLATFORM_NAME, [this.accessory])
		} else {
			this.log.easyDebug(`"${this.name}" is Connected!`)
			this.state = this.accessory.context.lastState || {}
		}

		let informationService = this.accessory.getService(Service.AccessoryInformation)

		if (!informationService)
			informationService = this.accessory.addService(Service.AccessoryInformation)

		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)

		
		this.addSwitchService()
	}

	addSwitchService() {
		this.log.easyDebug(`Adding Switch service for "${this.name}"`)
		this.SwitchService = this.accessory.getService(Service.Switch)
		if (!this.SwitchService)
			this.SwitchService = this.accessory.addService(Service.Switch, this.name, this.type)


		this.SwitchService.getCharacteristic(Characteristic.On)
			.onSet(stateManager.set.On.bind(this))
			.updateValue(this.state.On || false)
	}

	updateHomeKit(newState) {
		this.state = newState
		
		this.updateValue('SwitchService', 'On', this.state.On)
		// cache last state to storage
		this.accessory.context.lastState = this.state
	}

	updateValue (serviceName, characteristicName, newValue) {
		if (this[serviceName].getCharacteristic(Characteristic[characteristicName]).value !== newValue) {
			this[serviceName].getCharacteristic(Characteristic[characteristicName]).updateValue(newValue)
			this.log.easyDebug(`${this.name} (${this.id}) - Updated '${characteristicName}' for ${serviceName} with NEW VALUE: ${newValue}`)
		}
	}
}


module.exports = Switch