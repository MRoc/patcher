# Patcher

Patcher is a library for transforming immutable object trees using basic operations with
undo history and transactions.

Patcher is the result of multiple-discovery beside more versatile and mature libraries
like *Immer*: It was born from the necessity to transform a immutable state in a redux
reducer while keeping a serializeable log of events and transactions for undo and redo.
The underlying operations share similarities with JSON Patch (RFC 6902).

## Example with Redux

Example reducer using *Patcher*:

```
import { opReplace, patch, undo, redo } from "@mroc/patcher";

export const reducer = function (state = initialState, action) {
  switch (action.type) {
    case ActionTypes.SET_TEXT_TO_HELLO_WORLD:
      return patch(state, opReplace(["text"], "Hello World"), true);
    case ActionTypes.UNDO:
        return undo(state);
    case ActionTypes.REDO:
        return redo(state);
}
```

## Patch

The `patch` function is the heart of patcher. It applies given operations *op*
to the given *state* and returns a new state. The `patch` function's parameter
`newTransaction` defines, if a new transaction should be started. All
operations in one transaction can later be undone/redone with one step:

```
function patch(state, op, newTransaction)
```

## Undo

Using `hasUndo`, `undo`, `hasRedo` and `redo`, the previous transaction can be reverted or an undone be replayed:

```
import { hasUndo, hasRedo, undo, redo } from "@mroc/patcher";

if (hasUndo(state0)) {
    return undo(state0);
}

if (hasRedo(state0)) {
    return redo(state0);
}
```

## Operations

Basic operations include:

* add: `opAdd` adds a value to an array or a property to an object.
* addRange: `opAddRange` inserts an array of values into another array.
* replace: `opReplace` replaces an element in an arrray or sets an property on an object.
* remove: `opRemove` removes an element from an array or an property from an object.
* removeRange: `opRemoveRange` removes an range for an array. Note that the last path element must be *range*.
* moveRange: `opMoveRange` moves a range in an array. Note that the last path element must be a array of one source *range*s and one destination *number*.

Notes:

* All operations contain a path that describes where in the object tree the operation should be applied. Path is an array of strings that is used to descend into the object tree.
* A path can contain out of strings, numbers and sometimes objects. Strings are used to descend into an object's properties. Numbers are used to descend into an array index. Objects are used when ranges need to be specified.
* If a *range* into an array is specified, it must be an object of form `{ index: 2, length: 3}`.
* Multiple succeeding `replace` operations might be grouped in a single transaction if the last transaction only consistes out of a single `replace` on the same path.

### Add

Add property to object:

```
import { opAdd, patch } from "@mroc/patcher";

const state = patch ({ }, opAdd(["property"], "value");

// { "property": "value" }
```

Inserting value into array:

```
import { opAdd, patch } from "@mroc/patcher";

const state = patch([1, 2, 3], opAdd([1], 4));

// [1, 2, 4, 3]
```

Note: Operations and current transaction is added to state:

```
{
    property: "value",
    history: [
        { op: "add", path: ["property"], value: "value", transaction: 0 }
    ],
    transaction: 0
}
```

### Add Range

Inserts an array of values into another array:

```
import { opAddRange, patch } from "@mroc/patcher";

const state = { values: [1, 2, 3] };
const op = opAddRange(["values", 1], [4, 5]);
const nextState = patch(state, op);

// [1, 2, 4, 5, 3]
```

### Replace

Replace a property value in an object:

```
import { opReplace, patch } from "@mroc/patcher";

const state = patch({ a: 2 }, opReplace(["a"], 5));

// { a: 5 }
```

Replaces an element in an arrray:

```
import { opReplace, patch } from "@mroc/patcher";

const state = patch([1, 2, 3], opReplace([1], 5));

// [ 1, 5, 3]
```

### Remove

Remove a property from an object:

```
import { opRemove, patch } from "@mroc/patcher";

const state = patch({ a: 1, b: 2 }, opRemove(["a"]));

// { b: 2 }
```

Remove an element from an arrray:

```
import { opRemove, patch } from "@mroc/patcher";

const state = patch([4, 5, 6], opRemove([1]));

// [4, 6]
```

### Remove Range

Removes a range of values from an array specified by index and length:

```
import { opRemoveRange, patch } from "@mroc/patcher";

const state = [1, 2, 3, 4, 5];
const op = opRemoveRange([{ index: 1, length: 2 }]);
const nextState = patch(state, op);

// [1, 4, 5]
```

### Move Range

Move range in an array:

```
import { opMoveRange, patch } from "@mroc/patcher";

const state = [1, 2, 3, 4, 5];
const op = opMoveRange([[{ index: 1, length: 2 }, 4]]);
const nextState = patch(state, op);

// [1, 4, 2, 3, 5]
```

### Multiple operations at once

Patch also supports multiple operations at once. In that case, all operations will end
up in the same transaction:

```
import { patch } from "@mroc/patcher";

const state = {
    values: [1, 2, 3]
};

const nextState = patch(state, [
    opAdd(["values", 1], 4),
    opRemove(["values", 0]),
]);
```

## Concepts

**Enrich**: All operations can be undone by creating a inverse operation using the `inverse`
function. This is usually done internally in `undo` and `redo`. An interesting fact is that
certain operations need previous state to be undone, for example `replace` because obviously
after replace, the previous value is lost. For that, operations are *enriched* before placed
into the history using the `enrich` function. This function adds a `previous` property to
all operations that require it.