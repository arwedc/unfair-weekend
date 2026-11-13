# Spezifikation: Zahlungen mit Stripe (Variante B)

> Wortlaut der Aufgabenstellung (Prompt 3), nur als Markdown gegliedert. Ergänzt um die getroffenen **Entscheidungen**, das **Ergebnis der Doku-Prüfung** und die **Annahmen** am Ende. Die fertige Umsetzung beschreibt [PAYMENTS.md](PAYMENTS.md) (entsteht in Phase 6). Für alles, was hier nicht steht, gelten [SPEC.md](SPEC.md), [BACKEND.md](BACKEND.md) und die Root-[CLAUDE.md](../CLAUDE.md).

Du baust mit mir **Zahlungen direkt in der App** für unsere Plattform: Lokale Unternehmen in Münster stellen kurzfristige, vergünstigte Angebote ein (z. B. Kochkurse), und Nutzer buchen sie in der Mobile App. Bisher holt man einen kostenlosen Code und zahlt vor Ort („Variante A“). Jetzt kommt **Variante B** dazu: Der Nutzer zahlt den Deal-Preis vorab in der App, das Unternehmen bekommt sein Geld nach dem Termin, abzüglich unserer Provision.

**Wichtig:** Diese Arbeit läuft **auf einem eigenen Branch** und hinter einem **Feature-Flag**. Variante A muss in `main` jederzeit unverändert funktionieren. Gleichzeitig arbeiten wir zu zweit an `apps/web` und `apps/mobile` weiter, deshalb sind die Regeln zur Zusammenarbeit unten besonders wichtig.

Wir arbeiten **nur im Stripe-Testmodus (Sandbox)**. Live-Keys gibt es noch nicht und werden nicht verwendet.

---

## Arbeitsweise

- **Lies zuerst:** Root-`CLAUDE.md` (Regeln zur Zusammenarbeit), `docs/SPEC.md`, `docs/BACKEND.md`, `docs/SPEC-WEB.md`, `docs/SPEC-APP.md`, `supabase/`, `packages/shared`, sowie den aktuellen Stand von `apps/web` und `apps/mobile`. Fasse mir zusammen:
  - was schon existiert
  - wo die Zahlung andocken muss (Code holen in der App, Angebote und Teilnehmerliste auf der Website, Admin)
  - was eventuell noch fehlt
- **Branch:** Lege von aktuellem `main` den Branch `payments/stripe` an und arbeite nur dort. Hol dir `main` regelmäßig (mindestens täglich) per Rebase oder Merge rein und löse Konflikte sauber. Teilschritte kommen als **eigene kleine PRs gegen `payments/stripe`**, am Ende gibt es einen PR nach `main`.
- Speichere diese Spezifikation als `docs/SPEC-PAYMENTS.md` und dokumentiere die fertige Umsetzung in `docs/PAYMENTS.md`: Ablauf, Tabellen, Edge Functions, Webhooks, Testanleitung.
- Lege mir einen Umsetzungsplan entlang der Phasen unten vor und **warte auf mein OK**.
- Am Ende jeder Phase:
  - Typecheck, Lint und Tests laufen lassen
  - Commit
  - kurze Zusammenfassung: was gebaut wurde, was offen ist und wie ich es teste
  - dann auf mein OK warten
- Prüfe für alles rund um Stripe die **aktuelle offizielle Stripe-Doku** (Connect, PaymentIntents, Webhooks, React Native SDK, Sandboxes), statt dich auf dein Gedächtnis zu verlassen. Gleiches gilt für Expo und Supabase.
- Frag nach, wenn ich etwas anlegen muss (Stripe-Einstellungen, Apple Merchant ID, Keys) oder eine Entscheidung dich blockiert. Sonst triff sinnvolle Annahmen und dokumentiere sie in `docs/SPEC-PAYMENTS.md` unter „Annahmen“.
- **Skills nutzen:** `supabase` und `postgres-best-practices` (Datenbank, Edge Functions), Expo-Skills und `react-native-skills` (App), `react-best-practices` (Website), `frontend-design` (Checkout-UI).

### Zusammenarbeit (zusätzlich zu den Regeln in der Root-`CLAUDE.md`)

- **Möglichst wenig in fremdem Code anfassen:** Neuen Code in eigene Ordner legen, z. B. `apps/web/.../zahlungen/`, `apps/mobile/features/payments/`, `supabase/functions/stripe-*`. Bestehende Screens nur an klar abgegrenzten Stellen erweitern (Buchungsbutton, Teilnehmerliste, Admin-Einstellungen). Jede solche Stelle im PR erwähnen.
- **Datenbank:** Wir haben ein gemeinsames Supabase-Dev-Projekt in der Cloud. Für diesen Branch gilt eine Ausnahme von „erst mergen, dann pushen“, aber nur für **rein additive Migrationen**:
  - neue Tabellen, Spalten und Funktionen
  - keine Änderungen an bestehenden Tabellen, RPCs oder Policies, die Variante A nutzt

  Solche Migrationen darfst du nach meiner Bestätigung schon vor dem Merge ins Dev-Projekt pushen, damit wir testen können. Neue Regeln schreibst du als **neue Funktionen** (z. B. `start_paid_booking`), nicht als Umbau von `claim_voucher`.

- **Vor jedem `supabase db push` fragst du mich.** Nie die Datenbank zurücksetzen.
- Testdaten mit Präfix „TEST Pay …“.

### Sicherheit (nicht verhandelbar)

- Den Stripe-**Secret-Key** und das Webhook-Secret gibt es **nur als Supabase-Secrets** für die Edge Functions, **nie** in App, Website-Client, Repo oder Logs. In `.env.example` stehen nur Platzhalter.
- App und Website bekommen nur den **Publishable Key**.
- **Beträge berechnet immer der Server** aus der Datenbank, nie der Client.
- Ob bezahlt wurde, entscheidet **nur der verifizierte Webhook** (Signatur prüfen), nie die Rückmeldung der App.
- Alle Stripe-Aufrufe mit **Idempotency-Keys**. Webhooks idempotent verarbeiten, denn dasselbe Event kann mehrfach kommen. Verarbeitete Event-IDs speichern.
- RLS auf allen neuen Tabellen: Nutzer sehen nur ihre eigenen Buchungen, Standorte nur Buchungen ihrer Angebote, Admins alles.

---

## Fachliche Regeln (Variante B)

Vorbild sind **Too Good To Go** (vorab zahlen, Storno bis Frist) und **GetYourGuide** (Auszahlung erst für stattgefundene Buchungen, minus Provision).

- **Feature-Flag:** globale Admin-Einstellung `payments_enabled`, Standard aus. Wenn aus, läuft alles wie bisher (Variante A). Wenn an, sind Angebote nur noch per Bezahlung buchbar. Das Flag wird an **einer** zentralen Stelle ausgewertet (Datenbank + `packages/shared`), nicht verstreut.
- **Provision:** Admin-Einstellung in Prozent, Startwert 15 %. Sie wird beim Buchen berechnet und in der Buchung gespeichert, damit spätere Änderungen alte Buchungen nicht verändern.
- **Partner-Voraussetzung:** Ein Standort kann nur buchbare Angebote einstellen bzw. veröffentlichen, wenn sein Stripe-Konto verifiziert ist (`charges_enabled` und `payouts_enabled`). Sonst gibt es einen Hinweis „Auszahlungen einrichten“ und Angebote bleiben Entwürfe.
- **Buchen in der App:**
  1. Nutzer wählt die Plätze (max. pro Nutzer wie bisher).
  2. Die Plätze werden **10 Minuten reserviert** (atomar, wie bei `claim_voucher` mit Row-Lock, nie überbuchen). Ein Timer ist sichtbar.
  3. Der Nutzer bezahlt im **Stripe PaymentSheet**: Apple Pay, Google Pay, Karte. Prüfe, ob PayPal und Klarna über Stripe in Deutschland verfügbar sind, und schlag sie mir vor.
  4. Webhook `payment_intent.succeeded` → Buchung `bezahlt` → Code wird erzeugt (gleicher Code bzw. dieselbe Einlösung wie bisher) → Beleg per E-Mail über Stripe.
  5. Abbruch, Fehlschlag oder abgelaufener Timer → Reservierung verfällt, Plätze werden frei, der PaymentIntent wird abgebrochen.
  6. **Sonderfall:** Die Zahlung kommt durch, nachdem die Reservierung schon abgelaufen ist. Ist der Platz noch frei, wird die Buchung bestätigt. Sonst gibt es eine automatische Vollerstattung, und der Nutzer bekommt einen klaren Hinweis.
- **Storno durch den Nutzer:**
  - Einzeltermin: bis zur bestehenden Storno-Frist **automatische Vollerstattung**, danach keine Erstattung mehr.
  - Zeitraum: Erstattung bis zum Ende des Zeitraums, solange nicht eingelöst.
- **Absage durch das Unternehmen:** Alle bezahlten Buchungen werden automatisch voll erstattet, ohne Provision für uns. Die Push-Nachricht an die Inhaber läuft über den vorhandenen Mechanismus (`notification_outbox`).
- **No-Show:** Keine Erstattung, das Unternehmen wird trotzdem bezahlt. Bei bezahlten Buchungen gibt es **keine No-Show-Sperre**. „Nicht erschienen“ wird nur noch für die Statistik erfasst.
- **Auszahlung an Unternehmen:**
  - Einzeltermin: nach Ende des Termins plus 24 Std.
  - Zeitraum: nach Einlösung bzw. Ende des Zeitraums plus 24 Std.
  - Jeweils der Betrag minus Provision, per Cron-Job.
- **Rückbuchungen (Chargebacks):** Webhooks `charge.dispute.*` erfassen und im Admin-Bereich anzeigen. Den Swipe bzw. die Einlösung mit Zeitstempel als Beleg bereithalten.

---

## Technische Umsetzung

- **Stripe Connect mit Express-Konten** für die Standorte. Onboarding über die von Stripe gehostete Seite (Account Link). Ein Standort entspricht einem Connect-Konto.
- **Charge-Typ: Separate Charges and Transfers.** Die Zahlung läuft über das Plattform-Konto, nach dem Termin geht ein Transfer an das Connect-Konto, **immer mit `source_transaction`**. Prüfe das gegen die aktuelle Stripe-Doku. Falls Destination Charges mit verzögerter Auszahlung für unseren Fall klar besser oder einfacher sind, begründe es mir, bevor du umschwenkst.
- **Datenbank (neue Tabellen, additiv):**
  - Stripe-Konto pro Standort: Konto-ID, `charges_enabled`, `payouts_enabled`, Status
  - Buchungen bzw. Zahlungen:
    - Status `reserviert` → `bezahlt` → `storniert`/`erstattet`/`eingelöst`/`no_show`/`ausgezahlt`
    - Betrag, Provision, PaymentIntent-ID, `reserviert_bis`
    - Verknüpfung zum Code
  - Erstattungen und Transfers (Stripe-IDs, Beträge, Status)
  - verarbeitete Webhook-Events (für Idempotenz)
  - neue Einstellungen: `payments_enabled`, Provision in %
- **Edge Functions:**
  - `stripe-connect-onboarding`: Konto anlegen bzw. Account Link erzeugen
  - `stripe-create-booking`: reservieren und PaymentIntent anlegen, gibt `client_secret` zurück
  - `stripe-cancel-booking`: Frist prüfen, erstatten
  - `stripe-webhook`: alle Stripe-Events
  - `stripe-payouts`: Transfers nach dem Termin, per pg_cron
  - Absagen eines Angebots löst die Erstattungen aus
- **pg_cron:**
  - abgelaufene Reservierungen jede Minute freigeben
  - fällige Auszahlungen regelmäßig anstoßen
- **App:** `@stripe/stripe-react-native` (Config-Plugin, Development Build), PaymentSheet im Design unserer Tokens (Appearance API), Apple Pay mit Merchant-ID, Google Pay aktiviert. Die App zeigt den Buchungsstatus live (Supabase Realtime) statt sich auf die PaymentSheet-Rückmeldung zu verlassen.
- **Website (Standorte):**
  - Seite „Auszahlungen“: Onboarding-Status, Link zum Stripe-Express-Dashboard, Übersicht der Buchungen mit Brutto, Provision, Netto und Auszahlungsstatus
  - In der Teilnehmerliste ist sichtbar, wer bezahlt hat.
- **Admin:**
  - Flag `payments_enabled` und Provision einstellen
  - Übersicht aller Zahlungen, Erstattungen, Auszahlungen und Rückbuchungen
  - Umsatz und Provision pro Woche
- **`packages/shared`:** Typen, Status, Fehlercodes und Preis- bzw. Provisionsberechnung für Zahlungen

---

## Tests (Sandbox)

- Lokales Testen der Webhooks mit der Stripe CLI (`stripe listen` → Supabase Edge Function).
- SQL-Tests für die neuen Funktionen, unter anderem parallele Reservierungen auf den letzten Platz.
- **Szenarien, die alle durchgespielt und in `docs/PAYMENTS.md` als Checkliste festgehalten werden:**
  1. erfolgreiche Zahlung (Karte, Apple Pay, Google Pay)
  2. Zahlung mit 3D Secure
  3. abgelehnte Karte
  4. Abbruch im PaymentSheet
  5. Timer läuft ab
  6. Zahlung kommt nach Ablauf des Timers (Platz frei bzw. Platz weg)
  7. Storno vor der Frist (Erstattung)
  8. Storno nach der Frist (abgelehnt)
  9. Absage durch das Unternehmen (alle erstattet)
  10. No-Show (keine Erstattung, Auszahlung erfolgt)
  11. Auszahlung nach dem Termin
  12. Rückbuchung (Dispute)
  13. doppelt eintreffender Webhook
  14. Standort ohne verifiziertes Stripe-Konto
  15. Flag aus, Variante A funktioniert unverändert

---

## Phasen

0. **Analyse & Setup:**
   - Code lesen, Branch anlegen, Zusammenfassung, Plan
   - Liste, was ich in Stripe, Apple und Supabase selbst einrichten muss
1. **Datenbank:** additive Migration, RLS, neue Funktionen (Reservieren, Bestätigen, Freigeben, Storno-Prüfung, Auszahlung fällig), Einstellungen, Tests
2. **Stripe-Backend:** Edge Functions inkl. Webhook, Idempotenz, pg_cron-Jobs, mit der Stripe CLI getestet
3. **Website:** Stripe-Onboarding für Standorte, Seite „Auszahlungen“, Bezahlstatus in der Teilnehmerliste, Admin (Flag, Provision, Zahlungsübersicht)
4. **App:** PaymentSheet-Checkout mit Timer, Live-Status, Storno mit Erstattung, Anzeige „bezahlt“ im Code, Apple Pay und Google Pay auf echten Geräten getestet
5. **Absage, Auszahlungen, Rückbuchungen:** komplett durchspielen
6. **Abschluss:**
   - alle Testszenarien abhaken
   - `docs/PAYMENTS.md` schreiben
   - Checkliste „Was fehlt für den Live-Betrieb“: Aktivierung des Stripe-Kontos, Rechtsform, AGB, Steuern, Live-Keys, Webhook-Endpunkt live
   - PR nach `main` mit Flag standardmäßig **aus**

---

## Entscheidungen

Mit Ben abgestimmt (13.11.2026):

| Thema                        | Entscheidung                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrationen                  | **Früh nach `main`.** Die Supabase CLI bricht `db push` ab, wenn im Dev-Projekt Migrationen liegen, die lokal fehlen. Jede rein additive Zahlungs-Migration geht deshalb nach dem Push als kleiner PR `db/payments-…` nach `main` (Flag aus, ruhend). App-, Web- und Function-Code bleiben bis zum End-PR auf `payments/stripe`. Vor jedem `db push` fragt Claude nach (strenger als die Root-`CLAUDE.md`). |
| Website                      | **Eigene Bereiche.** `apps/web` hat noch keinen Admin-Bereich und keine Teilnehmerliste. Claude baut `auszahlungen/` (Standort) und `admin/zahlungen/` (Admin) in eigenen Ordnern. Fremder Code nur an genannten Stellen: Login-Action, Navigation, Proxy-Matcher, Hinweis beim Anlegen eines Angebots.                                                                                                     |
| Serverseitige Sperren        | **Neue Trigger** auf den bestehenden Tabellen `vouchers` (2×) und `offers` (1×), die bei Flag aus nichts tun. `claim_voucher`, `mark_no_show` und die übrigen Funktionen von Variante A bleiben unverändert.                                                                                                                                                                                                |
| Testgeräte                   | **Erst nur Expo Go.** Getestet werden Karte und 3D Secure. Apple Pay und Google Pay werden vorbereitet und getestet, sobald ein Apple-Developer-Konto bzw. ein Android-Development-Build da ist.                                                                                                                                                                                                            |
| Charge-Typ                   | **Separate Charges and Transfers** mit `source_transaction`, wie vorgegeben (Begründung unten).                                                                                                                                                                                                                                                                                                             |
| Arbeitsordner                | Eigener Git-Worktree (`.claude/worktrees/payments`), weil im Haupt-Checkout parallel eine andere Session arbeitet.                                                                                                                                                                                                                                                                                          |
| Name der Auszahlungsfunktion | `stripe-worker` statt `stripe-payouts`: Dieselbe Function bricht auch PaymentIntents abgelaufener Reservierungen ab und führt Erstattungen aus Absagen aus.                                                                                                                                                                                                                                                 |

## Ergebnis der Doku-Prüfung (13.11.2026)

Geprüft in der offiziellen Doku von Stripe, Expo und Supabase.

- **Separate Charges and Transfers passt besser als Destination Charges.**
  - Das Geld geht erst nach dem Termin raus und nur für Buchungen, die nicht erstattet wurden.
  - Destination Charges überweisen schon beim Bezahlen. Dann bräuchte jede Erstattung vor dem Termin eine Rückbuchung des Transfers (die nur geht, solange das Konto des Standorts genug Guthaben hat). Auszahlungseinstellungen lassen sich zudem nicht über Accounts v2 steuern.
  - Mit `source_transaction` gelingt der Transfer sofort und wird ausgeführt, sobald das Geld der Zahlung verfügbar ist.
- **Folgen von Separate Charges:**
  - Die Plattform ist gegenüber dem Kunden Händler: Ihr Name steht auf der Abrechnung, sie verschickt die Belege und trägt Rückbuchungen.
  - Die Stripe-Gebühren trägt immer die Plattform. Bei Erstattungen gibt Stripe die Gebühr nicht zurück.
  - Stripe empfiehlt diesen Charge-Typ nur, wenn die Plattform für negative Salden der verbundenen Konten haftet. Das ist bei Express-Konten ohnehin so.
- **Konten der Standorte (Accounts v2):**
  - Stripe empfiehlt für neue Plattformen Accounts v2 statt `type: express`. Die Entsprechung ist ein Konto mit der Konfiguration `recipient` (Fähigkeit `stripe_transfers`) und `dashboard: express`, bei dem Verluste und Gebühren die Plattform trägt.
  - Das Onboarding läuft über die von Stripe gehostete Seite (`v2/core/account_links`).
  - Ob das in der Sandbox ohne Preview-Freischaltung geht, klärt ein kurzer Test zu Beginn von Phase 2. Sonst nutzen wir Accounts v1 mit Controller-Properties, das entspricht einem Express-Konto. Das Datenbankschema ist für beide gleich.
- **„Verifiziert“** heißt bei Separate Charges: Transfers aktiv und Auszahlungen aktiv. Ein Standort nimmt selbst keine Zahlungen an, `charges_enabled` braucht er deshalb nicht. Wir speichern es trotzdem.
- **PayPal und Klarna** (Vorschlag):
  - **Klarna:** in Deutschland verfügbar, mit allen Charge-Typen nutzbar, im PaymentSheet unterstützt (braucht eine Rücksprung-URL in die App). Optional in Phase 4 in der Sandbox aktivieren.
  - **PayPal:** in Deutschland verfügbar und mit Separate Charges nutzbar. Marktplätze müssen es aber erst bei Stripe beantragen („Request access“). Vor dem Live-Start beantragen.
- **Keine verzögerten Zahlungsmethoden** wie SEPA-Lastschrift, weil die Reservierung nach 10 Minuten verfällt.
- **Belege per E-Mail:** Im Testmodus verschickt Stripe keine automatischen Belege. `receipt_email` wird trotzdem gesetzt, im Dashboard lässt sich der Beleg manuell senden. Live geht er automatisch raus.
- **Expo:** `@stripe/stripe-react-native` ist in Expo Go enthalten (SDK 58: Version 0.81.0). Apple Pay und Google Pay gehen nur im Development Build.
- **Webhooks:**
  - Supabase Edge Functions prüfen die Signatur mit `constructEventAsync` und `createSubtleCryptoProvider()`.
  - Ohne Docker gibt es kein lokales `functions serve`, die Functions laufen deshalb im Dev-Projekt. Die Stripe CLI dient für `stripe trigger`, `stripe events resend` und `stripe listen --forward-to <Dev-URL>`.

## Annahmen

Getroffen, weil sie nicht blockieren. Widerspruch jederzeit möglich.

1. **Einstellungen in eigener Tabelle.**
   - `payment_settings` mit genau einer Zeile: `payments_enabled` (aus), Provision in Basispunkten (`commission_bps`, 1500 = 15 %), Reservierungsdauer (10 Min.), Auszahlungsverzug (24 Std.).
   - Bestehende Teile bleiben unverändert: `settings`, `update_settings` und `settingsSchema`.
   - Das Flag wird zentral ausgewertet: in der DB über `private.payments_enabled()`, in `@repo/shared` über `bookingMode()`.
2. **Provision** wird ganzzahlig in Cent berechnet, kaufmännisch gerundet, in SQL und `@repo/shared` mit derselben Formel: `(Betrag × bps + 5000) / 10000`.
3. **Plätze:** Die Reservierung erhöht `seats_taken` unter dem Row-Lock des Angebots. Beim Bestätigen gehen die Plätze auf den neuen Code über, ohne doppelt zu zählen. Beim Verfallen werden sie wieder abgezogen.
4. **Status einer Buchung:** `reserviert`, `bezahlt`, `storniert`, `erstattet`, `eingeloest`, `no_show`, `ausgezahlt`, dazu `abgelaufen` (Reservierung ohne Zahlung verfallen). `eingeloest` und `no_show` übernimmt die Buchung vom Code.
5. **„Angebote bleiben Entwürfe“:** Entwürfe gibt es im System nicht, Angebote sind sofort live. Bei Flag an lehnt die Datenbank neue Angebote von Standorten ohne bereites Stripe-Konto ab (`AUSZAHLUNGEN_EINRICHTEN`). Die Website zeigt vorher den Hinweis „Auszahlungen einrichten“.
6. **Fällige Auszahlung:**
   - Einzeltermin: Ende + 24 Std.
   - Zeitraum: Einlösung + 24 Std., spätestens Ende + 24 Std.
   - Ausgezahlt werden alle nicht stornierten Buchungen, auch No-Shows und abgelaufene Codes.
7. **Storno-Wege:** Jeder Weg, auf dem ein bezahlter Code storniert wird, löst eine Erstattung aus: Storno in der App, `cancel_voucher`, Absage, Entfernen durch den Admin, Sperre des Standorts. Die Fristen prüfen die bestehenden Funktionen.
8. **Kontolöschung:** Vor der Storno-Frist wird erstattet. Danach nicht, und das Unternehmen wird bezahlt.
9. **Absage nach der Auszahlung:** Erstattung und Rückholung des Transfers laufen automatisch. Gelingt die Rückholung nicht, erscheint der Fall im Admin-Bereich zur manuellen Klärung.
10. **Mindestbetrag 0,50 € pro Buchung** (Minimum von Stripe). Kostenlose Deals sind bei Flag an nicht buchbar (`BETRAG_ZU_GERING`).
11. **Rückbuchungen** werden erfasst und mit Belegen angezeigt: Einlösezeit, Kurzcode, Zahlzeit. Die Antwort an Stripe gibt der Admin im Stripe-Dashboard ab. Ein Transfer wird nicht automatisch zurückgeholt.
12. **Verspätete Zahlung ohne freien Platz:** Der Hinweis erscheint in der App am Buchungsstatus (Realtime), nicht per Push. `send-push` bleibt unverändert, der Absage-Push kommt wie bisher.
13. **Flag umschalten:**
    - Bestehende Gratis-Codes bleiben gültig.
    - Schaltet der Admin das Flag aus, laufen bezahlte Buchungen weiter (Storno, Erstattung, Auszahlung).
    - Vor dem Einschalten warnt der Admin-Bereich vor aktiven Angeboten von Standorten ohne bereites Stripe-Konto.
14. **No-Show bei bezahlten Codes:**
    - Das bestehende `mark_no_show` lehnt bezahlte Codes ab (`NO_SHOW_BEZAHLT`).
    - Dafür gibt es `mark_paid_no_show`, das nur den Status setzt, ohne Zähler und ohne Sperre.
    - Eine Teilnehmerliste mit diesen Funktionen gibt es in der Website noch nicht. Das neue RPC `get_offer_participants_paid` liefert dafür den Bezahlstatus.
15. **Stripe-Aufrufe** tragen Idempotency-Keys aus festen IDs: `booking:<id>:pi`, `booking:<id>:refund`, `booking:<id>:transfer`, `booking:<id>:pi-cancel`, `location:<id>:account`.
16. **Webhooks:** Jedes Event wird mit seiner ID gespeichert. Ein bereits verarbeitetes Event wird mit 200 quittiert und nicht erneut ausgeführt. Die Verarbeitung selbst ist ebenfalls idempotent.
17. **Secrets:**
    - **Edge Functions:** Die Stripe-Keys setzt Ben selbst als Supabase-Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`).
    - **Root-`.env`:** Dort steht der Sandbox-Secret-Key nur für das lokale Testskript.
    - **App:** Sie bekommt nur `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Die Website braucht keinen Stripe-Key, ihr Onboarding läuft über die Edge Function.
18. **Hintergrund-Worker:** Er nutzt dieselben Vault-Secrets wie der Push-Versand (`project_url`, `push_worker_key`).
