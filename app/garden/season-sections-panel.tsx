"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  createSeason,
  overrideSectionExposure,
  revertSectionExposure,
  saveSeasonSections,
} from "./actions";
import type {
  SeasonBoardRecord,
  SeasonRecord,
  SeasonSectionRecord,
} from "@/lib/garden/season-repository";
import {
  SUN_EXPOSURES,
  deriveSectionSunExposure,
  formatSectionSunExposureDisplay,
  type SunExposure,
} from "@/lib/garden/sun-exposure";

const fieldClass =
  "mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200";
const initialState = { status: "idle" as const };

type DraftSection = {
  clientKey: string;
  id?: string;
  name: string;
  startFt: number;
  endFt: number;
};

function toDrafts(
  sections: SeasonSectionRecord[],
  bedLengthFt: number,
): DraftSection[] {
  if (sections.length === 0) {
    return [
      {
        clientKey: crypto.randomUUID(),
        name: "Section 1",
        startFt: 0,
        endFt: bedLengthFt,
      },
    ];
  }

  return sections.map((section) => ({
    clientKey: section.id,
    id: section.id,
    name: section.name,
    startFt: section.startFt,
    endFt: section.endFt,
  }));
}

function splitSection(
  sections: DraftSection[],
  bedLengthFt: number,
): DraftSection[] {
  const last = sections.at(-1);
  if (!last) {
    return [
      {
        clientKey: crypto.randomUUID(),
        name: "Section 1",
        startFt: 0,
        endFt: bedLengthFt,
      },
    ];
  }

  const midpoint = Math.round(((last.startFt + last.endFt) / 2) * 10) / 10;
  if (midpoint <= last.startFt || midpoint >= last.endFt) {
    return sections;
  }

  return [
    ...sections.slice(0, -1),
    { ...last, endFt: midpoint },
    {
      clientKey: crypto.randomUUID(),
      name: `Section ${sections.length + 1}`,
      startFt: midpoint,
      endFt: last.endFt,
    },
  ];
}

function StatusLine({
  state,
  idle,
}: {
  state: { status: string; message?: string };
  idle: string;
}) {
  return (
    <p
      aria-live="polite"
      className={
        state.status === "error"
          ? "text-sm font-medium text-red-700"
          : "text-sm font-medium text-green-800"
      }
    >
      {state.status === "idle" ? idle : state.message}
    </p>
  );
}

function SeasonMeta({ season }: { season: SeasonRecord }) {
  return (
    <p className="text-sm text-neutral-600">
      {season.startsOn} → {season.endsOn}
      {season.isCurrent ? " · current" : ""}
    </p>
  );
}

function SectionStrip({
  sections,
  bedLengthFt,
}: {
  sections: { name: string; startFt: number; endFt: number }[];
  bedLengthFt: number;
}) {
  return (
    <>
      <div
        className="mt-4 flex h-14 overflow-hidden rounded-lg border bg-neutral-100"
        aria-label="Bed sections along the raised bed"
      >
        {sections.map((section) => {
          const width =
            bedLengthFt > 0
              ? Math.max(
                  0,
                  ((section.endFt - section.startFt) / bedLengthFt) * 100,
                )
              : 0;
          return (
            <div
              key={`${section.name}-${section.startFt}-${section.endFt}`}
              className="flex min-w-0 items-center justify-center border-r border-white/70 bg-green-200 px-1 text-center text-xs font-semibold text-neutral-900 last:border-r-0"
              style={{ width: `${width}%` }}
              title={`${section.name}: ${section.startFt}–${section.endFt} ft`}
            >
              {width >= 12 ? section.name : null}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-500">
        <span>0 ft</span>
        <span>{bedLengthFt} ft</span>
      </div>
    </>
  );
}

function HistorySections({
  season,
  bedLengthFt,
}: {
  season: SeasonRecord;
  bedLengthFt: number;
}) {
  return (
    <div className="mt-4 space-y-3">
      <SectionStrip sections={season.sections} bedLengthFt={bedLengthFt} />
      {season.sections.length === 0 ? (
        <p className="text-sm text-neutral-600">
          This season has no bed sections recorded.
        </p>
      ) : (
        season.sections.map((section) => (
          <div
            key={section.id}
            className="rounded-xl border bg-neutral-50 px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">{section.name}</h3>
              <p className="text-sm text-neutral-600">
                {section.startFt}–{section.endFt} ft
              </p>
            </div>
            <p className="mt-1 text-sm text-neutral-800">
              {section.sunExposureDisplay}
              {section.sunExposureSource === "override" ? " · override" : ""}
            </p>
            <p className="mt-2">
              <Link
                href={`/garden/${section.id}`}
                className="text-sm font-semibold text-green-800 hover:underline"
              >
                View plantings
              </Link>
            </p>
          </div>
        ))
      )}
    </div>
  );
}

function OverrideControls({ section }: { section: SeasonSectionRecord }) {
  const [overrideState, overrideAction, overridePending] = useActionState(
    overrideSectionExposure,
    initialState,
  );
  const [revertState, revertAction, revertPending] = useActionState(
    revertSectionExposure,
    initialState,
  );

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {section.sunExposureSource === "override" ? (
        <form action={revertAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="sectionId" value={section.id} />
          <p className="text-sm font-medium text-amber-800">
            Override: {section.sunExposureDisplay}
          </p>
          <button
            type="submit"
            disabled={revertPending}
            className="min-h-11 rounded-lg border border-amber-700 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          >
            {revertPending ? "Reverting…" : "Revert to derived"}
          </button>
          <StatusLine state={revertState} idle="" />
        </form>
      ) : (
        <form
          action={overrideAction}
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <input type="hidden" name="sectionId" value={section.id} />
          <label className="text-sm font-medium">
            Override exposure
            <select
              className={fieldClass}
              name="sunExposure"
              defaultValue={
                SUN_EXPOSURES.includes(section.sunExposure as SunExposure)
                  ? section.sunExposure
                  : "full_sun"
              }
            >
              {SUN_EXPOSURES.map((exposure) => (
                <option key={exposure} value={exposure}>
                  {exposure.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={overridePending}
            className="min-h-11 rounded-lg border px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            {overridePending ? "Saving…" : "Save override"}
          </button>
          <div className="sm:col-span-2">
            <StatusLine state={overrideState} idle="" />
          </div>
        </form>
      )}
    </div>
  );
}

export function SeasonSectionsPanel({ board }: { board: SeasonBoardRecord }) {
  const [createState, createAction, createPending] = useActionState(
    createSeason,
    initialState,
  );
  const [saveState, saveAction, savePending] = useActionState(
    saveSeasonSections,
    initialState,
  );
  const [drafts, setDrafts] = useState<DraftSection[]>(() =>
    toDrafts(board.currentSeason?.sections ?? [], board.bedLengthFt),
  );

  const savedById = useMemo(() => {
    const map = new Map<string, SeasonSectionRecord>();
    for (const section of board.currentSeason?.sections ?? []) {
      map.set(section.id, section);
    }
    return map;
  }, [board.currentSeason]);

  function updateDraft(clientKey: string, change: Partial<DraftSection>) {
    setDrafts((current) =>
      current.map((section) =>
        section.clientKey === clientKey ? { ...section, ...change } : section,
      ),
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">Seasons</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Re-cut the bed each season. Sun exposure is derived from the
            permanent sun map—no re-entry.
          </p>
        </div>

        {board.currentSeason ? (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm font-semibold text-green-900">
              Current season: {board.currentSeason.name}
            </p>
            <SeasonMeta season={board.currentSeason} />
          </div>
        ) : (
          <p className="mb-6 text-sm text-neutral-600">
            No current season yet. Create one to draw this year&apos;s sections.
          </p>
        )}

        <form action={createAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-semibold text-neutral-800 sm:col-span-1">
              Season name
              <input
                className={fieldClass}
                name="name"
                required
                placeholder="2026 main"
              />
            </label>
            <label className="text-sm font-semibold text-neutral-800">
              Starts
              <input className={fieldClass} name="startsOn" type="date" required />
            </label>
            <label className="text-sm font-semibold text-neutral-800">
              Ends
              <input className={fieldClass} name="endsOn" type="date" required />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-neutral-800">
            <input type="hidden" name="markCurrent" value="false" />
            <input
              type="checkbox"
              name="markCurrent"
              value="true"
              defaultChecked
              className="size-5 rounded border"
            />
            Mark as the current season
          </label>
          <p className="text-xs text-neutral-500">
            Marking a season current keeps earlier seasons and their sections as
            read-only history.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StatusLine
              state={createState}
              idle="Only one season is current at a time."
            />
            <button
              type="submit"
              disabled={createPending}
              className="min-h-12 rounded-lg bg-green-800 px-6 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
            >
              {createPending ? "Creating…" : "Create season"}
            </button>
          </div>
        </form>
      </section>

      {board.currentSeason ? (
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                This season&apos;s bed sections
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                Draw 5–6 ranges covering 0–{board.bedLengthFt} ft without gaps
                or overlaps. Exposure appears from the sun map.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setDrafts((current) =>
                  splitSection(current, board.bedLengthFt),
                )
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-green-700 px-4 text-sm font-semibold text-green-800 hover:bg-green-50"
            >
              <Plus aria-hidden="true" className="size-4" />
              Split last section
            </button>
          </div>

          <SectionStrip sections={drafts} bedLengthFt={board.bedLengthFt} />

          <form action={saveAction} className="mt-6 space-y-4">
            <input
              type="hidden"
              name="seasonId"
              value={board.currentSeason.id}
            />
            {drafts.map((section, index) => {
              const saved = section.id ? savedById.get(section.id) : undefined;
              let previewLabel = saved?.sunExposureDisplay;
              try {
                const derived = deriveSectionSunExposure(
                  section.startFt,
                  section.endFt,
                  board.sunZones,
                  board.bedLengthFt,
                );
                previewLabel = formatSectionSunExposureDisplay(
                  derived.exposure,
                  derived.mix,
                );
              } catch {
                // Keep saved label or omit until ranges are valid.
              }

              return (
                <fieldset
                  key={section.clientKey}
                  className="rounded-xl border bg-neutral-50 p-4"
                >
                  <legend className="px-1 text-sm font-semibold">
                    {section.name || `Section ${index + 1}`}
                  </legend>
                  {section.id ? (
                    <input type="hidden" name="sectionId" value={section.id} />
                  ) : (
                    <input type="hidden" name="sectionId" value="" />
                  )}
                  <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
                    <label className="text-sm font-medium">
                      Name
                      <input
                        className={fieldClass}
                        name="sectionName"
                        required
                        value={section.name}
                        onChange={(event) =>
                          updateDraft(section.clientKey, {
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Starts at (ft)
                      <input
                        className={fieldClass}
                        name="sectionStartFt"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        required
                        value={section.startFt}
                        onChange={(event) =>
                          updateDraft(section.clientKey, {
                            startFt: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Ends at (ft)
                      <input
                        className={fieldClass}
                        name="sectionEndFt"
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        required
                        value={section.endFt}
                        onChange={(event) =>
                          updateDraft(section.clientKey, {
                            endFt: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${section.name}`}
                      onClick={() =>
                        setDrafts((current) =>
                          current.filter(
                            (item) => item.clientKey !== section.clientKey,
                          ),
                        )
                      }
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      <span className="sm:hidden">Remove</span>
                    </button>
                  </div>
                  {previewLabel ? (
                    <p className="mt-3 text-sm text-neutral-800">
                      Sun: {previewLabel}
                      {saved?.sunExposureSource === "override"
                        ? " (saved override may differ until you revert)"
                        : " · derived"}
                    </p>
                  ) : null}
                  {saved ? (
                    <>
                      <p className="mt-2">
                        <Link
                          href={`/garden/${saved.id}`}
                          className="text-sm font-semibold text-green-800 hover:underline"
                        >
                          Record plantings
                        </Link>
                      </p>
                      <OverrideControls section={saved} />
                    </>
                  ) : null}
                </fieldset>
              );
            })}

            <div className="sticky bottom-20 rounded-xl border bg-white/95 p-4 shadow-lg backdrop-blur md:bottom-4">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <StatusLine
                  state={saveState}
                  idle="Ranges must cover the bed without gaps or overlaps."
                />
                <button
                  type="submit"
                  disabled={savePending}
                  className="min-h-12 rounded-lg bg-green-800 px-6 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
                >
                  {savePending ? "Saving…" : "Save sections"}
                </button>
              </div>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}

export function PreviousSeasonsPanel({ board }: { board: SeasonBoardRecord }) {
  const [historySeasonId, setHistorySeasonId] = useState(
    board.pastSeasons[0]?.id ?? "",
  );
  const historySeason =
    board.pastSeasons.find((season) => season.id === historySeasonId) ?? null;

  if (board.pastSeasons.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border bg-white p-5 pb-28 shadow-sm sm:p-6 md:pb-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Previous seasons</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Read-only history of earlier section cuts and their exposures.
        </p>
      </div>
      <label className="block text-sm font-semibold text-neutral-800">
        Season
        <select
          className={fieldClass}
          value={historySeasonId}
          onChange={(event) => setHistorySeasonId(event.target.value)}
        >
          {board.pastSeasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name} ({season.startsOn} → {season.endsOn})
            </option>
          ))}
        </select>
      </label>
      {historySeason ? (
        <HistorySections
          season={historySeason}
          bedLengthFt={board.bedLengthFt}
        />
      ) : null}
    </section>
  );
}
