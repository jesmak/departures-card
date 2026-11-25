import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../src/departures-card";
import type { DeparturesCard } from "../src/departures-card";
import { compactSections, configFromForm, formData } from "../src/editor";
import type { HomeAssistant } from "../src/hass";
import { browserLanguage, translate } from "../src/localize/localize";
import { popovers } from "./popover";
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

async function card(state: HomeAssistant, config: Partial<DeparturesCardConfig>, layout?: string): Promise<DeparturesCard> {
    const element = document.createElement("departures-card");
    element.layout = layout;
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
        expect(text(root.querySelector(".next .meta"))).toBe("+2 min·3");
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
            public constructor(private readonly callback: (entries: Array<{ target: Element }>) => void) {
                observers.push(this);
            }
            public observe(target: Element): void {
                this.targets.add(target);
            }
            public unobserve(target: Element): void {
                this.targets.delete(target);
            }
            public disconnect(): void {
                this.targets.clear();
            }
            public fire(): void {
                if (this.targets.size) {
                    this.callback([...this.targets].map((target) => ({ target })));
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
            // One observer for the card's size and one for its fades, each for the card's whole life, not one per visit.
            expect(observers).toHaveLength(2);
            const haCard = element.shadowRoot!.querySelector("ha-card")!;
            expect(observers.filter((observer) => observer.targets.has(haCard))).toHaveLength(1);
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
        ["train", "fi", "Raide"],
        ["plane", "fi", "Portti"],
        ["bus", "fi", "Laituri"],
        ["funicular", "fi", "Laituri"],
        ["train", "en", "Track"],
        ["plane", "en", "Gate"],
        ["bus", "en", "Platform"],
        ["ship", "en", "Berth"],
        ["ferry", "en", "Berth"],
        ["ship", "fi", "Laituri"],
    ])("shows a %s's platform as its number, named in %s at the end of the rows' divider", async (mode, language, label) => {
        const state = hass({
            "sensor.kauppatori": [departure("a", 11, { mode, platform: "3" }), departure("b", 26, { mode, platform: "3" })],
        });
        state.locale = { ...state.locale!, language };
        const root = (await card(state, {})).shadowRoot!;
        expect(text(root.querySelector(".next .platform"))).toBe("3");
        expect(text(root.querySelector(".row .platform"))).toBe("3");
        expect(text(root.querySelector(".rule"))).toBe(label);
    });

    it("names the rows' last column only when they have one, and all call it the same", async () => {
        const rule = async (rows: Departure[]) =>
            text((await card(hass({ "sensor.kauppatori": [departure("a", 5), ...rows] }), {})).shadowRoot!.querySelector(".rule"));
        expect(await rule([departure("b", 9)])).toBe("");
        expect(await rule([departure("b", 9, { mode: "train", platform: "1" }), departure("c", 12, { platform: "7" })])).toBe("");
        // A landing plane's hall isn't on its row, and neither is a cancelled departure's platform.
        const hall = hass({ "sensor.kauppatori": [departure("a", 5), departure("b", 9, { mode: "plane", platform: "2B" })] });
        hall.states["sensor.kauppatori"]!.attributes.direction = "arrivals";
        const landing = (await card(hall, {})).shadowRoot!;
        expect(text(landing.querySelector(".rule"))).toBe("");
        expect(landing.querySelector(".row .platform")).toBeNull();
        expect(await rule([departure("b", 9, { platform: "7", cancelled: true })])).toBe("");
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

    it("shows the mode's icon for a line with no name, cancelled or not", async () => {
        const element = await card(
            hass({
                "sensor.kauppatori": [
                    departure("a", 5, { line: "" }),
                    departure("b", 9, { line: " ", mode: "ferry" }),
                    departure("c", 12, { line: "", mode: "hovercraft", cancelled: true }),
                    departure("d", 14, { line: "", mode: "ship" }),
                ],
            }),
            {},
        );
        const icons = [...element.shadowRoot!.querySelectorAll(".badge .line ha-icon")].map((icon) => icon.getAttribute("icon"));
        expect(icons).toEqual(["mdi:bus", "mdi:ferry", "mdi:transit-connection-variant", "mdi:ship-wheel"]);
    });

    it("strikes a cancelled departure through, with its reason in its popup, or hides it", async () => {
        const list = [departure("a", 5), departure("x", 9, { mode: "train", line: "S 172", cancelled: true, notice: "Kalusto" })];
        const shown = await card(hass({ "sensor.kauppatori": list }), {});
        const row = shown.shadowRoot!.querySelector<HTMLElement>(".row.cancelled")!;
        expect(text(row)).toBe("Peruttu 17.01 S 172 Koskela");
        expect(row.querySelector(".time")!.classList.contains("struck")).toBe(true);
        row.click();
        await shown.updateComplete;
        expect(text(shown.shadowRoot!.querySelector(".details"))).toBe("S 172 Koskela Tila Peruttu, Kalusto Aikataulu 17.01");

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

    it("shows its picker stub with no departures sensor as a hint", async () => {
        const stub = (customElements.get("departures-card") as unknown as typeof DeparturesCard).getStubConfig(hass({}));
        expect(stub).toEqual({ entities: [] });
        const element = await card(hass({}), stub as Partial<DeparturesCardConfig>);
        expect(text(element.shadowRoot!.querySelector(".message"))).toBe(translate("fi", "common.no_entities"));
    });

    it("refuses a configuration with no usable stops", () => {
        const element = document.createElement("departures-card");
        expect(() => element.setConfig({ type: "custom:departures-card", entities: [""] })).toThrow();
        // Not a list nor a sensor: the card's own message, not a TypeError.
        const broken = { type: "custom:departures-card", entities: { entity: "sensor.kauppatori" } } as unknown as DeparturesCardConfig;
        expect(() => element.setConfig(broken)).toThrow(/departures sensor|pysäkkianturi/);
    });

    it("takes one sensor written without a list", async () => {
        const root = (await card(hass({ "sensor.kauppatori": [departure("a", 5)] }), { entities: "sensor.kauppatori" as never }))
            .shadowRoot!;
        expect(text(root.querySelector(".name"))).toBe("Kauppatori");
    });

    it("marks the card for texts in full only when full_texts is set", async () => {
        const state = hass({ "sensor.kauppatori": [departure("a", 5)] });
        const cut = await card(state, { entities: [{ entity: "sensor.kauppatori", subtitle: "keskustaan" }] });
        expect(cut.shadowRoot!.querySelector("ha-card")?.classList.contains("full")).toBe(false);
        const full = await card(state, { entities: [{ entity: "sensor.kauppatori", subtitle: "keskustaan" }], full_texts: true });
        expect(full.shadowRoot!.querySelector("ha-card")?.classList.contains("full")).toBe(true);
    });

    it("takes a whole section by default and is never narrower", async () => {
        const state = hass({ "sensor.kauppatori": [departure("a", 5)] });
        const element = await card(state, { entities: ["sensor.kauppatori"] });
        expect(element.getGridOptions()).toEqual({ columns: 12, min_columns: 12, rows: "auto", min_rows: 3 });
    });

    // Two stops one above the other need 344 px, 6 rows, and side by side 184 px, 3 rows. 23 columns can be 595.6 px of
    // card and 24 columns 622, around the 620 where two stops go side by side.
    it.each<[string, Partial<DeparturesCardConfig>, number]>([
        ["a whole section", {}, 6],
        ["23 columns", { grid_options: { columns: 23 } }, 6],
        ["24 columns", { grid_options: { columns: 24 } }, 3],
        ["24 columns in the older form", { layout_options: { grid_columns: 8 } }, 3],
        ["the full width, whose columns aren't known", { grid_options: { columns: "full" } }, 6],
        ["24 columns with one list for all", { grid_options: { columns: 24 }, combine: true }, 3],
    ])("counts two stops side by side only when its columns keep them so at their narrowest: %s", async (_, config, rows) => {
        const state = hass({ "sensor.east": [departure("a", 5)], "sensor.west": [departure("b", 5)] });
        const element = await card(state, { entities: ["sensor.east", "sensor.west"], ...config });
        expect(element.getGridOptions().min_rows).toBe(rows);
    });

    it("puts a third stop under a pair side by side", async () => {
        const state = hass({ "sensor.a": [departure("a", 5)], "sensor.b": [departure("b", 5)], "sensor.c": [departure("c", 5)] });
        const element = await card(state, { entities: ["sensor.a", "sensor.b", "sensor.c"], grid_options: { columns: 24 } });
        // 34 + 27 + 2 × 123 = 307 px.
        expect(element.getGridOptions().min_rows).toBe(5);
    });

    // Every text the card can cut short carries its own text as a tooltip, in every state, so it shows in full when the
    // mouse is over it whenever it is cut: the title, the attribution, the stop's name, subtitle and notices, the next
    // departure's destination and the later departures' destinations. A departure's notice is in its popup, and the
    // sign that tells of it carries it as a tooltip too. The heading itself names the sensor it opens.
    const kauppatori = { entity: "sensor.kauppatori", name: "Kauppatori", subtitle: "keskustaan" };
    const asema = { entity: "sensor.works", name: "Asema" };
    it.each<
        [string, Partial<DeparturesCardConfig>, string | undefined, "stated" | "unavailable" | undefined, boolean, string, string | null]
    >([
        ["by its content", { entities: [kauppatori] }, undefined, undefined, false, "Kauppatori", "keskustaan"],
        ["held to a height", { entities: [kauppatori], height: 300 }, undefined, undefined, true, "Kauppatori", "keskustaan"],
        ["held up to a limit", { entities: [kauppatori], max_height: 300 }, undefined, undefined, true, "Kauppatori", "keskustaan"],
        [
            "held by rows in a sections view",
            { entities: [kauppatori], grid_options: { rows: 8 } },
            "grid",
            undefined,
            true,
            "Kauppatori",
            "keskustaan",
        ],
        [
            "by rows outside a sections view",
            { entities: [kauppatori], grid_options: { rows: 8 } },
            undefined,
            undefined,
            false,
            "Kauppatori",
            "keskustaan",
        ],
        [
            "held with texts in full",
            { entities: [kauppatori], height: 300, full_texts: true },
            undefined,
            undefined,
            true,
            "Kauppatori",
            "keskustaan",
        ],
        ["with texts in full", { entities: [kauppatori], full_texts: true }, undefined, undefined, false, "Kauppatori", "keskustaan"],
        [
            "held, with no subtitle",
            { entities: [{ entity: "sensor.kauppatori", name: "Kauppatori" }], height: 300 },
            undefined,
            undefined,
            true,
            "Kauppatori",
            null,
        ],
        [
            "held, two stops in one list",
            { entities: [kauppatori, asema], combine: true, height: 300 },
            undefined,
            undefined,
            true,
            "Kauppatori, Asema",
            null,
        ],
        ["two stops in one list", { entities: [kauppatori, asema], combine: true }, undefined, undefined, false, "Kauppatori, Asema", null],
        [
            "two stops in one list that state their direction",
            { entities: [kauppatori, asema], combine: true },
            undefined,
            "stated",
            false,
            "Kauppatori, Asema",
            "Lähtevät",
        ],
        [
            "held, with its sensor unavailable",
            { entities: [kauppatori], height: 300 },
            undefined,
            "unavailable",
            true,
            "Kauppatori",
            "keskustaan",
        ],
    ])("shows its cut texts in full on hover, sized %s", async (_name, config, layout, sensors, held, name, subtitle) => {
        const state = hass({
            "sensor.kauppatori":
                sensors === "unavailable"
                    ? "unavailable"
                    : [
                          departure("a", 5, { notice: "Lähtee laiturilta 2" }),
                          departure("c", 8, { cancelled: true, headsign: "Pasila" }),
                          departure("d", 9, { arrived: true, notice: "Kiertotie" }),
                      ],
            "sensor.works": [departure("b", 6)],
        });
        if (sensors === "stated") {
            for (const entity of Object.values(state.states)) entity!.attributes.direction = "departures";
        }
        if (sensors !== "unavailable") {
            state.states["sensor.kauppatori"]!.attributes.notices = ["Pysäkki siirretty"];
        }
        const element = await card(state, { title: "Lähdöt", ...config }, layout);
        const root = element.shadowRoot!;
        const shown = sensors !== "unavailable";
        expect(root.querySelector("ha-card")!.classList.contains("held")).toBe(held);
        expect(root.querySelector(".card-title")?.getAttribute("title")).toBe("Lähdöt");
        expect(root.querySelector(".attribution")?.getAttribute("title") ?? null).toBe(shown ? "Digitransit, CC BY 4.0" : null);
        expect(root.querySelector(".next .headsign")?.getAttribute("title") ?? null).toBe(shown ? "Koskela" : null);
        const heading = root.querySelector(".heading")!;
        expect(heading.getAttribute("title")).toBe("sensor.kauppatori");
        expect(heading.querySelector(".name")?.getAttribute("title")).toBe(name);
        expect(heading.querySelector(".subtitle")?.getAttribute("title") ?? null).toBe(subtitle);
        const titles = (selector: string) => [...root.querySelectorAll(selector)].map((element) => element.getAttribute("title"));
        const stopNotices = ["Pysäkki siirretty", ...(config.combine ? ["Ratatyöt. Junat korvataan busseilla."] : [])];
        expect(titles(".stop-notice")).toEqual(shown ? stopNotices : []);
        expect(titles(".next .direction")).toEqual(shown ? ["Lähtee laiturilta 2"] : []);
        expect(titles(".rows .direction")).toEqual(shown ? ["Kiertotie"] : []);
        const destinations = titles(".rows .headsign");
        expect(destinations).toEqual(shown ? [...(config.combine ? ["Koskela"] : []), "Pasila", "Koskela"] : []);
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

describe("the card's height", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    it.each([
        ["its content", undefined, {}, ""],
        ["a fixed height", undefined, { height: 300 }, "height: 300px"],
        ["a maximum height", undefined, { max_height: 400 }, "max-height: 400px"],
        [
            "the mode chosen over the heights it has",
            undefined,
            { height_mode: "max" as const, height: 300, max_height: 400 },
            "max-height: 400px",
        ],
        ["grid rows in a sections view", "grid", { height: 300, grid_options: { rows: 6 } }, "height: 100%"],
        [
            "the mode rounded down to the rows when the grid rows are automatic",
            "grid",
            { max_height: 400, grid_options: { rows: "auto" } },
            "max-height: 376px",
        ],
    ])("sizes itself by %s", async (_name, layout, extra, style) => {
        const element = await card(hass({ "sensor.kauppatori": [departure("a", 11)] }), extra, layout);
        expect(element.shadowRoot!.querySelector("ha-card")?.getAttribute("style") ?? "").toBe(style);
    });

    // The border and padding (34 px), a title on one line (32), the attribution (27), every stop's heading and next
    // departure (74) with the divider and the first row after them (49), and the divider between stops (37).
    it.each([
        ["one stop", {}, 184, 3],
        ["a title", { title: "Lähdöt" }, 216, 4],
        ["only the next departure", { departures: 1 }, 135, 3],
        ["two stops", { entities: ["sensor.kauppatori", "sensor.works"] }, 344, 6],
        ["two stops and a title", { title: "Lähdöt", entities: ["sensor.kauppatori", "sensor.works"] }, 376, 6],
        ["two stops in one list", { entities: ["sensor.kauppatori", "sensor.works"], combine: true }, 184, 3],
        ["two stops in one list and a title", { title: "Lähdöt", entities: ["sensor.kauppatori", "sensor.works"], combine: true }, 216, 4],
        [
            "two stops in one list, only the next departure",
            { departures: 1, entities: ["sensor.kauppatori", "sensor.works"], combine: true },
            135,
            3,
        ],
        ["two stops, only their next departures", { departures: 1, entities: ["sensor.kauppatori", "sensor.works"] }, 246, 4],
    ])("is never held lower than the next departure and one row of every stop need, with %s", async (_name, extra, minimum, rows) => {
        const state = hass({ "sensor.kauppatori": [departure("a", 11)], "sensor.works": [departure("b", 12)] });
        const element = await card(state, { ...extra, height: 100 });
        expect(element.getGridOptions()).toMatchObject({ rows: "auto", min_rows: rows });
        expect(element.shadowRoot!.querySelector("ha-card")?.getAttribute("style")).toBe(`height: ${minimum}px`);
    });

    it("puts each stop's heading, notices, next departure and later rows in that order, and is held only with a height", async () => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
        const state = hass({
            "sensor.kauppatori": [departure("a", 11), departure("b", 20)],
            "sensor.works": [departure("c", 12), departure("d", 25)],
        });
        const config = { title: "Lähdöt", entities: ["sensor.kauppatori", "sensor.works"] };
        const held = (await card(state, { ...config, height: 400 })).shadowRoot!.querySelector("ha-card")!;
        expect(held.classList.contains("held")).toBe(true);
        expect([...held.children].map((child) => child.className)).toEqual(["card-title", "sections", "attribution"]);
        const sections = [...held.querySelectorAll(".sections > section")];
        expect(sections.map((section) => [...section.children].map((child) => child.classList[0]))).toEqual([
            ["heading", "next", "rule", "rows"],
            ["heading", "stop-notice", "next", "rule", "rows"],
        ]);
        expect(sections.every((section) => section.querySelector(".rows > .row"))).toBe(true);
        const auto = (await card(state, config)).shadowRoot!.querySelector("ha-card")!;
        expect(auto.classList.contains("held")).toBe(false);
    });

    it.each([
        ["held to a height", undefined, { height: 400 }, ["fade-bottom"]],
        ["held up to a limit", undefined, { max_height: 400 }, ["fade-bottom"]],
        ["held by rows in a sections view", "grid", { grid_options: { rows: 4 } }, ["fade-bottom"]],
        [
            "held to a height with automatic rows in a sections view",
            "grid",
            { height: 400, grid_options: { rows: "auto" } },
            ["fade-bottom"],
        ],
        ["held by the older layout options' rows in a sections view", "grid", { layout_options: { grid_rows: 4 } }, ["fade-bottom"]],
        ["never in auto", undefined, {}, []],
        ["never in auto with automatic rows in a sections view", "grid", { grid_options: { rows: "auto" } }, []],
        ["never by grid rows outside a sections view", undefined, { grid_options: { rows: 4 } }, []],
    ])("fades the bottom edge of a stop's later departures that run past it when %s", async (_name, layout, extra, expected) => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
        const state = hass({ "sensor.kauppatori": [departure("a", 11), departure("b", 20), departure("c", 25)] });
        const element = await card(state, extra, layout);
        const rows = element.shadowRoot!.querySelector("section > .rows") as HTMLElement;
        Object.defineProperty(rows, "scrollHeight", { value: 600, configurable: true });
        Object.defineProperty(rows, "clientHeight", { value: 200, configurable: true });
        element.requestUpdate();
        await element.updateComplete;
        expect(["fade-top", "fade-bottom"].filter((name) => rows.classList.contains(name))).toEqual(expected);
    });

    it("lets go of a stop's fade when the card goes from held to auto, and fades it again when held again", async () => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
        const state = hass({ "sensor.kauppatori": [departure("a", 11), departure("b", 20), departure("c", 25)] });
        const element = await card(state, { height: 400 });
        const rows = element.shadowRoot!.querySelector("section > .rows") as HTMLElement;
        Object.defineProperty(rows, "scrollHeight", { value: 600, configurable: true });
        Object.defineProperty(rows, "clientHeight", { value: 200, configurable: true });
        element.requestUpdate();
        await element.updateComplete;
        expect([...rows.classList].filter((name) => name.startsWith("fade"))).toEqual(["fades", "fade-bottom"]);
        element.setConfig({ type: "custom:departures-card", entities: ["sensor.kauppatori"] } as DeparturesCardConfig);
        await element.updateComplete;
        expect([...rows.classList].filter((name) => name.startsWith("fade"))).toEqual([]);
        element.setConfig({ type: "custom:departures-card", entities: ["sensor.kauppatori"], height: 400 } as DeparturesCardConfig);
        await element.updateComplete;
        expect([...rows.classList].filter((name) => name.startsWith("fade"))).toEqual(["fades", "fade-bottom"]);
    });

    it("keeps a held stop's fade when its last row moves to another day and the rows take the day column", async () => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
        const element = await card(hass({ "sensor.kauppatori": [departure("a", 11), departure("b", 20), departure("c", 25)] }), {
            height: 400,
        });
        const rows = element.shadowRoot!.querySelector("section > .rows") as HTMLElement;
        Object.defineProperty(rows, "scrollHeight", { value: 600, configurable: true });
        Object.defineProperty(rows, "clientHeight", { value: 200, configurable: true });
        element.requestUpdate();
        await element.updateComplete;
        expect(rows.classList.contains("with-days")).toBe(false);
        expect([...rows.classList].filter((name) => name.startsWith("fade"))).toEqual(["fades", "fade-bottom"]);
        element.hass = hass({ "sensor.kauppatori": [departure("a", 11), departure("b", 20), departure("c", 10 * 60)] });
        await element.updateComplete;
        expect(element.shadowRoot!.querySelector("section > .rows")).toBe(rows);
        expect(rows.classList.contains("with-days")).toBe(true);
        expect([...rows.classList].filter((name) => name.startsWith("fade"))).toEqual(["fades", "fade-bottom"]);
    });

    it("is held by its rows in a sections view and let go out of it, even when an unrelated state change comes with it", async () => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
        vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            callback(0);
            return 0;
        });
        const state = hass({ "sensor.kauppatori": [departure("a", 11), departure("b", 20)] });
        const element = await card(state, { grid_options: { rows: 4 } });
        const root = element.shadowRoot!;
        // The sizes a browser would lay out, which happy-dom doesn't.
        const layOut = () => {
            const section = root.querySelector(".sections > section")!;
            Object.defineProperty(section, "clientTop", { value: 1, configurable: true });
            Object.defineProperty(section.querySelector(":scope > .rows"), "offsetTop", { value: 90, configurable: true });
            Object.defineProperty(section.querySelector(":scope > .rows"), "clientTop", { value: 0, configurable: true });
            Object.defineProperty(section.querySelector(".rows > .row"), "offsetTop", { value: 4, configurable: true });
            Object.defineProperty(section.querySelector(".rows > .row"), "offsetHeight", { value: 45, configurable: true });
        };
        const minimums = () => [...root.querySelectorAll<HTMLElement>(".sections > section")].map((section) => section.style.minHeight);
        let changes = 0;
        // A state change elsewhere in Home Assistant, which on its own wouldn't redraw the card.
        const elsewhere = () => {
            const other = { entity_id: "sensor.elsewhere", state: String(++changes), last_changed: "2026-10-04", attributes: {} };
            element.hass = { ...state, states: { ...state.states, "sensor.elsewhere": other } };
        };
        layOut();
        expect(root.querySelector("ha-card")?.classList.contains("held")).toBe(false);

        element.layout = "grid";
        elsewhere();
        await element.updateComplete;
        expect(root.querySelector("ha-card")?.classList.contains("held")).toBe(true);
        expect(root.querySelector("ha-card")?.getAttribute("style")).toBe("height: 100%");
        expect(minimums()).toEqual(["140px"]);

        element.layout = "masonry";
        elsewhere();
        await element.updateComplete;
        expect(root.querySelector("ha-card")?.classList.contains("held")).toBe(false);
        expect(root.querySelector("ha-card")?.getAttribute("style") ?? "").toBe("");
        expect(minimums()).toEqual([""]);
    });

    it("refuses a height that isn't a positive number of pixels, and an unknown height mode, with an error about the height", () => {
        const element = document.createElement("departures-card");
        const config = (extra: Record<string, unknown>) =>
            ({ type: "custom:departures-card", entities: ["sensor.kauppatori"], ...extra }) as never;
        const error = translate(browserLanguage(), "common.invalid_height");
        expect(error).toMatch(/^Invalid height\./);
        for (const value of ["300px", 0, -10]) {
            expect(() => element.setConfig(config({ max_height: value }))).toThrow(error);
            expect(() => element.setConfig(config({ height: value }))).toThrow(error);
        }
        expect(() => element.setConfig(config({ height_mode: "tall" }))).toThrow(error);
        // Left empty in YAML, each is unset.
        expect(() => element.setConfig(config({ height_mode: null, height: null, max_height: null }))).not.toThrow();
        // The card's own count is checked first.
        expect(() => element.setConfig(config({ departures: 0, height: 0 }))).toThrow(
            translate(browserLanguage(), "common.invalid_departures"),
        );
    });

    it("refuses a row step other than whole or half rows, with an error about the rounding", () => {
        const element = document.createElement("departures-card");
        const config = (extra: Record<string, unknown>) =>
            ({ type: "custom:departures-card", entities: ["sensor.kauppatori"], ...extra }) as never;
        const error = translate(browserLanguage(), "common.invalid_row_step");
        expect(error).toMatch(/^Invalid rounding\./);
        expect(() => element.setConfig(config({ row_step: "quarter" }))).toThrow(error);
        expect(() => element.setConfig(config({ row_step: "half" }))).not.toThrow();
        expect(() => element.setConfig(config({ row_step: null }))).not.toThrow();
    });

    // happy-dom lays nothing out, so the card's last part ends where `bottom` says, under 16 px of padding and a 1 px border.
    it.each<[string, string | undefined, Partial<DeparturesCardConfig>, number, string]>([
        [
            "half a row short, to the next whole row with the half row under the title",
            "grid",
            { title: "Lähdöt" },
            199,
            "min-height: 248px; --departures-spare: 32px",
        ],
        ["on a whole row already, with nothing over", "grid", {}, 231, "min-height: 248px"],
        ["half a row short, kept there with half rows", "grid", { row_step: "half" }, 199, "min-height: 216px"],
        ["not outside a sections view", undefined, {}, 199, ""],
        ["not when held to a height", "grid", { height: 400 }, 199, "height: 400px"],
        [
            "under its limit, on the rows its content needs, centred without a title",
            "grid",
            { max_height: 400 },
            199,
            "max-height: 376px; min-height: 248px; --departures-spare: 16px",
        ],
        ["over its limit, on the limit rounded down to the rows", "grid", { max_height: 400 }, 900, "max-height: 376px; min-height: 376px"],
        ["up to its limit as set outside a sections view", undefined, { max_height: 400 }, 199, "max-height: 400px"],
    ])("ends %s", async (_name, layout, extra, bottom, style) => {
        const element = await card(hass({}), extra, layout);
        const haCard = element.shadowRoot!.querySelector<HTMLElement>("ha-card")!;
        Object.defineProperty(haCard, "clientWidth", { value: 454, configurable: true });
        haCard.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
        const last = haCard.querySelector<HTMLElement>(":scope > .attribution") ?? haCard.querySelector<HTMLElement>(":scope > .sections")!;
        last.getBoundingClientRect = () => ({ bottom }) as DOMRect;
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
            paddingBottom: "16px",
            borderBottomWidth: "1px",
            marginBottom: "4px",
            marginTop: "0px",
            width: "0px",
        } as CSSStyleDeclaration);
        (element as unknown as { fillRows(): void }).fillRows();
        vi.restoreAllMocks();
        await element.updateComplete;
        expect(haCard.getAttribute("style") ?? "").toBe(style);
    });

    // The content is 120.4 px, a fraction over two rows, and then 216 px drawn at 0.8, as a dialog opening draws the card.
    it.each([
        ["a fraction of a pixel over a row, on the next one", 103.4, 1, "min-height: 184px; --departures-spare: 31px"],
        ["drawn scaled, in the layout's pixels", 199, 0.8, "min-height: 248px; --departures-spare: 16px"],
    ])("ends %s", async (_name, bottom, scale, style) => {
        const element = await card(hass({}), {}, "grid");
        const haCard = element.shadowRoot!.querySelector<HTMLElement>("ha-card")!;
        Object.defineProperty(haCard, "clientWidth", { value: 454, configurable: true });
        haCard.getBoundingClientRect = () => ({ top: 0, width: 454 * scale }) as DOMRect;
        const last = haCard.querySelector<HTMLElement>(":scope > .attribution") ?? haCard.querySelector<HTMLElement>(":scope > .sections")!;
        last.getBoundingClientRect = () => ({ bottom: bottom * scale }) as DOMRect;
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
            paddingBottom: "16px",
            borderBottomWidth: "1px",
            marginBottom: "4px",
            marginTop: "0px",
            width: "454px",
        } as CSSStyleDeclaration);
        (element as unknown as { fillRows(): void }).fillRows();
        vi.restoreAllMocks();
        await element.updateComplete;
        expect(haCard.getAttribute("style") ?? "").toBe(style);
    });

    // Held to 300 px, its stops' box grows to the card's height, so the content ends at the last stop, here with no
    // attribution under it, and the card's 16 px of padding and 1 px border. The room left over is spread as on filled
    // rows while it is less than a row, under the title or half above the stops without one.
    it.each<[string, Partial<DeparturesCardConfig>, number, string]>([
        ["a little room under the title", { title: "Lähdöt" }, 243, "height: 300px; --departures-spare: 40px"],
        ["a little room around the stops without a title", {}, 243, "height: 300px; --departures-spare: 20px"],
        ["a row or more under the stops", { title: "Lähdöt" }, 219, "height: 300px"],
    ])("held to a height, spreads %s", async (_name, extra, end, style) => {
        const element = await card(hass({}), { ...extra, height: 300 }, "grid");
        const haCard = element.shadowRoot!.querySelector<HTMLElement>("ha-card")!;
        Object.defineProperty(haCard, "clientWidth", { value: 454, configurable: true });
        haCard.getBoundingClientRect = () => ({ top: 0, width: 454, height: 300 }) as DOMRect;
        const sections = haCard.querySelector<HTMLElement>(":scope > .sections")!;
        const stop = document.createElement("section");
        stop.getBoundingClientRect = () => ({ bottom: end }) as DOMRect;
        sections.append(stop);
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
            paddingBottom: "16px",
            borderBottomWidth: "1px",
            marginBottom: "4px",
            marginTop: "0px",
            width: "454px",
        } as CSSStyleDeclaration);
        (element as unknown as { fillRows(): void }).fillRows();
        vi.restoreAllMocks();
        await element.updateComplete;
        expect(haCard.getAttribute("style") ?? "").toBe(style);
    });

    it("keeps a held stop's next departure and first later row in view, and only a stop that has later rows", async () => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
        vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
            callback(0);
            return 0;
        });
        const state = hass({
            "sensor.kauppatori": [departure("a", 11), departure("b", 20)],
            "sensor.works": [departure("c", 12)],
            "sensor.gone": "unavailable",
        });
        const entities = ["sensor.kauppatori", "sensor.works", "sensor.gone"];
        const element = await card(state, { entities, height: 600 });
        const root = element.shadowRoot!;
        const sections = () => [...root.querySelectorAll<HTMLElement>(".sections > section")];
        // The sizes a browser would lay out, which happy-dom doesn't.
        const stub = (target: Element | null, sizes: Record<string, number>) => {
            for (const [name, value] of Object.entries(sizes)) {
                if (target) {
                    Object.defineProperty(target, name, { value, configurable: true });
                }
            }
        };
        const layOut = () => {
            for (const section of sections()) {
                stub(section, { clientTop: 1 });
                stub(section.querySelector(":scope > .rows"), { offsetTop: 90, clientTop: 0 });
                stub(section.querySelector(".rows > .row"), { offsetTop: 4, offsetHeight: 45 });
            }
        };
        const minimums = () => sections().map((section) => section.style.minHeight);
        const configure = async (extra: Partial<DeparturesCardConfig>) => {
            element.setConfig({ type: "custom:departures-card", entities, ...extra } as DeparturesCardConfig);
            await element.updateComplete;
            layOut();
            element.requestUpdate();
            await element.updateComplete;
        };
        layOut();
        element.requestUpdate();
        await element.updateComplete;
        expect(minimums()).toEqual(["140px", "", ""]);
        const first = sections();

        await configure({});
        expect(root.querySelector("ha-card")?.classList.contains("held")).toBe(false);
        expect(sections()).toEqual(first);
        expect(minimums()).toEqual(["", "", ""]);

        // Held again, its minimum comes back.
        await configure({ height: 600 });
        expect(minimums()).toEqual(["140px", "", ""]);

        // Still held, a stop whose later departures have gone has nothing to keep in view.
        element.hass = hass({
            "sensor.kauppatori": [departure("a", 11)],
            "sensor.works": [departure("c", 12)],
            "sensor.gone": "unavailable",
        });
        await element.updateComplete;
        expect(root.querySelector("ha-card")?.classList.contains("held")).toBe(true);
        expect(sections()[0].querySelector(".rows")).toBeNull();
        expect(minimums()).toEqual(["", "", ""]);

        // Still held, a stop that gains later departures is kept in view from then on.
        element.hass = hass({
            "sensor.kauppatori": [departure("a", 11)],
            "sensor.works": [departure("c", 12), departure("d", 25)],
            "sensor.gone": "unavailable",
        });
        await element.updateComplete;
        layOut();
        element.requestUpdate();
        await element.updateComplete;
        expect(minimums()).toEqual(["", "140px", ""]);

        // Combined, the one list of every stop's departures is kept in view as a stop's is.
        element.hass = state;
        await configure({ height: 600, combine: true });
        expect(minimums()).toEqual(["140px"]);
    });
});

describe("the editor", () => {
    it("writes a stop with nothing but its sensor as the entity id", () => {
        expect(compactSections([{ entity: "sensor.a" }, { entity: "sensor.b", name: "B", subtitle: "" }, { entity: "" }])).toEqual([
            "sensor.a",
            { entity: "sensor.b", name: "B" },
        ]);
    });

    it("shows an option left empty in YAML as its default, and a set one as it is", () => {
        const empty = { departures: null, show_cancelled: null, show_notices: null, full_texts: null, combine: null };
        const data = formData({ type: "custom:departures-card", entities: ["sensor.a"], ...empty } as never);
        expect([data.departures, data.show_cancelled, data.show_notices, data.full_texts, data.combine]).toEqual([
            4,
            true,
            true,
            false,
            false,
        ]);
        const set = formData({
            type: "custom:departures-card",
            entities: ["sensor.a"],
            departures: 7,
            full_texts: true,
            show_cancelled: false,
        });
        expect([set.departures, set.full_texts, set.show_cancelled]).toEqual([7, true, false]);
    });

    it("takes one sensor written without a list, as the card does", () => {
        expect(formData({ type: "custom:departures-card", entities: "sensor.a" } as never).entities).toEqual([{ entity: "sensor.a" }]);
    });

    it("writes only what differs from the defaults, and the stops compacted", () => {
        const form = formData({ type: "custom:departures-card", entities: ["sensor.a"] });
        expect(configFromForm({ ...form, title: "", entities: [{ entity: "sensor.a" }] } as never)).toEqual({
            type: "custom:departures-card",
            entities: ["sensor.a"],
        });
        expect(
            configFromForm({
                ...form,
                title: "Bussit",
                departures: 6,
                combine: true,
                full_texts: null,
                show_notices: "",
                row_step: "half",
                entities: [{ entity: "sensor.a", name: "A", subtitle: "" }],
            } as never),
        ).toEqual({
            type: "custom:departures-card",
            title: "Bussit",
            departures: 6,
            combine: true,
            row_step: "half",
            entities: [{ entity: "sensor.a", name: "A" }],
        });
    });

    it("drops whole rows, the default step, and the step of a card held to a fixed height", () => {
        const base = { type: "custom:departures-card", entities: [{ entity: "sensor.a" }] };
        expect(configFromForm({ ...base, row_step: "full" } as never)).not.toHaveProperty("row_step");
        expect(configFromForm({ ...base, row_step: "half", height: 300 } as never)).not.toHaveProperty("row_step");
        expect(configFromForm({ ...base, row_step: "half", height_mode: "max", height: 300, max_height: 400 } as never)).toHaveProperty(
            "row_step",
            "half",
        );
    });
});

describe("the countdown", () => {
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    it("runs on between the sensor's updates, and stops when the card is removed", async () => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
        const element = await card(hass({ "sensor.kauppatori": [departure("a", 10)] }), {});
        const countdown = () => text(element.shadowRoot!.querySelector(".next .countdown"));
        expect(countdown()).toBe("10 min");
        await vi.advanceTimersByTimeAsync(60_000);
        await element.updateComplete;
        expect(countdown()).toBe("9 min");
        element.remove();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("redrawing for a new hass", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = "";
    });

    // Home Assistant hands the card every change in the house. Its own sensors, the language and the locale (the time
    // format and time zone with it) are what change what the card shows.
    it.each<[string, (state: HomeAssistant) => HomeAssistant, number]>([
        [
            "another entity's change",
            (state) => ({
                ...state,
                states: {
                    ...state.states,
                    "sensor.elsewhere": { entity_id: "sensor.elsewhere", state: "2", last_changed: "", attributes: {} },
                },
            }),
            0,
        ],
        ["a new language", (state) => ({ ...state, locale: { ...state.locale!, language: "en" }, language: "en" }), 1],
        ["a new locale alone, as a new time zone", (state) => ({ ...state, locale: { ...state.locale!, time_zone: "local" } }), 1],
        ["a new language in the older field alone", (state) => ({ ...state, language: "sv" }), 1],
    ])("redraws as it should for %s", async (_name, change, renders) => {
        const element = await card(hass({ "sensor.kauppatori": [departure("a", 5)] }), {});
        const render = vi.spyOn(element as unknown as { render(): unknown }, "render");
        element.hass = change(element.hass!);
        await element.updateComplete;
        expect(render).toHaveBeenCalledTimes(renders);
    });
});

describe("a held stop's scrollbar", () => {
    const saved = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");

    beforeEach(() => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
        // happy-dom lays nothing out, and a card with no width marks nothing.
        Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 340 });
    });

    afterEach(() => {
        if (saved) {
            Object.defineProperty(HTMLElement.prototype, "clientWidth", saved);
        } else {
            delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
        }
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    async function stop(config: Partial<DeparturesCardConfig> = {}): Promise<DeparturesCard> {
        return card(hass({ "sensor.kauppatori": [departure("a", 4), departure("b", 12), departure("c", 20)] }), config);
    }

    /** Gives a stop's rows a height of 100 and content as tall as `content` says each time it is read. */
    function scroller(element: DeparturesCard, content: (rows: HTMLElement) => number): HTMLElement {
        const rows = element.shadowRoot!.querySelector<HTMLElement>("section > .rows")!;
        Object.defineProperty(rows, "clientHeight", { configurable: true, value: 100 });
        Object.defineProperty(rows, "scrollHeight", { configurable: true, get: () => content(rows) });
        return rows;
    }

    const mark = (element: DeparturesCard) => (element as unknown as { markScrollers(): void }).markScrollers();

    it.each<[string, Partial<DeparturesCardConfig>, number, boolean]>([
        ["whose rows fit", { height: 300 }, 100, false],
        ["whose rows scroll", { height: 300 }, 140, true],
        ["that isn't held to a height", {}, 140, false],
    ])("makes room for a scrollbar only in a stop that scrolls, as in one %s", async (_name, config, content, scrolls) => {
        const element = await stop(config);
        const rows = scroller(element, () => content);
        mark(element);
        expect(rows.classList.contains("scrolls")).toBe(scrolls);
    });

    it("judges a stop at its whole width each time, so rows made taller by a scrollbar don't keep it scrolling", async () => {
        const element = await stop({ height: 300, full_texts: true });
        // With the scrollbar's room gone a destination wraps, and the rows are 30 px taller.
        let more = 60;
        const rows = scroller(element, (part) => 100 + more + (part.classList.contains("scrolls") ? 30 : 0));
        mark(element);
        expect(rows.classList.contains("scrolls")).toBe(true);
        more = 0;
        mark(element);
        expect(rows.classList.contains("scrolls")).toBe(false);
    });

    it("leaves a list scrolled where it was", async () => {
        const element = await stop({ height: 300 });
        // Judged at its whole width the list is shorter for a moment, which scrolls it back as a browser would.
        let top = 0;
        const rows = scroller(element, (part) => {
            const content = part.classList.contains("scrolls") ? 200 : 140;
            top = Math.min(top, content - 100);
            return content;
        });
        Object.defineProperty(rows, "scrollTop", { configurable: true, get: () => top, set: (value: number) => (top = value) });
        mark(element);
        top = 100;
        mark(element);
        expect(top).toBe(100);
    });
});

describe("a departure's popup", () => {
    beforeEach(() => {
        vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    const flights = () => {
        const state = hass({
            "sensor.kauppatori": [
                departure("a", 4, { mode: "plane", line: "AY9411", headsign: "Oulu", platform: "34A", notice: "Portille" }),
                departure("b", 12, {
                    mode: "plane",
                    line: "SK9709",
                    headsign: "Tukholma",
                    platform: "13",
                    realtime: true,
                    scheduled: new Date(NOW + 2 * 60_000).toISOString(),
                }),
            ],
        });
        return state;
    };

    async function open(element: DeparturesCard, selector: string): Promise<HTMLElement> {
        element.shadowRoot!.querySelector<HTMLElement>(selector)!.click();
        await element.updateComplete;
        return element.shadowRoot!.querySelector<HTMLElement>(".details")!;
    }

    it("is empty until a departure is clicked", async () => {
        const element = await card(flights(), {});
        expect(text(element.shadowRoot!.querySelector(".details"))).toBe("");
    });

    it("tells of a notice with the icon in the accent colour, and says it in the popup in the same colour", async () => {
        const element = await card(flights(), {});
        expect(element.shadowRoot!.querySelector(".next .direction")!.classList.contains("noted")).toBe(true);
        expect(text(element.shadowRoot!.querySelector(".next"))).toBe("4 min AY9411 Oulu 34A");
        const popup = await open(element, ".next");
        expect(text(popup)).toBe("AY9411 Oulu Tila Portille Aikataulu 16.56 Portti 34A");
        expect(text(popup.querySelector("dd .noted"))).toBe("Portille");
    });

    it("shows a later departure's times with its delay coloured as on its row", async () => {
        const element = await card(flights(), {});
        expect(text(element.shadowRoot!.querySelector(".row"))).toBe("+10 min·13 17.04 SK9709 Tukholma");
        const popup = await open(element, ".row");
        expect(text(popup)).toBe("SK9709 Tukholma Aikataulu 16.54 Arvio 17.04 +10 min Portti 13");
        expect(text(popup.querySelector(".late"))).toBe("+10 min");
    });

    it("shows a landed plane in green with its hall, which its row leaves out", async () => {
        const state = hass({
            "sensor.kauppatori": [
                departure("a", 4),
                departure("b", 2, { mode: "plane", headsign: "Malaga", platform: "2B", arrived: true }),
            ],
        });
        state.states["sensor.kauppatori"]!.attributes.direction = "arrivals";
        const element = await card(state, {});
        const row = element.shadowRoot!.querySelector(".row.came-in")!;
        expect(row.querySelector(".platform")).toBeNull();
        const popup = await open(element, ".row.came-in");
        expect(text(popup.querySelector(".arrived"))).toBe("Maassa");
        expect(text(popup)).toBe("55 Malaga Tila Maassa Aikataulu 16.54 Aula 2B");
    });

    it("gives a departure with a notice and no direction icon an info sign", async () => {
        const state = hass({ "sensor.kauppatori": [departure("a", 4), departure("b", 9, { notice: "Kiertotie" }), departure("c", 12)] });
        const icons = [...(await card(state, {})).shadowRoot!.querySelectorAll(".row")].map((row) =>
            row.querySelector(".direction")?.getAttribute("icon"),
        );
        expect(icons).toEqual(["mdi:information-outline", undefined]);
    });

    it("closes when its departure leaves the list", async () => {
        const element = await card(flights(), {});
        const popup = await open(element, ".row");
        expect(popup.hasAttribute("data-showing")).toBe(true);
        element.hass = hass({ "sensor.kauppatori": [departure("a", 4)] });
        await element.updateComplete;
        expect(popup.hasAttribute("data-showing")).toBe(false);
        await element.updateComplete;
        expect(text(popup)).toBe("");
    });

    it("closes from its own line, as a key press there does", async () => {
        const element = await card(flights(), {});
        const popup = await open(element, ".row");
        await open(element, ".row");
        expect(popup.hasAttribute("data-showing")).toBe(false);
        expect(text(popup)).toBe("");
    });

    it("doesn't open again from the click that closed it", async () => {
        const element = await card(flights(), {});
        const popup = await open(element, ".row");
        // A pointer closes the popup before its click arrives.
        popup.hidePopover();
        await open(element, ".row");
        expect(popup.hasAttribute("data-showing")).toBe(false);
        await new Promise((resolve) => setTimeout(resolve));
        await open(element, ".row");
        expect(popup.hasAttribute("data-showing")).toBe(true);
    });

    it("moves to another line without opening twice", async () => {
        const element = await card(flights(), {});
        await open(element, ".row");
        const popup = await open(element, ".next");
        expect(popup.hasAttribute("data-showing")).toBe(true);
        expect(text(popup)).toBe("AY9411 Oulu Tila Portille Aikataulu 16.56 Portti 34A");
    });

    it("closes from its close button", async () => {
        const element = await card(flights(), {});
        const popup = await open(element, ".row");
        const close = popup.querySelector<HTMLElement>(".close")!;
        expect(close.getAttribute("aria-label")).toBe("Sulje");
        close.click();
        expect(popup.hasAttribute("data-showing")).toBe(false);
    });

    it("says that the large departure is on time, which a row leaves to its live icon", async () => {
        const live = (id: string, minutes: number) =>
            departure(id, minutes, { realtime: true, scheduled: new Date(NOW + minutes * 60_000).toISOString(), platform: "3" });
        const element = await card(hass({ "sensor.kauppatori": [live("a", 4), live("b", 9), departure("c", 12)] }), {});
        expect(text(element.shadowRoot!.querySelector(".next .meta"))).toBe("Aikataulussa·3");
        expect(text(element.shadowRoot!.querySelector(".row .end"))).toBe("3");
        const timetable = await card(hass({ "sensor.kauppatori": [departure("c", 12)] }), {});
        expect(timetable.shadowRoot!.querySelector(".next .on-time")).toBeNull();
    });

    it("closes when anything scrolls", async () => {
        const element = await card(flights(), {});
        const popup = await open(element, ".row");
        window.dispatchEvent(new Event("scroll"));
        expect(popup.hasAttribute("data-showing")).toBe(false);
    });

    it("isn't there without the Popover API, and a click does nothing", async () => {
        delete popovers.showPopover;
        delete popovers.hidePopover;
        const element = await card(flights(), {});
        expect(element.shadowRoot!.querySelector(".details")).toBeNull();
        element.shadowRoot!.querySelector<HTMLElement>(".row")!.click();
        await element.updateComplete;
        expect(element.shadowRoot!.querySelector(".details")).toBeNull();
    });
});
