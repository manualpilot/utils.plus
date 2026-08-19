import { Spotlight, type SpotlightActionData, type SpotlightFilterFunction } from "@mantine/spotlight";
import Fuse from "fuse.js";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { IconSearch } from "./icons";
import { utilities } from "./utility-registry";

export function UtilitySpotlight() {
  const [, setLocation] = useLocation();

  const actions = useMemo<SpotlightActionData[]>(
    () =>
      utilities.map(({ path, label, title, Icon }) => ({
        id: path,
        label,
        description: title,
        leftSection: <Icon size="1.2rem" stroke={1.5} />,
        onClick: () => setLocation(path),
      })),
    [setLocation],
  );

  return (
    <Spotlight
      actions={actions}
      filter={filterUtilities}
      shortcut="ctrl + space"
      tagsToIgnore={[]}
      searchProps={{ placeholder: "Search utilities", leftSection: <IconSearch size="1.2rem" stroke={1.5} /> }}
      nothingFound="No utility goes by that."
      scrollable
    />
  );
}

const fuse = new Fuse(
  utilities.map(({ path, label, keywords }) => ({ path, label, keywords })),
  {
    keys: [{ name: "label", weight: 2 }, { name: "keywords", weight: 1 }],
    threshold: 0.3,
    ignoreLocation: true,
  },
);

export const filterUtilities: SpotlightFilterFunction = (query, actions) => {
  const search = query.trim();
  if (!search) return actions;

  const byPath = new Map(actions.flatMap((action) => "id" in action ? [[action.id, action] as const] : []));
  return fuse.search(search).flatMap(({ item }) => byPath.get(item.path) ?? []);
};
