import { Patcher, combine, emptyHistory, createHistory } from "./index.js";
import { OpType } from "./optype.js";

const type = new OpType();
const patcher = new Patcher(type);

describe("canMergeOp", () => {
  test("With no last operations returns false", () => {
    const history = emptyHistory();
    const transaction = -1;
    const operation = type.replaceOp(["a"], 0, 1);
    const canMerge = patcher.canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation not being replace returns false", () => {
    const history = createHistory([type.insertOp(["a", "value"], "b", 0)]);
    const transaction = 0;
    const operation = type.replaceOp(["a"], 0, 1);
    const canMerge = patcher.canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With last operation path not equal returns false", () => {
    const history = createHistory([type.replaceOp(["b"], 1, 0)]);
    const transaction = 0;
    const operation = type.replaceOp(["a"], 0, 1);
    const canMerge = patcher.canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With two operations returns false", () => {
    const history = createHistory([type.replaceOp(["b"], 1, 0)]);
    const transaction = 0;
    const operation = [
      type.replaceOp(["a"], 0, 1),
      type.replaceOp(["b"], 0, 1),
    ];
    const canMerge = patcher.canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(false);
  });
  test("With replace on same path and single op returns true", () => {
    const history = createHistory([type.replaceOp(["b", "c"], 1, 0)]);
    const transaction = 0;
    const operation = type.replaceOp(["b", "c"], 2, 0);
    const canMerge = patcher.canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
  test("With replace on same path in array and single op returns true", () => {
    const history = createHistory([type.replaceOp(["b", "c"], 1)]);
    const transaction = 0;
    const operation = [type.replaceOp(["b", "c"], 2)];
    const canMerge = patcher.canMergeOp(history, transaction, operation);
    expect(canMerge).toBe(true);
  });
});

describe("mergeLastOp", () => {
  test("With last operation merge-able, overwrites value", () => {
    const state = { a: { b: 1 } };
    const history = createHistory(
      [type.replaceOp(["a", "b"], 1)],
      [type.replaceOp(["a", "b"], 0)]
    );
    const operation = type.replaceOp(["a", "b"], 2);
    const mergedHistory = patcher.mergeLastOp(state, history, operation, false);
    expect(mergedHistory).toStrictEqual(
      createHistory(
        [type.replaceOp(["a", "b"], 2)],
        [type.replaceOp(["a", "b"], 0)]
      )
    );
  });
});

describe("discardFutureOps", () => {
  test("With history removes operations from the future", () => {
    const history = createHistory(
      [
        type.replaceOp(["a", "b"], 1),
        type.replaceOp(["a", "b"], 2),
        type.replaceOp(["a", "b"], 3),
      ],
      [
        type.replaceOp(["a", "b"], 0),
        type.replaceOp(["a", "b"], 0),
        type.replaceOp(["a", "b"], 0),
      ]
    );
    const newHistory = patcher.discardFutureOps(history, 1);
    expect(newHistory).toStrictEqual(
      createHistory([history.ops[0]], [history.opsInverted[0]])
    );
  });
});

describe("patch", () => {
  test("With add to object, starts transaction, adds to history, adds property", () => {
    const state = {};
    const op = type.insertOp(["a"], 2);
    const clone = patcher.patch(state, op);
    expect(clone).toStrictEqual(
      combine(
        { a: 2 },
        createHistory([type.insertOp(["a"], 2, 0)], [type.removeOp(["a"], 0)]),
        0,
        1
      )
    );
  });
  test("With add to array, starts transaction, adds to history, adds element", () => {
    const state = [1, 2, 3];
    const op = type.insertOp([1], 5);
    const clone = patcher.patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 5, 2, 3]);
    expect(clone.history.ops.length).toBe(1);
    expect(clone.history.opsInverted.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  test("With add-range to array, starts transaction, adds to history, adds elements", () => {
    const state = [1, 2, 3];
    const op = type.insertRangeOp([1], [4, 5]);
    const clone = patcher.patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 4, 5, 2, 3]);
    expect(clone.history.ops.length).toBe(1);
    expect(clone.history.opsInverted.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  test("With remove from object, starts transaction, adds to history, removes property", () => {
    const state = { a: 2 };
    const op = type.removeOp(["a"]);
    const clone = patcher.patch(state, op);
    expect(clone).toStrictEqual(
      combine(
        {},
        createHistory([type.removeOp(["a"], 0)], [type.insertOp(["a"], 2, 0)]),
        0,
        1
      )
    );
  });
  test("With remove from array, starts transaction, adds to history, removes element", () => {
    const state = [1, 2, 5, 3];
    const op = type.removeOp([2]);
    const clone = patcher.patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
    expect(clone.history.ops.length).toBe(1);
    expect(clone.history.opsInverted.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  test("With remove-range from array, starts transaction, adds to history, removes elements", () => {
    const state = [1, 2, 5, 3];
    const op = type.removeRangeOp([{ index: 1, length: 2 }]);
    const clone = patcher.patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 3]);
    expect(clone.history.ops.length).toBe(1);
    expect(clone.history.opsInverted.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  // TODO This case is not implemented yet and differs from JSON patch RFC
  // test("With replace on object empty, starts transaction, adds to history, creates property", () => {
  //   const state = { };
  //   const op = type.replaceOp(["a"], 3);
  //   const clone = patch(state, op);
  //   expect(clone).toStrictEqual({
  //     a: 3,
  //     history: [opReplaceEnriched(["a"], undefined, 3, 0)],
  //     transaction: 0,
  //   });
  // });
  test("With replace on object, starts transaction, adds to history, updates property", () => {
    const state = { a: 2 };
    const op = type.replaceOp(["a"], 3);
    const clone = patcher.patch(state, op);
    expect(clone).toStrictEqual(
      combine(
        { a: 3 },
        createHistory(
          [type.replaceOp(["a"], 3, 0)],
          [type.replaceOp(["a"], 2, 0)]
        ),
        0,
        1
      )
    );
  });
  test("With replace on array, starts transaction, adds to history, updates element", () => {
    const state = [1, 2, 5, 3];
    const op = type.replaceOp([2], 4);
    const clone = patcher.patch(state, op);
    expect(clone.slice(0)).toStrictEqual([1, 2, 4, 3]);
    expect(clone.history.ops.length).toBe(1);
    expect(clone.history.opsInverted.length).toBe(1);
    expect(clone.transaction).toBe(0);
  });
  test("With two sets, increments version", () => {
    const clone = patcher.patch({}, [
      type.insertOp(["a"], 2),
      type.insertOp(["a"], 2),
    ]);
    expect(clone.version).toBe(1);
  });
});

describe("undo", () => {
  test("With add to object, removes property and decrements transaction", () => {
    const history = createHistory(
      [type.insertOp(["a"], 2, 0)],
      [type.removeOp(["a"], 0)]
    );
    const state = combine({ a: 2 }, history, 0);
    const clone = patcher.undo(state);
    expect(clone).toStrictEqual(combine({}, history, -1, 1));
  });
  test("With add to array, removes element and decrements transaction", () => {
    const history = createHistory(
      [type.insertOp([2], 5, 0)],
      [type.removeOp([2], 0)]
    );
    const state = combine([1, 2, 5, 3], history, 0);
    const clone = patcher.undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
  });
  test("With add-range to array,removes elements and decrements transaction", () => {
    const history = createHistory(
      [type.insertRangeOp([1], [4, 5], 0)],
      [type.removeRangeOp([{ index: 1, length: 2 }], 0)]
    );
    const state = combine([1, 4, 5, 2, 3], history, 0);
    const clone = patcher.undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
  });
  test("With remove from object, adds property and decrements transaction", () => {
    const history = createHistory(
      [type.removeOp(["a"], 0)],
      [type.insertOp(["a"], 2, 0)]
    );
    const state = combine({}, history, 0);
    const clone = patcher.undo(state);
    expect(clone).toStrictEqual(combine({ a: 2 }, history, -1, 1));
  });
  test("With remove from array, adds element and decrements transaction", () => {
    const history = createHistory(
      [type.removeOp([2], 0)],
      [type.insertOp([2], 5, 0)]
    );
    const state = combine([1, 2, 3], history, 0);
    const clone = patcher.undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 5, 3]);
  });
  test("With remove-range from array, adds elements and decrements transaction", () => {
    const history = createHistory(
      [type.removeRangeOp([{ index: 1, length: 2 }], 0)],
      [type.insertRangeOp([1], [2, 5], 0)]
    );
    const state = combine([1, 3], history, 0);
    const clone = patcher.undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 5, 3]);
  });
  test("With replace on object, updates property and decrements transaction", () => {
    const history = createHistory(
      [type.replaceOp(["a"], 3, 0)],
      [type.replaceOp(["a"], 2, 0)]
    );
    const state = combine({ a: 3 }, history, 0);
    const clone = patcher.undo(state);
    expect(clone).toStrictEqual(combine({ a: 2 }, history, -1, 1));
  });
  test("With replace on array, updates element and decrements transaction", () => {
    const history = createHistory(
      [type.replaceOp([1], 4, 0)],
      [type.replaceOp([1], 2, 0)]
    );
    const state = combine([1, 4, 3], history, 0);
    const clone = patcher.undo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
  });
});

describe("redo", () => {
  test("With add to object, adds property and increments transaction", () => {
    const history = createHistory(
      [type.insertOp(["a"], 2, 0)],
      [type.removeOp(["a"], 0)]
    );
    const state = combine({}, history, -1);
    const clone = patcher.redo(state);
    expect(clone).toStrictEqual(combine({ a: 2 }, history, 0, 1));
  });
  test("With add to array, add element and increments transaction", () => {
    const history = createHistory(
      [type.insertOp([2], 4, 0)],
      [type.removeOp([2], 0)]
    );
    const state = combine([1, 2, 3], history, -1);
    const clone = patcher.redo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 4, 3]);
  });
  test("With add-range to array, adds elements and increments transaction", () => {
    const history = createHistory(
      [type.insertRangeOp([1], [4, 5], 0)],
      [type.removeRangeOp([{ index: 1, length: 2 }], 0)]
    );
    const state = combine([1, 2, 3], history, -1);
    const clone = patcher.redo(state);
    expect(clone.slice(0)).toStrictEqual([1, 4, 5, 2, 3]);
  });
  test("With remove from object, removes property and increments transaction", () => {
    const history = createHistory(
      [type.removeOp(["a"], 0)],
      [type.insertOp(["a"], 2, 0)]
    );
    const state = combine({ a: 2 }, history, -1);
    const clone = patcher.redo(state);
    expect(clone).toStrictEqual(combine({}, history, 0, 1));
  });
  test("With remove from array, removes element and increments transaction", () => {
    const history = createHistory(
      [type.removeOp([2], 0)],
      [type.insertOp([2], 4, 0)]
    );
    const state = combine([1, 2, 4, 3], history, -1);
    const clone = patcher.redo(state);
    expect(clone.slice(0)).toStrictEqual([1, 2, 3]);
  });
  test("With replace on object, updates property and increments transaction", () => {
    const history = createHistory(
      [type.replaceOp(["a"], 3, 0)],
      [type.replaceOp(["a"], 2, 0)]
    );
    const state = combine({ a: 2 }, history, -1);
    const clone = patcher.redo(state);
    expect(clone).toStrictEqual(combine({ a: 3 }, history, 0, 1));
  });
  test("With replace on array, updates element and increments transaction", () => {
    const history = createHistory(
      [type.replaceOp([1], 5, 0)],
      [type.replaceOp([1], 2, 0)]
    );
    const state = combine([1, 2, 3], history, -1);
    const clone = patcher.redo(state);
    expect(clone.slice(0)).toStrictEqual([1, 5, 3]);
  });
});
