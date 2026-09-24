const fs = require("fs");

const text = fs.readFileSync("Kunden_Dummy.csv", "utf8").replace(/^\uFEFF/, "");
const [kopf, ...zeilen] = text.trim().split(/\r?\n/).map(z => z.split(";"));

zeilen.forEach(z => {
  console.log("-".repeat(40));
  kopf.forEach((k, i) => console.log(k.padEnd(22) + z[i]));
});
console.log("-".repeat(40));