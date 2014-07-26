var CustomNode = require('custom-audio-node')

var updateParams = require('./lib/update_params')
var updateProcessors = require('./lib/update_processors')

module.exports = function(audioContext, descriptor){
  var input = audioContext.createGain()
  var output = audioContext.createGain()

  var slot = CustomNode(input, output)
  slot._context = audioContext

  slot._input = input
  slot._output = output
  slot._descriptor = {}
  slot._currentProcessors = []
  slot._active = []
  slot.descriptor = {}

  // update volume
  slot._outputContainer = {node: slot._output, descriptor: {}, modulators: []}

  slot._pre = audioContext.createGain()
  slot._pre.connect(output)

  // bus / inputMode routing  
  slot._flow = audioContext.createGain()
  slot._bypass = audioContext.createGain()
  input.connect(slot._flow)
  slot._flow.connect(slot._pre)
  input.connect(slot._bypass)
  slot._bypass.gain.value = 0
  slot._bypass.connect(output)

  slot.context = audioContext
  slot.update = update
  slot.triggerOn = triggerOn
  slot.triggerOff = triggerOff
  slot.choke = choke
  slot.chokeGroup = null

  slot.update(descriptor)

  return slot
}

function triggerOn(at, velocity){
  var sources = this._context.sources || {}
  var descriptors = this.descriptor.sources || []
  for (var i=0;i<descriptors.length;i++){
    var descriptor = descriptors[i]
    if (descriptor.node && typeof sources[descriptor.node] === 'function'){
      var source = sources[descriptor.node](this._context)
      var event = {from: at, node: source, modulators: [], descriptor: {}, nodeIndex: i}

      source.onended = handlePlayerEnd.bind(this, event)

      updateParams(this._context, event, descriptor)
      var offTime = source.start(at)

      for (var x=0;x<event.modulators.length;x++){
        var modulator = event.modulators[x]
        modulator.start(at)
      }

      source.connect(this._pre)

      if (offTime){
        event.to = offTime
        source.stop(offTime)

        for (var x=0;x<event.modulators.length;x++){
          var modulator = event.modulators[x]
          modulator.stop(offTime, true)
        }
      }

      this._active.push(event)
    } 
  }

  startProcessorModulators(this, at)
  triggerInput(this, at, true)
}

function triggerOff(at){

  at = stopProcessorModulators(this, at)
  triggerInput(this, at, false)

  var active = this._active
  for (var i=0;i<active.length;i++){
    var event = active[i]
    if (!event.to && at > event.from){
      var offTime = at
      for (var x=0;x<event.modulators.length;x++){
        var modulator = event.modulators[x]
        var time = modulator.stop(at)
        if (time && time > offTime){
          offTime = time
        }
      }
      event.to = event.node.stop(offTime) || offTime
    }
  }

}

function choke(at){
  var active = this._active
  for (var i=0;i<active.length;i++){
    var event = active[i]
    if (!event.choked && (!event.to || at < event.to+0.01) && at > event.from){
      var choker = this._context.createGain()
      event.node.disconnect()
      event.node.connect(choker)
      choker.connect(this._pre)
      choker.gain.setTargetAtTime(0, at, 0.01)
      event.choked = true
    }
  }
}

function update(descriptor){

  var sourceDescriptors = descriptor.sources || []
  var active = this._active
  for (var i=0;i<active.length;i++){
    var event = active[i]
    if (~event.nodeIndex){
      updateParams(this._context, event, sourceDescriptors[event.nodeIndex])
    }
  }


  // prime sources (preload samples, etc)
  if (descriptor.sources){
    for (var i=0;i<descriptor.sources.length;i++){
      var desc = descriptor.sources[i]
      if (desc.node){
        var source = this._context.sources[desc.node]
        if (source && source.prime){
          source.prime(this._context, desc)
        }
      }
    }
  }

  updateProcessors(this, descriptor.processors)
  updateInput(this, descriptor)

  updateParams(this._context, this._outputContainer, {gain: descriptor.volume})

  this.chokeGroup = descriptor.chokeGroup == null ? null : descriptor.chokeGroup
  this.descriptor = descriptor
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