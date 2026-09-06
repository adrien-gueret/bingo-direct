import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(new URL(`../src/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) => id.startsWith("./") ? load(id.slice(2)) : require(id), module, module.exports,
  );
  cache.set(name, module.exports);
  return module.exports;
}

const { createStarterBingo, gridDimensions, resizeBingo, winningLines } = load("data");
const { initializeLibrary } = load("storage");
const legacy = createStarterBingo("fr");
delete legacy.rows;
delete legacy.columns;
legacy.cells = legacy.cells.map((_, i) => ({ text: String(i), image: "data:image/png;base64,AAAA" }));
assert.deepEqual(gridDimensions(legacy), { rows: 5, columns: 5 });
for (let rows = 2; rows <= 5; rows++) {
  for (let columns = 2; columns <= 5; columns++) {
    const resized = resizeBingo(legacy, rows, columns);
    assert.equal(resized.cells.length, rows * columns);
    resized.cells.forEach((cell, i) => assert.deepEqual(cell, legacy.cells[Math.floor(i / columns) * 5 + i % columns]));
    const expanded = resizeBingo(resized, 5, 5);
    expanded.cells.forEach((cell, i) => assert.deepEqual(cell,
      Math.floor(i / 5) < rows && i % 5 < columns ? legacy.cells[i] : { text: "", image: "" }));
    const all = new Set(resized.cells.map((_, i) => i));
    assert.equal(winningLines(all, rows, columns).length, rows + columns + (rows === columns ? 2 : 0));
    assert.deepEqual(winningLines(new Set([0, columns]), rows, columns), rows === 2 ? [[0, columns]] : []);
  }
}
assert.equal(legacy.cells.length, 25);

let persisted;
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        close() {},
        transaction() {
          return { objectStore() { return { get() {
            const getRequest = {};
            queueMicrotask(() => { getRequest.result = persisted; getRequest.onsuccess(); });
            return getRequest;
          } }; } };
        },
      };
      request.onsuccess();
    });
    return request;
  },
};
const stored = (bingo) => ({ id: "existing", bingo, createdAt: "2026-01-01", updatedAt: "2026-01-01" });
for (const bingo of [legacy, resizeBingo(legacy, 2, 5), resizeBingo(legacy, 5, 2), resizeBingo(legacy, 2, 2)]) {
  persisted = { id: "library", activeId: "existing", grids: [stored(bingo)] };
  const library = await initializeLibrary(createStarterBingo("en"));
  assert.equal(library.activeId, "existing");
  assert.deepEqual(library.grids[0].bingo, bingo);
}
for (const invalid of [{ ...legacy, rows: 1 }, { ...legacy, columns: 6 }, { ...legacy, rows: 2.5 }, { ...legacy, rows: null }, { ...legacy, cells: legacy.cells.slice(1) }]) {
  persisted = { id: "library", activeId: "existing", grids: [stored(invalid)] };
  assert.notEqual((await initializeLibrary(createStarterBingo("en"))).activeId, "existing");
}
console.log("Passed: 16 layouts, cell/image preservation, expansion, winning lines, legacy and rectangular storage, invalid data rejection.");
