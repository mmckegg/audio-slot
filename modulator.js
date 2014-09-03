var updateParams = require('./lib/update_params')
var flat = new Float32Array([1,1])

module.exports = Modulator

function Modulator(audioContext, descriptor){
  if (!(this instanceof Modulator)){
    return new Modulator(audioContext, descriptor)
  }

  this.context = audioContext
  this.input = audioContext.createGain()
  this.output = audioContext.createGain()
  this.input.connect(this.output)
  this._active = []
  this._descriptor = {}
  this._container = {node: this, descriptor: {}, modulators: []}

  var voltage = this._voltage = audioContext.createWaveShaper()
  var valueScaler = scale(voltage)
  voltage.curve = flat
  valueScaler.connect(this.output)

  // AudioParams 
  this.valueOffset = valueScaler.gain

  if (descriptor){
    this.update(descriptor)
  }
}

Modulator.prototype = {
  constructor: Modulator,

  update: function(descriptor){
    updateParams(this.context, this._container, descriptor)
    this._descriptor = descriptor
  },

  triggerOn: function(at){
    var source = this.context.createOscillator()
    var event = {from: at, node: source, modulators: [], descriptor: {}, nodeIndex: 0}
    source.onended = handlePlayerEnd.bind(this, event)

    source.connect(this._voltage)
    source.start(at)

    this._active.push(event)
    startModulators(this, at)
  },

  triggerOff: function(at){
    at = stopModulators(this, at)
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
  },

  choke: function(at){
    return false
  },

  connect: function(destination){
    this.output.connect.apply(this.output, arguments)
  },

  disconnect: function(){
    this.output.disconnect.apply(this.output, arguments)
  }
}

function scale(node){
  var gain = node.context.createGain()
  node.connect(gain)
  return gain
}

function handlePlayerEnd(event){
  var active = this._active
  var index = active.indexOf(event)
  if (~index){
    active.splice(index, 1)
  }
}

function startModulators(slot, at){
  var container = slot._container
  for (var x=0;x<container.modulators.length;x++){
    var modulator = container.modulators[x]
    if (modulator.start){
      modulator.start(at)
    }
  }
}

function stopModulators(slot, at){
  var stopAt = at
  var container = slot._container
  for (var x=0;x<container.modulators.length;x++){
    var modulator = container.modulators[x]
    if (modulator.stop){
      var res = modulator.stop(at)
      if (res > stopAt){
        stopAt = res 
      }
    }
  }
  return stopAt
}