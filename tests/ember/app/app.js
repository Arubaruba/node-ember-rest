App = Ember.Application.create();


App.ApplicationAdapter = DS.RESTAdapter.extend({
  host: 'http://localhost:7414',
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
  actions: {
    addComment: function () {
      var controller = this;
      controller.store.createRecord('comment', {
        title: controller.get('title'),
        body: controller.get('body')
      }).save().then(function (comment) {
        controller.store.createRecord('tag', {name: 'one'}).save().then(function (tag) {
          comment.get('tags').pushObject(tag).save().then(function() {
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
})
;

App.ApplicationRoute = Ember.Route.extend({
  model: function () {
    return this.store.findAll('comment');
  }
});
