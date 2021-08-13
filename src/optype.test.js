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
  OpType,
} from "./optype.js";

const type = new OpType();

describe("enrich", () => {
  test("With single replace stores previous value", () => {
    const obj = [{ a: 0 }];
    const op = opReplace([0, "a"], 1, 2, 3);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.previous).toBe(0);
  });
  test("With multiple replace stores previous values", () => {
    const obj = [{ a: 0 }, { a: 1 }];
    const op = [opReplace([0, "a"], 2, 2), opReplace([1, "a"], 3, 2)];
    const opEnriched = enrich(obj, op);
    expect(opEnriched).toStrictEqual([
      opReplaceEnriched([0, "a"], 0, 2, 2),
      opReplaceEnriched([1, "a"], 1, 3, 2),
    ]);
  });
  test("With single remove stores previous value", () => {
    const obj = [{ a: "A" }];
    const op = opRemove([0, "a"]);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.previous).toBe("A");
  });
  test("With single remove range stores previous value", () => {
    const obj = [1, 2, 3, 4];
    const op = opRemoveRange([{ index: 1, length: 2 }]);
    const opEnriched = enrich(obj, op);
    expect(opEnriched.previous).toEqual([2, 3]);
  });
});

describe("invert", () => {
  test("With add returns inverse remove", () => {
    const op = opAdd(["a", "b"], "c");
    const inverseOp = type.invert(op);
    expect(inverseOp).toStrictEqual(opRemove(["a", "b"]));
  });
  test("With add-range returns inverse remove-range", () => {
    const op = opAddRange(["a", 1], ["c", "d"]);
    const inverseOp = type.invert(op);
    expect(inverseOp).toStrictEqual(
      opRemoveRange(["a", { index: 1, length: 2 }])
    );
  });
  test("With replace returns inverse replace", () => {
    const op = opReplaceEnriched(["a", "b"], "c", "d");
    const inverseOp = type.invert(op);
    expect(inverseOp).toStrictEqual(opReplaceEnriched(["a", "b"], "d", "c"));
  });
  test("With remove returns inverse add", () => {
    const op = opRemoveEnriched(["a", "b"], "X");
    const inverseOp = type.invert(op);
    expect(inverseOp).toStrictEqual(opAdd(["a", "b"], "X"));
  });
  test("With remove-range returns inverse add", () => {
    const op = opRemoveRangeEnriched(
      ["a", { index: 1, length: 2 }],
      ["X", "Y"]
    );
    const inverseOp = type.invert(op);
    expect(inverseOp).toStrictEqual(opAddRange(["a", 1], ["X", "Y"]));
  });
  test("With move-range to right returns inverse move-range", () => {
    const op = opMoveRange(["a", [{ index: 1, length: 2 }, 4]]);
    const inverseOp = type.invert(op);
    const expectedOp = opMoveRange(["a", [{ index: 2, length: 2 }, 1]]);
    expect(inverseOp).toStrictEqual(expectedOp);
  });
  test("With move-range to left returns inverse move-range", () => {
    const op = opMoveRange(["a", [{ index: 2, length: 2 }, 1]]);
    const inverseOp = type.invert(op);
    const expectedOp = opMoveRange(["a", [{ index: 1, length: 2 }, 4]]);
    expect(inverseOp).toStrictEqual(expectedOp);
  });
});

describe("apply", () => {
  test("With none returns original object", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input);
    expect(clone).toStrictEqual(input);
  });
  test("With add to object adds property", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input, opAdd(["c"], 3));
    expect(clone).toStrictEqual({ a: 1, b: 2, c: 3 });
  });
  test("With add to nested object adds property", () => {
    const input = { a: { b: { c: 1 } }, b: 2 };
    const clone = type.apply(input, opAdd(["a", "b", "d"], 3));
    expect(clone).toStrictEqual({ a: { b: { c: 1, d: 3 } }, b: 2 });
  });
  test("With add to array inserts into array", () => {
    const input = [1, 2, 3];
    const clone = type.apply(input, opAdd([1], 4));
    expect(clone).toStrictEqual([1, 4, 2, 3]);
  });
  test("With add to nested array inserts into array", () => {
    const input = [{ a: [1, 2] }, { b: [3, 4] }];
    const clone = type.apply(input, opAdd([0, "a", 1], 5));
    expect(clone).toStrictEqual([{ a: [1, 5, 2] }, { b: [3, 4] }]);
  });
  test("With add-range to array inserts flat", () => {
    const input = [1, 2, 3];
    const clone = type.apply(input, opAddRange([1], [4, 5]));
    expect(clone).toStrictEqual([1, 4, 5, 2, 3]);
  });
  test("With replace on object replaces property", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input, opReplace(["a"], 3));
    expect(clone).toStrictEqual({ a: 3, b: 2 });
  });
  test("With replace on array changes single value", () => {
    const input = [1, 2, 3];
    const clone = type.apply(input, opReplace([1], 4));
    expect(clone).toStrictEqual([1, 4, 3]);
  });
  test("With remove on object deletes property", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input, opRemove(["a"]));
    expect(clone).toStrictEqual({ b: 2 });
  });
  test("With remove on array removes single value", () => {
    const input = [1, 2, 3];
    const clone = type.apply(input, opRemove([1]));
    expect(clone).toStrictEqual([1, 3]);
  });
  test("With remove-range from array removes multiple values", () => {
    const input = [1, 2, 3, 4, 5];
    const clone = type.apply(input, opRemoveRange([{ index: 1, length: 2 }]));
    expect(clone).toStrictEqual([1, 4, 5]);
  });
  test("With move-range to right", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const clone = type.apply(
      input,
      opMoveRange([[{ index: 1, length: 2 }, 4]])
    );
    expect(clone).toStrictEqual([1, 4, 2, 3, 5, 6]);
  });
  test("With move-range to left", () => {
    const input = [1, 4, 2, 3, 5, 6];
    const clone = type.apply(
      input,
      opMoveRange([[{ index: 2, length: 2 }, 1]])
    );
    expect(clone).toStrictEqual([1, 2, 3, 4, 5, 6]);
  });
  test("With multiple operations applies after each other", () => {
    const input = { a: 1, b: 2 };
    const clone = type.apply(input, [opReplace(["a"], 3), opReplace(["b"], 4)]);
    expect(clone).toStrictEqual({ a: 3, b: 4 });
  });
  test("With succeeding adds adds one after another", () => {
    const input = [1, 2];
    const clone = type.apply(input, [opAdd([2], 3), opAdd([3], 4)]);
    expect(clone).toStrictEqual([1, 2, 3, 4]);
  });
});