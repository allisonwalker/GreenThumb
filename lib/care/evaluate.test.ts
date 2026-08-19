import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { addCalendarDays } from "@/lib/garden/local-date";

import { MICROCLIMATE_LIMITATION, OPEN_METEO_ATTRIBUTION } from "./copy";
import { evaluateCareList } from "./evaluate";
import {
  MM_PER_INCH,
  TYPICAL_ET0_MM_PER_DAY,
  type CareLogEvent,
  type CarePlantingInput,
  type CareWeatherDay,
} from "./watering";

const TODAY = "2026-08-19";
const TIME_ZONE = "America/Los_Angeles";
const LAST_WATERED = "2026-08-15";
const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const POT_ID = "22222222-2222-4222-8222-222222222222";
const BED_ID = "33333333-3333-4333-8333-333333333333";

function planting(
  overrides: Partial<CarePlantingInput> = {},
): CarePlantingInput {
  return {
    plantingId: "plant-tomato",
    locationId: SECTION_ID,
    locationName: "Section 3",
    drynessFactor: 1,
    cropId: "crop-tomato",
    cropName: "tomatoes",
    wateringIntervalDays: 3,
    estimatedMinutes: 10,
    plantedOn: "2026-06-01",
    ...overrides,
  };
}

function wateredLog(occurredOn: string): CareLogEvent {
  return {
    plantingId: "plant-tomato",
    locationId: SECTION_ID,
    actionType: "watered",
    occurredOn,
  };
}

function weatherWindow(input: {
  upcomingMm?: number;
  weekRainMm?: number;
  et0Mm?: number;
}): CareWeatherDay[] {
  const upcomingMm = input.upcomingMm ?? 0;
  const weekRainMm = input.weekRainMm ?? 0;
  const et0Mm = input.et0Mm ?? TYPICAL_ET0_MM_PER_DAY;
  const start = addCalendarDays(TODAY, -7);
  const days: CareWeatherDay[] = [];
  for (let offset = 0; offset < 10; offset += 1) {
    const date = addCalendarDays(start, offset);
    let precipitationMm = 0;
    if (date === "2026-08-14") {
      precipitationMm = weekRainMm;
    }
    if (date === "2026-08-20") {
      precipitationMm = upcomingMm;
    }
    days.push({
      date,
      precipitationMm,
      et0Mm: date <= TODAY ? et0Mm : 0,
    });
  }
  return days;
}

function dryGarden() {
  return {
    today: TODAY,
    timeZone: TIME_ZONE,
    plantings: [planting()],
    weatherDays: weatherWindow({ weekRainMm: 0.1 * MM_PER_INCH }),
    log: [wateredLog(LAST_WATERED)],
  };
}

describe("evaluateCareList watering", () => {
  it("emits a watering task when the catalog interval has elapsed and no rain is coming", () => {
    const tasks = evaluateCareList(dryGarden());

    expect(tasks).toHaveLength(1);
    const task = tasks[0]!;
    expect(task.actionType).toBe("watered");
    expect(task.urgency).toBe("today");
    expect(task.headline).toBe("Section 3 — water today");
    expect(task.rationale).toBe(
      'last watered 4 days ago, 0.1" rain this week, tomatoes want water every 3 days',
    );
    expect(task).not.toHaveProperty("confidence");
    expect(task.evidence).toEqual({
      facts: expect.any(Array),
    });
    expect(task.evidence).not.toHaveProperty("inferences");
    expect(task.evidence.facts.map((fact) => fact.source).sort()).toEqual([
      "care log",
      "crop catalog",
      "location",
      "weather cache",
      "weather cache",
      "weather cache",
    ]);
    expect(task.evidence.facts).toEqual(
      expect.arrayContaining([
        { source: "care log", figure: "last watered 2026-08-15" },
        { source: "crop catalog", figure: "water every 3 days" },
        {
          source: "weather cache",
          figure: '0.0" rain coming today–tomorrow',
        },
      ]),
    );
  });

  it("skips watering when meaningful rain is coming and names the rain figure", () => {
    const tasks = evaluateCareList({
      ...dryGarden(),
      weatherDays: weatherWindow({
        weekRainMm: 0.1 * MM_PER_INCH,
        upcomingMm: 0.3 * MM_PER_INCH,
      }),
    });

    expect(tasks).toHaveLength(1);
    const task = tasks[0]!;
    expect(task.urgency).toBe("monitor");
    expect(task.headline).toBe("Section 3 — skip watering");
    expect(task.rationale).toContain('0.3" rain coming today–tomorrow');
    expect(task.evidence.facts).toEqual(
      expect.arrayContaining([
        {
          source: "weather cache",
          figure: '0.3" rain coming today–tomorrow',
        },
      ]),
    );
  });

  it("downgrades watering when some rain is coming but not enough to skip", () => {
    const tasks = evaluateCareList({
      ...dryGarden(),
      weatherDays: weatherWindow({
        weekRainMm: 0.1 * MM_PER_INCH,
        upcomingMm: 0.15 * MM_PER_INCH,
      }),
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.urgency).toBe("this_week");
    expect(tasks[0]?.headline).toBe("Section 3 — water this week");
    expect(tasks[0]?.rationale).toContain('0.15" rain coming today–tomorrow');
  });

  it("lists a drier pot before an in-ground planting of the same crop", () => {
    const lastWatered = "2026-08-17";
    const tasks = evaluateCareList({
      today: TODAY,
      timeZone: TIME_ZONE,
      plantings: [
        planting({
          plantingId: "plant-bed",
          locationId: BED_ID,
          locationName: "Section 1",
          drynessFactor: 1,
        }),
        planting({
          plantingId: "plant-pot",
          locationId: POT_ID,
          locationName: "Pot 2",
          drynessFactor: 1.5,
        }),
      ],
      weatherDays: weatherWindow({}),
      log: [
        {
          plantingId: "plant-bed",
          locationId: BED_ID,
          actionType: "watered",
          occurredOn: lastWatered,
        },
        {
          plantingId: "plant-pot",
          locationId: POT_ID,
          actionType: "watered",
          occurredOn: lastWatered,
        },
      ],
    });

    expect(tasks.map((task) => task.locationId)).toEqual([POT_ID]);
    expect(tasks[0]?.headline).toBe("Pot 2 — water today");
    expect(tasks[0]?.evidence.facts).toEqual(
      expect.arrayContaining([
        { source: "location", figure: "dryness_factor 1.5" },
      ]),
    );
  });

  it("does not guess a watering cadence when the crop interval is missing", () => {
    const tasks = evaluateCareList({
      ...dryGarden(),
      plantings: [planting({ wateringIntervalDays: null })],
    });

    expect(tasks).toEqual([]);
  });

  it("does not invent a watered log when the last event is planted_on", () => {
    const tasks = evaluateCareList({
      ...dryGarden(),
      log: [],
      plantings: [planting({ plantedOn: LAST_WATERED })],
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.rationale).toContain("planted 4 days ago, not yet watered");
    expect(tasks[0]?.evidence.facts).toEqual(
      expect.arrayContaining([
        {
          source: "planting",
          figure: "planted 2026-08-15 (no watered log)",
        },
      ]),
    );
  });
});

describe("matching compute path has no model", () => {
  it("does not import an LLM provider or the agent", () => {
    const files = [
      "evaluate.ts",
      "watering.ts",
      "copy.ts",
      "run.ts",
      "load-inputs.ts",
    ];
    const source = files
      .map((file) =>
        readFileSync(new URL(`./${file}`, import.meta.url), "utf8"),
      )
      .join("\n");

    expect(source).not.toMatch(/lib\/llm/);
    expect(source).not.toMatch(/lib\/agent/);
    expect(source).not.toMatch(/@\/lib\/llm/);
    expect(source).not.toMatch(/propose_recommendation/);
  });

  it("keeps Open-Meteo attribution and the microclimate note as standing copy", () => {
    expect(OPEN_METEO_ATTRIBUTION).toContain("Open-Meteo");
    expect(OPEN_METEO_ATTRIBUTION).toContain("CC BY 4.0");
    expect(MICROCLIMATE_LIMITATION).toMatch(/microclimate/i);
  });
});

describe("Today page", () => {
  it("computes the list on open without asking the agent, and shows the footer once", () => {
    const page = readFileSync(
      new URL("../../app/today/page.tsx", import.meta.url),
      "utf8",
    );
    const card = readFileSync(
      new URL("../../app/today/recommendation-card.tsx", import.meta.url),
      "utf8",
    );

    expect(page).toMatch(/runCareMatching/);
    expect(page).not.toMatch(/lib\/agent/);
    expect(page).not.toMatch(/lib\/llm/);
    expect(page).toMatch(/Open-Meteo/);
    expect(page).toMatch(/CC BY 4.0/);
    expect(page).toMatch(/MICROCLIMATE_LIMITATION/);
    expect(card).not.toMatch(/Open-Meteo/);
    expect(card).not.toMatch(/confidence/);
    expect(card).not.toMatch(/inferences/);
  });
});
