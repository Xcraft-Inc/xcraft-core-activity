'use strict';

const activity = require ('.');

const cmd = {};

cmd.status = function (msg, resp) {
  const status = activity.status ();
  resp.events.send ('activity.status', status);
  resp.events.send (`activity.status.${msg.id}.finished`);
};

/**
 * Retrieve the list of available commands.
 *
 * @returns {Object} The list and definitions of commands.
 */
exports.xcraftCommands = function () {
  return {
    handlers: cmd,
    rc: {
      status: {
        parallel: true,
        desc: 'show the status of all activities',
      },
    },
  };
};
