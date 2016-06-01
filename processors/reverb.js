var Processor = require('../processor.js')
var Property = require('observ-default')

var Param = require('audio-slot-param')
var Apply = require('audio-slot-param/apply')

var buildImpulse = require('../lib/build-impulse.js')

module.exports = ReverbNode

function ReverbNode (context) {
  var input = context.audio.createGain()
  var output = context.audio.createGain()

  var convolver = context.audio.createConvolver(4)
  var filter = context.audio.createBiquadFilter()
  filter.Q.value = 0

  var dry = context.audio.createGain()
  var wet = context.audio.createGain()
  var building = false

  input.connect(dry)
  input.connect(convolver)

  convolver.connect(filter)
  filter.connect(wet)

  dry.connect(output)
  wet.connect(output)

  var obs = Processor(context, input, output, {
    time: Property(3),
    decay: Property(2),
    reverse: Property(false),

    cutoff: Param(context, 20000),
    filterType: Property('lowpass'),

    wet: Param(context, 1),
    dry: Param(context, 1)
  }, [cancel])

  obs.time(refreshImpulse)
  obs.decay(refreshImpulse)
  obs.reverse(refreshImpulse)

  Apply(context, filter.frequency, obs.cutoff)
  obs.filterType(function (value) {
    filter.type = value
  })

  Apply(context, wet.gain, obs.wet)
  Apply(context, dry.gain, obs.dry)

  return obs

  // scoped
  function cancel () {
    if (building) {
      buildImpulse.cancel(building)
    }
  }

  function refreshImpulse () {
    var rate = context.audio.sampleRate
    var length = Math.max(rate * obs.time(), 1)
    cancel()
    building = buildImpulse(length, obs.decay(), obs.reverse(), function (channels) {
      var impulse = context.audio.createBuffer(2, length, rate)
      impulse.getChannelData(0).set(channels[0])
      impulse.getChannelData(1).set(channels[1])
      convolver.buffer = impulse
      building = false
    })
  }
}
