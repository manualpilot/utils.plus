import { ActionIcon, Box, Card, CopyButton, Group, Select, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy } from "../../icons";
import { formatAmount, parseAmount } from "./amount";
import { CATEGORY_OPTIONS, DEFAULT_AMOUNT, pickCategory, pickUnit, unitOptions } from "./categories";
import { convert, type Unit } from "./unit";

export default function Converter() {
  const initialState = useInitialHashState<{ category?: string; unit?: string; amount?: string }>();

  const initialCategory = pickCategory(initialState?.category);

  const [category, setCategory] = useState(initialCategory);
  const [unit, setUnit] = useState(() => pickUnit(initialCategory, initialState?.unit));
  const [amount, setAmount] = useState(typeof initialState?.amount === "string" ? initialState.amount : DEFAULT_AMOUNT);

  useRegisterShareState(() => ({ category: category.id, unit: unit.id, amount }));

  const value = parseAmount(amount);
  const amountError = value === null && amount.trim() !== "" ? "Enter a number" : null;

  const handleCategoryChange = (id: string | null) => {
    const next = pickCategory(id);
    setCategory(next);
    setUnit(pickUnit(next, null));
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="converter">Unit Converter</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Box className={amountError ? "settings-row has-error" : "settings-row"} mb={amountError ? "md" : 0}>
          <Select
            label="Category"
            data={CATEGORY_OPTIONS}
            value={category.id}
            onChange={handleCategoryChange}
            allowDeselect={false}
          />
          <TextInput
            label="Amount"
            description="Decimal, exponent or hexadecimal"
            placeholder="e.g. 1.5 or 2e3"
            value={amount}
            onChange={(event) => setAmount(event.currentTarget.value)}
            error={amountError}
            spellCheck={false}
            autoComplete="off"
            inputMode="decimal"
            classNames={{ root: "relative-root", error: "absolute-error" }}
            styles={{ input: { fontFamily: "monospace" } }}
          />
          <Select
            label="Unit"
            data={unitOptions(category)}
            value={unit.id}
            onChange={(id) => setUnit(pickUnit(category, id))}
            allowDeselect={false}
            searchable
            nothingFoundMessage="No unit by that name"
          />
        </Box>
      </Card>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Title order={4}>{category.label}</Title>
          <Box className="converter-units">
            {category.units.map((item) => (
              <Conversion
                key={item.id}
                unit={item}
                value={value === null ? null : convert(value, unit, item)}
                source={item.id === unit.id}
              />
            ))}
          </Box>
        </Stack>
      </Card>
    </Stack>
  );
}

function Conversion({ unit, value, source }: ConversionProps) {
  const written = value === null ? "" : formatAmount(value);

  return (
    <Box className="converter-unit" data-unit={unit.id} data-source={source || undefined}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="xs" c="dimmed" truncate>{unit.name}</Text>
        <CopyButton value={written} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                size="sm"
                onClick={copy}
                disabled={!written}
                aria-label={`Copy the ${unit.name} value`}
              >
                {copied ? <IconCheck size="1rem" /> : <IconCopy size="1rem" />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Group gap={6} align="baseline" wrap="nowrap">
        <Text ff="monospace" className="converter-value">{written || "—"}</Text>
        <Text size="sm" c="dimmed">{unit.symbol}</Text>
      </Group>
    </Box>
  );
}

interface ConversionProps {
  unit: Unit;
  value: number | null;
  source: boolean;
}
