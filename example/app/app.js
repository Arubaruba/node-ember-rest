App = Ember.Application.create();

App.ApplicationAdapter = DS.RESTAdapter.extend({
  namespace: 'data'
});

App.Router.map(function () {
  // put your routes here
});

App.Comment = DS.Model.extend({
  title: DS.attr('string'),
  body: DS.attr('string'),
  tags: DS.hasMany('tag', {async: true})
});

App.Tag = DS.Model.extend({
  name: DS.attr('string')
});

App.ApplicationController = Ember.Controller.extend({
  title: '1',
  body: '',
  init: function () {
    storeUpdateSocket(this.store);
  },
  actions: {
    addComment: function () {
      var controller = this;
      controller.store.createRecord('tag', {name: 'one'}).save().then(function (tag) {
        var comment = controller.store.createRecord('comment', {
          title: controller.get('title'),
          body: controller.get('body')
        });
        comment.get('tags').then(function () {
          comment.get('tags').pushObject(tag);
          // we need to wait for tags to be updated to save the comment
          comment.get('tags').then(function () {
            comment.save();
          });
        });
      });
    },
    editComment: function (comment) {
      comment.set('editing', !comment.get('editing'));
    },
    updateComment: function (comment) {
      comment.set('editing', false);
      comment.save().then(function () {
        console.log('editing saved')
      });
    },
    deleteComment: function (comment) {
      comment.destroyRecord();
    }
  }
});

App.ApplicationRoute = Ember.Route.extend({
  model: function () {
    return this.store.findAll('comment');
  }
});
