function storeUpdateSocket(store) {
  var socket = io(window.location.host);
  socket.on('change', function (message) {
    var model = Ember.Inflector.inflector.singularize(message.model);
    var record = store.getById(model, message.id);

    if (!message.data && (record && !record.get('isDeleted'))) {
      record.deleteRecord();
    } else if (message.data && (record && record.get('isSaved')) || !record) {
      store.pushPayload(model, message.data);
    }
  });
}
