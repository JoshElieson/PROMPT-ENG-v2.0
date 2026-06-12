import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Plugin module registry.
 *
 * Each plugin with a real integration lives in `src/plugins/<id>/` and owns
 * its setup UI, config storage, and (eventually) MCP manifest. Panels are
 * registered here as lazy imports so their code is split into separate
 * chunks and only fetched when the user opens that plugin's settings —
 * installing a plugin never grows the base bundle.
 *
 * Adding a plugin:
 * 1. Create `src/plugins/<id>/` with the setup panel component.
 * 2. Register the lazy panel below.
 * 3. Mark the catalog entry `status: "available"` in `src/data/plugins.ts`.
 */
export const PLUGIN_SETUP_PANELS: Record<
  string,
  LazyExoticComponent<ComponentType> | undefined
> = {
  supabase: lazy(() =>
    import("@/plugins/supabase/SupabaseSetupAssistant").then((module) => ({
      default: module.SupabaseSetupAssistant,
    })),
  ),
};
