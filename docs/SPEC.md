# Spezifikation: Fundament (Monorepo + Backend)

> Wortlaut der Aufgabenstellung (Prompt 0 von 3), nur als Markdown gegliedert. Ergänzt um die getroffenen **Entscheidungen** und **Annahmen** am Ende. Änderungen an den Regeln bitte hier und in `CLAUDE.md` nachziehen.

Du baust mit mir das Fundament einer Plattform, über die lokale Unternehmen kurzfristige, vergünstigte Angebote (z. B. Kochkurse) einstellen. Nutzer sichern sich diese Angebote per Gutscheincode. Ziel ist ein echter, nutzbarer MVP, mit dem wir in Münster mit 5–15 Partnern die Nachfrage testen. Es gibt kein Payment und keine Gebühren.

Die Plattform besteht aus drei Teilen:

- **Backend:** Supabase. Wird in dieser Session gebaut.
- **Website für Unternehmen und Admin** (Next.js, `apps/web`). Sie wird danach von meinem Kollegen in einer eigenen Session gebaut.
- **Mobile App für Nutzer** (Expo, `apps/mobile`). Ich baue sie gleichzeitig mit der Website in einer eigenen Session.

Diese Session schafft die Grundlage, damit wir beide danach parallel und ohne gegenseitiges Blockieren arbeiten können. Dazu gehören:

- Monorepo
- komplette Datenbank mit allen Geschäftsregeln
- gemeinsames Paket
- Seed-Daten
- Doku
- Spielregeln für die Zusammenarbeit

Website und App baust du nicht.

## Arbeitsweise

- Prüfe zuerst den Workspace. Falls schon Code existiert, analysiere ihn und baue darauf auf.
- Speichere diese Spezifikation als `docs/SPEC.md`.
- Lege eine Root-`CLAUDE.md` an: Konventionen, Befehle, Projektstruktur und die Regeln zur Zusammenarbeit unten. App und Website bekommen später eigene `CLAUDE.md` in ihren Ordnern.
- Lege mir einen Umsetzungsplan vor und warte auf mein OK.
- Arbeite Phase für Phase. Am Ende jeder Phase:
  - Typecheck, Lint und Tests laufen lassen
  - git-Commit
  - eine kurze Zusammenfassung schreiben
  - dann auf mein OK warten
- Prüfe bei Supabase, Expo und Next.js die aktuelle offizielle Doku, statt dich auf dein Gedächtnis zu verlassen.
- Frag nur nach, wenn eine Entscheidung dich blockiert oder ich etwas anlegen muss. Sonst triff eine sinnvolle Annahme und dokumentiere sie in `docs/SPEC.md` unter „Annahmen“.
- Nutze die installierten Skills aktiv: `supabase` und `postgres-best-practices` für Schema, RLS und Funktionen.
- Tools: Migrationen laufen als Dateien über die Supabase CLI. Den Supabase-MCP-Server nutzt du nur lesend. Es gibt keinen Expo-MCP-Server.
- Secrets gehören nur in `.env`-Dateien (nicht committen). Pflege eine `.env.example`.
- Zeitzone Europe/Berlin, Preise werden als Cent (EUR) gespeichert, die Oberfläche ist auf Deutsch.

## Zusammenarbeit (zwei Entwickler parallel), in die Root-CLAUDE.md übernehmen

**Zuständigkeiten:**

- Ich (Ben): `apps/mobile`
- mein Kollege: `apps/web`
- Jeder arbeitet auf seinem eigenen Rechner mit einer eigenen Claude-Code-Session.

**Git & GitHub:**

- Das Repo liegt auf GitHub, `main` ist geschützt, Änderungen kommen nur per Pull Request.
- Jeder arbeitet in eigenen Feature-Branches (`web/...`, `app/...`, `backend/...`).
- Kleine PRs, oft mergen. Holt euch `main` mindestens täglich in den eigenen Branch.
- Eigene Ordner (`apps/web` bzw. `apps/mobile`) darf jeder frei ändern.
- Gemeinsame Bereiche (`supabase/`, `packages/shared/`, Root-Konfiguration):
  - Änderungen nur in einem eigenen, kleinen PR, den der andere kurz reviewt
  - keine gemeinsamen Änderungen nebenbei in einem Feature-PR verstecken

**Eine gemeinsame Datenbank, kein lokales Supabase, kein Docker:** Wir entwickeln beide direkt gegen ein gemeinsames Supabase-Dev-Projekt in der Cloud. Jede Schemaänderung wirkt deshalb sofort beim anderen. Das bedeutet:

- Schemaänderungen nie im Dashboard klicken, sondern immer als Migrationsdatei im Repo. Hat doch jemand geklickt, holst du die Änderung mit `supabase db pull` bzw. `supabase db diff` als Migration ins Repo.
- Nur hinzufügen: Neue Tabellen, Spalten und Funktionen sind okay. Umbenennen, Löschen oder Ändern bestehender Strukturen nur nach Absprache mit dem anderen.
- Reihenfolge bei einer Schemaänderung:
  1. `main` pullen
  2. Migration anlegen
  3. kleiner Schema-PR
  4. der andere reviewt kurz
  5. mergen
  6. `supabase db push` ins Dev-Projekt
  7. Typen neu generieren und committen
  8. erst danach das Feature bauen, das die Änderung nutzt
- Vor jedem `supabase db push` fragt Claude Code ausdrücklich nach. Es wird nie ohne Bestätigung gepusht.
- Bestehende Migrationen werden nie geändert, es kommen nur neue dazu.
- Die Datenbank wird nie komplett zurückgesetzt (`db reset` o. ä.), ohne dass beide zustimmen.
- Testdaten: Was jeder beim Testen anlegt, trägt ein erkennbares Präfix (z. B. „TEST Ben …“), damit nichts verwechselt wird. Die Seed-Daten bleiben unangetastet.
- Nach jedem Pull von `main`: `pnpm install` und die Typen prüfen bzw. neu generieren.
- Später: Für echte Partner und Nutzer legen wir ein zweites Supabase-Projekt für den Live-Betrieb an. Das Dev-Projekt bleibt unsere Spielwiese. Halte die Konfiguration (URLs, Keys) deshalb vollständig über `.env` austauschbar.

Lege eine `.github/CODEOWNERS` und eine Pull-Request-Vorlage mit Checkliste an (Typecheck, Tests, Migration, Typen, Doku).

## Tech-Stack & Struktur

- Monorepo mit pnpm-Workspaces. Halte dich an die Anforderungen aus der Expo-Doku zu Monorepos, damit die App später sauber läuft.
- `apps/web` und `apps/mobile`: legst du nur als leere Platzhalter mit README an. Die beiden Sessions bauen sie.
- `packages/shared` (von beiden genutzt, plattformneutral, ohne DOM- oder Node-spezifischen Code):
  - generierte Supabase-Typen
  - Zod-Schemas für alle Eingaben (Angebot, Registrierung, Profil …)
  - Konstanten (Kategorien, Statuswerte, Fehlercodes der RPCs)
  - Design-Tokens (Farben, Abstände, Radien, Typografie)
  - Hilfsfunktionen (Rabattberechnung, Preis- und Datumsformat, Zeitlabels wie „startet in 2 Std.“)
  - Tests für die Hilfsfunktionen
- `supabase/`: Migrations, Seed, Edge Functions, SQL-Tests

**Supabase:**

- Postgres, Auth (E-Mail-OTP, Apple, Google für Nutzer; E-Mail + Passwort für Standorte), Storage (Angebotsbilder, Logos), Edge Functions, pg_cron
- Region EU (Frankfurt)
- Kein lokales Supabase und kein Docker. Wir arbeiten direkt mit dem gehosteten Dev-Projekt, das ich schon angelegt habe. Die Supabase CLI nutzen wir nur für `link`, Migrationen (`db push`, `db pull`, `db diff`) und die Typgenerierung.
- Alle Geschäftsregeln laufen serverseitig in Postgres-Funktionen, nie nur im Client.
- Row-Level-Security auf allen Tabellen. Es gibt drei Rollen: Nutzer (App), Standort-Account (Web), Admin (Web).
- Fehler aus RPCs kommen mit festen, maschinenlesbaren Codes (z. B. `AUSGEBUCHT`, `GESPERRT`, `FRIST_ABGELAUFEN`). Die Codes stehen in `packages/shared`, damit App und Web sie gleich übersetzen.

## Design-Tokens (Grundlage für App und Web)

- **Stil:** Hauptvorbild ist die Restaurant-Deal-App Neotaste: lebendig, urban, Deals im Vordergrund. Kombiniere das mit der Klarheit von Uber, Wise und Airbnb. Wir entwickeln aber eine eigene Identität: keine Logos, Markenfarben, Illustrationen oder Texte anderer Apps.
- **Farben:**
  - Weiß, eine fein abgestufte Grauskala und Schwarz für Text
  - genau eine kräftige, energiegeladene Akzentfarbe für Deal-Badges, Rabatte und Haupt-Buttons
  - Statusfarben (Erfolg, Warnung, Fehler)
  - Schlag mir 2–3 Akzentfarben vor, die sich klar von Neotaste unterscheiden.
- **Badges:** eigene Token-Stufe für Deal-Badges auf Bildern (Farbe, Kontrast, Radius)
- Lege den Ordner `docs/design-referenz/` mit einer README an. Dort können wir Screenshots als Inspiration ablegen.
- **Typografie:** eine Open-Source-Schrift wie Inter, mit Größenskala und Gewichten.
- **Abstände und Radien:** 4/8-pt-Raster, Radien-Skala, Schatten-Stufen.
- **Farbmodus:** Hellmodus jetzt, die Struktur ist aber so angelegt, dass ein Dunkelmodus später ergänzt werden kann.
- **Format:** Die Tokens sind als TypeScript-Objekt exportiert, damit Tailwind (Web) und die App sie nutzen können.

## Fachliche Regeln (vollständig, das Backend setzt alle um)

### Rollen & Accounts

**Nutzer (App):**

- Stöbern geht ohne Konto. Zum Code-Holen ist ein Login nötig.
- Das Profil enthält Vorname und Nachname. Das Konto ist löschbar (eigene RPC, entfernt bzw. anonymisiert die Daten).

**Unternehmen → Standorte (Web):**

- Ein Unternehmen (Name, Logo, Beschreibung) hat einen oder mehrere Standorte.
- Es gibt genau einen Login pro Standort.
- Ein Standort sieht und verwaltet nur seine eigenen Angebote und Codes.

**Selbstregistrierung + Freischaltung:**

- Die Registrierung legt Unternehmen, ersten Standort und Login an, mit Status `pending`.
- Erst nach Freischaltung durch einen Admin kann der Standort Angebote erstellen.
- Es gibt einen Status `rejected`.

**Admin:** eigene Rolle, wird per SQL oder Seed gesetzt.

### Angebote

- Ein Angebot gehört zu einem Standort und ist nach dem Speichern sofort live. Ein Admin kann Angebote entfernen.
- **Felder:**
  - Titel, Beschreibung, Kategorie
  - 0–5 Bilder, optional (das erste ist das Titelbild)
  - Originalpreis und Deal-Preis
  - Kontingent (Plätze) und maximale Plätze pro Nutzer
  - Adresse plus lat/lng (Pflicht pro Angebot)
  - Art
- **Art:**
  - `einzeltermin`: mit Start- und Endzeit
  - `zeitraum`: einlösbar von–bis
  - Der Zeitpunkt ist frei wählbar.
- **Rabatt:** Der Mindestrabatt ist eine globale Admin-Einstellung (Startwert 20 %) und wird serverseitig geprüft.
- **Kategorien:** feste Liste:
  - Kochen & Essen
  - Sport & Bewegung
  - Kreativ & Workshops
  - Wellness & Beauty
  - Kultur & Events
  - Sonstiges
- **Änderungen nach Code-Vergabe:**
  - Titel, Beschreibung und Bilder sind immer änderbar.
  - Das Kontingent darf erhöht werden, aber nicht unter die bereits vergebenen Plätze sinken.
  - Zeit, Adresse und Preise sind gesperrt, sobald Codes existieren.
- **Absage (`cancel_offer`):**
  - jederzeit möglich
  - Alle aktiven Codes werden storniert, es entstehen keine No-Shows.
  - Jeder betroffene Code-Inhaber bekommt einen Eintrag in einer Tabelle `notification_outbox`. Die App-Session verschickt daraus später Pushes.

### Gutscheincodes

- **`claim_voucher`** (atomar, mit Row-Lock auf dem Angebot, nie überbuchen): Die Funktion prüft:
  - Der Nutzer ist eingeloggt und nicht gesperrt.
  - Das Angebot ist aktiv und hat (Einzeltermin) noch nicht begonnen bzw. ist (Zeitraum) noch nicht abgelaufen.
  - Die gewünschten Plätze sind ≤ max. pro Nutzer, und es sind genug Plätze frei.
  - Pro Nutzer und Angebot gibt es höchstens einen aktiven Code.
- **Code:** ein zufälliger, nicht erratbarer Token für den QR-Code plus ein kurzer, lesbarer Code (z. B. `K7Q-4MX`).
- **Status:** aktiv, storniert, eingelöst, no_show, abgelaufen
- **`redeem_voucher`:**
  - per Token oder Kurzcode
  - Nur der eigene Standort darf einlösen.
  - Einlösezeitraum: beim Einzeltermin ab 1 Std. vor Start bis zum Ende, beim Zeitraum innerhalb des Zeitraums.
- **Einzeltermin:**
  - `cancel_voucher` bis X Std. vor Start (Admin-Einstellung). Die Plätze gehen zurück ins Kontingent.
  - `mark_no_show` nur durch den Standort und erst ab der Startzeit.
  - Nach N No-Shows wird der Nutzer für D Tage gesperrt. N und D sind Admin-Einstellungen (Startwert: 2 → 30 Tage). Danach wird der Zähler zurückgesetzt.
- **Zeitraum:** jederzeit stornierbar, kein No-Show. Nicht eingelöste Codes werden nach dem Ende abgelaufen.

### Weitere Daten

- **Einstellungen:** Mindestrabatt, Storno-Frist, No-Show-Limit, Sperrdauer, Erinnerungszeit vor Start (Standard 2 Std.)
- **Favoriten** von Nutzern: Standorte und Kategorien
- **Push-Tokens:** mehrere Geräte pro Nutzer
- **`notification_outbox`:** ausstehende Benachrichtigungen (Typ, Empfänger, Bezug, Status)
- **Events für Kennzahlen:** Angebot angesehen, Code geholt, storniert, eingelöst, No-Show
- **Geocoding-Cache:** Tabelle für Adresse → lat/lng
- **Öffentliche Lese-Sicht** (View oder RPC) auf aktive Angebote:
  - mit freien Plätzen, Standortinfo und Koordinaten
  - sortierbar nach „als Nächstes relevant“ (Einzeltermin: Startzeit, Zeitraum: Ende)
  - filterbar nach Kategorie und Standort
- **Teilnehmerliste für Standorte:** RPC oder View mit Vorname, Initial des Nachnamens, Plätzen, Kurzcode und Status, aber ohne E-Mail
- **Admin-Kennzahlen:** RPC mit Summen pro Woche, Standort und Kategorie sowie der Einlösequote

## Phasen

1. **Setup:**
   - git und GitHub-Repo verbinden (frag mich nach der URL oder leg es per gh an)
   - Monorepo und Tooling (TypeScript strict, ESLint, Prettier, gemeinsame Configs)
   - Platzhalter für `apps/web` und `apps/mobile`
   - `packages/shared` mit Design-Tokens
   - CODEOWNERS, PR-Vorlage, `.env.example`, Root-`CLAUDE.md`
   - Erkläre mir, wie ich den Branch-Schutz für `main` in GitHub einstelle.
2. **Datenbank:**
   - komplettes Schema mit RLS
   - alle RPCs: `claim_voucher`, `cancel_voucher`, `redeem_voucher`, `mark_no_show`, `cancel_offer`, Konto löschen, Freischalten/Ablehnen, Einstellungen, Kennzahlen
   - Storage-Buckets mit Policies
3. **Seed & Tests:**
   - Seed mit ca. 8 Münster-Standorten (realistische Adressen und Koordinaten), ca. 15 Angeboten beider Arten mit Platzhalterbildern, Testnutzern pro Rolle und einigen Codes in allen Status. Einmalig ins Dev-Projekt einspielen, nach meiner Bestätigung.
   - SQL-Tests für alle RPCs, unter anderem mit parallelen Anfragen auf den letzten freien Platz. Die Tests laufen gegen das Dev-Projekt, ohne dauerhaft Daten zu verändern (in Transaktionen mit Rollback).
   - Typgenerierung aus dem Dev-Projekt nach `packages/shared`
4. **Übergabe:**
   - `docs/BACKEND.md` für beide Sessions: alle Tabellen, Views und RPCs mit Parametern, Rückgaben und Fehlercodes, die RLS-Regeln pro Rolle, Auth-Einstellungen, Storage-Buckets, Testzugänge aus dem Seed und die Befehle für Migrationen und Typgenerierung
   - README: Wie richtet mein Kollege das Projekt auf seinem Rechner ein? Dazu gehören Klonen, `pnpm install`, Supabase CLI, `supabase login`, `supabase link` und `.env` mit den Keys des Dev-Projekts. Er braucht kein Docker.

---

## Entscheidungen

Mit Ben abgestimmt (12.11.2026):

| Thema                        | Entscheidung                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Akzentfarbe                  | **Glut-Orange**: Markenton `#FF5A1F`, Arbeitston für Flächen mit weißem Text `#D63A0A` (AA). Fehlerfarbe deshalb Karmin `#BE123C`, Warnung Bernstein-Gelb `#F5B800`. Verworfen: Volt-Violett `#5B3DF5`, Signalgelb `#FFD60A`.                                                                                                   |
| Repo                         | https://github.com/arwedc/unfair-weekend (öffentlich, Besitzer @arwedc)                                                                                                                                                                                                                                                         |
| GitHub-Konten                | Ben = @Mecrylol, Kollege = @arwedc                                                                                                                                                                                                                                                                                              |
| Docker                       | **Gar kein Docker**, auch nicht optional. Alles läuft direkt gegen das gehostete Dev-Projekt.                                                                                                                                                                                                                                   |
| DB-Änderungen im Dev-Projekt | Ersetzt „vor `db push` ausdrücklich fragen“: Migration → `pnpm db:check` → `db push` ohne Rückfrage → Typen → Branch `db/<kurzname>` + PR, den Ben selbst merged → Zwei-Satz-Zusammenfassung für @arwedc. Für das Live-Projekt weiterhin nur mit Bens OK. `supabase/` hat deshalb keinen Code-Owner mehr. Details: `CLAUDE.md`. |
| Region Dev-Projekt           | Das Dev-Projekt liegt in **Paris (eu-west-3)**, nicht in Frankfurt. Das ist für Dev in Ordnung (EU). Das Live-Projekt wird in Frankfurt angelegt.                                                                                                                                                                               |

## Annahmen

Getroffen, weil sie nicht blockieren. Widerspruch jederzeit möglich, dann folgt eine neue Migration.

**Werkzeuge und Ablauf**

1. **Kein Docker:** Laut aktueller Supabase-Doku brauchen `supabase db pull`, `db diff` und `test db` Docker. Deshalb:
   - SQL-Tests laufen über einen eigenen Runner (Node + `pg` über den Session-Pooler), jede Testdatei in `BEGIN … ROLLBACK`.
   - Hat jemand im Dashboard geklickt, liest Claude den Ist-Zustand nur lesend aus (Katalogabfragen, MCP lesend) und schreibt die passende Migration von Hand.
   - `link`, `migration new`, `db push` und die Typgenerierung laufen ohne Docker.
2. **Migrations-Probelauf:** `pnpm db:check` spielt noch nicht gepushte Migrationen in einer Transaktion gegen das Dev-Projekt ein und rollt sie zurück. So lassen sich Schema-PRs vor Merge und Push testen.
3. **Paralleltest auf den letzten Platz:**
   - Der Standard-Testlauf beweist nur mit Rollback, dass `claim_voucher` die Angebotszeile sperrt: Eine zweite Verbindung läuft in einen Lock-Timeout.
   - Ein echtes Wettrennen braucht echte Commits. Dafür gibt es den separaten Befehl `pnpm db:test:race`: Er legt ein temporäres Angebot „TEST AUTOTEST …“ an und löscht danach alles wieder.
4. **Supabase CLI** als devDependency im Repo (gleiche Version für beide, kein globales Install nötig): `pnpm supabase …`.
5. **TypeScript 6.0**, nicht 7.0: typescript-eslint unterstützt TS 7 noch nicht, und das Expo-SDK-58-Template nutzt ebenfalls 6.0.
6. **Paket-Scope `@repo/*`**, unabhängig vom Produktnamen.
7. **pnpm-Catalog** für gemeinsame Versionen (zod, typescript …), damit App und Web dieselben Versionen nutzen.
8. **CI** (GitHub Actions: Format, Lint, Typecheck, Unit-Tests, ohne DB), damit der Branch-Schutz einen Pflicht-Check hat.
9. **CODEOWNERS:** Die eigenen Bereiche (`apps/mobile`, `apps/web`) haben keinen Owner, damit jeder dort ohne Review mergen kann. Die gemeinsamen Bereiche gehören beiden, sodass immer der andere reviewt.
10. **Phase-1-PR** darf Ben ohne Review mergen (Bootstrap, Branch-Schutz noch nicht aktiv).

**Design**

11. **Tokens:**
    - Farben sind in `themes.light` semantisch benannt (`text.primary`, `accent.solid`, `badge.deal` …). Ein Dunkelmodus bekommt später dieselben Namen.
    - Alle Text-/Hintergrund-Paare erfüllen WCAG AA (4,5:1), ein Test prüft das.
    - Schatten sind CSS-Strings (Web und React Native `boxShadow`).
    - Für Tailwind v4 erzeugt `tailwindThemeCss()` einen `@theme`-Block.
12. **Formatierung:**
    - Preise und Datumsangaben werden selbst formatiert. `Intl` dient nur zur Zeitzonen-Umrechnung, damit iOS, Android, Browser und Node exakt gleich aussehen.
    - Rabatt = abgerundete Prozent. Die Mindestrabatt-Prüfung nutzt dieselbe Ganzzahl-Regel wie der Server.

**Datenmodell und Regeln**

13. **Rollen** kommen aus `profiles.role` (nutzer/standort/admin) und werden per Helferfunktion geprüft, nicht per JWT-Hook. Rollenwechsel wirken dadurch sofort, und im Dashboard ist nichts zu konfigurieren.
14. **Standort-Registrierung** läuft zweistufig: `signUp` (Metadaten `account_type=standort`) → E-Mail bestätigen → RPC `register_company` (Unternehmen + erster Standort, `pending`).
15. **Weitere Standorte** eines Unternehmens registrieren sich selbst. Der Admin ordnet sie beim Freischalten dem bestehenden Unternehmen zu. Jeder Standort-Account darf die Daten seines Unternehmens bearbeiten.
16. **Öffentliche Lesesicht** läuft über RPCs (`list_offers`, `get_offer`) statt über eine View. Anon bekommt keinen direkten Tabellenzugriff.
17. **Storno-Frist** startet bei 3 Std. vor Beginn (Admin-Einstellung).
18. **Einzeltermin:** No-Show lässt sich ab Start bis 48 Std. nach Ende markieren. Danach werden offene Codes automatisch `abgelaufen`, ohne Strafe.
19. **„Codes existieren“** heißt: mindestens ein Code ist `aktiv`, `eingeloest` oder `no_show`. Sind alle storniert, lassen sich Zeit, Adresse und Preise wieder ändern. Kategorie und „max. pro Nutzer“ sind immer änderbar.
20. **Zeitraum-Angebote** lassen sich schon vor „von“ holen. Eingelöst werden sie nur im Zeitraum.
21. **Entfernen und Ablehnen:**
    - Entfernt der Admin ein Angebot, wirkt das wie eine Absage: Codes werden storniert, Inhaber benachrichtigt, Status `entfernt`.
    - „Ablehnen“ geht auch nach der Freischaltung (= Sperre). Aktive Angebote werden dann abgesagt.
22. **Erinnerungen** gibt es nur für Einzeltermine. Ausverkaufte Angebote erscheinen im Feed mit 0 freien Plätzen, außer der Filter `only_available` ist gesetzt.
23. **Einlösequote** = eingelöst / (geholt − storniert).
24. **Kontolöschung:**
    - Aktive Codes werden storniert, die Plätze gehen zurück.
    - Codes und Events bleiben anonym (ohne Nutzerbezug) für die Kennzahlen.
    - Die Teilnehmerliste zeigt dann „Gelöschtes Konto“.
25. **Bilder** werden als Storage-Pfade gespeichert. Der Seed nutzt externe Platzhalter-URLs, und ein Helfer in shared verarbeitet beides.
26. **Testkonten:**
    - Das Passwort kommt aus `.env` (`SEED_TEST_PASSWORD`), weil das Repo öffentlich ist.
    - App-Testkonten bekommen zusätzlich ein Passwort, weil E-Mail-OTP an Fantasie-Adressen nicht zugestellt wird. Ob die App dafür einen Dev-Login baut, entscheidet die App-Session.
27. **Statuswerte** stehen in ASCII (`eingeloest`), Bezeichner sind englisch in snake_case. Die Oberfläche ist deutsch.

**Ergänzt in Phase 2**

28. **Rechte per Standard entzogen:** Neue Tabellen und Funktionen in `public` sind für `anon`/`authenticated` nicht automatisch freigegeben (in diesem Projekt war das vorher anders). Jede Migration vergibt Rechte ausdrücklich.
29. **Grenzen für Angebote:** höchstens 90 Tage Dauer, Beginn höchstens 1 Jahr in der Zukunft, 1–1000 Plätze, 1–20 Plätze pro Person, Originalpreis bis 100.000 €.
30. **Standort-Koordinaten** sind optional (Angebote haben eigene, Pflicht). Das Geocoding übernimmt die Edge Function `geocode` (OpenStreetMap/Nominatim mit Cache), aufrufbar nur von Standort-Accounts und Admins.
31. **Aufrufe zählen:** Derselbe angemeldete Nutzer zählt pro Angebot höchstens einmal in 30 Minuten. Anonyme Aufrufe zählen jedes Mal.
32. **Erinnerungen:** Codes, die erst innerhalb des Erinnerungsfensters geholt werden, bekommen keine Erinnerung.
33. **Fehlercodes:** `message` = Code, `detail` = genauer deutscher Text vom Server (z. B. „Es sind nur noch 2 Plätze frei.“). `parseRpcError()` zeigt bevorzugt diesen Text. Ein Test in `tooling/db` prüft, dass SQL und `packages/shared` dieselben Codes kennen.

**Ergänzt in Phase 3**

34. **Geocoding:** Der öffentliche Nominatim-Server sperrt Anfragen aus der Supabase-Cloud (HTTP 403). Die Edge Function fragt deshalb zuerst Nominatim und weicht dann auf Photon (komoot, ebenfalls OpenStreetMap, ohne Schlüssel) aus. Für den Live-Betrieb mit mehr Last ist ein Anbieter mit eigenem Schlüssel sinnvoll (z. B. Geoapify oder LocationIQ).
35. **Seed:** Alle Testkonten heißen `seed-…@example.com` und haben dasselbe Passwort (`SEED_TEST_PASSWORD` aus `.env`). Unternehmen und Angebote sind erfunden, die Adressen sind echte Straßen in Münster, die Bilder Platzhalter von picsum.photos. Die Zeiten sind relativ zum Einspiel-Zeitpunkt, die Angebote „altern“ also. Den Seed erneut anzupassen ist eine eigene Aufgabe (Abstimmung nötig).
36. **SQL-Tests** legen ihre Fixtures selbst in der Test-Transaktion an und greifen nicht auf den Seed zurück. Nur der Sperr-Test braucht ein holbares Angebot und zwei Nutzer aus dem Seed; fehlen sie, wird er übersprungen.
