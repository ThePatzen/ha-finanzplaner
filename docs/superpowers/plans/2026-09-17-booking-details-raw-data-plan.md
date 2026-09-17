# Buchungsdetails und verlustfreie Quelldaten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ("- [ ]") syntax for tracking.

**Goal:** Ungeklärte und übernommene Buchungen erhalten ein gemeinsames Detail-Popup mit allen gespeicherten Erkennungsdaten sowie einer maskierten, verlustfreien Rohdatenansicht.

**Architecture:** Die bestehenden normalisierten Buchungsfelder bleiben unverändert und werden um optionale source_data ergänzt. Parser liefern intern zusätzlich zu Booking einen vollständigen Quelldatensatz; die bisherigen Parserfunktionen bleiben als kompatible Wrapper bestehen. Ein authentifizierter Detail-Endpunkt liefert die Quelle nur auf ausdrückliche Anfrage, und ein gemeinsames natives dialog-Element rendert fachliche Details sowie escaped JSON im bestehenden Vanilla-Panel.

**Tech Stack:** Python 3, Home-Assistant HomeAssistantView, versionierter JSON-Store, xml.etree.ElementTree, Vanilla HTML/CSS/clientseitiges JavaScript, natives dialog, Python unittest, Node --test.

**Spec:** docs/superpowers/specs/2026-09-17-booking-details-raw-data-design.md

## Global Constraints

- MT940 und CAMT.053 bleiben die einzigen Bankformate; die bestehende Fingerprint- und Matching-Logik bleibt fachlich stabil.
- Originaldateien werden nicht als separates Downloadarchiv gespeichert; die vollständige Quelle jedes Buchungssatzes wird lokal in source_data erhalten.
- Vollständige IBANs und Kontoreferenzen bleiben ausschließlich im lokalen Store; jede API-Antwort und die Rohdatenansicht maskieren sie über _response_payload.
- Listen-Endpunkte liefern keine großen Rohdaten; Quelldaten werden ausschließlich über GET /api/finanzplaner/bookings/{booking_id}/details geladen.
- Bestehende POST-, Zuordnungs-, Auswahl-, Lösch- und Regelaktionen dürfen nicht verändert werden.
- Die native Panel-Oberfläche bleibt frameworkfrei; Rohdaten werden als Text über textContent ausgegeben und nie als HTML interpretiert.
- Vor Frontend-Änderungen sind modern-web-guidance, frontend-design und das Projektprofil $impeccable anzuwenden; der Dialog erhält sichtbaren Fokus, klare Beschriftung und mobile Scrollbarkeit.
- Jede Aufgabe folgt TDD: Test schreiben, gezielt rot ausführen, minimal implementieren, gezielt grün ausführen, committen.

## Dateistruktur

- Create: custom_components/finanzplaner/booking_source.py — XML-Quellbaum und formatunabhängige JSON-Strukturen für verlustfreie Parserdaten.
- Modify: custom_components/finanzplaner/core.py — interne ParsedBooking-Schnittstelle und kompatible MT940-/CAMT.053-Parser-Wrapper.
- Modify: custom_components/finanzplaner/http.py — Import-Anreicherung, List-Projektionen, Detail-Projektion und neuer GET-Endpunkt.
- Modify: custom_components/finanzplaner/__init__.py — Registrierung des Detail-Endpunkts.
- Modify: custom_components/finanzplaner/frontend/panel-utils.mjs — URL- und JSON-Helfer für testbare Frontend-Logik.
- Modify: custom_components/finanzplaner/frontend/panel.js — gemeinsames Detaildialog-Markup, Ladezustände, Aktionen und Styles.
- Modify: tests/test_finanzplaner_core.py — Parser- und Quelltreibertests.
- Modify: tests/test_account_import.py — Persistenz, ZIP-Bezug und Duplikatverhalten.
- Modify: tests/test_rule_payloads.py — Detail-API, Maskierung, Authentifizierung und Registrierung.
- Modify: custom_components/finanzplaner/frontend/panel-utils.test.mjs — Frontend-Helfertests.
- Modify: tests/test_panel_static_assets.py — statische Vertragsprüfungen für das gemeinsame Popup.
- Modify: PRODUCT.md, README.md, CHANGELOG.md — Aufbewahrung der Buchungssatz-Quelldaten dokumentieren.

---

### Task 1: Verlustfreie Parserdatensätze einführen

**Files:**
- Create: custom_components/finanzplaner/booking_source.py
- Modify: custom_components/finanzplaner/core.py:2020-2130
- Test: tests/test_finanzplaner_core.py:ImportTests

**Interfaces:**

- Consumes: Rohtext aus MT940 oder CAMT.053.
- Produces:
  - source_xml_node(element: xml.etree.ElementTree.Element) -> dict[str, object]
  - ParsedBooking(booking: Booking, source_data: dict[str, object])
  - parse_mt940_records(raw: str) -> list[ParsedBooking]
  - parse_camt053_records(raw: str) -> list[ParsedBooking]
  - Die bestehenden parse_mt940(raw) und parse_camt053(raw) liefern weiterhin list[Booking].

- [ ] **Step 1: Schreibe den roten MT940-Test.**

Erweitere ImportTests um einen Test, der einen unbekannten Tag und eine
Fortsetzungszeile enthält und die Reihenfolge der Rohzeilen prüft:

~~~python
def test_mt940_records_keep_unknown_tags_and_continuations(self):
    core = load_core()
    raw = (
        ':20:STATEMENT-1\n'
        ':25:AT123456789012345678\n'
        ':61:2609020902D42,50NTRFNONREF\n'
        ':86:Hundefutter\n'
        ':99:Bankeigene Zusatzinformation\n'
        'weitere Zusatzinformation\n'
    )

    records = core.parse_mt940_records(raw)

    self.assertEqual(len(records), 1)
    self.assertEqual(records[0].booking.purpose, 'Hundefutter')
    self.assertEqual(
        records[0].source_data['record']['lines'],
        [
            ':61:2609020902D42,50NTRFNONREF',
            ':86:Hundefutter',
            ':99:Bankeigene Zusatzinformation',
            'weitere Zusatzinformation',
        ],
    )
    self.assertIn(':20:STATEMENT-1', records[0].source_data['context']['lines'])
    self.assertIn(':25:AT123456789012345678', records[0].source_data['context']['lines'])
~~~

- [ ] **Step 2: Schreibe den roten CAMT.053-Test.**

Erweitere ImportTests um eine CAMT-Buchung mit einem unbekannten,
verschachtelten Knoten:

~~~python
def test_camt_records_keep_unknown_nested_transaction_data(self):
    core = load_core()
    raw = '''<Document xmlns="urn:test">
      <BkToCstmrStmt><Stmt>
        <Acct><Id><IBAN>AT123456789012345678</IBAN></Id></Acct>
        <Ntry>
          <Amt Ccy="EUR">12.50</Amt><CdtDbtInd>DBIT</CdtDbtInd>
          <BookgDt><Dt>2026-09-04</Dt></BookgDt>
          <NtryDtls><TxDtls><RmtInf><Ustrd>Testkauf</Ustrd></RmtInf>
            <UnknownBankData code="X7"><Value>nicht verlieren</Value></UnknownBankData>
          </TxDtls></NtryDtls>
        </Ntry>
      </Stmt></BkToCstmrStmt>
    </Document>'''

    records = core.parse_camt053_records(raw)

    self.assertEqual(len(records), 1)
    xml_record = records[0].source_data['record']
    self.assertEqual(xml_record['name'], 'Ntry')
    unknown = str(xml_record)
    self.assertIn('UnknownBankData', unknown)
    self.assertIn('nicht verlieren', unknown)
    self.assertIn('X7', unknown)
~~~

- [ ] **Step 3: Führe nur die Parser-Tests aus und bestätige den roten Zustand.**

Run: python3 -m unittest discover -s tests -p 'test_finanzplaner_core.py' -v  
Expected: FAIL, weil parse_mt940_records, parse_camt053_records und die
Quellrepräsentation noch fehlen.

- [ ] **Step 4: Implementiere die formatunabhängige XML-Repräsentation.**

Erstelle booking_source.py mit einer rekursiven Funktion, die jeden
Elementnamen, Namespace, jedes Attribut, Text, Tail-Text und alle Kinder
übernimmt:

~~~python
def source_xml_node(element: Element) -> dict[str, object]:
    namespace, separator, name = element.tag.partition('}')
    if separator:
        namespace = namespace.removeprefix('{')
    else:
        namespace = ''
    return {
        'name': name if separator else element.tag,
        'namespace': namespace,
        'attributes': dict(element.attrib),
        'text': element.text or '',
        'tail': element.tail or '',
        'children': [source_xml_node(child) for child in element],
    }
~~~

Die Funktion darf keine bekannten Feldnamen filtern oder XML-Unterknoten
ignorieren.

- [ ] **Step 5: Implementiere interne Parser und kompatible Wrapper.**

Ergänze in core.py:

~~~python
@dataclass(frozen=True, slots=True)
class ParsedBooking:
    booking: Booking
    source_data: dict[str, object]
~~~

Extrahiere die bisherige MT940-/CAMT-Normalisierung in
parse_mt940_records beziehungsweise parse_camt053_records. Der MT940-Parser
sammelt für jeden Abschnitt alle Originalzeilen vom :61: bis vor den nächsten
:61:; Zeilen vor dem ersten :61: und der aktuelle Kontokontext landen in
context.lines. Der record-Wert des MT940-Quellobjekts trägt kind:
mt940_transaction und enthält lines. Der CAMT-Parser speichert den kompletten <Ntry>-Baum über
source_xml_node sowie den relevanten Statement-/Kontokontext. Die Wrapper
bleiben:

~~~python
def parse_mt940(raw: str) -> list[Booking]:
    return [record.booking for record in parse_mt940_records(raw)]

def parse_camt053(raw: str) -> list[Booking]:
    return [record.booking for record in parse_camt053_records(raw)]
~~~

Die bisherigen normalisierten Werte, Fingerprints und Fehlerfälle bleiben
unverändert.

- [ ] **Step 6: Führe Parser- und Regressionstests grün aus.**

Run: python3 -m unittest discover -s tests -p 'test_finanzplaner_core.py' -v  
Expected: PASS, einschließlich der bisherigen Parser-Tests und der neuen
Verlustfreiheitstests.

- [ ] **Step 7: Committe den Parser-Schritt.**

~~~bash
git add custom_components/finanzplaner/booking_source.py custom_components/finanzplaner/core.py tests/test_finanzplaner_core.py
git commit -m 'Preserve complete booking source records'
~~~

---

### Task 2: Quelldaten beim Einzel- und ZIP-Import speichern

**Files:**
- Modify: custom_components/finanzplaner/http.py:16-2300
- Modify: tests/test_account_import.py:153-390

**Interfaces:**

- Consumes: ParsedBooking aus Task 1 und bestehende Import-/Duplikatlogik.
- Produces: Persistierte neue Buchungen mit source_data.format,
  filename, file_sha256, record_index, record und context; bestehende Listen-
  und Vorschauantworten ohne die großen Quelldaten.

- [ ] **Step 1: Schreibe Persistenztests für Einzeldatei, ZIP und Duplikat.**

Erweitere BankImportViewTests:

~~~python
def test_import_persists_complete_source_data_and_file_metadata(self):
    raw = (
        ':20:STATEMENT-42\n'
        ':25:BANK-ACCOUNT-42\n'
        ':61:2609020902D42,50NTRFNONREF\n'
        ':86:Testkauf\n'
        ':99:Zusatzfeld\n'
    )

    self._import('statement.sta', raw)
    booking = self.coordinator.store.data['bookings'][0]

    self.assertEqual(booking['source_data']['format'], 'MT940')
    self.assertEqual(booking['source_data']['filename'], 'statement.sta')
    self.assertEqual(booking['source_data']['record_index'], 0)
    self.assertEqual(booking['source_data']['record']['lines'][-1], ':99:Zusatzfeld')
    self.assertEqual(len(booking['source_data']['file_sha256']), 64)

def test_duplicate_import_does_not_replace_existing_source_data(self):
    first_raw = ':20:FIRST\n:25:ACCOUNT\n:61:2609020902D1,00NTRFFIRST\n'
    second_raw = ':20:SECOND\n:25:ACCOUNT\n:61:2609020902D1,00NTRFFIRST\n'

    self._import('first.sta', first_raw)
    self._import('second.sta', second_raw)

    booking = self.coordinator.store.data['bookings'][0]
    self.assertEqual(booking['source_data']['filename'], 'first.sta')
~~~

Ergänze im ZIP-Test Assertions für je einen filename, format,
file_sha256 und record_index pro akzeptierter Buchung.

- [ ] **Step 2: Führe die neuen Importtests rot aus.**

Run: python3 -m unittest discover -s tests -p 'test_account_import.py' -v  
Expected: FAIL, weil der Import weiterhin nur Booking ohne source_data
verarbeitet.

- [ ] **Step 3: Verbinde ImportView mit den Record-Parsern.**

Importiere parse_mt940_records, parse_camt053_records und ParsedBooking.
Ändere _parse_bank_file und _archive_files so, dass sie ParsedBooking-Listen
weiterreichen, ohne die bestehende Dateivalidierung, Größenbegrenzung oder
ZIP-Pfadprüfung zu verändern.

Berechne für jede Quelldatei ihren Hash einmal und erweitere beim Erzeugen
des Payloads die Quelldaten:

~~~python
source_data = {
    **parsed.source_data,
    'format': format_name,
    'filename': source_filename,
    'file_sha256': source_hash,
    'record_index': record_index,
}
payload = _booking_payload(parsed.booking)
payload['source_data'] = source_data
~~~

Für Duplikate wird dieser Block nicht gespeichert. accepted und die
automatische Regelanwendung arbeiten weiterhin mit den normalen Payloads.

- [ ] **Step 4: Begrenze Listen- und Vorschauantworten auf Fach-/Metadaten.**

Ergänze eine kleine Projektion in http.py, die source_data aus normalen
Listen- und Importvorschauobjekten entfernt. Verwende sie in
UnresolvedBookingsView, ResolvedBookingsView und ImportView nur für die
Antwort; der lokale Store behält die Quelle vollständig. Die Detailansicht
aus Task 3 liest die Quelle direkt aus dem Store.

- [ ] **Step 5: Führe Import- und Regressionstests grün aus.**

Run: python3 -m unittest discover -s tests -p 'test_account_import.py' -v  
Expected: PASS, einschließlich bestehender Kontoerkennung, Regelübernahme,
Duplikaterkennung und ZIP-Import.

- [ ] **Step 6: Committe die Importpersistenz.**

~~~bash
git add custom_components/finanzplaner/http.py tests/test_account_import.py
git commit -m 'Persist source data for imported bookings'
~~~

---

### Task 3: Authentifizierten Detail-Endpunkt ergänzen

**Files:**
- Modify: custom_components/finanzplaner/http.py:1820-2030
- Modify: custom_components/finanzplaner/__init__.py:15-85
- Test: tests/test_rule_payloads.py:825-925

**Interfaces:**

- Consumes: Persistierte Buchung mit optionalem source_data, Account-Projektion,
  Regelvorschlag und bestehende _response_payload-Maskierung.
- Produces:
  - BookingDetailsView
  - GET /api/finanzplaner/bookings/{booking_id}/details
  - JSON mit booking, account, details und source_data.

- [ ] **Step 1: Schreibe Tests für beide Statusarten, 404 und Auth.**

Ergänze in RuleViewTests eine gemeinsame Buchung mit source_data, einen
ungeklärten Fall und einen übernommenen Fall. Prüfe:

~~~python
def test_booking_details_expose_unresolved_context_and_source(self):
    result = asyncio.run(
        self.http.BookingDetailsView().get(
            self._request(authenticated=True), 'booking-unresolved'
        )
    )

    self.assertEqual(result['booking']['id'], 'booking-unresolved')
    self.assertEqual(result['details']['status'], 'unresolved')
    self.assertIn('source_data', result)
    self.assertEqual(result['source_data']['record']['kind'], 'mt940_transaction')
    self.assertEqual(result['account']['label'], 'Gemeinsames Girokonto')
    self.assertNotIn('AT123456789012345678', str(result))

def test_booking_details_expose_resolved_allocations_and_rule(self):
    result = asyncio.run(
        self.http.BookingDetailsView().get(
            self._request(authenticated=True), 'booking-resolved'
        )
    )

    self.assertEqual(result['details']['status'], 'resolved')
    self.assertEqual(result['details']['allocations'][0]['target'], 'household')
    self.assertEqual(result['details']['matched_rule']['rule_label'], 'Supermarkt Haushalt')

def test_booking_details_require_authentication(self):
    with self.assertRaises(self.unauthorized):
        asyncio.run(
            self.http.BookingDetailsView().get(
                self._request(authenticated=False), 'booking-unresolved'
            )
        )

def test_booking_details_return_not_found_for_unknown_id(self):
    with self.assertRaises(self.not_found):
        asyncio.run(
            self.http.BookingDetailsView().get(
                self._request(), 'booking-missing'
            )
        )
~~~

Erweitere den Registrierungstest um BookingDetailsView und prüfe
requires_auth is True.

- [ ] **Step 2: Führe den API-Test rot aus.**

Run: python3 -m unittest tests.test_rule_payloads.RuleViewTests -v  
Expected: FAIL, weil BookingDetailsView noch nicht existiert.

- [ ] **Step 3: Implementiere eine gemeinsame Detailprojektion.**

Ergänze eine private Funktion, die eine gespeicherte Buchung sowie den
aktuellen Account-Kontext und statusabhängige Erkennungsdaten zusammenstellt:

~~~python
def _booking_details_payload(
    coordinator: FinanzplanerCoordinator,
    hass: Any,
    booking: dict[str, object],
) -> dict[str, object]:
    suggestion = {}
    if booking.get('status') != 'resolved':
        suggestion = rule_suggestion(
            booking,
            _rule_list(coordinator),
            accounts=_rule_accounts(coordinator),
            valid_targets=_valid_plan_targets(hass),
            catalogs=_rule_catalogs(coordinator),
            pets=_pet_records(coordinator),
        )
    account = _rule_accounts(coordinator).get(booking.get('account_id'))
    return {
        'booking': {key: value for key, value in booking.items() if key != 'source_data'},
        'account': account_payload(account) if isinstance(account, dict) else None,
        'details': {
            'status': booking.get('status'),
            'suggestion': suggestion.get('suggestion'),
            'suggestion_status': suggestion.get('status'),
            'conflicts': suggestion.get('conflicts', []),
            'matched_rule': booking.get('matched_rule'),
            'allocations': booking.get('allocations', []),
        },
        'source_data': booking.get('source_data'),
    }
~~~

Die tatsächlich zurückgegebene Struktur wird abschließend mit
_response_payload maskiert. Die Projektion darf den Store nicht verändern.

- [ ] **Step 4: Implementiere und registriere den GET-View.**

Ergänze:

~~~python
class BookingDetailsView(HomeAssistantView):
    url = '/api/finanzplaner/bookings/{booking_id}/details'
    name = 'api:finanzplaner:booking:details'
    requires_auth = True

    async def get(self, request: web.Request, booking_id: str) -> web.Response:
        coordinator = _coordinator(request.app['hass'])
        if coordinator is None:
            raise web.HTTPBadRequest(text='Finanzplaner ist nicht eingerichtet.')
        booking = next(
            (
                item for item in coordinator.store.data.get('bookings', [])
                if isinstance(item, dict) and item.get('id') == booking_id
            ),
            None,
        )
        if booking is None:
            raise web.HTTPNotFound(text='Buchung nicht gefunden.')
        return self.json(
            _response_payload(
                _booking_details_payload(coordinator, request.app['hass'], booking)
            )
        )
~~~

Importiere den View in async_setup und registriere ihn vor
BookingAssignmentView, damit die spezifische /details-Route nicht mit der
bestehenden allgemeinen Buchungsroute kollidiert.

- [ ] **Step 5: Führe API- und Regressionstests grün aus.**

Run: python3 -m unittest tests.test_rule_payloads.RuleViewTests -v  
Expected: PASS, einschließlich der bestehenden Regel-, Lösch-, Listen- und
Registrierungstests.

- [ ] **Step 6: Committe den Detail-Endpunkt.**

~~~bash
git add custom_components/finanzplaner/http.py custom_components/finanzplaner/__init__.py tests/test_rule_payloads.py
git commit -m 'Expose authenticated booking details'
~~~

---

### Task 4: Testbare Frontend-Helfer für Detail-URL und Rohdaten

**Files:**
- Modify: custom_components/finanzplaner/frontend/panel-utils.mjs:1-180
- Modify: custom_components/finanzplaner/frontend/panel-utils.test.mjs

**Interfaces:**

- Consumes: Basisroute und JSON-Antwort des Detail-Endpunkts.
- Produces:
  - bookingDetailsRequestUrl(baseUrl: string, bookingId: string) -> string
  - bookingDetailRawJson(detail: object) -> string

- [ ] **Step 1: Schreibe die roten Node-Tests.**

Ergänze:

~~~javascript
test('bookingDetailsRequestUrl encodes the booking id', () => {
  assert.equal(
    bookingDetailsRequestUrl('/api/finanzplaner/bookings', 'booking/42'),
    '/api/finanzplaner/bookings/booking%2F42/details',
  );
});

test('bookingDetailRawJson creates readable JSON without HTML interpretation', () => {
  const raw = bookingDetailRawJson({ booking: { purpose: '<Bank> & Zusatz' } });
  assert.match(raw, /\n  "booking":/);
  assert.match(raw, /<Bank> & Zusatz/);
});
~~~

- [ ] **Step 2: Führe den Node-Test rot aus.**

Run: node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs  
Expected: FAIL, weil die Helfer noch nicht exportiert werden.

- [ ] **Step 3: Implementiere die beiden reinen Helfer.**

Ergänze in panel-utils.mjs:

~~~javascript
export function bookingDetailsRequestUrl(baseUrl, bookingId) {
  return String(baseUrl).replace(/\/$/, '') + '/' + encodeURIComponent(String(bookingId)) + '/details';
}

export function bookingDetailRawJson(detail) {
  return JSON.stringify(detail, null, 2);
}
~~~

Die Funktion führt keine HTML-Escapes aus; die Ausgabe wird später ausschließlich
über textContent in pre eingefügt.

- [ ] **Step 4: Führe den Node-Test grün aus.**

Run: node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs  
Expected: PASS, inklusive aller bisherigen 97 Tests und der neuen Helfertests.

- [ ] **Step 5: Committe die Frontend-Helfer.**

~~~bash
git add custom_components/finanzplaner/frontend/panel-utils.mjs custom_components/finanzplaner/frontend/panel-utils.test.mjs
git commit -m 'Add booking detail frontend helpers'
~~~

---

### Task 5: Gemeinsames Detail-Popup in beiden Buchungslisten

**Files:**
- Modify: custom_components/finanzplaner/frontend/panel.js:1-810,1020-1125,3380-3460,4350-4420
- Modify: tests/test_panel_static_assets.py
- Test: custom_components/finanzplaner/frontend/panel-utils.test.mjs

**Interfaces:**

- Consumes: bookingDetailsRequestUrl, bookingDetailRawJson, Listenobjekte aus
  beiden Buchungsansichten und die Detail-API aus Task 3.
- Produces: Ein gemeinsames natives data-booking-detail-dialog, je Liste
  einen data-booking-details-Button, Lade-/Fehler-/Rohdatenzustände und
  Fokus-Rückgabe.

- [ ] **Step 1: Schreibe den roten statischen UI-Vertrag.**

Ergänze in PanelStaticAssetsTest:

~~~python
def test_booking_lists_use_shared_detail_dialog_and_raw_data_action(self):
    panel_path = (
        Path(__file__).parents[1]
        / 'custom_components'
        / 'finanzplaner'
        / 'frontend'
        / 'panel.js'
    )
    source = panel_path.read_text(encoding='utf-8')

    self.assertIn('data-booking-detail-dialog', source)
    self.assertGreaterEqual(source.count('data-booking-details'), 2)
    self.assertIn('data-booking-raw-toggle', source)
    self.assertIn('bookingDetailsRequestUrl', source)
    self.assertIn('textContent = bookingDetailRawJson', source)
~~~

- [ ] **Step 2: Führe den statischen Test rot aus.**

Run: python3 -m unittest tests.test_panel_static_assets.PanelStaticAssetsTest -v  
Expected: FAIL, weil Dialog, Detailaktionen und Helferimport noch fehlen.

- [ ] **Step 3: Lade die neuen Helfer und ergänze den Dialogzustand.**

Erweitere den Import am Anfang von panel.js um bookingDetailsRequestUrl und
bookingDetailRawJson. Ergänze im Konstruktor:

~~~javascript
this._bookingDetail = null;
this._bookingDetailLoading = false;
this._bookingDetailError = '';
this._bookingDetailRawVisible = false;
this._bookingDetailTrigger = null;
this._bookingDetailRequest = null;
~~~

Schließe einen eventuell geöffneten Detaildialog in disconnectedCallback.
Die Anfrage erhält eine lokale Referenz, sodass spätere Antworten nach
Navigation oder Schließen ignoriert werden.

- [ ] **Step 4: Ergänze das gemeinsame Dialog-Markup und Fachdatendarstellung.**

Füge in _shellTemplate neben dem vorhandenen Bestätigungsdialog genau ein
Dialogelement ein:

~~~html
<dialog class='booking-detail-dialog' data-booking-detail-dialog
  aria-labelledby='booking-detail-title' aria-describedby='booking-detail-description'>
  <div class='booking-detail-content' data-booking-detail-content></div>
</dialog>
~~~

Implementiere eine fachliche Templatefunktion, die booking, account und
details in semantischen section-Blöcken und dl-Feldlisten rendert.
Unbekannte zusätzliche Top-Level-Felder aus booking werden mit einem
menschenlesbaren Fallbacklabel ebenfalls ausgegeben. Verschachtelte
Aufteilungen, Regel-Snapshots und Vorschläge werden als Listen dargestellt;
fehlende Werte erscheinen als „Nicht vorhanden“.

Verwende für die generische Darstellung eine rekursive Textfunktion, die
Primitive escaped, Objekte als verschachtelte dl-Listen und Arrays als
ul-Listen rendert. Die zentrale Iteration darf nur source_data im fachlichen
Bereich auslassen, weil diese Daten über den separaten Rohdatenumschalter
angezeigt werden:

~~~javascript
_bookingDetailValueTemplate(value, path = 'Buchungsfeld') {
  if (value === null || value === undefined || value === '') {
    return '<span class="booking-detail-empty">Nicht vorhanden</span>';
  }
  if (Array.isArray(value)) {
    return value.length
      ? '<ul class="booking-detail-list">' +
        value.map((item, index) =>
          '<li><span class="booking-detail-key">' +
          escapeHtml(path + ' ' + (index + 1)) +
          '</span>' + this._bookingDetailValueTemplate(item, path) + '</li>').join('') +
        '</ul>'
      : '<span class="booking-detail-empty">Nicht vorhanden</span>';
  }
  if (typeof value === 'object') {
    return '<dl class="booking-detail-nested">' +
      Object.entries(value).map(([key, item]) =>
        '<div><dt>' + escapeHtml(this._bookingDetailLabel(key)) +
        '</dt><dd>' + this._bookingDetailValueTemplate(item, key) +
        '</dd></div>').join('') +
      '</dl>';
  }
  return '<span>' + escapeHtml(String(value)) + '</span>';
}

_bookingDetailFieldsTemplate(record) {
  return '<dl class="booking-detail-fields">' +
    Object.entries(record || {})
      .filter(([key]) => key !== 'source_data')
      .map(([key, value]) =>
        '<div><dt>' + escapeHtml(this._bookingDetailLabel(key)) +
        '</dt><dd>' + this._bookingDetailValueTemplate(value, key) +
        '</dd></div>').join('') +
    '</dl>';
}
~~~

Die Detailansicht ruft diese Funktion für booking sowie die statusabhängigen
details auf und rendert account in einem eigenen Kontobereich. Die
Rohdatenansicht verwendet anschließend das vollständige API-Ergebnis, damit
auch source_data und zusätzliche API-Felder enthalten sind.

Implementiere einen separaten Raw-Zustand:

~~~javascript
_renderBookingDetailDialog() {
  const content = this.shadowRoot.querySelector('[data-booking-detail-content]');
  if (!content) return;
  content.innerHTML = this._bookingDetailDialogTemplate();
  const rawNode = content.querySelector('[data-booking-raw]');
  if (rawNode && this._bookingDetail) {
    rawNode.textContent = bookingDetailRawJson(this._bookingDetail);
  }
}
~~~

Der Rohtext wird nach dem Markup-Aufbau immer über textContent gesetzt.

- [ ] **Step 5: Ergänze Laden, Umschalten, Schließen und Fokus-Rückgabe.**

Implementiere:

~~~javascript
async _openBookingDetails(bookingId, trigger) {
  const dialog = this.shadowRoot.querySelector('[data-booking-detail-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function' || this._bookingDetailRequest) return;

  const request = {};
  this._bookingDetailRequest = request;
  this._bookingDetail = null;
  this._bookingDetailLoading = true;
  this._bookingDetailError = '';
  this._bookingDetailRawVisible = false;
  this._bookingDetailTrigger = trigger;
  this._renderBookingDetailDialog();
  dialog.showModal();

  try {
    const response = await fetchWithHomeAssistantAuth(
      this._hass,
      bookingDetailsRequestUrl(BOOKINGS_URL, bookingId),
    );
    const result = await readApiResponse(response);
    if (this._bookingDetailRequest !== request) return;
    if (!response.ok) throw new Error(apiErrorMessage(result, 'Die Buchungsdetails konnten nicht geladen werden.'));
    this._bookingDetail = result;
  } catch (error) {
    if (this._bookingDetailRequest !== request) return;
    this._bookingDetailError = error.message || 'Die Buchungsdetails konnten nicht geladen werden.';
  } finally {
    if (this._bookingDetailRequest === request) {
      this._bookingDetailLoading = false;
      this._renderBookingDetailDialog();
    }
  }
}
~~~

Der Close-Handler setzt _bookingDetailRequest = null, schließt das Dialog,
setzt den Zustand zurück und fokussiert den gespeicherten Trigger, sofern er
noch verbunden ist. Der Raw-Toggle ändert nur den Dialoginhalt und lädt keine
neuen Daten. Der explizite Schließen-Button und natives Escape-Schließen
müssen denselben Handler verwenden.

- [ ] **Step 6: Füge Details-Aktionen in beide Listen ein.**

In _resolvedBookingsTemplate erhält jede Zeile im Aktionsbereich vor
„Zuordnung rückgängig“:

~~~html
<button class='table-edit-button' type='button'
  data-booking-details='BOOKING_ID'
  aria-label='Details für ZAHLUNGSEMPFÄNGER anzeigen'>
  Details
</button>
~~~

In _reviewTemplate erhält jedes Buchungsformular ebenfalls einen
type='button'-Button mit data-booking-details. Das Formular darf durch den
Details-Button nicht abgeschickt werden. Beide Buttons verwenden die
jeweilige Buchungs-ID escaped im Attribut.

Ergänze in _bindEvents:

~~~javascript
this.shadowRoot.querySelectorAll('[data-booking-details]').forEach((button) => {
  button.addEventListener('click', () =>
    this._openBookingDetails(button.dataset.bookingDetails, button)
  );
});
this.shadowRoot.querySelector('[data-booking-detail-dialog]')
  ?.addEventListener('click', (event) => {
    if (event.target.matches('[data-booking-raw-toggle]')) {
      this._bookingDetailRawVisible = !this._bookingDetailRawVisible;
      this._renderBookingDetailDialog();
    }
    if (event.target.matches('[data-booking-detail-close]')) {
      this._closeBookingDetails();
    }
  });
~~~

- [ ] **Step 7: Gestalte Dialog und Rohdatenbereich nach Projektprofil.**

Vor der CSS-Änderung:
- sh /home/eggerd/.agents/skills/impeccable/scripts/impeccable context --target custom_components/finanzplaner/frontend/panel.js
- sh /home/eggerd/.agents/skills/impeccable/scripts/impeccable detect custom_components/finanzplaner/frontend/panel.js

Ergänze im bestehenden Token-System eine breite, mobile-fähige Oberfläche:
inline-size: min(58rem, calc(100vw - 2rem)), begrenzte Höhe mit
max-block-size: min(86dvh, 64rem), internem Scrollbereich, sichtbarem
Focus-Ring, ausreichendem Kontrast und einer klaren Trennung von
Buchungsdaten, Erkennung, Aufteilung und Rohdaten. Das pre-Element erhält
white-space: pre-wrap, overflow-wrap: anywhere und die vorhandene
Datenschrift. Unter reduzierter Bewegung werden keine neuen
Bewegungsanimationen eingeführt. Auf kleinen Bildschirmen stapeln sich
Dialogaktionen und Detailfelder.

Setze die zentralen Dialogregeln konkret um:

~~~css
.booking-detail-dialog {
  inline-size: min(58rem, calc(100vw - 2rem));
  max-block-size: min(86dvh, 64rem);
  margin: auto;
  padding: 0;
  border: 1px solid var(--fp-navy);
  border-radius: var(--fp-radius);
  color: var(--fp-ink);
  background: var(--fp-paper-strong);
  box-shadow: 0 1.1rem 3rem rgb(11 30 63 / 0.24);
}
.booking-detail-dialog::backdrop { background: rgb(11 30 63 / 0.52); }
.booking-detail-content {
  display: grid;
  gap: 1rem;
  max-block-size: min(86dvh, 64rem);
  overflow: auto;
  padding: clamp(1rem, 3vw, 1.6rem);
}
.booking-detail-raw {
  max-block-size: 32rem;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--fp-data);
}
~~~

Im Responsive-Breakpoint werden Dialogaktionen auf volle Breite gestreckt
und Feldlisten in eine Spalte gesetzt. Ergänze den vorhandenen
High-Contrast-Block um dieselben Canvas-/ButtonText-Farben wie beim
Bestätigungsdialog.

- [ ] **Step 8: Führe statische, syntaktische und Frontend-Regressionstests grün aus.**

Run: python3 -m unittest tests.test_panel_static_assets.PanelStaticAssetsTest -v  
Expected: PASS.

Run: node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs  
Expected: PASS.

Run: node --check custom_components/finanzplaner/frontend/panel.js  
Expected: exit 0.

- [ ] **Step 9: Committe die Popup-Oberfläche.**

~~~bash
git add custom_components/finanzplaner/frontend/panel.js tests/test_panel_static_assets.py
git commit -m 'Add booking detail dialog to both booking lists'
~~~

---

### Task 6: Dokumentation aktualisieren und Gesamtprüfung durchführen

**Files:**
- Modify: PRODUCT.md
- Modify: README.md
- Modify: CHANGELOG.md
- Test: Alle bestehenden Python- und Node-Tests.

**Interfaces:**

- Consumes: Fertige Parser-, Import-, API- und Frontendänderungen aus Task 1–5.
- Produces: Konsistente Produktdokumentation, dokumentierte lokale
  Quelldatenaufbewahrung und einen verifizierten finalen Arbeitsstand.

- [ ] **Step 1: Aktualisiere die Produktleitplanken.**

Ergänze in PRODUCT.md bei Bankbuchungen und Sicherheit:
Die normalisierten Parserfelder bleiben für die Fachlogik erhalten, während
der vollständige buchungsbezogene MT940-/CAMT.053-Quellsatz lokal zur Prüfung
gespeichert und in API/UI maskiert wird. Stelle klar, dass keine unveränderte
Originaldatei als Downloadarchiv aufbewahrt wird.

- [ ] **Step 2: Aktualisiere README und Changelog.**

Ergänze in README.md bei „Konten und Bankimport“ die Erklärung der
Detailansicht und der lokalen Quelldaten. Ergänze in CHANGELOG.md unter
Unreleased:

~~~markdown
- Buchungsdetails als Popup für ungeklärte und übernommene Buchungen
- verlustfreie Quelldatenansicht für importierte MT940-/CAMT.053-Buchungssätze
~~~

- [ ] **Step 3: Prüfe Dokumentationsdiff und Formatierung.**

Run: git diff --check  
Expected: exit 0.

Run: git status --short  
Expected: nur die beabsichtigten Dokumentationsänderungen sind sichtbar.

- [ ] **Step 4: Führe die vollständige Verifikation aus.**

Run: python3 -m unittest discover -s tests -q  
Expected: alle Python-Tests PASS.

Run: node --test custom_components/finanzplaner/frontend/panel-utils.test.mjs  
Expected: alle Node-Tests PASS.

Run: node --check custom_components/finanzplaner/frontend/panel.js  
Expected: exit 0.

Run: python3 -m compileall -q custom_components  
Expected: exit 0.

- [ ] **Step 5: Committe Dokumentation und finalen geprüften Stand.**

~~~bash
git add PRODUCT.md README.md CHANGELOG.md
git commit -m 'Document booking detail and source data retention'
~~~

- [ ] **Step 6: Prüfe den finalen Arbeitsbaum.**

Run: git status --short  
Expected: leer.

Run: git log --oneline -6  
Expected: die sechs fachlich getrennten Implementierungs-/Dokumentationscommits
sind nachvollziehbar.
