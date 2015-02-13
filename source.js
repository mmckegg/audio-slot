var Observ = require('observ')
var watchModulators = require('./lib/watch-modulators')
var setParamsOn = require('./lib/set-params')
var watch = require('observ/watch')
var nextTick = require('next-tick')
var Event = require('geval')

module.exports = function(ctor){

  return function Source(context){
    var obs = Observ({})
    
    obs._type = 'AudioSource'
    obs.context = context

    var active = []

    var lastData = {}
    var staticAttributes = {}
    var modulators = {}
    var lastTriggerAt = 0
    var releaseTempo = null

    var targets = []
    var output = context.audio.createGain()

    var future = []

    obs.connect = output.connect.bind(output)
    obs.disconnect = output.disconnect.bind(output)

    obs.modulators = Observ(modulators)

    watchModulators(context, obs, function(s, m){
      staticAttributes = s
      modulators = m

      // update params of already running nodes
      active.forEach(function(container){
        setParamsOn(staticAttributes, modulators, container[0])
      })

      // update params of future nodes
      future.forEach(function(container){
        setParamsOn(staticAttributes, modulators, container[0])
      })

      obs.modulators.set(modulators)
    })

    nextTick(prepare)

    obs.choke = function(at){
      at = Math.max(context.audio.currentTime, at || 0)
      for (var i=active.length-1;i>=0;i--){
        if (active[i][2] && active[i][2] < at){
          active[i][1].gain.setTargetAtTime(0, at, 0.01)
          active[i][3] = at
        }
      }
      removeEnded()
    }

    obs.triggerOn = function(at){

      var next = future.pop() || generateFuture()
      var node = next[0]

      at = Math.max(context.audio.currentTime, at || 0)
      obs.choke(at)

      var stopAt = node.start(at)

      next[2] = at
      next[3] = stopAt

      active.push(next)

      for (var key in modulators){
        modulators[key].triggerOn && modulators[key].triggerOn(at)
      }

      nextTick(removeEnded)
      nextTick(prepare)

      return stopAt
    }

    obs.getReleaseDuration = function(){
      var container = active[0] || future[0]
      if (container){
        var node = container[0]
        var duration = 0 

        if (node.getReleaseDuration){
          var t = node.getReleaseDuration()
          if (t > duration){
            duration = t
          }
        }

        Object.keys(modulators).forEach(function(key){
          if (modulators[key].getReleaseDuration){
            var t = modulators[key].getReleaseDuration()
            if (t > duration){
              duration = t
            }
          }
        })

        return duration
      }
    }

    obs.triggerOff = function(at){

      at = Math.max(context.audio.currentTime, at || 0)

      var maxDuration = obs.getReleaseDuration()

      for (var key in modulators){
        if (modulators[key].triggerOff){
          var stopAt = at + maxDuration - getRelease(modulators[key])
          modulators[key].triggerOff(stopAt)
        }
      }

      var endAt = at + maxDuration

      for (var i=active.length-1;i>=0;i--){
        if (active[i][2] && active[i][2] < at && !active[i][3]){
          var node = active[i][0]
          var stopAt = active[i][3] = endAt
          node.stop(at + maxDuration - getRelease(node))
        }
      }

      nextTick(removeEnded)

      return endAt
    }

    obs.destroy = function(){
      releaseTempo&&releaseTempo()
      releaseTempo = null
    }

    return obs

    // scoped

    function removeEnded(){
      var time = context.audio.currentTime
      for (var i=active.length-1;i>=0;i--){
        if (active[i][3] && active[i][3] <= time){
          active[i][1].disconnect()
          active.splice(i, 1)
        }
      }
    }

    function updateTempo(value){
      for (var i=0;i<active.length;i++){
        active[i][0].tempo = value
      }
    }

    function prepare(){
      future.push(generateFuture())
    }

    function generateFuture(){
      var node = ctor(context.audio, context)
      setParamsOn(staticAttributes, modulators, node)

      var choker = context.audio.createGain()

      node.connect(choker)
      choker.connect(output)
      node.onended = removeEnded

      // update node tempo and add tempo watcher if needed
      if ('tempo' in node && typeof context.tempo == 'function'){
        if (releaseTempo){
          node.tempo = context.tempo()
        } else {
          releaseTempo = watch(context.tempo, updateTempo)
        }
      }

      return [node, choker, 0, 0]
    }

  }
}

function getRelease(node){
  return node && node.getReleaseDuration && node.getReleaseDuration() || 0
}