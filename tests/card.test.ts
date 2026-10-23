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

    describe("lines up a stop's destinations", () => {
        // happy-dom lays nothing out, so each badge is given the width its line would have, held at least as wide as the
        // minimum the card sets, as min-width does in a browser. As in a browser, nothing has a size until ha-card has
        // drawn the slot the content sits in, which happens after the card's own update. The layout width is fractional
        // (the computed width), offsetWidth rounds it, and the drawn width (getBoundingClientRect) is scaled, as in a
        // dialog opening. A badge that isn't drawn has the computed width auto.
        const WIDTHS: Record<string, number> = { AY9411: 83, AY907: 50.22, SK9709: 58.08, "16": 30, "55": 30, "550": 38 };
        let widths: Record<string, number>;
        let drawn: boolean;
        let scale: number;
        let measured: number;

        // happy-dom's ResizeObserver never fires, so this one is fired by hand, as a resize would.
        const observers: FakeResizeObserver[] = [];
        class FakeResizeObserver {
            public targets = new Set<Element>();
            public constructor(private readonly callback: () => void) {
                observers.push(this);
            }
            public observe(target: Element): void {
                this.targets.add(target);
            }
            public disconnect(): void {
                this.targets.clear();
            }
            public fire(): void {
                if (this.targets.size) {
                    this.callback();
                }
            }
        }
        const resize = () => observers.forEach((observer) => observer.fire());
        const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

        beforeEach(() => {
            widths = { ...WIDTHS };
            drawn = false;
            scale = 1;
            measured = 0;
            observers.length = 0;
            vi.stubGlobal("ResizeObserver", FakeResizeObserver);
            const layoutWidth = (badge: HTMLElement) => {
                if (!badge.classList.contains("badge")) {
                    return 0;
                }
                measured++;
                const minimum = parseFloat(badge.closest<HTMLElement>(".rows")?.style.getPropertyValue("--badge-width") ?? "") || 0;
                return drawn ? Math.max(widths[badge.textContent!.trim()] ?? 0, minimum) : 0;
            };
            vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
                return Math.round(layoutWidth(this));
            });
            const computedStyle = window.getComputedStyle.bind(window);
            vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
                if (!(element instanceof HTMLElement) || !element.classList.contains("badge")) {
                    return computedStyle(element, pseudo);
                }
                const width = layoutWidth(element);
                return { width: width ? `${width}px` : "auto" } as CSSStyleDeclaration;
            });
            vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
                return { width: layoutWidth(this) * scale } as DOMRect;
            });
        });
        afterEach(() => {
            vi.restoreAllMocks();
            vi.unstubAllGlobals();
        });

        const haCardDraws = async () => {
            drawn = true;
            await nextFrame();
        };
        const badgeWidths = (root: ShadowRoot) =>
            [...root.querySelectorAll<HTMLElement>(".rows")].map((rows) => rows.style.getPropertyValue("--badge-width"));
        const flights = () => hass({ "sensor.kauppatori": [departure("a", 5, { line: "AY9411" }), departure("b", 6, { line: "SK9709" })] });

        it.each([
            [
                "the widest row badge, rounded up so they are all exactly as wide",
                { "sensor.kauppatori": ["AY9411", "AY907", "SK9709"] },
                1,
                ["59px"],
            ],
            ["each stop by its own rows", { "sensor.kauppatori": ["55", "16", "55"], "sensor.b": ["55", "550"] }, 1, ["30px", "38px"]],
            ["only the stops that have rows", { "sensor.kauppatori": [], "sensor.b": ["55", "550"] }, 1, ["38px"]],
            [
                "not a stop's next departure, even when it is the only one",
                { "sensor.kauppatori": ["AY9411"], "sensor.b": ["55", "550"] },
                1,
                ["38px"],
            ],
            [
                "its layout width when it is drawn scaled, as in a dialog opening",
                { "sensor.kauppatori": ["AY9411", "SK9709"] },
                0.8,
                ["59px"],
            ],
            ["nothing when the card measures nothing", { "sensor.kauppatori": ["X1", "X2"] }, 1, [""]],
        ])("%s", async (_, stops, drawnScale, expected) => {
            scale = drawnScale;
            const state = hass(
                Object.fromEntries(
                    Object.entries(stops).map(([id, lines]) => [
                        id,
                        lines.map((line, index) => departure(`${id}${index}`, 5 + index, { line })),
                    ]),
                ),
            );
            const root = (await card(state, { entities: Object.keys(stops) })).shadowRoot!;
            await haCardDraws();
            expect(badgeWidths(root)).toEqual(expected);
        });

        it("measures again from scratch on a render, so a stop's badges can also get narrower", async () => {
            const element = await card(flights(), {});
            await haCardDraws();
            widths.SK9709 = 40;
            element.requestUpdate();
            await element.updateComplete;
            await nextFrame();
            expect(badgeWidths(element.shadowRoot!)).toEqual(["40px"]);
        });

        it("measures again when the card is resized, without waiting for a render", async () => {
            const element = await card(flights(), {});
            await haCardDraws();
            // A line that wraps at its spaces gets narrower when the card does.
            widths.SK9709 = 40;
            resize();
            await nextFrame();
            expect(badgeWidths(element.shadowRoot!)).toEqual(["40px"]);
        });

        it("measures again as soon as a hidden card is shown", async () => {
            const element = await card(flights(), {});
            await haCardDraws();
            drawn = false;
            resize();
            await nextFrame();
            expect(badgeWidths(element.shadowRoot!)).toEqual([""]);
            drawn = true;
            resize();
            await nextFrame();
            expect(badgeWidths(element.shadowRoot!)).toEqual(["59px"]);
        });

        it("measures once a frame however many times it is asked", async () => {
            const element = await card(flights(), {});
            await haCardDraws();
            measured = 0;
            element.requestUpdate();
            await element.updateComplete;
            element.requestUpdate();
            await element.updateComplete;
            resize();
            await nextFrame();
            expect(measured).toBe(1);
        });

        it("stops watching its size when it leaves the page", async () => {
            const element = await card(flights(), {});
            await haCardDraws();
            expect(observers.some((observer) => observer.targets.size > 0)).toBe(true);
            element.remove();
            expect(observers.every((observer) => observer.targets.size === 0)).toBe(true);
        });

        it("drops a measurement still pending when it leaves the page", async () => {
            const element = await card(flights(), {});
            await haCardDraws();
            element.requestUpdate();
            await element.updateComplete;
            element.remove();
            widths.SK9709 = 40;
            await nextFrame();
            expect(badgeWidths(element.shadowRoot!)).toEqual(["59px"]);
        });

        it("watches its new size again when it comes back, with one watcher however often it leaves", async () => {
            const element = await card(flights(), {});
            await haCardDraws();
            for (let round = 0; round < 2; round++) {
                element.remove();
                document.body.append(element);
                await element.updateComplete;
                await nextFrame();
            }
            // One observer for the card's whole life, not one per visit.
            expect(observers).toHaveLength(1);
            const watching = observers.filter((observer) => observer.targets.size > 0);
            expect(watching).toHaveLength(1);
            expect([...watching[0].targets]).toContain(element.shadowRoot!.querySelector("ha-card"));
        });

        it("doesn't start watching again from an update that was queued as it left", async () => {
            const element = await card(flights(), {});
            await haCardDraws();
            // Home Assistant can hand the card its state and take it off the page in the same call.
            element.requestUpdate();
            element.remove();
            await element.updateComplete;
            await nextFrame();
            expect(observers.every((observer) => observer.targets.size === 0)).toBe(true);
        });
    });

    it.each([
        ["train", "fi", "Raide 3"],
        ["plane", "fi", "Portti 3"],
        ["bus", "fi", "Laituri 3"],
        ["funicular", "fi", "Laituri 3"],
        ["train", "en", "Track 3"],
        ["plane", "en", "Gate 3"],
        ["bus", "en", "Platform 3"],
    ])("names a %s's platform in %s, on the next departure and the rows alike", async (mode, language, label) => {
        const state = hass({
            "sensor.kauppatori": [departure("a", 11, { mode, platform: "3" }), departure("b", 26, { mode, platform: "3" })],
        });
        state.locale = { ...state.locale!, language };
        const root = (await card(state, {})).shadowRoot!;
        expect(text(root.querySelector(".next .platform"))).toBe(label);
        expect(text(root.querySelector(".row .platform"))).toBe(label);
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
        expect(text(sections[2].querySelector(".message"))).toBe("Entiteettiä sensor.missing ei löydy");
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
        // Not a list nor a sensor: the card's own message, not a TypeError.
        const broken = { type: "custom:departures-card", entities: { entity: "sensor.kauppatori" } } as unknown as DeparturesCardConfig;
        expect(() => element.setConfig(broken)).toThrow(/departures sensor|pysäkkianturi/);
    });

    it("takes one sensor written without a list", async () => {
        const root = (await card(hass({ "sensor.kauppatori": [departure("a", 5)] }), { entities: "sensor.kauppatori" as never }))
            .shadowRoot!;
        expect(text(root.querySelector(".name"))).toBe("Kauppatori");
    });

    it("cuts the subtitle short unless texts are shown in full, and is never narrower than half a section", async () => {
        const state = hass({ "sensor.kauppatori": [departure("a", 5)] });
        const cut = await card(state, { entities: [{ entity: "sensor.kauppatori", subtitle: "keskustaan" }] });
        expect(cut.shadowRoot!.querySelector("ha-card")?.classList.contains("full")).toBe(false);
        const full = await card(state, { entities: [{ entity: "sensor.kauppatori", subtitle: "keskustaan" }], full_texts: true });
        expect(full.shadowRoot!.querySelector("ha-card")?.classList.contains("full")).toBe(true);
        expect(full.getGridOptions()).toEqual({ columns: 12, min_columns: 6, rows: "auto" });
    });

    it("brings its countdowns up to date when it comes back onto the page", async () => {
        const element = await card(hass({ "sensor.kauppatori": [departure("a", 10)] }), {});
        expect(text(element.shadowRoot!.querySelector(".countdown"))).toBe("10 min");
        element.remove();
        vi.setSystemTime(NOW + 6 * 60_000);
        document.body.append(element);
        await element.updateComplete;
        expect(text(element.shadowRoot!.querySelector(".countdown"))).toBe("4 min");
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
