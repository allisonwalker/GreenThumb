import { describe, expect, it } from "vitest";

import {
  READ_TOOL_NAMES,
  agentToolDefinitions,
  createToolRegistry,
  getCareHistory,
  getCurrentLocations,
  getGardenNotes,
  getGardenProfile,
  getOpenRecommendations,
  getPlantings,
  getWeather,
} from "./index";

describe("agent read tools", () => {
  it("exposes exactly the seven read-only tools and no writers", () => {
    expect(READ_TOOL_NAMES).toEqual([
      "get_garden_profile",
      "get_current_locations",
      "get_plantings",
      "get_care_history",
      "get_weather",
      "get_garden_notes",
      "get_open_recommendations",
    ]);
    expect(agentToolDefinitions.map((tool) => tool.name)).toEqual([
      ...READ_TOOL_NAMES,
    ]);
    expect(
      agentToolDefinitions.some((tool) =>
        /propose|save|write|update|delete|insert/i.test(tool.name),
      ),
    ).toBe(false);
  });

  it("returns garden profile from an injectable store", async () => {
    const profile = await getGardenProfile(
      {},
      {
        getProfile: async () => ({
          gardenId: "g1",
          name: "Test Garden",
          latitude: 45.5,
          longitude: -122.6,
          timezone: "America/Los_Angeles",
          hardinessZone: "8b",
          averageLastFrostOn: null,
          averageFirstFrostOn: null,
          bed: {
            id: "b1",
            name: "Raised Bed",
            lengthFt: 50,
            widthFt: 3,
            soilType: "loam",
          },
        }),
      },
    );

    expect(profile.timezone).toBe("America/Los_Angeles");
    expect(profile.bed?.lengthFt).toBe(50);
  });

  it("lists current locations from an injectable store", async () => {
    const locations = await getCurrentLocations(
      {},
      {
        list: async () => [
          {
            id: "l1",
            kind: "pot",
            name: "Pot A",
            sunExposure: "full_sun",
            sunExposureSource: "override",
            drynessFactor: 1.4,
            startFt: null,
            endFt: null,
            volumeGal: 15,
            material: "terracotta",
            soilType: "potting mix",
            notes: null,
          },
        ],
      },
    );

    expect(locations).toHaveLength(1);
    expect(locations[0]?.drynessFactor).toBe(1.4);
  });

  it("lists plantings with days since planted", async () => {
    const plantings = await getPlantings(
      { now: new Date("2026-08-08T17:00:00.000Z") },
      {
        list: async () => [
          {
            id: "p1",
            locationId: "l1",
            locationName: "Section 1",
            cropName: "Tomato",
            variety: "Sungold",
            method: "transplant",
            plantedOn: "2026-06-01",
            daysSincePlanted: 68,
            status: "growing",
            removedOn: null,
          },
        ],
      },
      {
        getProfile: async () => ({
          gardenId: "g1",
          name: "Test",
          latitude: 1,
          longitude: 2,
          timezone: "America/Los_Angeles",
          hardinessZone: "8b",
          averageLastFrostOn: null,
          averageFirstFrostOn: null,
          bed: null,
        }),
      },
    );

    expect(plantings[0]?.daysSincePlanted).toBe(68);
  });

  it("returns care history for a bounded window", async () => {
    const history = await getCareHistory(
      { days: 14 },
      {
        list: async ({ days }) => ({
          days,
          entries: [
            {
              id: "a1",
              locationId: "l1",
              plantingId: null,
              actionType: "watered",
              occurredAt: "2026-08-07T18:00:00.000Z",
              detail: "deep soak",
              userId: "u1",
            },
          ],
        }),
      },
    );

    expect(history.days).toBe(14);
    expect(history.entries[0]?.actionType).toBe("watered");
  });

  it("reads weather through injectable cache helpers", async () => {
    const weather = await getWeather(
      {
        pastDays: 1,
        forecastDays: 1,
        now: new Date("2026-08-08T19:00:00.000Z"),
      },
      {
        profileStore: {
          getProfile: async () => ({
            gardenId: "g1",
            name: "Test",
            latitude: 45.5,
            longitude: -122.6,
            timezone: "America/Los_Angeles",
            hardinessZone: "8b",
            averageLastFrostOn: null,
            averageFirstFrostOn: null,
            bed: null,
          }),
        },
        readCache: async () => ({
          days: [
            {
              date: "2026-08-08",
              kind: "forecast",
              precipitationMm: 0,
              temperatureMinC: 12,
              temperatureMaxC: 24,
              et0Mm: 3.2,
              windSpeedMaxKph: 10,
              weatherFetchId: "wf1",
            },
          ],
          fetchedAt: new Date("2026-08-08T12:00:00.000Z"),
          staleByMs: 0,
          isStale: false,
        }),
      },
    );

    expect(weather.weatherFetchId).toBe("wf1");
    expect(weather.days[0]?.et0Mm).toBe(3.2);
  });

  it("returns garden notes and open recommendations from stores", async () => {
    const notes = await getGardenNotes(
      {},
      {
        list: async () => [
          {
            id: "n1",
            note: "Far end floods",
            userId: "u1",
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      },
      {
        getProfile: async () => ({
          gardenId: "g1",
          name: "Test",
          latitude: 1,
          longitude: 2,
          timezone: "America/Los_Angeles",
          hardinessZone: "8b",
          averageLastFrostOn: null,
          averageFirstFrostOn: null,
          bed: null,
        }),
      },
    );
    const open = await getOpenRecommendations(
      {},
      {
        list: async () => [],
      },
      {
        getProfile: async () => ({
          gardenId: "g1",
          name: "Test",
          latitude: 1,
          longitude: 2,
          timezone: "America/Los_Angeles",
          hardinessZone: "8b",
          averageLastFrostOn: null,
          averageFirstFrostOn: null,
          bed: null,
        }),
      },
    );

    expect(notes[0]?.note).toMatch(/floods/);
    expect(open).toEqual([]);
  });

  it("routes tool calls through the registry", async () => {
    const registry = createToolRegistry({});
    await expect(
      registry.execute({
        id: "x",
        name: "not_a_real_tool",
        input: {},
      }),
    ).rejects.toThrow(/Unknown tool/);
  });
});
