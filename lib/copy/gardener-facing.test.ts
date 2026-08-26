import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { friendlyAskError } from "@/lib/agent/ask-errors";
import {
  MICROCLIMATE_LIMITATION,
  OPEN_METEO_ATTRIBUTION,
} from "@/lib/care/copy";
import {
  DAILY_QA_CAP_MESSAGE,
  MONTHLY_CAP_MESSAGE,
  monthlyCapAlertMessage,
} from "@/lib/spend/messages";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const DESIGN_COMMENTARY =
  /\bno model\b|\bLLM\b|matching engine|matching run|matching will|does not use the model|doesn't use the model|does not call a model|no model is involved|generic chatbot|not a chatbot|not a chat tool|chatbot guessing/i;

const GARDENER_FACING_FILES = [
  "app/page.tsx",
  "app/today/page.tsx",
  "app/garden/page.tsx",
  "app/garden/actions.ts",
  "app/catalog/page.tsx",
  "app/catalog/catalog-list.tsx",
  "app/catalog/actions.ts",
  "app/catalog/[cropId]/crop-edit-form.tsx",
  "app/log/page.tsx",
  "app/log/log-action-form.tsx",
  "app/ask/ask-thread.tsx",
  "components/app-nav.tsx",
  "lib/spend/messages.ts",
  "lib/agent/ask-errors.ts",
  "lib/crops/attribution.ts",
  "lib/care/copy.ts",
];

describe("gardener-facing copy (ALL-61)", () => {
  it("keeps Open-Meteo attribution and the microclimate limitation", () => {
    expect(OPEN_METEO_ATTRIBUTION).toMatch(/Open-Meteo/);
    expect(OPEN_METEO_ATTRIBUTION).toMatch(/CC BY 4.0/);
    expect(MICROCLIMATE_LIMITATION).toMatch(/microclimate/i);
  });

  it("does not explain matching vs models in Ask or spend messages", () => {
    expect(MONTHLY_CAP_MESSAGE).not.toMatch(DESIGN_COMMENTARY);
    expect(DAILY_QA_CAP_MESSAGE).not.toMatch(DESIGN_COMMENTARY);
    expect(monthlyCapAlertMessage(50, 51.2)).not.toMatch(DESIGN_COMMENTARY);
    expect(friendlyAskError("quota exceeded")).not.toMatch(DESIGN_COMMENTARY);
  });

  it("keeps Today, Garden, Catalog, Log, Ask, and nav free of design-choice language", () => {
    const hits: string[] = [];
    for (const relative of GARDENER_FACING_FILES) {
      const source = readFileSync(join(rootDir, relative), "utf8");
      const quoted = source.match(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g) ?? [];
      const offending = quoted.filter((text) => DESIGN_COMMENTARY.test(text));
      if (offending.length > 0) {
        hits.push(`${relative}: ${offending.join(" | ")}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
