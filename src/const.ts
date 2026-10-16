/** Replaced at build time with the version in package.json. */
declare const __CARD_VERSION__: string;

export const CARD_VERSION = __CARD_VERSION__;

/** The version of the departures format this card reads. */
export const DEPARTURES_VERSION = 1;

export const DEFAULT_DEPARTURES = 4;

/** A departure is hidden once it is this far in the past, so a sensor that updates once a minute doesn't show a bus that has gone. */
export const GONE_AFTER_MS = 60_000;

/** How often the countdowns are redrawn, between the sensor's own updates. */
export const TICK_MS = 15_000;

/** A default colour per mode. A line's own colour replaces the mode's. */
export const MODE_COLORS: Record<string, string> = {
    bus: "var(--departures-bus-color, #0b6aa2)",
    tram: "var(--departures-tram-color, #00845a)",
    metro: "var(--departures-metro-color, #d9480f)",
    train: "var(--departures-train-color, #1b7a3e)",
    ferry: "var(--departures-ferry-color, #00639a)",
    other: "var(--departures-other-color, #5f6b76)",
};
