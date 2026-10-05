/*
 * Netlify Function: Ersetzt die /api/fahrten Endpunkte aus server.js.
 * GET  -> liefert fahrten.json aus Netlify Blobs
 * POST -> schreibt den gesendeten Body als fahrten.json in Netlify Blobs
 */

const { handleDataFile } = require("./_shared/store");

exports.handler = async (event) => {
  return handleDataFile("fahrten.json", event);
};
