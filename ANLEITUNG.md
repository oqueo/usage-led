# usage-led - Anleitung

Version 0.1.0 · oQueo

usage-led ist eine Nutzungsleiste für Claude Code. Sie sitzt über der
Eingabe (Desktop-App, Code-Tab, und Terminal) und zeigt in Echtzeit, wie viel
vom 5-Stunden-Limit, vom Wochenlimit und vom Kontextfenster verbraucht ist.
Dazu kommen die Cache-Trefferquote und der Verbrauch je Modell. Ein Knopf
verdichtet den Kontext, wie `/compact`.

Sie ist ein Plugin: ein Ordner mit ein paar Dateien, kein Installationsprogramm,
nichts wird im System verändert. Entfernen geht genauso einfach (siehe unten).

## Was Du brauchst

- Claude Code **2.1.287 oder neuer** (Terminal oder Desktop-App)
- Ein Claude-Konto mit Abo (Pro, Max, Team). Mit einem reinen API-Schlüssel
  gibt es keine Abo-Limits, die Leiste zeigt dann "k. A. (API-Key)" und den
  Kontextfüllstand.
- Getestet wurde unter macOS. Auf anderen Systemen sollte es genauso laufen,
  ist dort aber nicht geprüft.

## Installation in drei Schritten

### 1. ZIP entpacken und Ordner ablegen

Entpacke die ZIP-Datei. Du erhältst den Ordner `usage-led`. Lege ihn an einen
Platz, an dem er dauerhaft bleiben darf, zum Beispiel:

    ~/claude-mods/usage-led

Notiere Dir den vollständigen Pfad. In Schritt 2 brauchst Du ihn.
Verschiebst Du den Ordner später, muss der Pfad dort angepasst werden.

### 2. Zum Ausprobieren: einmalig im Terminal starten

    claude --plugin-dir ~/claude-mods/usage-led

Die Leiste erscheint über der Eingabe. Gefällt sie Dir, mach weiter mit
Schritt 3. Sonst schließt Du Claude Code, und es bleibt nichts zurück.

### 3. Dauerhaft einschalten (auch für die Desktop-App)

Öffne die Datei `~/.claude/settings.json` und ergänze unter `env` diesen
Eintrag, mit Deinem vollständigen Pfad (ohne `~`, also zum Beispiel
`/Users/DEINNAME/claude-mods/usage-led`):

    {
      "env": {
        "CLAUDE_CODE_PLUGIN_DIRS": "/Users/DEINNAME/claude-mods/usage-led"
      }
    }

Gibt es in der Datei schon einen Block `env`, trägst Du die Zeile dort ein
und legst keinen zweiten an. Achte auf die Kommas zwischen den Einträgen.

Nutzt Du schon andere Plugins auf diese Weise, steht `CLAUDE_CODE_PLUGIN_DIRS`
bereits da. Dann hängst Du den neuen Pfad an den vorhandenen an, getrennt durch
einen Doppelpunkt (unter Windows durch ein Semikolon):

    "CLAUDE_CODE_PLUGIN_DIRS": "/Users/DEINNAME/claude-mods/usage-led:/Users/DEINNAME/claude-mods/push-wache"

Danach Claude Code **neu starten**. In der Desktop-App heißt das: App
beenden und wieder öffnen.

## Bedienung

### Die Leiste lesen

| Zeichen | Bedeutung |
|---|---|
| **S** | Sitzung: 5-Stunden-Limit als Balken aus 6 Blöcken, Prozentwert, Restzeit bis zum Reset als Stunden:Minuten (2:53) |
| **W** | Woche: 7-Tage-Limit, ebenso (Restzeit in Stunden, etwa 40:03) |
| **K** | Kontext: Füllstand des Kontextfensters |
| **C** | Cache: Trefferquote bei der letzten Antwort |
| **M** | Modelle: Wochenlimits je Modell (Opus, Sonnet, Fable), soweit das Konto sie meldet |
| Presse-Symbol | Knopf, der den Kontext verdichtet (im Terminal steht "Compact") |

Im Terminal zeigt die Leiste bei schmalem Fenster weniger: zuerst entfallen M
und C, dann die Restzeiten, zuletzt verkürzt sich der Balken auf 4 Blöcke.

### Vorlagen wechseln

Tippe in Claude Code `/led`, dann siehst Du alle Vorlagen. Mit `/led <name>`
wechselst Du. Die Wahl bleibt gespeichert.

| Befehl | Aussehen |
|---|---|
| `/led oqueo` | goldener Grund in den Farben der oQueo CI (Standard) |
| `/led weiss` | weißer Grund, Elemente schwarz |
| `/led schwarz` | schwarzer Grund, Elemente weiß |
| `/led ampel-weiss` | weißer Grund, grüne LEDs, Blöcke ab 80 % rot |
| `/led ampel-schwarz` | schwarzer Grund, grüne LEDs, Blöcke ab 80 % rot |

Bei den Ampel-Vorlagen färben sich nur die Blöcke rot, die im letzten Fünftel
der Bahn liegen. Bei den anderen Vorlagen wechseln die Blöcke ab 60 %
die Farbe.

### Leiste oder Statuszeile

- `/led band` (Standard): die farbige Leiste über der Eingabe, mit Knopf.
- `/led status`: keine Leiste, stattdessen eine reine Textzeile unter der
  Eingabe, in der kleinen Schrift der App:

      S ██░░░░ 40% 4:12   W ████░░ 64% 40:03   K 9%   C 87%   M Opus 12%  Sonnet 30%

  Die Statuszeile hat keine Farben, keine Ampel und keinen Knopf. Verdichten
  geht dann mit `/compact`.

## Woher die Zahlen kommen

- **Sitzung und Woche** holt das Plugin bei derselben Konto-Abfrage, die auch
  der Befehl `/usage` benutzt, alle zwei Minuten und nach jeder Antwort.
  Die Anmeldung läuft über Claude Code selbst, das Plugin sieht Dein
  Zugangs-Token nie.
- **Kontext und Cache** liefert Claude Code direkt.
- **Verbrauch je Modell:** Meldet das Konto keine Wochenlimits je Modell,
  zählt das Plugin die Tokens selbst und zeigt Anteile am gezählten
  Verbrauch. Gezählt wird nur, was in Claude Code auf diesem Rechner läuft,
  ab dem Zeitpunkt, an dem das Plugin geladen wird.
- Das Plugin sendet nichts an oQueo und nichts an Dritte. Die einzige
  Netzwerkverbindung ist die Abfrage Deiner eigenen Limits bei Anthropic.

## Wenn etwas nicht klappt

| Beobachtung | Ursache und Abhilfe |
|---|---|
| Keine Leiste zu sehen | Claude Code neu starten. Version prüfen (mindestens 2.1.287). Pfad in `settings.json` prüfen: vollständig, ohne `~`, Ordner `usage-led` existiert dort |
| `/led` wird nicht erkannt | Das Plugin ist nicht geladen, gleiche Prüfung wie oben |
| "k. A. (HTTP 403)" oder ähnlich | Die Konto-Abfrage wurde abgelehnt. Die Werte, die Claude Code selbst meldet, springen als Ersatz ein. Später erneut prüfen |
| "k. A. (HTTP 429)" | Die Konto-Abfrage wurde zu oft gestellt, etwa weil mehrere Claude-Sitzungen laufen. Das Plugin pausiert selbst (5, dann 10, 20, höchstens 30 Minuten) und zeigt in der Zwischenzeit die Werte, die Claude Code meldet, sobald die erste Antwort da ist |
| "k. A. (API-Key)" | Du nutzt Claude Code mit API-Schlüssel statt Abo-Login, dort gibt es keine Abo-Limits |
| "k. A. (kein Login)" | Bei Claude Code anmelden |
| Änderungen an der Datei wirken nicht | `/reload-plugins`, in der Desktop-App die App neu starten |

## Anpassen

Oben in `hooks/register.tsx` stehen die Vorlagen (`THEMES`), die Schriftstufe
(`SIZE`), die Festbreitenschrift (`MONO`), das Symbol auf dem Knopf (`ICON`),
die Zahl der Blöcke (`SEGMENTS`) und das Abfrage-Intervall (`POLL_MS`). Eine
eigene Vorlage legst Du in `THEMES` an, indem Du einen vorhandenen Block
kopierst, umbenennst und die Farben änderst. Danach `/reload-plugins`, in der
Desktop-App neu starten. Dann erscheint der neue Name in `/led`.

## Entfernen

1. Den Eintrag `CLAUDE_CODE_PLUGIN_DIRS` aus `~/.claude/settings.json` löschen.
2. Claude Code neu starten.
3. Den Ordner `usage-led` löschen.

Mehr ist nicht zu tun, das Plugin hinterlässt nichts außerhalb seines Ordners
und des Speichers, den Claude Code ihm zuweist (Vorlage, Darstellung,
Wochenzähler).

## Wichtig zu wissen

- usage-led ist ein unabhängiges Werkzeug von oQueo und steht in keiner
  Verbindung zu Anthropic. "Claude" und "Claude Code" sind Marken von
  Anthropic.
- Die Konto-Abfrage ist keine veröffentlichte Schnittstelle. Ändert Anthropic
  sie, zeigt die Leiste "k. A." und nutzt die Werte von Claude Code, bis das
  Plugin angepasst ist.
- Das Plugin wird ohne Gewähr bereitgestellt.

## Lizenz

usage-led steht unter der MIT-Lizenz (Datei `LICENSE`): Du darfst es frei
nutzen, kopieren, ändern und weitergeben, solange der Urheberrechtsvermerk
erhalten bleibt. Name, Marken, Logos und Corporate Design von oQueo sind von
der Lizenz ausgenommen, Einzelheiten stehen im Zusatz am Ende der `LICENSE`.

Copyright (c) 2026 [Robert-P. Pelikan, oQueo](https://oqueo.io)
