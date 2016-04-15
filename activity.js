'use strict';

const path = require ('path');

const activity = require ('.');

const cmd = {};


cmd.status = function (msg, resp) {
  const status = activity.status ();
  resp.events.send ('activity.status', status);
  resp.events.send ('activity.status.finished');
};

/**
 * Retrieve the list of available commands.
 *
 * @returns {Object} The list and definitions of commands.
 */
exports.xcraftCommands = function () {
  const xUtils = require ('xcraft-core-utils');
  return {
    handlers: cmd,
    rc: xUtils.json.fromFile (path.join (__dirname, './rc.json'))
  };
};
