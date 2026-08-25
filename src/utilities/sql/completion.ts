import { schemaCompletionSource, type SQLDialect } from "@codemirror/lang-sql";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode, Tree } from "@lezer/common";
import type { EditorState, Extension, Text } from "@uiw/react-codemirror";
import { type ModeId, populated, type Relation, type Schema } from "./engine";

export interface Option {
  label: string;
  type: "namespace" | "type" | "property";
  detail: string;
  apply?: string;
  boost?: number;
}

export type Catalogue = Record<string, SchemaScope>;

interface SchemaScope {
  self: Option;
  children: Record<string, RelationScope>;
}

interface RelationScope {
  self: Option;
  children: Option[];
}

export interface Scope {
  relations: string[][];
  naming: boolean;
}

export function catalogueCompletion(dialect: SQLDialect, mode: ModeId, read: () => Schema[]): Extension {
  let catalogue: Schema[] | null = null;
  let named: Source = NOTHING;
  let scoped: Source = NOTHING;
  let scopedKey: string | null = null;

  const fromCatalogue: Source = (context) => {
    if (read() !== catalogue) refresh();
    return named(context);
  };

  const fromStatement: Source = (context) => {
    if (read() !== catalogue) refresh();
    const scope = statementScope(context.state, context.pos);
    if (scope.naming || scope.relations.length === 0) return null;

    const key = scope.relations.map((path) => path.join(".")).join(", ");
    if (key !== scopedKey) {
      scopedKey = key;
      const columns = scopeColumns(catalogue ?? [], mode, dialect, scope.relations);
      scoped = columns.length === 0 ? NOTHING : schemaCompletionSource({ dialect, schema: columns });
    }

    return scoped(context);
  };

  function refresh() {
    catalogue = read();
    named = sourceFor(dialect, mode, catalogue);
    scopedKey = null;
  }

  return [
    dialect.language.data.of({ autocomplete: fromCatalogue }),
    dialect.language.data.of({ autocomplete: fromStatement }),
  ];
}

export function catalogueNamespace(schemas: Schema[], dialect: SQLDialect): Catalogue {
  const quoting = quotingFor(dialect);
  const catalogue: Catalogue = {};

  for (const schema of schemas) {
    const relations: Record<string, RelationScope> = {};

    for (const relation of schema.relations) {
      relations[key(relation.name)] = {
        self: option(relation.name, "type", relation.kind, quoting),
        children: relation.columns.map((column) => option(column.name, "property", column.type, quoting)),
      };
    }

    catalogue[key(schema.name)] = {
      self: option(schema.name, "namespace", "schema", quoting),
      children: relations,
    };
  }

  return catalogue;
}

export function statementScope(state: EditorState, pos: number): Scope {
  const scope: Scope = { relations: [], naming: false };
  const statement = statementAt(syntaxTree(state), pos);
  if (statement) read(statement, state.doc, pos, scope, { expecting: false, listing: false, found: false });
  return scope;
}

interface Reading {
  expecting: boolean;
  listing: boolean;
  found: boolean;
}

function read(node: SyntaxNode, doc: Text, pos: number, scope: Scope, at: Reading): void {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (GROUPED.has(child.name)) {
      at.expecting = false;
      at.listing = false;
      read(child, doc, pos, scope, at);
      at.listing = false;
      continue;
    }

    if (!at.found && child.from <= pos && pos <= child.to) {
      scope.naming = at.expecting;
      at.found = true;
    }

    if (child.name === "Keyword") {
      const word = doc.sliceString(child.from, child.to).toLowerCase();
      at.expecting = NAMES_RELATION.has(word);
      at.listing = at.listing && word === "as";
    } else if (IDENTIFIER.test(child.name)) {
      if (at.expecting) {
        scope.relations.push(pathOf(child, doc));
        at.expecting = false;
        at.listing = true;
      }
    } else if (at.listing && child.name === "Punctuation" && doc.sliceString(child.from, child.to) === ",") {
      at.expecting = true;
    }

    if (!at.found && child.to <= pos) scope.naming = at.expecting;
  }
}

function statementAt(tree: Tree, pos: number): SyntaxNode | null {
  const inner = tree.resolveInner(pos, -1);
  for (let at: SyntaxNode | null = inner; at; at = at.parent) if (at.name === "Statement") return at;

  const before = inner.childBefore(pos);
  return before?.name === "Statement" && before.lastChild?.name !== ";" ? before : null;
}

const NAMES_RELATION = new Set(["from", "join", "update", "into"]);

const IDENTIFIER = /Identifier$/;

const GROUPED = new Set(["Parens", "Braces", "Brackets"]);

const UNQUALIFIED: Record<ModeId, string> = { sqlite: "main", postgres: "public" };

type Source = ReturnType<typeof schemaCompletionSource>;

const NOTHING: Source = () => null;

function sourceFor(dialect: SQLDialect, mode: ModeId, schemas: Schema[]): Source {
  if (!populated(schemas)) return NOTHING;

  return schemaCompletionSource({
    dialect,
    schema: catalogueNamespace(schemas, dialect),
    defaultSchema: UNQUALIFIED[mode],
  });
}

function scopeColumns(schemas: Schema[], mode: ModeId, dialect: SQLDialect, relations: string[][]): Option[] {
  const quoting = quotingFor(dialect);
  const written = new Set<string>();
  const columns: Option[] = [];

  for (const path of relations) {
    for (const column of relationAt(schemas, mode, path)?.columns ?? []) {
      if (written.has(column.name)) continue;
      written.add(column.name);
      columns.push({ ...option(column.name, "property", column.type, quoting), boost: 1 });
    }
  }

  return columns;
}

function relationAt(schemas: Schema[], mode: ModeId, path: string[]): Relation | undefined {
  const name = path[path.length - 1];
  const within = path.length > 1 ? path[path.length - 2] : UNQUALIFIED[mode];

  return holds(schemas.find((schema) => schema.name === within), name)
    ?? (path.length > 1 ? undefined : schemas.map((schema) => holds(schema, name)).find(Boolean));
}

function holds(schema: Schema | undefined, name: string): Relation | undefined {
  return schema?.relations.find((relation) => relation.name === name);
}

function option(label: string, type: Option["type"], detail: string, quoting: Quoting): Option {
  return quoting.plain.test(label) ? { label, type, detail } : { label, type, detail, apply: quoting.wrap(label) };
}

interface Quoting {
  plain: RegExp;
  wrap: (label: string) => string;
}

function quotingFor(dialect: SQLDialect): Quoting {
  const quote = dialect.spec.identifierQuotes?.[0] ?? "\"";
  const plain = new RegExp("^[a-z_][a-z_\\d]*$", dialect.spec.caseInsensitiveIdentifiers ? "i" : "");
  return { plain, wrap: (label) => `${quote}${label}${quote}` };
}

function pathOf(node: SyntaxNode, doc: Text): string[] {
  if (node.name !== "CompositeIdentifier") return [nameOf(node, doc)];

  const path: string[] = [];
  for (let part = node.firstChild; part; part = part.nextSibling) {
    if (part.name !== ".") path.push(nameOf(part, doc));
  }

  return path;
}

function nameOf(node: SyntaxNode, doc: Text): string {
  const text = doc.sliceString(node.from, node.to);
  return /^([`'"])(.*)\1$/.exec(text)?.[2] ?? text;
}

function key(name: string): string {
  return name.replace(/\./g, "\\.");
}
