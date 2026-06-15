const express = require("express");
const mysql = require("mysql2");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
console.log("Configurazione MySQL Railway:", {
  host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
  user: process.env.MYSQLUSER || process.env.DB_USER || "root",
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || "movelands",
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  hasPassword: Boolean(process.env.MYSQLPASSWORD || process.env.DB_PASSWORD)
});
const db = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
  user: process.env.MYSQLUSER || process.env.DB_USER || "root",
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || "movelands",
  port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("Errore connessione MySQL:", err.message);
    console.error("Dati connessione usati:", {
      host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
      user: process.env.MYSQLUSER || process.env.DB_USER || "root",
      database: process.env.MYSQLDATABASE || process.env.DB_NAME || "movelands",
      port: process.env.MYSQLPORT || process.env.DB_PORT || 3306
    });
    return;
  }

  console.log("Database MySQL collegato correttamente.");
  connection.release();
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/mezzi-debug", (req, res) => {
  const sql = `
    SELECT 
      id_mezzo,
      tipo,
      modello,
      stato,
      batteria,
      latitudine,
      longitudine,
      tariffa_minuto,
      area
    FROM mezzi
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Errore recupero mezzi-debug:", err.message);
      res.status(500).json({
        error: "Errore nel recupero dei mezzi",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});

app.get("/api/mezzi", (req, res) => {
  const sql = `
    SELECT 
      id_mezzo,
      tipo,
      modello,
      stato,
      batteria,
      latitudine,
      longitudine,
      tariffa_minuto,
      area
    FROM mezzi
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Errore recupero mezzi:", err.message);
      res.status(500).json({
        error: "Errore nel recupero dei mezzi",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});

app.post("/api/registrazione", (req, res) => {
  const { nome, cognome, email, password } = req.body;

  if (!nome || !cognome || !email || !password) {
    res.status(400).json({
      error: "Tutti i campi sono obbligatori"
    });
    return;
  }

  const controlloEmailSql = `
    SELECT email
    FROM utenti
    WHERE email = ?
  `;

  db.query(controlloEmailSql, [email], (err, rows) => {
    if (err) {
      console.error("Errore controllo email:", err.message);
      res.status(500).json({
        error: "Errore durante il controllo dell'email",
        dettaglio: err.message
      });
      return;
    }

    if (rows.length > 0) {
      res.status(409).json({
        error: "Email già registrata"
      });
      return;
    }

    const inserisciUtenteSql = `
      INSERT INTO utenti (
        nome,
        cognome,
        email,
        password,
        ruolo
      )
      VALUES (?, ?, ?, ?, 'utente')
    `;

    db.query(inserisciUtenteSql, [nome, cognome, email, password], (err, result) => {
      if (err) {
        console.error("Errore registrazione utente:", err.message);
        res.status(500).json({
          error: "Errore durante la registrazione",
          dettaglio: err.message
        });
        return;
      }

      res.json({
        message: "Account creato correttamente",
        id_utente: result.insertId,
        nome,
        cognome,
        email,
        ruolo: "utente"
      });
    });
  });
});

app.post("/api/login", (req, res) => {
  const { email, password, ruolo } = req.body;

  if (!email || !password || !ruolo) {
    res.status(400).json({
      error: "Email, password e ruolo sono obbligatori"
    });
    return;
  }

  const sql = `
    SELECT 
      id_utente,
      nome,
      cognome,
      email,
      ruolo
    FROM utenti
    WHERE email = ?
      AND password = ?
      AND ruolo = ?
  `;

  db.query(sql, [email, password, ruolo], (err, rows) => {
    if (err) {
      console.error("Errore login:", err.message);
      res.status(500).json({
        error: "Errore durante il login",
        dettaglio: err.message
      });
      return;
    }

    if (rows.length === 0) {
      res.status(401).json({
        error: "Credenziali non valide"
      });
      return;
    }

    res.json({
      message: "Login effettuato correttamente",
      utente: rows[0]
    });
  });
});

app.get("/api/utenti", (req, res) => {
  const sql = `
    SELECT 
      id_utente,
      nome,
      cognome,
      email,
      ruolo,
      data_registrazione
    FROM utenti
    ORDER BY id_utente DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Errore recupero utenti:", err.message);
      res.status(500).json({
        error: "Errore nel recupero degli utenti",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});

app.post("/api/prenotazioni", (req, res) => {
  const { id_utente, id_mezzo } = req.body;

  if (!id_utente || !id_mezzo) {
    res.status(400).json({
      error: "id_utente e id_mezzo sono obbligatori"
    });
    return;
  }

  const controlloMezzoSql = `
    SELECT id_mezzo, stato
    FROM mezzi
    WHERE id_mezzo = ?
  `;

  db.query(controlloMezzoSql, [id_mezzo], (err, rows) => {
    if (err) {
      console.error("Errore controllo mezzo:", err.message);
      res.status(500).json({
        error: "Errore nel controllo del mezzo",
        dettaglio: err.message
      });
      return;
    }

    if (rows.length === 0) {
      res.status(404).json({
        error: "Mezzo non trovato"
      });
      return;
    }

    const mezzo = rows[0];

    if (String(mezzo.stato).trim().toLowerCase() !== "disponibile") {
      res.status(409).json({
        error: "Mezzo non disponibile"
      });
      return;
    }

    const inserisciPrenotazioneSql = `
      INSERT INTO prenotazioni (
        id_utente,
        id_mezzo,
        stato_prenotazione,
        data_ora_scadenza
      )
      VALUES (?, ?, 'attiva', DATE_ADD(NOW(), INTERVAL 15 MINUTE))
    `;

    db.query(inserisciPrenotazioneSql, [id_utente, id_mezzo], (err, result) => {
      if (err) {
        console.error("Errore creazione prenotazione:", err.message);
        res.status(500).json({
          error: "Errore nella creazione della prenotazione",
          dettaglio: err.message
        });
        return;
      }

      const idPrenotazione = result.insertId;

      const aggiornaMezzoSql = `
        UPDATE mezzi
        SET stato = 'prenotato'
        WHERE id_mezzo = ?
      `;

      db.query(aggiornaMezzoSql, [id_mezzo], (err, updateResult) => {
        if (err) {
          console.error("Errore aggiornamento mezzo:", err.message);
          res.status(500).json({
            error: "Prenotazione creata, ma errore aggiornamento mezzo",
            dettaglio: err.message
          });
          return;
        }

        console.log("Prenotazione creata:", idPrenotazione);
        console.log("Righe aggiornate nella tabella mezzi:", updateResult.affectedRows);

        res.json({
          message: "Prenotazione creata correttamente",
          id_prenotazione: idPrenotazione,
          id_mezzo
        });
      });
    });
  });
});

app.get("/api/prenotazioni", (req, res) => {
  const sql = `
    SELECT 
      prenotazioni.id_prenotazione,
      utenti.id_utente,
      utenti.nome,
      utenti.cognome,
      mezzi.id_mezzo,
      mezzi.tipo,
      mezzi.modello,
      mezzi.area,
      mezzi.batteria,
      mezzi.tariffa_minuto,
      mezzi.stato AS stato_mezzo,
      prenotazioni.stato_prenotazione,
      prenotazioni.data_ora_prenotazione,
      prenotazioni.data_ora_scadenza
    FROM prenotazioni
    JOIN utenti ON prenotazioni.id_utente = utenti.id_utente
    JOIN mezzi ON prenotazioni.id_mezzo = mezzi.id_mezzo
    ORDER BY prenotazioni.id_prenotazione DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Errore recupero prenotazioni:", err.message);
      res.status(500).json({
        error: "Errore nel recupero delle prenotazioni",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});

app.get("/api/prenotazioni/utente/:id_utente", (req, res) => {
  const idUtente = req.params.id_utente;

  const sql = `
    SELECT 
      prenotazioni.id_prenotazione,
      prenotazioni.id_utente,
      prenotazioni.id_mezzo,
      prenotazioni.stato_prenotazione,
      prenotazioni.data_ora_prenotazione,
      prenotazioni.data_ora_scadenza,
      mezzi.tipo,
      mezzi.modello,
      mezzi.stato AS stato_mezzo,
      mezzi.batteria,
      mezzi.area,
      mezzi.tariffa_minuto
    FROM prenotazioni
    JOIN mezzi ON prenotazioni.id_mezzo = mezzi.id_mezzo
    WHERE prenotazioni.id_utente = ?
      AND LOWER(TRIM(prenotazioni.stato_prenotazione)) = 'attiva'
    ORDER BY prenotazioni.id_prenotazione DESC
  `;

  db.query(sql, [idUtente], (err, rows) => {
    if (err) {
      console.error("Errore recupero prenotazioni attive utente:", err.message);
      res.status(500).json({
        error: "Errore nel recupero delle prenotazioni attive dell'utente",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});

app.get("/api/prenotazioni/utente/:id_utente/storico", (req, res) => {
  const idUtente = req.params.id_utente;

  const sql = `
    SELECT 
      prenotazioni.id_prenotazione,
      prenotazioni.id_utente,
      prenotazioni.id_mezzo,
      prenotazioni.stato_prenotazione,
      prenotazioni.data_ora_prenotazione,
      prenotazioni.data_ora_scadenza,
      mezzi.tipo,
      mezzi.modello,
      mezzi.stato AS stato_mezzo,
      mezzi.batteria,
      mezzi.area,
      mezzi.tariffa_minuto
    FROM prenotazioni
    JOIN mezzi ON prenotazioni.id_mezzo = mezzi.id_mezzo
    WHERE prenotazioni.id_utente = ?
      AND LOWER(TRIM(prenotazioni.stato_prenotazione)) = 'completata'
    ORDER BY prenotazioni.id_prenotazione DESC
  `;

  db.query(sql, [idUtente], (err, rows) => {
    if (err) {
      console.error("Errore recupero storico prenotazioni:", err.message);
      res.status(500).json({
        error: "Errore nel recupero dello storico prenotazioni",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});

app.put("/api/prenotazioni/:id_prenotazione/termina", (req, res) => {
  const idPrenotazione = req.params.id_prenotazione;

  // Recupero la prenotazione insieme al mezzo, perché mi serve anche la tariffa al minuto.
  const cercaPrenotazioneSql = `
    SELECT 
      prenotazioni.id_prenotazione,
      prenotazioni.id_mezzo,
      prenotazioni.stato_prenotazione,
      prenotazioni.data_ora_prenotazione,
      mezzi.tariffa_minuto
    FROM prenotazioni
    JOIN mezzi ON prenotazioni.id_mezzo = mezzi.id_mezzo
    WHERE prenotazioni.id_prenotazione = ?
  `;

  db.query(cercaPrenotazioneSql, [idPrenotazione], (err, rows) => {
    if (err) {
      console.error("Errore ricerca prenotazione:", err.message);
      res.status(500).json({
        error: "Errore durante la ricerca della prenotazione",
        dettaglio: err.message
      });
      return;
    }

    if (rows.length === 0) {
      res.status(404).json({
        error: "Prenotazione non trovata"
      });
      return;
    }

    const prenotazione = rows[0];

    if (String(prenotazione.stato_prenotazione).trim().toLowerCase() !== "attiva") {
      res.status(409).json({
        error: "La prenotazione non è attiva o è già stata terminata"
      });
      return;
    }

    // Calcolo la durata reale della corsa in minuti.
    // Uso almeno 1 minuto, così una corsa terminata subito non costa 0.
    const calcoloCostoSql = `
      SELECT 
        GREATEST(TIMESTAMPDIFF(MINUTE, ?, NOW()), 1) AS durata_minuti
    `;

    db.query(calcoloCostoSql, [prenotazione.data_ora_prenotazione], (err, durataRows) => {
      if (err) {
        console.error("Errore calcolo durata:", err.message);
        res.status(500).json({
          error: "Errore durante il calcolo della durata",
          dettaglio: err.message
        });
        return;
      }

      const durataMinuti = Number(durataRows[0].durata_minuti);
      const tariffaMinuto = Number(prenotazione.tariffa_minuto);
      const costoTotale = Number((durataMinuti * tariffaMinuto).toFixed(2));

      // Aggiorno la prenotazione salvando fine corsa, durata e costo.
      const terminaPrenotazioneSql = `
        UPDATE prenotazioni
        SET 
          stato_prenotazione = 'completata',
          data_ora_fine = NOW(),
          durata_minuti = ?,
          costo_totale = ?
        WHERE id_prenotazione = ?
      `;

      db.query(
        terminaPrenotazioneSql,
        [durataMinuti, costoTotale, idPrenotazione],
        (err) => {
          if (err) {
            console.error("Errore aggiornamento prenotazione:", err.message);
            res.status(500).json({
              error: "Errore durante la terminazione della prenotazione",
              dettaglio: err.message
            });
            return;
          }

          // Quando la corsa termina, il mezzo torna disponibile.
          const aggiornaMezzoSql = `
            UPDATE mezzi
            SET stato = 'disponibile'
            WHERE id_mezzo = ?
          `;

          db.query(aggiornaMezzoSql, [prenotazione.id_mezzo], (err, updateResult) => {
            if (err) {
              console.error("Errore aggiornamento mezzo:", err.message);
              res.status(500).json({
                error: "Prenotazione terminata, ma errore nel rendere disponibile il mezzo",
                dettaglio: err.message
              });
              return;
            }

            console.log("Prenotazione terminata:", idPrenotazione);
            console.log("Mezzo reso disponibile:", prenotazione.id_mezzo);
            console.log("Durata minuti:", durataMinuti);
            console.log("Costo totale:", costoTotale);
            console.log("Righe aggiornate nella tabella mezzi:", updateResult.affectedRows);

            res.json({
              message: "Corsa terminata correttamente",
              id_prenotazione: Number(idPrenotazione),
              id_mezzo: prenotazione.id_mezzo,
              durata_minuti: durataMinuti,
              tariffa_minuto: tariffaMinuto,
              costo_totale: costoTotale
            });
          });
        }
      );
    });
  });
});

app.get("/api/portafoglio/:id_utente", (req, res) => {
  const idUtente = req.params.id_utente;

  const cercaSql = `
    SELECT id_portafoglio, id_utente, saldo
    FROM portafogli
    WHERE id_utente = ?
  `;

  db.query(cercaSql, [idUtente], (err, rows) => {
    if (err) {
      console.error("Errore recupero portafoglio:", err.message);
      res.status(500).json({
        error: "Errore nel recupero del portafoglio",
        dettaglio: err.message
      });
      return;
    }

    if (rows.length > 0) {
      res.json(rows[0]);
      return;
    }

    const creaSql = `
      INSERT INTO portafogli (id_utente, saldo)
      VALUES (?, 0.00)
    `;

    db.query(creaSql, [idUtente], (err, result) => {
      if (err) {
        console.error("Errore creazione portafoglio:", err.message);
        res.status(500).json({
          error: "Errore nella creazione del portafoglio",
          dettaglio: err.message
        });
        return;
      }

      res.json({
        id_portafoglio: result.insertId,
        id_utente: Number(idUtente),
        saldo: "0.00"
      });
    });
  });
});

app.get("/api/carte/:id_utente", (req, res) => {
  const idUtente = req.params.id_utente;

  const sql = `
    SELECT 
      id_carta,
      id_utente,
      intestatario,
      circuito,
      ultime_quattro,
      scadenza,
      data_aggiunta
    FROM carte_pagamento
    WHERE id_utente = ?
    ORDER BY id_carta DESC
  `;

  db.query(sql, [idUtente], (err, rows) => {
    if (err) {
      console.error("Errore recupero carte:", err.message);
      res.status(500).json({
        error: "Errore nel recupero delle carte",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});

app.post("/api/carte", (req, res) => {
  const { id_utente, intestatario, numero_carta, circuito, scadenza } = req.body;

  if (!id_utente || !intestatario || !numero_carta || !circuito || !scadenza) {
    res.status(400).json({
      error: "Tutti i campi della carta sono obbligatori"
    });
    return;
  }

  const numeroPulito = String(numero_carta).replace(/\s+/g, "");

  if (!/^[0-9]+$/.test(numeroPulito)) {
    res.status(400).json({
      error: "Il numero carta deve contenere solo cifre"
    });
    return;
  }

  if (numeroPulito.length !== 12) {
    res.status(400).json({
      error: "Il numero carta deve contenere esattamente 12 cifre"
    });
    return;
  }

  if (!/^\d{2}\/\d{4}$/.test(scadenza)) {
    res.status(400).json({
      error: "La scadenza deve essere nel formato MM/AAAA"
    });
    return;
  }

  const mese = Number(scadenza.slice(0, 2));
  const anno = Number(scadenza.slice(3, 7));

  if (mese < 1 || mese > 12 || anno < 2024 || anno > 2100) {
    res.status(400).json({
      error: "Scadenza carta non valida"
    });
    return;
  }

  const ultimeQuattro = numeroPulito.slice(-4);

  const sql = `
    INSERT INTO carte_pagamento (
      id_utente,
      intestatario,
      circuito,
      ultime_quattro,
      scadenza
    )
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [id_utente, intestatario, circuito, ultimeQuattro, scadenza], (err, result) => {
    if (err) {
      console.error("Errore aggiunta carta:", err.message);
      res.status(500).json({
        error: "Errore durante il salvataggio della carta",
        dettaglio: err.message
      });
      return;
    }

    res.json({
      message: "Carta aggiunta correttamente",
      id_carta: result.insertId,
      ultime_quattro: ultimeQuattro
    });
  });
});
// =====================================================
// ELIMINAZIONE DI UNA CARTA
// =====================================================

// Elimina una carta appartenente all'utente indicato.
// Il controllo dell'id_utente impedisce di eliminare carte
// appartenenti a un altro utente.
app.delete("/api/carte/:id_carta", (req, res) => {
  const idCarta = Number(req.params.id_carta);
  const idUtente = Number(req.body.id_utente);

  // Controllo che l'identificativo della carta sia valido.
  if (!Number.isInteger(idCarta) || idCarta <= 0) {
    res.status(400).json({
      error: "Identificativo carta non valido"
    });
    return;
  }

  // Controllo che l'identificativo dell'utente sia valido.
  if (!Number.isInteger(idUtente) || idUtente <= 0) {
    res.status(400).json({
      error: "Identificativo utente non valido"
    });
    return;
  }

  // Cerco la carta controllando contemporaneamente
  // che appartenga davvero all'utente indicato.
  const verificaCartaSql = `
    SELECT
      id_carta,
      id_utente,
      circuito,
      ultime_quattro
    FROM carte_pagamento
    WHERE id_carta = ?
      AND id_utente = ?
  `;

  db.query(verificaCartaSql, [idCarta, idUtente], (err, rows) => {
    if (err) {
      console.error("Errore verifica carta da eliminare:", err.message);

      res.status(500).json({
        error: "Errore durante la verifica della carta",
        dettaglio: err.message
      });
      return;
    }

    // Se non viene trovata, la carta non esiste
    // oppure appartiene a un altro utente.
    if (rows.length === 0) {
      res.status(404).json({
        error: "Carta non trovata oppure non appartenente all'utente"
      });
      return;
    }

    const carta = rows[0];

    // Elimino la carta solo se id_carta e id_utente coincidono.
    const eliminaCartaSql = `
      DELETE FROM carte_pagamento
      WHERE id_carta = ?
        AND id_utente = ?
    `;

    db.query(eliminaCartaSql, [idCarta, idUtente], (err, result) => {
      if (err) {
        console.error("Errore eliminazione carta:", err.message);

        res.status(500).json({
          error: "Errore durante l'eliminazione della carta",
          dettaglio: err.message
        });
        return;
      }

      // Controllo aggiuntivo nel caso in cui la carta
      // sia già stata eliminata.
      if (result.affectedRows === 0) {
        res.status(404).json({
          error: "Carta non trovata oppure già eliminata"
        });
        return;
      }

      res.json({
        message:
          `Carta ${carta.circuito} •••• ${carta.ultime_quattro} eliminata correttamente`,
        id_carta: idCarta
      });
    });
  });
});
app.post("/api/portafoglio/ricarica", (req, res) => {
  const { id_utente, id_carta, importo } = req.body;

  if (!id_utente || !id_carta || !importo) {
    res.status(400).json({
      error: "Per ricaricare devi selezionare una carta registrata e un importo"
    });
    return;
  }

  const importoNumerico = Number(importo);

  if (Number.isNaN(importoNumerico) || importoNumerico <= 0) {
    res.status(400).json({
      error: "Importo non valido"
    });
    return;
  }

  const verificaCartaSql = `
    SELECT 
      id_carta,
      id_utente,
      circuito,
      ultime_quattro
    FROM carte_pagamento
    WHERE id_carta = ?
      AND id_utente = ?
  `;

  db.query(verificaCartaSql, [id_carta, id_utente], (err, carte) => {
    if (err) {
      console.error("Errore verifica carta:", err.message);
      res.status(500).json({
        error: "Errore durante la verifica della carta",
        dettaglio: err.message
      });
      return;
    }

    if (carte.length === 0) {
      res.status(403).json({
        error: "Carta non trovata. Registra una carta valida prima di ricaricare"
      });
      return;
    }

    const carta = carte[0];

    const contaRicaricheSql = `
      SELECT COUNT(*) AS numero_ricariche
      FROM ricariche_portafoglio
      WHERE id_utente = ?
    `;

    db.query(contaRicaricheSql, [id_utente], (err, conteggio) => {
      if (err) {
        console.error("Errore controllo prima ricarica:", err.message);
        res.status(500).json({
          error: "Errore durante il controllo della promozione",
          dettaglio: err.message
        });
        return;
      }

      const numeroRicariche = Number(conteggio[0].numero_ricariche);
      const isPrimaRicarica = numeroRicariche === 0;
      const bonusApplicato = isPrimaRicarica && importoNumerico >= 20 ? 5.00 : 0.00;
      const totaleAccreditato = importoNumerico + bonusApplicato;

      const creaPortafoglioSql = `
        INSERT INTO portafogli (id_utente, saldo)
        VALUES (?, 0.00)
        ON DUPLICATE KEY UPDATE id_utente = id_utente
      `;

      db.query(creaPortafoglioSql, [id_utente], (err) => {
        if (err) {
          console.error("Errore controllo portafoglio:", err.message);
          res.status(500).json({
            error: "Errore nel controllo del portafoglio",
            dettaglio: err.message
          });
          return;
        }

        const aggiornaSaldoSql = `
          UPDATE portafogli
          SET saldo = saldo + ?
          WHERE id_utente = ?
        `;

        db.query(aggiornaSaldoSql, [totaleAccreditato, id_utente], (err) => {
          if (err) {
            console.error("Errore aggiornamento saldo:", err.message);
            res.status(500).json({
              error: "Errore durante la ricarica",
              dettaglio: err.message
            });
            return;
          }

          const metodoPagamento = `${carta.circuito} •••• ${carta.ultime_quattro}`;

          const registraRicaricaSql = `
            INSERT INTO ricariche_portafoglio (
              id_utente,
              importo,
              bonus_applicato,
              totale_accreditato,
              metodo
            )
            VALUES (?, ?, ?, ?, ?)
          `;

          db.query(
            registraRicaricaSql,
            [id_utente, importoNumerico, bonusApplicato, totaleAccreditato, metodoPagamento],
            (err) => {
              if (err) {
                console.error("Errore registrazione ricarica:", err.message);
                res.status(500).json({
                  error: "Saldo aggiornato, ma errore nel salvataggio della ricarica",
                  dettaglio: err.message
                });
                return;
              }

              const saldoSql = `
                SELECT saldo
                FROM portafogli
                WHERE id_utente = ?
              `;

              db.query(saldoSql, [id_utente], (err, rows) => {
                if (err) {
                  console.error("Errore recupero nuovo saldo:", err.message);
                  res.status(500).json({
                    error: "Ricarica completata, ma errore nel recupero saldo",
                    dettaglio: err.message
                  });
                  return;
                }

                res.json({
                  message: "Ricarica effettuata correttamente",
                  saldo: rows[0].saldo,
                  carta_usata: metodoPagamento,
                  prima_ricarica: isPrimaRicarica,
                  bonus_applicato: bonusApplicato,
                  totale_accreditato: totaleAccreditato
                });
              });
            }
          );
        });
      });
    });
  });
});

app.get("/api/portafoglio/:id_utente/ricariche", (req, res) => {
  const idUtente = req.params.id_utente;

  const sql = `
    SELECT 
      id_ricarica,
      id_utente,
      importo,
      bonus_applicato,
      totale_accreditato,
      metodo,
      data_ricarica
    FROM ricariche_portafoglio
    WHERE id_utente = ?
    ORDER BY id_ricarica DESC
  `;

  db.query(sql, [idUtente], (err, rows) => {
    if (err) {
      console.error("Errore recupero ricariche:", err.message);
      res.status(500).json({
        error: "Errore nel recupero delle ricariche",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});

app.get("/api/segnalazioni", (req, res) => {
  const sql = `
    SELECT 
      segnalazioni.id_segnalazione,
      utenti.nome,
      utenti.cognome,
      segnalazioni.id_mezzo,
      segnalazioni.tipo_segnalazione,
      segnalazioni.descrizione,
      segnalazioni.stato,
      segnalazioni.data_segnalazione
    FROM segnalazioni
    JOIN utenti ON segnalazioni.id_utente = utenti.id_utente
    ORDER BY segnalazioni.id_segnalazione DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Errore recupero segnalazioni:", err.message);
      res.status(500).json({
        error: "Errore nel recupero delle segnalazioni",
        dettaglio: err.message
      });
      return;
    }

    res.json(rows);
  });
});
// =====================================================
// ROTTE SUPPORTO: SEGNALAZIONI E CHAT
// =====================================================

// Crea una nuova segnalazione inviata da un utente.
app.post("/api/supporto/segnalazioni", (req, res) => {
  const {
    id_utente,
    nome_utente,
    categoria,
    tipo_problema,
    descrizione,
    posizione
  } = req.body;

  if (!categoria || !tipo_problema || !descrizione) {
    return res.status(400).json({
      error: "Categoria, tipo di problema e descrizione sono obbligatori"
    });
  }

  const sql = `
    INSERT INTO supporto_segnalazioni
    (id_utente, nome_utente, categoria, tipo_problema, descrizione, posizione)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      id_utente || null,
      nome_utente || "Utente",
      categoria,
      tipo_problema,
      descrizione,
      posizione || null
    ],
    (err, result) => {
      if (err) {
        console.error("Errore creazione segnalazione:", err.message);
        return res.status(500).json({
          error: "Errore durante l'invio della segnalazione",
          dettaglio: err.message
        });
      }

      res.json({
        message: "Segnalazione inviata correttamente",
        id_segnalazione: result.insertId
      });
    }
  );
});

// Restituisce tutte le segnalazioni per la dashboard amministratore.
app.get("/api/supporto/segnalazioni", (req, res) => {
  const sql = `
    SELECT *
    FROM supporto_segnalazioni
    ORDER BY data_creazione DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Errore lettura segnalazioni:", err.message);
      return res.status(500).json({
        error: "Errore durante il recupero delle segnalazioni",
        dettaglio: err.message
      });
    }

    res.json(results);
  });
});

// Aggiorna lo stato di una segnalazione.
app.put("/api/supporto/segnalazioni/:id_segnalazione/stato", (req, res) => {
  const idSegnalazione = req.params.id_segnalazione;
  const { stato } = req.body;

  const statiConsentiti = ["nuova", "in_lavorazione", "risolta"];

  if (!statiConsentiti.includes(stato)) {
    return res.status(400).json({
      error: "Stato non valido"
    });
  }

  const sql = `
    UPDATE supporto_segnalazioni
    SET stato = ?
    WHERE id_segnalazione = ?
  `;

  db.query(sql, [stato, idSegnalazione], (err) => {
    if (err) {
      console.error("Errore aggiornamento stato segnalazione:", err.message);
      return res.status(500).json({
        error: "Errore durante l'aggiornamento della segnalazione",
        dettaglio: err.message
      });
    }

    res.json({
      message: "Stato segnalazione aggiornato correttamente"
    });
  });
});

// Crea una conversazione chat per l'utente.
app.post("/api/supporto/chat/conversazioni", (req, res) => {
  const { id_utente, nome_utente } = req.body;

  const sql = `
    INSERT INTO supporto_chat_conversazioni
    (id_utente, nome_utente)
    VALUES (?, ?)
  `;

  db.query(sql, [id_utente || null, nome_utente || "Utente"], (err, result) => {
    if (err) {
      console.error("Errore creazione conversazione:", err.message);
      return res.status(500).json({
        error: "Errore durante l'apertura della chat",
        dettaglio: err.message
      });
    }

    res.json({
      message: "Conversazione aperta correttamente",
      id_conversazione: result.insertId
    });
  });
});

// Restituisce tutte le conversazioni per l'amministratore.
app.get("/api/supporto/chat/conversazioni", (req, res) => {
  const sql = `
    SELECT 
      c.id_conversazione,
      c.id_utente,
      c.nome_utente,
      c.stato,
      c.data_creazione,
      (
        SELECT testo
        FROM supporto_chat_messaggi m
        WHERE m.id_conversazione = c.id_conversazione
        ORDER BY m.data_invio DESC
        LIMIT 1
      ) AS ultimo_messaggio
    FROM supporto_chat_conversazioni c
    ORDER BY c.data_creazione DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Errore lettura conversazioni:", err.message);
      return res.status(500).json({
        error: "Errore durante il recupero delle conversazioni",
        dettaglio: err.message
      });
    }

    res.json(results);
  });
});

// Restituisce i messaggi di una conversazione.
app.get("/api/supporto/chat/:id_conversazione/messaggi", (req, res) => {
  const idConversazione = req.params.id_conversazione;

  const sql = `
    SELECT *
    FROM supporto_chat_messaggi
    WHERE id_conversazione = ?
    ORDER BY data_invio ASC
  `;

  db.query(sql, [idConversazione], (err, results) => {
    if (err) {
      console.error("Errore lettura messaggi:", err.message);
      return res.status(500).json({
        error: "Errore durante il recupero dei messaggi",
        dettaglio: err.message
      });
    }

    res.json(results);
  });
});

// Invia un messaggio in una conversazione.
app.post("/api/supporto/chat/:id_conversazione/messaggi", (req, res) => {
  const idConversazione = req.params.id_conversazione;
  const { mittente, testo } = req.body;

  if (!mittente || !testo) {
    return res.status(400).json({
      error: "Mittente e testo sono obbligatori"
    });
  }

  if (!["utente", "operatore"].includes(mittente)) {
    return res.status(400).json({
      error: "Mittente non valido"
    });
  }

  const sql = `
    INSERT INTO supporto_chat_messaggi
    (id_conversazione, mittente, testo)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [idConversazione, mittente, testo], (err, result) => {
    if (err) {
      console.error("Errore invio messaggio:", err.message);
      return res.status(500).json({
        error: "Errore durante l'invio del messaggio",
        dettaglio: err.message
      });
    }

    res.json({
      message: "Messaggio inviato correttamente",
      id_messaggio: result.insertId
    });
  });
});
app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});