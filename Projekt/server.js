/*
 * Minimaler lokaler Server für SpritShare.
 *
 * Start:  node server.js
 * Dann im Browser öffnen: http://localhost:3000
 *
 * Liefert spritshare.html aus und stellt zwei einfache API-Endpunkte bereit,
 * über die das Frontend automatisch personen.json und fahrten.json im selben
 * Ordner liest und schreibt - kein Ordner-Dialog, keine Berechtigungsabfrage.
 *
 * Braucht keine zusätzlichen Pakete (nur eingebaute Node-Module), also reicht
 * ein einfaches "node server.js" ohne vorheriges "npm install".
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function handleDataFile(filename) {
  return {
    async get(req, res) {
      const filePath = path.join(DIR, filename);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: filename + " existiert noch nicht" }));
        return;
      }
      const content = fs.readFileSync(filePath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(content.trim() ? content : "[]");
    },
    async post(req, res) {
      const body = await readRequestBody(req);
      try {
        JSON.parse(body); // Validierung: nur gültiges JSON wird geschrieben
      } catch (e) {
        sendJSON(res, 400, { error: "Ungültiges JSON" });
        return;
      }
      fs.writeFileSync(path.join(DIR, filename), body, "utf-8");
      sendJSON(res, 200, { ok: true });
    },
  };
}

const personenHandler = handleDataFile("personen.json");
const fahrtenHandler = handleDataFile("fahrten.json");

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/api/personen" && req.method === "GET") return personenHandler.get(req, res);
  if (url === "/api/personen" && req.method === "POST") return personenHandler.post(req, res);
  if (url === "/api/fahrten" && req.method === "GET") return fahrtenHandler.get(req, res);
  if (url === "/api/fahrten" && req.method === "POST") return fahrtenHandler.post(req, res);

  // Statische Dateien (v.a. spritshare.html) ausliefern
  let filePath = url === "/" ? "/spritshare.html" : url;
  filePath = path.join(DIR, filePath);

  // Verzeichnis-Traversal verhindern
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end("Verboten");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Nicht gefunden: " + url);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log("SpritShare läuft auf http://localhost:" + PORT);
  console.log("personen.json / fahrten.json werden automatisch in diesem Ordner gelesen/geschrieben:");
  console.log(DIR);
});