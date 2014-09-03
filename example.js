var AudioSlot = require('./index')
var audioContext = new AudioContext()

audioContext.sources = {
  sample: require('soundbank-sample'),
  oscillator: require('soundbank-oscillator')
}

audioContext.processors = {
  gain: audioContext.createGain.bind(audioContext),
  filter: audioContext.createBiquadFilter.bind(audioContext),
  delay: require('soundbank-delay')
}

audioContext.modulators = {
//  lfo: require('soundbank-lfo'),
  adsr: require('adsr')
}

audioContext.sampleCache = {}

loadAudioBuffer('/node_modules/soundbank-sample/sounds/hiss.wav', function(err, buffer){
  audioContext.sampleCache['hiss.wav'] = buffer
})

var descriptor = {
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
}

var slot = AudioSlot(audioContext, descriptor)

window.context = { slot: slot }
slot.connect(audioContext.destination)

addButton('trigger on', function(){
  slot.triggerOn(audioContext.currentTime)
})

addButton('choke + trigger on', function(){
  slot.choke(audioContext.currentTime)
  slot.triggerOn(audioContext.currentTime)
})

addButton('trigger off', function(){
  slot.triggerOff(audioContext.currentTime)
})

addButton('choke', function(){
  slot.choke(audioContext.currentTime)
})

addButton('trigger 2s', function(){
  slot.triggerOn(audioContext.currentTime)
  slot.triggerOff(audioContext.currentTime+2)
})

addButton('trigger 0.2s', function(){
  slot.triggerOn(audioContext.currentTime)
  slot.triggerOff(audioContext.currentTime+0.2)
})

addButton('trigger 2s, choke 0.4s', function(){
  slot.triggerOn(audioContext.currentTime)
  slot.triggerOff(audioContext.currentTime+2)
  slot.choke(audioContext.currentTime+1)
})

addButton('play sound thru slot input', function(){
  var player = audioContext.sources.sample(audioContext)
  player.url = 'hiss.wav'
  player.connect(slot.input)
  player.mode = 'oneshot'
  player.start(audioContext.currentTime)
})

var textArea = document.createElement('textarea')
textArea.style.display = 'block'
textArea.style.width = '100%'
textArea.rows = 50
textArea.value = JSON.stringify(descriptor, null, 2)
textArea.oninput = function(){
  try {
    descriptor = JSON.parse(textArea.value)
  } catch (ex){
    return
  }
  slot.update(descriptor)
}

document.body.appendChild(textArea)

function addButton(name, func){
  var button = document.createElement('button')
  button.onclick = func
  button.textContent = name
  document.body.appendChild(button)
}

function loadAudioBuffer(url, cb){
  requestArrayBuffer(url, function(err, data){  if(err)return cb&&cb(err)
    audioContext.decodeAudioData(data, function(buffer){
      cb(null, buffer)
    }, function(err){
      cb(err)
    })
  })
}

function requestArrayBuffer(url, cb){
  var request = new window.XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';
  request.onload = function() {
    cb(null, request.response)
  }
  request.onerror = cb
  request.send();
}