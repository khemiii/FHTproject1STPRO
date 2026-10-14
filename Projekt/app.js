/*
       * Datenmodell / "Datenbank":
       *   personen.json -> [{ id, name }]
       *   fahrten.json  -> [{ id, datum, fahrerId, km, verbrauch, spritpreis (immer in EUR gespeichert),
       *                        mitfahrer: [{ personId, anteil (EUR), bezahlt (bool) }] }]
       *
       * Persistenz:
       *   - Läuft server.js (node server.js) und wird die Seite darüber aufgerufen (http://localhost:3000),
       *     liest/schreibt das Frontend automatisch über /api/personen und /api/fahrten direkt in die
       *     echten JSON-Dateien im selben Ordner wie server.js. Kein Klick, kein Berechtigungsdialog.
       *   - Ohne laufenden Server (z. B. Datei einfach per Doppelklick geöffnet) fällt die Seite
       *     automatisch auf localStorage zurück, damit sie trotzdem benutzbar bleibt.
       *   - Import-Button bleibt als manueller Fallback, falls man Dateien von anderswo einlesen will.
       */

      // ---------- State ----------
      let personen = [];
      let fahrten = [];
      let currentCurrency = "EUR";
      let tripPendingDeletion = null;
      let editingTripId = null;
      let usingServer = false; // true, sobald /api/personen + /api/fahrten erreichbar sind

      const currencyRates = {
        EUR: { symbol: "€", rate: 1.0 },
        CHF: { symbol: "Fr.", rate: 0.95 },
        USD: { symbol: "$", rate: 1.08 },
        GBP: { symbol: "£", rate: 0.85 },
      };

      const defaultPersonen = [
        { id: 1, name: "Max Mustermann" },
        { id: 2, name: "Sarah Klein" },
        { id: 3, name: "Jonas Berg" },
      ];
      const defaultFahrten = [
        {
          id: 101,
          datum: "2024-10-15",
          fahrerId: 1,
          km: 92,
          verbrauch: 6.2,
          spritpreis: 1.72,
          mitfahrer: [{ personId: 3, anteil: 1.9, bezahlt: false }],
        },
      ];

      // ---------- Persistenz: localStorage-Fallback (nur falls kein Server erreichbar ist) ----------
      function loadStateFromLocalStorage() {
        try {
          const p = localStorage.getItem("spritshare_personen");
          const f = localStorage.getItem("spritshare_fahrten");
          personen = p ? JSON.parse(p) : JSON.parse(JSON.stringify(defaultPersonen));
          fahrten = f ? JSON.parse(f) : JSON.parse(JSON.stringify(defaultFahrten));
        } catch (e) {
          personen = JSON.parse(JSON.stringify(defaultPersonen));
          fahrten = JSON.parse(JSON.stringify(defaultFahrten));
        }
      }

      // ---------- Persistenz: automatisch über den lokalen Server (server.js) ----------
      // Lädt beim Start personen.json / fahrten.json über die API. Existieren die Dateien noch
      // nicht, legt der Server sie beim ersten Speichern automatisch an.
      async function loadState() {
        try {
          const [pRes, fRes] = await Promise.all([
            fetch("/api/personen", { cache: "no-store" }),
            fetch("/api/fahrten", { cache: "no-store" }),
          ]);

          if (pRes.status === 404 || fRes.status === 404) {
            personen = JSON.parse(JSON.stringify(defaultPersonen));
            fahrten = JSON.parse(JSON.stringify(defaultFahrten));
            usingServer = true;
            await saveState(); // legt personen.json / fahrten.json mit Beispieldaten an
            return;
          }
          if (pRes.ok && fRes.ok) {
            personen = await pRes.json();
            fahrten = await fRes.json();
            usingServer = true;
            return;
          }
          throw new Error("Unerwarteter Serverstatus: " + pRes.status + " / " + fRes.status);
        } catch (e) {
          // Kein Server erreichbar (z. B. Datei per Doppelklick geöffnet) -> Fallback
          usingServer = false;
          loadStateFromLocalStorage();
        }
      }

      // Schreibt den aktuellen State automatisch über die Server-API in die echten JSON-Dateien;
      // ohne erreichbaren Server wird stattdessen in localStorage gespeichert.
      async function saveState() {
        if (usingServer) {
          try {
            const [pRes, fRes] = await Promise.all([
              fetch("/api/personen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(personen, null, 2) }),
              fetch("/api/fahrten", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fahrten, null, 2) }),
            ]);
            if (pRes.ok && fRes.ok) {
              updateSyncStatus();
              return;
            }
            throw new Error("Server hat das Speichern abgelehnt.");
          } catch (e) {
            console.error("Fehler beim Schreiben über den Server, falle auf localStorage zurück:", e);
            usingServer = false;
          }
        }
        localStorage.setItem("spritshare_personen", JSON.stringify(personen));
        localStorage.setItem("spritshare_fahrten", JSON.stringify(fahrten));
        updateSyncStatus();
      }

      function updateSyncStatus() {
        const el = document.getElementById("sync-status");
        if (usingServer) {
          el.innerHTML = '<span class="material-symbols-outlined text-xs">cloud_done</span><span>Automatisch gespeichert in personen.json / fahrten.json (lokaler Server)</span>';
          el.classList.remove("text-on-surface-variant");
          el.classList.add("text-primary");
        } else {
          el.innerHTML = '<span class="material-symbols-outlined text-xs">cloud_off</span><span>Kein lokaler Server erkannt – Daten werden im Browser gespeichert. Starte server.js für automatisches Speichern in den JSON-Dateien.</span>';
          el.classList.remove("text-primary");
          el.classList.add("text-on-surface-variant");
        }
      }

      function nextPersonId() {
        return personen.length ? Math.max(...personen.map((p) => p.id)) + 1 : 1;
      }
      function nextFahrtId() {
        return fahrten.length ? Math.max(...fahrten.map((f) => f.id)) + 1 : 101;
      }

      function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str == null ? "" : String(str);
        return div.innerHTML;
      }

      function personName(id) {
        const p = personen.find((p) => p.id === id);
        return p ? p.name : "(gelöscht)";
      }

      // ---------- Personen-Verwaltung ----------
      async function addPerson() {
        const input = document.getElementById("input-new-person");
        const name = input.value.trim();
        if (!name) return;
        if (personen.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          alert("Diese Person existiert bereits.");
          return;
        }
        personen.push({ id: nextPersonId(), name });
        await saveState();
        input.value = "";
        renderAll();
      }

      async function deletePerson(id) {
        const used = fahrten.some((f) => f.fahrerId === id || f.mitfahrer.some((m) => m.personId === id));
        if (used) {
          alert("Diese Person wird noch in Fahrten verwendet und kann nicht gelöscht werden.");
          return;
        }
        personen = personen.filter((p) => p.id !== id);
        await saveState();
        renderAll();
      }

      function renderPersonenListe() {
        const container = document.getElementById("personen-liste");
        if (!personen.length) {
          container.innerHTML = '<span class="text-body-sm font-body-sm text-on-surface-variant">Noch keine Personen angelegt.</span>';
          return;
        }
        container.innerHTML = personen
          .map(
            (p) => `
          <span class="text-label-sm font-label-sm pl-2.5 pr-1.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center space-x-1">
            <span class="material-symbols-outlined text-xs">person</span>
            <span>${escapeHtml(p.name)}</span>
            <button onclick="deletePerson(${p.id})" title="Entfernen" class="hover:text-error transition-colors">
              <span class="material-symbols-outlined text-sm align-middle">close</span>
            </button>
          </span>`
          )
          .join("");
      }

      // ---------- Formular-Optionen (Fahrer / Mitfahrer / Schulden-Auswahl) ----------
      function renderPersonOptions() {
        const fahrerSelect = document.getElementById("input-fahrer");
        const prevFahrer = fahrerSelect.value;
        fahrerSelect.innerHTML = personen.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
        if (personen.some((p) => String(p.id) === prevFahrer)) fahrerSelect.value = prevFahrer;

        renderMitfahrerCheckboxes();

        const modalFahrerSelect = document.getElementById("modal-fahrer");
        const prevModalFahrer = modalFahrerSelect.value;
        modalFahrerSelect.innerHTML = personen.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
        if (personen.some((p) => String(p.id) === prevModalFahrer)) modalFahrerSelect.value = prevModalFahrer;

        const debtSelect = document.getElementById("debt-person-select");
        const prevDebt = debtSelect.value;
        debtSelect.innerHTML =
          '<option value="">– Person wählen –</option>' + personen.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
        if (personen.some((p) => String(p.id) === prevDebt)) debtSelect.value = prevDebt;
      }

      function getSelectedMitfahrerIds() {
        return Array.from(document.querySelectorAll(".mitfahrer-checkbox:checked")).map((cb) => parseInt(cb.value));
      }

      function renderMitfahrerCheckboxes() {
        const fahrerId = parseInt(document.getElementById("input-fahrer").value) || null;
        const previouslyChecked = getSelectedMitfahrerIds();
        const container = document.getElementById("mitfahrer-checkboxes");
        const auswahl = personen.filter((p) => p.id !== fahrerId);
        if (!auswahl.length) {
          container.innerHTML = '<span class="text-body-sm text-on-surface-variant">Keine weiteren Personen vorhanden – zuerst Personen anlegen.</span>';
          return;
        }
        container.innerHTML = auswahl
          .map(
            (p) => `
          <label class="flex items-center space-x-1.5 text-body-sm font-body-sm text-on-surface">
            <input type="checkbox" value="${p.id}" class="mitfahrer-checkbox rounded bg-surface-container-lowest border-outline-variant text-primary focus:ring-0 w-4 h-4" ${
              previouslyChecked.includes(p.id) ? "checked" : ""
            } onchange="runLiveCalculation()" />
            <span>${escapeHtml(p.name)}</span>
          </label>`
          )
          .join("");
      }

      // ---------- Algorithmus 1: Live-Kostenberechnung ----------
      function showError(msg) {
        document.getElementById("error-text").textContent = msg;
        document.getElementById("form-error-msg").classList.remove("hidden");
      }
      function hideError() {
        document.getElementById("form-error-msg").classList.add("hidden");
      }

      function setLiveValues(fuel, totalEUR, perPersonEUR, label) {
        const rate = currencyRates[currentCurrency].rate;
        document.getElementById("calc-fuel-used").textContent = fuel.toFixed(2);
        document.getElementById("calc-total-cost").textContent = (totalEUR * rate).toFixed(2);
        document.getElementById("calc-cost-per-person").textContent = (perPersonEUR * rate).toFixed(2);
        document.getElementById("calc-headcount-label").textContent = label;
      }

      function runLiveCalculation() {
        const start = performance.now();

        const km = parseFloat(document.getElementById("input-km").value) || 0;
        const verbrauch = parseFloat(document.getElementById("input-consumption").value) || 0;
        const preisInput = parseFloat(document.getElementById("input-price").value) || 0;
        const includeDriver = document.getElementById("check-include-driver").checked;
        const mitfahrerIds = getSelectedMitfahrerIds();

        if (mitfahrerIds.length > 20) {
          showError("Maximal 20 Mitfahrer pro Fahrt erlaubt.");
          setLiveValues(0, 0, 0, "0 Personen geteilt");
          return;
        }

        if (km <= 0 || verbrauch <= 0 || preisInput <= 0) {
          showError("Bitte gültige numerische Werte größer als 0 eingeben.");
          setLiveValues(0, 0, 0, "0 Personen geteilt");
          return;
        }
        hideError();

        const rate = currencyRates[currentCurrency].rate;
        const preisEUR = preisInput / rate;
        const fuelUsed = (km * verbrauch) / 100;
        const totalCostEUR = fuelUsed * preisEUR;
        const divisor = includeDriver ? mitfahrerIds.length + 1 : mitfahrerIds.length;
        const perPersonEUR = divisor > 0 ? totalCostEUR / divisor : 0;

        setLiveValues(fuelUsed, totalCostEUR, perPersonEUR, `${divisor} Personen geteilt`);

        const elapsed = performance.now() - start;
        document.getElementById("calc-timing").textContent = elapsed.toFixed(2) + " ms";

        const card = document.getElementById("live-calculator-card");
        card.classList.add("ring-1", "ring-primary");
        setTimeout(() => card.classList.remove("ring-1", "ring-primary"), 150);
      }

      // ---------- Fahrt erfassen / speichern (REQ-F-01, REQ-F-06, REQ-NF-04) ----------
      async function saveNewTrip() {
        const datum = document.getElementById("input-date").value;
        const km = parseFloat(document.getElementById("input-km").value) || 0;
        const verbrauch = parseFloat(document.getElementById("input-consumption").value) || 0;
        const preisInput = parseFloat(document.getElementById("input-price").value) || 0;
        const fahrerId = parseInt(document.getElementById("input-fahrer").value);
        const includeDriver = document.getElementById("check-include-driver").checked;
        const mitfahrerIds = getSelectedMitfahrerIds();

        if (!datum || km <= 0 || verbrauch <= 0 || preisInput <= 0 || !fahrerId) {
          showError("Bitte alle Felder gültig ausfüllen (Werte > 0, Datum und Fahrer auswählen).");
          return;
        }
        if (mitfahrerIds.length === 0) {
          showError("Bitte mindestens einen Mitfahrer auswählen.");
          return;
        }
        if (mitfahrerIds.length > 20) {
          showError("Maximal 20 Mitfahrer pro Fahrt erlaubt.");
          return;
        }

        const rate = currencyRates[currentCurrency].rate;
        const preisEUR = preisInput / rate;
        const fuelUsed = (km * verbrauch) / 100;
        const totalCostEUR = fuelUsed * preisEUR;
        const divisor = includeDriver ? mitfahrerIds.length + 1 : mitfahrerIds.length;
        const perPersonEUR = totalCostEUR / divisor;

        fahrten.push({
          id: nextFahrtId(),
          datum,
          fahrerId,
          km,
          verbrauch,
          spritpreis: parseFloat(preisEUR.toFixed(4)),
          mitfahrer: mitfahrerIds.map((pid) => ({ personId: pid, anteil: parseFloat(perPersonEUR.toFixed(2)), bezahlt: false })),
        });

        await saveState();
        resetEntryForm();
        renderAll();
        showToast("Fahrt gespeichert.");
      }

      function resetEntryForm() {
        document.getElementById("input-km").value = "";
        document.getElementById("input-consumption").value = "";
        document.getElementById("input-price").value = "";
        document.querySelectorAll(".mitfahrer-checkbox").forEach((cb) => (cb.checked = false));
        hideError();
        setLiveValues(0, 0, 0, "0 Personen geteilt");
      }

      // ---------- Fahrtenübersicht (REQ-F-03) ----------
      function renderFahrtenTabelle() {
        const tbody = document.getElementById("trips-tbody");
        const rate = currencyRates[currentCurrency].rate;
        const symbol = currencyRates[currentCurrency].symbol;
        const query = (document.getElementById("table-search").value || "").toLowerCase();

        const rows = fahrten
          .slice()
          .sort((a, b) => b.id - a.id)
          .filter((f) => {
            const text = [f.datum, personName(f.fahrerId), ...f.mitfahrer.map((m) => personName(m.personId))].join(" ").toLowerCase();
            return text.includes(query);
          });

        if (!rows.length) {
          tbody.innerHTML = `<tr><td colspan="5" class="py-6 px-3.5 text-center text-body-sm text-on-surface-variant">Keine Fahrten gefunden.</td></tr>`;
        } else {
          tbody.innerHTML = rows
            .map((f) => {
              const fuelUsed = (f.km * f.verbrauch) / 100;
              const totalEUR = fuelUsed * f.spritpreis;
              const chips = f.mitfahrer
                .map(
                  (m) => `
              <button onclick="togglePaid(${f.id}, ${m.personId})"
                class="px-2 py-0.5 rounded text-label-sm font-label-sm border transition-colors ${
                  m.bezahlt ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface-container-high border-outline-variant/40 text-on-surface-variant"
                }"
                title="${m.bezahlt ? "Bezahlt – klicken zum Zurücksetzen" : "Offen – klicken um als bezahlt zu markieren"}">
                ${escapeHtml(personName(m.personId))} · ${(m.anteil * rate).toFixed(2)}${symbol}${m.bezahlt ? " ✓" : ""}
              </button>`
                )
                .join("");

              return `
            <tr class="hover:bg-surface-container/50 transition-colors" id="row-${f.id}">
              <td class="py-3.5 px-3.5 whitespace-nowrap align-top">
                <span class="font-numeric-table font-semibold text-on-surface">${escapeHtml(f.datum)}</span>
                <span class="block text-body-sm font-body-sm text-on-surface-variant">#${f.id} • Fahrer: ${escapeHtml(personName(f.fahrerId))}</span>
              </td>
              <td class="py-3.5 px-3.5 whitespace-nowrap align-top">
                <span class="font-numeric-table text-on-surface">${f.km} km</span>
                <span class="text-body-sm font-body-sm text-on-surface-variant block">${f.verbrauch} l/100km</span>
              </td>
              <td class="py-3.5 px-3.5 text-right font-numeric-table font-semibold text-on-surface whitespace-nowrap align-top">
                ${(totalEUR * rate).toFixed(2)} ${symbol}
              </td>
              <td class="py-3.5 px-3.5 align-top">
                <div class="flex flex-wrap gap-1">${chips}</div>
              </td>
              <td class="py-3.5 px-3.5 text-center whitespace-nowrap align-top">
                <div class="flex items-center justify-center space-x-1">
                  <button onclick="openEditModal(${f.id})" title="Bearbeiten" class="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors">
                    <span class="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button onclick="triggerDeleteBanner(${f.id})" title="Löschen" class="p-1 rounded text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors">
                    <span class="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </td>
            </tr>`;
            })
            .join("");
        }

        document.getElementById("trip-count-label").textContent = `${rows.length} von ${fahrten.length} Fahrten`;
      }

      async function togglePaid(fahrtId, personId) {
        const fahrt = fahrten.find((f) => f.id === fahrtId);
        if (!fahrt) return;
        const eintrag = fahrt.mitfahrer.find((m) => m.personId === personId);
        if (!eintrag) return;
        eintrag.bezahlt = !eintrag.bezahlt;
        await saveState();
        renderFahrtenTabelle();
        renderDebtOverview();
      }

      // ---------- Fahrt löschen (REQ-F-05) ----------
      function triggerDeleteBanner(id) {
        tripPendingDeletion = id;
        const f = fahrten.find((x) => x.id === id);
        if (!f) return;
        document.getElementById("delete-banner-text").textContent = `Fahrt #${f.id} vom ${f.datum} (${f.km} km, Fahrer: ${personName(f.fahrerId)}) wirklich löschen?`;
        document.getElementById("delete-alert-banner").classList.remove("hidden");
      }
      function dismissDeleteBanner() {
        tripPendingDeletion = null;
        document.getElementById("delete-alert-banner").classList.add("hidden");
      }
      async function confirmTripDeletion() {
        fahrten = fahrten.filter((f) => f.id !== tripPendingDeletion);
        await saveState();
        dismissDeleteBanner();
        renderAll();
      }

      // ---------- Fahrt bearbeiten (REQ-F-04) ----------
      function openEditModal(id) {
        const f = fahrten.find((x) => x.id === id);
        if (!f) return;
        editingTripId = id;
        const rate = currencyRates[currentCurrency].rate;

        document.getElementById("modal-trip-id").textContent = "#" + f.id;
        document.getElementById("modal-date").value = f.datum;
        document.getElementById("modal-km").value = f.km;
        document.getElementById("modal-consumption").value = f.verbrauch;
        document.getElementById("modal-price").value = (f.spritpreis * rate).toFixed(2);
        document.getElementById("modal-fahrer").value = f.fahrerId;

        renderModalMitfahrerCheckboxes(f);
        document.getElementById("edit-modal").classList.remove("hidden");
      }

      function renderModalMitfahrerCheckboxes(fahrt) {
        const fahrerId = parseInt(document.getElementById("modal-fahrer").value) || fahrt.fahrerId;
        const container = document.getElementById("modal-mitfahrer-checkboxes");
        const auswahl = personen.filter((p) => p.id !== fahrerId);
        container.innerHTML = auswahl
          .map((p) => {
            const existing = fahrt.mitfahrer.find((m) => m.personId === p.id);
            return `
            <label class="flex items-center space-x-1.5 text-body-sm font-body-sm text-on-surface">
              <input type="checkbox" value="${p.id}" class="modal-mitfahrer-checkbox rounded bg-surface-container-lowest border-outline-variant text-primary focus:ring-0 w-4 h-4" ${
                existing ? "checked" : ""
              } />
              <span>${escapeHtml(p.name)}</span>
            </label>`;
          })
          .join("");
      }

      function renderModalMitfahrerCheckboxesOnFahrerChange() {
        const f = fahrten.find((x) => x.id === editingTripId);
        if (f) renderModalMitfahrerCheckboxes(f);
      }

      function closeEditModal() {
        editingTripId = null;
        document.getElementById("edit-modal").classList.add("hidden");
      }

      async function saveEditedTrip() {
        const f = fahrten.find((x) => x.id === editingTripId);
        if (!f) return;

        const datum = document.getElementById("modal-date").value;
        const km = parseFloat(document.getElementById("modal-km").value) || 0;
        const verbrauch = parseFloat(document.getElementById("modal-consumption").value) || 0;
        const preisInput = parseFloat(document.getElementById("modal-price").value) || 0;
        const fahrerId = parseInt(document.getElementById("modal-fahrer").value);
        const mitfahrerIds = Array.from(document.querySelectorAll(".modal-mitfahrer-checkbox:checked")).map((cb) => parseInt(cb.value));

        if (!datum || km <= 0 || verbrauch <= 0 || preisInput <= 0 || !fahrerId || mitfahrerIds.length === 0) {
          alert("Bitte alle Felder gültig ausfüllen (Werte > 0, mindestens ein Mitfahrer).");
          return;
        }
        if (mitfahrerIds.length > 20) {
          alert("Maximal 20 Mitfahrer pro Fahrt erlaubt.");
          return;
        }

        const rate = currencyRates[currentCurrency].rate;
        const preisEUR = preisInput / rate;
        const fuelUsed = (km * verbrauch) / 100;
        const totalCostEUR = fuelUsed * preisEUR;
        const perPersonEUR = totalCostEUR / mitfahrerIds.length;

        const oldStatus = {};
        f.mitfahrer.forEach((m) => (oldStatus[m.personId] = m.bezahlt));

        f.datum = datum;
        f.km = km;
        f.verbrauch = verbrauch;
        f.spritpreis = parseFloat(preisEUR.toFixed(4));
        f.fahrerId = fahrerId;
        f.mitfahrer = mitfahrerIds.map((pid) => ({
          personId: pid,
          anteil: parseFloat(perPersonEUR.toFixed(2)),
          bezahlt: oldStatus[pid] || false,
        }));

        await saveState();
        closeEditModal();
        renderAll();
        showToast("Änderungen gespeichert.");
      }

      // ---------- Algorithmus 2: Schulden-Übersicht pro Person ----------
      function renderDebtOverview() {
        const select = document.getElementById("debt-person-select");
        const personId = parseInt(select.value);
        const container = document.getElementById("debt-overview-result");

        if (!personId) {
          container.innerHTML = '<p class="text-body-sm font-body-sm text-on-surface-variant">Bitte eine Person auswählen.</p>';
          return;
        }

        const owes = {}; // Gegenperson-ID -> Betrag, den die gewählte Person schuldet
        const isOwed = {}; // Gegenperson-ID -> Betrag, der der gewählten Person geschuldet wird

        fahrten.forEach((f) => {
          const eigenerAnteil = f.mitfahrer.find((m) => m.personId === personId);
          if (eigenerAnteil && !eigenerAnteil.bezahlt && f.fahrerId !== personId) {
            owes[f.fahrerId] = (owes[f.fahrerId] || 0) + eigenerAnteil.anteil;
          }
          if (f.fahrerId === personId) {
            f.mitfahrer.forEach((m) => {
              if (!m.bezahlt) {
                isOwed[m.personId] = (isOwed[m.personId] || 0) + m.anteil;
              }
            });
          }
        });

        const rate = currencyRates[currentCurrency].rate;
        const symbol = currencyRates[currentCurrency].symbol;
        const name = personName(personId);

        const owesRows = Object.entries(owes)
          .map(
            ([pid, amt]) => `
          <div class="flex items-center justify-between py-2 border-b border-outline-variant/20">
            <span class="text-body-md font-body-md text-on-surface">${escapeHtml(name)} schuldet ${escapeHtml(personName(parseInt(pid)))}</span>
            <span class="font-numeric-table font-semibold text-error">${(amt * rate).toFixed(2)} ${symbol}</span>
          </div>`
          )
          .join("");

        const owedRows = Object.entries(isOwed)
          .map(
            ([pid, amt]) => `
          <div class="flex items-center justify-between py-2 border-b border-outline-variant/20">
            <span class="text-body-md font-body-md text-on-surface">${escapeHtml(personName(parseInt(pid)))} schuldet ${escapeHtml(name)}</span>
            <span class="font-numeric-table font-semibold text-primary">${(amt * rate).toFixed(2)} ${symbol}</span>
          </div>`
          )
          .join("");

        if (!owesRows && !owedRows) {
          container.innerHTML = `<p class="text-body-sm font-body-sm text-on-surface-variant">Keine offenen Schulden für ${escapeHtml(name)}.</p>`;
          return;
        }

        container.innerHTML = `
          ${owesRows ? `<h4 class="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1 mt-2">${escapeHtml(name)} schuldet</h4>${owesRows}` : ""}
          ${owedRows ? `<h4 class="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1 mt-3">Wird ${escapeHtml(name)} noch geschuldet</h4>${owedRows}` : ""}
        `;
      }

      // ---------- Währungsumschalter (REQ-NF-03) ----------
      function setCurrency(key) {
        currentCurrency = key;
        document.querySelectorAll(".curr-btn").forEach((btn) => {
          btn.classList.remove("bg-surface-container-high", "text-primary", "border", "border-outline-variant", "font-medium");
          btn.classList.add("text-on-surface-variant");
        });
        const active = document.getElementById("curr-" + key);
        active.classList.add("bg-surface-container-high", "text-primary", "border", "border-outline-variant", "font-medium");
        active.classList.remove("text-on-surface-variant");

        document.querySelectorAll(".currency-symbol").forEach((el) => (el.textContent = currencyRates[key].symbol));
        document.getElementById("price-unit-label").textContent = currencyRates[key].symbol + "/L";

        runLiveCalculation();
        renderFahrtenTabelle();
        renderDebtOverview();
      }

      // ---------- JSON Import (manueller Fallback) ----------
      function importJSON(event) {
        const files = event.target.files;
        if (!files.length) return;
        Array.from(files).forEach((file) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const data = JSON.parse(e.target.result);
              if (file.name.toLowerCase().includes("personen")) {
                personen = data;
              } else if (file.name.toLowerCase().includes("fahrten")) {
                fahrten = data;
              } else {
                alert("Dateiname nicht erkannt (erwartet: personen.json / fahrten.json).");
                return;
              }
              await saveState();
              renderAll();
              showToast(file.name + " importiert.");
            } catch (err) {
              alert("Fehler beim Einlesen von " + file.name);
            }
          };
          reader.readAsText(file);
        });
        event.target.value = "";
      }

      // ---------- Toast ----------
      function showToast(msg) {
        const notif = document.createElement("div");
        notif.className =
          "fixed bottom-5 right-5 bg-primary-container text-on-primary-container px-4 py-3 rounded shadow-lg text-label-md font-label-md flex items-center space-x-2 z-50";
        notif.innerHTML = `<span class="material-symbols-outlined text-lg">check_circle</span><span>${escapeHtml(msg)}</span>`;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2500);
      }

      // ---------- Render-Einstieg ----------
      function renderAll() {
        renderPersonOptions();
        renderPersonenListe();
        renderFahrtenTabelle();
        renderDebtOverview();
      }

      document.addEventListener("DOMContentLoaded", async () => {
        document.getElementById("input-date").value = new Date().toISOString().slice(0, 10);
        await loadState();
        updateSyncStatus();
        renderAll();
        runLiveCalculation();
      });