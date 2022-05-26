let Characteristic, Service
const stateManager = require('../lib/stateManager')

class WindowCovering {
	constructor(device, platform) {
		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic
		
		this.rs232 = platform.rs232
		this.log = platform.log
		this.api = platform.api
		this.storage = platform.storage
		this.cachedState = platform.cachedState
		this.address = device.address
		this.openButtonId = device.openButtonId
		this.closeButtonId = device.closeButtonId
		this.midButtonId = device.midButtonId
		this.pressType = device.pressType || 'single'
		this.id = `${this.address}.${this.openButtonId}.${this.closeButtonId}.${this.pressType}`
		this.address = device.address
		this.name = device.name || this.id
		this.serial = this.id
		this.type = device.type
		this.manufacturer = 'Lutron Homeworks'
		this.model = 'Window Covering'
		this.displayName = this.name
		this.state = this.cachedState[this.id]
		this.processing = false
		
		this.UUID = this.api.hap.uuid.generate(this.id)
		this.accessory = platform.accessories.find(accessory => accessory.UUID === this.UUID)

		if (!this.accessory) {
			this.log(`Creating New ${this.type} (${this.model}) Accessory: "${this.name}"`)
			this.accessory = new this.api.platformAccessory(this.name, this.UUID)
			this.accessory.context.type = this.type
			this.accessory.context.id = this.id

			platform.accessories.push(this.accessory)
			// register the accessory
			this.api.registerPlatformAccessories(platform.PLUGIN_NAME, platform.PLATFORM_NAME, [this.accessory])
		} else {
			this.log.easyDebug(`"${this.name}" is Connected!`)
			if (this.type !== this.accessory.context.type) {
				this.removeOtherTypes()
				this.accessory.context.type = this.type
			}
		}

		let informationService = this.accessory.getService(Service.AccessoryInformation)

		if (!informationService)
			informationService = this.accessory.addService(Service.AccessoryInformation)

		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)

		
		
		this.addWindowCoveringService()
	}

	addWindowCoveringService() {
		this.log.easyDebug(`Adding WindowCovering service for "${this.name}"`)
		this.WindowCoveringService = this.accessory.getService(Service.WindowCovering)
		if (!this.WindowCoveringService)
			this.WindowCoveringService = this.accessory.addService(Service.WindowCovering, this.name, this.type)

		this.WindowCoveringService.getCharacteristic(Characteristic.CurrentPosition)
			.updateValue(this.state.CurrentPosition || 0)

		this.WindowCoveringService.getCharacteristic(Characteristic.PositionState)
			.updateValue(!this.state.PositionState && this.state.PositionState !== 0 ? 2 : this.state.PositionState)

		this.WindowCoveringService.getCharacteristic(Characteristic.TargetPosition)
			.setProps({
				minValue: 0,
				maxValue: 100,
				minStep: this.midButtonId ? 50 : 100
			})
			.onSet(stateManager.set.TargetPosition.bind(this, Characteristic))
			.updateValue(this.state.TargetPosition || 0)
	}



	updateHomeKit(newState) {
		if (this.processing)
			return
			
		this.state = newState
			
		if (this.state.PositionState === 2)
			this.updateValue('WindowCoveringService', 'CurrentPosition', this.state.CurrentPosition)

		this.updateValue('WindowCoveringService', 'TargetPosition', this.state.TargetPosition)
		this.updateValue('WindowCoveringService', 'PositionState', this.state.PositionState)

		// cache last state to storage
		this.storage.setItem('hw-serial-state', this.cachedState)
	}

	updateValue (serviceName, characteristicName, newValue) {
		if (this[serviceName].getCharacteristic(Characteristic[characteristicName]).value !== newValue) {
			this[serviceName].getCharacteristic(Characteristic[characteristicName]).updateValue(newValue)
			this.log.easyDebug(`${this.name} (${this.id}) - Updated '${characteristicName}' for ${serviceName} with NEW VALUE: ${newValue}`)
		}
	}
}


module.exports = WindowCovering