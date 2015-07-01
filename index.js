'use strict';

/* Xcraft activity manager */
var moduleName = 'activity';

var xLog       = require ('xcraft-core-log') (moduleName);
var FlakeId    = require ('flake-idgen');
var flakeIdGen = new FlakeId ();

var running = null;
var pending = [];


var start = function (activity) {
  var busClient = require ('xcraft-core-busclient').getGlobal ();

  var msg = activity.msg;
  var cmd = activity.cmd;
  var action = activity.run;

  running = activity;
  busClient.events.send ('activity.started', activity);

  var activityEndPromise = new Promise (function (resolve) {
    var finishTopic = msg.orcName + '::' + cmd + '.finished';
    busClient.events.subscribe (finishTopic, function () {
      resolve ();
    });

    /* Effectively run action */
    action (cmd, msg);
  });

  activityEndPromise.then (function () {
    busClient.events.send ('activity.finished', activity);
    running = null;
    if (pending.length > 0) {
      var nextActivity = pending.shift ();
      start (nextActivity);
    }
  });
};

exports.create = function (cmd, msg, action) {
  flakeIdGen.next (function (err, id) {
    if (err) {
      xLog.err (err);
    }
    var activity = {
      id: id,
      cmd: cmd,
      msg: msg,
      run: action
    };
    if (running) {
      pending.push (activity);
    } else {
      start (activity);
    }
  });
};

exports.resume = function (id) {
  /* TODO */
  xLog.warn ('not implemented: ' + id);
};

exports.destroy = function (id) {
  /* TODO */
  xLog.warn ('not implemented: ' + id);
};
