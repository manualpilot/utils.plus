import type { TreeNodeData } from "@mantine/core";
import type { Relation, Schema } from "./engine";

export interface Row {
  name: string;
  kind?: string;
  detail?: string;
  marks?: string[];
  block?: boolean;
}

export interface SchemaNode extends TreeNodeData {
  row: Row;
  children?: SchemaNode[];
}

export function schemaTree(schemas: Schema[]): SchemaNode[] {
  return schemas.map((schema) => ({
    value: `schema:${schema.name}`,
    label: schema.name,
    row: { name: schema.name, kind: count(schema.relations.length, "relation") },
    children: schema.relations.map((relation) => relationNode(`schema:${schema.name}`, relation)),
  }));
}

export function defaultOpen(nodes: SchemaNode[]): string[] {
  const values: string[] = [];

  for (const schema of nodes) {
    values.push(schema.value);
    for (const relation of schema.children ?? []) {
      values.push(relation.value);
      const columns = relation.children?.find((section) => section.value.endsWith("/columns"));
      if (columns) values.push(columns.value);
    }
  }

  return values;
}

function relationNode(path: string, relation: Relation): SchemaNode {
  const at = `${path}/relation:${relation.name}`;
  const sections: SchemaNode[] = [];

  if (relation.columns.length > 0) {
    sections.push({
      value: `${at}/columns`,
      label: "Columns",
      row: { name: "Columns", kind: String(relation.columns.length) },
      children: relation.columns.map((column) => ({
        value: `${at}/columns/${column.name}`,
        label: column.name,
        row: {
          name: column.name,
          kind: column.type,
          marks: [column.primaryKey ? "PK" : "", column.notNull ? "NOT NULL" : ""].filter(Boolean),
          detail: column.fallback ? `DEFAULT ${column.fallback}` : undefined,
        },
      })),
    });
  }

  if (relation.indexes.length > 0) {
    sections.push({
      value: `${at}/indexes`,
      label: "Indexes",
      row: { name: "Indexes", kind: String(relation.indexes.length) },
      children: relation.indexes.map((index) => ({
        value: `${at}/indexes/${index.name}`,
        label: index.name,
        row: {
          name: index.name,
          kind: index.primary ? "primary" : index.unique ? "unique" : "index",
          detail: `(${index.columns.join(", ")})`,
        },
      })),
    });
  }

  if (relation.constraints.length > 0) {
    sections.push({
      value: `${at}/constraints`,
      label: "Constraints",
      row: { name: "Constraints", kind: String(relation.constraints.length) },
      children: relation.constraints.map((constraint, index) => ({
        value: `${at}/constraints/${index}`,
        label: constraint.kind,
        row: { name: constraint.kind, kind: constraint.name || undefined, detail: constraint.detail },
      })),
    });
  }

  if (relation.definition) {
    sections.push({
      value: `${at}/definition`,
      label: "Definition",
      row: { name: "Definition" },
      children: [{
        value: `${at}/definition/sql`,
        label: relation.definition,
        row: { name: relation.definition.trim(), block: true },
      }],
    });
  }

  return {
    value: at,
    label: relation.name,
    row: { name: relation.name, kind: relation.kind, detail: count(relation.columns.length, "column") },
    children: sections,
  };
}

function count(total: number, noun: string): string {
  return `${total} ${noun}${total === 1 ? "" : "s"}`;
}
