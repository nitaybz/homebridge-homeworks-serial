let Characteristic, Service

class Button {
	constructor(device, platform) {
		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic
		
		this.rs232 = platform.rs232
		this.log = platform.log
		this.api = platform.api
		this.storage = platform.storage
		this.cachedState = platform.cachedState
		this.address = device.address
		this.buttonId = device.buttonId
		this.id = `${this.address}.${this.buttonId}`
		this.name = device.name || this.id
		this.serial = this.id
		this.type = device.type
		this.pressType = device.pressType || 'single'
		this.manufacturer = 'Lutron Homeworks'
		this.model = 'Programmable Button'
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

		
		this.addButtonService()
	}

	addButtonService() {
		this.log.easyDebug(`Adding Button service for "${this.name}"`)
		this.ButtonService = this.accessory.getService(Service.StatelessProgrammableSwitch)
		if (!this.ButtonService)
			this.ButtonService = this.accessory.addService(Service.StatelessProgrammableSwitch, this.name, this.type)


		this.ButtonService.getCharacteristic(Characteristic.ProgrammableSwitchEvent)

	}


	updateHomeKit(newState) {
		if (this.processing)
			return

		this.state = newState
		
		this.updateValue('ButtonService', 'ProgrammableSwitchEvent', this.state.ProgrammableSwitchEvent)
		// cache last state to storage
		this.storage.setItem('hw-serial-state', this.cachedState)
	}

	updateValue (serviceName, characteristicName, newValue) {
		this[serviceName].getCharacteristic(Characteristic[characteristicName]).updateValue(newValue)
		this.log.easyDebug(`${this.name} (${this.id}) - Updated '${characteristicName}' for ${serviceName} with NEW EVENT: ${newValue}`)
	}
}


module.exports = Button