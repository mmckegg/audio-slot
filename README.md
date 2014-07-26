audio-slot
===

Web Audio API triggerable audio slot described with JSON consisting of sources, processors, and modulators. 

Pass in an AudioContext extended with `sources`, `processors`, and `modulators` and get back a single AudioNode. Because the entire setup of AudioNodes is done with a JSON object, it makes it simple and easy to persist and synchronize audio setups across a network. Used to manage each slot in [soundbank](https://github.com/mmckegg/soundbank).

## Install

```bash
$ npm install audio-slot
```

## API

```js
var AudioSlot = require('audio-slot')
```

### AudioSlot(audioContext, descriptor)

`audioContext`: instance of AudioContext extended with `sources`, `processors`, and `modulators` lookups. 

`descriptor`: an object describing the desired configuration of AudioNodes. See example below.

Returns a `slot` AudioNode.

### slot.update(descriptor)

A new descriptor object to update the internal nodes to. Will find and update all changed params, add new nodes and remove any unused nodes.

### slot.triggerOn(at, velocity)

Trigger all source and modulator start methods.

### slot.triggerOff(at)

Recommend triggering `stop()` on sources at given time. This event may be ignored by some sources which specify their own off time such as oneshot samples.

### slot.choke(at)

Cut off playback of slot sources and modulators immediately.

### slot.connect(destination, inputNumber)

Connect the slot output to another AudioNode (optionally specifying `inputNumber` for nodes with multiple inputs)

### slot.disconnect()

Disconnect the slot from all previously connected destination AudioNodes.

## Example

```js
var AudioSlot = require('audio-slot')

var audioContext = new AudioContext()

audioContext.sources = {
  sample: require('soundbank-sample'),
  oscillator: require('soundbank-oscillator')
}

audioContext.processors = {
  gain: audioContext.createGain.bind(audioContext), // can use built in nodes
  filter: audioContext.createBiquadFilter.bind(audioContext),
  delay: require('soundbank-delay')
}

audioContext.modulators = {
  lfo: require('lfo'),
  adsr: require('adsr')
}

audioContext.sampleCache = {}

loadAudioBuffer('/sounds/hiss.wav', function(err, buffer){
  audioContext.sampleCache['hiss.wav'] = buffer
})

var slot = AudioSlot(audioContext, {
  sources: [
    { node: 'sample', // coresponds to key in audioContext.sources
      url: 'hiss.wav',
      startOffset: 0.2,
      endOffset: 1,
      transpose: -3,
      mode: 'loop',

      amp: { // add a modulator from audioContext.modulators
        node: 'adsr',
        value: 1,
        attack: 0.01,
        decay: 0.3,
        sustain: 0.6,
        release: 0.4
      }
    }
  ],
  processors: [
    { node: 'delay',
      time: 0.1,
      wet: 0.6
    }
  ]
})

slot.connect(audioContext.destination)

// schedule a 2s playback of looped sample
slot.triggerOn(audioContext.currentTime)
slot.triggerOff(audioContext.currentTime + 2)
```

You can also use audio-slot instances as routing busses as by default they accept inputs from other nodes.

```js
var bus = AudioSlot(audioContext, {

  // specify how to handle trigger events
  inputMode: 'on', // other options: bypass, holdOn, holdOff, bypassOn, bypassOff
  volume: 1, // output gain

  processors: [
    { node: 'filter',
      type: 'lowpass',
      frequency: { // modulate the frequency AudioParam with an lfo
        node: 'lfo',
        rate: 2,
        amp: 100,
        value: 200
      }
    }
  ]
})

// route in another audio node

slot.connect(bus)
bus.connect(audioContext.destination)
```