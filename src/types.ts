import type { LovelaceCardConfig } from "./hass";
import type { RowStepConfig } from "./rows";

/** One section of the card: a departures sensor, and how its heading reads. */
export interface SectionConfig {
    entity: string;
    /** Replaces the stop's own name. Both sides of a street usually share one. */
    name?: string;
    /** A second, quieter part of the heading, such as the direction: "towards the centre". */
    subtitle?: string;
}

export interface DeparturesCardConfig extends LovelaceCardConfig, RowStepConfig {
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
    /** Every text the card would cut short wraps instead. */
    full_texts?: boolean;
    /** All the sensors as one list by time instead of a section each, such as an airport's departures and arrivals. */
    combine?: boolean;
}

/** Which way a sensor's list goes. A sensor that doesn't say is departures. */
export type Direction = "departures" | "arrivals";

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
    /** An arrival that has come in. */
    arrived?: boolean | null;
    notice?: string | null;
    color?: string | null;
}

/** A departure as the card shows it: with the direction of the sensor it came from, and a key unique in the card. */
export interface ShownDeparture extends Departure {
    direction: Direction;
    key: string;
}
