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

      const [planting] = await transaction<{ id: string }[]>`
        insert into planting (
          location_id,
          crop_name,
          method,
          planted_on
        )
        values (${derivedSection.id}, 'Tomato', 'transplant', '2026-05-01')
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
          'garden_note'
        )
        and data_type = 'timestamp without time zone'
    `;

    expect(timestampWithoutTimeZone).toEqual([]);
  });
});
