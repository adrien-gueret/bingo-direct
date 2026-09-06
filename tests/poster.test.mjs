import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const base = new URL(`../src/${name}.ts`, import.meta.url);
  const file = existsSync(base) ? base : new URL(`../src/${name}.tsx`, import.meta.url);
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) => id.startsWith("./") ? load(id.slice(2)) : require(id), module, module.exports);
  cache.set(name, module.exports);
  return module.exports;
}
const { BingoPoster } = load("BingoPoster");
const { createStarterBingo, resizeBingo } = load("data");
const noop = () => {};
const controls = { cellTriggerRefs: { current: new Map() }, draggedCellIndex: null, dropTargetIndex: null,
  handleCellClick: noop, startCellDrag: noop, allowCellDrop: noop, dropCell: noop, endCellDrag: noop, toggleCell: noop };
const captions = ["Les fans sont remerci?s pour leur amour de la s?rie", "Un challenge Zelda sur le Nintendo Switch Online", "<script>alert(1)</script>", "W".repeat(70)];
for (const locale of ["fr", "en"]) {
  for (let rows = 2; rows <= 5; rows++) for (let columns = 2; columns <= 5; columns++) {
    const bingo = resizeBingo(createStarterBingo(locale), rows, columns);
    captions.forEach((text, i) => { bingo.cells[i] = { text, image: i === 0 ? "data:image/png;base64,AAAA" : "" }; });
    const props = { bingo, locale, checked: new Set([0]) };
    const edit = renderToStaticMarkup(createElement(BingoPoster, { ...props, mode: "edit", controls }));
    const exported = renderToStaticMarkup(createElement(BingoPoster, props));
    const texts = (html) => [...html.matchAll(/class="cell-text">(.*?)<\/span>/g)].map((match) => match[1]);
    assert.deepEqual(texts(edit), texts(exported));
    assert.equal(texts(exported).length, 4);
    assert.ok(texts(exported).includes(captions[0]));
    assert.ok(texts(exported).includes(captions[1]));
    assert.ok(!exported.includes("<script>"));
    assert.equal((exported.match(/class="bingo-cell /g) || []).length, rows * columns);
    assert.ok(exported.includes("checked"));
    assert.ok(!exported.includes("edit-empty-plus"));
  }
}
console.log("Passed: shared captions, images, checked cells, empty export cells and escaping across 16 layouts and both languages.");
