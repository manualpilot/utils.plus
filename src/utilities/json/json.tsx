import { Box, Button, Card, Group, Paper, Select, Stack } from "@mantine/core";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import { EDITOR_STYLE } from "../../common/editor-theme";
import { useInitialHashState, useRegisterShareState } from "../../common/share-state";
import { UtilityTitle } from "../../common/utility-title";
import { IconBrackets, IconCode, IconIndentDecrease, IconMinimize, IconSortAscendingLetters } from "../../icons";
import { sortKeys } from "./document";
import { EDITOR_EXTENSIONS } from "./editor";

export default function Json() {
  const initialState = useInitialHashState<{
    value?: string;
    indentSize?: string;
  }>();

  const [initialValue] = useState(() => initialState?.value ?? "{\n  \"hello\": \"world\"\n}");
  const valueRef = useRef(initialValue);
  const viewRef = useRef<EditorView | null>(null);

  const [indentSize, setIndentSize] = useState(initialState?.indentSize ?? "2");

  const syncShareState = useRegisterShareState(() => ({ value: valueRef.current, indentSize }));

  useEffect(() => () => {
    self.editorView = undefined;
  }, []);

  const handleChange = useCallback((next: string) => {
    valueRef.current = next;
    syncShareState();
  }, [syncShareState]);

  const replaceValue = useCallback((next: string) => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
    });
  }, []);

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(valueRef.current);
      replaceValue(JSON.stringify(parsed, null, parseInt(indentSize, 10)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSort = () => {
    try {
      const parsed = JSON.parse(valueRef.current);
      replaceValue(JSON.stringify(sortKeys(parsed), null, parseInt(indentSize, 10)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(valueRef.current);
      replaceValue(JSON.stringify(parsed));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEscape = () => {
    replaceValue(JSON.stringify(valueRef.current));
  };

  const handleUnescape = () => {
    try {
      const parsed = JSON.parse(valueRef.current);
      if (typeof parsed === "string") {
        replaceValue(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Stack flex={1} mih={0} gap="md">
      <UtilityTitle directory="json">JSON</UtilityTitle>

      <Card withBorder shadow="sm" radius="md">
        <Group align="flex-end" gap="xl">
          <Group align="flex-end" gap="sm">
            <Select
              label="Format Indent"
              data={[
                { value: "2", label: "2 Spaces" },
                { value: "4", label: "4 Spaces" },
                { value: "8", label: "8 Spaces" },
              ]}
              value={indentSize}
              onChange={(val) => val && setIndentSize(val)}
              allowDeselect={false}
              w={120}
            />
            <Button onClick={handleFormat} leftSection={<IconIndentDecrease size="1rem" />}>
              Format
            </Button>
            <Button onClick={handleSort} leftSection={<IconSortAscendingLetters size="1rem" />}>
              Sort Keys
            </Button>
          </Group>

          <Group align="flex-end" gap="sm">
            <Button onClick={handleMinify} leftSection={<IconMinimize size="1rem" />}>
              Minify
            </Button>
            <Button onClick={handleEscape} leftSection={<IconCode size="1rem" />}>
              Escape
            </Button>
            <Button onClick={handleUnescape} leftSection={<IconBrackets size="1rem" />}>
              Unescape
            </Button>
          </Group>
        </Group>
      </Card>

      <Paper withBorder shadow="sm" radius="md" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <Box style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <CodeMirror
            value={initialValue}
            height="100%"
            style={EDITOR_STYLE}
            theme="dark"
            extensions={EDITOR_EXTENSIONS}
            onCreateEditor={(view) => {
              viewRef.current = view;
              self.editorView = view;
            }}
            onChange={handleChange}
          />
        </Box>
      </Paper>
    </Stack>
  );
}

declare global {
  var editorView: EditorView | undefined;
}
