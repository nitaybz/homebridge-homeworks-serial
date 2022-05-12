const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

const AccessoryType = {
	'dimmer': require('../accessories/Dimmer'),
	'switch': require('../accessories/Switch'),
	'outlet': require('../accessories/Outlet'),
	'windowCovering': require('../accessories/WindowCovering'),
	'button': require('../accessories/Button')
}

const keypadDictionary = { //pressType
	'KBP': 'single',
	'KBDT': 'double',
	'KBH': 'hold',
	'KBR': 'release'
}

module.exports = {
	homekitSync: function() {
		this.devices.forEach(device => {
			const newAccessory = new AccessoryType[device.type](device, this)
			this.log(`Initializing New Accessory (${newAccessory.type}) - ${device.name}`)
			if (!(newAccessory.id in this.cachedState))
				this.cachedState[newAccessory.id] = {}
			this.homeworksDevices.push(newAccessory)
		})

		this.accessories.forEach(accessory => {
			const deviceFound = this.homeworksDevices.find(hwDevice => accessory.context.id === hwDevice.id)
			if (!deviceFound) {
				this.log(`Removing Accessory - ${accessory.displayName}`)
				this.api.unregisterPlatformAccessories(this.PLUGIN_NAME, this.PLATFORM_NAME, [accessory])

			}
		})
	},

	initPort: function() {
		const port = new SerialPort(this.config.serialPath || '/dev/ttyUSB0', { baudRate: this.config.baudRate || 115200 })
		port.write('\r')
		port.write('DLMON\r') // Allow dimmer monitoring
		port.write('KBMON\r') // Allow key button monitoring
		port.write('KLMON\r') // Allow key led monitoring
		
		const parser = port.pipe(new Readline({ delimiter: '\r' }))
		parser.on('data', data => {
			const line = data.toString('utf8')
			if (!line.includes('232') &&
					!line.includes('incorrect') &&
					!line.includes('Invalid') &&
					!line.includes('invalid') &&
					!line.includes('not in database')) {
				this.log.easyDebug(line)
				processLine(line).bind(this)
			}
		})

		const RS232 = {
			set: (type, address, config) => {
				let command

				if (type === 'dimmer')
					command = `FADEDIM, ${config.brightness}, ${config.fadeTime}, 0, [${address}]`
				else {
					const keyCommand = Object.keys(keypadDictionary).find(key => keypadDictionary[key] === config.pressType)
					command += `${keyCommand}, [${address}], ${config.buttonId}`

				}
				command += '\r'
				this.log.easyDebug('Sending Command:')
				this.log.easyDebug(command)
				port.write(command)
			}
		}

		return RS232
	}
}

const processLine = function (line) {

	// possible message types:
	// Dimmer Level: DL, <address>, <level>
	// Keypad Button Press: KBP, <address>, <button number>
	// Keypad Button Double Tap: KBDT, <address>, <button number>
	// Keypad Button Hold: KBH, <address>, <button number>
	// Keypad Button Release: KBR, <address>, <button number>
	// Keypad LED: KLS, <address>, <led states>

	const knownCommands = ['DL', 'KBP', 'KBDT', 'KBH', 'KBR', 'KLS']

	line = line.split(', ')
	if (line.length !== 3) {
		this.log.easyDebug('Unknown line')
		return
	}
		
	const message = {
		command: line[0],
		address: line[1],
		state: line[2]
	}

	if (!knownCommands.includes(message.command)) {
		this.log.easyDebug(`Unknown command: ${message.command}`)
		return
	}

	let deviceFound, keypadFound

	switch (message.command) {
		case 'DL':
			message.state = parseInt(message.state)
			deviceFound = this.homeworksDevices.find(device => device.type === 'Dimmer' && device.id === message.address)
			break;
		case 'KBP':
		case 'KBDT':
		case 'KBH':
		case 'KBR':
			message.state = parseInt(message.state)
			deviceFound = this.homeworksDevices.find(device => device.type === 'Button' && device.id === `${message.address}.${message.state}.${keypadDictionary[message.command]}`)
			if (!deviceFound)
				deviceFound = this.homeworksDevices.find(device => device.type === 'WindowCovering' && device.address === message.address && device.pressType === keypadDictionary[message.command] &&
					( device.openButtonId == message.state || device.closeButtonId == message.state || device.midButtonId == message.state ))
			break;
		case 'KLS':
			keypadFound = this.homeworksDevices.filter(device => device.address === message.address)
			break;
	}


	if (keypadFound) {
		updateKeypad(keypadFound, message).bind(this)
	} else if (deviceFound)
		updateDevice(deviceFound, message).bind(this)
	else if (this.config.discoveryLogs)
		declareNewDevice(message).bind(this)

}


function updateKeypad(devices, message) {
	devices.forEach(device => {
		if (['outlet', 'switch'].includes(device.type)) {
			const isOn = !!parseInt(message.state[parseInt(device.buttonId) - 1])
			device.updateHomeKit({On: isOn})
		}
	})
}


function updateDevice(device, message) {
	let newState
	switch (device.type) {
		case 'dimmer':
			newState = {
				On: message.state > 0,
				Brightness: message.state
			}
			break;
		case 'button':
			newState = {
				ProgrammableSwitchEvent: message.command === 'KBP' ? 0 : message.command === 'KBDT' ? 1 : 2
			}
			break;
		case 'windowCovering':
			var position = message.state == device.openButtonId ? 100 : message.state == device.midButtonId ? 50 : 0
			newState = {
				CurrentPosition: position,
				TargetPosition: position,
				PositionState: 2
			}
			break;
	}
	device.updateHomeKit(newState)
}


function declareNewDevice(message) {
	this.log(`New "${message.command === 'DL' ? 'Dimmer' : 'Keypad'}" Device Detected at Address ${message.address} ${message.command === 'DL' ? '' : `and button id "${message.state}"`}`)
	
	this.log(`Use this in the config:`)
	switch (message.command) {
		case 'DL':
			this.log(`{"name": "${message.address}", "address": "${message.address}", "type": "dimmer", "defaultBrightness": 100, "defaultFadeTime": 1}`)
			break;
		case 'KBP':
		case 'KBDT':
		case 'KBH':
			this.log(`{"name": "${message.address}", "address": "${message.address}", "type": "switch", "buttonId": ${message.state}, "pressType": "${keypadDictionary[message.command]}"}`)
			break;
	}
}