# patcher

Immutable state patching in JS

# Description

Patcher is a library for transforming immutable object trees using simple operations with undo history and transactions.

# Example


## patch

The patch function is the heart of patcher. It takes a state, one or more operations, and if a new transaction should be created:

```
function patch(state, op, newTransaction)
```

Basic operations include: add, addRange, replace, delete, deleteRange, swap.
All operations contain a path that describes where in the object tree the
operation should be applied.

For example, adding a range of values to an array nested in an object:

```
import { patch } from "@mroc/patcher";

const state = {
    values: [1, 2, 3]
};

const nextState = patch(state, opAddRange(["values", 1], [4, 5]));
```

Results in the following new state. Note: All operations and the current transaction is stored in the state.

```
{
    values: [1, 2, 4, 5, 3],
    history: [
        { op: "add_range", path: ["values", 1], value: [4, 5], transaction: 0 }
    ],
    transaction: 0
}
```

Patch also supports multiple operations at once:

```
import { patch } from "@mroc/patcher";

const state = {
    values: [1, 2, 3]
};

const nextState = patch(state, [
    opAdd(["values", 1], 4),
    opDelete(["values", 0]),
]);
```

## undo/redo

Undoing and redo all operations from last transaction is as easy as:

```
import { undo } from "@mroc/patcher";

const previousState = undo(nextState);
const nextState2 = redo(previousState);
```