/** The card's visual editor: the title, the stops with their headings, how many departures each shows, cancelled ones and notices. */
import { LitElement, html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { DEFAULT_DEPARTURES } from "./const";
import { departuresSensors, sectionsOf } from "./departures";
import type { HomeAssistant } from "./hass";
import { browserLanguage, translate } from "./localize/localize";
import type { DeparturesCardConfig, SectionConfig } from "./types";

interface SchemaEntry {
    name: string;
}

const DEFAULTS: Record<string, unknown> = {
    departures: DEFAULT_DEPARTURES,
    show_cancelled: true,
    show_notices: true,
};

function schema(hass: HomeAssistant, text: (key: string) => string) {
    return [
        { name: "title", selector: { text: {} } },
        {
            name: "entities",
            required: true,
            selector: {
                object: {
                    multiple: true,
                    label_field: "entity",
                    description_field: "subtitle",
                    fields: {
                        entity: {
                            label: text("editor.entity"),
                            required: true,
                            selector: { entity: { include_entities: departuresSensors(hass) } },
                        },
                        name: { label: text("editor.name"), selector: { text: {} } },
                        subtitle: { label: text("editor.subtitle"), selector: { text: {} } },
                    },
                },
            },
        },
        {
            type: "grid",
            name: "",
            schema: [
                { name: "departures", selector: { number: { min: 1, max: 20, step: 1, mode: "box" } } },
                { name: "show_cancelled", selector: { boolean: {} } },
                { name: "show_notices", selector: { boolean: {} } },
            ],
        },
    ];
}

/** A stop with nothing but its sensor is written as the plain entity id, so the configuration stays short. */
export function compactSections(sections: SectionConfig[]): Array<string | SectionConfig> {
    return sectionsOf(sections).map((section) => {
        const entry: SectionConfig = { entity: section.entity };
        if (section.name) {
            entry.name = section.name;
        }
        if (section.subtitle) {
            entry.subtitle = section.subtitle;
        }
        return entry.name || entry.subtitle ? entry : entry.entity;
    });
}

@customElement("departures-card-editor")
export class DeparturesCardEditor extends LitElement {
    @property({ attribute: false }) public hass?: HomeAssistant;
    @state() private config: DeparturesCardConfig = { type: "custom:departures-card", entities: [] };

    public setConfig(config: DeparturesCardConfig): void {
        this.config = { ...config };
    }

    protected render(): TemplateResult | typeof nothing {
        if (!this.hass) {
            return nothing;
        }
        // The form edits every stop as an object; plain entity ids are expanded for it.
        return html`
            <ha-form
                .hass=${this.hass}
                .data=${{ ...DEFAULTS, ...this.config, entities: sectionsOf(this.config.entities) }}
                .schema=${schema(this.hass, (key) => this.text(key))}
                .computeLabel=${(entry: SchemaEntry) => this.text(`editor.${entry.name}`)}
                .computeHelper=${(entry: SchemaEntry) => this.helper(entry.name)}
                @value-changed=${this.valueChanged}
            ></ha-form>
        `;
    }

    private valueChanged(event: CustomEvent<{ value: DeparturesCardConfig }>): void {
        const config: DeparturesCardConfig = { ...event.detail.value };
        config.entities = compactSections((config.entities ?? []) as SectionConfig[]);
        if (!config.title) {
            delete config.title;
        }
        // The defaults are shown in the form but left out of the configuration.
        for (const [key, value] of Object.entries(DEFAULTS)) {
            if (config[key] === value || config[key] === undefined || config[key] === null || config[key] === "") {
                delete config[key];
            }
        }
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
    }

    private text(key: string): string {
        return translate(this.language(), key);
    }

    private helper(name: string): string | undefined {
        const key = `editor.${name}_helper`;
        const helper = translate(this.language(), key);
        return helper === key ? undefined : helper;
    }

    private language(): string {
        return this.hass?.locale?.language ?? this.hass?.language ?? browserLanguage();
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "departures-card-editor": DeparturesCardEditor;
    }
}
