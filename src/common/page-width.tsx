import { ActionIcon, Box, Tooltip } from "@mantine/core";
import { createContext, useContext } from "react";
import { IconViewportNarrow, IconViewportWide } from "../icons";

export function PageWidthToggle() {
  const width = useContext(PageWidthContext);
  if (!width) return null;

  const label = width.wide ? "Use the default width" : "Use the full width";
  return (
    <Box className="page-width-toggle">
      <Tooltip label={label} withArrow>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="md"
          onClick={width.toggle}
          aria-label={label}
          aria-pressed={width.wide}
        >
          {width.wide
            ? <IconViewportNarrow size="1.25rem" stroke={1.5} />
            : <IconViewportWide size="1.25rem" stroke={1.5} />}
        </ActionIcon>
      </Tooltip>
    </Box>
  );
}

interface PageWidthValue {
  wide: boolean;
  toggle: () => void;
}

export const PageWidthContext = createContext<PageWidthValue | null>(null);
