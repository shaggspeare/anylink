"use client";

import { useLibrary } from "./store";
import { useLocalSetting } from "./use-local-setting";

export const DEFAULT_COLLECTION_KEY = "anylink:default-collection";

/** Where new links land: the collection picked in Settings, or Unsorted when there's
 * none, or the pick has since been dissolved or turned out to be a filter. */
export function useDefaultCollection(): string {
  const { collections, inbox } = useLibrary();
  const [picked] = useLocalSetting<string>(DEFAULT_COLLECTION_KEY, "");
  const valid = collections.some((c) => c.id === picked && !c.isSmart);
  return valid ? picked : (inbox?.id ?? "");
}
