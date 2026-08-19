import { Box, Button, Card, Group, Paper, Select, Stack, Text } from "@mantine/core";
import CodeMirror, { EditorView, type Extension, type StateEffectType } from "@uiw/react-codemirror";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_STYLE } from "../../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconArrowsLeftRight, IconGitCompare } from "../../icons";
import { LEFT_MARKS, NO_MARKS, paneExtensions, replaceDoc, RIGHT_MARKS } from "./editor";
import { isLanguage, LANGUAGE_OPTIONS, LANGUAGES } from "./languages";
import { type DiffResult, diffText, type LineMark, plural, summarise } from "./myers";
import { SAMPLE_LEFT, SAMPLE_RIGHT } from "./samples";

export default function Diff() {
  const initialState = useInitialHashState<{
    left?: string;
    right?: string;
    language?: string;
    diffed?: boolean;
  }>();

  const [initialLeft] = useState(() => initialState?.left ?? SAMPLE_LEFT);
  const [initialRight] = useState(() => initialState?.right ?? SAMPLE_RIGHT);
  const leftText = useRef(initialLeft);
  const rightText = useRef(initialRight);
  const leftView = useRef<EditorView | null>(null);
  const rightView = useRef<EditorView | null>(null);
  const pendingDiff = useRef(initialState?.diffed === true);
  const showing = useRef(false);

  const sharedLanguage = initialState?.language;
  const [language, setLanguage] = useState(() => isLanguage(sharedLanguage) ? sharedLanguage : "text");
  const [languageSupport, setLanguageSupport] = useState<Extension | null>(null);
  const [result, setResult] = useState<DiffResult | null>(null);

  const syncShareState = useRegisterShareState(() => ({
    left: leftText.current,
    right: rightText.current,
    language,
    diffed: result ? true : undefined,
  }));

  useEffect(() => {
    const load = LANGUAGES.find((entry) => entry.value === language)?.load;
    if (!load) {
      setLanguageSupport(null);
      return;
    }

    let current = true;
    load().then((support) => {
      if (current) setLanguageSupport(support);
    });
    return () => {
      current = false;
    };
  }, [language]);

  useEffect(() => () => {
    self.diffEditors = undefined;
  }, []);

  const runDiff = useCallback(() => {
    const next = diffText(leftText.current, rightText.current);
    showing.current = true;
    setResult(next);
    leftView.current?.dispatch({ effects: LEFT_MARKS.set.of(next.left) });
    rightView.current?.dispatch({ effects: RIGHT_MARKS.set.of(next.right) });
  }, []);

  const publishViews = useCallback(() => {
    const left = leftView.current;
    const right = rightView.current;
    if (!left || !right) return;

    self.diffEditors = { left, right };
    if (!pendingDiff.current) return;
    pendingDiff.current = false;
    runDiff();
  }, [runDiff]);

  const handleLeftCreate = useCallback((view: EditorView) => {
    leftView.current = view;
    publishViews();
  }, [publishViews]);

  const handleRightCreate = useCallback((view: EditorView) => {
    rightView.current = view;
    publishViews();
  }, [publishViews]);

  const clearResult = useCallback((standing: EditorView | null, set: StateEffectType<LineMark[]>) => {
    if (!showing.current) return;
    showing.current = false;
    setResult(null);
    standing?.dispatch({ effects: set.of(NO_MARKS) });
  }, []);

  const handleLeftChange = useCallback((next: string) => {
    leftText.current = next;
    clearResult(rightView.current, RIGHT_MARKS.set);
    syncShareState();
  }, [clearResult, syncShareState]);

  const handleRightChange = useCallback((next: string) => {
    rightText.current = next;
    clearResult(leftView.current, LEFT_MARKS.set);
    syncShareState();
  }, [clearResult, syncShareState]);

  const handleSwap = useCallback(() => {
    const left = leftText.current;
    const right = rightText.current;
    replaceDoc(leftView.current, right);
    replaceDoc(rightView.current, left);
  }, []);

  const leftExtensions = useMemo(() => paneExtensions(LEFT_MARKS.extension, languageSupport), [languageSupport]);
  const rightExtensions = useMemo(() => paneExtensions(RIGHT_MARKS.extension, languageSupport), [languageSupport]);

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle directory="diff">Diff</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Group align="flex-end" gap="xl" justify="space-between">
          <Group align="flex-end" gap="sm">
            <Select
              label="Language"
              data={LANGUAGE_OPTIONS}
              value={language}
              onChange={(value) => value && setLanguage(value)}
              allowDeselect={false}
              searchable
              w={180}
            />
            <Button onClick={runDiff} leftSection={<IconGitCompare size="1rem" />}>
              Diff
            </Button>
            <Button variant="default" onClick={handleSwap} leftSection={<IconArrowsLeftRight size="1rem" />}>
              Swap
            </Button>
          </Group>
          {result && <Text size="sm" c="dimmed">{summarise(result)}</Text>}
        </Group>
      </Card>

      <Box className="editor-panes">
        <DiffPane
          label="Original"
          note={result && result.left.length > 0 ? `${plural(result.left.length, "line")} removed` : null}
          initialValue={initialLeft}
          extensions={leftExtensions}
          onCreateEditor={handleLeftCreate}
          onChange={handleLeftChange}
        />
        <DiffPane
          label="Changed"
          note={result && result.right.length > 0 ? `${plural(result.right.length, "line")} added` : null}
          initialValue={initialRight}
          extensions={rightExtensions}
          onCreateEditor={handleRightCreate}
          onChange={handleRightChange}
        />
      </Box>
    </Stack>
  );
}

interface DiffPaneProps {
  label: string;
  note: ReactNode;
  initialValue: string;
  extensions: Extension[];
  onCreateEditor: (view: EditorView) => void;
  onChange: (value: string) => void;
}

function DiffPane({ label, note, initialValue, extensions, onCreateEditor, onChange }: DiffPaneProps) {
  return (
    <Stack gap="xs" mih={0}>
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Text size="sm" fw={500}>{label}</Text>
        {note && <Text size="sm" c="dimmed">{note}</Text>}
      </Group>
      <Paper withBorder shadow="sm" radius="md" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <CodeMirror
            value={initialValue}
            height="100%"
            style={EDITOR_STYLE}
            theme="dark"
            extensions={extensions}
            onCreateEditor={onCreateEditor}
            onChange={onChange}
          />
        </Box>
      </Paper>
    </Stack>
  );
}

declare global {
  var diffEditors: { left: EditorView; right: EditorView } | undefined;
}
