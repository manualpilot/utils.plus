import { Box, Card, Chip, Code, Group, Paper, Stack, Text, Tooltip } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDITOR_STYLE } from "../../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { groupColour, MATCH_COLOUR, PATTERN_EXTENSIONS, PATTERN_SETUP, setMatches, SUBJECT_EXTENSIONS } from "./editor";
import { type CaptureGroup, type ExplainNode, explainPattern } from "./explain";
import { chooseFlags, FLAGS, normaliseFlags } from "./flags";
import { findMatches, type MatchSpan, summarise } from "./match";
import { SAMPLE_FLAGS, SAMPLE_PATTERN, SAMPLE_TEXT } from "./sample";

export default function Regex() {
  const initialState = useInitialHashState<{
    pattern?: string;
    flags?: string;
    text?: string;
  }>();

  const [initialPattern] = useState(() => initialState?.pattern ?? SAMPLE_PATTERN);
  const [initialText] = useState(() => initialState?.text ?? SAMPLE_TEXT);
  const [pattern, setPattern] = useState(initialPattern);
  const [text, setText] = useState(initialText);
  const [flags, setFlags] = useState(() => normaliseFlags(initialState?.flags ?? SAMPLE_FLAGS));

  const patternEditor = useRef<EditorView | null>(null);
  const subjectEditor = useRef<EditorView | null>(null);

  const result = useMemo(() => findMatches(pattern, flags, text), [pattern, flags, text]);
  const standingMatches = useRef<MatchSpan[]>(result.matches);
  const explanation = useMemo(() => explainPattern(pattern, flags), [pattern, flags]);
  const error = result.error ?? explanation.error;

  useRegisterShareState(() => ({ pattern, flags, text }));

  useEffect(() => {
    standingMatches.current = result.matches;
    subjectEditor.current?.dispatch({ effects: setMatches.of(result.matches) });
  }, [result]);

  useEffect(() => () => {
    self.regexEditors = undefined;
  }, []);

  const publishEditors = useCallback(() => {
    const patternView = patternEditor.current;
    const subjectView = subjectEditor.current;
    if (patternView && subjectView) self.regexEditors = { pattern: patternView, subject: subjectView };
  }, []);

  const handlePatternCreate = useCallback((view: EditorView) => {
    patternEditor.current = view;
    publishEditors();
  }, [publishEditors]);

  const handleSubjectCreate = useCallback((view: EditorView) => {
    subjectEditor.current = view;
    view.dispatch({ effects: setMatches.of(standingMatches.current) });
    publishEditors();
  }, [publishEditors]);

  const handleFlags = useCallback((next: string[]) => setFlags((current) => chooseFlags(current, next)), []);

  return (
    <Stack gap="md">
      <UtilityTitle directory="regex">Regex</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap="sm">
          <Text size="sm" fw={500}>Pattern</Text>

          <Box className="regex-pattern">
            <Text className="regex-delimiter">/</Text>
            <Box className="regex-pattern-box">
              <CodeMirror
                value={initialPattern}
                style={EDITOR_STYLE}
                theme="dark"
                basicSetup={PATTERN_SETUP}
                extensions={PATTERN_EXTENSIONS}
                onCreateEditor={handlePatternCreate}
                onChange={setPattern}
              />
            </Box>
            <Text className="regex-delimiter">/{flags}</Text>
          </Box>

          {error && <Text size="sm" c="red">{error}</Text>}

          <Chip.Group multiple value={[...flags]} onChange={handleFlags}>
            <Group gap="xs">
              {FLAGS.map((flag) => (
                <Tooltip key={flag.letter} label={`${flag.label} — ${flag.description}`} withArrow>
                  <Chip value={flag.letter} size="xs" variant="outline">{flag.letter}</Chip>
                </Tooltip>
              ))}
            </Group>
          </Chip.Group>
        </Stack>
      </Card>

      <Stack gap="xs">
        <Group justify="space-between" gap="sm" wrap="nowrap">
          <Text size="sm" fw={500}>Text</Text>
          {!error && pattern && <Text size="sm" c="dimmed">{summarise(result)}</Text>}
        </Group>

        <Paper withBorder shadow="sm" radius="md" className="regex-subject">
          <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <CodeMirror
              value={initialText}
              height="100%"
              style={EDITOR_STYLE}
              theme="dark"
              extensions={SUBJECT_EXTENSIONS}
              onCreateEditor={handleSubjectCreate}
              onChange={setText}
            />
          </Box>
        </Paper>

        <Legend captures={explanation.captures} />
      </Stack>

      <Card withBorder shadow="sm" radius="md">
        <Stack gap={4}>
          <Text size="sm" fw={500} mb={4}>Explanation</Text>
          {explanation.nodes.length > 0
            ? explanation.nodes.map((node, index) => <ExplainRow key={index} node={node} />)
            : (
              <Text size="sm" c="dimmed">
                {pattern
                  ? "There is nothing to take apart until the pattern parses."
                  : "Write a pattern above and it will be taken apart here."}
              </Text>
            )}
        </Stack>
      </Card>
    </Stack>
  );
}

function Legend({ captures }: { captures: CaptureGroup[] }) {
  if (captures.length === 0) return null;

  return (
    <Group gap="md" wrap="wrap">
      <Swatch colour={MATCH_COLOUR} label="Whole match" />
      {captures.map((capture) => (
        <Swatch
          key={capture.index}
          colour={groupColour(capture.index)}
          label={capture.name === null ? `Group ${capture.index}` : `Group ${capture.index} · ${capture.name}`}
        />
      ))}
    </Group>
  );
}

function Swatch({ colour, label }: { colour: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box className="regex-swatch" style={{ backgroundColor: colour }} />
      <Text size="xs" c="dimmed">{label}</Text>
    </Group>
  );
}

function ExplainRow({ node }: { node: ExplainNode }) {
  return (
    <Box>
      <Group gap="xs" wrap="nowrap" align="baseline">
        {node.raw && <Code className="regex-raw">{node.raw}</Code>}
        <Text size="sm">{node.label}</Text>
        {node.detail && <Text size="sm" c="dimmed">— {node.detail}</Text>}
      </Group>
      {node.children.length > 0 && (
        <Stack gap={4} className="regex-children" mt={4}>
          {node.children.map((child, index) => <ExplainRow key={index} node={child} />)}
        </Stack>
      )}
    </Box>
  );
}

declare global {
  var regexEditors: { pattern: EditorView; subject: EditorView } | undefined;
}
