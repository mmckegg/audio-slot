var Processor = require('../processor.js')

var Param = require('../param.js')
var Property = require('../property.js')

var Transform = require('../modulators/transform')
var Apply = require('../modulators/apply')

module.exports = DelayNode

function DelayNode(context){
  var input = context.audio.createGain()
  var output = context.audio.createGain()

  var delay = context.audio.createDelay(4)
  var filter = context.audio.createBiquadFilter()

  var feedback = context.audio.createGain()
  var dry = context.audio.createGain()
  var wet = context.audio.createGain()

  // feedback loop
  input.connect(filter)
  filter.connect(delay)
  delay.connect(feedback)
  delay.connect(wet)
  feedback.connect(filter)

  input.connect(dry)
  dry.connect(output)
  wet.connect(output)

  var obs = Processor(context, input, output, {
    time: Param(context, 0.25),
    sync: Property(false),

    feedback: Param(context, 0.6),
    cutoff: Param(context, 20000),
    filterType: Property('lowpass'),

    wet: Param(context, 1),
    dry: Param(context, 1)
  })

  var rateMultiplier = Transform(context, [
    { param: obs.sync },
    { param: context.tempo, transform: getRateMultiplier }
  ])

  var time = Transform(context, [
    { param: obs.time },
    { param: rateMultiplier, transform: multiply }
  ])

  Apply(context, delay.delayTime, time)
  Apply(context, filter.frequency, obs.cutoff)
  Apply(context, feedback.gain, obs.feedback)
  obs.filterType(function(value){
    filter.type = value
  })

  Apply(context, wet.gain, obs.wet)
  Apply(context, dry.gain, obs.dry)

  obs.destroy = function(){
    // release context.tempo
    rateMultiplier.destroy() 
  }

  return obs
}

function getRateMultiplier(sync, tempo){
  if (sync){
    return 60 / tempo
  } else {
    return 1
  }
}

function multiply(a, b){
  return a * b
}