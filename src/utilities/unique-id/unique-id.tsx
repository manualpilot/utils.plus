import { ActionIcon, Box, Button, Card, Combobox, CopyButton, Group, NumberInput, Select, Stack, Textarea, TextInput, Title, Tooltip, useCombobox } from "@mantine/core";
import { useCallback, useLayoutEffect, useState } from "react";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconCheck, IconCopy, IconRefresh } from "../../icons";
import { clampCount, clampLocalId, generateId, namespaceProblem, parseCount, parseLocalId, pickDomain, pickText, pickType, prefixProblem } from "./generate";
import { ID_TYPES, LOCAL_DOMAINS, MAX_COUNT, MAX_LOCAL_ID, STANDARD_NAMESPACES } from "./types";

export default function UniqueId() {
  const initialState = useInitialHashState<{
    type?: string;
    count?: number;
    name?: string;
    namespace?: string;
    prefix?: string;
    domain?: string;
    localId?: number;
  }>();

  const [type, setType] = useState(pickType(initialState?.type));
  const [count, setCount] = useState<number | string>(clampCount(initialState?.count));
  const [name, setName] = useState(pickText(initialState?.name));
  const [namespace, setNamespace] = useState(pickText(initialState?.namespace));
  const [prefix, setPrefix] = useState(pickText(initialState?.prefix));
  const [domain, setDomain] = useState(pickDomain(initialState?.domain));
  const [localId, setLocalId] = useState<number | string>(clampLocalId(initialState?.localId));
  const [generatedIds, setGeneratedIds] = useState("");
  const [asked, setAsked] = useState(false);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const options = STANDARD_NAMESPACES.map((item) => (
    <Combobox.Option value={item.value} key={item.value}>
      {item.label} ({item.value})
    </Combobox.Option>
  ));

  const isNamespaced = type === "uuid-v3" || type === "uuid-v5";
  const isDceSecurity = type === "uuid-v2";
  const isTypeId = type === "typeid";

  useRegisterShareState(() => ({
    type,
    count: isNamespaced ? undefined : count,
    name: isNamespaced && name ? name : undefined,
    namespace: isNamespaced && namespace ? namespace : undefined,
    prefix: isTypeId && prefix ? prefix : undefined,
    domain: isDceSecurity ? domain : undefined,
    localId: isDceSecurity ? localId : undefined,
  }));

  const parsedCount = isNamespaced ? 1 : parseCount(count);
  const countError = parsedCount === null ? `Enter a count between 1 and ${MAX_COUNT}` : null;
  const missingName = isNamespaced && !name;
  const namespaceIssue = isNamespaced ? namespaceProblem(namespace) : null;
  const nameError = missingName && asked ? "Required" : null;
  const namespaceError = asked || namespace ? namespaceIssue : null;
  const hasPairError = Boolean(nameError || namespaceError);
  const prefixError = isTypeId ? prefixProblem(prefix) : null;
  const parsedLocalId = isDceSecurity ? parseLocalId(localId) : 0;
  const localIdError = parsedLocalId === null ? `Enter an ID between 0 and ${MAX_LOCAL_ID}` : null;

  const regenerate = useCallback(() => {
    if (parsedCount === null || parsedLocalId === null || missingName || namespaceIssue || prefixError) {
      setGeneratedIds("");
      return;
    }
    const settings = { name, namespace, prefix, domain, localId: parsedLocalId };
    const ids: string[] = [];
    for (let i = 0; i < parsedCount; i++) ids.push(generateId(type, settings));
    setGeneratedIds(ids.join("\n"));
  }, [parsedCount, parsedLocalId, missingName, namespaceIssue, prefixError, type, name, namespace, prefix, domain]);

  useLayoutEffect(regenerate, [regenerate]);

  const generate = () => {
    setAsked(true);
    regenerate();
  };

  const handleTypeChange = (value: string | null) => {
    setType(pickType(value));
    setAsked(false);
  };

  return (
    <Stack gap="md">
      <UtilityTitle directory="unique-id">Generate Unique ID</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack>
          <Box className={countError ? "settings-row has-error" : "settings-row"} mb={countError ? "md" : 0}>
            <Select
              label="ID Type"
              data={ID_TYPES}
              value={type}
              onChange={handleTypeChange}
              allowDeselect={false}
            />
            <NumberInput
              label="Count"
              description={isNamespaced ? "Namespaced UUIDs are deterministic" : ""}
              value={isNamespaced ? 1 : count}
              onChange={setCount}
              min={1}
              max={MAX_COUNT}
              allowDecimal={false}
              allowNegative={false}
              stepHoldDelay={500}
              stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
              disabled={isNamespaced}
              error={countError}
              classNames={{ root: "relative-root", error: "absolute-error" }}
            />
          </Box>

          {isNamespaced && (
            <Box
              className={hasPairError ? "settings-row has-error" : "settings-row"}
              mb={hasPairError ? "md" : 0}
            >
              <Combobox
                store={combobox}
                onOptionSubmit={(val) => {
                  setNamespace(val);
                  combobox.closeDropdown();
                }}
              >
                <Combobox.Target>
                  <TextInput
                    label="Namespace (UUID)"
                    placeholder="e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8"
                    value={namespace}
                    onChange={(e) => {
                      setNamespace(e.currentTarget.value);
                      combobox.openDropdown();
                      combobox.updateSelectedOptionIndex();
                    }}
                    onClick={() => combobox.openDropdown()}
                    onFocus={() => combobox.openDropdown()}
                    onBlur={() => combobox.closeDropdown()}
                    error={namespaceError}
                    classNames={{ root: "relative-root", error: "absolute-error" }}
                  />
                </Combobox.Target>
                <Combobox.Dropdown>
                  <Combobox.Options>
                    {options}
                  </Combobox.Options>
                </Combobox.Dropdown>
              </Combobox>
              <TextInput
                label="Name"
                placeholder="e.g. example.com"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                error={nameError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {isDceSecurity && (
            <Box
              className={localIdError ? "settings-row has-error" : "settings-row"}
              mb={localIdError ? "md" : 0}
            >
              <Select
                label="Local Domain"
                data={LOCAL_DOMAINS}
                value={domain}
                onChange={(value) => setDomain(pickDomain(value))}
                allowDeselect={false}
              />
              <NumberInput
                label="Local ID"
                description="The UID, GID or organisation ID to embed"
                value={localId}
                onChange={setLocalId}
                min={0}
                max={MAX_LOCAL_ID}
                allowDecimal={false}
                allowNegative={false}
                stepHoldDelay={500}
                stepHoldInterval={(t) => Math.max(1000 / t ** 2, 75)}
                error={localIdError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          {isTypeId && (
            <Box
              className={prefixError ? "settings-row has-error" : "settings-row"}
              mb={prefixError ? "md" : 0}
            >
              <TextInput
                label="Prefix"
                description="Left off the ID when blank"
                placeholder="e.g. user"
                value={prefix}
                onChange={(e) => setPrefix(e.currentTarget.value)}
                error={prefixError}
                classNames={{ root: "relative-root", error: "absolute-error" }}
              />
            </Box>
          )}

          <Group justify="flex-end">
            <Button onClick={generate}>Generate</Button>
          </Group>
        </Stack>
      </Card>

      {generatedIds && (
        <Card withBorder shadow="sm" radius="md">
          <Stack>
            <Group justify="space-between">
              <Title order={4}>{parsedCount === 1 ? "Result" : "Results"}</Title>
              <Group gap="xs">
                {!isNamespaced && (
                  <Tooltip label="Regenerate" withArrow position="left">
                    <ActionIcon
                      color="gray"
                      variant="subtle"
                      onClick={regenerate}
                      aria-label="Regenerate IDs"
                    >
                      <IconRefresh size="1.2rem" />
                    </ActionIcon>
                  </Tooltip>
                )}
                <CopyButton value={generatedIds} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy"} withArrow position="left">
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        variant="subtle"
                        onClick={copy}
                        aria-label="Copy IDs"
                      >
                        {copied ? <IconCheck size="1.2rem" /> : <IconCopy size="1.2rem" />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <Textarea
              value={generatedIds}
              aria-label="Generated IDs"
              readOnly
              autosize
              minRows={1}
              maxRows={15}
              spellCheck={false}
              styles={{ input: { fontFamily: "monospace" } }}
            />
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
