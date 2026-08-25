"""The interpreter's side of /python: the page hands over a script or a line, which writes as it goes."""

import ast
import codeop
import json
import reprlib
import sys
import traceback
import types
from itertools import islice

import js

MAX_DEPTH = 4
MAX_CHILDREN = 100
MAX_NODES = 2000

REPL_SCOPE = {"__name__": "__main__"}
REPL_IMPORTS = set()


def run(code):
    scope = {"__name__": "__main__"}
    try:
        exec(compile(code, "<script>", "exec"), scope)
    except BaseException as error:
        report(error)
    finally:
        flush()
    return reply(scope, imported_names(code))


def repl(source):
    """One entry at the prompt: either the block wants another line, or it runs against the session's own names."""
    try:
        if incomplete(source):
            return json.dumps({"status": "incomplete"})
    except SyntaxError:
        pass

    try:
        REPL_IMPORTS.update(imported_names(source))
        echo(source, REPL_SCOPE)
    except BaseException as error:
        report(error)
    finally:
        flush()
    return reply(REPL_SCOPE, REPL_IMPORTS)


def incomplete(source):
    """Whether the prompt should ask for another line: an unfinished statement, or a block no blank line has closed."""
    if codeop.compile_command(source, "<repl>", "exec") is None:
        return True
    if not source.split("\n")[-1].strip():
        return False
    body = ast.parse(source).body
    return bool(body) and (hasattr(body[-1], "body") or hasattr(body[-1], "cases"))


def echo(source, scope):
    """Runs an entry the way a prompt does, which is to write out a trailing expression rather than drop its value."""
    tree = ast.parse(source, "<repl>", "exec")
    tail = tree.body.pop() if tree.body and isinstance(tree.body[-1], ast.Expr) else None
    exec(compile(tree, "<repl>", "exec"), scope)
    if tail is not None:
        sys.displayhook(eval(compile(ast.Expression(tail.value), "<repl>", "eval"), scope))


def report(error):
    """The traceback, opened on the line somebody wrote: every frame above that one is this file's own plumbing."""
    tb = error.__traceback__
    while tb is not None and tb.tb_frame.f_code.co_filename not in SOURCES:
        tb = tb.tb_next
    traceback.print_exception(type(error), error, tb, file=sys.stderr)


def flush():
    sys.stdout.flush()
    sys.stderr.flush()
    js.flushScriptOutput()


def reply(scope, imported):
    return json.dumps({"status": "ok", **snapshot(scope, imported)})


def snapshot(scope, imported):
    """Reads what a run left bound into the tree the panel draws, bounded in depth, in breadth and in total."""
    remaining = MAX_NODES

    def read(name, value, depth, seen):
        nonlocal remaining
        node = {"name": name, "kind": kind(value), "value": preview(value)}
        if id(value) in seen:
            node["value"] = "<circular reference>"
            return node

        parts = members(value)
        if parts is None or depth == MAX_DEPTH:
            return node

        total, pairs = parts
        taken = min(total, MAX_CHILDREN, max(remaining, 0))
        remaining -= taken
        below = seen + (id(value),)
        node["children"] = [read(child, item, depth + 1, below) for child, item in islice(pairs, taken)]
        if total > taken:
            node["children"].append({"name": "", "kind": "", "value": f"… {total - taken} more", "note": True})
        return node

    names = [(name, value) for name, value in scope.items() if not name.startswith("__")]
    return {
        "variables": [read(name, value, 0, ()) for name, value in names if name not in imported],
        "section": [read(name, value, 0, ()) for name, value in names if name in imported],
    }


def imported_names(code):
    """The names an import bound, which is the only thing that tells `from x import y` from a name the script wrote."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return frozenset()

    names = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names.update(alias.asname or alias.name.split(".")[0] for alias in node.names)
    return names


def members(value):
    """What opens under a value: a mapping's keys, a sequence's items, or the state an instance carries."""
    try:
        if isinstance(value, dict):
            return len(value), ((preview(key), item) for key, item in value.items())
        if isinstance(value, (list, tuple)):
            return len(value), ((str(index), item) for index, item in enumerate(value))
        if isinstance(value, (set, frozenset)):
            return len(value), (("", item) for item in value)
        if isinstance(value, (str, bytes, bytearray, types.ModuleType, type)) or callable(value):
            return None
        attributes = state(value)
        return (len(attributes), iter(attributes)) if attributes else None
    except BaseException:
        return None


def state(value):
    """An instance's own attributes: the dict it carries, or the slots its classes declared in place of one."""
    own = getattr(value, "__dict__", None)
    if isinstance(own, dict):
        return list(own.items())

    names = []
    for cls in type(value).__mro__:
        slots = cls.__dict__.get("__slots__", ())
        names.extend((slots,) if isinstance(slots, str) else slots)
    return [(name, getattr(value, name)) for name in names if hasattr(value, name)]


def kind(value):
    """The type, with the length of anything that has one, since a preview cut short hides how much is behind it."""
    name = type(value).__name__
    try:
        return f"{name} ({len(value)})" if isinstance(value, SIZED) else name
    except BaseException:
        return name


def preview(value):
    try:
        return BOUNDED.repr(value)
    except BaseException as error:
        return f"<unreadable: {type(error).__name__}>"


SOURCES = ("<script>", "<repl>")

SIZED = (list, tuple, set, frozenset, dict, bytes, bytearray, range)

BOUNDED = reprlib.Repr()
BOUNDED.maxlevel = 2
BOUNDED.maxstring = 160
BOUNDED.maxother = 160
BOUNDED.maxlist = BOUNDED.maxtuple = BOUNDED.maxset = BOUNDED.maxfrozenset = BOUNDED.maxdict = 8
BOUNDED.maxarray = BOUNDED.maxdeque = 8
