import {
  opAdd,
  opAddRange,
  opReplace,
  opRemove,
  opRemoveRange,
  OpType,
} from "./optype.js";

const type = new OpType();

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

describe("invertWithDoc", () => {
  test("With add returns inverse remove", () => {
    const op = opAdd(["a", "b"], "d");
    const opInverted = type.invertWithDoc(op, {});
    expect(opInverted).toStrictEqual(opRemove(["a", "b"]));
  });
  test("With add-range returns inverse remove-range", () => {
    const op = opAddRange(["a", 1], ["c", "d"]);
    const opInverted = type.invertWithDoc(op, {});
    expect(opInverted).toStrictEqual(
      opRemoveRange(["a", { index: 1, length: 2 }])
    );
  });
  test("With replace returns inverse replace", () => {
    const doc = { a: { b: "c" } };
    const op = opReplace(["a", "b"], "d", 3);
    const opInverted = type.invertWithDoc(op, doc);
    expect(opInverted).toStrictEqual(opReplace(["a", "b"], "c", 3));
  });
  test("With remove returns inverse add", () => {
    const doc = { a: { b: "X" } };
    const op = opRemove(["a", "b"], 3);
    const inverseOp = type.invertWithDoc(op, doc);
    expect(inverseOp).toStrictEqual(opAdd(["a", "b"], "X", 3));
  });
  test("With remove-range returns inverse add", () => {
    const doc = { a: [1, 2, 3, 4] };
    const op = opRemoveRange(["a", { index: 1, length: 2 }], 3);
    const inverseOp = type.invertWithDoc(op, doc);
    expect(inverseOp).toStrictEqual(opAddRange(["a", 1], [2, 3], 3));
  });
});
