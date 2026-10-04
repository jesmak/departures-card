import { describe, expect, it } from "vitest";

import {
    badgeColors,
    clock,
    dayLabel,
    delayMinutes,
    departuresSensors,
    minutesUntil,
    sectionsOf,
    visibleDepartures,
} from "../src/departures";
import type { HomeAssistant } from "../src/hass";
import type { Departure } from "../src/types";

const NOW = Date.parse("2026-10-04T13:52:00Z");

function departure(id: string, minutes: number, extra: Partial<Departure> = {}): Departure {
    const time = new Date(NOW + minutes * 60_000).toISOString();
    return { id, line: "55", mode: "bus", headsign: "Koskela", scheduled: time, estimated: time, ...extra };
}

describe("visibleDepartures", () => {
    it("drops departures more than a minute gone and sorts the rest by estimate", () => {
        const { next, rest } = visibleDepartures(
            [departure("c", 30), departure("gone", -2), departure("a", 0), departure("just", -0.5), departure("b", 10)],
            NOW,
            4,
            true,
        );
        expect(next?.id).toBe("just");
        expect(rest.map((item) => item.id)).toEqual(["a", "b", "c"]);
    });

    it("never makes a cancelled departure the next one, but keeps it in the rows by time", () => {
        const { next, rest } = visibleDepartures(
            [departure("cancelled", 2, { cancelled: true }), departure("first", 5), departure("second", 9)],
            NOW,
            4,
            true,
        );
        expect(next?.id).toBe("first");
        expect(rest.map((item) => item.id)).toEqual(["cancelled", "second"]);
    });

    it("leaves cancelled departures out when they are hidden", () => {
        const { rest } = visibleDepartures([departure("cancelled", 2, { cancelled: true }), departure("first", 5)], NOW, 4, false);
        expect(rest).toEqual([]);
    });

    it("counts the next departure in the count, and shows cancelled ones even when nothing else leaves", () => {
        const list = [1, 2, 3, 4, 5, 6].map((minutes) => departure(`d${minutes}`, minutes));
        expect(visibleDepartures(list, NOW, 4, true).rest).toHaveLength(3);
        expect(visibleDepartures(list, NOW, 1, true).rest).toHaveLength(0);

        const onlyCancelled = visibleDepartures([departure("x", 3, { cancelled: true })], NOW, 4, true);
        expect(onlyCancelled.next).toBeUndefined();
        expect(onlyCancelled.rest.map((item) => item.id)).toEqual(["x"]);
    });

    it("skips departures missing what a row needs", () => {
        const broken = [{ id: "x", mode: "bus" }, { ...departure("y", 3), estimated: "soon" }, null] as unknown as Departure[];
        expect(visibleDepartures([...broken, departure("ok", 4)], NOW, 4, true).next?.id).toBe("ok");
    });
});

describe("times", () => {
    it("count down in whole minutes under an hour, and give way to the clock after", () => {
        expect(minutesUntil(new Date(NOW + 30_000).toISOString(), NOW)).toBe(0);
        expect(minutesUntil(new Date(NOW - 30_000).toISOString(), NOW)).toBe(0);
        expect(minutesUntil(new Date(NOW + 11.9 * 60_000).toISOString(), NOW)).toBe(11);
        expect(minutesUntil(new Date(NOW + 59.5 * 60_000).toISOString(), NOW)).toBe(59);
        expect(minutesUntil(new Date(NOW + 60 * 60_000).toISOString(), NOW)).toBeNull();
    });

    it("get their day when it isn't today, counted where they are shown", () => {
        // NOW is Sunday 16.52 in Helsinki.
        expect(dayLabel("2026-10-04T20:59:00Z", NOW, "fi", "Europe/Helsinki")).toBe("");
        expect(dayLabel("2026-10-04T21:05:00Z", NOW, "fi", "Europe/Helsinki")).toBe("ma");
        expect(dayLabel("2026-10-06T03:15:00Z", NOW, "en", "Europe/Helsinki")).toBe("Tue");
        expect(dayLabel("2026-10-12T03:15:00Z", NOW, "fi", "Europe/Helsinki")).toBe("12.10.");
        expect(dayLabel("2026-10-04T21:05:00Z", NOW, "fi", "UTC")).toBe("");
    });

    it("are written the way the language writes them", () => {
        expect(clock("2026-10-04T14:05:00Z", "fi", "Europe/Helsinki")).toBe("17.05");
        expect(clock("2026-10-04T14:05:00Z", "en-GB", "Europe/Helsinki")).toBe("17:05");
    });

    it("have a delay only when they are live, in the minutes the clock times show", () => {
        const late = (seconds: number, extra: Partial<Departure> = {}) =>
            departure("a", 5, { estimated: new Date(NOW + 5 * 60_000 + seconds * 1000).toISOString(), realtime: true, ...extra });
        expect(delayMinutes(late(420))).toBe(7);
        expect(delayMinutes(late(40, { delay: 60 }))).toBe(0);
        expect(delayMinutes(late(-50))).toBe(-1);
        expect(delayMinutes(late(420, { realtime: false }))).toBe(0);
    });
});

describe("badgeColors", () => {
    it("use the line's own colour, with text that reads on it", () => {
        expect(badgeColors(departure("a", 1, { color: "#007AC9" }))).toEqual({ background: "#007AC9", text: "#ffffff" });
        expect(badgeColors(departure("a", 1, { color: "#ffcc00" }))).toEqual({ background: "#ffcc00", text: "#1f1f1f" });
    });

    it("fall back to the mode's colour, and to other's for a mode nobody knows", () => {
        expect(badgeColors(departure("a", 1, { mode: "train" })).background).toContain("--departures-train-color");
        expect(badgeColors(departure("a", 1, { mode: "funicular", color: "red" })).background).toContain("--departures-other-color");
    });
});

describe("sections", () => {
    it("accept entity ids and headings alike, and skip empty ones", () => {
        expect(sectionsOf(["sensor.a", { entity: "sensor.b", name: "B" }, { entity: "" }] as never)).toEqual([
            { entity: "sensor.a" },
            { entity: "sensor.b", name: "B" },
        ]);
        expect(sectionsOf(undefined)).toEqual([]);
    });

    it("are offered only from sensors that write the format", () => {
        const sensor = (attributes: Record<string, unknown>) => ({ entity_id: "", state: "", last_changed: "", attributes });
        const hass: HomeAssistant = {
            states: {
                "sensor.kauppatori": sensor({ departures_version: 1, departures: [] }),
                "sensor.future": sensor({ departures_version: 2, departures: [] }),
                "sensor.kitchen": sensor({}),
            },
        };
        expect(departuresSensors(hass)).toEqual(["sensor.kauppatori"]);
    });
});
