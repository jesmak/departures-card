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

import { CARD_VERSION, DEFAULT_DEPARTURES, TICK_MS } from "./const";
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
import { ScrollFade, fadeStyles } from "./fade";
import type { HassEntity, HomeAssistant } from "./hass";
import { gridMinRows, heightCardSize, heightStyle, validHeight } from "./height";
import { browserLanguage, translate } from "./localize/localize";
import type { Departure, DeparturesCardConfig, SectionConfig, ShownDeparture } from "./types";

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
    private ticker?: ReturnType<typeof setInterval>;
    private readonly resizes = new ResizeObserver(() => this.alignBadgesSoon());
    private frame?: number;

    constructor() {
        super();
        // Fades the edges of each stop's later departures while the card is held to a height, through the card's own lifecycle.
        new ScrollFade(this, () =>
            this.renderRoot.querySelector("ha-card.held") ? this.renderRoot.querySelectorAll<HTMLElement>("section > .rows") : [],
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
        if (!config || !Array.isArray(entities) || sectionsOf(entities).length === 0) {
            throw new Error(translate(browserLanguage(), "common.invalid_configuration"));
        }
        // An empty `departures:` in YAML is null, the default as a missing one is.
        if (config.departures != null && !(Number.isInteger(config.departures) && config.departures >= 1)) {
            throw new Error(translate(browserLanguage(), "common.invalid_departures"));
        }
        if (!validHeight(config)) {
            throw new Error(translate(browserLanguage(), "common.invalid_height"));
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
     * In a sections view the card takes a whole section by default and is never narrower than three quarters of one,
     * where a line's badge and a departure's time still fit side by side.
     */
    public getGridOptions(): Record<string, unknown> {
        return { columns: 12, min_columns: 9, rows: "auto", min_rows: gridMinRows(this.minimumHeight()) };
    }

    /**
     * Held to a height, the title, the attribution and every stop's heading, which a held card keeps to one line each,
     * and every stop's next departure and first row after it still fit, laid out as on a narrow card with the stops one
     * above the other. A section can be narrower than 400 px at any column count, on a phone, so the narrow layout is the
     * one counted. Notices, texts shown in full, the line about a sensor that can't be shown and a long line name
     * wrapping on a card narrower than a section allows come with the data, so they aren't counted.
     */
    private minimumHeight(): number {
        if (!this.config) {
            return 0;
        }
        const borderAndPadding = 34;
        const title = this.config.title ? 32 : 0;
        const attribution = 27;
        // The heading and the next departure, whose destination takes a line of its own on a narrow card.
        const next = 106;
        // The first row after it, on its two lines.
        const row = (this.config.departures ?? DEFAULT_DEPARTURES) > 1 ? 81 : 0;
        const divider = 37;
        const stops = this.combines ? 1 : sectionsOf(this.config.entities).length;
        return borderAndPadding + title + attribution + stops * (next + row) + (stops - 1) * divider;
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
        this.markScrolling();
        this.alignBadgesSoon();
    }

    /**
     * Marks the later departures that run past their height, which gives them room from the scrollbar. Worked out after
     * every render and change in size, not while they scroll, so the room can't come and go with the scrolling. The room
     * only makes the rows narrower, so it never takes away the overflow that brought it.
     */
    private markScrolling(): void {
        for (const rows of this.renderRoot.querySelectorAll<HTMLElement>("ha-card.held section > .rows")) {
            rows.classList.toggle("scrolls", rows.scrollHeight - rows.clientHeight > 1);
        }
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
            this.keepNextDepartures();
            this.markScrolling();
        });
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
        return html`
            <ha-card class="${this.config.full_texts ? "full" : ""} ${height ? "held" : ""}" style=${height}>
                ${this.config.title ? html`<h1 class="card-title" title=${this.config.title}>${this.config.title}</h1>` : nothing}
                <div class="sections">${this.combines ? this.combined(sections) : sections.map((section) => this.section(section))}</div>
                ${attribution ? html`<div class="attribution" title=${attribution}>${attribution}</div>` : nothing}
            </ha-card>
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
        return html`
            <section>
                ${heading}
                ${notices.map(
                    (notice) =>
                        html`<div class="stop-notice" title="${notice}">
                            <ha-icon icon="mdi:alert-outline"></ha-icon><span>${notice}</span>
                        </div>`,
                )}
                ${next ? this.next(next) : nothing}
                ${
                    rest.length
                        ? html`<div
                              class="rows ${rest.some((departure) => dayLabel(departure.estimated, Date.now(), this.language(), this.timeZone())) ? "with-days" : ""}"
                          >
                              ${repeat(
                                  rest,
                                  (departure) => departure.key,
                                  (departure) => this.row(departure, rowIcons),
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

    /** The next departure: what, where to, and how soon, with the live time, delay and platform under it. */
    private next(departure: ShownDeparture): TemplateResult {
        const minutes = minutesUntil(departure.estimated, Date.now());
        const delay = delayMinutes(departure);
        const countdown =
            minutes === null
                ? this.when(departure.estimated)
                : minutes < 1
                  ? this.text("common.now")
                  : html`${minutes}<span class="unit"> ${this.text("common.min")}</span>`;
        return html`
            <div class="next">
                ${this.badge(departure, "large")}
                <div class="next-text">
                    <div class="headsign" title=${departure.headsign ?? nothing}>
                        ${this.directionIcon(departure)}${departure.headsign ?? ""}
                    </div>
                    <div class="meta">
                        ${this.live(departure)}
                        ${delay !== 0 ? html`<span class="struck">${this.when(departure.scheduled)}</span>` : nothing}
                        ${minutes !== null ? html`<span>${this.when(departure.estimated)}</span>` : nothing} ${this.delay(delay)}
                        ${this.platform(departure)}
                        ${departure.notice ? html`<span class="notice" title="${departure.notice}">${departure.notice}</span>` : nothing}
                    </div>
                </div>
                <div class="countdown">${countdown}</div>
            </div>
        `;
    }

    /**
     * A later departure on one line: its time, line and destination, and whatever is out of the ordinary. One that has
     * come in shows when, dimmed, and says so in its own words, as its source leaves that to the card, with its delay and
     * any other notice.
     */
    private row(departure: ShownDeparture, icon: boolean): TemplateResult {
        const cancelled = !!departure.cancelled;
        const arrived = !cancelled && !!departure.arrived;
        const delay = delayMinutes(departure);
        // The words, apart from the numbers, so a narrow card can put them on the first line and the numbers on the second.
        let info: TemplateResult;
        if (cancelled) {
            const text = [this.text("common.cancelled"), departure.notice].filter(Boolean).join(", ");
            info = html`<span class="status" title="${text}"><span class="alert">${text}</span></span>`;
        } else {
            const landed = arrived ? this.text(departure.mode === "plane" ? "common.landed" : "common.arrived") : "";
            const text = [landed, departure.notice].filter(Boolean).join(", ");
            info = html`${this.delay(delay)}
            ${
                text
                    ? html`<span class="status" title="${text}"
                          >${landed ? html`<span class="arrived">${landed}</span>` : nothing}
                          ${departure.notice ? html`<span class="alert">${departure.notice}</span>` : nothing}</span
                      >`
                    : nothing
            }
            ${this.platform(departure)}`;
        }
        return html`
            <div class="row ${cancelled ? "cancelled" : ""} ${arrived ? "came-in" : ""}">
                <span class="time ${cancelled ? "struck" : ""}">${this.when(cancelled ? departure.scheduled : departure.estimated)}</span>
                ${this.badge(departure, "small")}
                <span class="headsign" title="${departure.headsign ?? ""}"
                    >${icon ? this.directionIcon(departure) : nothing}${departure.headsign ?? ""}</span
                >
                <span class="info">${info}</span>
            </div>
        `;
    }

    /**
     * Which way a plane or a train goes, in front of its destination or origin: a plane takes off or lands, a train
     * leaves or comes in by a door, as no icon shows a train arriving. Buses and the rest have no direction to show.
     */
    private directionIcon(departure: ShownDeparture): TemplateResult | typeof nothing {
        const icons = DIRECTION_ICONS[departure.mode];
        if (!icons) {
            return nothing;
        }
        const arriving = departure.direction === "arrivals";
        return html`<ha-icon
            class="direction"
            icon=${arriving ? icons.arriving : icons.departing}
            title=${this.text(arriving ? "common.arriving" : "common.departing")}
        ></ha-icon>`;
    }

    /** A cancelled departure's badge is an outline in the theme's own text colour, which every theme makes readable. */
    private badge(departure: Departure, size: "large" | "small"): TemplateResult {
        if (departure.cancelled) {
            return html`<span class="badge ${size} cancelled"><span class="line">${departure.line}</span></span>`;
        }
        const colors = badgeColors(departure);
        return html`<span class="badge ${size}" style="background:${colors.background};color:${colors.text}"
            ><span class="line">${departure.line}</span></span
        >`;
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

    /** A train leaves from a track, a plane from a gate and lands into a hall, everything else from a platform. */
    private platform(departure: ShownDeparture): TemplateResult | typeof nothing {
        if (!departure.platform) {
            return nothing;
        }
        const plane = departure.direction === "arrivals" ? "common.hall" : "common.gate";
        const label = this.text(departure.mode === "train" ? "common.track" : departure.mode === "plane" ? plane : "common.platform");
        return html`<span class="platform">${label} ${departure.platform}</span>`;
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
                /* The card is the container its sections measure, so two stops sit side by side by the card's own width. */
                ha-card {
                    container-type: inline-size;
                    padding: 16px;
                    font-variant-numeric: tabular-nums;
                }

                /*
                 * The heights step in units of 32 px, half a row of a sections view (56 px and an 8 px gap), so the card
                 * fills whole grid rows: with no title, a stop and its next departure take 150 px with the padding and the
                 * attribution, each later departure 32, the title 32 and each stop under another 128.
                 */
                .card-title {
                    margin: 0 0 4px;
                    font-size: var(--ha-card-header-font-size, 24px);
                    font-weight: var(--ha-font-weight-normal, 400);
                    line-height: 28px;
                }

                .sections {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                }

                section + section {
                    border-top: 1px solid var(--divider-color);
                    margin-top: 18px;
                    padding-top: 18px;
                }

                @container (min-width: 620px) {
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
                        border-left: 1px solid var(--divider-color);
                        margin-left: -16px;
                        padding-left: 16px;
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
                    text-align: left;
                    cursor: pointer;
                }

                .name {
                    font-size: 14px;
                    font-weight: var(--ha-font-weight-medium, 500);
                    overflow-wrap: anywhere;
                }

                .subtitle,
                .message,
                .meta,
                .attribution,
                .platform {
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

                .next {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-top: 10px;
                }

                .next-text {
                    flex: 1;
                    min-width: 0;
                }

                .next .headsign {
                    font-size: 20px;
                    font-weight: var(--ha-font-weight-medium, 500);
                    line-height: 26px;
                }

                /* The large destination keeps to one line, so the next departure is always as tall, unless texts are shown in full. */
                ha-card:not(.full) .next .headsign {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .headsign {
                    overflow-wrap: anywhere;
                }

                /* On a narrow card the large departure's destination takes a line of its own, under the badge and countdown,
                   which together take 32 px more than the wide layout. */
                @container (max-width: 399px) {
                    .next {
                        flex-wrap: wrap;
                        row-gap: 0;
                    }

                    .next-text {
                        order: 3;
                        flex-basis: 100%;
                    }

                    .next .badge.large {
                        padding-block: 4px;
                        line-height: 24px;
                    }

                    .next .countdown {
                        margin-left: auto;
                        line-height: 32px;
                    }
                }

                /* The departure's own notice ends the line and is cut short, so the next departure is always two lines high. */
                .meta {
                    display: flex;
                    align-items: center;
                    gap: 4px 6px;
                    font-size: 13px;
                    line-height: 18px;
                }

                .meta .notice {
                    flex: 1 1 0;
                    min-width: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .full .meta .notice {
                    flex-basis: auto;
                    white-space: normal;
                    overflow-wrap: anywhere;
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

                .rows {
                    margin-top: 12px;
                    padding-top: 4px;
                    border-top: 1px solid var(--divider-color);
                }

                /* A row stays on one line while its destination has room, and moves what doesn't fit to the next. */
                .row {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 2px 10px;
                    padding: 6px 0;
                    font-size: 14px;
                    line-height: 20px;
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

                /* Below 100 px the destination takes the next line, or a short one such as Pasila would sit squeezed between them. */
                .row .headsign {
                    flex: 1 1 100px;
                    min-width: 0;
                }

                .info {
                    flex: 0 1 auto;
                    min-width: 0;
                    margin-left: auto;
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 2px 6px;
                    font-size: 12px;
                }

                /* What a row says in words: that it has come in, or its notice. Cut short, with the whole in its tooltip. */
                .status {
                    display: inline-flex;
                    align-items: center;
                    gap: 2px 6px;
                    min-width: 0;
                }

                .full .status {
                    flex-wrap: wrap;
                }

                /*
                 * On a narrow card every later departure takes two lines, 64 px, whatever it shows: its time, line and what it
                 * says in words on the first, and its destination with its delay and track under them. The words and the
                 * destination are cut short, as the numbers never are, unless full_texts asks for them whole and lets them
                 * wrap. A delay or a long destination would otherwise make some rows taller than others as the data changes.
                 */
                /* The info box gives up its parts to the row, and an empty item as wide as the row breaks it into its two lines,
                   each with the row's whole width. */
                @container (max-width: 399px) {
                    .row {
                        gap: 0 6px;
                        padding: 10px 0;
                    }

                    .row::after {
                        content: "";
                        order: 4;
                        flex-basis: 100%;
                    }

                    .row .info {
                        display: contents;
                    }

                    .row .time {
                        order: 1;
                        margin-right: 4px;
                    }

                    .row .badge {
                        order: 2;
                        margin-right: 4px;
                    }

                    .row .status {
                        order: 3;
                        flex: 1 1 0;
                        justify-content: flex-end;
                    }

                    .row .status .alert,
                    .row .status .arrived {
                        min-width: 0;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .row .headsign {
                        order: 5;
                        flex: 1 1 0;
                        margin-top: 4px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    .row :is(.late, .early) {
                        order: 6;
                        margin-top: 4px;
                    }

                    .row .platform {
                        order: 7;
                        margin-top: 4px;
                    }

                    .full .row .headsign,
                    .full .row .status .alert,
                    .full .row .status .arrived {
                        white-space: normal;
                        overflow-wrap: anywhere;
                    }
                }

                /* Numbers stay whole: a track cut short is another track. */
                .platform,
                .late,
                .early {
                    white-space: nowrap;
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
                    margin-right: 4px;
                    color: var(--secondary-text-color);
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

                .alert,
                .notice {
                    color: var(--error-color, #c62828);
                    font-weight: var(--ha-font-weight-medium, 500);
                }

                .notice {
                    font-size: 13px;
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

                .stop-notice ha-icon {
                    --mdc-icon-size: 16px;
                    flex: none;
                    width: 16px;
                    height: 16px;
                    margin-top: 2px;
                    color: var(--warning-color, #b45309);
                }

                /* A row's notice is a secondary text, cut short unless full_texts asks for it whole. */
                .info .alert {
                    min-width: 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .full .info .alert {
                    white-space: normal;
                    overflow-wrap: anywhere;
                }

                .attribution {
                    margin-top: 12px;
                    font-size: 11px;
                    line-height: 15px;
                    text-align: right;
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

                .held .sections {
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow: hidden;
                    align-content: start;
                }

                .held section {
                    position: relative;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    overflow: hidden;
                }

                /* A stop without later departures has nothing to scroll and keeps its height. */
                .held section:not(:has(> .rows)) {
                    min-height: auto;
                    overflow: visible;
                }

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

                /* The top fade starts under the rows' own top border, so it doesn't erase it. */
                .held section > .rows {
                    --fade-top-offset: 1px;
                    position: relative;
                    flex: 1 1 auto;
                    min-height: 0;
                    overflow-y: auto;
                    scrollbar-width: thin;
                }

                /* Room between the rows and the scrollbar, only while there is something to scroll. */
                .held section > .rows.scrolls {
                    padding-right: 8px;
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
