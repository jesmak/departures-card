/**
 * A dashboard card for the next departures from bus stops and railway stations, from any sensor that
 * writes the departures format (docs/departures-format.md).
 *
 * Each sensor is a section: its next departure large, with a countdown, and the ones after it as rows.
 * Sections sit side by side when the card is wide enough for two, and stack otherwise.
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
    stopNotices,
    visibleDepartures,
} from "./departures";
import "./editor";
import type { HomeAssistant } from "./hass";
import { browserLanguage, translate } from "./localize/localize";
import type { Departure, DeparturesCardConfig, SectionConfig } from "./types";

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

    public static getConfigElement(): HTMLElement {
        return document.createElement("departures-card-editor");
    }

    /** Offers the first departures sensor there is when the card is added from the picker. */
    public static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
        return { entities: hass ? departuresSensors(hass).slice(0, 1) : [] };
    }

    public setConfig(config: DeparturesCardConfig): void {
        if (!config || sectionsOf(config.entities).length === 0) {
            throw new Error(translate(browserLanguage(), "common.invalid_configuration"));
        }
        this.config = { ...config };
    }

    public getCardSize(): number {
        const sections = this.config ? sectionsOf(this.config.entities).length : 1;
        return 1 + sections * (2 + (this.config?.departures ?? DEFAULT_DEPARTURES));
    }

    /** The countdowns run on between the sensor's updates, so the card redraws itself while it is on the page. */
    public connectedCallback(): void {
        super.connectedCallback();
        this.ticker = setInterval(() => this.requestUpdate(), TICK_MS);
    }

    public disconnectedCallback(): void {
        super.disconnectedCallback();
        clearInterval(this.ticker);
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
            <ha-card>
                ${this.config.title ? html`<h1 class="card-title">${this.config.title}</h1>` : nothing}
                <div class="sections">${sections.map((section) => this.section(section))}</div>
                ${attributions.length ? html`<div class="attribution">${attributions.join(" · ")}</div>` : nothing}
            </ha-card>
        `;
    }

    private section(section: SectionConfig): TemplateResult {
        const entity = this.hass?.states[section.entity];
        const name = section.name || (entity?.attributes?.stop_name as string | undefined) || section.entity;
        const heading = html`
            <button class="heading" title="${section.entity}" @click=${() => this.moreInfo(section.entity)}>
                <span class="name">${name}</span>
                ${section.subtitle ? html`<span class="subtitle">${section.subtitle}</span>` : nothing}
            </button>
        `;
        if (!entity) {
            return html`<section>
                ${heading}
                <div class="message">${this.text("common.no_entity")} ${section.entity}</div>
            </section>`;
        }
        if (entity.state === "unavailable") {
            return html`<section>
                ${heading}
                <div class="message">${this.text("common.unavailable")}</div>
            </section>`;
        }
        if (!isDeparturesSensor(entity)) {
            return html`<section>
                ${heading}
                <div class="message">${section.entity} ${this.text("common.not_departures")}</div>
            </section>`;
        }

        const notices = this.config?.show_notices === false ? [] : stopNotices(entity.attributes.notices);
        const { next, rest } = visibleDepartures(
            entity.attributes.departures as Departure[],
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
                                  (departure) => departure.id,
                                  (departure) => this.row(departure),
                              )}
                          </div>`
                        : nothing
                }
                ${!next && !rest.length ? html`<div class="message">${this.text("common.no_departures")}</div>` : nothing}
            </section>
        `;
    }

    /** The next departure: what, where to, and how soon, with the live time, delay and platform under it. */
    private next(departure: Departure): TemplateResult {
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
                    <div class="headsign">${departure.headsign ?? ""}</div>
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

    /** A later departure on one line: its time, line and destination, and whatever is out of the ordinary. */
    private row(departure: Departure): TemplateResult {
        const cancelled = !!departure.cancelled;
        const delay = delayMinutes(departure);
        return html`
            <div class="row ${cancelled ? "cancelled" : ""}">
                <span class="time ${cancelled ? "struck" : ""}">${this.when(cancelled ? departure.scheduled : departure.estimated)}</span>
                ${this.badge(departure, "small")}
                <span class="headsign">${departure.headsign ?? ""}</span>
                <span class="info">
                    ${
                        cancelled
                            ? html`<span class="alert" title="${departure.notice ?? ""}"
                                  >${[this.text("common.cancelled"), departure.notice].filter(Boolean).join(", ")}</span
                              >`
                            : html`${this.delay(delay)}
                              ${departure.notice ? html`<span class="alert" title="${departure.notice}">${departure.notice}</span>` : nothing}
                              ${this.platform(departure)}`
                    }
                </span>
            </div>
        `;
    }

    private badge(departure: Departure, size: "large" | "small"): TemplateResult {
        const colors = departure.cancelled
            ? { background: "var(--disabled-text-color, #9e9e9e)", text: "#ffffff" }
            : badgeColors(departure);
        return html`<span class="badge ${size}" style="background:${colors.background};color:${colors.text}">${departure.line}</span>`;
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

    /** A train leaves from a track, everything else from a platform. */
    private platform(departure: Departure): TemplateResult | typeof nothing {
        if (!departure.platform) {
            return nothing;
        }
        const label = this.text(departure.mode === "train" ? "common.track" : "common.platform");
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

    private text(key: string): string {
        return translate(this.language(), key);
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
                align-items: baseline;
                gap: 8px;
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
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .subtitle,
            .message,
            .meta,
            .attribution,
            .platform {
                color: var(--secondary-text-color);
            }

            .subtitle {
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
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
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
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

            .badge {
                flex: none;
                box-sizing: border-box;
                text-align: center;
                font-weight: var(--ha-font-weight-bold, 700);
                white-space: nowrap;
            }

            .badge.large {
                min-width: 44px;
                padding: 6px 10px;
                border-radius: 10px;
                font-size: 18px;
            }

            .badge.small {
                min-width: 36px;
                padding: 1px 6px;
                border-radius: 8px;
                font-size: 13px;
            }

            .rows {
                margin-top: 12px;
                padding-top: 4px;
                border-top: 1px solid var(--divider-color);
            }

            .row {
                display: flex;
                align-items: center;
                gap: 10px;
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

            .row .headsign {
                flex: 1;
                min-width: 0;
            }

            .info {
                flex: none;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                max-width: 45%;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .row.cancelled .headsign,
            .row.cancelled .time {
                color: var(--secondary-text-color);
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

            .info .alert {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
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
