import { createTheme, CSSVariablesResolver, MantineColorsTuple } from "@mantine/core";

const orange: MantineColorsTuple = [
  "#FFF3E0",
  "#FFE0B2",
  "#FFB74D",
  "#FFAB91",
  "#FF8A65",
  "#FF7B55",
  "#FF7043",
  "#FF5722",
  "#A63A15",
  "#863010",
];

const grey: MantineColorsTuple = [
  "#FAFAFA",
  "#F5F5F5",
  "#E0E0E0",
  "#BDBDBD",
  "#9E9E9E",
  "#757575",
  "#616161",
  "#424242",
  "#2C2C2C",
  "#1E1E1E",
];

const ROBOTO = "'Roboto Variable', Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif";

export const theme = createTheme({
  colors: { orange, grey },
  primaryColor: "orange",
  primaryShade: 9,

  fontFamily: ROBOTO,
  headings: { fontFamily: ROBOTO },

  defaultRadius: "md",

  other: {
    base100: "#121212",
    base200: "#1E1E1E",
    base300: "#2C2C2C",
    baseContent: "#E0E0E0",
    primary: "#FF7043",
    primaryContent: "#121212",
    secondary: "#FFAB91",
    secondaryContent: "#121212",
    neutral: "#2C2C2C",
    neutralContent: "#9E9E9E",
    accent: "#FF5722",
    accentContent: "#121212",
    info: "#9E9E9E",
    infoContent: "#121212",
    success: "#FF7043",
    successContent: "#121212",
    warning: "#FFB74D",
    warningContent: "#121212",
    error: "#FFB4AB",
    errorContent: "#690005",
  },
});

export const cssVariablesResolver: CSSVariablesResolver = () => {
  const shared: Record<string, string> = {
    "--mantine-color-body": "#121212",
    "--mantine-color-text": "#E0E0E0",
    "--mantine-color-dimmed": "#9E9E9E",
    "--mantine-color-default": "#1E1E1E",
    "--mantine-color-default-hover": "#2C2C2C",
    "--mantine-color-default-color": "#E0E0E0",
    "--mantine-color-default-border": "#2C2C2C",

    "--mantine-color-error": "#FFB4AB",
  };

  return {
    variables: {},
    light: { ...shared },
    dark: { ...shared },
  };
};
