'use strict';

/* Xcraft activity manager */
var moduleName = 'activity';

var xLog       = require ('xcraft-core-log') (moduleName, null);
var FlakeId    = require ('flake-idgen');
var flakeIdGen = new FlakeId ();

var running = null;
var pending = [];
const activityEndPromises = [];


var start = function (activity) {
  var busClient = require ('xcraft-core-busclient').getGlobal ();

  var msg = activity.msg;
  var cmd = activity.cmd;
  var action = activity.run;

  running = activity;

  activityEndPromises.push (new Promise (function (resolve) {
    busClient.events.send ('greathall::activity.started', activity);

    var finishTopic = msg.orcName + '::' + cmd + '.finished';
    busClient.events.subscribe (finishTopic, function () {
      resolve (activity);
    });

    /* Effectively run action */
    action (cmd, msg);
  }));

  Promise.all (activityEndPromises).then ((activities) => {
    activities.forEach ((activity) => {
      busClient.events.send ('greathall::activity.finished', activity);
      running = null;
      if (pending.length > 0) {
        var nextActivity = pending.shift ();
        start (nextActivity);
      }
    });
  });
};

exports.create = function (cmd, msg, action, parallel) {
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
    if (running && !parallel) {
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
