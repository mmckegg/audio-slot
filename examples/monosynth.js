var Slot = require('../')

var context = {
  audio: new AudioContext(),
  nodes: {
    oscillator: require('../sources/oscillator'),
    filter: require('../processors/filter'),
    envelope: require('../params/envelope'),
    lfo: require('../params/lfo'),
  }
}

var synth = Slot(context)
synth.set({
  sources: [
    { 
      node: 'oscillator', 
      shape: 'sawtooth', 
      amp: {
        node: 'envelope',
        value: 0.6,
        attack: 0.1,
        release: 1
      },
      octave: -1,
      detune: {
        value: 0,
        node: 'lfo',
        amp: 40,
        rate: 5,
        mode: 'add'
      }
    }
  ],
  processors: [
    {
      node: 'filter',
      type: 'lowpass',
      frequency: {
        node: 'envelope',
        value: 10000,
        decay: 0.6,
        sustain: 0.05,
        release: 0.1
      }
    }
  ]
})

synth.connect(context.audio.destination)

// trigger!
setTimeout(function() {
  synth.triggerOn(1)
  synth.triggerOff(2)
  synth.triggerOn(3)
  synth.triggerOff(4)
  synth.triggerOn(5)
  synth.triggerOff(7)
}, 0.2)
