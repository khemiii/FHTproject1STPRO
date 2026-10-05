/*
 * Gemeinsame Hilfsfunktionen für die Netlify Functions personen.js / fahrten.js.
 * Liegt bewusst in einem Unterordner (_shared), damit Netlify diese Datei
 * nicht selbst als eigene Function registriert.
 */

const { getStore, connectLambda } = require("@netlify/blobs");

const STORE_NAME = "fahrtentracker-data";

function getDataStore() {
  return getStore(STORE_NAME);
}

async function handleDataFile(key, event) {
  connectLambda(event); // nötig, damit Netlify Blobs im klassischen Function-Format funktioniert

  const store = getDataStore();

  if (event.httpMethod === "GET") {
    const data = await store.get(key, { type: "json" });
    if (data === null) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: key + " existiert noch nicht" }),
      };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(data),
    };
  }

  if (event.httpMethod === "POST") {
    let parsed;
    try {
      parsed = JSON.parse(event.body || "");
    } catch (e) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: "Ungültiges JSON" }),
      };
    }
    await store.setJSON(key, parsed);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true }),
    };
  }

  return {
    statusCode: 405,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ error: "Methode nicht erlaubt" }),
  };
}

module.exports = { handleDataFile };