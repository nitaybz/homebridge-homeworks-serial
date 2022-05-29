
const { SerialPort, ReadlineParser } = require('serialport')
const Queue = require('async-await-queue')
const IPC = require('node-ipc').default

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
			this.log(`Initializing New Accessory (${device.type}) - ${device.name}`)
		
			// adjust address to be unified with 2 characters
			device.address = modifyAddress(device.address)
			const newAccessory = new AccessoryType[device.type](device, this)
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


	initIPCClient: function() {
		IPC.config.retry = 1500
		IPC.config.logger = this.log.debug.bind(this.log)

		this.commandQueue = new Queue(1, 50)

		const SERVER_ID = this.PLATFORM_NAME


		IPC.connectTo(this.PLATFORM_NAME, () => {
			IPC.of[SERVER_ID].on('connect', () => {
				this.log.easyDebug('IPC Client Connected to the Server')
			})

			IPC.of[SERVER_ID].on('disconnect', () => {
				this.log.easyDebug('IPC Client Disconnected from the Server')
			})

			IPC.of[SERVER_ID].on('newLine', (line) => {
				this.log.easyDebug(`IPC Message Received from Server: ${line}`)
				processLine.bind(this)(line)
				

			})
		})

		const RS232 = {
			set: async (type, address, config) => {
				const command = {type, address, config}
				const uniqueId = Symbol()
				try {
					await this.commandQueue.wait(uniqueId, 1)
					IPC.of[SERVER_ID].emit('setCommand', command)
					this.commandQueue.end(uniqueId)
				} catch (err) {
					this.log.error('Failed to Send Command to Server', err)
					this.commandQueue.end(uniqueId)
				}
			}
		}

		return RS232
	},

	initPort: function() {

		this.commandQueue = new Queue(1, this.config.commandDelay || 100)

		IPC.config.id = this.PLATFORM_NAME
		IPC.config.retry = 1500
		IPC.config.logger = this.log.debug.bind(this.log)

		const port = new SerialPort({ path: this.config.serialPath || '/dev/ttyUSB0', baudRate: this.config.baudRate || 115200 })
		port.write('\r')
		port.write('DLMON\r') // Allow dimmer monitoring
		port.write('KBMON\r') // Allow key button monitoring
		port.write('KLMON\r') // Allow key led monitoring
		
		const parser = port.pipe(new ReadlineParser({ delimiter: '\r' }))

		parser.on('data', data => {
			const line = data.toString('utf8')
			if (!line.includes('232') &&
					!line.includes('incorrect') &&
					!line.includes('Invalid') &&
					!line.includes('invalid') &&
					!line.includes('AT&') &&
					!line.includes('enabled') &&
					!line.includes('not in database')) {
				this.log.easyDebug(line)
				processLine.bind(this)(line)
				IPC.server.broadcast('newLine', line)
			}
		})

		const RS232 = {
			set: async (type, address, config) => {
				const uniqueId = Symbol()
				try {
					await this.commandQueue.wait(uniqueId, 1)
	
					let command
	
					if (type === 'dimmer')
						command = `FADEDIM, ${config.brightness}, ${config.fadeTime}, 0, [${address}]`
					else {
						const keyCommand = Object.keys(keypadDictionary).find(key => keypadDictionary[key] === config.pressType)
						command = `${keyCommand}, [${address}], ${config.buttonId}`
	
					}
					command += '\r'
					this.log.easyDebug('Sending Command:')
					this.log.easyDebug(command)
					port.write(command)


					this.commandQueue.end(uniqueId)

				} catch (err) {
					this.log.error('Error Sending RS232 Command', JSON.stringify({type, address,config}))
					this.log.error(err)
					this.commandQueue.end(uniqueId)
				}
			}
		}

		IPC.serve( () => {
			this.log.easyDebug('IPC Server started')

			IPC.server.on('setCommand', (command) => {
				this.log.easyDebug(`IPC Message Received from Client: ${JSON.stringify(command)}`)
				try {
					RS232.set(command.type, command.address, command.config)
				} catch (err) {
					this.log.error('IPC to RS232 Error', err)
				}
			})
		})

		IPC.server.start()

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
		address: line[1].replace(/[[\]]/g, ''),
		state: line[2]
	}

	if (!knownCommands.includes(message.command)) {
		this.log.easyDebug(`Unknown command: ${message.command}`)
		return
	}

	let deviceFound, keypadFound, ignoreLine

	switch (message.command) {
		case 'DL':
			message.state = parseInt(message.state)
			deviceFound = this.homeworksDevices.find(device => device.type === 'dimmer' && device.id === message.address)
			ignoreLine = this.homeworksDevices.find(device => device.type === 'windowCovering' && device.address === message.address)
			break
		case 'KBP':
		case 'KBDT':
		case 'KBH':
			message.state = parseInt(message.state)
			deviceFound = this.homeworksDevices.find(device => device.type === 'button' && device.id === `${message.address}.${message.state}`)
			if (!deviceFound)
				deviceFound = this.homeworksDevices.find(device => device.type === 'windowCovering' && device.address === message.address && device.pressType === keypadDictionary[message.command] &&
					( device.openButtonId == message.state || device.closeButtonId == message.state || device.midButtonId == message.state ))
			if (!deviceFound)
				ignoreLine = this.homeworksDevices.find(device => device.id === `${message.address}.${message.state}.${keypadDictionary[message.command]}`)
			break
		case 'KLS':
			keypadFound = this.homeworksDevices.filter(device => device.address === message.address)
			break
	}


	if (keypadFound) {
		updateKeypad.bind(this)(keypadFound, message)
	} else if (deviceFound)
		updateDevice.bind(this)(deviceFound, message)
	else if (this.config.discoveryLogs && message.command !== 'KBR' && !ignoreLine)
		declareNewDevice.bind(this)(message)

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
				On: parseInt(message.state) > 0,
				Brightness: parseInt(message.state)
			}
			break
		case 'button':
			newState = {
				ProgrammableSwitchEvent: message.command === 'KBP' ? 0 : message.command === 'KBDT' ? 1 : 2
			}
			break
		case 'windowCovering':
			var position = message.state == device.openButtonId ? 100 : message.state == device.midButtonId ? 50 : 0
			newState = {
				CurrentPosition: position,
				TargetPosition: position,
				PositionState: 2
			}
			break
	}

	setTimeout(() => {
		device.updateHomeKit(newState)
	}, 500)
}


function declareNewDevice(message) {
	this.log(`New "${message.command === 'DL' ? 'Dimmer' : 'Keypad'}" Device Detected at Address ${message.address} ${message.command === 'DL' ? '' : `and button id "${message.state}"`}`)
	
	this.log(`Use this in the config:`)
	switch (message.command) {
		case 'DL':
			this.log(`{"name": "${message.address}", "address": "${message.address}", "type": "dimmer", "defaultBrightness": 100, "defaultFadeTime": 1}`)
			break
		case 'KBP':
		case 'KBDT':
		case 'KBH':
			this.log(`{"name": "${message.address}", "address": "${message.address}", "type": "switch", "buttonId": ${message.state}, "pressType": "${keypadDictionary[message.command]}"}`)
			break
	}
}

function modifyAddress(address) {
	let splitted = address.split(':')
	splitted = splitted.map(part => {
		return String("0" + part).slice(-2)
	})
	return splitted.join(':')
}