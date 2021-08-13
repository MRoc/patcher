import {
  patch,
  undo,
  redo,
  combine,
  canMergeOp,
  mergeLastOp,
  discardFutureOps,
  emptyHistory,
  createHistory,
} from "./index.js";

import {
  opAdd,
  opAddRange,
  opReplace,
  opReplaceEnriched,
  opRemove,
  opRemoveEnriched,
  opRemoveRange,
  opRemoveRangeEnriched,
  opMoveRange,
  enrich,
  inverse,
} from "./optype.js";

describe("canMergeOp", () => {
  test("With no last operations returns false", () => {
    const history = emptyHistory();
    const transaction = -1;
    const operation = opReplace(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation not being replace returns false", () => {
    const history = createHistory([opAdd(["a", "value"], "b", 0)]);
    const transaction = 0;
    const operation = opReplace(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation path not equal returns false", () => {
    const history = createHistory([opReplace(["b"], 1, 0)]);
    const transaction = 0;
    const operation = opReplace(["a"], 0, 1);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With two operations returns false", () => {
    const history = createHistory([opReplace(["b"], 1, 0)]);
    const transaction = 0;
    const operation = [opReplace(["a"], 0, 1), opReplace(["b"], 0, 1)];
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With replace on same path and single op returns true", () => {
    const history = createHistory([opReplace(["b", "c"], 1, 0)]);
    const transaction = 0;
    const operation = opReplace(["b", "c"], 2, 0);
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
  test("With replace on same path in array and single op returns true", () => {
    const history = createHistory([opReplace(["b", "c"], 1, 0)]);
    const transaction = 0;
    const operation = [opReplace(["b", "c"], 2, 0)];
    const canMerge = canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
});

describe("mergeLastOp", () => {
  test("With last operation merge-able, overwrites value", () => {
    const history = createHistory([opReplace(["a", "b"], 1, 0)]);
    const operation = opReplace(["a", "b"], 2, 0);
    const mergedHistory = mergeLastOp(history, operation);
    expect(mergedHistory).toStrictEqual(
      createHistory([opReplace(["a", "b"], 2, 0)])
    );
  });
});

describe("discardFutureOps", () => {
  test("With history removes operations from the future", () => {
    const history = createHistory(
      [
        opReplace(["a", "b"], 1, 0),
        opReplace(["a", "b"], 2, 1),
        opReplace(["a", "b"], 3, 2),
      ],
      [
        opReplace(["a", "b"], 0, 0),
        opReplace(["a", "b"], 0, 1),
        opReplace(["a", "b"], 0, 2),
      ]
    );
    const newHistory = discardFutureOps(history, 1);
    expect(newHistory).toStrictEqual(
      createHistory([history.ops[0]], [history.opsInverted[0]])
    );
  });
});

// describe("patch", () => {
//   test("With add to object, starts transaction, adds to history, adds property", () => {
//     const state = {};
//     const op = opAdd(["a"], 2);
//     const clone = patch(state, op);
//     expect(clone).toStrictEqual(combine({ a: 2 }, [opAdd(["a"], 2, 0)], 0, 1));
//   });
//   test("With add to array, starts transaction, adds to history, adds element", () => {
//     const state = [1, 2, 3];
//     const op = opAdd([1], 5);
//     const clone = patch(state, op);
//     expect(clone.slice(0)).toStrictEqual([1, 5, 2, 3]);
//     expect(clone.history.length).toBe(1);
//     expect(clone.transaction).toBe(0);
//   });
//   test("With add-range to array, starts transaction, adds to history, adds elements", () => {
//     const state = [1, 2, 3];
//     const op = opAddRange([1], [4, 5]);
//     const clone = patch(state, op);
//     expect(clone.slice(0)).toStrictEqual([1, 4, 5, 2, 3]);
//     expect(clone.history.length).toBe(1);
//     expect(clone.transaction).toBe(0);
//   });
//   test("With remove from object, starts transaction, adds to history, removes property", () => {
//     const state = { a: 2 };
//     const op = opRemove(["a"]);
//     const clone = patch(state, op);
//     expect(clone).toStrictEqual(
//       combine({}, [opRemoveEnriched(["a"], 2, 0)], 0, 1)
//     );
//   });
//   test("With remove from array, starts transaction, adds to history, removes element", () => {
//     const state = [1, 2, 5, 3];
//     const op = opRemove([2]);
//     const clone = patch(state, op);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
//     expect(clone.history.length).toBe(1);
//     expect(clone.transaction).toBe(0);
//   });
//   test("With remove-range from array, starts transaction, adds to history, removes elements", () => {
//     const state = [1, 2, 5, 3];
//     const op = opRemoveRange([{ index: 1, length: 2 }]);
//     const clone = patch(state, op);
//     expect(clone.slice(0)).toStrictEqual([1, 3]);
//     expect(clone.history.length).toBe(1);
//     expect(clone.transaction).toBe(0);
//   });
//   // TODO This case is not implemented yet and differs from JSON patch RFC
//   // test("With replace on object empty, starts transaction, adds to history, creates property", () => {
//   //   const state = { };
//   //   const op = opReplace(["a"], 3);
//   //   const clone = patch(state, op);
//   //   expect(clone).toStrictEqual({
//   //     a: 3,
//   //     history: [opReplaceEnriched(["a"], undefined, 3, 0)],
//   //     transaction: 0,
//   //   });
//   // });
//   test("With replace on object, starts transaction, adds to history, updates property", () => {
//     const state = { a: 2 };
//     const op = opReplace(["a"], 3);
//     const clone = patch(state, op);
//     expect(clone).toStrictEqual(
//       combine({ a: 3 }, [opReplaceEnriched(["a"], 2, 3, 0)], 0, 1)
//     );
//   });
//   test("With replace on array, starts transaction, adds to history, updates element", () => {
//     const state = [1, 2, 5, 3];
//     const op = opReplace([2], 4);
//     const clone = patch(state, op);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 4, 3]);
//     expect(clone.history.length).toBe(1);
//     expect(clone.transaction).toBe(0);
//   });
//   test("With two sets, increments version twice", () => {
//     const clone = patch({}, [opAdd(["a"], 2), opAdd(["a"], 2)]);
//     expect(clone.version).toBe(2);
//   });
// });

// describe("undo", () => {
//   test("With add to object, removes property and decrements transaction", () => {
//     const state = combine({ a: 2 }, [opAdd(["a"], 2, 0)], 0);
//     const clone = undo(state);
//     expect(clone).toStrictEqual(combine({}, [opAdd(["a"], 2, 0)], -1, 1));
//   });
//   test("With add to array, removes element and decrements transaction", () => {
//     const state = combine([1, 2, 5, 3], [opAdd([2], 5, 0)], 0);
//     const clone = undo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
//   });
//   test("With add-range to array,removes elements and decrements transaction", () => {
//     const state = combine([1, 4, 5, 2, 3], [opAddRange([1], [4, 5], 0)], 0);
//     const clone = undo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
//   });
//   test("With remove from object, adds property and decrements transaction", () => {
//     const state = combine({}, [opRemoveEnriched(["a"], 2, 0)], 0);
//     const clone = undo(state);
//     expect(clone).toStrictEqual(
//       combine({ a: 2 }, [opRemoveEnriched(["a"], 2, 0)], -1, 1)
//     );
//   });
//   test("With remove from array, adds element and decrements transaction", () => {
//     const state = combine([1, 2, 3], [opRemoveEnriched([2], 5, 0)], 0);
//     const clone = undo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 5, 3]);
//   });
//   test("With remove-range from array, adds elements and decrements transaction", () => {
//     const state = combine(
//       [1, 3],
//       [opRemoveRangeEnriched([{ index: 1, length: 2 }], [2, 5], 0)],
//       0
//     );
//     const clone = undo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 5, 3]);
//   });
//   test("With replace on object, updates property and decrements transaction", () => {
//     const state = combine({ a: 3 }, [opReplaceEnriched(["a"], 2, 3, 0)], 0);
//     const clone = undo(state);
//     expect(clone).toStrictEqual(
//       combine({ a: 2 }, [opReplaceEnriched(["a"], 2, 3, 0)], -1, 1)
//     );
//   });
//   test("With replace on array, updates element and decrements transaction", () => {
//     const state = combine([1, 4, 3], [opReplaceEnriched([1], 2, 4, 0)], 0);
//     const clone = undo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
//   });
// });

// describe("redo", () => {
//   test("With add to object, adds property and increments transaction", () => {
//     const state = combine({}, [opAdd(["a"], 2, 0)], -1);
//     const clone = redo(state);
//     expect(clone).toStrictEqual(combine({ a: 2 }, [opAdd(["a"], 2, 0)], 0, 1));
//   });
//   test("With add to array, add element and increments transaction", () => {
//     const state = combine([1, 2, 3], [opAdd([2], 4, 0)], -1);
//     const clone = redo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 4, 3]);
//   });
//   test("With add-range to array, adds elements and increments transaction", () => {
//     const state = combine([1, 2, 3], [opAddRange([1], [4, 5], 0)], -1);
//     const clone = redo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 4, 5, 2, 3]);
//   });
//   test("With remove from object, removes property and increments transaction", () => {
//     const state = combine({ a: 2 }, [opRemoveEnriched(["a"], 2, 0)], -1);
//     const clone = redo(state);
//     expect(clone).toStrictEqual(
//       combine({}, [opRemoveEnriched(["a"], 2, 0)], 0, 1)
//     );
//   });
//   test("With remove from array, removes element and increments transaction", () => {
//     const state = combine([1, 2, 4, 3], [opRemoveEnriched([2], 4, 0)], -1);
//     const clone = redo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
//   });
//   test("With replace on object, updates property and increments transaction", () => {
//     const state = combine({ a: 2 }, [opReplaceEnriched(["a"], 2, 3, 0)], -1);
//     const clone = redo(state);
//     expect(clone).toStrictEqual(
//       combine({ a: 3 }, [opReplaceEnriched(["a"], 2, 3, 0)], 0, 1)
//     );
//   });
//   test("With replace on array, updates element and increments transaction", () => {
//     const state = combine([1, 2, 3], [opReplaceEnriched([1], 2, 5, 0)], -1);
//     const clone = redo(state);
//     expect(clone.slice(0)).toStrictEqual([1, 5, 3]);
//   });
// });
