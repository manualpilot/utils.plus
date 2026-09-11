import type { PageContent } from "../page-document.ts";

export default {
  related: ["/python", "/regex", "/json", "/sql"],
  howItWorks: [
    "The engine is quickjs-ng, a small JavaScript engine compiled to WebAssembly, running in a worker the page starts for it. Its half a megabyte is fetched from this site on the first Run, not when the page opens, and stays loaded for the runs after.",
    "Each Run is a whole program in a new context, so nothing the previous run declared is visible to it. Every `console` method writes to one stream in the order it was called, and output appears while the script is still going. A run is not over until its event loop is: promises settle and timers fire before the page reports the time taken.",
    "TypeScript has its types stripped by sucrase and the rest runs as it stands. Nothing is type-checked. An `enum` survives, being a value; interfaces, annotations and `as` casts disappear.",
    "When a run ends, the panel beside the editor lists what the top level left bound: `let`, `const` and `var` names, every name in a destructuring pattern, and anything assigned to `globalThis`. Objects, arrays, maps and sets open into their contents, functions and classes wait under a Functions heading, and a getter is named but never called.",
    "The REPL keeps one context between entries. An expression is answered with its value and a statement with nothing. A line with an unclosed bracket, string, template or block comment waits for the rest, and a top-level `let`, `const` or `class` is rewritten as `var` before it runs, so the same declaration entered twice rebinds the name.",
    "A script printing in a tight loop is paced rather than queued: the page redraws at most every 100 ms, keeps the last 128 KB, and says at the top when earlier output was dropped. [The Python page](/python) is the same console with CPython behind it.",
  ],
  examples: [
    {
      title: "Microtasks before timers",
      blocks: [
        {
          code:
            "setTimeout(() => console.log(\"timeout\"), 0);\nPromise.resolve().then(() => console.log(\"microtask\"));\nconsole.log(\"sync\");",
        },
        { code: "sync\nmicrotask\ntimeout" },
        "The microtask queue is drained before the next due timer fires, as in a browser, and the run waits for the timer before it counts as finished.",
      ],
    },
    {
      title: "The same declaration twice at the prompt",
      blocks: [
        {
          code:
            "> let total = 0\n> [1, 2, 3].forEach((n) => { total += n; })\n> total\n6\n> let total = 10\n> total * 2\n20",
        },
        "In a script the second `let total` stops the run with `SyntaxError: invalid redefinition of lexical identifier`; at the prompt it rebinds the name. `forEach` returns `undefined`, so that line is answered with nothing, and the panel afterwards shows `total` as 10.",
      ],
    },
    {
      title: "Types are erased, not checked",
      blocks: [
        {
          code:
            "enum Level { Low, High }\nlet score: number = 10;\nscore = \"ten\";\nconsole.log(Level.High, Level[0], score);",
        },
        { code: "1 Low ten" },
        "The compiler would reject a string assigned to a `number`; here the annotation is removed and the assignment runs. The enum becomes an object mapping names to numbers and back, which is why `Level[0]` reads `Low`.",
      ],
    },
  ],
  problems: [
    {
      title: "`ReferenceError: fetch is not defined`",
      blocks: [
        "The engine brings the language and its built-ins, plus `console`, the timers and `queueMicrotask`, and nothing from a browser or Node. `fetch`, `require`, `URL`, `TextEncoder`, `atob`, `structuredClone`, `Intl` and `document` are all undefined, and an `import` fails with `could not load module`. With no `Intl`, `(1234567.891).toLocaleString()` returns `1234567.891` without separators.",
      ],
    },
    {
      title: "`await` at the top level",
      blocks: [
        "A script runs as a classic script, so `const data = await load();` stops with `SyntaxError: expecting ';'`. Wrap the body in an async function and call it, `(async () => { … })()`. The run waits for the promise and any timers it set, so the output still arrives before the page says it finished.",
      ],
    },
    {
      title: "A TypeScript namespace disappears",
      blocks: [
        "sucrase erases `namespace` blocks with the types, values inside them included, so `namespace Util { export const x = 1; }` followed by `console.log(Util.x)` fails with `ReferenceError: Util is not defined`. A plain object survives.",
      ],
    },
    {
      title: "`console.log` shows less than Node does",
      blocks: [
        "Values are previewed two levels deep and eight items wide: an array of the numbers 1 to 20 prints as `[1, 2, 3, 4, 5, 6, 7, 8, … 12 more]`, and a deeper object ends in `[Object]`. `console.log(JSON.stringify(value))` prints all of it, and the variables panel opens four levels down.",
      ],
    },
  ],
  faq: [
    {
      question: "Does the code run on a server?",
      answer:
        "No. The engine runs in a Web Worker in this tab, and the script inside it has no network access. The script is kept in the part of the address after `#`, which is how a copied link carries it; browsers do not send that part to the server.",
    },
    {
      question: "How do I stop a script that never ends?",
      answer:
        "Press Stop. It terminates the worker the engine runs in, which works even in the middle of `while (true) {}`, and whatever the script had already printed stays on screen. The next Run starts a new engine, and a REPL session's names go with the old one. Memory and the stack end a script on their own: with `InternalError: out of memory`, after which the page lets that engine go as Stop would, or with `RangeError: Maximum call stack size exceeded` about 600 calls deep.",
    },
    {
      question: "Which language features are there?",
      answer:
        "Current ECMAScript, including recent additions such as `Object.groupBy`, `Array.prototype.toSorted`, `Promise.withResolvers` and the new `Set` methods like `union`. There is no `Intl` and no `Temporal`.",
    },
  ],
  references: [
    { title: "quickjs-ng", url: "https://github.com/quickjs-ng/quickjs" },
    { title: "quickjs-emscripten, the WebAssembly bindings", url: "https://github.com/justjake/quickjs-emscripten" },
    { title: "sucrase", url: "https://github.com/alangpierce/sucrase" },
    {
      title: "JavaScript execution model, MDN",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model",
    },
    { title: "console, MDN", url: "https://developer.mozilla.org/en-US/docs/Web/API/console" },
  ],
} satisfies PageContent;
