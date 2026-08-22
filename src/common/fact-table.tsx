import { ActionIcon, CopyButton, Table, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "../icons";

export function FactTable({ rows }: { rows: Fact[] }) {
  return (
    <Table verticalSpacing={6} horizontalSpacing="xs" withRowBorders={false}>
      <Table.Tbody>
        {rows.filter((row) => row.value !== "").map((row) => (
          <Table.Tr key={row.label} data-fact={row.label}>
            <Table.Td w="1%" style={{ whiteSpace: "nowrap" }}>
              <Text size="sm" c="dimmed">{row.label}</Text>
            </Table.Td>
            <Table.Td w="1%">
              <CopyButton value={row.value} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      size="sm"
                      onClick={copy}
                      aria-label={`Copy ${row.label}`}
                    >
                      {copied ? <IconCheck size="1rem" /> : <IconCopy size="1rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Table.Td>
            <Table.Td>
              <Text size="sm" ff="monospace" style={{ overflowWrap: "anywhere" }}>{row.value}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export interface Fact {
  label: string;
  value: string;
}
