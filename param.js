var ObservNode = require('observ-node-array/single')

module.exports = Param

function Param(context, target, defaultValue){
  var obs = ObservNode(context)

  // handle defaultValue
  var set = obs.set
  obs.set = function(v){
    set(v == null ? defaultValue : v)
    if (!(v instanceof Object) && v != null){
      target.value = v
    }
  }

  var lastNode = null
  obs.onNode(function(node){
    
    if (lastNode){
      lastNode.disconnect()
    }

    if (node){
      target.value = 0
      node.connect(target)
    } else {
      target.value = defaultValue
    }

    lastNode = node
  })

  obs.triggerOn = function(at){
    if (obs.node && obs.node.triggerOn){
      return obs.node.triggerOn(at) || 0
    } else {
      target.setValueAtTime(obs(), at)
    }
  }

  obs.triggerOff = function(at){
    return obs.node && obs.node.triggerOff && obs.node.triggerOff(at) || 0
  }

  obs.getReleaseDuration = function(){
    return obs.node && obs.node.getReleaseDuration && obs.node.getReleaseDuration() || 0
  }

  return obs
}