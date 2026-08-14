import { Box, Paper } from "@mantine/core";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, useCallback, useRef, useState } from "react";

export function Panes({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const panes = useRef<HTMLDivElement>(null);

  const resize = useCallback((width: number) => {
    const box = panes.current?.getBoundingClientRect();
    if (!box) return;
    const widest = Math.max(MIN_PANEL_WIDTH, box.width - LEFT_OF_PANEL);
    setPanelWidth(Math.min(Math.max(width, MIN_PANEL_WIDTH), widest));
  }, []);

  const handleGripDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleGripMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = panes.current?.getBoundingClientRect();
    if (box) resize(box.right - event.clientX);
  }, [resize]);

  const handleGripUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleGripKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowLeft" ? KEY_STEP : event.key === "ArrowRight" ? -KEY_STEP : 0;
    if (step === 0) return;
    event.preventDefault();
    resize(panelWidth + step);
  };

  return (
    <Box ref={panes} className="split-panes" style={{ "--split-panel-width": `${panelWidth}px` } as CSSProperties}>
      {children}

      <div
        className="split-grip"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the variables panel"
        tabIndex={0}
        onPointerDown={handleGripDown}
        onPointerMove={handleGripMove}
        onPointerUp={handleGripUp}
        onKeyDown={handleGripKey}
      />

      <Paper
        withBorder
        shadow="sm"
        radius="md"
        className="split-panel"
        style={{ position: "relative", overflow: "hidden" }}
      >
        <Box style={PANE_INSET}>{panel}</Box>
      </Paper>
    </Box>
  );
}

export const PANE_INSET: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  flexDirection: "column",
};

const DEFAULT_PANEL_WIDTH = 320;
const MIN_PANEL_WIDTH = 160;

const LEFT_OF_PANEL = 208;

const KEY_STEP = 24;
