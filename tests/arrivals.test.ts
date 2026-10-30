import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../src/departures-card";
import type { DeparturesCard } from "../src/departures-card";
import { visibleDepartures } from "../src/departures";
import type { HomeAssistant } from "../src/hass";
import type { Departure, DeparturesCardConfig, Direction, ShownDeparture } from "../src/types";

const NOW = Date.parse("2026-03-14T10:00:00Z");

// Made-up flights at an airport, shaped like the ones finavia_flights writes.
function flight(id: string, minutes: number, extra: Partial<Departure> = {}): Departure {
    const time = new Date(NOW + minutes * 60_000).toISOString();
    return { id, line: id.toUpperCase(), mode: "plane", headsign: "Oulu", scheduled: time, estimated: time, ...extra };
}

interface Sensor {
    departures: Departure[];
    direction?: Direction;
    stop_name?: string;
}

function hass(sensors: Record<string, Sensor>): HomeAssistant {
    return {
        locale: { language: "fi", time_zone: "server" },
        config: { time_zone: "Europe/Helsinki" },
        states: Object.fromEntries(
            Object.entries(sensors).map(([id, sensor]) => [
                id,
                {
                    entity_id: id,
                    state: "2026-03-14T10:00:00+00:00",
                    last_changed: "2026-03-14",
                    attributes: { departures_version: 1, stop_name: "Esimerkkilä", attribution: "Finavia", ...sensor },
                },
            ]),
        ),
    };
}

async function card(state: HomeAssistant, config: Partial<DeparturesCardConfig>): Promise<DeparturesCard> {
    const element = document.createElement("departures-card");
    element.setConfig({ type: "custom:departures-card", entities: ["sensor.lahtevat"], ...config } as DeparturesCardConfig);
    element.hass = state;
    document.body.append(element);
    await element.updateComplete;
    return element;
}

function text(element: Element | null | undefined): string {
    return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

// Each icon with its tooltip, which says the same in words.
const icons = (root: ParentNode) =>
    [...root.querySelectorAll("ha-icon.direction")].map((icon) => `${icon.getAttribute("icon")} ${icon.getAttribute("title")}`);
const TITLES: Record<string, string> = {
    "mdi:airplane-takeoff": "Lähtevä",
    "mdi:airplane-landing": "Saapuva",
    "mdi:location-exit": "Lähtevä",
    "mdi:location-enter": "Saapuva",
};
const titled = (expected: string[]) => expected.map((icon) => `${icon} ${TITLES[icon]}`);

const DEPARTURES = { departures: [flight("ay1", 10), flight("ay3", 40)], direction: "departures" } satisfies Sensor;
const ARRIVALS = { departures: [flight("ay2", 20), flight("ay4", 50)], direction: "arrivals" } satisfies Sensor;
const BUSES = { departures: [flight("55", 15, { mode: "bus" }), flight("16", 45, { mode: "bus" })] } satisfies Sensor;
// A station's trains: today's departures write no direction, and its arrivals do.
const TRAINS = { departures: [flight("ic10", 12, { mode: "train" }), flight("ic12", 42, { mode: "train" })] } satisfies Sensor;
const TRAIN_ARRIVALS = {
    departures: [flight("ic11", 8, { mode: "train" }), flight("ic13", 38, { mode: "train" })],
    direction: "arrivals",
} satisfies Sensor;

describe("arrivals and directions", () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    // Where the direction icons go: the large row always has one on a plane or a train, the rows only in one list that has
    // both directions in it. A card of one direction says it in its subtitle, and buses have no direction to show.
    it.each([
        ["departures alone", ["sensor.lahtevat"], false, ["mdi:airplane-takeoff"], []],
        ["arrivals alone", ["sensor.saapuvat"], false, ["mdi:airplane-landing"], []],
        ["both as two sections", ["sensor.lahtevat", "sensor.saapuvat"], false, ["mdi:airplane-takeoff", "mdi:airplane-landing"], []],
        [
            "both in one list",
            ["sensor.lahtevat", "sensor.saapuvat"],
            true,
            ["mdi:airplane-takeoff"],
            ["mdi:airplane-landing", "mdi:airplane-takeoff", "mdi:airplane-landing"],
        ],
        ["two airports' departures in one list", ["sensor.lahtevat", "sensor.toinen"], true, ["mdi:airplane-takeoff"], []],
        ["buses", ["sensor.bussit"], false, [], []],
        ["a station's departures, which state no direction", ["sensor.juna"], false, ["mdi:location-exit"], []],
        ["a station's arrivals", ["sensor.junat_saapuvat"], false, ["mdi:location-enter"], []],
        ["a station's departures that say so", ["sensor.junat_lahtevat"], false, ["mdi:location-exit"], []],
        ["a direction the card doesn't know, as departures", ["sensor.juna_outo"], false, ["mdi:location-exit"], []],
        [
            "a station's two sensors as two sections",
            ["sensor.juna", "sensor.junat_saapuvat"],
            false,
            ["mdi:location-exit", "mdi:location-enter"],
            [],
        ],
        [
            "departures that say so with arrivals in one list",
            ["sensor.junat_lahtevat", "sensor.junat_saapuvat"],
            true,
            ["mdi:location-enter"],
            ["mdi:location-exit", "mdi:location-enter", "mdi:location-exit"],
        ],
        [
            "departures, one unknown and one stated, in one list",
            ["sensor.juna_outo", "sensor.junat_lahtevat"],
            true,
            ["mdi:location-exit"],
            [],
        ],
        [
            "a station's two stated sensors as two sections",
            ["sensor.junat_lahtevat", "sensor.junat_saapuvat"],
            false,
            ["mdi:location-exit", "mdi:location-enter"],
            [],
        ],
        [
            "planes and trains both ways in one list",
            ["sensor.lahtevat", "sensor.junat_saapuvat"],
            true,
            ["mdi:location-enter"],
            ["mdi:airplane-takeoff", "mdi:location-enter", "mdi:airplane-takeoff"],
        ],
        [
            "an unknown direction with arrivals in one list, as departures",
            ["sensor.juna_outo", "sensor.junat_saapuvat"],
            true,
            ["mdi:location-enter"],
            ["mdi:location-exit", "mdi:location-enter", "mdi:location-exit"],
        ],
        [
            "a station both ways in one list",
            ["sensor.juna", "sensor.junat_saapuvat"],
            true,
            ["mdi:location-enter"],
            ["mdi:location-exit", "mdi:location-enter", "mdi:location-exit"],
        ],
        [
            "buses and arrivals in one list",
            ["sensor.bussit", "sensor.saapuvat"],
            true,
            [],
            ["mdi:airplane-landing", "mdi:airplane-landing"],
        ],
    ])("icons: %s", async (_case, entities, combine, large, rows) => {
        const state = hass({
            "sensor.lahtevat": DEPARTURES,
            "sensor.saapuvat": ARRIVALS,
            "sensor.toinen": { ...DEPARTURES, stop_name: "Toinen" },
            "sensor.bussit": BUSES,
            "sensor.juna": TRAINS,
            "sensor.junat_saapuvat": TRAIN_ARRIVALS,
            "sensor.junat_lahtevat": { ...TRAINS, direction: "departures" },
            // A source can write any direction, though the type knows only two.
            "sensor.juna_outo": { ...TRAINS, direction: "sideways" } as unknown as Sensor,
        });
        const root = (await card(state, { entities, combine, departures: 10 })).shadowRoot!;
        expect([...root.querySelectorAll(".next")].flatMap(icons)).toEqual(titled(large));
        expect([...root.querySelectorAll(".rows")].flatMap(icons)).toEqual(titled(rows));
    });

    it("names a sensor's direction under its name, unless the subtitle is set, and a bus stop's not at all", async () => {
        const state = hass({ "sensor.lahtevat": DEPARTURES, "sensor.saapuvat": ARRIVALS, "sensor.bussit": BUSES });
        const root = (
            await card(state, {
                entities: ["sensor.lahtevat", "sensor.saapuvat", { entity: "sensor.saapuvat", subtitle: "Oma" }, "sensor.bussit"],
            })
        ).shadowRoot!;
        expect([...root.querySelectorAll(".heading")].map(text)).toEqual([
            "Esimerkkilä Lähtevät",
            "Esimerkkilä Saapuvat",
            "Esimerkkilä Oma",
            "Esimerkkilä",
        ]);
    });

    it("shows a landed flight's delay and other notice", async () => {
        const late = flight("ay5", -12, {
            arrived: true,
            realtime: true,
            scheduled: new Date(NOW - 25 * 60_000).toISOString(),
            notice: "Matkatavarat myöhässä",
            platform: "2A",
        });
        const state = hass({ "sensor.saapuvat": { departures: [late, flight("ay6", 5)], direction: "arrivals" } });
        const row = (await card(state, { entities: ["sensor.saapuvat"] })).shadowRoot!.querySelector(".row.came-in");
        expect(text(row)).toBe("11.48 AY5 Oulu +13 min Laskeutunut Matkatavarat myöhässä Aula 2A");
    });

    it("lists only the two latest that have landed, within the count", async () => {
        const landed = [-25, -20, -15, -10].map((minutes, index) => flight(`ay${index}`, minutes, { arrived: true }));
        const state = hass({ "sensor.saapuvat": { departures: [...landed, flight("ay8", 5), flight("ay9", 15)], direction: "arrivals" } });
        const root = (await card(state, { entities: ["sensor.saapuvat"], departures: 3 })).shadowRoot!;
        expect(text(root.querySelector(".next .badge"))).toBe("AY8");
        expect([...root.querySelectorAll(".row .badge")].map(text)).toEqual(["AY2", "AY3"]);
    });

    it("lists the two latest over of the whole list, a cancelled one among them as cancelled, not landed", async () => {
        const state = hass({
            "sensor.saapuvat": {
                departures: [flight("ay1", -25, { arrived: true }), flight("ay3", -10, { arrived: true })],
                direction: "arrivals",
            },
            "sensor.toiset": {
                departures: [
                    flight("ay2", -20, { arrived: true }),
                    flight("ay4", -5, { arrived: true, cancelled: true }),
                    flight("ay5", 5),
                ],
                direction: "arrivals",
                stop_name: "Toinen",
            },
        });
        const root = (await card(state, { entities: ["sensor.saapuvat", "sensor.toiset"], combine: true, departures: 10 })).shadowRoot!;
        expect([...root.querySelectorAll(".row .badge")].map(text)).toEqual(["AY3", "AY4"]);
        expect(text(root.querySelector(".row.cancelled"))).toBe("11.55 AY4 Oulu Peruttu");
        expect(root.querySelector(".row.cancelled.came-in")).toBeNull();
    });

    it("shows a landed flight with its landing time, dimmed and in the hall, and never large", async () => {
        const landed = flight("ay5", -12, { arrived: true, platform: "2A", notice: null });
        const state = hass({ "sensor.saapuvat": { departures: [landed, flight("ay6", 5, { platform: "2B" })], direction: "arrivals" } });
        const root = (await card(state, { entities: ["sensor.saapuvat"] })).shadowRoot!;
        expect(text(root.querySelector(".next .headsign"))).toBe("Oulu");
        expect(text(root.querySelector(".next .countdown"))).toBe("5 min");
        expect(text(root.querySelector(".next .platform"))).toBe("Aula 2B");
        const row = root.querySelector(".row.came-in");
        expect(text(row)).toBe("11.48 AY5 Oulu Laskeutunut Aula 2A");
        expect(row?.querySelector(".arrived")).not.toBeNull();
        expect(row?.querySelector(".alert")).toBeNull();
    });

    it("says an empty arrivals board has nothing coming in", async () => {
        const root = (await card(hass({ "sensor.saapuvat": { departures: [], direction: "arrivals" } }), { entities: ["sensor.saapuvat"] }))
            .shadowRoot!;
        expect(text(root.querySelector(".message"))).toBe("Ei saapuvia");
    });

    it("draws a cancelled flight's badge as an outline, not white on the theme's grey", async () => {
        const state = hass({
            "sensor.lahtevat": { departures: [flight("ay1", 5), flight("ay7", 9, { cancelled: true })], direction: "departures" },
        });
        const badge = (await card(state, {})).shadowRoot!.querySelector(".row.cancelled .badge");
        expect(badge?.classList.contains("cancelled")).toBe(true);
        expect(badge?.getAttribute("style")).toBeNull();
    });

    it("merges its sensors into one list by time, with the soonest of either direction large", async () => {
        const departures = {
            departures: [flight("ay1", 10, { platform: "12" }), flight("ay3", 40, { platform: "14" })],
            direction: "departures" as const,
        };
        const arrivals = {
            departures: [flight("ay2", 5, { platform: "2A" }), flight("ay4", 50, { platform: "2B" })],
            direction: "arrivals" as const,
        };
        const state = hass({ "sensor.lahtevat": departures, "sensor.saapuvat": arrivals });
        const root = (await card(state, { entities: ["sensor.lahtevat", "sensor.saapuvat"], combine: true, departures: 10 })).shadowRoot!;
        expect(root.querySelectorAll("section")).toHaveLength(1);
        expect(text(root.querySelector(".heading"))).toBe("Esimerkkilä");
        expect(text(root.querySelector(".next .badge")), "an arrival is the soonest").toBe("AY2");
        expect(text(root.querySelector(".next .platform"))).toBe("Aula 2A");
        expect([...root.querySelectorAll(".row .badge")].map(text)).toEqual(["AY1", "AY3", "AY4"]);
        expect([...root.querySelectorAll(".row .platform")].map(text)).toEqual(["Portti 12", "Portti 14", "Aula 2B"]);
    });

    // A single list's heading and empty text, from the directions its sensors state and whether they can be shown.
    it.each([
        ["two airports' arrivals", ["sensor.saapuvat", "sensor.toiset"], "Esimerkkilä, Toinen Saapuvat", "Ei saapuvia"],
        ["two airports' departures", ["sensor.lahtevat", "sensor.toinen"], "Esimerkkilä, Toinen Lähtevät", "Ei tulevia lähtöjä"],
        ["both directions", ["sensor.lahtevat", "sensor.saapuvat"], "Esimerkkilä", "Ei tulevia lähtöjä"],
        ["arrivals and a bus stop", ["sensor.saapuvat", "sensor.bussit"], "Esimerkkilä", "Ei tulevia lähtöjä"],
        ["two bus stops", ["sensor.bussit", "sensor.bussit2"], "Esimerkkilä", "Ei tulevia lähtöjä"],
        ["arrivals and one that is unavailable", ["sensor.saapuvat", "sensor.pois"], "Esimerkkilä Saapuvat", "Ei saapuvia"],
        ["stated departures and a bus stop", ["sensor.lahtevat", "sensor.bussit"], "Esimerkkilä", "Ei tulevia lähtöjä"],
        [
            "a section's own subtitle",
            [{ entity: "sensor.saapuvat", subtitle: "Oma" }, "sensor.toiset"],
            "Esimerkkilä, Toinen Saapuvat",
            "Ei saapuvia",
        ],
        ["every sensor broken", ["sensor.pois", "sensor.puuttuu"], "sensor.pois, sensor.puuttuu", "Entiteettiä sensor.puuttuu ei löydy"],
    ])("one list's heading and empty text: %s", async (_case, entities, heading, empty) => {
        const none: Departure[] = [];
        const state = hass({
            "sensor.lahtevat": { departures: none, direction: "departures" },
            "sensor.toinen": { departures: none, direction: "departures", stop_name: "Toinen" },
            "sensor.saapuvat": { departures: none, direction: "arrivals" },
            "sensor.toiset": { departures: none, direction: "arrivals", stop_name: "Toinen" },
            "sensor.bussit": { departures: none },
            "sensor.bussit2": { departures: none },
        });
        state.states["sensor.pois"] = { entity_id: "sensor.pois", state: "unavailable", last_changed: "", attributes: {} };
        const root = (await card(state, { entities, combine: true })).shadowRoot!;
        expect(text(root.querySelector(".heading"))).toBe(heading);
        expect([...root.querySelectorAll(".message")].map(text).at(-1)).toBe(empty);
    });

    it("names an unavailable sensor in one list, and says nothing is coming only when something can be shown", async () => {
        const state = hass({ "sensor.lahtevat": DEPARTURES });
        state.states["sensor.pois"] = { entity_id: "sensor.pois", state: "unavailable", last_changed: "", attributes: {} };
        const shown = (await card(state, { entities: ["sensor.pois", "sensor.lahtevat"], combine: true })).shadowRoot!;
        expect(text(shown.querySelector(".message"))).toBe("sensor.pois ei ole juuri nyt saatavilla");
        expect(shown.querySelector(".heading")?.getAttribute("title"), "the heading opens a sensor it shows").toBe("sensor.lahtevat");
        const none = (await card(state, { entities: ["sensor.pois", "sensor.puuttuu"], combine: true })).shadowRoot!;
        expect([...none.querySelectorAll(".message")].map(text)).toEqual([
            "sensor.pois ei ole juuri nyt saatavilla",
            "Entiteettiä sensor.puuttuu ei löydy",
        ]);
    });

    it("has nothing to combine in one sensor given twice, and shows it as it would without combine", async () => {
        const state = hass({ "sensor.saapuvat": ARRIVALS, "sensor.lahtevat": DEPARTURES });
        const twice = (await card(state, { entities: ["sensor.saapuvat", "sensor.saapuvat"], combine: true })).shadowRoot!;
        const plain = (await card(state, { entities: ["sensor.saapuvat", "sensor.saapuvat"] })).shadowRoot!;
        expect([...twice.querySelectorAll(".heading")].map(text)).toEqual(["Esimerkkilä Saapuvat", "Esimerkkilä Saapuvat"]);
        expect(twice.querySelector("section")?.innerHTML).toBe(plain.querySelector("section")?.innerHTML);

        const merged = (await card(state, { entities: ["sensor.saapuvat", "sensor.lahtevat", "sensor.saapuvat"], combine: true }))
            .shadowRoot!;
        expect(merged.querySelectorAll("section")).toHaveLength(1);
        expect(merged.querySelectorAll(".row"), "each sensor's flights once").toHaveLength(3);
    });

    it("shows each stop's notice in one list once", async () => {
        const state = hass({ "sensor.lahtevat": DEPARTURES, "sensor.saapuvat": ARRIVALS });
        for (const id of ["sensor.lahtevat", "sensor.saapuvat"]) {
            state.states[id]!.attributes.notices = ["Kiitorata suljettu."];
        }
        const root = (await card(state, { entities: ["sensor.lahtevat", "sensor.saapuvat"], combine: true })).shadowRoot!;
        expect([...root.querySelectorAll(".stop-notice")].map(text)).toEqual(["Kiitorata suljettu."]);
    });

    it("names different stops in one list once each, and tells what is wrong with a sensor it can't show", async () => {
        const state = hass({ "sensor.lahtevat": DEPARTURES, "sensor.toinen": { ...DEPARTURES, stop_name: "Toinen" } });
        const root = (
            await card(state, { entities: ["sensor.lahtevat", "sensor.toinen", "sensor.lahtevat", "sensor.puuttuu"], combine: true })
        ).shadowRoot!;
        expect(text(root.querySelector(".heading"))).toBe("Esimerkkilä, Toinen Lähtevät");
        expect(text(root.querySelector(".message"))).toBe("Entiteettiä sensor.puuttuu ei löydy");
        expect(root.querySelector(".next")).not.toBeNull();
    });

    // The keys that keep them apart are tested in departures.test.ts: lit draws duplicate keys alike on a first render.
    it("keeps the same flight from two sensors as two rows", async () => {
        const same = { departures: [flight("ay9", 5), flight("ay9b", 30)], direction: "arrivals" as const };
        const state = hass({ "sensor.saapuvat": same, "sensor.toinen": { ...same, stop_name: "Toinen" } });
        const root = (await card(state, { entities: ["sensor.saapuvat", "sensor.toinen"], combine: true, departures: 10 })).shadowRoot!;
        expect([...root.querySelectorAll(".row .badge")].map(text)).toEqual(["AY9", "AY9B", "AY9B"]);
    });

    it("is one section in size when its sensors are one list", () => {
        const element = document.createElement("departures-card");
        element.setConfig({ type: "custom:departures-card", entities: ["sensor.a", "sensor.b"], departures: 4 });
        expect(element.getCardSize()).toBe(13);
        element.setConfig({ type: "custom:departures-card", entities: ["sensor.a", "sensor.b"], departures: 4, combine: true });
        expect(element.getCardSize()).toBe(7);
        element.setConfig({ type: "custom:departures-card", entities: ["sensor.a", "sensor.a"], departures: 4, combine: true });
        expect(element.getCardSize(), "one sensor twice is two sections, as drawn").toBe(13);
    });

    it.each([
        [1, 4],
        [10, 13],
        [undefined, 7],
        [null, 7],
    ])("takes %j departures, a size of %s", (departures, size) => {
        const element = document.createElement("departures-card");
        element.setConfig({ type: "custom:departures-card", entities: ["sensor.a"], departures } as never);
        expect(element.getCardSize()).toBe(size);
    });

    it.each([0, -1, 2.5, "3", "", true, Infinity, NaN])("refuses %j departures", (departures) => {
        const element = document.createElement("departures-card");
        expect(() => element.setConfig({ type: "custom:departures-card", entities: ["sensor.a"], departures } as never)).toThrow(
            "The number of departures must be a whole number",
        );
    });

    it("is as tall for arrivals as for departures, as the ones that are over are counted", () => {
        const element = document.createElement("departures-card");
        element.hass = hass({ "sensor.lahtevat": DEPARTURES, "sensor.saapuvat": ARRIVALS });
        element.setConfig({ type: "custom:departures-card", entities: ["sensor.lahtevat", "sensor.saapuvat"], departures: 4 });
        expect(element.getCardSize()).toBe(13);
        element.setConfig({
            type: "custom:departures-card",
            entities: ["sensor.lahtevat", "sensor.saapuvat"],
            departures: 4,
            combine: true,
        });
        expect(element.getCardSize()).toBe(7);
        element.setConfig({ type: "custom:departures-card", entities: ["sensor.lahtevat"], departures: 4 });
        expect(element.getCardSize()).toBe(7);
    });
});

// How long a departure stays past its time, and which one is large: a departure a minute, an arrival half an hour, which
// once it has come in is from its landing. A cancelled one or one that has come in is never the large one.
describe("visibleDepartures with arrivals", () => {
    const shown = (direction: Direction, minutes: number, extra: Partial<Departure> = {}): ShownDeparture => ({
        ...flight(`${direction}${minutes}`, minutes, extra),
        direction,
        key: `${direction}${minutes}`,
    });

    it.each([
        ["departures", -0.5, true],
        ["departures", -1, true],
        ["departures", -2, false],
        ["arrivals", -2, true],
        ["arrivals", -29, true],
        ["arrivals", -30, true],
        ["arrivals", -31, false],
    ] as const)("a %s %s minutes past is listed: %s", (direction, minutes, listed) => {
        const { next, rest } = visibleDepartures([shown(direction, minutes, { arrived: direction === "arrivals" })], NOW, 4, true);
        expect([next, ...rest].filter(Boolean).length).toBe(listed ? 1 : 0);
    });

    // The count is of every one shown, the large one included. The latest two that are over come next, as far as the count
    // has room, and the ones still to come take the rest.
    it.each([
        [1, [-20], [10, 20], "arrivals10", []],
        [2, [-25, -20, -15], [10, 20, 30], "arrivals10", ["arrivals-15"]],
        [3, [], [10, 20, 30, 40], "arrivals10", ["arrivals20", "arrivals30"]],
        [3, [-20, -10], [10, 20, 30], "arrivals10", ["arrivals-20", "arrivals-10"]],
        [2, [-10], [], undefined, ["arrivals-10"]],
    ] as const)(
        "with a count of %s, came in %j and coming %j, the large one is %s and the rows %j",
        (count, cameIn, coming, large, rows) => {
            const list = [
                ...cameIn.map((minutes) => shown("arrivals", minutes, { arrived: true })),
                ...coming.map((minutes) => shown("arrivals", minutes)),
            ];
            const { next, rest } = visibleDepartures(list, NOW, count, true);
            expect(next?.key).toBe(large);
            expect(rest.map((item) => item.key)).toEqual(rows);
        },
    );

    // Over is an arrival that has come in, or one cancelled and past its time: the latest two are listed within the
    // count, as far as it has room. A cancelled one still to come is counted too, and is never the large one.
    it.each([
        ["cancelled ones past their time", 3, true, [[-20, "cancelled"], [-10, "cancelled"], [10], [20], [30]], "10", ["-20", "-10"]],
        ["a cancelled one still to come", 2, true, [[5, "cancelled"], [10], [20]], "10", ["5"]],
        ["one still to come earlier than one in", 3, true, [[-20], [-15], [-10, "arrived"]], "-20", ["-15", "-10"]],
        ["fewer still to come than the count", 4, true, [[-10, "arrived"], [10]], "10", ["-10"]],
        ["cancelled ones hidden", 2, false, [[-10, "cancelled"], [10], [20]], "10", ["20"]],
        ["a cancelled one that came in", 2, true, [[-5, "arrived", "cancelled"], [10], [20]], "10", ["-5"]],
        ["a cancelled one due now, still to come", 2, true, [[0, "cancelled"], [10], [20]], "10", ["0"]],
        [
            "every one still to come cancelled, one over",
            1,
            true,
            [
                [-10, "arrived"],
                [5, "cancelled"],
                [10, "cancelled"],
            ],
            undefined,
            ["-10"],
        ],
        ["a cancelled one at exactly half an hour past, over", 2, true, [[-30, "cancelled"], [10]], "10", ["-30"]],
        ["a cancelled one marked come in, before its time", 2, true, [[5, "arrived", "cancelled"], [10], [20]], "10", ["5"]],
    ] as const)("%s", (_case, count, showCancelled, items, large, rows) => {
        const list = items.map(([minutes, ...flags]) =>
            shown("arrivals", minutes, { arrived: flags.includes("arrived" as never), cancelled: flags.includes("cancelled" as never) }),
        );
        const { next, rest } = visibleDepartures(list, NOW, count, showCancelled);
        expect(next?.key).toBe(large === undefined ? undefined : `arrivals${large}`);
        expect(rest.map((item) => item.key)).toEqual(rows.map((minutes) => `arrivals${minutes}`));
    });

    // The count is of every one still to come, cancelled ones and the large one included, so the list is as long whatever
    // is cancelled. The large one is the next that runs even past the count, so a run of cancellations never pushes it off.
    it.each([
        ["departures", 1, [[5, "cancelled"], [10], [20]], "10", []],
        ["departures", 2, [[5], [10, "cancelled"], [20], [30, "cancelled"]], "5", ["10"]],
        [
            "departures",
            2,
            [
                [5, "cancelled"],
                [10, "cancelled"],
            ],
            undefined,
            ["5", "10"],
        ],
        ["departures", 1, [[5], [10, "cancelled"]], "5", []],
        ["arrivals", 1, [[5, "cancelled"], [10], [20]], "10", []],
        ["departures", 2, [[5], [10, "cancelled"], [20, "cancelled"]], "5", ["10"]],
        ["departures", 2, [[5, "cancelled"], [10, "cancelled"], [20]], "20", ["5"]],
        ["departures", 2, [[5, "cancelled"], [10, "cancelled"], [20], [30, "cancelled"]], "20", ["5"]],
        ["departures", 3, [[5], [10, "cancelled"]], "5", ["10"]],
        ["departures", 3, [[5], [10]], "5", ["10"]],
        [
            "departures",
            2,
            [
                [5, "cancelled"],
                [10, "cancelled"],
                [20, "cancelled"],
                [30, "cancelled"],
            ],
            undefined,
            ["5", "10"],
        ],
        ["departures", 3, [[1, "cancelled"], [2], [3, "cancelled"], [4, "cancelled"], [5, "cancelled"]], "2", ["1", "3"]],
        [
            "arrivals",
            1,
            [
                [5, "cancelled"],
                [10, "cancelled"],
                [20, "cancelled"],
            ],
            undefined,
            ["5"],
        ],
        ["arrivals", 2, [[-10, "cancelled"], [5, "cancelled"], [10], [20]], "10", ["-10"]],
    ] as const)("%s with a count of %s: %j", (direction, count, items, large, rows) => {
        const list = items.map(([minutes, ...flags]) => shown(direction, minutes, { cancelled: flags.includes("cancelled" as never) }));
        const { next, rest } = visibleDepartures(list, NOW, count, true);
        expect(next?.key).toBe(large === undefined ? undefined : `${direction}${large}`);
        expect(rest.map((item) => item.key)).toEqual(rows.map((minutes) => `${direction}${minutes}`));
    });

    it("never makes a departure over, cancelled and past or not", () => {
        // Three cancelled within the minute: over would keep only the latest two of them.
        const list = [-0.9, -0.6, -0.3].map((minutes) => shown("departures", minutes, { cancelled: true }));
        const { next, rest } = visibleDepartures([...list, shown("departures", 5)], NOW, 4, true);
        expect([next?.key, ...rest.map((item) => item.key)]).toEqual(["departures5", "departures-0.9", "departures-0.6", "departures-0.3"]);
    });

    it("never makes one that has come in the large one", () => {
        const { next, rest } = visibleDepartures([shown("arrivals", -5, { arrived: true }), shown("arrivals", 10)], NOW, 4, true);
        expect(next?.key).toBe("arrivals10");
        expect(rest.map((item) => item.key)).toEqual(["arrivals-5"]);
    });
});
