const fs = require("fs");

const text = fs.readFileSync("Kunden_Dummy.csv", "utf8").replace(/^\uFEFF/, "");
const [kopf, ...zeilen] = text.trim().split(/\r?\n/).map(z => z.split(";"));

const kunden = zeilen.map(z => Object.fromEntries(kopf.map((k, i) => [k, z[i]])));

console.table(kunden);