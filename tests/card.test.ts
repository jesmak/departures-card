import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../src/departures-card";
import type { DeparturesCard } from "../src/departures-card";
import { compactSections } from "../src/editor";
import type { HomeAssistant } from "../src/hass";
import type { Departure, DeparturesCardConfig } from "../src/types";

const NOW = Date.parse("2026-10-04T13:52:00Z");

// Made-up departures from two stops, shaped like the ones digitransit_live and digitraffic_live write.
function departure(id: string, minutes: number, extra: Partial<Departure> = {}): Departure {
    const time = new Date(NOW + minutes * 60_000).toISOString();
    return { id, line: "55", mode: "bus", headsign: "Koskela", scheduled: time, estimated: time, ...extra };
}

function hass(departures: Record<string, Departure[] | "unavailable">): HomeAssistant {
    return {
        locale: { language: "fi", time_zone: "server" },
        config: { time_zone: "Europe/Helsinki" },
        states: Object.fromEntries(
            Object.entries(departures).map(([id, list]) => [
                id,
                {
                    entity_id: id,
                    state: list === "unavailable" ? "unavailable" : "2026-10-04T13:52:00+00:00",
                    last_changed: "2026-10-04",
                    attributes:
                        list === "unavailable"
                            ? {}
                            : {
                                  departures_version: 1,
                                  stop_name: "Kauppatori",
                                  attribution: "Digitransit, CC BY 4.0",
                                  notices: id === "sensor.works" ? ["Ratatyöt. Junat korvataan busseilla.", 5] : undefined,
                                  departures: list,
                              },
                },
            ]),
        ),
    };
}

async function card(state: HomeAssistant, config: Partial<DeparturesCardConfig>): Promise<DeparturesCard> {
    const element = document.createElement("departures-card");
    element.setConfig({ type: "custom:departures-card", entities: ["sensor.kauppatori"], ...config } as DeparturesCardConfig);
    element.hass = state;
    document.body.append(element);
    await element.updateComplete;
    return element;
}

function text(element: Element | null | undefined): string {
    return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("departures-card", () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    it("shows the next departure large with its countdown, and the rest as rows", async () => {
        const element = await card(
            hass({
                "sensor.kauppatori": [
                    departure("a", 11, { realtime: true, delay: 120, platform: "3", scheduled: new Date(NOW + 9 * 60_000).toISOString() }),
                    departure("b", 26, { line: "16", headsign: "Kalasatama (M)" }),
                ],
            }),
            {},
        );
        const root = element.shadowRoot!;
        expect(text(root.querySelector(".heading"))).toBe("Kauppatori");
        expect(text(root.querySelector(".next .countdown"))).toBe("11 min");
        expect(text(root.querySelector(".next .meta"))).toBe("17.01 17.03 +2 min Laituri 3");
        expect(text(root.querySelector(".row"))).toBe("17.18 16 Kalasatama (M)");
        expect(text(root.querySelector(".attribution"))).toBe("Digitransit, CC BY 4.0");
    });

    it("says now under a minute, and the clock an hour or more away", async () => {
        const element = await card(hass({ "sensor.kauppatori": [departure("a", 0.5)] }), {});
        expect(text(element.shadowRoot!.querySelector(".countdown"))).toBe("Nyt");

        const later = await card(hass({ "sensor.kauppatori": [departure("a", 75)] }), {});
        expect(text(later.shadowRoot!.querySelector(".countdown"))).toBe("18.07");

        const tuesday = await card(hass({ "sensor.kauppatori": [departure("a", 37.5 * 60), departure("b", 37.5 * 60 + 30)] }), {});
        expect(text(tuesday.shadowRoot!.querySelector(".countdown"))).toBe("ti 06.22");
        expect(text(tuesday.shadowRoot!.querySelector(".row .time"))).toBe("ti 06.52");
    });

    it("strikes a cancelled departure through with its reason, or hides it", async () => {
        const list = [departure("a", 5), departure("x", 9, { mode: "train", line: "S 172", cancelled: true, notice: "Kalusto" })];
        const shown = await card(hass({ "sensor.kauppatori": list }), {});
        expect(text(shown.shadowRoot!.querySelector(".row.cancelled"))).toBe("17.01 S 172 Koskela Peruttu, Kalusto");

        const hidden = await card(hass({ "sensor.kauppatori": list }), { show_cancelled: false });
        expect(hidden.shadowRoot!.querySelector(".row.cancelled")).toBeNull();
    });

    it("gives each stop a section with its own heading, and says what is wrong with one that has no departures", async () => {
        const element = await card(hass({ "sensor.east": [departure("a", 3)], "sensor.west": "unavailable" }), {
            entities: [{ entity: "sensor.east", name: "Myllymäki", subtitle: "keskustaan päin" }, "sensor.west", "sensor.missing"],
        });
        const sections = [...element.shadowRoot!.querySelectorAll("section")];
        expect(sections.map((section) => text(section.querySelector(".heading")))).toEqual([
            "Myllymäki keskustaan päin",
            "sensor.west",
            "sensor.missing",
        ]);
        expect(text(sections[1].querySelector(".message"))).toBe("Lähtötiedot eivät ole juuri nyt saatavilla");
        expect(text(sections[2].querySelector(".message"))).toBe("Entiteettiä ei ole: sensor.missing");
    });

    it("shows the stop's notices in full under its name, unless they are hidden", async () => {
        const state = hass({ "sensor.works": [departure("a", 5)] });
        const shown = await card(state, { entities: ["sensor.works"] });
        expect([...shown.shadowRoot!.querySelectorAll(".stop-notice")].map(text)).toEqual(["Ratatyöt. Junat korvataan busseilla."]);

        const hidden = await card(state, { entities: ["sensor.works"], show_notices: false });
        expect(hidden.shadowRoot!.querySelector(".stop-notice")).toBeNull();
    });

    it("refuses a configuration with no stops", () => {
        const element = document.createElement("departures-card");
        expect(() => element.setConfig({ type: "custom:departures-card", entities: [] })).toThrow();
    });
});

describe("the editor", () => {
    it("writes a stop with nothing but its sensor as the entity id", () => {
        expect(compactSections([{ entity: "sensor.a" }, { entity: "sensor.b", name: "B", subtitle: "" }, { entity: "" }])).toEqual([
            "sensor.a",
            { entity: "sensor.b", name: "B" },
        ]);
    });
});
