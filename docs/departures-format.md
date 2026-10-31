# Departures format, version 1

A departures sensor is a Home Assistant entity that lists the next departures from one stop or station, such as
buses from a bus stop, trains from a railway station, trams, ferries, or flights from an airport. It can list arrivals
instead, such as the flights landing at an airport. The
[departures card](../README.md) shows any entity in this format. Anything can produce one, an integration or a
template entity.

The keywords **MUST**, **SHOULD** and **MAY** are used as described in
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119).

## Contents

- [Overview](#overview)
- [Entity](#entity)
- [Departures](#departures)
- [Arrivals](#arrivals)
- [Rules for sources](#rules-for-sources)
- [Examples](#examples)
- [Versioning](#versioning)

## Overview

One entity is one stop or station, with every line that leaves from it. Departures coming and going never create
or remove entities.

```
sensor.kauppatori
├─ state                   2026-10-04T16:52:00+03:00   (the next departure's estimated time)
└─ attributes
   ├─ departures_version    1
   ├─ stop_name             "Kauppatori"
   ├─ attribution           "Digitransit, CC BY 4.0"
   └─ departures[]
      ├─ id                 "trip:HSL:1055_20261004_Ma_2_1645/2026-10-04"
      ├─ line               "55"
      ├─ mode               "bus"
      ├─ headsign           "Koskela"
      ├─ scheduled          ISO 8601
      ├─ estimated          ISO 8601
      └─ …                  delay, realtime, platform, cancelled, notice, color
```

A stop is one place people wait, not a line: a bus stop on one side of a street, or a whole railway station. The
two sides of a street are usually two stops, and the card can show both in one card. Each departure says where it's
heading, which tells directions apart at a station that has both.

Departures are structured data, never HTML. The card builds the markup, escapes every value and renders anything
that changes on its own, such as "in 4 min".

## Entity

| Field                | Type     | Required | Meaning                                                                                                                                                                                   |
| -------------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| state                | ISO 8601 | SHOULD   | The estimated time of the next departure that isn't cancelled, with the `timestamp` device class. `unknown` when there is none.                                                           |
| `departures_version` | integer  | **MUST** | `1`. The card uses this to recognise a departures sensor.                                                                                                                                 |
| `departures`         | object[] | **MUST** | The departures, in order of `estimated`. See [departures](#departures). An empty list when nothing is leaving.                                                                            |
| `stop_name`          | string   | **MUST** | The stop's or station's name: `Kauppatori`, `Tampere`.                                                                                                                                    |
| `direction`          | string   | MAY      | `departures` or `arrivals`. Missing means departures. An arrivals sensor's `departures` list holds arrivals, with `headsign` where each comes from. See [arrivals](#arrivals).            |
| `stop_id`            | string   | MAY      | The source's own identifier for the stop: `HSL:1020201`, `TPE`.                                                                                                                           |
| `stop_code`          | string   | MAY      | The code shown at the stop itself, where there is one: `H0453`.                                                                                                                           |
| `attribution`        | string   | SHOULD   | Data credit, shown under the departures. Required when the data licence asks for credit.                                                                                                  |
| `notices`            | string[] | MAY      | Notices that concern the whole stop and are in force now, in the language the source was configured for: track works, buses replacing trains, a stop closed. Shown under the stop's name. |
| `updated`            | ISO 8601 | MAY      | When the source last fetched successfully.                                                                                                                                                |

## Departures

| Field       | Type     | Required | Meaning                                                                                                                                                                                                    |
| ----------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | string   | **MUST** | Unique within the entity and stable between updates. Prefix it with the kind of identifier: `trip:HSL:1055_20261004_Ma_2_1645/2026-10-04`, `train:2026-10-04/45`.                                          |
| `line`      | string   | **MUST** | What the line or train is called, short enough for a badge: `55`, `IC 45`, `M2`.                                                                                                                           |
| `mode`      | string   | **MUST** | `bus`, `tram`, `metro`, `train`, `ferry`, `plane` or `other`. Picks the default colour. An unknown mode is shown as `other`.                                                                               |
| `headsign`  | string   | SHOULD   | Where it's heading, as shown on the vehicle: `Koskela`, `Helsinki`.                                                                                                                                        |
| `scheduled` | ISO 8601 | **MUST** | The timetabled departure time.                                                                                                                                                                             |
| `estimated` | ISO 8601 | **MUST** | The live estimate when there is one, otherwise the same as `scheduled`. The card counts down to this.                                                                                                      |
| `realtime`  | boolean  | SHOULD   | Whether `estimated` comes from live data. Missing means `false`. The card marks live times.                                                                                                                |
| `delay`     | integer  | MAY      | Seconds behind the timetable; negative means early. Missing means 0. The card shows the delay in the minutes its clock times show, worked out from `scheduled` and `estimated`, so the two never disagree. |
| `platform`  | string   | MAY      | Track, platform or gate, such as `3`, `B` or `28`.                                                                                                                                                         |
| `cancelled` | boolean  | MAY      | The departure is cancelled. Missing means `false`.                                                                                                                                                         |
| `arrived`   | boolean  | MAY      | An arrival has come in. Its `estimated` is then when it did, as near as the source knows. Missing means `false`. Only for an arrivals sensor.                                                              |
| `notice`    | string   | MAY      | A short notice in the language the source was configured for, such as the reason for a cancellation: `Rolling stock`.                                                                                      |
| `color`     | string   | MAY      | The line's own colour as a CSS hex colour, `#00985f`. Replaces the mode's default colour. The card picks a readable text colour for it.                                                                    |

Fields the card doesn't know are ignored.

The card translates only what it renders itself: "now", minutes, clock times, delays, platforms and "cancelled".
Everything else comes from the source in its own words: names, headsigns and notices.

### How the card shows times

Less than a minute away is "now", less than an hour is minutes, and anything later is the clock time. A departure
whose `estimated` time is more than a minute in the past is hidden, so a sensor that updates every minute doesn't
show a bus that has already gone. Cancelled departures stay in the list unless the card is set to hide them. The stop's `notices` are shown under its
name, and a departure's `notice` at the end of its line. Each is cut short to one line, with the full text on hover,
unless the card is set to show texts in full.

## Arrivals

A sensor with `direction: "arrivals"` lists what is coming in rather than what is leaving, in the same shape. `headsign`
is where each comes from, `scheduled` and `estimated` its arrival times, `platform` where to meet it, such as a baggage
hall. A sensor that lists both directions is two sensors, one each, so no other source has to say a direction.

The card shows an arrival until half an hour past its `estimated` time, rather than the minute it gives a departure, so
someone meeting it still sees it after it has come in. One with `arrived: true` shows when it came in, dimmed, with its
delay and notice, and the card says it has arrived in its own words. A cancelled arrival stays as long. The card's count
is of the arrivals still to come and not cancelled, and the cancelled ones among them are listed too. The latest two
that are over, come in or cancelled and past their time, are listed besides them. The large one is the next arrival
still to come that isn't cancelled. The card
names a sensor's direction under its name when the sensor says one, and shows a plane's or a train's direction as an
icon, always on the large one, and on every row in a list of both directions.

## Rules for sources

- Integrations **MUST** list `departures` in `_unrecorded_attributes`, so only the next departure time reaches the
  database. Template entities can't do this: exclude them from the recorder instead.
- Departure ids **MUST** be stable between updates.
- Sources **MUST NOT** list departures that can't be boarded at the stop, in particular a vehicle arriving at the
  last stop of its route. A route's terminus would otherwise show every arriving vehicle as a departure towards
  the stop itself.
- Sources **SHOULD** list in `notices` only what is in force now, and leave the field out when there is nothing.
- Sources **SHOULD** keep cancelled departures in the list with `cancelled: true` instead of dropping them, so
  someone waiting knows not to.
- Arrivals sources **SHOULD** set `arrived` once an arrival has come in, and give its actual time of arrival as
  `estimated` when they have one, rather than an estimate made before it. They **SHOULD** keep an arrival for half an
  hour after it has come in, as the card does, and list the user's number of arrivals still to come with the latest two
  that are over besides them. A cancelled arrival hasn't come in, whatever else
  the source knows of it. They **SHOULD NOT** give an arrival a `notice`
  that only says it has arrived.
- Sources **SHOULD NOT** give a cancelled departure a `notice` that only says it is cancelled. The card says it in its
  own language, so a notice of `Cancelled` would read "Cancelled, Cancelled". Give the reason, or leave the notice out.
- Sources **SHOULD** let the user choose how many departures to list, and count only those not cancelled, listing the
  cancelled ones among them too, as the card does, so a run of cancellations doesn't push the next departure off the
  list. When fewer than that aren't cancelled, as in a strike, they **SHOULD** fill the list up to the number with the
  cancelled ones after, and no further. The card shows at most as many as the source provides.
- Sources **SHOULD** refresh no more often than every 30 seconds.
- Sources **SHOULD** leave out fields that have no value instead of writing `null`. The card treats `null` as
  missing.
- Sources **SHOULD** become `unavailable` when fetching fails, like a standard update coordinator, rather than keep
  showing old estimates as live.

## Examples

### A bus stop

```json
{
  "state": "2026-10-04T16:52:00+03:00",
  "attributes": {
    "friendly_name": "Kauppatori",
    "device_class": "timestamp",
    "departures_version": 1,
    "stop_name": "Kauppatori",
    "stop_id": "HSL:1020201",
    "stop_code": "H0453",
    "attribution": "Digitransit, CC BY 4.0",
    "departures": [
      {
        "id": "trip:HSL:1055_20261004_Ma_2_1645/2026-10-04",
        "line": "55",
        "mode": "bus",
        "headsign": "Koskela",
        "scheduled": "2026-10-04T16:50:00+03:00",
        "estimated": "2026-10-04T16:52:00+03:00",
        "realtime": true,
        "delay": 120,
        "color": "#007ac9"
      },
      {
        "id": "trip:HSL:1016_20261004_Ma_1_1701/2026-10-04",
        "line": "16",
        "mode": "bus",
        "headsign": "Kalasatama (M)",
        "scheduled": "2026-10-04T17:01:00+03:00",
        "estimated": "2026-10-04T17:01:00+03:00",
        "realtime": false
      }
    ]
  }
}
```

### A railway station, with a cancellation

```json
{
  "state": "2026-10-04T17:12:00+03:00",
  "attributes": {
    "friendly_name": "Tampere",
    "device_class": "timestamp",
    "departures_version": 1,
    "stop_name": "Tampere",
    "stop_id": "TPE",
    "attribution": "Fintraffic / digitraffic.fi, CC BY 4.0",
    "departures": [
      {
        "id": "train:2026-10-04/45",
        "line": "IC 45",
        "mode": "train",
        "headsign": "Oulu",
        "scheduled": "2026-10-04T17:05:00+03:00",
        "estimated": "2026-10-04T17:12:00+03:00",
        "realtime": true,
        "delay": 420,
        "platform": "3"
      },
      {
        "id": "train:2026-10-04/172",
        "line": "S 172",
        "mode": "train",
        "headsign": "Helsinki",
        "scheduled": "2026-10-04T17:20:00+03:00",
        "estimated": "2026-10-04T17:20:00+03:00",
        "platform": "2",
        "cancelled": true,
        "notice": "Rolling stock"
      }
    ]
  }
}
```

The state is IC 45's estimated time, because S 172 is cancelled.

## Versioning

`departures_version` changes only for breaking changes. New optional fields are added to version 1 without
changing it, and the card ignores fields it doesn't know. `direction` and `arrived` were added that way, so a card
before 1.2.0 shows an arrivals sensor as departures.
