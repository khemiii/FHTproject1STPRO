/*
 * Kostenrechner – Algorithmus 1 & 2
 *
 * Ausführen mit:  node algorithmen.js
 *
 * Die Funktionen unten sind reines JS ohne DOM-Abhängigkeit, lassen sich
 * also direkt in Node testen oder in eine HTML-Seite übernehmen.
 * Am Ende der Datei werden ein paar Testfälle aufgerufen und deren
 * Ein- und Ausgabe nur ausgegeben (kein automatischer Soll/Ist-Vergleich) -
 * zum selbst Durchschauen bzw. Nachrechnen.
 */

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// =====================================================================
// Algorithmus 1: Kostenberechnung pro Fahrer
// =====================================================================
function berechneKostenProFahrt(km, verbrauch, kraftstoffpreis, anzahlMitfahrer, fahrerMitrechnen) {
  // --- Eingabevalidierung ---
  if (typeof km !== "number" || isNaN(km) || km <= 0) {
    throw new Error("Kilometer müssen eine Zahl größer als 0 sein.");
  }
  if (typeof verbrauch !== "number" || isNaN(verbrauch) || verbrauch <= 0) {
    throw new Error("Verbrauch muss eine Zahl größer als 0 sein (Liter pro 100km).");
  }
  if (typeof kraftstoffpreis !== "number" || isNaN(kraftstoffpreis) || kraftstoffpreis <= 0) {
    throw new Error("Kraftstoffpreis muss eine Zahl größer als 0 sein.");
  }
  if (!Number.isInteger(anzahlMitfahrer) || anzahlMitfahrer < 0) {
    throw new Error("Anzahl Mitfahrer muss eine ganze Zahl >= 0 sein.");
  }
  if (typeof fahrerMitrechnen !== "boolean") {
    throw new Error("fahrerMitrechnen muss true oder false sein.");
  }

  // --- Berechnung ---
  const spritverbrauch = (km * verbrauch) / 100; // Liter
  const gesamtkosten = spritverbrauch * kraftstoffpreis; // Euro

  const anzahlPersonen = anzahlMitfahrer + (fahrerMitrechnen ? 1 : 0);
  if (anzahlPersonen === 0) {
    // Division durch 0 abfangen statt sie auszuführen
    throw new Error("Division durch 0: Es gibt niemanden, auf den die Kosten aufgeteilt werden können.");
  }

  const kostenAnteilProPerson = gesamtkosten / anzahlPersonen;

  // --- Ausgabe, auf 2 Nachkommastellen gerundet ---
  return {
    spritverbrauch: round2(spritverbrauch),
    gesamtkosten: round2(gesamtkosten),
    kostenAnteilProPerson: round2(kostenAnteilProPerson),
  };
}

// =====================================================================
// Algorithmus 2: Schulden-Übersicht pro Person
//
// Erwartetes Format pro Fahrt:
//   { fahrer: "A", mitfahrer: [ { person: "B", anteil: 10, bezahlt: false }, ... ] }
// =====================================================================
function schuldenUebersichtProPerson(fahrten, ausgewaehltePerson) {
  if (!Array.isArray(fahrten)) {
    throw new Error("fahrten muss ein Array sein.");
  }
  if (ausgewaehltePerson === undefined || ausgewaehltePerson === null || ausgewaehltePerson === "") {
    throw new Error("Es muss eine Person ausgewählt werden.");
  }

  // 1. Nur Fahrten behalten, an denen die Person beteiligt ist (Fahrer ODER Mitfahrer)
  const relevanteFahrten = fahrten.filter(
    (f) => f.fahrer === ausgewaehltePerson || f.mitfahrer.some((m) => m.person === ausgewaehltePerson)
  );

  const schuldetAn = {}; // Gegenperson -> Betrag, den die ausgewählte Person noch zahlen muss
  const bekommtVon = {}; // Gegenperson -> Betrag, den die ausgewählte Person noch bekommt

  relevanteFahrten.forEach((fahrt) => {
    if (fahrt.fahrer === ausgewaehltePerson) {
      // 2a. Person war Fahrer -> offene Anteile aller Mitfahrer werden ihr geschuldet
      fahrt.mitfahrer.forEach((m) => {
        if (!m.bezahlt) {
          bekommtVon[m.person] = (bekommtVon[m.person] || 0) + m.anteil;
        }
      });
    } else {
      // 2b. Person war Mitfahrer -> ihr eigener offener Anteil wird dem Fahrer geschuldet
      const eigenerEintrag = fahrt.mitfahrer.find((m) => m.person === ausgewaehltePerson);
      if (eigenerEintrag && !eigenerEintrag.bezahlt) {
        schuldetAn[fahrt.fahrer] = (schuldetAn[fahrt.fahrer] || 0) + eigenerEintrag.anteil;
      }
    }
  });

  // 3. Einzelposten pro Gegenperson aufsummiert zurückgeben, auf 2 Nachkommastellen gerundet
  return {
    schuldetAn: Object.entries(schuldetAn).map(([person, betrag]) => ({ person, betrag: round2(betrag) })),
    bekommtVon: Object.entries(bekommtVon).map(([person, betrag]) => ({ person, betrag: round2(betrag) })),
  };
}

// =====================================================================
// Testfälle -- werden nur ausgeführt und ausgegeben (Eingabe + Ausgabe),
// kein automatischer Soll/Ist-Vergleich. Zum selbst Nachrechnen/Prüfen.
// =====================================================================

function zeige(titel, eingabeText, fn) {
  console.log("\n--- " + titel + " ---");
  console.log("Eingabe: " + eingabeText);
  try {
    const ergebnis = fn();
    console.log("Ausgabe:", ergebnis);
  } catch (e) {
    console.log("Wirft Fehler:", e.message);
  }
}

console.log("=====================================================");
console.log("ALGORITHMUS 1: Kostenberechnung pro Fahrer");
console.log("=====================================================");

zeige(
  "Normalfall",
  "km=100, verbrauch=7, preis=1.5, mitfahrer=2, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(100, 7, 1.5, 2, true)
);

zeige(
  "Fahrer zählt nicht mit",
  "km=100, verbrauch=7, preis=1.5, mitfahrer=2, fahrerMitrechnen=false",
  () => berechneKostenProFahrt(100, 7, 1.5, 2, false)
);

zeige(
  "0 Mitfahrer, Fahrer zählt mit (Fahrer trägt alles allein)",
  "km=40, verbrauch=5, preis=1.8, mitfahrer=0, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(40, 5, 1.8, 0, true)
);

zeige(
  "Rundung bei krummen Werten",
  "km=37, verbrauch=5.8, preis=1.679, mitfahrer=3, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(37, 5.8, 1.679, 3, true)
);

zeige(
  "Fehlerfall: 0 Mitfahrer UND Fahrer zählt nicht mit (Division durch 0)",
  "km=50, verbrauch=6, preis=1.6, mitfahrer=0, fahrerMitrechnen=false",
  () => berechneKostenProFahrt(50, 6, 1.6, 0, false)
);

zeige(
  "Fehlerfall: Kilometer = 0",
  "km=0, verbrauch=6, preis=1.6, mitfahrer=2, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(0, 6, 1.6, 2, true)
);

zeige(
  "Fehlerfall: negative Kilometer",
  "km=-10, verbrauch=6, preis=1.6, mitfahrer=2, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(-10, 6, 1.6, 2, true)
);

zeige(
  "Fehlerfall: Verbrauch = 0",
  "km=50, verbrauch=0, preis=1.6, mitfahrer=2, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(50, 0, 1.6, 2, true)
);

zeige(
  "Fehlerfall: Kraftstoffpreis negativ",
  "km=50, verbrauch=6, preis=-1.6, mitfahrer=2, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(50, 6, -1.6, 2, true)
);

zeige(
  "Fehlerfall: Mitfahrer keine ganze Zahl (2.5)",
  "km=50, verbrauch=6, preis=1.6, mitfahrer=2.5, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(50, 6, 1.6, 2.5, true)
);

zeige(
  "Fehlerfall: Mitfahrer negativ",
  "km=50, verbrauch=6, preis=1.6, mitfahrer=-1, fahrerMitrechnen=true",
  () => berechneKostenProFahrt(50, 6, 1.6, -1, true)
);

console.log("\n=====================================================");
console.log("ALGORITHMUS 2: Schulden-Übersicht pro Person");
console.log("=====================================================");

const beispielFahrten = [
  { fahrer: "A", mitfahrer: [{ person: "B", anteil: 10, bezahlt: false }, { person: "C", anteil: 10, bezahlt: true }] },
  { fahrer: "B", mitfahrer: [{ person: "A", anteil: 5, bezahlt: false }] },
  { fahrer: "A", mitfahrer: [{ person: "B", anteil: 7.5, bezahlt: false }] },
  { fahrer: "C", mitfahrer: [{ person: "D", anteil: 20, bezahlt: true }] },
];
const mehrereGegenpersonen = [
  { fahrer: "X", mitfahrer: [{ person: "Y", anteil: 3, bezahlt: false }] },
  { fahrer: "Z", mitfahrer: [{ person: "Y", anteil: 4, bezahlt: false }] },
];

console.log("\nBeispiel-Fahrtenliste (für die ersten 4 Testfälle):");
console.log(JSON.stringify(beispielFahrten, null, 2));

zeige(
  "Person B (zweimal Mitfahrer bei A, einmal Fahrer mit offenem Anteil von A)",
  "fahrten=beispielFahrten, ausgewaehltePerson='B'",
  () => schuldenUebersichtProPerson(beispielFahrten, "B")
);

zeige(
  "Person A (Fahrer mit offenem Anteil von B, bezahlter Anteil von C wird ignoriert; Mitfahrer bei B)",
  "fahrten=beispielFahrten, ausgewaehltePerson='A'",
  () => schuldenUebersichtProPerson(beispielFahrten, "A")
);

zeige(
  "Person D (Anteil bereits bezahlt -> keine offenen Schulden)",
  "fahrten=beispielFahrten, ausgewaehltePerson='D'",
  () => schuldenUebersichtProPerson(beispielFahrten, "D")
);

zeige(
  "Person Z (an keiner Fahrt beteiligt -> beide Listen leer)",
  "fahrten=beispielFahrten, ausgewaehltePerson='Z'",
  () => schuldenUebersichtProPerson(beispielFahrten, "Z")
);

console.log("\nZweite Fahrtenliste (mehrere Gegenpersonen):");
console.log(JSON.stringify(mehrereGegenpersonen, null, 2));

zeige(
  "Person Y (schuldet zwei verschiedenen Personen -> getrennt ausgewiesen)",
  "fahrten=mehrereGegenpersonen, ausgewaehltePerson='Y'",
  () => schuldenUebersichtProPerson(mehrereGegenpersonen, "Y")
);

zeige(
  "Fehlerfall: fahrten ist kein Array",
  "fahrten=null, ausgewaehltePerson='A'",
  () => schuldenUebersichtProPerson(null, "A")
);

zeige(
  "Fehlerfall: keine Person ausgewählt",
  "fahrten=beispielFahrten, ausgewaehltePerson=''",
  () => schuldenUebersichtProPerson(beispielFahrten, "")
);

console.log("");

// Falls man die Funktionen in einem anderen Node-Modul importieren will:
if (typeof module !== "undefined") {
  module.exports = { berechneKostenProFahrt, schuldenUebersichtProPerson, round2 };
}