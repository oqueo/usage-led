# usage-led

LED-Leiste in einer Zeile mit abgerundeten Ecken über der Eingabe in Claude Code (Terminal und Desktop-App, Code-Tab), in den Farben der oQueo CI: abgedunkeltes Logo-Gold als Grund, Schrift in "Text hell", LEDs in hellem Gold. Sie zeigt in Echtzeit:

- **S**: Sitzung, 5-Stunden-Limit als Balken aus 6 Blöcken ohne Zwischenraum (bei 50 % leuchten 3), Prozentwert und Restzeit bis zum Reset als Stunden:Minuten (2:53)
- **W**: Woche, 7-Tage-Limit, ebenso (Restzeit in Stunden, etwa 40:03)
- **K**: Füllstand des Kontextfensters
- **C**: Trefferquote des Caches bei der letzten Antwort
- **M**: Wochenlimits je Modell (Opus, Sonnet, Fable), soweit das Konto sie meldet; sonst der gezählte Anteil am Verbrauch
- **Presse-Symbol**: Knopf, der den Kontext verdichtet (wie `/compact`); im Terminal steht "Compact"

Ab 60 % färben sich die leuchtenden Blöcke und der Prozentwert warm-orange. Im Terminal zeigt die Leiste bei schmalem Fenster weniger (zuerst entfallen M und C, dann die Restzeiten, zuletzt verkürzt sich der Balken auf 4 Blöcke). Reicht die Breite nicht, rutschen ganze Teile in eine zweite Reihe.

## Vorlagen

Mit `/led` im Code-Tab zeigst Du Vorlagen und Darstellungen, mit `/led <name>` wechselst Du die Vorlage. Die Wahl bleibt gespeichert.

| Name | Aussehen |
|---|---|
| `oqueo` | goldener Grund in den Farben der oQueo CI (Standard) |
| `weiss` | weißer Grund, Elemente schwarz |
| `schwarz` | schwarzer Grund, Elemente weiß |
| `ampel-weiss` | weißer Grund, grüne LEDs auf grauer Bahn, Blöcke ab 80 % der Länge rot |
| `ampel-schwarz` | schwarzer Grund, grüne LEDs auf grauer Bahn, Blöcke ab 80 % der Länge rot |

Bei den Ampel-Vorlagen färben sich nur die Blöcke rot, die im letzten Fünftel der Bahn liegen; die Blöcke davor bleiben grün. Das gilt für Sitzung, Woche und Kontext.

Neue Vorlagen legst Du in `hooks/register.tsx` in der Liste `THEMES` an.

## Darstellung: Leiste oder Statuszeile

Mit `/led band` (Standard) sitzt die Leiste mit Farben und Compact-Knopf über der Eingabe. Mit `/led status` entfällt die Leiste, stattdessen steht eine reine Textzeile unter der Eingabe (neben "Berechtigungen umgehen"), in der kleinen Schrift der App:

    S ██░░░░ 40% 4:12   W ████░░ 64% 40:03   K 9%   C 87%   M Opus 12%  Sonnet 30%

Die Statuszeile kennt keine Farben, keine Ampel und keinen Knopf (Compact bleibt per `/compact` erreichbar). Die Wahl bleibt gespeichert, `/led band` stellt zurück.

## Woher die Zahlen kommen

Sitzung und Woche holt der Mod bei der Konto-Abfrage, die auch `/usage` nutzt (`api.anthropic.com/api/oauth/usage`), alle zwei Minuten und nach jeder Antwort. Die Anmeldung läuft über Claude Code selbst, der Mod sieht das Zugangs-Token nie. Fällt die Abfrage aus, steht "k. A." mit dem Grund in Klammern (zum Beispiel "HTTP 403" oder "API-Key"), und die Werte, die Claude Code selbst meldet, springen als Ersatz ein.

Wird die Abfrage abgewiesen (HTTP 429, zu viele Anfragen), pausiert das Plugin: erst 5 Minuten, bei jeder weiteren Abweisung doppelt so lang, höchstens 30 Minuten. Nennt die Antwort selbst eine Wartezeit (Retry-After), gilt mindestens die. Die Pause gilt für alle Sitzungen auf dem Rechner gemeinsam. Der zuletzt gemeldete Stand bleibt stehen, bis die Abfrage wieder klappt.

Kontext und Cache liefert Claude Code direkt. Falls das Konto keine Wochenlimits je Modell meldet, zählt der Mod die Tokens je Modell selbst (Eingabe, Ausgabe, Cache-Aufbau; Cache-Lesezugriffe zählen nicht) und zeigt Anteile am gezählten Verbrauch. Gezählt wird nur, was in Claude Code auf diesem Rechner läuft, ab dem Zeitpunkt, an dem der Mod geladen wird.

## Installation

Voraussetzung: Claude Code 2.1.287 oder neuer.

Einmalig zum Ausprobieren, im Terminal:

    claude --plugin-dir /PFAD/ZU/usage-led

Dauerhaft, auch für die Desktop-App: in `~/.claude/settings.json` unter `env` eintragen:

    "CLAUDE_CODE_PLUGIN_DIRS": "/PFAD/ZU/usage-led"

Danach Claude Code neu starten.

## Anpassen

Vorlagen (`THEMES`), Schriftstufe (`SIZE`), Festbreitenschrift (`MONO`), Symbol (`ICON`), Segmentzahl und Abfrage-Intervall stehen oben in `hooks/register.tsx`. Nach dem Speichern lädt Claude Code den Mod neu (`/reload-plugins`, in der Desktop-App ein Neustart).

## Lizenz

MIT-Lizenz, siehe `LICENSE`. Name, Marken, Logos und Corporate Design von oQueo
sind von der Lizenz ausgenommen (Zusatz am Ende der `LICENSE`).

Copyright (c) 2026 [Robert-P. Pelikan, oQueo](https://oqueo.io)
