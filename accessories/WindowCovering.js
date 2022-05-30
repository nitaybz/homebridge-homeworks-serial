let Characteristic, Service
const stateManager = require('../lib/stateManager')
const OPENING = 0
const CLOSING = 1
const STOPPED = 2
class WindowCovering {
	constructor(device, platform) {
		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic
		
		this.rs232 = platform.rs232
		this.log = platform.log
		this.api = platform.api
		this.cachedState = platform.cachedState
		this.address = device.address
		this.openButtonId = device.openButtonId
		this.closeButtonId = device.closeButtonId
		this.stopButtonId = device.stopButtonId
		this.louverButtonId = device.louverButtonId
		this.louverPosition = device.louverPosition || 30
		this.rawCommands = device.rawCommands
		this.rawStatus = device.rawStatus
		this.timeToOpen = device.timeToOpen || 0
		this.timeToClose = device.timeToClose || 0
		this.pressType = device.pressType || 'single'
		this.id = `${device.address}.${device.name}`
		this.name = device.name || this.id
		this.serial = this.id
		this.type = device.type
		this.manufacturer = 'Lutron Homeworks'
		this.model = 'Window Covering'
		this.displayName = this.name
		this.louverExist = !!(this.louverButtonId || this.rawCommands.louver)

		this.state = {
			CurrentPosition: 0,
			TargetPosition: 0,
			PositionState: 2
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

		
		
		this.addWindowCoveringService()

		if (this.louverExist)
			this.addLouverSwitch()
		else
			this.removeLouverSwitch()
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
				minStep: this.timeToOpen && this.timeToClose && (this.stopButtonId || (this.rawCommands && this.rawCommands.stop)) ? 1 : 100
			})
			.onSet(stateManager.set.TargetPosition.bind(this, Characteristic))
			.updateValue(this.state.TargetPosition || 0)

		if (this.stopButtonId || (this.rawCommands && this.rawCommands.stop))
			this.WindowCoveringService.getCharacteristic(Characteristic.HoldPosition)
				.onSet(stateManager.set.HoldPosition.bind(this))
				.updateValue(this.state.LouverOn || false)
	}


	addLouverSwitch() {
		this.log.easyDebug(`Adding Louver Switch Service for (${this.name})`)

		this.louverSwitch = this.accessory.getService('Louver')
		if (!this.louverSwitch)
			this.louverSwitch = this.accessory.addService(Service.Switch, 'Louver', `${this.name} Louver`)

		this.louverSwitch.getCharacteristic(Characteristic.On)
			.onSet(stateManager.set.LouverOn.bind(this))

	}

	removeLouverSwitch() {
		let LouverSwitch = this.accessory.getService('Louver')
		if (LouverSwitch) {
			// remove service
			this.accessory.removeService(LouverSwitch)
		}
	}

	toggleLouver() {
		this.state.LouverOn = !this.state.LouverOn
		this.updateValue('louverSwitch', 'On', this.state.LouverOn)

	}

	updatePositionCommand(positionState) {
		if (this.processing || this.state.LouverOn)
			return
		
		if (this.state.PositionState !== STOPPED && this.lastMove) {
			clearTimeout(this.movingTimeout)
			const timeInSecSinceLastMove = (new Date().getTime() - this.lastMove) / 1000
			if (this.state.PositionState === OPENING) {
				const movedDistance = this.timeToOpen ? Math.round(timeInSecSinceLastMove / this.timeToOpen * 100) : 0
				this.state.CurrentPosition += movedDistance
			} else {
				const movedDistance = this.timeToClose ? Math.round(timeInSecSinceLastMove / this.timeToClose * 100) : 0
				this.state.CurrentPosition -= movedDistance
			}
		}

		switch (positionState) {
			case 'open':
				this.lastMove = new Date().getTime()
				this.state.TargetPosition = 100
				this.state.PositionState = OPENING
				break;
			case 'close':
				this.lastMove = new Date().getTime()
				this.state.TargetPosition = 0
				this.state.PositionState = CLOSING
				break;
			case 'stop':
				this.lastMove = null
				this.state.TargetPosition = this.state.CurrentPosition
				this.state.PositionState = STOPPED
				break;
		}
		this.updateHomeKit(this.state)

		// Set timeout to stop at position
		if (this.state.PositionState !== STOPPED) {
			const distance = Math.abs(this.state.TargetPosition - this.state.CurrentPosition)

			const calcTime = this.state.PositionState === OPENING && this.timeToOpen ? (distance * this.timeToOpen * 10) :
				(this.state.PositionState === CLOSING && this.timeToClose ? (distance * this.timeToClose * 10) : 2000)

			this.movingTimeout = setTimeout(async () => {
				this.lastMove = null
				this.state.PositionState = STOPPED
				this.state.CurrentPosition = this.state.TargetPosition
				this.updateHomeKit(this.state)
			}, calcTime)
		}
	}

	updateHomeKit(newState) {
		this.state = newState
			
		if (this.state.PositionState === 2)
			this.updateValue('WindowCoveringService', 'CurrentPosition', this.state.CurrentPosition)

		this.updateValue('WindowCoveringService', 'TargetPosition', this.state.TargetPosition)
		this.updateValue('WindowCoveringService', 'PositionState', this.state.PositionState)

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


module.exports = WindowCovering