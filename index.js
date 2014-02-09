var CustomNode = require('custom-audio-node')

var updateParams = require('./lib/update_params')
var updateProcessors = require('./lib/update_processors')

module.exports = function(audioContext, descriptor){
  var input = audioContext.createGain()
  var output = audioContext.createGain()

  var slot = CustomNode(input, output)
  slot._input = input
  slot._output = output
  slot._descriptor = {}
  slot._currentProcessors = []
  slot._active = []

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

  slot.update(descriptor)

  return slot
}

function triggerOn(at, velocity){
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

  startProcessorModulators(this._currentProcessors, at)
}

function triggerOff(at){

  at = stopProcessorModulators(this._currentProcessors, at)

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
      event.to = at
      event.node.stop(offTime)
    }
  }

}

function choke(at){
  var active = this._active
  for (var i=0;i<active.length;i++){
    var event = active[i]
    if ((!event.to || at < event.to+0.01) && at > event.from){
      var choker = this.context.createGain()
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
      updateParams(this.context, event, sourceDescriptors[event.nodeIndex])
    }
  }

  updateProcessors(this, descriptor.processors)

  this.descriptor = descriptor
}


///////////////////

function startProcessorModulators(processors, at){
  for (var i=0;i<processors.length;i++){
    var container = processors[i]
    for (var x=0;x<container.modulators.length;x++){
      var modulator = container.modulators[x]
      if (modulator.start){
        modulator.start(at)
      }
    }
  }
}

function stopProcessorModulators(processors, at, isTarget){
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
  return stopAt
}

function handlePlayerEnd(event){
  var active = this._active
  var index = active.indexOf(event)
  if (~index){
    active.splice(index, 1)
  }
}