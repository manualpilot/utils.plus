import { Badge, Box, Card, CheckIcon, type ComboboxLikeRenderOptionInput, Group, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { type ChangeEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FactTable } from "../../common/fact-table";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { NOWHERE, type Place, place, zoneWithOffset } from "./geo";
import { exampleNumber, type Reading, readNumber } from "./parse";
import { findRegion, pickRegion, REGION_OPTIONS, regionFilter, regionForInput, withRegion } from "./regions";
import type { Short } from "./short";
import { retype, retypeAll } from "./typing";

export default function PhoneNumber() {
  const initialState = useInitialHashState<{ number?: string; region?: string }>();

  const [input, setInput] = useState(() => typeof initialState?.number === "string" ? initialState.number : "");
  const [region, setRegion] = useState(() => pickRegion(initialState?.region));

  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  useRegisterShareState(() => ({ number: input || undefined, region: region.code }));

  const result = useMemo(() => readNumber(input, region), [input, region]);

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = event.currentTarget;
    const named = regionForInput(value, region.code);
    const next = named ? pickRegion(named) : region;

    const typed = retype({ value, caret: selectionStart ?? value.length, previous: input }, next.code);
    setInput(typed.value);
    caretRef.current = typed.caret;
    if (next !== region) setRegion(next);
  };

  const onRegion = (code: string | null) => {
    const picked = pickRegion(code);
    setRegion(picked);
    setInput((current) => retypeAll(withRegion(current, picked), picked.code));
  };

  useLayoutEffect(() => {
    const caret = caretRef.current;
    caretRef.current = null;
    if (caret === null || inputRef.current === null || document.activeElement !== inputRef.current) return;
    inputRef.current.setSelectionRange(caret, caret);
  });

  const error = result.kind === "error" ? result.message : undefined;

  return (
    <Stack gap="md">
      <UtilityTitle directory="phone-number">Phone Number</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Box className={error ? "settings-row has-error" : "settings-row"} mb={error ? "md" : 0}>
          <Select
            label="Country"
            description="Searched by name, code or dialling code"
            data={REGION_OPTIONS}
            value={region.code}
            onChange={onRegion}
            filter={regionFilter}
            leftSection={<Text span>{region.flag}</Text>}
            renderOption={renderRegionOption}
            allowDeselect={false}
            searchable
            selectFirstOptionOnChange
            nothingFoundMessage="No country by that name"
          />
          <TextInput
            label="Phone number"
            description={`Dialling code +${region.callingCode}`}
            ref={inputRef}
            value={input}
            onChange={onInput}
            placeholder={exampleNumber(region)}
            error={error}
            classNames={{ root: "relative-root", error: "absolute-error" }}
            spellCheck={false}
            autoCapitalize="off"
            inputMode="tel"
            type="tel"
          />
        </Box>
      </Card>

      {result.kind === "reading" && <Analysis reading={result.reading} />}
      {result.kind === "short" && <ShortNumber short={result.short} />}
    </Stack>
  );
}

function Analysis({ reading }: { reading: Reading }) {
  return (
    <>
      <Card withBorder shadow="sm" radius="md" data-region={reading.region?.code ?? ""}>
        <Stack gap="sm">
          <Group gap="md" align="center" wrap="nowrap">
            <Text span className="phone-number-flag">{reading.region?.flag}</Text>
            <Box miw={0}>
              <Text className="phone-number-figure">{reading.formats[1].value}</Text>
              <Text size="sm" c="dimmed">{reading.region?.name ?? "No country of its own"}</Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Badge variant="light" color={reading.valid ? "teal" : "orange"} size="sm" tt="none">
              {reading.valid ? "Valid" : "Not a valid number"}
            </Badge>
            {!reading.valid && <Marker>{reading.possibility}</Marker>}
            <Marker>{reading.type}</Marker>
          </Group>
        </Stack>
      </Card>

      <Box className="card-columns">
        <Card withBorder shadow="sm" radius="md">
          <Stack gap="sm">
            <Title order={4}>Formats</Title>
            <FactTable rows={reading.formats} />
          </Stack>
        </Card>

        <Card withBorder shadow="sm" radius="md">
          <Stack gap="sm">
            <Title order={4}>Parts</Title>
            <FactTable
              rows={[
                { label: "Country calling code", value: reading.callingCode },
                { label: "Region", value: reading.region ? `${reading.region.code} — ${reading.region.name}` : "" },
                { label: "National number", value: reading.nationalNumber },
                { label: "Area code", value: reading.areaCode },
                { label: "National destination code", value: reading.destinationCode },
                { label: "Carrier selection code", value: reading.carrierCode },
                { label: "Extension", value: reading.extension },
              ]}
            />
          </Stack>
        </Card>
      </Box>

      <Geography reading={reading} />
    </>
  );
}

function Geography({ reading }: { reading: Reading }) {
  const [found, setFound] = useState<{ number: string; place: Place }>();

  useEffect(() => {
    if (!reading.valid) return;
    const { number } = reading;
    const asked = (place: Place) => setFound({ number: number.number, place });
    place(number).then(asked, () => asked(NOWHERE));
  }, [reading.number, reading.valid]);

  const showing = reading.valid && found?.number === reading.number.number ? found.place : NOWHERE;
  const zones = showing.zones.map(zoneWithOffset).join(", ");
  if (!showing.location && !showing.network && !zones) return null;

  return (
    <Card withBorder shadow="sm" radius="md" data-place>
      <Stack gap="sm">
        <Title order={4}>Place</Title>
        <FactTable
          rows={[
            { label: "Location", value: showing.location },
            { label: showing.zones.length > 1 ? "Time zones" : "Time zone", value: zones },
            { label: "Carrier", value: showing.network },
          ]}
        />
      </Stack>
    </Card>
  );
}

function ShortNumber({ short }: { short: Short }) {
  return (
    <Card withBorder shadow="sm" radius="md" data-short-number data-region={short.region.code}>
      <Stack gap="sm">
        <Group gap="md" align="center" wrap="nowrap">
          <Text span className="phone-number-flag">{short.region.flag}</Text>
          <Box miw={0}>
            <Text className="phone-number-figure">{short.digits}</Text>
            <Text size="sm" c="dimmed">Short code in {short.region.name}</Text>
          </Box>
        </Group>
        <Group gap="xs">
          {short.emergency && <Badge variant="light" color="orange" size="sm" tt="none">Emergency</Badge>}
          <Marker>{short.cost}</Marker>
          {short.carrierSpecific && <Marker>Carrier specific</Marker>}
          {short.smsService && <Marker>Takes SMS</Marker>}
        </Group>
        <Text size="sm" c="dimmed">
          Dialled inside {short.region.name} and nowhere else — a short code has no international form.
        </Text>
      </Stack>
    </Card>
  );
}

function renderRegionOption({ option, checked }: ComboboxLikeRenderOptionInput<{ value: string; label: string }>) {
  const region = findRegion(option.value);
  return (
    <Group gap="xs" wrap="nowrap" flex={1}>
      {checked && <CheckIcon size={12} />}
      <Text span>{region?.flag}</Text>
      <Text size="sm">{option.label}</Text>
      <Text size="sm" c="dimmed" ml="auto">+{region?.callingCode}</Text>
    </Group>
  );
}

function Marker({ children }: { children: ReactNode }) {
  return <Badge variant="light" color="gray" size="sm" tt="none">{children}</Badge>;
}
