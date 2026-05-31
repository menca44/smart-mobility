const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databaseDir = path.join(__dirname, "database");
const databasePath = path.join(databaseDir, "movelands.db");

if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir);
  console.log("Cartella database creata.");
}

if (fs.existsSync(databasePath)) {
  fs.unlinkSync(databasePath);
  console.log("Vecchio database eliminato.");
}

const db = new sqlite3.Database(databasePath);

const schemaPath = path.join(__dirname, "schema.sql");
const seedPath = path.join(__dirname, "seed.sql");

const schema = fs.readFileSync(schemaPath, "utf8");
const seed = fs.readFileSync(seedPath, "utf8");

db.serialize(() => {
  db.exec(schema, (err) => {
    if (err) {
      console.error("Errore nella creazione delle tabelle:", err.message);
      return;
    }

    console.log("Tabelle create correttamente.");

    db.exec(seed, (err) => {
      if (err) {
        console.error("Errore nell'inserimento dei dati:", err.message);
        return;
      }

      console.log("Dati di prova inseriti correttamente.");
    });
  });
});

db.close((err) => {
  if (err) {
    console.error("Errore nella chiusura del database:", err.message);
    return;
  }

  console.log("Database creato correttamente: database/movelands.db");
});