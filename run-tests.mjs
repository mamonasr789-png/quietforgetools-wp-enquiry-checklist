/**
 * Logic tests for WP Enquiry Checklist (node, no browser).
 * Loads app.js after a minimal DOM stub + window.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSrc = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");

let passed = 0;
let failed = 0;
const results = [];

function assert(name, cond, detail) {
  if (cond) {
    passed++;
    results.push({ name, ok: true });
    console.log("PASS:", name);
  } else {
    failed++;
    results.push({ name, ok: false, detail });
    console.log("FAIL:", name, detail || "");
  }
}

// Minimal DOM stub sufficient for app.js init + logic API
function createEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); }
    },
    attributes: {},
    _listeners: {},
    hidden: false,
    disabled: false,
    textContent: "",
    innerHTML: "",
    checked: false,
    type: "",
    name: "",
    value: "",
    id: "",
    setAttribute(k, v) { this.attributes[k] = v; if (k === "id") this.id = v; },
    getAttribute(k) { return this.attributes[k]; },
    appendChild(c) { this.children.push(c); return c; },
    querySelectorAll(sel) {
      // naive: collect from subtree by walking children + self if matching input
      const out = [];
      const walk = (node) => {
        if (!node) return;
        if (sel.startsWith(".") && node.classList && node.classList.contains(sel.slice(1))) out.push(node);
        if (sel === 'input[type="radio"]' && node.tagName === "INPUT" && node.type === "radio") out.push(node);
        if (sel === ".state-opt" && node.classList && node.classList.contains("state-opt")) out.push(node);
        if (sel === "input" && node.tagName === "INPUT") out.push(node);
        (node.children || []).forEach(walk);
        // also parse innerHTML-created? we won't — generate uses fillList with createElement
      };
      walk(this);
      // also search globally for radios when called on listEl after buildChecklist sets innerHTML — handled below
      return out;
    },
    querySelector(sel) {
      const all = this.querySelectorAll(sel);
      return all[0] || null;
    },
    closest() { return this._checkItem || null; },
    addEventListener(ev, fn) {
      this._listeners[ev] = this._listeners[ev] || [];
      this._listeners[ev].push(fn);
    },
    scrollIntoView() {}
  };
  return el;
}

const elements = {};
["checks-list","results","failed-list","unsure-list","failed-empty","unsure-empty",
 "recommendation","report-text","copy-status","service-hint",
 "btn-generate","btn-copy","btn-reset","svc-149","svc-59","svc-49"].forEach((id) => {
  elements[id] = createEl(id === "btn-generate" || id === "btn-copy" || id === "btn-reset" ? "button" : "div");
  elements[id].id = id;
});
elements["btn-copy"].disabled = true;
elements["results"].hidden = true;

const documentStub = {
  getElementById(id) { return elements[id] || null; },
  createElement(tag) { return createEl(tag); },
  createRange() { return { selectNodeContents() {} }; }
};

const windowStub = {
  WPEnquiryChecklist: null,
  scrollTo() {},
  getSelection() { return { removeAllRanges() {}, addRange() {} }; }
};

const sandbox = {
  window: windowStub,
  document: documentStub,
  navigator: { clipboard: null },
  console,
  Date,
  Object,
  String,
  Array,
  setTimeout,
  clearTimeout
};
sandbox.window.document = documentStub;
sandbox.globalThis = sandbox;

vm.runInNewContext(appSrc, sandbox);

const API = sandbox.window.WPEnquiryChecklist;
assert("API exposed", !!API && API.CHECKS.length === 12);

function markAll(stateMapOrFn) {
  API.resetAll();
  for (const c of API.CHECKS) {
    const v = typeof stateMapOrFn === "function" ? stateMapOrFn(c) : stateMapOrFn;
    API.setAnswer(c.id, v);
  }
}

// Test 1: all PASS
markAll("pass");
API.generate();
{
  const failed = API.collectByState("fail");
  const unsure = API.collectByState("unsure");
  const rec = API.recommendCategory(failed, unsure);
  const report = API.buildReport(failed, unsure, rec);
  assert("1 all PASS — no fail/unsure", failed.length === 0 && unsure.length === 0);
  assert("1 all PASS — report contains PASS", report.includes("[PASS]") && !report.includes("[FAIL]"));
}

// Test 2: multiple FAIL
markAll((c) => (["form-submits","notification-email","smtp-configured"].includes(c.id) ? "fail" : "pass"));
{
  const failed = API.collectByState("fail");
  const unsure = API.collectByState("unsure");
  const rec = API.recommendCategory(failed, unsure);
  assert("2 multiple FAIL — 3 fails", failed.length === 3);
  assert("2 multiple FAIL — highlight 149", rec.highlight === "149");
}

// Test 3: NOT SURE
markAll((c) => (["spam-junk","crm-inbox"].includes(c.id) ? "unsure" : "pass"));
{
  const failed = API.collectByState("fail");
  const unsure = API.collectByState("unsure");
  const rec = API.recommendCategory(failed, unsure);
  assert("3 NOT SURE — 2 unsure 0 fail", unsure.length === 2 && failed.length === 0);
  assert("3 NOT SURE — no hard pitch", rec.highlight === null);
}

// Test 4: N/A
markAll((c) => (c.id === "crm-inbox" ? "na" : "pass"));
{
  const na = API.CHECKS.filter((c) => API.getAnswers()[c.id] === "na");
  assert("4 N/A — one na", na.length === 1 && API.getAnswers()["crm-inbox"] === "na");
  const failed = API.collectByState("fail");
  const unsure = API.collectByState("unsure");
  const rec = API.recommendCategory(failed, unsure);
  const report = API.buildReport(failed, unsure, rec);
  assert("4 N/A — report shows NOT APPLICABLE", report.includes("[NOT APPLICABLE]"));
}

// Test 5: mixed
markAll((c) => {
  if (c.id === "form-submits") return "fail";
  if (c.id === "smtp-configured") return "unsure";
  if (c.id === "crm-inbox") return "na";
  if (c.id === "backup-exists") return "fail";
  return "pass";
});
{
  const failed = API.collectByState("fail");
  const unsure = API.collectByState("unsure");
  assert("5 mixed — fail+unsure+na", failed.length === 2 && unsure.length === 1 && API.getAnswers()["crm-inbox"] === "na");
  const rec = API.recommendCategory(failed, unsure);
  assert("5 mixed — has recommendation text", typeof rec.text === "string" && rec.text.length > 20);
}

// Test 6: copy report — buildReport produces non-empty; clipboard API optional
markAll("pass");
{
  const failed = API.collectByState("fail");
  const unsure = API.collectByState("unsure");
  const rec = API.recommendCategory(failed, unsure);
  const report = API.buildReport(failed, unsure, rec);
  assert("6 copy report — report non-empty with header", report.includes("QuietForgeTools") && report.includes("=== FAILED ==="));
  // Simulate generate storing last report
  API.generate();
  assert("6 copy report — getLastReport after generate", API.getLastReport().length > 50);
}

// Test 7: reset
markAll("fail");
API.resetAll();
assert("7 reset — answers cleared", Object.keys(API.getAnswers()).length === 0);
assert("7 reset — unanswered 12", API.unansweredCount() === 12);

// Test 8: mobile layout — CSS media queries
assert("8 mobile layout — max-width 480 media query", css.includes("@media (max-width: 480px)"));
assert("8 mobile layout — min-height touch targets in CSS", css.includes("min-height: 40px") || css.includes("min-height: 44px"));

// Test 9: paid-service links in HTML
assert("9 paid link £49", html.includes("quietforgetools-wp-maintenance/quick-fix/"));
assert("9 paid link £59", html.includes("quietforgetools-wp-maintenance/") && html.includes("£59"));
assert("9 paid link £149", html.includes("quietforgetools-enquiry-repair/") && html.includes("£149"));

// Test 10: no persistence
const noPersist =
  !/localStorage/.test(appSrc) &&
  !/sessionStorage/.test(appSrc) &&
  !/document\.cookie/.test(appSrc);
assert("10 no persistence APIs in app.js", noPersist);
assert("10 privacy statement in HTML", html.includes("never leaves") || html.includes("Nothing is sent to a server"));
assert("10 no auto-scan claim", html.includes("does") && html.includes("not") && html.includes("automatically"));

// Extra: no analytics / fetch
assert("extra no analytics/fetch in app.js", !/gtag|analytics|fetch\(|XMLHttpRequest/.test(appSrc));

console.log("\n---");
console.log("Passed assertions:", passed);
console.log("Failed assertions:", failed);

// Map to the 10 named tests for summary
const named = {
  "1 all PASS": results.filter((r) => r.name.startsWith("1 ")).every((r) => r.ok),
  "2 multiple FAIL": results.filter((r) => r.name.startsWith("2 ")).every((r) => r.ok),
  "3 NOT SURE": results.filter((r) => r.name.startsWith("3 ")).every((r) => r.ok),
  "4 N/A": results.filter((r) => r.name.startsWith("4 ")).every((r) => r.ok),
  "5 mixed": results.filter((r) => r.name.startsWith("5 ")).every((r) => r.ok),
  "6 copy report": results.filter((r) => r.name.startsWith("6 ")).every((r) => r.ok),
  "7 reset": results.filter((r) => r.name.startsWith("7 ")).every((r) => r.ok),
  "8 mobile layout": results.filter((r) => r.name.startsWith("8 ")).every((r) => r.ok),
  "9 paid-service links": results.filter((r) => r.name.startsWith("9 ")).every((r) => r.ok),
  "10 refresh/no persistence": results.filter((r) => r.name.startsWith("10 ")).every((r) => r.ok)
};
let nOk = 0;
for (const [k, v] of Object.entries(named)) {
  console.log((v ? "OK" : "NO"), k);
  if (v) nOk++;
}
console.log("NAMED_TESTS_PASSED=" + nOk + "/10");
process.exit(failed > 0 ? 1 : 0);
