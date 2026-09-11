import type { PageContent } from "../page-document.ts";

export default {
  related: ["/javascript", "/sql", "/regex", "/json"],
  howItWorks: [
    "Scripts run on Pyodide, the CPython interpreter compiled to WebAssembly, in a worker of the page's own. The interpreter and its standard library, about 13 MB, are served from this site and fetched on the first Run, which is why that one says “Starting Python…” for a moment; later runs reuse them.",
    "Each Run executes the script in a fresh set of globals, so the last run's names are gone, although modules it imported stay loaded. Standard output and standard error are caught as the bytes are written, so a `print` with `end=\"\"` appears at once and the two streams interleave in the order they were written. A traceback starts at the first frame of your own script, with the page's machinery left out.",
    "When the run ends, the panel beside the editor lists every name it left bound, with its type and a preview. Dicts, lists, sets and instances open into their contents, and names that came from an `import` wait under a closed Imported heading. Previews are cut short as they are built, and a container opens to its first 100 items and a count of the rest.",
    "The REPL uses the same interpreter and keeps one namespace between entries. A trailing expression is printed with its `repr` and bound to `_`. A compound statement such as `for` or `if` waits for a blank line, so an `else` can follow, and lines added with Shift+Enter run as one entry.",
    "A loop that prints fast is paced: the page redraws at most every 100 ms, keeps the last 128 KB, and says when earlier output was dropped. [The JavaScript page](/javascript) is the same console with a JavaScript engine behind it.",
  ],
  examples: [
    {
      title: "A traceback that opens on your line",
      blocks: [
        { code: "def mean(values):\n    return sum(values) / len(values)\n\nprint(mean([3, 4, 5]))\nprint(mean([]))" },
        {
          code:
            "4.0\nTraceback (most recent call last):\n  File \"<script>\", line 5, in <module>\n  File \"<script>\", line 2, in mean\nZeroDivisionError: division by zero",
        },
        "The first `print` ran before the error, so its output stays. Both frames are the script's own, and the panel still lists `mean`, which was bound before line 5 raised.",
      ],
    },
    {
      title: "What the panel shows after a run",
      blocks: [
        {
          code:
            "from collections import Counter\n\nwords = \"the cat sat on the mat\".split()\ncounts = Counter(words)\nprint(counts.most_common(2))",
        },
        { code: "[('the', 2), ('cat', 1)]" },
        "The panel then reads:",
        {
          code:
            "words      list (6)     ['the', 'cat', 'sat', 'on', 'the', 'mat']\ncounts     Counter (5)  Counter({'the': 2, 'cat': 1, 'sat': 1, 'on': 1, 'mat': 1})\nImported   1 name\n  Counter  type         <class 'collections.Counter'>",
        },
        "`counts` opens into its five keys. `Counter` is filed under Imported because the script's own `import` bound it, which the page reads from the code rather than guessing from the value.",
      ],
    },
    {
      title: "A block at the prompt",
      blocks: [
        { code: ">>> total = 0\n>>> for n in range(1, 5):\n...     total += n\n...\n>>> total\n10\n>>> _ * 2\n20" },
        "The `for` line and its body wait until the blank line closes the block. `total` is answered with its repr, and `_` holds that value for the line after.",
      ],
    },
  ],
  problems: [
    {
      title: "`ModuleNotFoundError: No module named 'numpy'`",
      blocks: [
        "Only the standard library is there. numpy, pandas, requests and everything else from PyPI are missing, and nothing on the page installs them: `micropip` would fetch from a package index, and this page fetches nothing but the interpreter.",
      ],
    },
    {
      title: "`RuntimeError: can't start new thread`",
      blocks: [
        "WebAssembly in a browser gives the interpreter no threads and no processes. `threading` and `socket` import but cannot work, `Thread.start()` raises that error, `subprocess.run` raises `OSError: [Errno 138] emscripten does not support processes`, and `multiprocessing` fails to import.",
      ],
    },
    {
      title: "`ZoneInfoNotFoundError` for a zone name",
      blocks: [
        "`ZoneInfo(\"Europe/London\")` needs a time zone database, which Pyodide keeps in a separate `tzdata` package this page does not load. `datetime.timezone.utc` and fixed offsets such as `timezone(timedelta(hours=2))` work.",
      ],
    },
    {
      title: "`input()` raises `OSError: [Errno 29] I/O error`",
      blocks: [
        "The page gives the interpreter no standard input, so `input()` fails instead of waiting for a reply. Put the values in the script, or assign them at the REPL.",
      ],
    },
  ],
  faq: [
    {
      question: "Which version of Python is it?",
      answer:
        "Whichever CPython the bundled Pyodide release is built on. The sample script the page opens with prints it, and so does `import sys; print(sys.version)`.",
    },
    {
      question: "Do variables carry over from one Run to the next?",
      answer:
        "No. Each Run starts on empty globals, so a script cannot lean on something an earlier one defined; modules it imported are still loaded, which only makes importing them again fast. The REPL is the mode that keeps names, until Stop ends the interpreter.",
    },
    {
      question: "How do I stop a script that never ends?",
      answer:
        "Press Stop. It terminates the worker the interpreter runs in, which is the one thing that can interrupt `while True:`, and whatever the script had printed stays on screen. The next Run or REPL line starts a new interpreter, so a REPL session's names are gone.",
    },
  ],
  references: [
    { title: "Pyodide documentation", url: "https://pyodide.org/en/stable/" },
    {
      title: "Pyodide, Python standard library and WebAssembly constraints",
      url: "https://pyodide.org/en/stable/usage/wasm-constraints.html",
    },
    { title: "The Python Standard Library", url: "https://docs.python.org/3/library/index.html" },
    { title: "zoneinfo, Python documentation", url: "https://docs.python.org/3/library/zoneinfo.html" },
  ],
} satisfies PageContent;
