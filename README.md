# Departures card

Home Assistant dashboard card for the next departures from stops, railway stations and airports, from any sensor in
the departures format.

[![GitHub Release][releases-shield]][releases] [![GitHub Release Date][release-date-shield]][releases] [![HACS][hacs-shield]][hacs] [![License][license-shield]](LICENSE)

<p>
<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/one-stop-light.png#gh-light-mode-only" width="400" alt="A bus stop, the next bus large with its countdown and delay, and three trams and buses after it">
<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/one-stop-dark.png#gh-dark-mode-only" width="400" alt="A bus stop, the next bus large with its countdown and delay, and three trams and buses after it">
<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/station-light.png#gh-light-mode-only" width="400" alt="A railway station with a track works notice, the next train large with its track, and a cancelled train among the ones after it">
<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/station-dark.png#gh-dark-mode-only" width="400" alt="A railway station with a track works notice, the next train large with its track, and a cancelled train among the ones after it">
</p>

## What is it?

A custom card that shows when the next bus, tram, train or flight leaves, or the next flight lands. Each stop is a
section of its own, with the next departure large, its line, destination and a countdown, and the ones after it as rows
below. Several stops fit in one card, such as both sides of a street or an airport's departures and arrivals. They sit
side by side when the card is wide enough, or make one list by time.

<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/two-stops-light.png#gh-light-mode-only" width="810" alt="A bus stop and a railway station side by side in one card, each with its next departure large and the following ones below">
<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/two-stops-dark.png#gh-dark-mode-only" width="810" alt="A bus stop and a railway station side by side in one card, each with its next departure large and the following ones below">

The card reads sensors in the [departures format](docs/departures-format.md), so it works with any integration that
writes it:

- [Digitransit Live](https://github.com/jesmak/digitransit_live): bus, tram and metro stops anywhere in Finland.
- [Digitraffic Live](https://github.com/jesmak/digitraffic_live): Finnish railway stations, optionally only the
  trains that stop at another station later, such as Helsinki → Tampere.
- [Finavia Flights](https://github.com/jesmak/finavia_flights): departures and arrivals at Finavia's airports in
  Finland.

Integrations that write the format carry the GitHub topic
[`departures-card-source`](https://github.com/topics/departures-card-source), so that's where to look for more. If
you make one, give its repository the topic too. A template entity can write the format as well.

## Installation

### With HACS

1. Add this repository to HACS custom repositories with type **Dashboard**
2. Search for Departures card in HACS and download it
3. Refresh your browser

### Manual

1. Take `dist/departures-card.js` from the source code of the [latest release][releases] and copy it to the
   `config/www` folder of your Home Assistant installation
2. In Home Assistant settings, open dashboards, click the three dots at the top right and open resources
3. Add a new resource with the path `/local/departures-card.js` and type JavaScript
4. Refresh your browser

## Options

| Name             | Type    | Default  | Description                                                                                                            |
| ---------------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `type`           | string  | required | `custom:departures-card`                                                                                               |
| `entities`       | list    | required | Departures sensors, each shown as a section or all as one list with `combine`, as an entity id or one with its heading |
| `title`          | string  |          | Shown at the top of the card                                                                                           |
| `departures`     | number  | `4`      | How many departures each stop shows, or the whole list with `combine`, the large one included                          |
| `show_cancelled` | boolean | `true`   | Show cancelled departures, struck through with the reason                                                              |
| `show_notices`   | boolean | `true`   | Show the stop's notices, such as track works, under its name                                                           |
| `full_texts`     | boolean | `false`  | Wrap the subtitle and the notices of later departures instead of cutting them short                                    |
| `combine`        | boolean | `false`  | Show every stop's departures and arrivals as one list by time, not a section each                                      |

Each item of `entities` is an entity id, or an object with these keys:

| Name       | Type   | Description                                                                          |
| ---------- | ------ | ------------------------------------------------------------------------------------ |
| `entity`   | string | The departures sensor                                                                |
| `name`     | string | Replaces the stop's own name. Both sides of a street usually share one               |
| `subtitle` | string | A quieter second part of the heading, such as the direction. Not used with `combine` |

Everything can be set in the card's visual editor.

## What it shows

- **How soon it leaves:** "now" under a minute, minutes under an hour, and the clock time after that. A time that
  isn't today has its weekday in front ("Mon 06:15"), and one a week or more away its date. The countdown runs on
  between the sensor's updates, and a departure more than a minute gone is hidden.
- **Live times:** the large departure has a live icon when it is tracked in real time. When it is late or early, its
  timetable time is struck through next to the estimate, with the difference in minutes. A later departure shows its
  estimate with the difference.
- **The line's colour**, when the integration gives one, otherwise a colour by vehicle type.
- **Track, platform or gate:** a train's track, a plane's gate, or another vehicle's platform, when the stop has them.
  An arriving plane's is its baggage hall.
- **Cancellations:** a cancelled departure stays in the list, greyed and struck through, with the reason when the
  integration gives one. It is never the large one, which is always the next departure you can actually take.
- **Arrivals:** a sensor that lists arrivals is headed "Arrivals", and one that says it lists departures "Departures".
  An arrival stays for half an hour after its time, and one that has come in shows when, dimmed and marked as landed or
  arrived, with its delay and any notice. Only the latest two that have come in are listed, so a busy half hour doesn't
  push what's coming off the list. The large one is the next arrival still to come.
- **Takeoff and landing:** a plane's large departure or arrival has an icon in front of its destination or origin. In
  one list of both directions (`combine`), every flight has it, so the departures and arrivals can be told apart.
- **Notices:** a notice about the departure itself, such as "Passengers are directed to train S 106", and the stop's
  own notices, such as track works with buses replacing trains, shown in full under its name.

<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/stop-with-notices-light.png#gh-light-mode-only" width="510" alt="A bus stop with its own notice under its name, the next departure large with a line notice in full, and the rows below with the same notice on its own line under the departure it concerns">
<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/stop-with-notices-dark.png#gh-dark-mode-only" width="510" alt="A bus stop with its own notice under its name, the next departure large with a line notice in full, and the rows below with the same notice on its own line under the departure it concerns">

Clicking a stop's name opens its sensor. With `combine` the heading names every stop it shows once, with their direction
when they all have the same one, and opens the first of them. A stop that can't be shown has a line of its own saying
why.

## Sizes

In a sections view the card takes a whole section by default and can be made as narrow as half of one. Two stops sit
side by side once the card is 620 px wide, which in a sections view takes a section spanning two columns. With
`combine` they are one list at any width. The stop's name and the destinations wrap rather than being cut,
and so does a line known by a long name rather than a number, inside its badge. Times, tracks, platforms and gates
are never cut. A later departure stays on one line while its destination has room, and moves its delay, notice and
platform to the next line when it hasn't. On a narrow card the large departure's destination goes under its badge and
countdown.

The subtitle and the notices of later departures are cut short to keep the card compact. Set `full_texts: true` to
show them in full.

<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/narrow-light.png#gh-light-mode-only" width="250" alt="A bus stop on a card half a section wide, the destination under the line and countdown, and the delays and platforms of later departures on lines of their own">
<img src="https://raw.githubusercontent.com/jesmak/departures-card/main/docs/images/narrow-dark.png#gh-dark-mode-only" width="250" alt="A bus stop on a card half a section wide, the destination under the line and countdown, and the delays and platforms of later departures on lines of their own">

## Colours

The vehicle types' colours can be changed in a theme:

| Variable                   | Default   |
| -------------------------- | --------- |
| `--departures-bus-color`   | `#0b6aa2` |
| `--departures-tram-color`  | `#00845a` |
| `--departures-metro-color` | `#d9480f` |
| `--departures-train-color` | `#1b7a3e` |
| `--departures-ferry-color` | `#00639a` |
| `--departures-plane-color` | `#6741d9` |
| `--departures-other-color` | `#5f6b76` |

## Examples

### One stop

```yaml
type: custom:departures-card
entities:
  - sensor.kauppatori_h0453
```

### Both sides of a street

```yaml
type: custom:departures-card
title: Next buses
departures: 5
entities:
  - entity: sensor.mannerheimintie_h1234
    name: Mannerheimintie
    subtitle: towards the centre
  - entity: sensor.mannerheimintie_h1235
    name: Mannerheimintie
    subtitle: away from the centre
```

### Trains both ways between two cities

Two Digitraffic Live station departure sensors, one in each direction with the other city as its "stops at" station.

```yaml
type: custom:departures-card
entities:
  - entity: sensor.trains_helsinki_tampere
    subtitle: to Tampere
  - entity: sensor.trains_tampere_helsinki
    subtitle: to Helsinki
```

### An airport both ways in one list

Finavia Flights' departures and arrivals sensors for one airport, merged by time, each flight marked with whether it
leaves or lands.

```yaml
type: custom:departures-card
combine: true
departures: 10
entities:
  - sensor.helsinki
  - sensor.helsinki_arrivals
```

## Data

The departures come from the sensors the card is given. The card itself fetches nothing.

The [departures format](docs/departures-format.md) describes the sensor the card reads, with its attributes,
each departure's fields, how the card shows them, and the rules for sources. An integration that writes it gets the card
for free, and the format is meant to stay stable. New optional fields are added without changing its version.

## Translating

The card's texts are in `src/localize/languages/`, one JSON file per language, named by its language code, such as
`en.json` and `fi.json`. To add a language, copy `en.json` to the new language's code, such as `sv.json`, and translate the values.
Nothing else needs changing. The card finds the file by itself and uses it when Home Assistant is set to that
language. A text left out falls back to English. Names, destinations and notices come from the integrations, in the
language they were set up with.

## Development

Requires Node 22.13 or newer.

```
npm install
npm run check
```

`npm run check` typechecks, lints, checks formatting, runs the tests and builds `dist/departures-card.js`, which is
the file HACS installs and is committed to the repository.

| Path                        | What it contains                                           |
| --------------------------- | ---------------------------------------------------------- |
| `src/departures-card.ts`    | The card itself                                            |
| `src/editor.ts`             | The visual editor                                          |
| `src/departures.ts`         | Reading the sensors, and the times, days and colours shown |
| `src/localize/languages/`   | The card's texts, one JSON file per language               |
| `docs/departures-format.md` | The format the card reads                                  |
| `docs/screenshots.json`     | The made-up data the README's screenshots are taken from   |
| `tests/`                    | Tests, run with vitest                                     |

## Support

Hey dude! Help me out for a couple of :beers: or a :coffee:!

[![coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://www.buymeacoffee.com/jesmak)

## License

MIT, see [LICENSE](LICENSE).

[releases-shield]: https://img.shields.io/github/release/jesmak/departures-card.svg?style=for-the-badge
[release-date-shield]: https://img.shields.io/github/release-date/jesmak/departures-card?style=for-the-badge
[releases]: https://github.com/jesmak/departures-card/releases
[hacs-shield]: https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge
[hacs]: https://hacs.xyz/docs/faq/custom_repositories/
[license-shield]: https://img.shields.io/github/license/jesmak/departures-card.svg?style=for-the-badge
