'use strict';

const moduleName = 'activity';

const EventEmitter = require ('events');

const xLog      = require ('xcraft-core-log') (moduleName, null);
const FlakeId   = require ('flake-idgen');


class Activities extends EventEmitter {
  constructor () {
    super ();

    this._flakeIdGen = new FlakeId ();
    this._waiting    = {};
    this._running    = {};

    /* Waiting list handling */
    this.on ('wait', () => {
      Object.keys (this._waiting).forEach ((id) => {
        const activity = this._waiting[id];

        xLog.info (`try to execute ${this._getActivityName (activity)}`);

        if (this._canExecute (activity)) {
          delete this._waiting[id];
          this.emit ('run', activity);
        }
      });
    });

    /* Running list handling */
    this.on ('run', (activity) => {
      this._running[activity.id] = activity;
      this._run (activity);
    });
  }

  _getActivityName (activity) {
    return `${activity.msg.orcName}::${activity.cmd}`;
  }

  _run (activity) {
    const busClient = require ('xcraft-core-busclient').getGlobal ();

    const activityName = this._getActivityName (activity);

    xLog.verb (`start new activity for ${activityName}`);

    const finishTopic = `${activityName}.finished`;

    busClient.events.send ('greathall::activity.started', activity);
    busClient.events.subscribe (finishTopic, () => {
      delete this._running[activity.id];
      busClient.events.send ('greathall::activity.ended', activity);

      xLog.verb (`end of activity ${activity.msg.orcName}@${activity.cmd}`);

      /* Try to continue with the next activity. */
      this.emit ('wait');
    });

    /* Effectively run action */
    activity.run (activity.cmd, activity.msg);
  }

  _isRunning (activity) {
    return Object.keys (this._running).findIndex ((id) => {
      return this._running[id].msg.orcName === activity.msg.orcName &&
             this._running[id].cmd         === activity.cmd;
    }) !== -1;
  }

  _isParallel (activity) {
    return activity.parallel;
  }

  _haveOnlyParallels () {
    return !Object.keys (this._running).some ((id) => {
      return !this._running[id].parallel;
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
   * @param {Object} activity
   * @return {boolean} if it can be executed.
   */
  _canExecute (activity) {
    const activityName = this._getActivityName (activity);

    /* Only one command by Orc at a time. */
    if (this._isRunning (activity)) {
      xLog.warn (`${activityName} already running`);
      return false;
    }

    /* Always possible for parallel activities. */
    if (this._isParallel (activity)) {
      return true;
    }

    /* If only parallel activities are running,
     * this activity can be executed.
     */
    if (this._haveOnlyParallels ()) {
      return true;
    }

    xLog.warn (`stay in waiting list: ${activityName}`);
    return false;
  }

  execute (cmd, msg, action, parallel) {
    const id = this._flakeIdGen.next ();

    this._waiting[id] = {
      id: id,
      cmd: cmd,
      msg: msg,
      run: action,
      parallel: parallel
    };

    this.emit ('wait');
  }

  pause (id) {
    xLog.warn ('pause not implemented: ' + id);
  }

  resume (id) {
    xLog.warn ('resume not implemented: ' + id);
  }

  kill (id) {
    xLog.warn ('kill not implemented: ' + id);
  }
}

module.exports = new Activities ();
