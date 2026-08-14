(() => {
  const write = globalThis.__write;

  const MAX_DEPTH = 4;
  const MAX_CHILDREN = 100;
  const MAX_NODES = 2000;

  const MAX_STRING = 160;
  const MAX_ITEMS = 8;
  const PREVIEW_DEPTH = 2;

  const timers = new Map();
  let nextTimer = 1;

  const console = {
    log: (...args) => write(format(args) + "\n"),
    info: (...args) => write(format(args) + "\n"),
    debug: (...args) => write(format(args) + "\n"),
    warn: (...args) => write(format(args) + "\n"),
    error: (...args) => write(format(args) + "\n"),
    dir: (value) => write(inspect(value) + "\n"),
    trace: (...args) => write("Trace" + (args.length ? ": " + format(args) : "") + "\n" + stack() + "\n"),
    assert: (ok, ...args) => {
      if (!ok) write("Assertion failed" + (args.length ? ": " + format(args) : "") + "\n");
    },
    group: (...args) => {
      if (args.length) write(format(args) + "\n");
    },
    groupEnd: () => {},
    time: (label = "default") => timings.set(label, now()),
    timeLog: (label = "default", ...args) => write(elapsed(label) + (args.length ? " " + format(args) : "") + "\n"),
    timeEnd: (label = "default") => {
      write(elapsed(label) + "\n");
      timings.delete(label);
    },
    count: (label = "default") => {
      counts.set(label, (counts.get(label) ?? 0) + 1);
      write(`${label}: ${counts.get(label)}\n`);
    },
    countReset: (label = "default") => counts.delete(label),
    table: (value) => write(inspect(value) + "\n"),
  };

  const timings = new Map();
  const counts = new Map();

  function now() {
    return typeof performance === "object" ? performance.now() : Date.now();
  }

  function elapsed(label) {
    const started = timings.get(label);
    return started === undefined ? `${label}: <no such label>` : `${label}: ${(now() - started).toFixed(3)}ms`;
  }

  function stack() {
    try {
      throw new Error("trace");
    } catch (error) {
      return String(error.stack ?? "").split("\n").slice(2).join("\n");
    }
  }

  function format(args) {
    if (typeof args[0] === "string" && args.length > 1 && /%[sdifoOjc%]/.test(args[0])) return substitute(args);
    return args.map((value) => (typeof value === "string" ? value : inspect(value))).join(" ");
  }

  function substitute(args) {
    const rest = args.slice(1);
    const filled = args[0].replace(/%([sdifoOjc%])/g, (match, kind) => {
      if (kind === "%") return "%";
      if (rest.length === 0) return match;
      const value = rest.shift();
      switch (kind) {
        case "s":
          return typeof value === "string" ? value : inspect(value);
        case "d":
        case "i":
          return typeof value === "bigint" ? `${value}n` : String(Math.trunc(Number(value)));
        case "f":
          return String(Number(value));
        case "j":
          return json(value);
        case "c":
          return "";
        default:
          return inspect(value);
      }
    });
    return [filled, ...rest.map((value) => (typeof value === "string" ? value : inspect(value)))].join(" ");
  }

  function json(value) {
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return inspect(value);
    }
  }

  function setTimer(callback, delay, args, repeat) {
    if (typeof callback !== "function") return 0;
    const id = nextTimer++;
    const every = Math.max(0, Number(delay) || 0);
    timers.set(id, { callback, args, every, due: Date.now() + every, repeat });
    return id;
  }

  globalThis.console = console;
  globalThis.setTimeout = (callback, delay, ...args) => setTimer(callback, delay, args, false);
  globalThis.setInterval = (callback, delay, ...args) => setTimer(callback, delay, args, true);
  globalThis.clearTimeout = (id) => timers.delete(id);
  globalThis.clearInterval = (id) => timers.delete(id);
  globalThis.setImmediate = (callback, ...args) => setTimer(callback, 0, args, false);
  globalThis.clearImmediate = (id) => timers.delete(id);

  globalThis.__nextTimer = () => {
    let soonest = -1;
    for (const timer of timers.values()) {
      if (soonest === -1 || timer.due < soonest) soonest = timer.due;
    }
    return soonest;
  };

  globalThis.__runTimers = () => {
    const at = Date.now();
    const due = [...timers.entries()].filter(([, timer]) => timer.due <= at).sort((a, b) => a[1].due - b[1].due);

    for (const [id, timer] of due) {
      if (!timers.has(id)) continue;
      if (timer.repeat) timer.due = Date.now() + Math.max(timer.every, 1);
      else timers.delete(id);
      try {
        timer.callback(...timer.args);
      } catch (error) {
        write(describe(error) + "\n");
      }
    }
  };

  globalThis.__describe = describe;
  globalThis.__inspect = inspect;

  globalThis.__rejected = (value) => write("Uncaught (in promise) " + describe(value) + "\n");

  globalThis.__snapshot = (namesJson) => {
    const written = Object.getOwnPropertyNames(globalThis)
      .filter((name) => !baseline.has(name) && !name.startsWith("__"));
    const names = [...new Set([...JSON.parse(namesJson), ...written])];
    let remaining = MAX_NODES;

    const read = (name, value, depth, seen) => {
      const node = { name, kind: kindOf(value), value: preview(value) };
      if (seen.includes(value)) {
        node.value = "<circular reference>";
        return node;
      }

      const parts = members(value);
      if (parts === null || depth === MAX_DEPTH) return node;

      const [total, pairs] = parts;
      const taken = Math.min(total, MAX_CHILDREN, Math.max(remaining, 0));
      remaining -= taken;
      const below = [...seen, value];
      node.children = pairs.slice(0, taken).map(([key, item]) => read(key, item, depth + 1, below));
      if (total > taken) {
        node.children.push({ name: "", kind: "", value: `… ${total - taken} more`, note: true });
      }
      return node;
    };

    const variables = [];
    const section = [];
    for (const name of names) {
      let value;
      try {
        value = (0, eval)(name);
      } catch {
        continue;
      }
      (typeof value === "function" ? section : variables).push(read(name, value, 0, []));
    }
    return JSON.stringify({ variables, section });
  };

  function members(value) {
    try {
      if (value === null || typeof value !== "object") return null;
      if (Array.isArray(value) || isTypedArray(value)) {
        return [value.length, [...value].map((item, index) => [String(index), item])];
      }
      if (value instanceof Map) return [value.size, [...value].map(([key, item]) => [preview(key), item])];
      if (value instanceof Set) return [value.size, [...value].map((item) => ["", item])];
      if (value instanceof Date || value instanceof RegExp || value instanceof Error) return null;

      const keys = Object.getOwnPropertyNames(value);
      const own = keys.map((key) => [key, read(value, key)]).filter(([, item]) => item !== SKIP);
      return own.length > 0 ? [own.length, own] : null;
    } catch {
      return null;
    }
  }

  function read(object, key) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return SKIP;
    if ("value" in descriptor) return descriptor.value;
    return descriptor.get ? GETTER : SKIP;
  }

  const SKIP = Symbol("skip");
  const GETTER = Symbol("getter");

  function isTypedArray(value) {
    return ArrayBuffer.isView(value) && !(value instanceof DataView);
  }

  function kindOf(value) {
    try {
      if (value === null) return "null";
      if (value === GETTER) return "getter";
      const type = typeof value;
      if (type !== "object" && type !== "function") return type;
      if (type === "function") return isClass(value) ? "class" : "function";
      if (Array.isArray(value) || isTypedArray(value)) return `${constructorOf(value)} (${value.length})`;
      if (value instanceof Map || value instanceof Set) return `${constructorOf(value)} (${value.size})`;
      return constructorOf(value);
    } catch {
      return "object";
    }
  }

  function constructorOf(value) {
    const name = Object.getPrototypeOf(value)?.constructor?.name;
    return typeof name === "string" && name ? name : "Object";
  }

  function isClass(value) {
    return /^\s*class[\s{]/.test(safeString(value));
  }

  function safeString(value) {
    try {
      return Function.prototype.toString.call(value);
    } catch {
      return "";
    }
  }

  function preview(value) {
    try {
      return inspect(value, PREVIEW_DEPTH);
    } catch (error) {
      return `<unreadable: ${kindOf(error)}>`;
    }
  }

  function inspect(value, depth = PREVIEW_DEPTH, seen = []) {
    if (value === GETTER) return "[Getter]";
    if (value === null) return "null";

    switch (typeof value) {
      case "undefined":
        return "undefined";
      case "string":
        return quote(value);
      case "bigint":
        return `${value}n`;
      case "symbol":
      case "number":
      case "boolean":
        return String(value);
      case "function":
        return describeFunction(value);
    }

    if (seen.includes(value)) return "[Circular]";
    if (value instanceof Date) return isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
    if (value instanceof RegExp) return String(value);
    if (value instanceof Error) return describe(value, false);

    if (depth <= 0) return abbreviate(value);
    const below = [...seen, value];
    const nest = (item) => inspect(item, depth - 1, below);

    if (Array.isArray(value) || isTypedArray(value)) {
      return wrap("[", [...value].slice(0, MAX_ITEMS).map(nest), value.length, "]");
    }
    if (value instanceof Map) {
      const entries = [...value].slice(0, MAX_ITEMS).map(([key, item]) => `${nest(key)} => ${nest(item)}`);
      return `Map(${value.size}) ` + wrap("{", entries, value.size, "}");
    }
    if (value instanceof Set) {
      return `Set(${value.size}) ` + wrap("{", [...value].slice(0, MAX_ITEMS).map(nest), value.size, "}");
    }

    const keys = Object.getOwnPropertyNames(value);
    const shown = keys.slice(0, MAX_ITEMS).map((key) => `${label(key)}: ${nest(read(value, key))}`);
    const prefix = constructorOf(value) === "Object" ? "" : constructorOf(value) + " ";
    return prefix + (keys.length === 0 ? "{}" : wrap("{ ", shown, keys.length, " }", ", "));
  }

  function abbreviate(value) {
    if (Array.isArray(value)) return `[Array (${value.length})]`;
    if (value instanceof Map || value instanceof Set) return `[${constructorOf(value)} (${value.size})]`;
    return `[${constructorOf(value)}]`;
  }

  function wrap(open, parts, total, close, join = ", ") {
    if (total > parts.length) parts = [...parts, `… ${total - parts.length} more`];
    return open + parts.join(join) + close;
  }

  function label(key) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : quote(key);
  }

  function describeFunction(value) {
    const name = value.name || "anonymous";
    return isClass(value) ? `class ${name}` : `function ${name}()`;
  }

  function quote(value) {
    const cut = value.length > MAX_STRING ? value.slice(0, MAX_STRING) + "…" : value;
    return "'" + cut.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'";
  }

  const baseline = new Set(Object.getOwnPropertyNames(globalThis));

  function describe(error, withStack = true) {
    if (!(error instanceof Error)) return "Uncaught " + inspect(error);
    const head = `${error.name || "Error"}: ${error.message}`;
    const frames = withStack ? String(error.stack ?? "").trimEnd() : "";
    return frames ? `${head}\n${frames}` : head;
  }
})();
