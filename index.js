var updateParams = require('./lib/update_params')
var updateProcessors = require('./lib/update_processors')

module.exports = AudioSlot

function AudioSlot(audioContext, descriptor){
  if (!(this instanceof AudioSlot)){
    return new AudioSlot(audioContext, descriptor)
  }

  this.context = audioContext
  this.input = audioContext.createGain()
  this.output = audioContext.createGain()
  this.descriptor = {}

  this._currentProcessors = []
  this._active = []
  this._outputContainer = {node: this.output, descriptor: {}, modulators: []}

  this._pre = audioContext.createGain()
  this._pre.connect(this.output)

  // bus / inputMode routing
  this._flow = audioContext.createGain()
  this._bypass = audioContext.createGain()
  this.input.connect(this._flow)
  this._flow.connect(this._pre)
  this.input.connect(this._bypass)
  this._bypass.gain.value = 0
  this._bypass.connect(this.output)


  if (descriptor){
    this.update(descriptor)
  }
}

AudioSlot.prototype = {
  constructor: AudioSlot,

  triggerOn: function(at, velocity){
    var sources = this.context.sources || {}
    var descriptors = this.descriptor.sources || []
    for (var i=0;i<descriptors.length;i++){
      var descriptor = descriptors[i]
      if (descriptor.node && typeof sources[descriptor.node] === 'function'){
        var source = sources[descriptor.node](this.context)
        var event = {from: at, node: source, modulators: [], descriptor: {}, nodeIndex: i}

        source.onended = handlePlayerEnd.bind(this, event)

        updateParams(this.context, event, descriptor)
        var offTime = source.start(at)

        for (var x=0;x<event.modulators.length;x++){
          var modulator = event.modulators[x]
          if (modulator.start){
            modulator.start(at)
          }
        }

        source.connect(this._pre)

        if (offTime){
          event.to = offTime
          source.stop(offTime)

          for (var x=0;x<event.modulators.length;x++){
            var modulator = event.modulators[x]
            if (modulator.stop){
              modulator.stop(offTime, true)
            }
          }
        }

        this._active.push(event)
      } 
    }

    startProcessorModulators(this, at)
    triggerInput(this, at, true)
  },

  triggerOff: function triggerOff(at){
    at = stopProcessorModulators(this, at)
    triggerInput(this, at, false)
    var active = this._active
    for (var i=0;i<active.length;i++){
      var event = active[i]
      if (!event.to && at > event.from){
        var offTime = at
        for (var x=0;x<event.modulators.length;x++){
          var modulator = event.modulators[x]
          if (modulator.stop){
            var time = modulator.stop(at)
            if (time && time > offTime){
              offTime = time
            }
          }
        }
        event.to = event.node.stop(offTime) || offTime
      }
    }
  },

  choke: function(at){
    var active = this._active
    for (var i=0;i<active.length;i++){
      var event = active[i]
      if (!event.choked && (!event.to || at < event.to+0.01) && at > event.from){
        var choker = this.context.createGain()
        event.node.disconnect()
        event.node.connect(choker)
        choker.connect(this._pre)
        choker.gain.setTargetAtTime(0, at, 0.01)
        event.choked = true
      }
    }
  },

  update: function(descriptor){

    var sourceDescriptors = descriptor.sources || []
    var active = this._active
    for (var i=0;i<active.length;i++){
      var event = active[i]
      if (~event.nodeIndex){
        updateParams(this.context, event, sourceDescriptors[event.nodeIndex])
      }
    }


    // prime sources (preload samples, etc)
    if (descriptor.sources){
      for (var i=0;i<descriptor.sources.length;i++){
        var desc = descriptor.sources[i]
        if (desc.node){
          var source = this.context.sources[desc.node]
          if (source && source.prime){
            source.prime(this.context, desc)
          }
        }
      }
    }

    updateProcessors(this, descriptor.processors)
    updateInput(this, descriptor)

    updateParams(this.context, this._outputContainer, {gain: descriptor.volume})

    this.chokeGroup = descriptor.chokeGroup == null ? null : descriptor.chokeGroup
    this.descriptor = descriptor
  },

  connect: function(destination){
    this.output.connect.apply(this.output, arguments)
  },

  disconnect: function(){
    this.output.disconnect.apply(this.output, arguments)
  }
}

///////////////////

function startProcessorModulators(slot, at){
  var processors = slot._currentProcessors
  for (var i=0;i<processors.length;i++){
    var container = processors[i]
    for (var x=0;x<container.modulators.length;x++){
      var modulator = container.modulators[x]
      if (modulator.start){
        modulator.start(at)
      }
    }
  }

  // handle output volume modulation
  var container = slot._outputContainer
  for (var x=0;x<container.modulators.length;x++){
    var modulator = container.modulators[x]
    if (modulator.start){
      modulator.start(at)
    }
  }
}

function stopProcessorModulators(slot, at, isTarget){
  var processors = slot._currentProcessors
  var stopAt = at
  for (var i=0;i<processors.length;i++){
    var container = processors[i]
    for (var x=0;x<container.modulators.length;x++){
      var modulator = container.modulators[x]
      if (modulator.stop){
        var res = modulator.stop(at, isTarget)
        if (res > stopAt){
          stopAt = res 
        }
      }
    }
  }

  var container = slot._outputContainer
  for (var x=0;x<container.modulators.length;x++){
    var modulator = container.modulators[x]
    if (modulator.stop){
      var res = modulator.stop(at, isTarget)
      if (res > stopAt){
        stopAt = res 
      }
    }
  }
  
  return stopAt
}

function handlePlayerEnd(event){
  var active = this._active
  var index = active.indexOf(event)
  if (~index){
    active.splice(index, 1)
  }
}

function triggerInput(slot, at, value){
  slot._isOn = value

  var mode = slot.descriptor.inputMode

  var onValue = value ? 1 : 0
  var offValue = value ? 0 : 1

  if (mode === 'holdOn'){
    slot._flow.gain.setValueAtTime(onValue, at)
  } else if (mode === 'holdOff'){
    slot._flow.gain.setValueAtTime(offValue, at)
  } else if (mode === 'bypassOff'){
    slot._flow.gain.setValueAtTime(onValue, at)
    slot._bypass.gain.setValueAtTime(offValue, at)
  } else if (mode === 'bypassOn'){
    slot._flow.gain.setValueAtTime(offValue, at)
    slot._bypass.gain.setValueAtTime(onValue, at)
  }
}

function updateInput(slot, descriptor){

  var at = slot.context.currentTime
  var oldMode = 'inputMode' in slot.descriptor ? slot.descriptor.inputMode : 'on'
  var newMode = 'inputMode' in descriptor ? descriptor.inputMode : 'on'

  if (oldMode != newMode){
    slot._flow.gain.cancelScheduledValues(slot.context.currentTime)
    slot._bypass.gain.cancelScheduledValues(slot.context.currentTime)

    if (newMode === 'off'){
      slot._flow.gain.setValueAtTime(0, at)
      slot._bypass.gain.setValueAtTime(0, at)
    } else if (newMode === 'bypass'){
      slot._flow.gain.setValueAtTime(0, at)
      slot._bypass.gain.setValueAtTime(1, at)
    } else if (newMode === 'holdOn'){
      // turns on input when held
      // turns off when released
      slot._flow.gain.setValueAtTime(slot._isOn ? 1 : 0, at)
      slot._bypass.gain.setValueAtTime(0, at)
    } else if (newMode === 'holdOff'){
      // turns off input when held
      // turns on when released
      slot._flow.gain.setValueAtTime(slot._isOn ? 0 : 1, at)
      slot._bypass.gain.setValueAtTime(0, at)
    } else if (newMode === 'bypassOff'){
      // always on
      // turns on effects when held
      // bypasses effects when released
      slot._flow.gain.setValueAtTime(slot._isOn ? 1 : 0, at)
      slot._bypass.gain.setValueAtTime(slot._isOn ? 0 : 1, at)
    } else if (newMode === 'bypassOn'){
      // always on
      // bypasses effects when held
      // turns on effects when released
      slot._flow.gain.setValueAtTime(slot._isOn ? 0 : 1, at)
      slot._bypass.gain.setValueAtTime(slot._isOn ? 1 : 0, at)
    } else {
      slot._flow.gain.setValueAtTime(1, at)
      slot._bypass.gain.setValueAtTime(0, at)
    }
  }
}