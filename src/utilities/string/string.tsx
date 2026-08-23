import { ActionIcon, Box, Card, CopyButton, Group, NumberInput, Select, Stack, Textarea, Title, Tooltip } from "@mantine/core";
import { useMemo, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconArrowUp, IconCheck, IconCopy, IconRefresh, IconX } from "../../icons";
import { counts } from "./count";
import { DEFAULT_WIDTH, defaultVariant, hasVariant, isOperation, isRandom, type Operation, OPERATION_GROUPS, OPERATIONS, takesWidth } from "./operations";
import { NOTHING, transform } from "./transform";

export default function StringUtility() {
  const initialState = useInitialHashState<{
    operation?: string;
    variant?: string;
    width?: string;
    input?: string;
  }>();

  const initialOperation: Operation = isOperation(initialState?.operation) ? initialState.operation : "camel";
  const sharedVariant = initialState?.variant;

  const [operation, setOperation] = useState<Operation>(initialOperation);
  const [variant, setVariant] = useState<string>(
    sharedVariant !== undefined && hasVariant(initialOperation, sharedVariant)
      ? sharedVariant
      : defaultVariant(initialOperation),
  );
  const [width, setWidth] = useState(initialState?.width ?? DEFAULT_WIDTH);
  const [input, setInput] = useState(initialState?.input ?? "");
  const [draw, setDraw] = useState(0);

  const spec = OPERATIONS[operation];

  useRegisterShareState(() => ({
    operation,
    variant: spec.variants.length > 0 ? variant : undefined,
    width: takesWidth(operation) ? width : undefined,
    input: input || undefined,
  }));

  const { output, error } = useMemo(
    () => transform(input, operation, variant, width),
    [input, operation, variant, width, draw],
  );

  const inputCounts = useMemo(() => counts(input), [input]);
  const outputCounts = useMemo(() => counts(output), [output]);
  const canChain = output !== "" && error === "";

  const handleOperationChange = (value: string | null) => {
    if (!isOperation(value)) return;
    setOperation(value);
    setVariant(defaultVariant(value));
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="string">String</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Box className="settings-row">
          <Select
            label="Operation"
            data={OPERATION_GROUPS}
            value={operation}
            onChange={handleOperationChange}
            allowDeselect={false}
            searchable
          />
          {spec.variants.length > 0 && (
            <Select
              label="Variant"
              description={spec.hint}
              data={[...spec.variants]}
              value={variant}
              onChange={(value) => value && setVariant(value)}
              allowDeselect={false}
            />
          )}
          {takesWidth(operation) && (
            <NumberInput
              label="Column"
              description="Where a line is wrapped"
              value={width}
              onChange={(value) => setWidth(String(value))}
              allowDecimal={false}
              min={1}
            />
          )}
        </Box>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={4}>Input</Title>
            <Tooltip label="Clear" withArrow position="left">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setInput("")}
                disabled={input === ""}
                aria-label="Clear input"
              >
                <IconX size="1.2rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Text to transform"
            aria-label="Input"
            autosize
            minRows={5}
            maxRows={12}
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Stack>
      </Card>

      <Group justify="center">
        <Tooltip label="Use the output as the input" withArrow>
          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            onClick={() => setInput(output)}
            disabled={!canChain}
            aria-label="Use the output as the input"
          >
            <IconArrowUp size="1.2rem" />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={4}>Output</Title>
            <Group gap={4}>
              {isRandom(operation) && (
                <Tooltip label="Shuffle again" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => setDraw(draw + 1)}
                    disabled={input === ""}
                    aria-label="Shuffle again"
                  >
                    <IconRefresh size="1.2rem" />
                  </ActionIcon>
                </Tooltip>
              )}
              <CopyButton value={output} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                    <ActionIcon
                      color={copied ? "teal" : "gray"}
                      variant="subtle"
                      onClick={copy}
                      disabled={output === ""}
                      aria-label="Copy output"
                    >
                      {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Group>
          <Textarea
            value={output}
            readOnly
            error={error || undefined}
            aria-label="Output"
            autosize
            minRows={5}
            maxRows={12}
            styles={{ input: { fontFamily: "monospace" } }}
          />
        </Stack>
      </Card>

      <Box className="card-columns">
        <Card withBorder shadow="sm" radius="md" data-counts="input">
          <Stack gap="xs">
            <Title order={4}>Input counts</Title>
            <FactTable rows={inputCounts} />
          </Stack>
        </Card>
        <Card withBorder shadow="sm" radius="md" data-counts="output">
          <Stack gap="xs">
            <Title order={4}>Output counts</Title>
            <FactTable rows={outputCounts} />
          </Stack>
        </Card>
      </Box>
    </Stack>
  );
}
