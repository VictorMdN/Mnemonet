//spreadsheets indexer.js
const fs = require("fs");
const path = require("path");

const folder = path.join(__dirname, "spreadsheets");
const files = fs.readdirSync(folder);
const indexFile = "index.json";

const index = files.indexOf(indexFile);
if (index > -1) {
  files.splice(index, 1);
}

fs.writeFileSync(
  path.join(folder, indexFile),
  JSON.stringify(files, null, 2)
);