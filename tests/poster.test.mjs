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
const { BingoPoster, BingoCellPreview } = load("BingoPoster");
const { createStarterBingo, resizeBingo } = load("data");
const { imageOverflow, moveImagePosition } = load("image-position");
const noop = () => {};
const controls = { cellTriggerRefs: { current: new Map() }, draggedCellIndex: null, dropTargetIndex: null,
  handleCellClick: noop, startCellDrag: noop, allowCellDrop: noop, dropCell: noop, endCellDrag: noop, toggleCell: noop };
const captions = ["Les fans sont remerci?s\npour leur amour de la s?rie", "Un challenge Zelda sur le Nintendo Switch Online", "<script>alert(1)</script>", "W".repeat(70)];
for (const locale of ["fr", "en"]) {
  for (let rows = 2; rows <= 5; rows++) for (let columns = 2; columns <= 5; columns++) {
    const bingo = resizeBingo(createStarterBingo(locale), rows, columns);
    captions.forEach((text, i) => { bingo.cells[i] = { text, image: i === 0 ? "data:image/png;base64,AAAA" : "" }; });
    const props = { bingo, locale, checked: new Set([0]) };
    const edit = renderToStaticMarkup(createElement(BingoPoster, { ...props, mode: "edit", controls }));
    const exported = renderToStaticMarkup(createElement(BingoPoster, props));
    const texts = (html) => [...html.matchAll(/class="cell-text">([\s\S]*?)<\/span>/g)].map((match) => match[1]);
    assert.deepEqual(texts(edit), texts(exported));
    assert.equal(texts(exported).length, 4);
    assert.ok(texts(exported).includes(captions[0]));
    assert.ok(exported.includes("remerci?s\npour"));
    assert.ok(texts(exported).includes(captions[1]));
    assert.ok(!exported.includes("<script>"));
    assert.equal((exported.match(/class="bingo-cell /g) || []).length, rows * columns);
    assert.ok(exported.includes("checked"));
    assert.ok(!exported.includes("edit-empty-plus"));
  }
}
for (const imageFit of [undefined, "cover", "contain"]) {
  for (const imageLayout of [undefined, "background", "above"]) {
    for (const text of ["", " \n ", "Une belle surprise"]) {
      const bingo = createStarterBingo("fr");
      const cell = { text, image: "data:image/png;base64,AAAA", imageFit, imageLayout };
      bingo.cells[0] = cell;
      const props = { bingo, locale: "fr", checked: new Set() };
      const versions = [
        renderToStaticMarkup(createElement(BingoCellPreview, { ...props, cell })),
        renderToStaticMarkup(createElement(BingoPoster, { ...props, mode: "edit", controls })),
        renderToStaticMarkup(createElement(BingoPoster, props)),
      ];
      for (const html of versions) {
        assert.ok(html.includes(`object-fit:${imageFit ?? "cover"}`));
        assert.ok(html.includes("object-position:50% 50%"), "Existing images remain centered");
        assert.equal(html.includes("image-above"), Boolean(text.trim() && imageLayout === "above"));
        assert.equal(html.includes('class="cell-text"'), Boolean(text.trim()));
      }
      const imageTag = (html) => html.match(/<img[^>]+>/)?.[0];
      assert.equal(imageTag(versions[0]), imageTag(versions[1]));
      assert.equal(imageTag(versions[1]), imageTag(versions[2]));
    }
  }
}
for (const imageFit of ["cover", "contain"]) {
  const bingo = createStarterBingo("fr");
  bingo.cells[0] = { text: "Cadrage", image: "data:image/png;base64,AAAA", imageFit, imagePosition: { x: 20, y: 80 } };
  const props = { bingo, locale: "fr", checked: new Set() };
  for (const html of [renderToStaticMarkup(createElement(BingoPoster, props)), renderToStaticMarkup(createElement(BingoPoster, { ...props, mode: "edit", controls })), renderToStaticMarkup(createElement(BingoCellPreview, { ...props, cell: bingo.cells[0] }))]) {
    assert.ok(html.includes(imageFit === "cover" ? "object-position:20% 80%" : "object-position:50% 50%"));
  }
}
const center = { x: 50, y: 50 };
assert.deepEqual(imageOverflow(400, 200, 100, 100), { x: 100, y: 0 });
assert.deepEqual(imageOverflow(200, 400, 100, 100), { x: 0, y: 100 });
assert.deepEqual(imageOverflow(0, 0, 100, 100), { x: 0, y: 0 });
assert.deepEqual(moveImagePosition(center, 20, 40, { x: 100, y: 0 }), { x: 30, y: 50 }, "Drag follows the pointer and ignores uncropped axes");
assert.deepEqual(moveImagePosition(center, 20, 40, { x: 0, y: 100 }), { x: 50, y: 10 });
assert.deepEqual(moveImagePosition(center, 200, -200, { x: 100, y: 100 }), { x: 0, y: 100 }, "Movement never exposes empty space");
assert.deepEqual(moveImagePosition(center, 10, 0, imageOverflow(400, 200, 50, 50)), moveImagePosition(center, 20, 0, imageOverflow(400, 200, 100, 100)), "Position is independent of preview scale");
console.log("Passed: captions across 16 layouts and both languages; framing and positioning match in preview, grid and export; drag direction, bounds and scaling.");
