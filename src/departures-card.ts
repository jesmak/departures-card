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
import type { HassEntity, HomeAssistant } from "./hass";
import { browserLanguage, translate } from "./localize/localize";
import type { Departure, DeparturesCardConfig, SectionConfig, ShownDeparture } from "./types";

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
    @state() private config?: DeparturesCardConfig;
    private ticker?: ReturnType<typeof setInterval>;
    private readonly resizes = new ResizeObserver(() => this.alignBadgesSoon());
    private frame?: number;

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
        this.config = { ...config, entities };
    }

    /** One list only from two different sensors or more: one sensor given twice has nothing to merge. */
    private get combines(): boolean {
        return !!this.config?.combine && new Set(sectionsOf(this.config.entities).map((section) => section.entity)).size > 1;
    }

    public getCardSize(): number {
        const sections = this.config && !this.combines ? sectionsOf(this.config.entities).length : 1;
        return 1 + sections * (2 + (this.config?.departures ?? DEFAULT_DEPARTURES));
    }

    /** In a sections view the card takes a whole section by default and is never narrower than half of one. */
    public getGridOptions(): Record<string, unknown> {
        return { columns: 12, min_columns: 6, rows: "auto" };
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
        this.alignBadgesSoon();
    }

    /**
     * A stop's later departures get badges as wide as its widest, so their destinations line up, as line names such as
     * AY957 and SK1709 differ in width. Measured after every render and every change in the card's size, on the next
     * frame and once however often it is asked. ha-card draws the slot the content sits in only after this card's
     * update, and until then nothing in it has a size. Measured afresh each time, so the badges can also get narrower.
     * A hidden card measures nothing and drops its widths, and measures again when it is shown, as its size changes.
     */
    private alignBadgesSoon(): void {
        cancelAnimationFrame(this.frame ?? 0);
        this.frame = requestAnimationFrame(() => this.alignBadges());
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
        if (changed.has("config") || !this.config || !changed.has("hass") || !previous) {
            return true;
        }
        // Home Assistant hands the card every state change in the house; only its own sensors matter.
        return sectionsOf(this.config.entities).some(({ entity }) => previous.states[entity] !== this.hass?.states[entity]);
    }

    protected render(): TemplateResult | typeof nothing {
        if (!this.hass || !this.config) {
            return nothing;
        }
        const sections = sectionsOf(this.config.entities);
        const attributions = [
            ...new Set(sections.map(({ entity }) => this.hass?.states[entity]?.attributes?.attribution).filter((text) => !!text)),
        ];
        return html`
            <ha-card class=${this.config.full_texts ? "full" : ""}>
                ${this.config.title ? html`<h1 class="card-title">${this.config.title}</h1>` : nothing}
                <div class="sections">${this.combines ? this.combined(sections) : sections.map((section) => this.section(section))}</div>
                ${attributions.length ? html`<div class="attribution">${attributions.join(" · ")}</div>` : nothing}
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
                <span class="name">${name}</span>
                ${subtitle ? html`<span class="subtitle">${subtitle}</span>` : nothing}
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
                    (notice) => html`<div class="stop-notice"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${notice}</span></div>`,
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
                    <div class="headsign">${this.directionIcon(departure)}${departure.headsign ?? ""}</div>
                    <div class="meta">
                        ${this.live(departure)}
                        ${delay !== 0 ? html`<span class="struck">${this.when(departure.scheduled)}</span>` : nothing}
                        ${minutes !== null ? html`<span>${this.when(departure.estimated)}</span>` : nothing} ${this.delay(delay)}
                        ${this.platform(departure)}
                    </div>
                    ${departure.notice ? html`<div class="notice">${departure.notice}</div>` : nothing}
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
        let info: TemplateResult;
        if (cancelled) {
            info = html`<span class="alert" title="${departure.notice ?? ""}"
                >${[this.text("common.cancelled"), departure.notice].filter(Boolean).join(", ")}</span
            >`;
        } else if (arrived) {
            info = html`${this.delay(delay)}
                <span class="arrived">${this.text(departure.mode === "plane" ? "common.landed" : "common.arrived")}</span>
                ${departure.notice ? html`<span class="alert" title="${departure.notice}">${departure.notice}</span>` : nothing}
                ${this.platform(departure)}`;
        } else {
            info = html`${this.delay(delay)}
            ${departure.notice ? html`<span class="alert" title="${departure.notice}">${departure.notice}</span>` : nothing}
            ${this.platform(departure)}`;
        }
        return html`
            <div class="row ${cancelled ? "cancelled" : ""} ${arrived ? "came-in" : ""}">
                <span class="time ${cancelled ? "struck" : ""}">${this.when(cancelled ? departure.scheduled : departure.estimated)}</span>
                ${this.badge(departure, "small")}
                <span class="headsign">${icon ? this.directionIcon(departure) : nothing}${departure.headsign ?? ""}</span>
                <span class="info">${info}</span>
            </div>
        `;
    }

    /** A plane's takeoff or landing in front of its destination or origin. Other modes have none yet. */
    private directionIcon(departure: ShownDeparture): TemplateResult | typeof nothing {
        if (departure.mode !== "plane") {
            return nothing;
        }
        const arriving = departure.direction === "arrivals";
        return html`<ha-icon
            class="direction"
            icon=${arriving ? "mdi:airplane-landing" : "mdi:airplane-takeoff"}
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
        return css`
            /* The card is the container its sections measure, so two stops sit side by side by the card's own width. */
            ha-card {
                container-type: inline-size;
                padding: 16px;
                font-variant-numeric: tabular-nums;
            }

            .card-title {
                margin: 0 0 12px;
                font-size: var(--ha-card-header-font-size, 24px);
                font-weight: var(--ha-font-weight-normal, 400);
                line-height: 1.2;
            }

            .sections {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
            }

            section + section {
                border-top: 1px solid var(--divider-color);
                margin-top: 14px;
                padding-top: 14px;
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
                    margin-top: 14px;
                    padding-top: 14px;
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
                line-height: 1.3;
            }

            .headsign {
                overflow-wrap: anywhere;
            }

            /* On a narrow card the large departure's destination takes a line of its own, under the badge and countdown. */
            @container (max-width: 399px) {
                .next {
                    flex-wrap: wrap;
                    row-gap: 6px;
                }

                .next-text {
                    order: 3;
                    flex-basis: 100%;
                }

                .countdown {
                    margin-left: auto;
                }
            }

            .meta {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 4px 6px;
                font-size: 13px;
            }

            .countdown {
                flex: none;
                font-size: 32px;
                font-weight: var(--ha-font-weight-bold, 700);
                line-height: 1.1;
                white-space: nowrap;
            }

            .unit {
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
                padding: 5px 0;
                font-size: 14px;
            }

            .time {
                flex: none;
                min-width: 44px;
                font-weight: var(--ha-font-weight-bold, 700);
                white-space: nowrap;
            }

            /* The day in front of a time that isn't today: quieter than the time, but there. */
            .day {
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

            /* Takeoff and landing are mirror images, so the icon is a size larger than the text around it. */
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

            /* A notice for the whole stop, such as track works, stays readable in full: cut short it says nothing. */
            .stop-notice {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                margin-top: 8px;
                padding: 6px 8px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.35;
                color: var(--primary-text-color);
                background: rgba(var(--rgb-warning-color, 255, 166, 0), 0.12);
            }

            .stop-notice ha-icon {
                --mdc-icon-size: 16px;
                flex: none;
                width: 16px;
                height: 16px;
                margin-top: 1px;
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
                text-align: right;
            }
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "departures-card": DeparturesCard;
    }
}
