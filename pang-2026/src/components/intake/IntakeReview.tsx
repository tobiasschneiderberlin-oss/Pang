"use client";

/**
 * PANG — intake review surface.
 *
 * The screen Laura lands on after the viewfinder fires. It renders
 * the `IntakeOutput` the P-LLM returned. Every AI-authored field is
 * wrapped in `<Confidence source="ai">`. Every edit is a `<Diff>`.
 *
 * The surface is deliberately flat and quiet. No toolbar, no
 * "confirm and continue" CTA with a blue fill. One primary action —
 * *add to wall* — which triggers the View Transition to the arrival
 * chapter. One secondary — *amend* — which toggles per-field edit.
 *
 * This component is the *surface*. The upload + persistence live in
 * `intakeQueue`; the parent (`app/scan/page.tsx`) is the router.
 */

import { useReducer, type ReactElement } from "react";
import type { IntakeOutput } from "@/ai/tools/artwork";
import { Confidence } from "./Confidence";
import { Diff } from "./Diff";

export interface IntakeReviewProps {
  readonly output: IntakeOutput;
  readonly onAddToWall: (edited: IntakeOutput) => void;
  readonly onReshoot: () => void;
}

type EditableField = "artist" | "title" | "medium" | "year";

interface EditState {
  readonly current: IntakeOutput;
  readonly original: IntakeOutput;
  readonly editing: ReadonlySet<EditableField>;
}

type EditAction =
  | { type: "toggle"; field: EditableField }
  | { type: "set"; field: "artist" | "title" | "medium"; value: string | null }
  | { type: "setYear"; value: number | null };

function reducer(state: EditState, action: EditAction): EditState {
  switch (action.type) {
    case "toggle": {
      const editing = new Set<EditableField>(state.editing);
      if (editing.has(action.field)) editing.delete(action.field);
      else editing.add(action.field);
      return { ...state, editing };
    }
    case "set": {
      return {
        ...state,
        current: {
          ...state.current,
          artwork: { ...state.current.artwork, [action.field]: action.value },
        },
      };
    }
    case "setYear": {
      return {
        ...state,
        current: {
          ...state.current,
          artwork: { ...state.current.artwork, year: action.value },
        },
      };
    }
  }
}

export function IntakeReview(props: IntakeReviewProps): ReactElement {
  const [state, dispatch] = useReducer(reducer, {
    current: props.output,
    original: props.output,
    editing: new Set<EditableField>(),
  });

  const { current, original } = state;
  const confidence = current.artwork.confidenceBySource;

  return (
    <main
      className="flex min-h-dvh flex-col gap-8 bg-paper p-8 text-ink"
      aria-label="intake review"
      // Named for View Transitions (Primitive §3). The arrival
      // chapter animates this frame into the wall.
      style={{ viewTransitionName: "intake-frame" }}
    >
      {/* Arrival line — the one P-LLM-authored sentence that anchors
          the review. Voice: Museumsschild test. */}
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-ai">
          the work
        </span>
        <p className="max-w-2xl text-lg text-ink" data-pang-source="ai">
          {current.arrivalLine}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FieldRow
          label="artist"
          editing={state.editing.has("artist")}
          previous={original.artwork.artist}
          current={current.artwork.artist}
          confidence={confidence.artist}
          onToggle={() => dispatch({ type: "toggle", field: "artist" })}
          onChange={(v) => dispatch({ type: "set", field: "artist", value: v })}
        />
        <FieldRow
          label="title"
          editing={state.editing.has("title")}
          previous={original.artwork.title}
          current={current.artwork.title}
          confidence={confidence.title}
          onToggle={() => dispatch({ type: "toggle", field: "title" })}
          onChange={(v) => dispatch({ type: "set", field: "title", value: v })}
        />
        <FieldRow
          label="medium"
          editing={state.editing.has("medium")}
          previous={original.artwork.medium}
          current={current.artwork.medium}
          confidence={confidence.medium}
          onToggle={() => dispatch({ type: "toggle", field: "medium" })}
          onChange={(v) => dispatch({ type: "set", field: "medium", value: v })}
        />
        <YearRow
          editing={state.editing.has("year")}
          previous={original.artwork.year}
          current={current.artwork.year}
          confidence={confidence.year}
          onToggle={() => dispatch({ type: "toggle", field: "year" })}
          onChange={(v) => dispatch({ type: "setYear", value: v })}
        />
      </section>

      {current.galleryOfOrigin && (
        <section className="flex flex-col gap-2">
          <Confidence source="gallery" label="gallery of origin">
            {current.galleryOfOrigin.galleryName}
          </Confidence>
        </section>
      )}

      {current.artistContext.bioMuji && (
        <section className="max-w-2xl">
          <Confidence
            source="ai"
            label="artist note"
            score={confidence.artist}
          >
            {current.artistContext.bioMuji}
          </Confidence>
        </section>
      )}

      <footer className="mt-auto flex items-center justify-between gap-4 pt-8">
        <button
          type="button"
          onClick={props.onReshoot}
          className="border border-ink-ai px-6 py-3 text-ink-ai"
          aria-label="reshoot"
        >
          reshoot
        </button>
        <button
          type="button"
          onClick={() => props.onAddToWall(current)}
          className="border border-ink bg-ink px-8 py-3 text-paper"
          aria-label="add to wall"
          style={{ viewTransitionName: "add-to-wall" }}
        >
          add to wall
        </button>
      </footer>
    </main>
  );
}

// ---------- Row components ---------------------------------------

interface FieldRowProps {
  readonly label: string;
  readonly editing: boolean;
  readonly previous: string | null;
  readonly current: string | null;
  readonly confidence: number;
  readonly onToggle: () => void;
  readonly onChange: (value: string | null) => void;
}

function FieldRow(props: FieldRowProps): ReactElement {
  if (props.editing) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-ink-ai">
          {props.label}
        </span>
        <input
          type="text"
          value={props.current ?? ""}
          onChange={(e) => props.onChange(e.currentTarget.value || null)}
          onBlur={props.onToggle}
          autoFocus
          className="border-b border-ink bg-transparent py-1 text-ink outline-none"
          aria-label={props.label}
        />
      </label>
    );
  }

  const changed = props.previous !== props.current;
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="flex flex-col gap-1 text-left"
      aria-label={`edit ${props.label}`}
    >
      {changed ? (
        <Diff
          label={props.label}
          previous={props.previous}
          next={props.current}
        />
      ) : (
        <Confidence
          source="ai"
          label={props.label}
          score={props.confidence}
        >
          {props.current ?? "—"}
        </Confidence>
      )}
    </button>
  );
}

interface YearRowProps {
  readonly editing: boolean;
  readonly previous: number | null;
  readonly current: number | null;
  readonly confidence: number;
  readonly onToggle: () => void;
  readonly onChange: (value: number | null) => void;
}

function YearRow(props: YearRowProps): ReactElement {
  if (props.editing) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-ink-ai">
          year
        </span>
        <input
          type="number"
          value={props.current ?? ""}
          onChange={(e) => {
            const v = e.currentTarget.value;
            props.onChange(v === "" ? null : Number(v));
          }}
          onBlur={props.onToggle}
          autoFocus
          inputMode="numeric"
          className="border-b border-ink bg-transparent py-1 text-ink outline-none"
          aria-label="year"
        />
      </label>
    );
  }
  const changed = props.previous !== props.current;
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="flex flex-col gap-1 text-left"
      aria-label="edit year"
    >
      {changed ? (
        <Diff
          label="year"
          previous={props.previous !== null ? String(props.previous) : null}
          next={props.current !== null ? String(props.current) : null}
        />
      ) : (
        <Confidence source="ai" label="year" score={props.confidence}>
          {props.current !== null ? props.current : "—"}
        </Confidence>
      )}
    </button>
  );
}
