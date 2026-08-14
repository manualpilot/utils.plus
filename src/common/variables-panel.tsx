import { Box, Group, type RenderTreeNodePayload, Text, Tree, type TreeNodeData, useTree } from "@mantine/core";
import { useMemo } from "react";
import { IconChevronRight } from "../icons";

export function Variables({ busy, scope, empty, section }: VariablesProps) {
  const tree = useTree();
  const data = useMemo(() => toData(scope, section), [scope, section]);

  return (
    <>
      <Box px="sm" py="xs" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
        <Text size="sm" fw={500}>Variables</Text>
      </Box>
      <Box p="xs" style={{ flex: 1, overflow: "auto" }} aria-disabled={busy || undefined}>
        {data.length === 0
          ? <Text size="sm" c="dimmed" px="xs">{empty}</Text>
          : <Tree data={data} tree={tree} aria-label="Variables" levelOffset="md" renderNode={renderVariable} />}
      </Box>
    </>
  );
}

interface VariablesProps {
  busy: boolean;
  scope: Scope | null;
  empty: string;
  section: { label: string; one: string; many: string };
}

export interface Variable {
  name: string;
  kind: string;
  value: string;
  children?: Variable[];
  note?: boolean;
  heading?: boolean;
}

export interface Scope {
  variables: Variable[];
  section: Variable[];
}

function renderVariable({ node, expanded, hasChildren, elementProps }: RenderTreeNodePayload) {
  const { name, kind, value, note, heading } = (node as VariableNode).variable;
  const { style, ...rest } = elementProps;

  return (
    <Group {...rest} style={{ ...style, cursor: hasChildren ? "pointer" : "default" }} gap="xs" wrap="nowrap">
      <IconChevronRight
        size="0.8rem"
        style={{
          flex: "0 0 auto",
          visibility: hasChildren ? undefined : "hidden",
          transform: expanded ? "rotate(90deg)" : undefined,
        }}
      />
      {note ? <Text size="xs" c="dimmed">{value}</Text> : (
        <>
          <Text size="xs" fw={heading ? 500 : undefined} ff={heading ? undefined : "monospace"}>{name}</Text>
          <Text size="xs" c="dimmed">{kind}</Text>
          <Text size="xs" ff="monospace" c="bright" flex={1} miw={0} truncate="end" title={value}>{value}</Text>
        </>
      )}
    </Group>
  );
}

function toData(scope: Scope | null, section: VariablesProps["section"]): VariableNode[] {
  if (!scope) return [];
  const defined = scope.variables.map((variable, index) => toNode(variable, String(index)));
  if (scope.section.length === 0) return defined;

  const count = scope.section.length;
  return [...defined, {
    value: "section",
    label: section.label,
    variable: {
      name: section.label,
      kind: `${count} ${count === 1 ? section.one : section.many}`,
      value: "",
      heading: true,
    },
    children: scope.section.map((variable, index) => toNode(variable, `section.${index}`)),
  }];
}

function toNode(variable: Variable, path: string): VariableNode {
  return {
    value: path,
    label: variable.name,
    variable,
    children: variable.children?.map((child, index) => toNode(child, `${path}.${index}`)),
  };
}

interface VariableNode extends TreeNodeData {
  variable: Variable;
  children?: VariableNode[];
}
