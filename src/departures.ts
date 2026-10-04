/** Reading departures sensors, and the times and colours the card shows for them. */
import { DEPARTURES_VERSION, GONE_AFTER_MS, MODES } from "./const";
import type { HassEntity, HomeAssistant } from "./hass";
import type { Departure, SectionConfig } from "./types";

/** The card's `entities` as sections, whether each was written as an entity id or with its heading. */
export function sectionsOf(entities: Array<string | SectionConfig> | undefined): SectionConfig[] {
    return (entities ?? [])
        .map((entry) => (typeof entry === "string" ? { entity: entry } : entry))
        .filter((section) => typeof section?.entity === "string" && section.entity !== "");
}

/** The stop's notices, keeping only texts: the attribute comes from any source. */
export function stopNotices(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((notice): notice is string => typeof notice === "string" && notice.trim() !== "") : [];
}

/** Whether an entity writes the departures format. */
export function isDeparturesSensor(entity: HassEntity | undefined): boolean {
    return entity?.attributes?.departures_version === DEPARTURES_VERSION && Array.isArray(entity.attributes.departures);
}

/** The sensors that write the departures format, for the card picker and the editor. */
export function departuresSensors(hass: HomeAssistant): string[] {
    return Object.keys(hass.states)
        .filter((id) => isDeparturesSensor(hass.states[id]))
        .sort();
}

/**
 * What a section shows: the next departure that isn't cancelled, large, and the ones after it.
 *
 * Departures more than a minute gone are dropped. A cancelled departure is never the large one, but stays in the rows, in its
 * place by time, unless cancelled ones are hidden. `count` covers both, the large one included.
 */
export function visibleDepartures(
    departures: Departure[],
    now: number,
    count: number,
    showCancelled: boolean,
): { next?: Departure; rest: Departure[] } {
    const upcoming = departures
        .filter((departure) => isDeparture(departure) && Date.parse(departure.estimated) > now - GONE_AFTER_MS)
        .filter((departure) => showCancelled || !departure.cancelled)
        .sort((a, b) => Date.parse(a.estimated) - Date.parse(b.estimated));
    const next = upcoming.find((departure) => !departure.cancelled);
    const rest = upcoming.filter((departure) => departure !== next).slice(0, Math.max(count - (next ? 1 : 0), 0));
    return { next, rest };
}

/** The attribute comes from any source, so a departure without the required fields is skipped rather than drawn broken. */
function isDeparture(value: unknown): value is Departure {
    const departure = value as Departure;
    return (
        typeof departure === "object" &&
        departure !== null &&
        typeof departure.line === "string" &&
        !Number.isNaN(Date.parse(departure.estimated)) &&
        !Number.isNaN(Date.parse(departure.scheduled))
    );
}

/** How soon a departure leaves: "now" under a minute, minutes under an hour, otherwise null, for the clock time. */
export function minutesUntil(estimated: string, now: number): number | null {
    const minutes = Math.floor((Date.parse(estimated) - now) / 60_000);
    return minutes < 60 ? Math.max(minutes, 0) : null;
}

/**
 * Whole minutes late, or early when negative; 0 when not live, since a timetable time has no delay to tell. Worked out
 * from the two clock times the card shows rather than from `delay`, so "17.02 → 17.03" never reads "+2 min".
 */
export function delayMinutes(departure: Departure): number {
    if (!departure.realtime) {
        return 0;
    }
    return Math.floor(Date.parse(departure.estimated) / 60_000) - Math.floor(Date.parse(departure.scheduled) / 60_000);
}

/** The time of day, as the viewer's language writes it: 17.05 in Finnish, 17:05 in English. */
export function clock(time: string, language: string, timeZone?: string): string {
    return new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(time));
}

/**
 * The day of a time that isn't today, for putting in front of its clock time: the weekday within a week ("ma",
 * "Mon"), the date further off ("12.10."), and nothing for today. Days are counted where the clock times are shown.
 */
export function dayLabel(time: string, now: number, language: string, timeZone?: string): string {
    const date = (value: Date | number) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(value);
    const day = date(new Date(time));
    if (day === date(now)) {
        return "";
    }
    const daysAway = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${date(now)}T00:00:00Z`)) / 86_400_000;
    const options: Intl.DateTimeFormatOptions = daysAway > 0 && daysAway < 7 ? { weekday: "short" } : { day: "numeric", month: "numeric" };
    return new Intl.DateTimeFormat(language, { ...options, timeZone }).format(new Date(time));
}

export function modeOf(departure: Departure): { icon: string; color: string } {
    return MODES[departure.mode] ?? MODES.other;
}

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

/** The badge's colours: the line's own when the source gives one, otherwise the mode's, with white text. */
export function badgeColors(departure: Departure): { background: string; text: string } {
    const match = HEX_COLOR.exec(departure.color ?? "");
    if (!match) {
        return { background: modeOf(departure).color, text: "#ffffff" };
    }
    return { background: `#${match[1]}`, text: isLight(match[1]) ? "#1f1f1f" : "#ffffff" };
}

/**
 * Whether white text falls short on a colour: below WCAG's 4.5:1 for normal text. Transit colours often sit where white and black
 * contrast about equally, and white is what the lines themselves use, so it wins until it no longer reads.
 */
function isLight(hex: string): boolean {
    const [r, g, b] = [0, 2, 4].map((at) => {
        const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return 1.05 / (luminance + 0.05) < 4.5;
}
