var Processor = require('../processor.js')
var Property = require('observ-default')

var Param = require('audio-slot-param')
var Apply = require('audio-slot-param/apply')

module.exports = EQNode

function EQNode (context) {

  var lowshelf = context.audio.createBiquadFilter()
  lowshelf.type = 'lowshelf'
  lowshelf.frequency = 320

  var peaking = context.audio.createBiquadFilter()
  peaking.type = 'peaking'
  peaking.frequency = 1000
  peaking.Q = 0.5

  var highshelf = context.audio.createBiquadFilter()
  highshelf.type = 'highshelf'
  lowshelf.frequency = 3200

  var lowpass = context.audio.createBiquadFilter()
  lowpass.type = 'lowpass'

  var highpass = context.audio.createBiquadFilter()
  highpass.type = 'highpass'

  // chain
  lowshelf.connect(peaking)
  peaking.connect(highshelf)
  highshelf.connect(lowpass)
  lowpass.connect(highpass)

  var obs = Processor(context, lowshelf, highpass, {
    highcut: Param(context, 20000),
    lowcut: Param(context, 0),
    low: Param(context, 0),
    mid: Param(context, 0),
    high: Param(context, 0),
  })

  Apply(context, lowpass.frequency, obs.highcut)
  Apply(context, highpass.frequency, obs.lowcut)
  Apply(context, lowshelf.gain, obs.low)
  Apply(context, peaking.gain, obs.mid)
  Apply(context, highshelf.gain, obs.high)

  return obs
}
