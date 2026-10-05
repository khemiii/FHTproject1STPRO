/*
 * Netlify Function: Ersetzt die /api/personen Endpunkte aus server.js.
 * GET  -> liefert personen.json aus Netlify Blobs
 * POST -> schreibt den gesendeten Body als personen.json in Netlify Blobs
 */

const { handleDataFile } = require("./_shared/store");

exports.handler = async (event) => {
  return handleDataFile("personen.json", event);
};
