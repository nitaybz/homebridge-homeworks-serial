
// let Characteristic
module.exports = {
	set: {
		On: function(on) {
			if (this.type == 'dimmer') {
				setTimeout(() => {
					if (!this.processing) {
						this.processing = true
						setTimeout(() => {
							this.processing = false
						}, 2000)
						if (on && !this.state.On) {
							this.log(`${this.name} - Turning ON`)
							return this.rs232.set('dimmer', this.address, { brightness: this.defaultBrightness, fadeTime: this.defaultFadeTime })
						} else if (!on && this.state.On){
							this.log(`${this.name} - Turning OFF`)
							return this.rs232.set('dimmer', this.address, 0)
						}
					}
				}, 200)
			} else {
				this.processing = true
				setTimeout(() => {
					this.processing = false
				}, 2000)
				if (on && !this.state.On) {
					this.log(`${this.name} - Turning ON`)
					return this.rs232.set(this.type, this.address, { buttonId: this.buttonId, pressType: this.pressType })
				} else if (!on && this.state.On){
					this.log(`${this.name} - Turning OFF`)
					return this.rs232.set(this.type, this.address, { buttonId: this.buttonId, pressType: this.pressType })
				}
				
			}
		},

		Brightness: function(brightness) {
			this.processing = true
			setTimeout(() => {
				this.processing = false
			}, 2000)

			if (brightness !== this.state.Brightness) {
				this.log(`${this.name} - Setting Brightness to ${brightness}%`)
				return this.rs232.set('dimmer', this.address, { brightness, fadeTime: this.defaultFadeTime })
			}
		},
		
		TargetPosition: function(Characteristic, position) {
			this.processing = true
			setTimeout(() => {
				this.processing = false
			}, 2000)

			if (position !== this.state.CurrentPosition) {
				this.log(`${this.name} - Setting Position to ${position}%`)
				const buttonId = position === 0 ? this.closeButtonId : position === 50 ? this.midButtonId :  this.openButtonId
				return this.rs232.set(this.type, this.address, { buttonId, pressType: this.pressType })
			}
		}
	}
}