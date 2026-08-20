import { Box, Paper } from "@mantine/core";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, useCallback, useRef, useState } from "react";

export function Panes({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const { pane, grip } = useGrip("row", panelWidth, setPanelWidth, { first: LEFT_OF_PANEL, second: MIN_PANEL_WIDTH });

  return (
    <Box ref={pane} className="split-panes" style={{ "--split-panel-width": `${panelWidth}px` } as CSSProperties}>
      {children}

      <div
        className="split-grip"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the variables panel"
        tabIndex={0}
        {...grip}
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

export function Split({ direction, label, initial, floors, first, second }: SplitProps) {
  const [size, setSize] = useState(initial);
  const { pane, grip } = useGrip(direction, size, setSize, floors);

  return (
    <Box
      ref={pane}
      className="split-pair"
      data-direction={direction}
      style={{ "--split-size": `${size}px` } as CSSProperties}
    >
      <div className="split-first">{first}</div>

      <div
        className="split-grip"
        data-direction={direction}
        role="separator"
        aria-orientation={direction === "row" ? "vertical" : "horizontal"}
        aria-label={label}
        tabIndex={0}
        {...grip}
      />

      <div className="split-second">{second}</div>
    </Box>
  );
}

interface SplitProps {
  direction: Direction;
  label: string;
  initial: number;
  floors: Floors;
  first: ReactNode;
  second: ReactNode;
}

type Direction = "row" | "column";

interface Floors {
  first: number;
  second: number;
}

function useGrip(direction: Direction, size: number, setSize: (size: number) => void, floors: Floors) {
  const pane = useRef<HTMLDivElement>(null);
  const row = direction === "row";

  const resize = useCallback((next: number) => {
    const box = pane.current?.getBoundingClientRect();
    if (!box) return;
    const whole = row ? box.width : box.height;
    const most = Math.max(floors.second, whole - floors.first);
    setSize(Math.min(Math.max(next, floors.second), most));
  }, [floors.first, floors.second, row, setSize]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = pane.current?.getBoundingClientRect();
    if (box) resize(row ? box.right - event.clientX : box.bottom - event.clientY);
  }, [resize, row]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const grow = row ? "ArrowLeft" : "ArrowUp";
    const shrink = row ? "ArrowRight" : "ArrowDown";
    const step = event.key === grow ? KEY_STEP : event.key === shrink ? -KEY_STEP : 0;
    if (step === 0) return;
    event.preventDefault();
    resize(size + step);
  };

  return { pane, grip: { onPointerDown, onPointerMove, onPointerUp, onKeyDown } };
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
