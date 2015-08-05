audio-slot
===

Web Audio API FRP wrapper for creating, routing, and triggering AudioNodes.

This module serves as the audio engine for [Loop Drop](https://github.com/mmckegg/loop-drop-app).

[![NPM](https://nodei.co/npm/audio-slot.png)](https://nodei.co/npm/audio-slot/)

## Related modules / deps

- [audio-slot-param](https://github.com/mmckegg/audio-slot-param)
- [observ-node-array](https://github.com/mmckegg/observ-node-array)
- [observ-struct](https://github.com/raynos/observ-struct)

## Example

Create a simple monosynth:

```js
var Slot = require('audio-slot')

var context = {
  audio: new AudioContext(),
  nodes: {
    oscillator: require('audio-slot/sources/oscillator'),
    filter: require('audio-slot/processors/filter'),
    envelope: require('audio-slot/params/envelope'),
    lfo: require('audio-slot/params/lfo')
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

```

## Included nodes

### Sources

- oscillator
- sample
- granular
- noise

### Processors

- bitcrusher
- delay
- dipper
- filter
- freeverb
- gain
- overdrive
- pitchshift
- reverb

### Params

- chromatic-scale
- envelope
- lfo
- link-modulator
- trigger-value