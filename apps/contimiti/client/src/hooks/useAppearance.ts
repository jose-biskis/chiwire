import { useEffect, useState } from "react";
import {
  applyAppearance,
  preferredAppearance,
  storeAppearance,
  type Appearance,
  type UiArchetype,
  type UiColorMode
} from "../lib/appearance";

export function useAppearance(): {
  appearance: Appearance;
  setArchetype: (archetype: UiArchetype) => void;
  setColorMode: (colorMode: UiColorMode) => void;
} {
  const [appearance, setAppearance] = useState<Appearance>(() => preferredAppearance());

  useEffect(() => {
    applyAppearance(appearance);
    storeAppearance(appearance);
  }, [appearance]);

  function setArchetype(archetype: UiArchetype): void {
    setAppearance((current) => ({ ...current, archetype }));
  }

  function setColorMode(colorMode: UiColorMode): void {
    setAppearance((current) => ({ ...current, colorMode }));
  }

  return { appearance, setArchetype, setColorMode };
}
