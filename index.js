'use strict';
/* Xcraft activity manager */

var moduleName = 'activity';
var busClient  = require ('xcraft-core-busclient');
var xLog       = require ('xcraft-core-log') (moduleName);
var FlakeId    = require ('flake-idgen');

var flakeIdGen = new FlakeId ();

exports.create = function (cmd, msg) {
  flakeIdGen.next (function (err, id) {
    if (err) {
      xLog.err (err);
    }
    var activity = {
      id: id,
      cmd: cmd,
      msg: msg
    };

    busClient.events.send ('activity.started', activity);
  });
};

exports.resume = function (id) {
  // Todo:
  console.log (id);
};

exports.destroy = function (id) {
  // Todo:
  console.log (id);
};
