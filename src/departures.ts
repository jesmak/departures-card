/** Reading departures sensors, and the times and colours the card shows for them. */
import { ARRIVED_KEPT_MS, ARRIVED_ROWS, DEPARTURES_VERSION, GONE_AFTER_MS, MODE_COLORS } from "./const";
import type { HassEntity, HomeAssistant } from "./hass";
import type { Departure, Direction, SectionConfig, ShownDeparture } from "./types";

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

/** The direction a sensor says it has, or none when it doesn't say, as other sources' departures. */
export function statedDirection(entity: HassEntity | undefined): Direction | undefined {
    const direction = entity?.attributes?.direction;
    return direction === "departures" || direction === "arrivals" ? direction : undefined;
}

/**
 * A sensor's departures as the card shows them, keyed by the sensor as well when `withEntity` is set: ids are unique within a
 * sensor only, and the same flight number lands at two airports on the same day.
 */
export function shownDepartures(entityId: string, entity: HassEntity, withEntity: boolean): ShownDeparture[] {
    const direction = statedDirection(entity) ?? "departures";
    const list = Array.isArray(entity.attributes.departures) ? (entity.attributes.departures as unknown[]) : [];
    return list.filter(isDeparture).map((departure) => ({
        ...departure,
        direction,
        key: withEntity ? `${entityId}|${departure.id}` : departure.id,
    }));
}

/** The sensors that write the departures format, for the card picker and the editor. */
export function departuresSensors(hass: HomeAssistant): string[] {
    return Object.keys(hass.states)
        .filter((id) => isDeparturesSensor(hass.states[id]))
        .sort();
}

/**
 * What a section shows: the next departure that isn't cancelled or in already, large, and the ones after it.
 *
 * Departures more than a minute gone are dropped, and arrivals half an hour after their time. A cancelled one or one
 * that has come in is never the large one, but stays in the rows, in its place by time, unless cancelled ones are
 * hidden. `count` covers those still to come and not cancelled, the large one included, and the cancelled ones among
 * them are listed too, filling a list short of `count` up to it. Arrivals that are over, come in or cancelled and past their time, are listed besides
 * it, the latest two.
 */
export function visibleDepartures(
    departures: ShownDeparture[],
    now: number,
    count: number,
    showCancelled: boolean,
): { next?: ShownDeparture; rest: ShownDeparture[] } {
    const upcoming = departures
        .filter(
            (departure) => Date.parse(departure.estimated) >= now - (departure.direction === "arrivals" ? ARRIVED_KEPT_MS : GONE_AFTER_MS),
        )
        .filter((departure) => showCancelled || !departure.cancelled)
        .sort((a, b) => Date.parse(a.estimated) - Date.parse(b.estimated));
    // Over: an arrival that has come in, or one cancelled and past its time.
    const over = (departure: ShownDeparture) =>
        departure.direction === "arrivals" && (departure.cancelled ? Date.parse(departure.estimated) < now : !!departure.arrived);
    const arrived = upcoming.filter(over).slice(-ARRIVED_ROWS);
    const coming = upcoming.filter((departure) => !over(departure));
    const listed = counted(coming, count);
    const next = listed.find((departure) => !departure.cancelled);
    const rest = [...arrived, ...listed.filter((departure) => departure !== next)].sort(
        (a, b) => Date.parse(a.estimated) - Date.parse(b.estimated),
    );
    return { next, rest };
}

/**
 * The first `count` not cancelled, in order, with the cancelled ones among them. When fewer than `count` aren't
 * cancelled, as in a strike, the cancelled ones after the last of them fill the list up to `count`.
 */
function counted(departures: ShownDeparture[], count: number): ShownDeparture[] {
    let last = -1;
    let counting = 0;
    for (const [index, departure] of departures.entries()) {
        if (counting >= count) break;
        if (!departure.cancelled) {
            last = index;
            counting++;
        }
    }
    const listed = departures.slice(0, last + 1);
    return counting >= count ? listed : [...listed, ...departures.slice(last + 1, count)];
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
 * The day of a time that isn't today, for putting in front of its clock time: the weekday within the next six days
 * ("ma", "Mon"), the date from a week on ("12.10."), and nothing for today. Days are counted where the clock times
 * are shown.
 */
export function dayLabel(time: string, now: number, language: string, timeZone?: string): string {
    const date = (value: Date | number) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(value);
    const day = date(new Date(time));
    const daysAway = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${date(now)}T00:00:00Z`)) / 86_400_000;
    // A departure gone a moment before midnight is still shown for a minute after it, as yesterday's needs no day.
    if (daysAway <= 0) {
        return "";
    }
    const options: Intl.DateTimeFormatOptions = daysAway < 7 ? { weekday: "short" } : { day: "numeric", month: "numeric" };
    return new Intl.DateTimeFormat(language, { ...options, timeZone }).format(new Date(time));
}

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

/** The badge's colours: the line's own when the source gives one, otherwise the mode's, with white text. */
export function badgeColors(departure: Departure): { background: string; text: string } {
    const match = HEX_COLOR.exec(departure.color ?? "");
    if (!match) {
        return { background: MODE_COLORS[departure.mode] ?? MODE_COLORS.other, text: "#ffffff" };
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
