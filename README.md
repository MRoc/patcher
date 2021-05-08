# Patcher

Patcher is a library for transforming immutable object trees using simple
operations with undo history and transactions.

## Patch

The `patch` function is the heart of patcher. It applies given operations
to the given state and returns a new state. The `patch` function's parameter
`newTransaction` defines, if a new transaction should be started. All
operations in one transaction can later be undone/redone with one step:

```
function patch(state, op, newTransaction)
```

## Operations

Basic operations include:

* add: `opAdd` adds a value to an array or a property to an object.
* addRange: `opAddRange` inserts an array of values into another array.
* replace: `opReplace` replaces an element in an arrray or sets an property on an object.
* delete: `opDelete` removes an element from an array or an property from an object.
* deleteRange: `opDeleteRange` removes an range for an array. Note that the last path element must be *range*.
* swapRanges: `opSwapRangesRanges` swaps two ranges in an array. Note that the last path elements must be a array of two *range*s.

Notes:

* All operations contain a path that describes where in the object tree the operation should be applied.
* If a *range* into an array is specified, it must be an object of form `{ index: 2, length: 3}`.
* Multiple succeeding `replace` operations might be grouped in a single history step if the last transaction only consistes out of a single `replace` on the same path.


## Examples

Inserting a value to an array at position 1 nested in an object:

```
import { opAdd, patch } from "@mroc/patcher";

const state = { values: [1, 2, 3] };

const op = opAdd(["values", 1], 4);

const nextState = patch(state, op);
```

Results in the following new state. Note: All operations and the current transaction is stored in the state.

```
{
    values: [1, 2, 4, 3],
    history: [
        { op: "add", path: ["values", 1], value: 4, transaction: 0 }
    ],
    transaction: 0
}
```

Patch also supports multiple operations at once. In that case, all operations will end
up in the same transaction:

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

## Undo and Redo

Using `undo` and `redo`, the previous transaction can be reverted or an undone be replayed:

```
import { undo, redo } from "@mroc/patcher";

const state1 = undo(state0);
const state2 = redo(state1);

// state1 equals state 0
```

## Concepts

All operations can be undone by creating a inverse operation using the `inverse` function.
This is usually done internally in `undo` and `redo`. An interesting fact is that certain
operations need previous state to be undone, for example `replace` because obviously after
replace, the previous value is lost. For that, operations are *enriched* before placed
into the history using the `enrich` function. This function adds a `previous` property
to those operations who need it.