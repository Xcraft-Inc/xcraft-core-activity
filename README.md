# xcraft-core-activity

Handle the activities for the Xcraft server. An activity begins with a command
and accordingly to some conditions, the command is push in the waiting or in
the running list.

The activity manager looks like a trivial scheduler.

A command (new activity) is executed only if:

- The same command with the same orc is not already executing.
- The activity is parallel or no other exclusive activity is already
  executing.

## API

There are only two public (implemented) methods.

- `status`
- `execute`
