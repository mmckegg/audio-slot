var updateParams = require('./update_params')

module.exports = function updateProcessors(slot, processorDescriptors){
  var processors = slot.context.processors || {}
  var active = slot._currentProcessors

  processorDescriptors = processorDescriptors || []

  var reconnect = []
  
  for (var i=0;i<active.length;i++){
    var descriptor = processorDescriptors[i]
    var container = active[i]

    if (descriptor){
      if (container.descriptor.node != descriptor.node){ // replace
        container.node.disconnect()
        reconnect.push(i)
      } 
      update(slot.context, container, descriptor)
    } else {
      container.node.disconnect()
    }
  }

  // handle any remaining descriptors
  for (i;i<processorDescriptors.length;i++){
    var descriptor = processorDescriptors[i]
    var container = { descriptor: {}, node: null, modulators: [] }
    update(slot.context, container, descriptor)
    active[i] = container
    reconnect.push(i)
  }

  // truncate and reconnect

  if (processorDescriptors.length != active.length){
    active.length = processorDescriptors.length
    var lastId = active.length-1
    if (!~reconnect.indexOf(lastId)){
      reconnect.push(lastId)
    }
  }

  doReconnect(slot, reconnect)
}

function doReconnect(slot, ids){

  var active = slot._currentProcessors

  for (var x=0;x<ids.length;x++){
    var i = ids[x]

    var processor = active[i] && active[i].node
    var prevProcessor = nodeOrDefault(active[i-1], slot._pre)
    var nextProcessor = nodeOrDefault(active[i+1], slot.output)

    var reconnectingNext = ~ids.indexOf(i+1)

    prevProcessor.disconnect()
    if (processor){
      prevProcessor.connect(processor)

      if (!reconnectingNext){
        processor.disconnect()
        processor.connect(nextProcessor)
      }

    } else {
      prevProcessor.connect(nextProcessor)
    }
  }

}

function nodeOrDefault(container, defaultValue){
  if (container && container.node){
    return container.node
  } else {
    return defaultValue
  }
}

function update(context, container, descriptor){
  var processors = context.processors || {}
  if (container.descriptor.node != descriptor.node){
    if (typeof processors[descriptor.node] === 'function'){
      container.node = processors[descriptor.node](context)
    } else {
      container.node = context.createGain()
    }
  }
  var changes = updateParams(context, container, descriptor)
}