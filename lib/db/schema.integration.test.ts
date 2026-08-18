import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const runDatabaseTests = process.env.RUN_DB_TESTS === "true";
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const databaseUrl = process.env.DATABASE_URL;
const client =
  runDatabaseTests && databaseUrl
    ? postgres(databaseUrl, { max: 1, prepare: false })
    : undefined;

const rollbackMessage = "ROLLBACK_SCHEMA_TEST";

async function expectRollback(
  operation: (transaction: postgres.TransactionSql) => Promise<unknown>,
) {
  await expect(client!.begin(operation)).rejects.toThrow(rollbackMessage);
}

describeDatabase("garden schema integration", () => {
  afterAll(async () => {
    await client?.end();
  });

  it("derives sections, preserves overrides, seasons, and the current view", async () => {
    await expectRollback(async (transaction) => {
      const [garden] = await transaction<{ id: string }[]>`
        insert into garden (
          latitude,
          longitude,
          timezone,
          hardiness_zone
        )
        values (45.52, -122.68, 'America/Los_Angeles', '8b')
        returning id
      `;
      const [bed] = await transaction<{ id: string }[]>`
        insert into bed (garden_id, length_ft, width_ft, soil_type)
        values (${garden.id}, 50, 3, 'loam')
        returning id
      `;
      const [firstSeason] = await transaction<{ id: string }[]>`
        insert into season (
          garden_id,
          name,
          starts_on,
          ends_on,
          is_current
        )
        values (${garden.id}, '2026', '2026-03-01', '2026-11-01', true)
        returning id
      `;

      await transaction`
        insert into sun_zone (bed_id, start_ft, end_ft, sun_exposure)
        values
          (${bed.id}, 0, 18, 'full_sun'),
          (${bed.id}, 18, 34, 'part_sun'),
          (${bed.id}, 34, 50, 'part_shade')
      `;
      await transaction`set constraints all immediate`;

      const [derivedSection] = await transaction<{ id: string }[]>`
        insert into location (
          garden_id,
          kind,
          name,
          bed_id,
          season_id,
          start_ft,
          end_ft,
          sun_exposure,
          sun_exposure_source,
          sun_exposure_mix
        )
        values (
          ${garden.id},
          'bed_section',
          'Section 1',
          ${bed.id},
          ${firstSeason.id},
          10,
          22,
          'pending',
          'derived',
          '{}'::jsonb
        )
        returning id
      `;
      const [overriddenSection] = await transaction<{ id: string }[]>`
        insert into location (
          garden_id,
          kind,
          name,
          bed_id,
          season_id,
          start_ft,
          end_ft,
          sun_exposure,
          sun_exposure_source,
          sun_exposure_mix
        )
        values (
          ${garden.id},
          'bed_section',
          'Section 2',
          ${bed.id},
          ${firstSeason.id},
          10,
          22,
          'pending',
          'derived',
          '{}'::jsonb
        )
        returning id
      `;
      const [pot] = await transaction<{ id: string }[]>`
        insert into location (
          garden_id,
          kind,
          name,
          sun_exposure,
          sun_exposure_source,
          volume_gal,
          material,
          soil_type,
          dryness_factor
        )
        values (
          ${garden.id},
          'pot',
          'Pot 1',
          'full_sun',
          'override',
          10,
          'terracotta',
          'potting mix',
          1.5
        )
        returning id
      `;
      const [initialExposure] = await transaction<
        { sun_exposure: string; sun_exposure_mix: unknown }[]
      >`
        select sun_exposure, sun_exposure_mix
        from location
        where id = ${derivedSection.id}
      `;

      expect(initialExposure.sun_exposure).toBe("mostly_full_sun");
      expect(initialExposure.sun_exposure_mix).toEqual({
        full_sun: { feet: 8, fraction: 0.6667 },
        part_sun: { feet: 4, fraction: 0.3333 },
      });

      await transaction`
        update location
        set
          sun_exposure = 'part_shade',
          sun_exposure_source = 'override'
        where id = ${overriddenSection.id}
      `;
      await transaction`
        update sun_zone
        set sun_exposure = 'part_shade'
        where bed_id = ${bed.id} and start_ft = 0
      `;
      await transaction`set constraints all immediate`;

      const [refreshed] = await transaction<
        { sun_exposure: string; sun_exposure_source: string }[]
      >`
        select sun_exposure, sun_exposure_source
        from location
        where id = ${derivedSection.id}
      `;
      const [preservedOverride] = await transaction<
        { sun_exposure: string; sun_exposure_source: string }[]
      >`
        select sun_exposure, sun_exposure_source
        from location
        where id = ${overriddenSection.id}
      `;

      expect(refreshed).toEqual({
        sun_exposure: "mostly_part_shade",
        sun_exposure_source: "derived",
      });
      expect(preservedOverride).toEqual({
        sun_exposure: "part_shade",
        sun_exposure_source: "override",
      });

      const [crop] = await transaction<{ id: string }[]>`
        insert into crop (name, slug, source)
        values ('Tomato', 'tomato', 'stub')
        returning id
      `;
      const [planting] = await transaction<{ id: string }[]>`
        insert into planting (
          location_id,
          crop_id,
          crop_name,
          method,
          planted_on
        )
        values (${derivedSection.id}, ${crop.id}, 'Tomato', 'transplant', '2026-05-01')
        returning id
      `;
      await transaction`
        update season set is_current = false where id = ${firstSeason.id}
      `;
      const [nextSeason] = await transaction<{ id: string }[]>`
        insert into season (
          garden_id,
          name,
          starts_on,
          ends_on,
          is_current
        )
        values (${garden.id}, '2027', '2027-03-01', '2027-11-01', true)
        returning id
      `;
      const [nextSection] = await transaction<{ id: string }[]>`
        insert into location (
          garden_id,
          kind,
          name,
          bed_id,
          season_id,
          start_ft,
          end_ft,
          sun_exposure,
          sun_exposure_source,
          sun_exposure_mix
        )
        values (
          ${garden.id},
          'bed_section',
          'Section A',
          ${bed.id},
          ${nextSeason.id},
          0,
          16,
          'pending',
          'derived',
          '{}'::jsonb
        )
        returning id
      `;

      const historical = await transaction<{ id: string }[]>`
        select planting.id
        from planting
        join location on location.id = planting.location_id
        where planting.id = ${planting.id}
          and location.start_ft = 10
          and location.end_ft = 22
      `;
      const current = await transaction<{ id: string }[]>`
        select id
        from current_location
        where garden_id = ${garden.id}
        order by name
      `;

      expect(historical).toHaveLength(1);
      expect(current.map(({ id }) => id).sort()).toEqual(
        [pot.id, nextSection.id].sort(),
      );

      throw new Error(rollbackMessage);
    });
  });

  it("rejects overlapping sun zones", async () => {
    await expect(
      client!.begin(async (transaction) => {
        const [garden] = await transaction<{ id: string }[]>`
          insert into garden (
            latitude,
            longitude,
            timezone,
            hardiness_zone
          )
          values (45.52, -122.68, 'America/Los_Angeles', '8b')
          returning id
        `;
        const [bed] = await transaction<{ id: string }[]>`
          insert into bed (garden_id, length_ft, width_ft, soil_type)
          values (${garden.id}, 50, 3, 'loam')
          returning id
        `;

        await transaction`
          insert into sun_zone (bed_id, start_ft, end_ft, sun_exposure)
          values
            (${bed.id}, 0, 20, 'full_sun'),
            (${bed.id}, 18, 50, 'part_sun')
        `;
      }),
    ).rejects.toThrow(/sun_zone_no_overlap/);
  });

  it("rejects a gap in sun-zone coverage at commit", async () => {
    await expect(
      client!.begin(async (transaction) => {
        const [garden] = await transaction<{ id: string }[]>`
          insert into garden (
            latitude,
            longitude,
            timezone,
            hardiness_zone
          )
          values (45.52, -122.68, 'America/Los_Angeles', '8b')
          returning id
        `;
        const [bed] = await transaction<{ id: string }[]>`
          insert into bed (garden_id, length_ft, width_ft, soil_type)
          values (${garden.id}, 50, 3, 'loam')
          returning id
        `;

        await transaction`
          insert into sun_zone (bed_id, start_ft, end_ft, sun_exposure)
          values
            (${bed.id}, 0, 18, 'full_sun'),
            (${bed.id}, 20, 50, 'part_sun')
        `;
      }),
    ).rejects.toThrow(/must cover 0 to 50/);
  });

  it("rejects invalid location kind fields", async () => {
    await expect(
      client!.begin(async (transaction) => {
        const [garden] = await transaction<{ id: string }[]>`
          insert into garden (
            latitude,
            longitude,
            timezone,
            hardiness_zone
          )
          values (45.52, -122.68, 'America/Los_Angeles', '8b')
          returning id
        `;

        await transaction`
          insert into location (
            garden_id,
            kind,
            name,
            sun_exposure,
            sun_exposure_source
          )
          values (
            ${garden.id},
            'pot',
            'Invalid Pot',
            'full_sun',
            'override'
          )
        `;
      }),
    ).rejects.toThrow(/location_kind_fields/);
  });

  it("requires bed sections to belong to a bed and season", async () => {
    await expect(
      client!.begin(async (transaction) => {
        const [garden] = await transaction<{ id: string }[]>`
          insert into garden (
            latitude,
            longitude,
            timezone,
            hardiness_zone
          )
          values (45.52, -122.68, 'America/Los_Angeles', '8b')
          returning id
        `;
        const [bed] = await transaction<{ id: string }[]>`
          insert into bed (garden_id, length_ft, width_ft, soil_type)
          values (${garden.id}, 50, 3, 'loam')
          returning id
        `;

        await transaction`
          insert into sun_zone (bed_id, start_ft, end_ft, sun_exposure)
          values (${bed.id}, 0, 50, 'full_sun')
        `;
        await transaction`set constraints all immediate`;
        await transaction`
          insert into location (
            garden_id,
            kind,
            name,
            bed_id,
            start_ft,
            end_ft,
            sun_exposure,
            sun_exposure_source,
            sun_exposure_mix
          )
          values (
            ${garden.id},
            'bed_section',
            'Invalid Section',
            ${bed.id},
            0,
            10,
            'pending',
            'derived',
            '{}'::jsonb
          )
        `;
      }),
    ).rejects.toThrow(/location_kind_fields/);
  });

  it("audits weather fetches and upserts normalized weather days", async () => {
    await expectRollback(async (transaction) => {
      const [garden] = await transaction<{ id: string }[]>`
        insert into garden (
          latitude,
          longitude,
          timezone,
          hardiness_zone
        )
        values (45.52, -122.68, 'America/Los_Angeles', '8b')
        returning id
      `;
      const rawResponse = {
        daily: {
          time: ["2026-08-01"],
          et0_fao_evapotranspiration: [3.2],
        },
      };
      const [firstFetch] = await transaction<{ id: string }[]>`
        insert into weather_fetch (
          garden_id,
          request_url,
          raw_response,
          success
        )
        values (
          ${garden.id},
          'https://api.open-meteo.com/v1/forecast?latitude=45.52',
          ${transaction.json(rawResponse)},
          true
        )
        returning id
      `;

      await transaction`
        insert into weather_day (
          garden_id,
          weather_fetch_id,
          date,
          kind,
          precipitation_mm,
          temperature_min_c,
          temperature_max_c,
          et0_mm,
          wind_speed_max_kph
        )
        values (
          ${garden.id},
          ${firstFetch.id},
          '2026-08-01',
          'observed',
          0.5,
          12,
          25,
          3.2,
          15
        )
      `;
      const [secondFetch] = await transaction<{ id: string }[]>`
        insert into weather_fetch (
          garden_id,
          request_url,
          raw_response,
          success
        )
        values (
          ${garden.id},
          'https://api.open-meteo.com/v1/forecast?latitude=45.52',
          ${transaction.json(rawResponse)},
          true
        )
        returning id
      `;
      await transaction`
        insert into weather_day (
          garden_id,
          weather_fetch_id,
          date,
          kind,
          precipitation_mm,
          temperature_min_c,
          temperature_max_c,
          et0_mm,
          wind_speed_max_kph
        )
        values (
          ${garden.id},
          ${secondFetch.id},
          '2026-08-01',
          'observed',
          1.25,
          13,
          26,
          3.4,
          16
        )
        on conflict (garden_id, date, kind)
        do update set
          weather_fetch_id = excluded.weather_fetch_id,
          precipitation_mm = excluded.precipitation_mm,
          temperature_min_c = excluded.temperature_min_c,
          temperature_max_c = excluded.temperature_max_c,
          et0_mm = excluded.et0_mm,
          wind_speed_max_kph = excluded.wind_speed_max_kph,
          updated_at = now()
      `;

      const rows = await transaction<
        {
          weather_fetch_id: string;
          precipitation_mm: string;
          et0_mm: string;
        }[]
      >`
        select weather_fetch_id, precipitation_mm, et0_mm
        from weather_day
        where garden_id = ${garden.id}
      `;
      const audits = await transaction<{ raw_response: unknown }[]>`
        select raw_response
        from weather_fetch
        where garden_id = ${garden.id}
      `;

      expect(rows).toEqual([
        {
          weather_fetch_id: secondFetch.id,
          precipitation_mm: "1.250",
          et0_mm: "3.400",
        },
      ]);
      expect(audits).toHaveLength(2);
      expect(audits[0]?.raw_response).toEqual(rawResponse);

      throw new Error(rollbackMessage);
    });
  });

  it("keeps one crop row per slug and requires planting.crop_id", async () => {
    await expectRollback(async (transaction) => {
      const [garden] = await transaction<{ id: string }[]>`
        insert into garden (
          latitude,
          longitude,
          timezone,
          hardiness_zone
        )
        values (45.52, -122.68, 'America/Los_Angeles', '8b')
        returning id
      `;
      const [pot] = await transaction<{ id: string }[]>`
        insert into location (
          garden_id,
          kind,
          name,
          sun_exposure,
          sun_exposure_source,
          volume_gal,
          material,
          soil_type,
          dryness_factor
        )
        values (
          ${garden.id},
          'pot',
          'Pot 1',
          'full_sun',
          'override',
          10,
          'terracotta',
          'potting mix',
          1.5
        )
        returning id
      `;
      const [tomato] = await transaction<{ id: string }[]>`
        insert into crop (name, slug, source, watering_interval_days)
        values ('Tomato', 'tomato', 'stub', 3)
        returning id
      `;
      const [pepper] = await transaction<{ id: string }[]>`
        insert into crop (name, slug, source)
        values ('Pepper', 'pepper', 'stub')
        returning id
      `;

      await transaction`
        insert into planting (
          location_id, crop_id, crop_name, method, planted_on
        )
        values
          (${pot.id}, ${tomato.id}, 'tomato', 'transplant', '2026-05-01'),
          (${pot.id}, ${tomato.id}, 'Tomato', 'seed', '2026-05-02'),
          (${pot.id}, ${pepper.id}, 'Pepper', 'transplant', '2026-05-03')
      `;

      const shared = await transaction<{ crop_id: string }[]>`
        select crop_id from planting where crop_name in ('tomato', 'Tomato')
      `;
      const peppers = await transaction<{ crop_id: string }[]>`
        select crop_id from planting where crop_name = 'Pepper'
      `;
      expect(shared).toHaveLength(2);
      expect(shared[0]?.crop_id).toBe(tomato.id);
      expect(shared[1]?.crop_id).toBe(tomato.id);
      expect(peppers[0]?.crop_id).toBe(pepper.id);

      await expect(
        transaction`
          insert into crop (name, slug, source)
          values ('TOMATO', 'tomato', 'stub')
        `,
      ).rejects.toThrow();

      await expect(
        transaction`
          insert into crop (name, slug, source, watering_interval_days)
          values ('Kale', 'kale', 'stub', 0)
        `,
      ).rejects.toThrow(/crop_watering_interval_positive/);

      await expect(
        transaction`
          insert into crop (name, slug, source, sun_preference)
          values ('Basil', 'basil', 'stub', 'bright_indirect')
        `,
      ).rejects.toThrow();

      await expect(
        transaction`
          insert into planting (
            location_id, crop_name, method, planted_on
          )
          values (${pot.id}, 'Orphan', 'seed', '2026-05-04')
        `,
      ).rejects.toThrow();

      throw new Error(rollbackMessage);
    });
  });

  it("uses timestamptz for every timestamp column", async () => {
    const timestampWithoutTimeZone = await client!<
      { table_name: string; column_name: string }[]
    >`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name in (
          'garden',
          'bed',
          'sun_zone',
          'season',
          'location',
          'planting',
          'action_log',
          'garden_note',
          'weather_day',
          'weather_fetch',
          'agent_run',
          'conversation',
          'message',
          'crop',
          'recommendation'
        )
        and data_type = 'timestamp without time zone'
    `;

    expect(timestampWithoutTimeZone).toEqual([]);
  });

  it("stores Ask messages and links assistant rows to agent_run", async () => {
    await expectRollback(async (transaction) => {
      const [user] = await transaction<{ id: string }[]>`
        insert into app_user (id, email)
        values ('11111111-1111-4111-8111-111111111111', 'ask@example.com')
        returning id
      `;
      const [run] = await transaction<{ id: string }[]>`
        insert into agent_run (kind, trigger, provider, model)
        values ('ask', 'ask', 'gemini', 'gemini-flash-latest')
        returning id
      `;
      const [conversation] = await transaction<{ id: string }[]>`
        insert into conversation (user_id, kind)
        values (${user.id}, 'ask')
        returning id
      `;
      await transaction`
        insert into message (conversation_id, role, content)
        values (${conversation.id}, 'user', 'Do peppers want sun?')
      `;
      const [assistant] = await transaction<{ agent_run_id: string | null }[]>`
        insert into message (conversation_id, role, content, agent_run_id)
        values (${conversation.id}, 'assistant', 'Yes — catalog says full_sun.', ${run.id})
        returning agent_run_id
      `;
      expect(assistant.agent_run_id).toBe(run.id);

      await expect(
        transaction`
          insert into message (conversation_id, role, content, agent_run_id)
          values (${conversation.id}, 'user', 'Thanks', ${run.id})
        `,
      ).rejects.toThrow();

      throw new Error(rollbackMessage);
    });
  });

  it("accepts time_budget as an agent_run kind", async () => {
    await expectRollback(async (transaction) => {
      const [run] = await transaction<{ kind: string }[]>`
        insert into agent_run (kind, trigger, provider, model)
        values ('time_budget', 'eval', 'gemini', 'gemini-flash-latest')
        returning kind
      `;
      expect(run.kind).toBe("time_budget");
      throw new Error(rollbackMessage);
    });
  });
});
