import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const code = ts.transpileModule(readFileSync(new URL(`../src/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) => id.startsWith("./") ? load(id.slice(2)) : require(id), module, module.exports,
  );
  cache.set(name, module.exports);
  return module.exports;
}

const { createStarterBingo, resizeBingo } = load("data");
const { createStoredBingo, isChecked, saveLibrary, initializeLibrary } = load("storage");
const { serializeGrids, parseGrids, MAX_IMPORT_BYTES } = load("grid-transfer");
const { emptyHistory, recordEdit, travelHistory } = load("grid-history");
const original = createStoredBingo(createStarterBingo("fr"));
original.bingo.cells[0] = { text: "Mario !", image: "data:image/png;base64,AAAA" };
original.bingo.cells[24] = { text: "Zelda", image: "" };
original.checked = [0, 24];

const restored = parseGrids(serializeGrids([original]))[0];
assert.deepEqual(restored.bingo, original.bingo);
assert.deepEqual(restored.checked, [0, 24]);
assert.notEqual(restored.id, original.id);
assert.notEqual(parseGrids(serializeGrids([original]))[0].id, restored.id);
const legacy = structuredClone(original);
delete legacy.bingo.rows;
delete legacy.bingo.columns;
delete legacy.checked;
assert.deepEqual(parseGrids(serializeGrids([legacy]))[0].checked, []);
assert.equal(parseGrids(serializeGrids([legacy]))[0].bingo.rows, 5);
assert.equal(parseGrids(serializeGrids([original, restored])).length, 2);
const envelope = JSON.parse(serializeGrids([original]));
for (const invalid of [null, {}, { ...envelope, version: 2 }, { ...envelope, grids: [] },
  { ...envelope, grids: [...envelope.grids, { bingo: {} }] },
  { ...envelope, grids: Array(201).fill(envelope.grids[0]) }]) {
  assert.throws(() => parseGrids(JSON.stringify(invalid)));
}
for (const checked of [[25], [-1], [0, 0], [0.5], [1], ["0"], null]) {
  assert.equal(isChecked(checked, original.bingo), false);
  assert.throws(() => parseGrids(JSON.stringify({ ...envelope, grids: [{ bingo: original.bingo, checked }] })));
}
for (const patch of [{ rows: 1 }, { cells: [] }, { title: "X".repeat(37) },
  { cells: original.bingo.cells.map(() => ({ text: "", image: "https://example.com/image.png" })) }]) {
  assert.throws(() => parseGrids(JSON.stringify({ ...envelope, grids: [{ bingo: { ...original.bingo, ...patch } }] })));
}
assert.throws(() => parseGrids("not json"));
assert.throws(() => parseGrids(" ".repeat(MAX_IMPORT_BYTES + 1)));

let history = recordEdit(emptyHistory(), original, "title", 1000);
const renamed = { ...original, bingo: { ...original.bingo, title: "Changed" } };
history = recordEdit(history, renamed, "title", 1200);
assert.equal(history.past.length, 1, "Typing is grouped");
history = recordEdit(history, renamed, "title", 2200);
assert.equal(history.past.length, 2, "A pause starts a new history entry");
const reduced = { ...renamed, bingo: resizeBingo(renamed.bingo, 2, 2), checked: [0] };
history = recordEdit(history, renamed, undefined, 2300);
const undone = travelHistory(history, reduced, "undo");
assert.deepEqual(undone.grid.bingo, renamed.bingo);
assert.deepEqual(undone.grid.checked, [0], "Undo preserves current check progress");
const redone = travelHistory(undone.history, undone.grid, "redo");
assert.deepEqual(redone.grid.bingo, reduced.bingo);
assert.deepEqual(redone.grid.checked, [0]);
const unchecked = travelHistory(history, { ...reduced, checked: [] }, "undo");
assert.deepEqual(unchecked.grid.checked, [], "Undo does not restore earlier check progress");
assert.equal(recordEdit(undone.history, undone.grid, undefined, 2400).future.length, 0);
assert.equal(travelHistory(emptyHistory(), original, "undo"), null);
for (let i = 0; i < 60; i++) history = recordEdit(history, original, undefined, i * 1000);
assert.equal(history.past.length, 50);

// Exercise queued writes and reading old/new libraries through the storage API.
let persisted;
let openCount = 0;
globalThis.indexedDB = { open() {
  const request = {};
  setTimeout(() => {
    request.result = {
      close() {},
      transaction(_store, mode) {
        const transaction = { objectStore() { return {
          put(value) {
            persisted = structuredClone(value);
            setTimeout(() => transaction.oncomplete(), 0);
          },
          get() {
            const result = {};
            queueMicrotask(() => { result.result = persisted; result.onsuccess(); });
            return result;
          },
        }; } };
        assert.ok(mode === "readonly" || mode === "readwrite");
        return transaction;
      },
    };
    request.onsuccess();
  }, openCount++ === 0 ? 20 : 0);
  return request;
} };
await Promise.all([saveLibrary([original], original.id), saveLibrary([restored], restored.id)]);
const library = await initializeLibrary(createStarterBingo("en"));
assert.equal(library.activeId, restored.id, "Last requested save wins");
assert.deepEqual(library.grids[0].checked, [0, 24]);
await saveLibrary([legacy], legacy.id);
assert.equal((await initializeLibrary(createStarterBingo("en"))).activeId, legacy.id);
console.log("Passed: progress persistence, legacy grids, ordered saves, import/export round trips and invalid files, grouped undo/redo independent from check progress.");
