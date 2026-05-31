const express = require("express");
const mysql = require("mysql2");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createConnection({
  host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
  user: process.env.MYSQLUSER || process.env.DB_USER || "root",
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || "movelands",
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.error("Errore connessione MySQL:", err.message);
    return;
  }

  console.log("Database MySQL collegato correttamente.");
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
      res.status(500).json({ error: "Errore nel recupero dei mezzi" });
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
      res.status(500).json({ error: "Errore nel recupero dei mezzi" });
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
        error: "Errore durante il controllo dell'email"
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
          error: "Errore durante la registrazione"
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
        error: "Errore durante il login"
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
        error: "Errore nel recupero degli utenti"
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
        error: "Errore nel controllo del mezzo"
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
          error: "Errore nella creazione della prenotazione"
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
            error: "Prenotazione creata, ma errore aggiornamento mezzo"
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
        error: "Errore nel recupero delle prenotazioni"
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
        error: "Errore nel recupero delle prenotazioni attive dell'utente"
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
        error: "Errore nel recupero dello storico prenotazioni"
      });
      return;
    }

    res.json(rows);
  });
});

app.put("/api/prenotazioni/:id_prenotazione/termina", (req, res) => {
  const idPrenotazione = req.params.id_prenotazione;

  const cercaPrenotazioneSql = `
    SELECT 
      id_prenotazione,
      id_mezzo,
      stato_prenotazione
    FROM prenotazioni
    WHERE id_prenotazione = ?
  `;

  db.query(cercaPrenotazioneSql, [idPrenotazione], (err, rows) => {
    if (err) {
      console.error("Errore ricerca prenotazione:", err.message);
      res.status(500).json({
        error: "Errore durante la ricerca della prenotazione"
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

    const terminaPrenotazioneSql = `
      UPDATE prenotazioni
      SET stato_prenotazione = 'completata'
      WHERE id_prenotazione = ?
    `;

    db.query(terminaPrenotazioneSql, [idPrenotazione], (err) => {
      if (err) {
        console.error("Errore aggiornamento prenotazione:", err.message);
        res.status(500).json({
          error: "Errore durante la terminazione della prenotazione"
        });
        return;
      }

      const aggiornaMezzoSql = `
        UPDATE mezzi
        SET stato = 'disponibile'
        WHERE id_mezzo = ?
      `;

      db.query(aggiornaMezzoSql, [prenotazione.id_mezzo], (err, updateResult) => {
        if (err) {
          console.error("Errore aggiornamento mezzo:", err.message);
          res.status(500).json({
            error: "Prenotazione terminata, ma errore nel rendere disponibile il mezzo"
          });
          return;
        }

        console.log("Prenotazione terminata:", idPrenotazione);
        console.log("Mezzo reso disponibile:", prenotazione.id_mezzo);
        console.log("Righe aggiornate nella tabella mezzi:", updateResult.affectedRows);

        res.json({
          message: "Prenotazione terminata correttamente",
          id_prenotazione: idPrenotazione,
          id_mezzo: prenotazione.id_mezzo
        });
      });
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
      res.status(500).json({ error: "Errore nel recupero del portafoglio" });
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
        res.status(500).json({ error: "Errore nella creazione del portafoglio" });
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
      res.status(500).json({ error: "Errore nel recupero delle carte" });
      return;
    }

    res.json(rows);
  });
});

app.post("/api/carte", (req, res) => {
  const { id_utente, intestatario, numero_carta, circuito, scadenza } = req.body;

  if (!id_utente || !intestatario || !numero_carta || !circuito || !scadenza) {
    res.status(400).json({ error: "Tutti i campi della carta sono obbligatori" });
    return;
  }

  const numeroPulito = String(numero_carta).replace(/\s+/g, "");

  if (!/^[0-9]+$/.test(numeroPulito)) {
    res.status(400).json({ error: "Il numero carta deve contenere solo cifre" });
    return;
  }

  if (numeroPulito.length !== 12) {
    res.status(400).json({ error: "Il numero carta deve contenere esattamente 12 cifre" });
    return;
  }

  if (!/^\d{2}\/\d{4}$/.test(scadenza)) {
    res.status(400).json({ error: "La scadenza deve essere nel formato MM/AAAA" });
    return;
  }

  const mese = Number(scadenza.slice(0, 2));
  const anno = Number(scadenza.slice(3, 7));

  if (mese < 1 || mese > 12 || anno < 2024 || anno > 2100) {
    res.status(400).json({ error: "Scadenza carta non valida" });
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
      res.status(500).json({ error: "Errore durante il salvataggio della carta" });
      return;
    }

    res.json({
      message: "Carta aggiunta correttamente",
      id_carta: result.insertId,
      ultime_quattro: ultimeQuattro
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
    res.status(400).json({ error: "Importo non valido" });
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
      res.status(500).json({ error: "Errore durante la verifica della carta" });
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
        res.status(500).json({ error: "Errore durante il controllo della promozione" });
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
          res.status(500).json({ error: "Errore nel controllo del portafoglio" });
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
            res.status(500).json({ error: "Errore durante la ricarica" });
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
                  error: "Saldo aggiornato, ma errore nel salvataggio della ricarica"
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
                    error: "Ricarica completata, ma errore nel recupero saldo"
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
      res.status(500).json({ error: "Errore nel recupero delle ricariche" });
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
        error: "Errore nel recupero delle segnalazioni"
      });
      return;
    }

    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});