/**
 * A dashboard card for the next departures from stops, railway stations and airports, from any sensor that
 * writes the departures format (docs/departures-format.md).
 *
 * Each sensor is a section: its next departure large, with a countdown, and the ones after it as rows.
 * Sections sit side by side when the card is wide enough for two, and stack otherwise, or are one list by time.
 */
import { LitElement, css, html, nothing } from "lit";
import type { CSSResultGroup, PropertyValues, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { CARD_VERSION, DEFAULT_DEPARTURES, DEFAULT_SCROLL_INDICATOR, MODE_ICONS, TICK_MS } from "./const";
import {
    badgeColors,
    clock,
    dayLabel,
    delayMinutes,
    departuresSensors,
    isDeparturesSensor,
    minutesUntil,
    sectionsOf,
    shownDepartures,
    statedDirection,
    stopNotices,
    visibleDepartures,
} from "./departures";
import "./editor";
import { ScrollFade, fadeStyles, scrollIndicator, validScrollIndicator } from "./fade";
import type { HassEntity, HomeAssistant } from "./hass";
import { gridMinRows, heightCardSize, heightStyle, validHeight } from "./height";
import { drawnScale, fillLimit, filledHeight, filledStyle, heldSpare, spareRoom, validRowStep } from "./rows";
import { browserLanguage, translate } from "./localize/localize";
import type { Departure, DeparturesCardConfig, SectionConfig, ShownDeparture } from "./types";

/** The gap under the title, to which the room a whole row leaves over is added. */
const TITLE_GAP_PX = 4;

/** The card's width from which two stops sit side by side, the container query's 586 px of content and 34 of padding and border. */
const SIDE_BY_SIDE_PX = 620;

/**
 * The narrowest a card of these columns gets in a sections view. A section beside others is at least 320 px, which
 * gives 12 columns 307 px with 8 px between them. A card wider than a section spans sections each that wide, with
 * gaps wider than a column's, so this is the least it gets there too.
 */
function narrowestWidth(columns: number): number {
    return (columns * (307 + 8)) / 12 - 8;
}

/** Whether the browser has the Popover API, which a departure's popup needs. */
function hasPopovers(): boolean {
    return "showPopover" in HTMLElement.prototype;
}

/**
 * Where a departure leaves from, when its line shows it: not for a cancelled one, and not a landing plane's hall,
 * which matters less than a gate and is in the popup.
 */
function shownPlatform(departure: ShownDeparture): string | undefined {
    const hidden = departure.cancelled || (departure.mode === "plane" && departure.direction === "arrivals");
    return hidden ? undefined : departure.platform || undefined;
}

/** The icons that show which way a departure goes, by mode. */
const DIRECTION_ICONS: Record<string, { departing: string; arriving: string }> = {
    plane: { departing: "mdi:airplane-takeoff", arriving: "mdi:airplane-landing" },
    train: { departing: "mdi:location-exit", arriving: "mdi:location-enter" },
};

console.info(
    `%c  DEPARTURES-CARD \n%c  ${CARD_VERSION}    `,
    "color: orange; font-weight: bold; background: black",
    "color: white; font-weight: bold; background: dimgray",
);

interface CardRegistration {
    type: string;
    name: string;
    description: string;
    documentationURL?: string;
    preview?: boolean;
}

const registry = window as unknown as { customCards?: CardRegistration[] };
registry.customCards = registry.customCards ?? [];
registry.customCards.push({
    type: "departures-card",
    name: translate(browserLanguage(), "common.name"),
    description: translate(browserLanguage(), "common.description"),
    documentationURL: "https://github.com/jesmak/departures-card",
    preview: true,
});

@customElement("departures-card")
export class DeparturesCard extends LitElement {
    @property({ attribute: false }) public hass?: HomeAssistant;
    /** Set by the dashboard: "grid" in a sections view. */
    @property({ attribute: false }) public layout?: string;
    @state() private config?: DeparturesCardConfig;
    /** On automatic rows in a sections view, the height that ends the card on a whole row (or half); 0 when it isn't set. */
    @state() private filled = 0;
    /**
     * The room that height leaves over, or a held card's when it is less than a row, put under the title rather than
     * under the attribution, or split above and below the stops without a title.
     */
    @state() private spare = 0;

    /** The departure whose details are open in the popup, by its key. */
    @state() private open?: string;

    /** The departures drawn, by their keys, for the popup. */
    private readonly shown = new Map<string, ShownDeparture>();
    /** The departure whose popup the click under way has just closed, so the same click doesn't open it again. */
    private dismissed?: string;
    private readonly hideDetails = (): void => this.renderRoot.querySelector<HTMLElement>(".details")?.hidePopover();
    private ticker?: ReturnType<typeof setInterval>;
    private readonly resizes = new ResizeObserver(() => this.alignBadgesSoon());
    private frame?: number;

    constructor() {
        super();
        // Fades the edges of each stop's later departures while the card is held to a height, through the card's own lifecycle.
        new ScrollFade(
            this,
            () => (this.renderRoot.querySelector("ha-card.held") ? this.renderRoot.querySelectorAll<HTMLElement>("section > .rows") : []),
            () => scrollIndicator(this.config ?? {}, DEFAULT_SCROLL_INDICATOR),
        );
    }

    public static getConfigElement(): HTMLElement {
        return document.createElement("departures-card-editor");
    }

    /** Offers the first departures sensor there is when the card is added from the picker. */
    public static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
        return { entities: hass ? departuresSensors(hass).slice(0, 1) : [] };
    }

    public setConfig(config: DeparturesCardConfig): void {
        // One sensor may be written without a list around it.
        const entities: unknown = typeof config?.entities === "string" ? [config.entities] : config?.entities;
        // An empty list is the picker's stub when there is no departures sensor yet, and the card says so.
        if (!config || !Array.isArray(entities) || (entities.length > 0 && sectionsOf(entities).length === 0)) {
            throw new Error(translate(browserLanguage(), "common.invalid_configuration"));
        }
        // An empty `departures:` in YAML is null, the default as a missing one is.
        if (config.departures != null && !(Number.isInteger(config.departures) && config.departures >= 1)) {
            throw new Error(translate(browserLanguage(), "common.invalid_departures"));
        }
        if (!validHeight(config)) {
            throw new Error(translate(browserLanguage(), "common.invalid_height"));
        }
        if (!validRowStep(config)) {
            throw new Error(translate(browserLanguage(), "common.invalid_row_step"));
        }
        if (!validScrollIndicator(config)) {
            throw new Error(translate(browserLanguage(), "common.invalid_scroll_indicator"));
        }
        this.config = { ...config, entities };
    }

    /** One list only from two different sensors or more: one sensor given twice has nothing to merge. */
    private get combines(): boolean {
        return !!this.config?.combine && new Set(sectionsOf(this.config.entities).map((section) => section.entity)).size > 1;
    }

    public getCardSize(): number {
        const rows = this.config?.departures ?? DEFAULT_DEPARTURES;
        const entities = this.config ? sectionsOf(this.config.entities).map((section) => section.entity) : [];
        const content = 1 + (2 + rows) * (!this.config || this.combines ? 1 : entities.length);
        return heightCardSize(this.config ?? {}, content, this.minimumHeight());
    }

    /**
     * In a sections view the card takes a whole section and is never narrower: a departure keeps to one line, and
     * narrower than a section a flight's number, delay and gate leave its destination no room.
     */
    public getGridOptions(): Record<string, unknown> {
        return { columns: 12, min_columns: 12, rows: "auto", min_rows: gridMinRows(this.minimumHeight(true)) };
    }

    /**
     * Held to a height, the title, the attribution and every stop's heading, which a held card keeps to one line each,
     * and every stop's next departure and first row after it still fit, each on its one line.
     * In a sections view, columns that keep the card wide enough for two stops side by side even at their narrowest
     * count the stops in pairs, otherwise they are one above the other. Notices, texts shown in full, the line about a
     * sensor that can't be shown and a long line name wrapping on a card narrower than a section allows come with the
     * data, so they aren't counted.
     */
    private minimumHeight(grid = this.layout === "grid"): number {
        if (!this.config) {
            return 0;
        }
        const borderAndPadding = 34;
        const title = this.config.title ? 32 : 0;
        const attribution = 27;
        // The heading and the next departure.
        const next = 74;
        // The divider and the first row after it.
        const row = (this.config.departures ?? DEFAULT_DEPARTURES) > 1 ? 49 : 0;
        const stops = this.combines ? 1 : sectionsOf(this.config.entities).length;
        if (stops === 0) {
            return 0;
        }
        if (grid && narrowestWidth(this.columns()) >= SIDE_BY_SIDE_PX) {
            // Side by side, a pair of stops is as tall as one, and a third goes under them with nothing between.
            return borderAndPadding + title + attribution + Math.ceil(stops / 2) * (next + row);
        }
        const divider = 37;
        return borderAndPadding + title + attribution + stops * (next + row) + (stops - 1) * divider;
    }

    /** The columns set in the layout tab, in either form Home Assistant has saved them, or a whole section. */
    private columns(): number {
        const config = this.config;
        const columns = config?.grid_options
            ? config.grid_options.columns
            : typeof config?.layout_options?.grid_columns === "number"
              ? config.layout_options.grid_columns * 3
              : undefined;
        return typeof columns === "number" ? columns : 12;
    }

    /** The countdowns run on between the sensor's updates, so the card redraws itself while it is on the page. */
    public connectedCallback(): void {
        super.connectedCallback();
        // Back on the page, such as from another view, its countdowns are as old as when it left.
        this.requestUpdate();
        this.ticker = setInterval(() => this.requestUpdate(), TICK_MS);
    }

    public disconnectedCallback(): void {
        super.disconnectedCallback();
        clearInterval(this.ticker);
        this.resizes.disconnect();
        cancelAnimationFrame(this.frame ?? 0);
        window.removeEventListener("scroll", this.hideDetails, true);
    }

    protected updated(): void {
        // An update already queued still runs after the card has left the page, and must not start watching again.
        if (!this.isConnected) {
            return;
        }
        const card = this.renderRoot.querySelector("ha-card");
        if (card) {
            this.resizes.observe(card);
        }
        // At once as well as with the badges, as the render has just written the rows' class attribute afresh.
        this.markScrollers();
        this.alignBadgesSoon();
        // A departure that has left the list takes its popup with it.
        if (this.open && !this.shown.has(this.open)) {
            this.hideDetails();
        }
    }

    /**
     * Held to a height, a stop whose later departures scroll gives them a gutter for the scrollbar and room beside it,
     * and one whose departures fit gives up none. With texts shown in full a narrower row can be a taller one, so rows
     * judged as they are drawn could keep scrolling only because they already did. Every stop is therefore judged at
     * its whole width first, and only one that still scrolls is marked. A stop marked can make the next one scroll, as
     * they share the card's height, so that repeats until no more do.
     */
    private markScrollers(): void {
        const card = this.renderRoot.querySelector<HTMLElement>("ha-card");
        if (!card?.clientWidth) {
            return;
        }
        const scrollers = card.classList.contains("held") ? [...card.querySelectorAll<HTMLElement>("section > .rows")] : [];
        // Rows at their whole width may be shorter than drawn, which scrolls a list near its end back up.
        const scrolled = scrollers.map((rows) => rows.scrollTop);
        card.querySelectorAll(".rows.scrolls").forEach((rows) => rows.classList.remove("scrolls"));
        for (;;) {
            const scrolling = scrollers.filter((rows) => !rows.classList.contains("scrolls") && rows.scrollHeight > rows.clientHeight);
            if (!scrolling.length) {
                break;
            }
            scrolling.forEach((rows) => rows.classList.add("scrolls"));
        }
        scrollers.forEach((rows, index) => {
            if (rows.scrollTop !== scrolled[index]) {
                rows.scrollTop = scrolled[index];
            }
        });
    }

    /**
     * A stop's later departures get badges as wide as its widest, so their destinations line up, as line names such as
     * AY907 and SK9709 differ in width. Measured after every render and every change in the card's size, on the next
     * frame and once however often it is asked. ha-card draws the slot the content sits in only after this card's
     * update, and until then nothing in it has a size. Measured afresh each time, so the badges can also get narrower.
     * A hidden card measures nothing and drops its widths, and measures again when it is shown, as its size changes.
     */
    private alignBadgesSoon(): void {
        cancelAnimationFrame(this.frame ?? 0);
        this.frame = requestAnimationFrame(() => {
            this.alignBadges();
            this.markScrollers();
            this.keepNextDepartures();
            this.fillRows();
        });
    }

    /**
     * On automatic rows in a sections view, the card takes the whole rows its content needs, or the half rows with
     * `row_step: half`, so the cards under it stay on the rows, up to the limit of a card that grows up to one. The content is measured to the end of the card's last
     * part, never by the card's own height, which is at least the rows already taken, and less the room already put under
     * the title, or above the stops without one, as drawn. The room goes under the title, or without one its upper half
     * goes above the stops, which are centred. A card held to a height that leaves less than a row over its content
     * spreads that room the same way. Its stops' box grows to whatever height the card has, so its content ends at the
     * last stop and the attribution under it instead.
     */
    private fillRows(): void {
        const card = this.renderRoot.querySelector<HTMLElement>("ha-card");
        const last = card?.querySelector<HTMLElement>(":scope > .attribution") ?? card?.querySelector<HTMLElement>(":scope > .sections");
        const limit = fillLimit(this.config ?? {}, this.layout, this.minimumHeight());
        const held = !limit && Boolean(heightStyle(this.config ?? {}, this.layout, this.minimumHeight()));
        if (!card || !last || !card.clientWidth || (!limit && !held)) {
            if (this.filled) this.filled = 0;
            if (this.spare) this.spare = 0;
            return;
        }
        const style = getComputedStyle(card);
        const title = card.querySelector<HTMLElement>(":scope > .card-title");
        const sections = card.querySelector<HTMLElement>(":scope > .sections");
        const shown = title
            ? (parseFloat(getComputedStyle(title).marginBottom) || 0) - TITLE_GAP_PX
            : sections
              ? parseFloat(getComputedStyle(sections).marginTop) || 0
              : 0;
        if (held) {
            // To the last stop's end and the attribution under it, as the stops' box grows to the card's height unless
            // the room is spread.
            const scale = drawnScale(card);
            const stop = sections?.querySelector<HTMLElement>(":scope > section:last-of-type") ?? sections;
            const attribution = card.querySelector<HTMLElement>(":scope > .attribution");
            const content =
                ((stop?.getBoundingClientRect().bottom ?? 0) - card.getBoundingClientRect().top) / scale +
                (attribution
                    ? attribution.getBoundingClientRect().height / scale + (parseFloat(getComputedStyle(attribution).marginTop) || 0)
                    : 0) +
                (parseFloat(style.paddingBottom) || 0) +
                (parseFloat(style.borderBottomWidth) || 0) -
                Math.max(0, shown);
            const spare = heldSpare(card.getBoundingClientRect().height / scale, content);
            if (this.filled) this.filled = 0;
            if (spare !== this.spare) this.spare = spare;
            return;
        }
        // The drawn distance unscaled, as the padding and border added to it are the layout's.
        const content =
            (last.getBoundingClientRect().bottom - card.getBoundingClientRect().top) / drawnScale(card) +
            (parseFloat(style.paddingBottom) || 0) +
            (parseFloat(style.borderBottomWidth) || 0) -
            Math.max(0, shown);
        const filled = filledHeight(content, this.config ?? {}, limit);
        const spare = spareRoom(filled, content);
        if (filled !== this.filled) this.filled = filled;
        if (spare !== this.spare) this.spare = spare;
    }

    /**
     * Held to a height, the stops share it, but none is squeezed below its next departure and the first row after it,
     * however much its notices take. That height comes with the data and the width, so it is measured with the badges.
     */
    private keepNextDepartures(): void {
        const held = !!this.renderRoot.querySelector("ha-card.held");
        for (const section of this.renderRoot.querySelectorAll<HTMLElement>("section")) {
            const rows = section.querySelector<HTMLElement>(":scope > .rows");
            const first = rows?.querySelector<HTMLElement>(".row");
            if (held && rows && first) {
                const bottom = section.clientTop + rows.offsetTop + rows.clientTop + first.offsetTop + first.offsetHeight;
                section.style.minHeight = `${bottom}px`;
            } else {
                section.style.removeProperty("min-height");
            }
        }
    }

    private alignBadges(): void {
        for (const rows of this.renderRoot.querySelectorAll<HTMLElement>(".rows")) {
            rows.style.removeProperty("--badge-width");
            // The layout width, not the drawn one, which a dialog opening with a scale animation would shrink. With its
            // fractions and rounded up, so every badge gets exactly the widest one's width.
            const widths = [...rows.querySelectorAll<HTMLElement>(".badge")].map((badge) => parseFloat(getComputedStyle(badge).width) || 0);
            const widest = Math.ceil(Math.max(0, ...widths));
            if (widest > 0) {
                rows.style.setProperty("--badge-width", `${widest}px`);
            }
        }
    }

    protected shouldUpdate(changed: PropertyValues): boolean {
        const previous = changed.get("hass") as HomeAssistant | undefined;
        // The layout decides whether the card is held to a height, so it redraws the card whatever else arrives with it.
        if (changed.has("config") || changed.has("layout") || !this.config || !changed.has("hass") || !previous) {
            return true;
        }
        // Home Assistant hands the card every state change in the house; only its own sensors, the language and the locale
        // (the time zone with it) matter.
        return (
            previous.locale !== this.hass?.locale ||
            previous.language !== this.hass?.language ||
            sectionsOf(this.config.entities).some(({ entity }) => previous.states[entity] !== this.hass?.states[entity])
        );
    }

    protected render(): TemplateResult | typeof nothing {
        if (!this.hass || !this.config) {
            return nothing;
        }
        const sections = sectionsOf(this.config.entities);
        const attributions = [
            ...new Set(sections.map(({ entity }) => this.hass?.states[entity]?.attributes?.attribution).filter((text) => !!text)),
        ];
        const height = heightStyle(this.config, this.layout, this.minimumHeight());
        const attribution = attributions.join(" · ");
        const classes = [
            this.config.full_texts && "full",
            height && "held",
            (this.filled || this.spare) && "filled",
            this.config.title && "titled",
        ]
            .filter(Boolean)
            .join(" ");
        const filled = filledStyle(this.config, this.layout, this.minimumHeight(), this.filled);
        // Without a title the stops are centred, so the upper half of the room goes above them.
        const spare = this.config.title ? this.spare : Math.floor(this.spare / 2);
        const style = spare ? [filled, `--departures-spare: ${spare}px`].filter(Boolean).join("; ") : filled;
        this.shown.clear();
        const stops = this.combines ? this.combined(sections) : sections.map((section) => this.section(section));
        return html`
            <ha-card class=${classes} style=${style}>
                ${this.config.title ? html`<h1 class="card-title" title=${this.config.title}>${this.config.title}</h1>` : nothing}
                ${sections.length === 0 ? html`<div class="message">${this.text("common.no_entities")}</div>` : nothing}
                <div class="sections">${stops}</div>
                ${attribution ? html`<div class="attribution" title=${attribution}>${attribution}</div>` : nothing}
            </ha-card>
            ${this.details()}
        `;
    }

    private section(section: SectionConfig): TemplateResult {
        const entity = this.hass?.states[section.entity];
        const direction = statedDirection(entity);
        // A sensor that says its direction gets it as its subtitle, as an airport's two boards would otherwise read alike.
        const subtitle = section.subtitle || (direction ? this.text(`common.${direction}`) : "");
        const heading = this.heading(this.stopName(section), subtitle, section.entity);
        const problem = this.problem(section.entity, false);
        if (problem || !entity) {
            return html`<section>${heading}${problem}</section>`;
        }
        return this.list(heading, [entity], shownDepartures(section.entity, entity, false), direction === "arrivals");
    }

    /**
     * Every sensor as one list by time, each once however often it is listed. The heading names the stops it shows once
     * each, and their direction when they all state the same one; the sections' own subtitles belong to sections. A sensor
     * that can't be shown has a line of its own saying which and why. Rows say which way they go only when both
     * directions are in the list.
     */
    private combined(sections: SectionConfig[]): TemplateResult {
        const unique = sections.filter((section, index) => sections.findIndex((other) => other.entity === section.entity) === index);
        const problems = unique.map((section) => this.problem(section.entity, true));
        const shown = unique.flatMap((section, index) => {
            const entity = this.hass?.states[section.entity];
            return entity && !problems[index] ? [{ section, entity }] : [];
        });
        const entities = shown.map(({ entity }) => entity);
        const directions = new Set(entities.map((entity) => statedDirection(entity)));
        const [direction] = directions;
        const subtitle = directions.size === 1 && direction ? this.text(`common.${direction}`) : "";
        const names = [...new Set((shown.length ? shown.map(({ section }) => section) : unique).map((section) => this.stopName(section)))];
        const heading = this.heading(names.join(", "), subtitle, (shown[0]?.section ?? unique[0]).entity);
        const departures = shown.flatMap(({ section, entity }) => shownDepartures(section.entity, entity, true));
        const both = new Set(departures.map((departure) => departure.direction)).size > 1;
        if (!shown.length) {
            return html`<section>${heading}${problems}</section>`;
        }
        return this.list(html`${heading}${problems}`, entities, departures, directions.size === 1 && direction === "arrivals", both);
    }

    /** A stop's name: the section's own, the sensor's, or its entity id when it has neither. */
    private stopName(section: SectionConfig): string {
        return section.name || (this.hass?.states[section.entity]?.attributes?.stop_name as string | undefined) || section.entity;
    }

    private heading(name: string, subtitle: string, entityId: string): TemplateResult {
        return html`
            <button class="heading" title="${entityId}" @click=${() => this.moreInfo(entityId)}>
                <span class="name" title=${name}>${name}</span>
                ${subtitle ? html`<span class="subtitle" title=${subtitle}>${subtitle}</span>` : nothing}
            </button>
        `;
    }

    /**
     * What is wrong with a sensor the card can't show, or nothing when it can. In one list the heading doesn't name every
     * sensor, so an unavailable one is named in its message, as a missing one always is.
     */
    private problem(entityId: string, named: boolean): TemplateResult | undefined {
        const entity = this.hass?.states[entityId];
        if (!entity) {
            return html`<div class="message">${this.text("common.no_entity", { entity: entityId })}</div>`;
        }
        if (entity.state === "unavailable") {
            const message = named ? this.text("common.entity_unavailable", { entity: entityId }) : this.text("common.unavailable");
            return html`<div class="message">${message}</div>`;
        }
        if (!isDeparturesSensor(entity)) {
            return html`<div class="message">${this.text("common.not_departures", { entity: entityId })}</div>`;
        }
        return undefined;
    }

    /** A section's notices, its next departure large and the rest as rows. `rowIcons` marks each row's direction. */
    private list(
        heading: TemplateResult,
        entities: HassEntity[],
        departures: ShownDeparture[],
        arrivals: boolean,
        rowIcons = false,
    ): TemplateResult {
        const notices =
            this.config?.show_notices === false ? [] : [...new Set(entities.flatMap((entity) => stopNotices(entity.attributes.notices)))];
        const { next, rest } = visibleDepartures(
            departures,
            Date.now(),
            this.config?.departures ?? DEFAULT_DEPARTURES,
            this.config?.show_cancelled !== false,
        );
        // Ids are unique within a sensor only, and two stops on a route list the same trip. The key names the first
        // sensor shown, so an open popup closes when that sensor drops out.
        const keyOf = (departure: ShownDeparture) => `${entities[0].entity_id}#${departure.key}`;
        for (const departure of next ? [next, ...rest] : rest) {
            this.shown.set(keyOf(departure), departure);
        }
        // What the rows' last column is, when they all call it the same: a gate, a track.
        const labels = new Set(rest.filter(shownPlatform).map((departure) => this.platformLabel(departure)));
        return html`
            <section>
                ${heading}
                ${notices.map(
                    (notice) =>
                        html`<div class="stop-notice" title="${notice}">
                            <ha-icon icon="mdi:alert-outline"></ha-icon><span>${notice}</span>
                        </div>`,
                )}
                ${next ? this.next(next, keyOf(next)) : nothing}
                ${
                    rest.length
                        ? html`<div class="rule">${labels.size === 1 ? html`<span>${[...labels][0]}</span>` : nothing}</div>
                              <div
                                  class="rows ${rest.some((departure) => dayLabel(departure.estimated, Date.now(), this.language(), this.timeZone())) ? "with-days" : ""}"
                              >
                                  ${repeat(
                                      rest,
                                      (departure) => departure.key,
                                      (departure) => this.row(departure, keyOf(departure), rowIcons),
                                  )}
                              </div>`
                        : nothing
                }
                ${
                    !next && !rest.length
                        ? html`<div class="message">${this.text(arrivals ? "common.no_arrivals" : "common.no_departures")}</div>`
                        : nothing
                }
            </section>
        `;
    }

    /**
     * The next departure: what, where to, and how soon, with its delay and gate under its destination. The rest is in
     * its popup, as a later departure's is.
     */
    private next(departure: ShownDeparture, key: string): TemplateResult {
        const minutes = minutesUntil(departure.estimated, Date.now());
        const countdown =
            minutes === null
                ? this.when(departure.estimated)
                : minutes < 1
                  ? this.text("common.now")
                  : html`${minutes}<span class="unit"> ${this.text("common.min")}</span>`;
        // The countdown comes first, as with texts shown in full it floats at the end of the first line.
        return html`
            <button class="next" @click=${(event: Event) => this.showDetails(key, event.currentTarget as HTMLElement)}>
                <span class="countdown">${countdown}</span>
                ${this.badge(departure, "large")}
                <span class="next-text">
                    <span class="headsign" title=${departure.headsign ?? nothing}>${this.destination(departure, true)}</span>
                    <span class="meta">${this.live(departure)}${this.end(departure, true)}</span>
                </span>
            </button>
        `;
    }

    /**
     * A later departure on one line: its time, line and destination, and at its end how late it is and where it
     * leaves from. One that has come in is dimmed. Whatever else it says is in its popup, which its icon tells of.
     */
    private row(departure: ShownDeparture, key: string, icon: boolean): TemplateResult {
        const cancelled = !!departure.cancelled;
        const arrived = !cancelled && !!departure.arrived;
        // The end comes first, as with texts shown in full it floats at the end of the first line.
        return html`
            <button
                class="row ${cancelled ? "cancelled" : ""} ${arrived ? "came-in" : ""}"
                @click=${(event: Event) => this.showDetails(key, event.currentTarget as HTMLElement)}
            >
                ${this.end(departure)}
                <span class="time ${cancelled ? "struck" : ""}">${this.when(cancelled ? departure.scheduled : departure.estimated)}</span>
                ${this.badge(departure, "small")}
                <span class="headsign" title=${departure.headsign ?? nothing}>${this.destination(departure, icon)}</span>
            </button>
        `;
    }

    /**
     * What ends a departure's line: that it is cancelled, or its delay and its gate or track, the numbers without their
     * words. The large departure also says that it is on time, where a row has only its live icon's place to say it in.
     */
    private end(departure: ShownDeparture, large = false): TemplateResult | typeof nothing {
        if (departure.cancelled) {
            return html`<span class="end"><span class="alert">${this.text("common.cancelled")}</span></span>`;
        }
        const minutes = delayMinutes(departure);
        const delay =
            large && departure.realtime && minutes === 0
                ? html`<span class="on-time">${this.text("common.on_time")}</span>`
                : this.delay(minutes);
        const platform = shownPlatform(departure);
        if (delay === nothing && !platform) {
            return nothing;
        }
        return html`<span class="end"
            >${delay}${delay !== nothing && platform ? html`<span class="separator">·</span>` : nothing}${
                platform ? html`<span class="platform">${platform}</span>` : nothing
            }</span
        >`;
    }

    /** A destination with its icon, which stays with its first word when the text wraps. */
    private destination(departure: ShownDeparture, direction: boolean): TemplateResult {
        const [first, ...rest] = (departure.headsign ?? "").split(" ");
        return html`<span class="first">${this.statusIcon(departure, direction)}${first}</span>${rest.length ? ` ${rest.join(" ")}` : ""}`;
    }

    /**
     * Which way a plane or a train goes, in front of its destination or origin: a plane takes off or lands, a train
     * leaves or comes in by a door, as no icon shows a train arriving. Buses and the rest have no direction to show.
     * The icon also tells of what is in the popup: in the accent colour for a departure with a notice, in green for one
     * that has come in. A departure with a notice and no direction icon gets an info sign instead.
     */
    private statusIcon(departure: ShownDeparture, direction: boolean): TemplateResult | typeof nothing {
        const icons = DIRECTION_ICONS[departure.mode];
        const tone = departure.cancelled ? "" : departure.notice ? "noted" : departure.arrived ? "landed" : "";
        if (icons && direction) {
            const arriving = departure.direction === "arrivals";
            return html`<ha-icon
                class="direction ${tone}"
                icon=${arriving ? icons.arriving : icons.departing}
                title=${this.text(arriving ? "common.arriving" : "common.departing")}
            ></ha-icon>`;
        }
        return tone === "noted"
            ? html`<ha-icon class="direction noted" icon="mdi:information-outline" title=${departure.notice ?? ""}></ha-icon>`
            : nothing;
    }

    /** Everything about a departure, in the popup its line opens: what it says in words, its times and where it leaves from. */
    private details(): TemplateResult | typeof nothing {
        if (!hasPopovers()) {
            return nothing;
        }
        const departure = this.open ? this.shown.get(this.open) : undefined;
        return html`<div class="details" popover="auto" @beforetoggle=${this.detailsToggled}>
            ${departure ? this.detailsOf(departure) : nothing}
        </div>`;
    }

    private detailsOf(departure: ShownDeparture): TemplateResult {
        const cancelled = !!departure.cancelled;
        const landed = !cancelled && !!departure.arrived;
        const words: TemplateResult[] = [];
        if (cancelled) {
            words.push(html`<span class="alert">${this.text("common.cancelled")}</span>`);
        }
        if (landed) {
            words.push(html`<span class="arrived">${this.text(departure.mode === "plane" ? "common.landed" : "common.arrived")}</span>`);
        }
        if (departure.notice) {
            words.push(html`<span class=${cancelled ? "alert" : "noted"}>${departure.notice}</span>`);
        }
        return html`
            <div class="details-title">
                ${this.badge(departure, "small")} <span class="headsign">${this.destination(departure, true)}</span>
                <button class="close" title=${this.text("common.close")} aria-label=${this.text("common.close")} @click=${this.hideDetails}>
                    <ha-icon icon="mdi:close"></ha-icon>
                </button>
            </div>
            <dl>
                ${
                    words.length
                        ? html`<dt>${this.text("common.status")}</dt>
                              <dd>${words.map((word, index) => html`${index ? ", " : nothing}${word}`)}</dd>`
                        : nothing
                }
                <dt>${this.text("common.scheduled")}</dt>
                <dd>${this.when(departure.scheduled)}</dd>
                ${
                    !cancelled && departure.realtime
                        ? html`<dt>${this.text("common.estimated")}</dt>
                              <dd>${this.live(departure)} ${this.when(departure.estimated)} ${this.delay(delayMinutes(departure))}</dd>`
                        : nothing
                }
                ${
                    !cancelled && departure.platform
                        ? html`<dt>${this.platformLabel(departure)}</dt>
                              <dd>${departure.platform}</dd>`
                        : nothing
                }
            </dl>
        `;
    }

    /**
     * Opens a departure's popup under its line, or over it when there is no room under. It is in the top layer, so a
     * card held to a height doesn't clip it and nothing in the card moves. Without the Popover API there is no popup.
     */
    private async showDetails(key: string, line: HTMLElement): Promise<void> {
        if (!hasPopovers() || this.dismissed === key) {
            return;
        }
        // From the keyboard nothing has closed the popup before the click, as a pointer does.
        if (this.open === key) {
            this.hideDetails();
            return;
        }
        const showing = this.open !== undefined;
        this.open = key;
        await this.updateComplete;
        const popup = this.renderRoot.querySelector<HTMLElement>(".details");
        const card = this.renderRoot.querySelector<HTMLElement>("ha-card");
        if (!popup || !card) {
            return;
        }
        if (!showing) {
            popup.showPopover();
        }
        const margin = 8;
        const at = line.getBoundingClientRect();
        const width = Math.min(card.getBoundingClientRect().width - 32, 360);
        popup.style.width = `${width}px`;
        popup.style.left = `${Math.max(margin, Math.min(at.left, window.innerWidth - width - margin))}px`;
        const height = popup.offsetHeight;
        const under = at.bottom + 4;
        popup.style.top = `${under + height > window.innerHeight - margin ? Math.max(margin, at.top - height - 4) : under}px`;
        // It stays where it was opened, so it closes when anything scrolls from under it.
        window.addEventListener("scroll", this.hideDetails, { capture: true, passive: true });
    }

    /**
     * A click outside closes the popup before the click itself arrives. One on the popup's own line would open it
     * again, so that line is remembered until the click is over.
     */
    private readonly detailsToggled = (event: Event): void => {
        if ((event as ToggleEvent).newState !== "closed") {
            return;
        }
        window.removeEventListener("scroll", this.hideDetails, true);
        this.dismissed = this.open;
        this.open = undefined;
        setTimeout(() => (this.dismissed = undefined));
    };

    /** A cancelled departure's badge is an outline in the theme's own text colour, which every theme makes readable. */
    private badge(departure: Departure, size: "large" | "small"): TemplateResult {
        if (departure.cancelled) {
            return html`<span class="badge ${size} cancelled">${this.lineName(departure)}</span>`;
        }
        const colors = badgeColors(departure);
        return html`<span class="badge ${size}" style="background:${colors.background};color:${colors.text}"
            >${this.lineName(departure)}</span
        >`;
    }

    /** A line with no name of its own, such as a rural route known only by its stops, shows its mode's icon. */
    private lineName(departure: Departure): TemplateResult {
        const line = departure.line.trim();
        if (line) {
            return html`<span class="line">${line}</span>`;
        }
        return html`<span class="line icon"><ha-icon icon=${MODE_ICONS[departure.mode] ?? MODE_ICONS.other}></ha-icon></span>`;
    }

    private live(departure: Departure): TemplateResult | typeof nothing {
        return departure.realtime
            ? html`<ha-icon class="live" icon="mdi:access-point" title="${this.text("common.realtime")}"></ha-icon>`
            : nothing;
    }

    private delay(minutes: number): TemplateResult | typeof nothing {
        if (minutes === 0) {
            return nothing;
        }
        return html`<span class="${minutes > 0 ? "late" : "early"}"
            >${minutes > 0 ? "+" : "−"}${Math.abs(minutes)} ${this.text("common.min")}</span
        >`;
    }

    /** A train leaves from a track, a plane from a gate and lands into a hall, a ship from a berth, everything else from a platform. */
    private platformLabel(departure: ShownDeparture): string {
        const labels: Record<string, string> = {
            train: "common.track",
            plane: departure.direction === "arrivals" ? "common.hall" : "common.gate",
            ferry: "common.berth",
            ship: "common.berth",
        };
        return this.text(labels[departure.mode] ?? "common.platform");
    }

    /** A clock time, with its day in front when it isn't today: "ma 06.15". */
    private when(time: string): TemplateResult {
        const day = dayLabel(time, Date.now(), this.language(), this.timeZone());
        return html`${day ? html`<span class="day">${day}</span> ` : nothing}${this.clock(time)}`;
    }

    private timeZone(): string | undefined {
        return this.hass?.locale?.time_zone === "server" ? this.hass.config?.time_zone : undefined;
    }

    private clock(time: string): string {
        return clock(time, this.language(), this.timeZone());
    }

    private moreInfo(entityId: string): void {
        this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
    }

    /** A text in the viewer's language, with `{name}` in it replaced, so a translation can put the value where it reads right. */
    private text(key: string, values: Record<string, string> = {}): string {
        return translate(this.language(), key).replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
    }

    private language(): string {
        return this.hass?.locale?.language ?? this.hass?.language ?? browserLanguage();
    }

    static get styles(): CSSResultGroup {
        return [
            css`
                /* The card is the container its sections measure, so two stops sit side by side by the card's own width. A query
                   measures its content box, 34 px narrower than the card, so 586 px is a card of 620. */
                ha-card {
                    /* ha-card's own transition covers every property, so a change in the rows filled would animate. */
                    transition: none;
                    container-type: inline-size;
                    padding: 16px;
                    font-variant-numeric: tabular-nums;
                }

                /*
                 * The heights step in units of 32 px, half a row of a sections view (56 px and an 8 px gap): each later
                 * departure 32, the title 32 and each stop under another 128. The card ends on a half row or a whole one by
                 * its content, and fillRows rounds it to whole rows unless row_step is half. The room that leaves goes under
                 * the title, or without one its upper half goes above the stops.
                 */
                .card-title {
                    margin: 0 0 calc(4px + var(--departures-spare, 0px));
                    font-size: var(--ha-card-header-font-size, 24px);
                    font-weight: var(--ha-font-weight-normal, 400);
                    line-height: 28px;
                }

                .sections {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                }

                ha-card:not(.titled) > .sections {
                    margin-top: var(--departures-spare, 0px);
                }

                section + section {
                    border-top: 1px solid var(--divider-color);
                    margin-top: 18px;
                    padding-top: 18px;
                }

                @container (min-width: 586px) {
                    .sections:has(section + section) {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        column-gap: 32px;
                    }

                    section + section {
                        border-top: none;
                        margin-top: 0;
                        padding-top: 0;
                    }

                    section:nth-child(2n) {
                        border-inline-start: 1px solid var(--divider-color);
                        margin-inline-start: -16px;
                        padding-inline-start: 16px;
                    }

                    section:nth-child(n + 3) {
                        border-top: 1px solid var(--divider-color);
                        margin-top: 18px;
                        padding-top: 18px;
                    }
                }

                .heading {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: baseline;
                    gap: 0 8px;
                    min-width: 0;
                    max-width: 100%;
                    padding: 0;
                    border: none;
                    background: none;
                    color: inherit;
                    font: inherit;
                    line-height: 20px;
                    text-align: start;
                    cursor: pointer;
                }

                .name {
                    font-size: 14px;
                    font-weight: var(--ha-font-weight-medium, 500);
                    overflow-wrap: anywhere;
                }

                .subtitle,
                .message,
                .attribution {
                    color: var(--secondary-text-color);
                }

                /* A secondary text, cut short unless full_texts asks for it whole. */
                .subtitle {
                    min-width: 0;
                    font-size: 14px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .full .subtitle {
                    white-space: normal;
                    overflow-wrap: anywhere;
                }

                .message {
                    padding: 8px 0 4px;
                }

                /* A departure's line is a button that opens its popup. */
                .next,
                .row {
                    width: 100%;
                    border: none;
                    background: none;
                    color: inherit;
                    font: inherit;
                    text-align: start;
                    cursor: pointer;
                }

                /* Under the pointer a line is lit with the same 4 px around its text on every side, so the light reaches into
                   the card's padding at the sides, and stops 2 px short of the row above and below, clear of the divider's
                   label. Keyboard focus rings the same shape. */
                .next,
                .row {
                    position: relative;
                    isolation: isolate;
                }

                :is(.next, .row)::before {
                    content: "";
                    position: absolute;
                    z-index: -1;
                    inset: 2px -4px;
                    border-radius: 8px;
                }

                .next::before {
                    inset: -4px;
                }

                @media (hover: hover) {
                    :is(.next, .row):hover::before {
                        background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
                    }
                }

                :is(.next, .row):focus-visible {
                    outline: none;
                }

                :is(.next, .row):focus-visible::before {
                    outline: 2px solid var(--primary-color);
                }

                /* The next departure is always 44 px: its destination is cut short rather than moved to a line of its own, so
                   the card's height never comes from what a departure says. */
                .next {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-top: 10px;
                    padding: 0;
                }

                .next .countdown {
                    order: 1;
                }

                .next-text {
                    flex: 1;
                    min-width: 0;
                }

                .next .headsign {
                    display: block;
                    font-size: 20px;
                    font-weight: var(--ha-font-weight-medium, 500);
                    line-height: 26px;
                }

                ha-card:not(.full) :is(.next, .row) .headsign {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .first {
                    white-space: nowrap;
                }

                /* As tall with nothing to say, so the large departure's height doesn't follow its data. */
                .meta {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-height: 18px;
                    line-height: 18px;
                }

                /* A line's end: how late it is and where it leaves from, never cut. Its own line height, so its two sizes of
                   text on one baseline are no taller than the line they end. */
                .end {
                    flex: none;
                    display: flex;
                    align-items: baseline;
                    gap: 5px;
                    font-size: 12px;
                    line-height: 16px;
                    white-space: nowrap;
                }

                .meta .end {
                    font-size: 13px;
                    line-height: 18px;
                }

                .end .platform {
                    font-size: 13px;
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                .separator {
                    color: var(--secondary-text-color);
                }

                /*
                 * With texts shown in full, a destination that doesn't fit beside the rest of its line takes the next line
                 * whole, and wraps only when it is longer than that. Nothing is measured: the line's end floats at the right
                 * of the first line and the destination is a block in the text's flow, so it goes under by itself when the
                 * first line has no room for it.
                 */
                .full .next {
                    display: flow-root;
                    line-height: 44px;
                }

                .full .next > * {
                    line-height: normal;
                }

                .full .next .countdown {
                    float: inline-end;
                    margin-inline-start: 14px;
                    line-height: 44px;
                }

                .full .next .badge.large {
                    display: inline-block;
                    margin-inline-end: 14px;
                    vertical-align: middle;
                }

                .full .next-text {
                    display: inline-block;
                    max-width: 100%;
                    vertical-align: middle;
                }

                .full :is(.next, .row) .headsign {
                    overflow-wrap: break-word;
                }

                .countdown {
                    flex: none;
                    font-size: 32px;
                    font-weight: var(--ha-font-weight-bold, 700);
                    line-height: 1.1;
                    white-space: nowrap;
                }

                /* Its own line height, so the smaller text doesn't make the countdown's line taller. */
                .unit {
                    line-height: 1;
                    font-size: 16px;
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                /* A line known by a long name rather than a number wraps inside its badge at its spaces. A word never splits:
               the badge is at least as wide as its longest word, as a flight number cut in two reads as another flight. */
                .badge {
                    flex: none;
                    box-sizing: border-box;
                    min-width: min-content;
                    max-width: 40cqw;
                    text-align: center;
                    font-weight: var(--ha-font-weight-bold, 700);
                    overflow-wrap: break-word;
                }

                .badge .line {
                    display: inline-block;
                    min-width: 24px;
                }

                /* As tall as a line of the badge's text and centred in it, so a badge with an icon is the same height as the
                   ones with a number, the large one's line being taller than the icon. A line box around the icon, its own on
                   the baseline or ha-icon's around the inline svg, would add room for descenders. */
                .badge .line.icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    height: 1lh;
                    vertical-align: top;
                }

                .badge .line ha-icon {
                    display: flex;
                    --mdc-icon-size: 18px;
                }

                /* A number centred by its capitals rather than by the font's line box, which leaves room for descenders under
                   it. Trimmed to the capitals, the padding puts back exactly the room trimmed, so the badge keeps its height, and
                   the top is rounded down to a whole pixel, so every badge's number rounds the same way. Without text-box the
                   padding would only add to the line, so it waits for support. On the badge's baseline the trimmed number would
                   sit lower in the badge's own line, which would grow by it, so it hangs from the top as the icon does. */
                @supports (text-box: trim-both cap alphabetic) {
                    .badge .line:not(.icon) {
                        vertical-align: top;
                        text-box: trim-both cap alphabetic;
                        padding-top: round(down, (1lh - 1cap) / 2, 1px);
                        padding-bottom: calc(1lh - 1cap - round(down, (1lh - 1cap) / 2, 1px));
                    }
                }

                .badge.large {
                    padding: 6px 10px;
                    border-radius: 10px;
                    font-size: 18px;
                }

                .badge.small {
                    padding: 1px 6px;
                    border-radius: 8px;
                    font-size: 13px;
                    line-height: 18px;
                }

                .rows .badge.small {
                    min-width: var(--badge-width, min-content);
                }

                /* The divider over the later departures stops short of the card's edge when their last column has a name,
                   such as Gate or Track, which ends its line. */
                .rule {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    height: 1px;
                    margin-top: 12px;
                    font-size: 11px;
                    line-height: 1;
                    color: var(--secondary-text-color);
                }

                .rule::before {
                    content: "";
                    flex: 1;
                    height: 1px;
                    background: var(--divider-color);
                }

                .rows {
                    padding-top: 4px;
                }

                /* A later departure is always one line, 32 px, with its destination taking the room left and cut short when
                   it is longer. */
                .row {
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-height: 32px;
                    padding: 6px 0;
                    font-size: 14px;
                    line-height: 20px;
                }

                .row .end {
                    order: 1;
                }

                .time {
                    flex: none;
                    min-width: 44px;
                    font-weight: var(--ha-font-weight-bold, 700);
                    white-space: nowrap;
                }

                /* The day in front of a time that isn't today: quieter than the time, but there. Its own line height, so the
                   smaller text doesn't make its row taller. */
                .day {
                    line-height: 1;
                    font-size: 0.75em;
                    font-weight: var(--ha-font-weight-medium, 500);
                    color: var(--secondary-text-color);
                }

                .rows.with-days .time {
                    min-width: 72px;
                }

                .row .headsign {
                    flex: 1 1 auto;
                    min-width: 0;
                }

                .full .row {
                    display: flow-root;
                }

                .full .row .end {
                    float: inline-end;
                    margin-inline-start: 10px;
                    height: 20px;
                    align-items: center;
                }

                .full .row :is(.time, .badge) {
                    display: inline-block;
                    margin-inline-end: 10px;
                    vertical-align: top;
                }

                .full .row .headsign {
                    display: inline-block;
                    max-width: 100%;
                    vertical-align: top;
                }

                /* A departure's popup, in the top layer over the page, placed by showDetails. */
                .details {
                    box-sizing: border-box;
                    inset: auto;
                    margin: 0;
                    padding: 12px 14px;
                    border: 1px solid var(--divider-color);
                    border-radius: 12px;
                    /* The card's colour over the page's, as a theme's card may be see-through and the popup lies over rows. */
                    background:
                        linear-gradient(var(--ha-card-background, var(--card-background-color, #fff)) 0 0),
                        var(--primary-background-color, #fff);
                    color: var(--primary-text-color);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
                    font-size: 13px;
                    line-height: 20px;
                    font-variant-numeric: tabular-nums;
                }

                .details-title {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    margin-bottom: 6px;
                    font-size: 15px;
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                .details-title .headsign {
                    flex: 1;
                    min-width: 0;
                    overflow-wrap: break-word;
                }

                .close {
                    --mdc-icon-size: 18px;
                    display: flex;
                    margin: -4px -6px 0 0;
                    padding: 4px;
                    border: 0;
                    border-radius: 50%;
                    background: none;
                    color: var(--secondary-text-color);
                    cursor: pointer;
                }

                .close:hover,
                .close:focus-visible {
                    background: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
                    color: var(--primary-text-color);
                    outline: none;
                }

                .details dl {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr);
                    gap: 0 12px;
                    margin: 0;
                }

                .details dt {
                    color: var(--secondary-text-color);
                }

                .details dd {
                    margin: 0;
                    overflow-wrap: break-word;
                }

                .details .live {
                    vertical-align: -2px;
                }

                .late,
                .early,
                .on-time {
                    white-space: nowrap;
                }

                .on-time {
                    color: var(--success-color, #2e7d32);
                }

                .row.cancelled .headsign,
                .row.cancelled .time,
                .row.came-in .headsign,
                .row.came-in .time {
                    color: var(--secondary-text-color);
                }

                /* A cancelled line's badge is a ring in the theme's own text colours, readable on any card, light or dark. */
                .badge.cancelled {
                    background: none;
                    color: var(--secondary-text-color);
                    box-shadow: inset 0 0 0 2px var(--secondary-text-color);
                }

                .row.came-in .badge {
                    opacity: 0.55;
                }

                /* One that has come in is good news, not a problem, so not in a notice's red. */
                .arrived {
                    color: var(--success-color, #2e7d32);
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                /* A direction icon is a size larger than the text around it, so its arrow reads at a glance. */
                .direction {
                    --mdc-icon-size: 17px;
                    width: 17px;
                    height: 17px;
                    display: inline-flex;
                    vertical-align: -3px;
                    margin-inline-end: 4px;
                    color: var(--secondary-text-color);
                }

                /* A departure with a notice in its popup, and one that has come in. */
                .direction.noted,
                .noted {
                    color: var(--primary-color);
                }

                .noted {
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                .direction.landed {
                    color: var(--success-color, #2e7d32);
                }

                .next .direction {
                    --mdc-icon-size: 21px;
                    width: 21px;
                    height: 21px;
                }

                .struck {
                    text-decoration: line-through;
                }

                .live {
                    --mdc-icon-size: 14px;
                    width: 14px;
                    height: 14px;
                    display: inline-flex;
                    color: var(--success-color, #2e7d32);
                }

                .late {
                    color: var(--warning-color, #b45309);
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                .early {
                    color: var(--success-color, #2e7d32);
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                .alert {
                    color: var(--error-color, #c62828);
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                /* A notice for the whole stop, such as track works, takes one line, 32 px with its margin, cut short unless
                   full_texts asks for it whole. Its tooltip has it in full. */
                .stop-notice {
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                    margin-top: 4px;
                    padding: 4px 8px;
                    border-radius: 8px;
                    font-size: 13px;
                    line-height: 20px;
                    color: var(--primary-text-color);
                    background: rgba(var(--rgb-warning-color, 255, 166, 0), 0.12);
                }

                .stop-notice span {
                    min-width: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .full .stop-notice span {
                    white-space: normal;
                    overflow-wrap: anywhere;
                }

                /* A flex box, as the inline-flex ha-svg-icon inside it would otherwise sit on a 20 px line of its own and
                   drop 2.5 px. The margin centres the triangle on the capitals, which sit 1 px above the line's middle. */
                .stop-notice ha-icon {
                    --mdc-icon-size: 16px;
                    display: flex;
                    flex: none;
                    width: 16px;
                    height: 16px;
                    margin-top: 1px;
                    color: var(--warning-color, #b45309);
                }

                .attribution {
                    margin-top: 12px;
                    font-size: 11px;
                    line-height: 15px;
                    text-align: end;
                }

                /*
             * Held to a height, the card is a column whose title and attribution stay put. The stops share what is left
             * as rows of their grid, each a column of its own whose heading, notices and next departure stay put while
             * only its later departures scroll. A stop's measured minimum keeps those and one row in view.
             */
                ha-card.held {
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .held .card-title,
                .held .attribution {
                    flex: none;
                }

                /* Held, the title and the attribution keep to one line, cut short when longer, so the minimum holds at any width. */
                .held:not(.full) .card-title,
                .held:not(.full) .attribution {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* The stops are clipped by height only, as a lit line reaches past their sides. */
                .held .sections {
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow-y: clip;
                    align-content: start;
                }

                /* Filling its rows up to a limit, or held with less than a row to spare, the stops shrink but never grow, as
                   the room left over goes under the title and fillRows would otherwise measure it as content, keeping the
                   card from ever shrinking. */
                .held.filled .sections {
                    flex-grow: 0;
                }

                .held section {
                    position: relative;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow-y: clip;
                }

                /* A stop without later departures has nothing to scroll and keeps its height. */
                .held section:not(:has(> .rows)) {
                    min-height: auto;
                    overflow: visible;
                }

                /* Nothing in a stop shrinks. */
                .held section > * {
                    flex: none;
                }

                .held .heading {
                    align-self: flex-start;
                }

                /* Held, a stop's heading keeps to one line too, its name and subtitle cut short when they don't fit. */
                .held:not(.full) .heading {
                    flex-wrap: nowrap;
                }

                .held:not(.full) .name {
                    min-width: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Inside the card, as a held stop clips what is drawn outside it. */
                .heading:focus-visible {
                    outline: 2px solid var(--primary-color);
                    outline-offset: -2px;
                }

                /* A scroller clips at its sides too, so it is 4 px wider each way, for a lit line. */
                .held section > .rows {
                    margin-inline: -4px;
                    padding-inline: 4px;
                    position: relative;
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow-y: auto;
                    scrollbar-width: thin;
                }

                /* Room between the rows and the scrollbar, and the scrollbar's gutter, only for a stop whose rows scroll, which
                   markScrollers marks. */
                .held section > .rows.scrolls {
                    padding-inline-end: 8px;
                    scrollbar-gutter: stable;
                }
            `,
            fadeStyles,
        ];
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "departures-card": DeparturesCard;
    }
}
