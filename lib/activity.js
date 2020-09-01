'use strict';

const moduleName = 'activity';

const EventEmitter = require('events');

const xLog = require('xcraft-core-log')(moduleName, null);
const intformat = require('biguint-format');
const FlakeId = require('flake-idgen');

class Activities extends EventEmitter {
  constructor() {
    super();

    this._flakeIdGen = new FlakeId();
    this._waiting = new Map();
    this._running = new Map();

    /* Waiting list handling */
    this.on('wait', () => {
      for (const activity of this._waiting.values()) {
        xLog.info(`try to execute ${this._getActivityName(activity)}`);

        if (this._canExecute(activity)) {
          this._waiting.delete(activity.id);
          this.emit('run', activity);
        }
      }
    });

    /* Running list handling */
    this.on('run', (activity) => {
      this._running.set(activity.id, activity);
      this._run(activity);
    });
  }

  _getActivityName(activity) {
    return `${activity.msg.orcName}::${activity.cmd}`;
  }

  _run(activity) {
    const busClient = require('xcraft-core-busclient').getGlobal();

    const activityName = this._getActivityName(activity);

    xLog.verb(`start new activity for ${activityName}`);

    const unsub = () => {
      unsubscribe();

      this._running.delete(activity.id);

      xLog.verb(`end of activity ${activity.msg.orcName}@${activity.cmd}`);

      /* Try to continue with the next activity. */
      this.emit('wait');
    };

    const unsubscribe = busClient.events.subscribe(
      `${activityName}.${activity.msg.id}.(finished|error).activity`,
      unsub
    );

    /* Effectively run action */
    activity.run(activity.cmd, activity.msg);
  }

  _isRunning(activity) {
    return (
      Array.from(this._running.values()).findIndex((runAct) => {
        return (
          runAct.msg.orcName === activity.msg.orcName &&
          runAct.cmd === activity.cmd
        );
      }) !== -1
    );
  }

  _isParallel(activity) {
    return activity.parallel;
  }

  _haveOnlyParallels() {
    return !Array.from(this._running.values()).some((runAct) => {
      return !runAct.parallel;
    });
  }

  /**
   * Look if the activity can be executed.
   *
   * An activity can be executed only if:
   * 1. The same command with the same orc is not already executing.
   * 2.a The activity is parallel.
   * 2.b Or no other exclusive activity is already executing.
   *
   * @param {Object} activity - The activity object.
   * @return {boolean} if it can be executed.
   */
  _canExecute(activity) {
    const activityName = this._getActivityName(activity);

    /* Only one command by Orc at a time. */
    if (this._isRunning(activity)) {
      xLog.info(`${activityName} already running`);
      return false;
    }

    /* Always possible for parallel activities. */
    if (this._isParallel(activity)) {
      return true;
    }

    /* If only parallel activities are running,
     * this activity can be executed.
     */
    if (this._haveOnlyParallels()) {
      return true;
    }

    xLog.info(`stay in waiting list: ${activityName}`);
    return false;
  }

  /**
   * Status of all running and waiting activities.
   *
   * @return {Object} a map with running and waiting activities.
   */
  status() {
    const status = {
      running: {},
      waiting: {},
    };

    this._running.forEach((activity) => {
      status.running[activity.id] = {
        cmd: activity.cmd,
        orc: activity.msg.orcName,
      };
    });
    this._waiting.forEach((activity) => {
      status.waiting[activity.id] = {
        cmd: activity.cmd,
        orc: activity.msg.orcName,
      };
    });

    return status;
  }

  /**
   * Add an activity to execute.
   *
   * The activity is push in the waiting list and executed ASAP.
   *
   * @param  {string} cmd - The command's name.
   * @param  {Object} msg - The associated message.
   * @param  {function()} action - The handler for running the command.
   * @param  {Boolean} parallel - False is the command is exclusive.
   * @return {undefined}
   */
  execute(cmd, msg, action, parallel) {
    const id = intformat(this._flakeIdGen.next(), 'hex');

    this._waiting.set(id, {
      id: id,
      cmd: cmd,
      msg: msg,
      run: action,
      parallel: parallel,
    });

    this.emit('wait');
  }

  pause(id) {
    xLog.warn('pause not implemented: ' + id);
  }

  resume(id) {
    xLog.warn('resume not implemented: ' + id);
  }

  kill(id) {
    xLog.warn('kill not implemented: ' + id);
  }
}

module.exports = new Activities();
