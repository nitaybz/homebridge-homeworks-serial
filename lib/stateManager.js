
// let Characteristic
module.exports = {
	set: {
		On: async function(on) {
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
				}, 10)
			} else {
				if (on && !this.state.On) {
					this.state.On = on
					this.log(`${this.name} - Turning ON`)
					return await this.rs232.set(this.type, this.address, { buttonId: this.buttonId, pressType: this.pressType })
				} else if (!on && this.state.On){
					this.state.On = on
					this.log(`${this.name} - Turning OFF`)
					return await this.rs232.set(this.type, this.address, { buttonId: this.buttonId, pressType: this.pressType })
				}
				
			}
		},

		Brightness: async function(brightness) {
			this.processing = true
			setTimeout(() => {
				this.processing = false
			}, 200)

			if (brightness !== this.state.Brightness) {
				this.log(`${this.name} - Setting Brightness to ${brightness}%`)
				return await this.rs232.set('dimmer', this.address, { brightness, fadeTime: this.defaultFadeTime })
			}
		},
		
		TargetPosition: async function(Characteristic, position) {

			if (position !== this.state.CurrentPosition) {
				this.log(`${this.name} - Setting Position to ${position}%`)
				const buttonId = position === 0 ? this.closeButtonId : position === 50 ? this.midButtonId :  this.openButtonId
				this.state.CurrentPosition = position
				this.state.TargetPosition = position
				this.state.PositionState = 2

				// setTimeout(() => {
				// 	this.WindowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(2)
				// 	this.WindowCoveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position)
				// 	this.WindowCoveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position)
				// }, 500)


				return await this.rs232.set(this.type, this.address, { buttonId, pressType: this.pressType })
			}
		}
	}
}