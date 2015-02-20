var Observ = require('observ')
var ObservStruct = require('observ-struct')
var NodeArray = require('observ-node-array')
var nextTick = require('next-tick')
var Prop = require('./prop.js')

module.exports = AudioSlot

function AudioSlot(parentContext){

  var context = Object.create(parentContext)
  var audioContext = context.audio

  var input = audioContext.createGain()
  var pre = audioContext.createGain()
  var output = audioContext.createGain()

  var toProcessors = audioContext.createGain()
  var post = audioContext.createGain()

  var refreshingConnections = false
  var extraConnections = []

  input.connect(pre)
  pre.connect(toProcessors)
  toProcessors.connect(post)
  post.connect(output)

  var obs = ObservStruct({
    id: Observ(),
    sources: NodeArray(context),
    processors: NodeArray(context),
    noteOffset: Prop(0),
    output: Observ(),
    volume: Prop(1)
  })

  obs._type = 'AudioSlot'
  obs.context = context
  context.noteOffset = obs.noteOffset

  obs.volume(function(value){
    output.gain.value = value
  })

  obs.input = input

  // main output
  obs.output(queueRefreshConnections)

  var removeSlotWatcher = context.slotLookup(refreshConnections)

  // reconnect sources on add / update
  var connectedSources = []
  obs.sources.onUpdate(function(diff){
    while (connectedSources.length){
      connectedSources.pop().disconnect()
    }
    obs.sources.forEach(function(source){
      source.connect(pre)
      connectedSources.push(source)
    })
  })

  // reconnect processors on add / update
  var connectedProcessors = [ toProcessors ]
  var updatingProcessors = false

  obs.processors.onUpdate(function(diff){
    if (!updatingProcessors){
      nextTick(updateProcessors)
    }
    updatingProcessors = true
  })


  obs.triggerOn = function(at){
    //HACK for testing
    obs.sources.forEach(function(source){
      source.triggerOn(at)
    })

    // for processor modulators
    obs.processors.forEach(function(processor){
      processor&&processor.triggerOn(at)
    })
  }

  obs.triggerOff = function(at){
    var maxDuration = 0
    var offEvents = []

    obs.sources.forEach(function(source){
      var releaseDuration = source.getReleaseDuration && source.getReleaseDuration() || 0
      if (releaseDuration > maxDuration){
        maxDuration = releaseDuration
      }

      offEvents.push([source, releaseDuration])
    })

    obs.processors.forEach(function(processor){
      var releaseDuration = processor.getReleaseDuration && processor.getReleaseDuration() || 0
      offEvents.push([processor, releaseDuration])
      if (releaseDuration > maxDuration){
        maxDuration = releaseDuration
      }
    })

    offEvents.forEach(function(event){
      var target = event[0]
      var releaseDuration = event[1]

      if (target.triggerOff){
        target.triggerOff(at + maxDuration - releaseDuration)
      }
    })
  }

  obs.choke = function(at){
    obs.sources.forEach(function(source){
      source.choke&&source.choke(at)
    })
  }

  obs.connect = function(to){
    extraConnections.push(to)
    refreshConnections()
  }

  obs.disconnect = function(){
    extraConnections.length = 0
    refreshConnections()
  }

  obs.destroy = function(){
    removeSlotWatcher()
    removeSlotWatcher = null
  }

  return obs

  // scoped

  function queueRefreshConnections(){
    if (!refreshingConnections){
      refreshingConnections = true
      nextTick(refreshConnections)
    }
  }

  function refreshConnections(){
    refreshingConnections = false

    output.disconnect()

    extraConnections.forEach(function(target){
      output.connect(target)
    })

    var outputNames = typeof obs.output() === 'string' ? [obs.output()] : obs.output()

    if (Array.isArray(outputNames)){
      outputNames.forEach(function(name){
        var destinationSlot = context.slotLookup.get(name)
        if (destinationSlot && destinationSlot.input){
          output.connect(destinationSlot.input)
        }
      })
    }
  }

  function updateProcessors(){

    if (checkProcessorsChanged()){

      toProcessors.disconnect()
      while (connectedProcessors.length){
        connectedProcessors.pop().disconnect()
      }

      var lastProcessor = toProcessors
      obs.processors.forEach(function(processor){
        if (processor){
          lastProcessor.connect(processor.input)
          lastProcessor = processor
        }
        connectedProcessors.push(processor)
      })

      lastProcessor.connect(post)
    }

    updatingProcessors = false

  }

  function checkProcessorsChanged(){
    if (connectedProcessors.length !== obs.processors.getLength()){
      return true
    } else {
      for (var i=0;i<connectedProcessors.length;i++){
        if (connectedProcessors[i] !== obs.processors.get(i)){
          return true
        }
      }
    }

  }
}
