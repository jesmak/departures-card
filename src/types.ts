import type { LovelaceCardConfig } from "./hass";

/** One section of the card: a departures sensor, and how its heading reads. */
export interface SectionConfig {
    entity: string;
    /** Replaces the stop's own name. Both sides of a street usually share one. */
    name?: string;
    /** A second, quieter part of the heading, such as the direction: "towards the centre". */
    subtitle?: string;
}

export interface DeparturesCardConfig extends LovelaceCardConfig {
    /** Departures sensors, each a section of its own: an entity id, or one with its heading. */
    entities: Array<string | SectionConfig>;
    /** Shown at the top of the card. */
    title?: string;
    /** How many departures each section shows: the next one large and the rest below it. */
    departures?: number;
    /** Cancelled departures stay in the list, struck through, unless this is false. */
    show_cancelled?: boolean;
    /** The stop's notices, such as track works, are shown under its name unless this is false. */
    show_notices?: boolean;
}

/** One departure, as docs/departures-format.md describes it. */
export interface Departure {
    id: string;
    line: string;
    mode: string;
    headsign?: string | null;
    scheduled: string;
    estimated: string;
    realtime?: boolean | null;
    delay?: number | null;
    platform?: string | null;
    cancelled?: boolean | null;
    notice?: string | null;
    color?: string | null;
}
