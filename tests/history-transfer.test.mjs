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
original.bingo.cells[0] = { text: "Mario !", image: "data:image/png;base64,AAAA", imageLayout: "above", imageFit: "contain", imagePosition: { x: 10, y: 90 } };
original.bingo.cells[1] = { text: "", image: "data:image/png;base64,AAAA", imageLayout: "background", imageFit: "cover" };
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
delete legacy.bingo.cells[0].imageLayout;
delete legacy.bingo.cells[1].imageLayout;
delete legacy.bingo.cells[0].imageFit;
delete legacy.bingo.cells[1].imageFit;
delete legacy.bingo.cells[0].imagePosition;
assert.deepEqual(parseGrids(serializeGrids([legacy]))[0].checked, []);
assert.equal(parseGrids(serializeGrids([legacy]))[0].bingo.rows, 5);
assert.equal(parseGrids(serializeGrids([legacy]))[0].bingo.cells[0].imageLayout, undefined);
assert.equal(parseGrids(serializeGrids([legacy]))[0].bingo.cells[0].imageFit, undefined);
assert.equal(parseGrids(serializeGrids([legacy]))[0].bingo.cells[0].imagePosition, undefined);
assert.equal(parseGrids(serializeGrids([original, restored])).length, 2);
const envelope = JSON.parse(serializeGrids([original]));
for (const invalid of [null, {}, { ...envelope, version: 2 }, { ...envelope, grids: [] },
  { ...envelope, grids: [...envelope.grids, { bingo: {} }] },
  { ...envelope, grids: Array(201).fill(envelope.grids[0]) }]) {
  assert.throws(() => parseGrids(JSON.stringify(invalid)));
}
for (const checked of [[25], [-1], [0, 0], [0.5], [2], ["0"], null]) {
  assert.equal(isChecked(checked, original.bingo), false);
  assert.throws(() => parseGrids(JSON.stringify({ ...envelope, grids: [{ bingo: original.bingo, checked }] })));
}
for (const patch of [{ rows: 1 }, { cells: [] }, { title: "X".repeat(37) },
  { cells: original.bingo.cells.map(() => ({ text: "", image: "https://example.com/image.png" })) }]) {
  assert.throws(() => parseGrids(JSON.stringify({ ...envelope, grids: [{ bingo: { ...original.bingo, ...patch } }] })));
}
for (const imageLayout of [null, "sideways", 1, {}]) {
  const invalid = structuredClone(original);
  invalid.bingo.cells[0].imageLayout = imageLayout;
  assert.throws(() => parseGrids(serializeGrids([invalid])));
}
for (const imageFit of [null, "stretch", 1, {}]) {
  const invalid = structuredClone(original);
  invalid.bingo.cells[0].imageFit = imageFit;
  assert.throws(() => parseGrids(serializeGrids([invalid])));
}
for (const imagePosition of [null, {}, { x: 50 }, { x: "50", y: 50 }, { x: -1, y: 50 }, { x: 50, y: 101 }, { x: Infinity, y: 50 }]) {
  const invalid = structuredClone(original);
  invalid.bingo.cells[0].imagePosition = imagePosition;
  assert.throws(() => parseGrids(serializeGrids([invalid])));
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
const changedLayout = structuredClone(original);
changedLayout.bingo.cells[0].imageLayout = "background";
changedLayout.bingo.cells[0].imageFit = "cover";
changedLayout.bingo.cells[0].imagePosition = { x: 50, y: 50 };
const layoutUndo = travelHistory(recordEdit(emptyHistory(), original, undefined, 3000), changedLayout, "undo");
assert.equal(layoutUndo.grid.bingo.cells[0].imageLayout, "above");
assert.equal(layoutUndo.grid.bingo.cells[0].imageFit, "contain");
assert.deepEqual(layoutUndo.grid.bingo.cells[0].imagePosition, { x: 10, y: 90 });
const layoutRedo = travelHistory(layoutUndo.history, layoutUndo.grid, "redo");
assert.equal(layoutRedo.grid.bingo.cells[0].imageLayout, "background");
assert.equal(layoutRedo.grid.bingo.cells[0].imageFit, "cover");
assert.deepEqual(layoutRedo.grid.bingo.cells[0].imagePosition, { x: 50, y: 50 });
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
assert.equal(library.grids[0].bingo.cells[0].imageLayout, "above");
assert.equal(library.grids[0].bingo.cells[0].imageFit, "contain");
assert.deepEqual(library.grids[0].bingo.cells[0].imagePosition, { x: 10, y: 90 });
await saveLibrary([legacy], legacy.id);
assert.equal((await initializeLibrary(createStarterBingo("en"))).activeId, legacy.id);
legacy.preview = "previously-saved-thumbnail";
await saveLibrary([legacy, original], legacy.id);
const mixedLibrary = await initializeLibrary(createStarterBingo("en"));
assert.equal(mixedLibrary.activeId, legacy.id);
assert.deepEqual(mixedLibrary.grids, [legacy, original], "Old and new grids, metadata, thumbnails and checkmarks survive loading together unchanged");
console.log("Passed: progress persistence, legacy grids, ordered saves, import/export round trips and invalid files, grouped undo/redo independent from check progress.");
