const OPENING = 0
const CLOSING = 1
const STOPPED = 2

function timeout(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}


// let Characteristic
module.exports = {
	set: {
		On: async function(on) {

			// if dimmer, wait to understand if brightness is set
			if (this.type == 'dimmer') {
				setTimeout(async () => {
					if (!this.processing) {
						if (on && !this.state.On) {
							this.state.On = on
							this.log(`${this.name} - Turning ON`)
							const lastBrightness = this.accessory.context.lastBrightness
							return await this.rs232.set('dimmer', this.address, { brightness: lastBrightness || this.defaultBrightness, fadeTime: this.defaultFadeTime })
						} else if (!on && this.state.On){
							this.state.On = on
							this.log(`${this.name} - Turning OFF`)
							return await this.rs232.set('dimmer', this.address, { brightness: 0, fadeTime: this.defaultFadeTime })
						}
					}
				}, 100)

			} else {
				if (on && !this.state.On) {
					this.state.On = on
					this.log(`${this.name} - Turning ON`)
					let commandConfig = { buttonId: this.buttonId, pressType: this.pressType }
					if (this.rawCommands && this.rawCommands.on)
						commandConfig = { raw: this.rawCommands.on }
					return await this.rs232.set(this.type, this.address, commandConfig)
				} else if (!on && this.state.On){
					this.state.On = on
					this.log(`${this.name} - Turning OFF`)
					let commandConfig = { buttonId: this.buttonId, pressType: this.pressType }
					if (this.rawCommands && this.rawCommands.off)
						commandConfig = { raw: this.rawCommands.off }
					return await this.rs232.set(this.type, this.address, commandConfig)
				}
				
			}
		},

		Brightness: async function(brightness) {
			this.processing = true
			setTimeout(() => {
				this.processing = false
			}, 2000)

			if (brightness !== this.state.Brightness) {
				this.state.Brightness = brightness
				this.log(`${this.name} - Setting Brightness to ${brightness}%`)
				return await this.rs232.set('dimmer', this.address, { brightness, fadeTime: this.defaultFadeTime })
			}
		},

		HoldPosition: async function(stop) {
			if (stop) {
				this.log(`${this.name} - Stopping Position`)
				const stopCommand = this.rawCommands && this.rawCommands.stop ? {raw: this.rawCommands.stop} : { buttonId: this.stopButtonId, pressType: this.pressType }
				return await this.rs232.set(this.type, this.address, stopCommand)
			}
		},

		LouverOn: async function(Characteristic, on) {
			this.louverProcessing = true
			clearTimeout(this.louverProcessingTimeout)
			this.louverProcessingTimeout = setTimeout(() => {
				this.louverProcessing = false
			}, 2000)

			if (on && !this.state.LouverOn) {
				this.state.LouverOn = on
				this.log(`${this.name} - Turning ON Louver`)
				let commandConfig = { buttonId: this.louverButtonId, pressType: this.pressType }
				if (this.rawCommands && this.rawCommands.louver)
					commandConfig = { raw: this.rawCommands.louver }

				this.updateHomeKit({
					...this.state,
					CurrentPosition: this.louverPosition,
					TargetPosition: this.louverPosition,
					PositionState: STOPPED,
				})

				return await this.rs232.set(this.type, this.address, commandConfig)
			} else if (!on && this.state.LouverOn){
				this.state.LouverOn = on
				this.log(`${this.name} - Turning OFF Louver`)
				let commandConfig = { buttonId: this.louverButtonId, pressType: this.pressType }
				if (this.rawCommands && this.rawCommands.louver)
					commandConfig = { raw: this.rawCommands.louver }

				this.WindowCoveringService.getCharacteristic(Characteristic.TargetPosition).setValue(100)
				return await this.rs232.set(this.type, this.address, commandConfig)


			}
		},
		
		TargetPosition: async function(Characteristic, position) {

			this.processing = true
			clearTimeout(this.processingTimeout)
			this.processingTimeout = setTimeout(() => {
				this.processing = false
			}, 2000)

			this.log(`${this.name} - Setting Position to ${position}%`)
			this.state.TargetPosition = position

			const openCommand = this.rawCommands && this.rawCommands.open ? {raw: this.rawCommands.open} : { buttonId: this.openButtonId, pressType: this.pressType }
			const closeCommand = this.rawCommands && this.rawCommands.close ? {raw: this.rawCommands.close} : { buttonId: this.closeButtonId, pressType: this.pressType }
			const stopCommand = this.rawCommands && this.rawCommands.stop ? {raw: this.rawCommands.stop} : { buttonId: this.stopButtonId, pressType: this.pressType }



			if (this.louverExist && this.state.LouverOn) {


				if (position < this.state.CurrentPosition) {
					this.louverProcessing = true
					clearTimeout(this.louverProcessingTimeout)
					this.louverProcessingTimeout = setTimeout(() => {
						this.louverProcessing = false
					}, 2000)
					this.log(`${this.name} - Turning OFF Louver`)
					let commandConfig = { buttonId: this.louverButtonId, pressType: this.pressType }
					if (this.rawCommands && this.rawCommands.louver)
						commandConfig = { raw: this.rawCommands.louver }
					await this.rs232.set(this.type, this.address, commandConfig)
					this.LouverSwitch.getCharacteristic(Characteristic.On).updateValue(false)
					
					await timeout(this.timeToOpen * (100 - this.louverPosition) * 10)
					this.state.PositionState = STOPPED
					this.state.CurrentPosition = 100
					this.state.LouverOn = false
				} else {
					this.log(`${this.name} - Turning OFF Louver`)
					clearTimeout(this.louverProcessingTimeout)
					this.LouverSwitch.getCharacteristic(Characteristic.On).updateValue(false)
					this.state.LouverOn = false
				}

			}

			// If curtain is already moving
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

			// Set Direction
			if (position > this.state.CurrentPosition) {
				this.lastMove = new Date().getTime()
				if (this.state.PositionState !== OPENING) {
					this.state.PositionState = OPENING
					await this.rs232.set(this.type, this.address, openCommand)
				}
			} else if (position < this.state.CurrentPosition) {
				this.lastMove = new Date().getTime()

				if (this.state.PositionState !== CLOSING) {
					this.state.PositionState = CLOSING
					await this.rs232.set(this.type, this.address, closeCommand)
				}
			} else if (this.stopButtonId || (this.rawCommands && this.rawCommands.stop)) {
				this.lastMove = null
				this.state.PositionState = STOPPED
				await this.rs232.set(this.type, this.address, stopCommand)
			}
			this.WindowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(this.state.PositionState)

			// Set timeout to stop at position
			if (this.state.PositionState !== STOPPED) {
				const distance = Math.abs(position - this.state.CurrentPosition)

				const calcTime = this.state.PositionState === OPENING && this.timeToOpen ? (distance * this.timeToOpen * 10) :
					(this.state.PositionState === CLOSING && this.timeToClose ? (distance * this.timeToClose * 10) : 2000)

				this.log.easyDebug(`${this.name} - Stopping the blinds in ${calcTime/1000} seconds`)
				this.movingTimeout = setTimeout(async () => {
					this.log(`${this.name} - Stopped`)
					this.lastMove = null
					this.state.PositionState = STOPPED
					this.state.CurrentPosition = position
					this.updateHomeKit(this.state)
					if (position !== 0 && position !== 100)
						await this.rs232.set(this.type, this.address, stopCommand)
				}, calcTime)
			}
		}
	}
}