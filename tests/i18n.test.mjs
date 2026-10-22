import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const corePath = fileURLToPath(new URL("lib/i18n/index.ts", root));
const ro = JSON.parse(readFileSync(new URL("lib/i18n/ro.json", root), "utf8"));
const en = JSON.parse(readFileSync(new URL("lib/i18n/en.json", root), "utf8"));
const compiled = ts.transpileModule(readFileSync(corePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function runtime(saved = null, blocked = false) {
  const storage = new Map(saved ? [["ledgerly-language", saved]] : []);
  const document = { documentElement: { lang: "en" } };
  const testModule = { exports: {} };
  runInNewContext(compiled, {
    exports: testModule.exports, module: testModule, require: createRequire(corePath), document,
    window: { localStorage: {
      getItem: key => { if (blocked) throw new Error("blocked"); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (blocked) throw new Error("blocked"); storage.set(key, value); },
    } },
  });
  return { ...testModule.exports, storage, document };
}

test("English is the default; unsupported persisted languages fall back to English", () => {
  for (const saved of [null, "fr", "RO", "invalid"]) {
    const app = runtime(saved);
    app.initializeLanguage();
    assert.equal(app.getLanguage(), "en");
    assert.equal(app.translate("Language"), "Language");
    assert.equal(app.translate("Total Anual"), "Annual total");
  }
});

test("switching updates subscribers, document language, formats and persisted preference", () => {
  const app = runtime();
  let changes = 0;
  const unsubscribe = app.subscribeLanguage(() => changes++);
  app.setLanguage("ro");
  assert.equal(changes, 1);
  assert.equal(app.document.documentElement.lang, "ro");
  assert.equal(app.storage.get("ledgerly-language"), "ro");
  assert.equal(app.translate("Language"), "Limba");
  assert.equal(new Intl.NumberFormat(app.getLocale()).format(1234.5), "1.234,5");
  assert.equal(app.translate("January"), "Ianuarie");
  app.setLanguage("en");
  assert.equal(app.translate("Settings"), "Settings");
  assert.equal(app.document.documentElement.lang, "en");
  unsubscribe();
  app.setLanguage("ro");
  assert.equal(changes, 2);
});

test("restart and cross-window updates restore the chosen language", () => {
  const app = runtime("ro");
  app.initializeLanguage();
  assert.equal(app.getLanguage(), "ro");
  app.syncLanguage("en");
  assert.equal(app.translate("Language"), "Language");
  app.syncLanguage("ro");
  assert.equal(app.translate("Language"), "Limba");
  app.syncLanguage(null);
  assert.equal(app.getLanguage(), "en");
});

test("blocked storage still allows switching for the current session", () => {
  const app = runtime(null, true);
  app.initializeLanguage();
  app.setLanguage("ro");
  assert.equal(app.translate("Settings"), "Setări");
  assert.equal(app.document.documentElement.lang, "ro");
});

test("interpolation and state messages preserve user data and can switch back", () => {
  const app = runtime("ro");
  app.initializeLanguage();
  const source = app.message('Are you sure you want to delete "{0}"? This action cannot be undone.', { 0: "Home $& {name}" });
  assert.equal(app.translateMessage(source), 'Sigur vrei să ștergi „Home $& {name}”? Această acțiune este ireversibilă.');
  assert.equal(app.translateMessage("Version 1.2.3 is available."), "Versiunea 1.2.3 este disponibilă.");
  assert.equal(app.translateMessage("Subgroup with cod 'ABC' already exists"), "Subgrupa cu codul „ABC” există deja");
  assert.equal(app.translate("{count} rows", { count: 12 }), "12 rânduri");
  assert.equal(app.translateMessage("custom technical diagnostic"), "custom technical diagnostic");
  app.setLanguage("en");
  assert.equal(app.translateMessage(source), source);
});

test("catalog translations preserve every interpolation placeholder", () => {
  const tokens = text => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const catalog of [ro, en]) {
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(value.trim(), `Empty translation: ${key}`);
      assert.deepEqual(tokens(value), tokens(key), `Mismatched placeholders: ${key}`);
    }
  }
});

test("every literal used with the translator has a Romanian translation", () => {
  const missing = [];
  for (const folder of ["app", "components", "lib"]) {
    const base = new URL(`${folder}/`, root);
    for (const name of readdirSync(base, { recursive: true }).filter(name => /\.tsx?$/.test(name))) {
      const source = ts.createSourceFile(name, readFileSync(new URL(name, base), "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isCallExpression(node) && ["translate", "translateMessage"].includes(node.expression.getText(source))) {
          const key = node.arguments[0];
          if (key && ts.isStringLiteral(key) && !Object.hasOwn(ro, key.text)) missing.push(`${folder}/${name}: ${key.text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  assert.deepEqual(missing, []);
});

test("query previews translate prose while keeping data columns and filter values intact", () => {
  const app = runtime("ro");
  app.initializeLanguage();
  const file = fileURLToPath(new URL("lib/query-preview.ts", root));
  const testModule = { exports: {} };
  const require = specifier => {
    if (specifier === "@/lib/i18n") return app;
    return createRequire(file)(specifier);
  };
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: testModule.exports, module: testModule, require });
  const { buildQueryPreview, getOperatorsForType } = testModule.exports;
  const query = {
    displayColumns: ["Home"], groupBy: [], calculations: [],
    filters: [{ column: "Home", operator: "contains", value: "Settings" }],
    sortBy: [{ column: "Home", descending: true }], limit: 1000,
  };
  const original = JSON.stringify(query);
  assert.equal(buildQueryPreview(query, []), "Afișează, Home, unde Home conține Settings, sortat după Home (descrescător), limitat la 1.000 rânduri.");
  assert.equal(getOperatorsForType("text")[2].value, "contains");
  assert.equal(JSON.stringify(query), original);
  app.setLanguage("en");
  assert.match(buildQueryPreview(query, []), /^Show, Home, where Home contains Settings/);
});
