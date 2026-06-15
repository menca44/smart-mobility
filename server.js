const express = require("express");
const mysql = require("mysql2");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Permette al server di leggere richieste in formato JSON.
app.use(express.json());

// Rende accessibili i file HTML, CSS, JavaScript e immagini
// presenti nella cartella public.
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// CONFIGURAZIONE DATABASE MYSQL
// =====================================================

console.log("Configurazione MySQL Railway:", {
  host:
    process.env.MYSQLHOST ||
    process.env.DB_HOST ||
    "localhost",

  user:
    process.env.MYSQLUSER ||
    process.env.DB_USER ||
    "root",

  database:
    process.env.MYSQLDATABASE ||
    process.env.DB_NAME ||
    "movelands",

  port:
    process.env.MYSQLPORT ||
    process.env.DB_PORT ||
    3306,

  hasPassword: Boolean(
    process.env.MYSQLPASSWORD ||
    process.env.DB_PASSWORD
  )
});

const db = mysql.createPool({
  host:
    process.env.MYSQLHOST ||
    process.env.DB_HOST ||
    "localhost",

  user:
    process.env.MYSQLUSER ||
    process.env.DB_USER ||
    "root",

  password:
    process.env.MYSQLPASSWORD ||
    process.env.DB_PASSWORD ||
    "",

  database:
    process.env.MYSQLDATABASE ||
    process.env.DB_NAME ||
    "movelands",

  port: Number(
    process.env.MYSQLPORT ||
    process.env.DB_PORT ||
    3306
  ),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verifica che il database sia raggiungibile.
db.getConnection((error, connection) => {
  if (error) {
    console.error(
      "Errore connessione MySQL:",
      error.message
    );

    return;
  }

  console.log(
    "Database MySQL collegato correttamente."
  );

  connection.release();
});

// =====================================================
// PAGINA INIZIALE
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// =====================================================
// MEZZI
// =====================================================

// Recupera tutti i mezzi.
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
    ORDER BY id_mezzo ASC
  `;

  db.query(sql, (error, rows) => {
    if (error) {
      console.error(
        "Errore recupero mezzi:",
        error.message
      );

      res.status(500).json({
        error:
          "Errore nel recupero dei mezzi",
        dettaglio: error.message
      });

      return;
    }

    res.json(rows);
  });
});

// Endpoint di controllo dei mezzi.
app.get("/api/mezzi-debug", (req, res) => {
  const sql = `
    SELECT *
    FROM mezzi
    ORDER BY id_mezzo ASC
  `;

  db.query(sql, (error, rows) => {
    if (error) {
      res.status(500).json({
        error:
          "Errore nel recupero dei mezzi",
        dettaglio: error.message
      });

      return;
    }

    res.json(rows);
  });
});

// =====================================================
// REGISTRAZIONE
// =====================================================

app.post("/api/registrazione", (req, res) => {
  const {
    nome,
    cognome,
    email,
    password
  } = req.body;

  if (
    !nome ||
    !cognome ||
    !email ||
    !password
  ) {
    res.status(400).json({
      error:
        "Tutti i campi sono obbligatori"
    });

    return;
  }

  const emailNormalizzata =
    String(email).trim().toLowerCase();

  const controlloEmailSql = `
    SELECT id_utente
    FROM utenti
    WHERE LOWER(TRIM(email)) = ?
  `;

  db.query(
    controlloEmailSql,
    [emailNormalizzata],
    (error, rows) => {
      if (error) {
        console.error(
          "Errore controllo email:",
          error.message
        );

        res.status(500).json({
          error:
            "Errore durante il controllo dell'email",
          dettaglio: error.message
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

      db.query(
        inserisciUtenteSql,
        [
          String(nome).trim(),
          String(cognome).trim(),
          emailNormalizzata,
          String(password)
        ],
        (insertError, result) => {
          if (insertError) {
            console.error(
              "Errore registrazione:",
              insertError.message
            );

            res.status(500).json({
              error:
                "Errore durante la registrazione",
              dettaglio:
                insertError.message
            });

            return;
          }

          res.status(201).json({
            message:
              "Account creato correttamente",

            id_utente:
              result.insertId,

            nome:
              String(nome).trim(),

            cognome:
              String(cognome).trim(),

            email:
              emailNormalizzata,

            ruolo: "utente"
          });
        }
      );
    }
  );
});

// =====================================================
// LOGIN
// =====================================================

app.post("/api/login", (req, res) => {
  const {
    email,
    password,
    ruolo
  } = req.body;

  if (!email || !password || !ruolo) {
    res.status(400).json({
      error:
        "Email, password e ruolo sono obbligatori"
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
    WHERE LOWER(TRIM(email)) = ?
      AND password = ?
      AND LOWER(TRIM(ruolo)) = ?
    LIMIT 1
  `;

  db.query(
    sql,
    [
      String(email).trim().toLowerCase(),
      String(password),
      String(ruolo).trim().toLowerCase()
    ],
    (error, rows) => {
      if (error) {
        console.error(
          "Errore login:",
          error.message
        );

        res.status(500).json({
          error:
            "Errore durante il login",
          dettaglio: error.message
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
        message:
          "Login effettuato correttamente",

        utente: rows[0]
      });
    }
  );
});

// Recupera tutti gli utenti.
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

  db.query(sql, (error, rows) => {
    if (error) {
      res.status(500).json({
        error:
          "Errore nel recupero degli utenti",
        dettaglio: error.message
      });

      return;
    }

    res.json(rows);
  });
});

// =====================================================
// CREAZIONE PRENOTAZIONE
// =====================================================

app.post("/api/prenotazioni", (req, res) => {
  const idUtente =
    Number(req.body.id_utente);

  const idMezzo =
    Number(req.body.id_mezzo);

  if (
    !Number.isInteger(idUtente) ||
    idUtente <= 0 ||
    !Number.isInteger(idMezzo) ||
    idMezzo <= 0
  ) {
    res.status(400).json({
      error:
        "id_utente e id_mezzo sono obbligatori"
    });

    return;
  }

  db.getConnection(
    (connectionError, connection) => {
      if (connectionError) {
        res.status(500).json({
          error:
            "Errore di connessione al database",
          dettaglio:
            connectionError.message
        });

        return;
      }

      connection.beginTransaction(
        (transactionError) => {
          if (transactionError) {
            connection.release();

            res.status(500).json({
              error:
                "Errore durante l'avvio della prenotazione",
              dettaglio:
                transactionError.message
            });

            return;
          }

          const cercaMezzoSql = `
            SELECT
              id_mezzo,
              stato
            FROM mezzi
            WHERE id_mezzo = ?
            FOR UPDATE
          `;

          connection.query(
            cercaMezzoSql,
            [idMezzo],
            (searchError, rows) => {
              if (searchError) {
                return connection.rollback(
                  () => {
                    connection.release();

                    res.status(500).json({
                      error:
                        "Errore nel controllo del mezzo",
                      dettaglio:
                        searchError.message
                    });
                  }
                );
              }

              if (rows.length === 0) {
                return connection.rollback(
                  () => {
                    connection.release();

                    res.status(404).json({
                      error:
                        "Mezzo non trovato"
                    });
                  }
                );
              }

              const mezzo = rows[0];

              if (
                String(mezzo.stato)
                  .trim()
                  .toLowerCase() !==
                "disponibile"
              ) {
                return connection.rollback(
                  () => {
                    connection.release();

                    res.status(409).json({
                      error:
                        "Mezzo non disponibile"
                    });
                  }
                );
              }

              const controlloPrenotazioneSql = `
                SELECT id_prenotazione
                FROM prenotazioni
                WHERE id_utente = ?
                  AND LOWER(
                    TRIM(stato_prenotazione)
                  ) = 'attiva'
                LIMIT 1
              `;

              connection.query(
                controlloPrenotazioneSql,
                [idUtente],
                (
                  activeError,
                  activeRows
                ) => {
                  if (activeError) {
                    return connection.rollback(
                      () => {
                        connection.release();

                        res.status(500).json({
                          error:
                            "Errore nel controllo delle prenotazioni attive",
                          dettaglio:
                            activeError.message
                        });
                      }
                    );
                  }

                  if (
                    activeRows.length > 0
                  ) {
                    return connection.rollback(
                      () => {
                        connection.release();

                        res.status(409).json({
                          error:
                            "Hai già una prenotazione attiva"
                        });
                      }
                    );
                  }

                  const inserisciSql = `
                    INSERT INTO prenotazioni (
                      id_utente,
                      id_mezzo,
                      stato_prenotazione,
                      stato_sblocco,
                      data_ora_scadenza
                    )
                    VALUES (
                      ?,
                      ?,
                      'attiva',
                      'bloccato',
                      DATE_ADD(
                        NOW(),
                        INTERVAL 15 MINUTE
                      )
                    )
                  `;

                  connection.query(
                    inserisciSql,
                    [
                      idUtente,
                      idMezzo
                    ],
                    (
                      insertError,
                      result
                    ) => {
                      if (insertError) {
                        return connection.rollback(
                          () => {
                            connection.release();

                            res
                              .status(500)
                              .json({
                                error:
                                  "Errore nella creazione della prenotazione",
                                dettaglio:
                                  insertError.message
                              });
                          }
                        );
                      }

                      const aggiornaMezzoSql = `
                        UPDATE mezzi
                        SET stato = 'prenotato'
                        WHERE id_mezzo = ?
                      `;

                      connection.query(
                        aggiornaMezzoSql,
                        [idMezzo],
                        (vehicleError) => {
                          if (
                            vehicleError
                          ) {
                            return connection.rollback(
                              () => {
                                connection.release();

                                res
                                  .status(500)
                                  .json({
                                    error:
                                      "Errore durante l'aggiornamento del mezzo",
                                    dettaglio:
                                      vehicleError.message
                                  });
                              }
                            );
                          }

                          connection.commit(
                            (commitError) => {
                              if (
                                commitError
                              ) {
                                return connection.rollback(
                                  () => {
                                    connection.release();

                                    res
                                      .status(500)
                                      .json({
                                        error:
                                          "Errore durante il completamento della prenotazione",
                                        dettaglio:
                                          commitError.message
                                      });
                                  }
                                );
                              }

                              connection.release();

                              res
                                .status(201)
                                .json({
                                  message:
                                    "Prenotazione creata correttamente",

                                  id_prenotazione:
                                    result.insertId,

                                  id_mezzo:
                                    idMezzo,

                                  stato_prenotazione:
                                    "attiva",

                                  stato_sblocco:
                                    "bloccato"
                                });
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

// =====================================================
// RECUPERO PRENOTAZIONI
// =====================================================

// Recupera tutte le prenotazioni.
app.get("/api/prenotazioni", (req, res) => {
  const sql = `
    SELECT
      p.id_prenotazione,
      p.id_utente,
      u.nome,
      u.cognome,
      p.id_mezzo,
      m.tipo,
      m.modello,
      m.area,
      m.batteria,
      m.tariffa_minuto,
      m.stato AS stato_mezzo,
      p.stato_prenotazione,
      p.stato_sblocco,
      p.data_ora_prenotazione,
      p.data_ora_scadenza,
      p.data_ora_sblocco,
      p.data_ora_fine,
      p.durata_minuti,
      p.costo_totale
    FROM prenotazioni p
    JOIN utenti u
      ON p.id_utente = u.id_utente
    JOIN mezzi m
      ON p.id_mezzo = m.id_mezzo
    ORDER BY p.id_prenotazione DESC
  `;

  db.query(sql, (error, rows) => {
    if (error) {
      res.status(500).json({
        error:
          "Errore nel recupero delle prenotazioni",
        dettaglio: error.message
      });

      return;
    }

    res.json(rows);
  });
});

// Recupera le prenotazioni attive di un utente.
app.get(
  "/api/prenotazioni/utente/:id_utente",
  (req, res) => {
    const idUtente =
      Number(req.params.id_utente);

    if (
      !Number.isInteger(idUtente) ||
      idUtente <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo utente non valido"
      });

      return;
    }

    const sql = `
      SELECT
        p.id_prenotazione,
        p.id_utente,
        p.id_mezzo,
        p.stato_prenotazione,
        p.stato_sblocco,
        p.data_ora_prenotazione,
        p.data_ora_scadenza,
        p.data_ora_sblocco,
        m.tipo,
        m.modello,
        m.stato AS stato_mezzo,
        m.batteria,
        m.area,
        m.tariffa_minuto
      FROM prenotazioni p
      JOIN mezzi m
        ON p.id_mezzo = m.id_mezzo
      WHERE p.id_utente = ?
        AND LOWER(
          TRIM(p.stato_prenotazione)
        ) = 'attiva'
      ORDER BY p.id_prenotazione DESC
    `;

    db.query(
      sql,
      [idUtente],
      (error, rows) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore nel recupero delle prenotazioni attive",
            dettaglio: error.message
          });

          return;
        }

        res.json(rows);
      }
    );
  }
);

// Recupera lo storico delle prenotazioni.
app.get(
  "/api/prenotazioni/utente/:id_utente/storico",
  (req, res) => {
    const idUtente =
      Number(req.params.id_utente);

    if (
      !Number.isInteger(idUtente) ||
      idUtente <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo utente non valido"
      });

      return;
    }

    const sql = `
      SELECT
        p.id_prenotazione,
        p.id_utente,
        p.id_mezzo,
        p.stato_prenotazione,
        p.stato_sblocco,
        p.data_ora_prenotazione,
        p.data_ora_scadenza,
        p.data_ora_sblocco,
        p.data_ora_fine,
        p.durata_minuti,
        p.costo_totale,
        m.tipo,
        m.modello,
        m.area,
        m.batteria,
        m.tariffa_minuto
      FROM prenotazioni p
      JOIN mezzi m
        ON p.id_mezzo = m.id_mezzo
      WHERE p.id_utente = ?
        AND LOWER(
          TRIM(p.stato_prenotazione)
        ) IN (
          'completata',
          'annullata'
        )
      ORDER BY p.id_prenotazione DESC
    `;

    db.query(
      sql,
      [idUtente],
      (error, rows) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore nel recupero dello storico",
            dettaglio: error.message
          });

          return;
        }

        res.json(rows);
      }
    );
  }
);

// =====================================================
// DATI PER LA PAGINA DI SBLOCCO
// =====================================================

app.get(
  "/api/prenotazioni/:id_prenotazione/sblocco",
  (req, res) => {
    const idPrenotazione =
      Number(
        req.params.id_prenotazione
      );

    const idUtente =
      Number(req.query.id_utente);

    if (
      !Number.isInteger(
        idPrenotazione
      ) ||
      idPrenotazione <= 0 ||
      !Number.isInteger(idUtente) ||
      idUtente <= 0
    ) {
      res.status(400).json({
        error:
          "Dati della prenotazione non validi"
      });

      return;
    }

    const sql = `
      SELECT
        p.id_prenotazione,
        p.id_utente,
        p.id_mezzo,
        p.stato_prenotazione,
        p.stato_sblocco,
        p.data_ora_prenotazione,
        p.data_ora_scadenza,
        p.data_ora_sblocco,
        m.tipo,
        m.modello,
        m.area,
        m.batteria,
        m.tariffa_minuto,
        m.stato AS stato_mezzo
      FROM prenotazioni p
      JOIN mezzi m
        ON p.id_mezzo = m.id_mezzo
      WHERE p.id_prenotazione = ?
        AND p.id_utente = ?
      LIMIT 1
    `;

    db.query(
      sql,
      [
        idPrenotazione,
        idUtente
      ],
      (error, rows) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore durante il recupero della prenotazione",
            dettaglio: error.message
          });

          return;
        }

        if (rows.length === 0) {
          res.status(404).json({
            error:
              "Prenotazione non trovata oppure non appartenente all'utente"
          });

          return;
        }

        res.json(rows[0]);
      }
    );
  }
);

// =====================================================
// SBLOCCO TRAMITE QR CODE
// =====================================================

app.post(
  "/api/prenotazioni/:id_prenotazione/sblocca",
  (req, res) => {
    const idPrenotazione =
      Number(
        req.params.id_prenotazione
      );

    const idUtente =
      Number(req.body.id_utente);

    const codiceQr =
      String(
        req.body.codice_qr || ""
      ).trim();

    if (
      !Number.isInteger(
        idPrenotazione
      ) ||
      idPrenotazione <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo prenotazione non valido"
      });

      return;
    }

    if (
      !Number.isInteger(idUtente) ||
      idUtente <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo utente non valido"
      });

      return;
    }

    if (!codiceQr) {
      res.status(400).json({
        error:
          "Il codice QR è obbligatorio"
      });

      return;
    }

    db.getConnection(
      (connectionError, connection) => {
        if (connectionError) {
          res.status(500).json({
            error:
              "Errore di connessione al database",
            dettaglio:
              connectionError.message
          });

          return;
        }

        connection.beginTransaction(
          (transactionError) => {
            if (transactionError) {
              connection.release();

              res.status(500).json({
                error:
                  "Errore durante l'avvio dello sblocco",
                dettaglio:
                  transactionError.message
              });

              return;
            }

            const cercaSql = `
  SELECT
    p.id_prenotazione,
    p.id_utente,
    p.id_mezzo,
    p.stato_prenotazione,
    p.stato_sblocco,
    p.data_ora_scadenza,
    m.codice_qr,
    m.tipo,
    m.modello,
    COALESCE(port.saldo, 0) AS saldo_portafoglio
  FROM prenotazioni p
  JOIN mezzi m
    ON p.id_mezzo = m.id_mezzo
  LEFT JOIN portafogli port
    ON p.id_utente = port.id_utente
  WHERE p.id_prenotazione = ?
    AND p.id_utente = ?
  FOR UPDATE
`;

            connection.query(
              cercaSql,
              [
                idPrenotazione,
                idUtente
              ],
              (searchError, rows) => {
                if (searchError) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(500).json({
                        error:
                          "Errore durante la verifica della prenotazione",
                        dettaglio:
                          searchError.message
                      });
                    }
                  );
                }

                if (
                  rows.length === 0
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(404).json({
                        error:
                          "Prenotazione non trovata oppure non appartenente all'utente"
                      });
                    }
                  );
                }

                const prenotazione =
                  rows[0];

                const statoPrenotazione =
                  String(
                    prenotazione
                      .stato_prenotazione ||
                    ""
                  )
                    .trim()
                    .toLowerCase();

                const statoSblocco =
                  String(
                    prenotazione
                      .stato_sblocco ||
                    "bloccato"
                  )
                    .trim()
                    .toLowerCase();

                if (
                  statoPrenotazione !==
                  "attiva"
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(409).json({
                        error:
                          "La prenotazione non è più attiva"
                      });
                    }
                  );
                }

                if (
                  statoSblocco ===
                  "sbloccato"
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(409).json({
                        error:
                          "Il mezzo è già stato sbloccato"
                      });
                    }
                  );
                }
                // Controlla che l'utente abbia del denaro nel portafoglio.
const saldoPortafoglio = Number(
  prenotazione.saldo_portafoglio || 0
);

if (
  Number.isNaN(saldoPortafoglio) ||
  saldoPortafoglio <= 0
) {
  return connection.rollback(() => {
    connection.release();

    res.status(409).json({
      error:
        "Saldo insufficiente. Devi ricaricare il portafoglio prima di sbloccare il mezzo.",
      saldo: saldoPortafoglio
    });
  });
}

                const dataScadenza =
                  new Date(
                    prenotazione
                      .data_ora_scadenza
                  );

                if (
                  !Number.isNaN(
                    dataScadenza.getTime()
                  ) &&
                  dataScadenza <
                    new Date()
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(409).json({
                        error:
                          "La prenotazione è scaduta"
                      });
                    }
                  );
                }

                const codiceRegistrato =
                  String(
                    prenotazione
                      .codice_qr ||
                    ""
                  ).trim();

                if (!codiceRegistrato) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(409).json({
                        error:
                          "Il mezzo non possiede un codice QR configurato"
                      });
                    }
                  );
                }

                if (
                  codiceRegistrato !==
                  codiceQr
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(403).json({
                        error:
                          "Il codice QR non appartiene al mezzo prenotato"
                      });
                    }
                  );
                }

                const aggiornaSql = `
                  UPDATE prenotazioni
                  SET
                    stato_sblocco = 'sbloccato',
                    data_ora_sblocco = NOW()
                  WHERE id_prenotazione = ?
                    AND id_utente = ?
                    AND LOWER(
                      TRIM(
                        stato_prenotazione
                      )
                    ) = 'attiva'
                    AND LOWER(
                      TRIM(
                        stato_sblocco
                      )
                    ) <> 'sbloccato'
                `;

                connection.query(
                  aggiornaSql,
                  [
                    idPrenotazione,
                    idUtente
                  ],
                  (
                    updateError,
                    updateResult
                  ) => {
                    if (updateError) {
                      return connection.rollback(
                        () => {
                          connection.release();

                          res
                            .status(500)
                            .json({
                              error:
                                "Errore durante lo sblocco del mezzo",
                              dettaglio:
                                updateError.message
                            });
                        }
                      );
                    }

                    if (
                      updateResult
                        .affectedRows === 0
                    ) {
                      return connection.rollback(
                        () => {
                          connection.release();

                          res
                            .status(409)
                            .json({
                              error:
                                "Non è stato possibile sbloccare il mezzo"
                            });
                        }
                      );
                    }

                    connection.commit(
                      (commitError) => {
                        if (
                          commitError
                        ) {
                          return connection.rollback(
                            () => {
                              connection.release();

                              res
                                .status(500)
                                .json({
                                  error:
                                    "Errore durante il completamento dello sblocco",
                                  dettaglio:
                                    commitError.message
                                });
                            }
                          );
                        }

                        connection.release();

                        res.json({
                          message:
                            "Mezzo sbloccato correttamente",

                          id_prenotazione:
                            idPrenotazione,

                          id_mezzo:
                            prenotazione
                              .id_mezzo,

                          tipo:
                            prenotazione.tipo,

                          modello:
                            prenotazione
                              .modello,

                          stato_sblocco:
                            "sbloccato"
                        });
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

// =====================================================
// CANCELLAZIONE DELLA PRENOTAZIONE
// =====================================================

app.put(
  "/api/prenotazioni/:id_prenotazione/annulla",
  (req, res) => {
    const idPrenotazione =
      Number(
        req.params.id_prenotazione
      );

    const idUtente =
      Number(req.body.id_utente);

    if (
      !Number.isInteger(
        idPrenotazione
      ) ||
      idPrenotazione <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo prenotazione non valido"
      });

      return;
    }

    if (
      !Number.isInteger(idUtente) ||
      idUtente <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo utente non valido"
      });

      return;
    }

    db.getConnection(
      (connectionError, connection) => {
        if (connectionError) {
          res.status(500).json({
            error:
              "Errore di connessione al database",
            dettaglio:
              connectionError.message
          });

          return;
        }

        connection.beginTransaction(
          (transactionError) => {
            if (transactionError) {
              connection.release();

              res.status(500).json({
                error:
                  "Errore durante l'avvio della cancellazione",
                dettaglio:
                  transactionError.message
              });

              return;
            }

            const cercaSql = `
              SELECT
                id_prenotazione,
                id_utente,
                id_mezzo,
                stato_prenotazione,
                stato_sblocco
              FROM prenotazioni
              WHERE id_prenotazione = ?
                AND id_utente = ?
              FOR UPDATE
            `;

            connection.query(
              cercaSql,
              [
                idPrenotazione,
                idUtente
              ],
              (searchError, rows) => {
                if (searchError) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(500).json({
                        error:
                          "Errore durante la ricerca della prenotazione",
                        dettaglio:
                          searchError.message
                      });
                    }
                  );
                }

                if (
                  rows.length === 0
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(404).json({
                        error:
                          "Prenotazione non trovata oppure non appartenente all'utente"
                      });
                    }
                  );
                }

                const prenotazione =
                  rows[0];

                const statoPrenotazione =
                  String(
                    prenotazione
                      .stato_prenotazione ||
                    ""
                  )
                    .trim()
                    .toLowerCase();

                const statoSblocco =
                  String(
                    prenotazione
                      .stato_sblocco ||
                    "bloccato"
                  )
                    .trim()
                    .toLowerCase();

                if (
                  statoPrenotazione !==
                  "attiva"
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(409).json({
                        error:
                          "La prenotazione non è più attiva"
                      });
                    }
                  );
                }

                if (
                  statoSblocco ===
                  "sbloccato"
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(409).json({
                        error:
                          "Il mezzo è già stato sbloccato. Devi terminare la corsa"
                      });
                    }
                  );
                }

                const annullaSql = `
                  UPDATE prenotazioni
                  SET
                    stato_prenotazione = 'annullata',
                    data_ora_fine = NOW(),
                    durata_minuti = 0,
                    costo_totale = 0.00
                  WHERE id_prenotazione = ?
                    AND id_utente = ?
                    AND LOWER(
                      TRIM(
                        stato_prenotazione
                      )
                    ) = 'attiva'
                `;

                connection.query(
                  annullaSql,
                  [
                    idPrenotazione,
                    idUtente
                  ],
                  (
                    updateError,
                    updateResult
                  ) => {
                    if (updateError) {
                      return connection.rollback(
                        () => {
                          connection.release();

                          res
                            .status(500)
                            .json({
                              error:
                                "Errore durante la cancellazione della prenotazione",
                              dettaglio:
                                updateError.message
                            });
                        }
                      );
                    }

                    if (
                      updateResult
                        .affectedRows === 0
                    ) {
                      return connection.rollback(
                        () => {
                          connection.release();

                          res
                            .status(409)
                            .json({
                              error:
                                "La prenotazione non può più essere cancellata"
                            });
                        }
                      );
                    }

                    const liberaMezzoSql = `
                      UPDATE mezzi
                      SET stato = 'disponibile'
                      WHERE id_mezzo = ?
                    `;

                    connection.query(
                      liberaMezzoSql,
                      [
                        prenotazione
                          .id_mezzo
                      ],
                      (vehicleError) => {
                        if (
                          vehicleError
                        ) {
                          return connection.rollback(
                            () => {
                              connection.release();

                              res
                                .status(500)
                                .json({
                                  error:
                                    "Errore durante il ripristino del mezzo",
                                  dettaglio:
                                    vehicleError.message
                                });
                            }
                          );
                        }

                        connection.commit(
                          (commitError) => {
                            if (
                              commitError
                            ) {
                              return connection.rollback(
                                () => {
                                  connection.release();

                                  res
                                    .status(500)
                                    .json({
                                      error:
                                        "Errore durante il completamento della cancellazione",
                                      dettaglio:
                                        commitError.message
                                    });
                                }
                              );
                            }

                            connection.release();

                            res.json({
                              message:
                                "Prenotazione cancellata correttamente",

                              id_prenotazione:
                                idPrenotazione,

                              id_mezzo:
                                prenotazione
                                  .id_mezzo,

                              stato_prenotazione:
                                "annullata"
                            });
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

// =====================================================
// TERMINE DELLA CORSA
// =====================================================

app.put(
  "/api/prenotazioni/:id_prenotazione/termina",
  (req, res) => {
    const idPrenotazione =
      Number(
        req.params.id_prenotazione
      );

    if (
      !Number.isInteger(
        idPrenotazione
      ) ||
      idPrenotazione <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo prenotazione non valido"
      });

      return;
    }

    db.getConnection(
      (connectionError, connection) => {
        if (connectionError) {
          res.status(500).json({
            error:
              "Errore di connessione al database",
            dettaglio:
              connectionError.message
          });

          return;
        }

        connection.beginTransaction(
          (transactionError) => {
            if (transactionError) {
              connection.release();

              res.status(500).json({
                error:
                  "Errore durante l'avvio della conclusione della corsa",
                dettaglio:
                  transactionError.message
              });

              return;
            }

            const cercaSql = `
  SELECT
    p.id_prenotazione,
    p.id_utente,
    p.id_mezzo,
    p.stato_prenotazione,
    p.stato_sblocco,
    p.data_ora_prenotazione,
    p.data_ora_sblocco,
    m.tariffa_minuto
  FROM prenotazioni p
  JOIN mezzi m
    ON p.id_mezzo = m.id_mezzo
  WHERE p.id_prenotazione = ?
  FOR UPDATE
`;

            connection.query(
              cercaSql,
              [idPrenotazione],
              (searchError, rows) => {
                if (searchError) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(500).json({
                        error:
                          "Errore durante la ricerca della prenotazione",
                        dettaglio:
                          searchError.message
                      });
                    }
                  );
                }

                if (
                  rows.length === 0
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(404).json({
                        error:
                          "Prenotazione non trovata"
                      });
                    }
                  );
                }

                const prenotazione =
                  rows[0];

                const statoPrenotazione =
                  String(
                    prenotazione
                      .stato_prenotazione ||
                    ""
                  )
                    .trim()
                    .toLowerCase();

                const statoSblocco =
                  String(
                    prenotazione
                      .stato_sblocco ||
                    ""
                  )
                    .trim()
                    .toLowerCase();

                if (
                  statoPrenotazione !==
                  "attiva"
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(409).json({
                        error:
                          "La prenotazione non è attiva"
                      });
                    }
                  );
                }

                if (
                  statoSblocco !==
                  "sbloccato"
                ) {
                  return connection.rollback(
                    () => {
                      connection.release();

                      res.status(409).json({
                        error:
                          "Devi sbloccare il mezzo prima di terminare la corsa"
                      });
                    }
                  );
                }

                const dataInizio =
                  prenotazione
                    .data_ora_sblocco ||
                  prenotazione
                    .data_ora_prenotazione;

                const durataSql = `
                  SELECT
                    GREATEST(
                      TIMESTAMPDIFF(
                        MINUTE,
                        ?,
                        NOW()
                      ),
                      1
                    ) AS durata_minuti
                `;

                connection.query(
                  durataSql,
                  [dataInizio],
                  (
                    durationError,
                    durationRows
                  ) => {
                    if (
                      durationError
                    ) {
                      return connection.rollback(
                        () => {
                          connection.release();

                          res
                            .status(500)
                            .json({
                              error:
                                "Errore durante il calcolo della durata",
                              dettaglio:
                                durationError.message
                            });
                        }
                      );
                    }

                    const durataMinuti =
                      Number(
                        durationRows[0]
                          .durata_minuti
                      );

                    const tariffaMinuto =
                      Number(
                        prenotazione
                          .tariffa_minuto
                      );

                    const costoTotale =
                      Number(
                        (
                          durataMinuti *
                          tariffaMinuto
                        ).toFixed(2)
                      );


                                        // Sottrae il costo della corsa dal portafoglio.
                    const aggiornaPortafoglioSql = `
                      UPDATE portafogli
                      SET saldo = saldo - ?
                      WHERE id_utente = ?
                    `;

                    connection.query(
                      aggiornaPortafoglioSql,
                      [
                        costoTotale,
                        prenotazione.id_utente
                      ],
                      (
                        walletError,
                        walletResult
                      ) => {
                        if (walletError) {
                          return connection.rollback(
                            () => {
                              connection.release();

                              res.status(500).json({
                                error:
                                  "Errore durante l'addebito della corsa",
                                dettaglio:
                                  walletError.message
                              });
                            }
                          );
                        }

                        // Se non è stato aggiornato nessun portafoglio,
                        // significa che l'utente non ne possiede uno.
                        if (
                          walletResult.affectedRows === 0
                        ) {
                          return connection.rollback(
                            () => {
                              connection.release();

                              res.status(404).json({
                                error:
                                  "Portafoglio dell'utente non trovato"
                              });
                            }
                          );
                        }

                        // Registra la prenotazione come completata.
                        const completaSql = `
                          UPDATE prenotazioni
                          SET
                            stato_prenotazione = 'completata',
                            data_ora_fine = NOW(),
                            durata_minuti = ?,
                            costo_totale = ?
                          WHERE id_prenotazione = ?
                        `;

                        connection.query(
                          completaSql,
                          [
                            durataMinuti,
                            costoTotale,
                            idPrenotazione
                          ],
                          (
                            updateError,
                            updateResult
                          ) => {
                            if (updateError) {
                              return connection.rollback(
                                () => {
                                  connection.release();

                                  res.status(500).json({
                                    error:
                                      "Errore durante la conclusione della corsa",
                                    dettaglio:
                                      updateError.message
                                  });
                                }
                              );
                            }

                            if (
                              updateResult.affectedRows === 0
                            ) {
                              return connection.rollback(
                                () => {
                                  connection.release();

                                  res.status(409).json({
                                    error:
                                      "Non è stato possibile completare la prenotazione"
                                  });
                                }
                              );
                            }

                            // Rende nuovamente disponibile il mezzo.
                            const liberaMezzoSql = `
                              UPDATE mezzi
                              SET stato = 'disponibile'
                              WHERE id_mezzo = ?
                            `;

                            connection.query(
                              liberaMezzoSql,
                              [
                                prenotazione.id_mezzo
                              ],
                              (
                                vehicleError,
                                vehicleResult
                              ) => {
                                if (vehicleError) {
                                  return connection.rollback(
                                    () => {
                                      connection.release();

                                      res.status(500).json({
                                        error:
                                          "Errore durante il ripristino del mezzo",
                                        dettaglio:
                                          vehicleError.message
                                      });
                                    }
                                  );
                                }

                                if (
                                  vehicleResult.affectedRows === 0
                                ) {
                                  return connection.rollback(
                                    () => {
                                      connection.release();

                                      res.status(404).json({
                                        error:
                                          "Mezzo non trovato"
                                      });
                                    }
                                  );
                                }

                                // Recupera il saldo aggiornato.
                                const recuperaSaldoSql = `
                                  SELECT saldo
                                  FROM portafogli
                                  WHERE id_utente = ?
                                  LIMIT 1
                                `;

                                connection.query(
                                  recuperaSaldoSql,
                                  [
                                    prenotazione.id_utente
                                  ],
                                  (
                                    saldoError,
                                    saldoRows
                                  ) => {
                                    if (saldoError) {
                                      return connection.rollback(
                                        () => {
                                          connection.release();

                                          res.status(500).json({
                                            error:
                                              "Errore durante il recupero del nuovo saldo",
                                            dettaglio:
                                              saldoError.message
                                          });
                                        }
                                      );
                                    }

                                    if (
                                      saldoRows.length === 0
                                    ) {
                                      return connection.rollback(
                                        () => {
                                          connection.release();

                                          res.status(404).json({
                                            error:
                                              "Portafoglio dell'utente non trovato"
                                          });
                                        }
                                      );
                                    }

                                    const saldoAggiornato =
                                      Number(
                                        saldoRows[0].saldo
                                      );

                                    // Conferma tutte le modifiche:
                                    // addebito, corsa completata e mezzo disponibile.
                                    connection.commit(
                                      (
                                        commitError
                                      ) => {
                                        if (
                                          commitError
                                        ) {
                                          return connection.rollback(
                                            () => {
                                              connection.release();

                                              res.status(500).json({
                                                error:
                                                  "Errore durante il completamento della corsa",
                                                dettaglio:
                                                  commitError.message
                                              });
                                            }
                                          );
                                        }

                                        connection.release();

                                        res.json({
                                          message:
                                            "Corsa terminata correttamente",

                                          id_prenotazione:
                                            idPrenotazione,

                                          id_mezzo:
                                            prenotazione.id_mezzo,

                                          durata_minuti:
                                            durataMinuti,

                                          tariffa_minuto:
                                            tariffaMinuto,

                                          costo_totale:
                                            costoTotale,

                                          saldo_aggiornato:
                                            saldoAggiornato
                                        });
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

// =====================================================
// PORTAFOGLIO
// =====================================================

app.get(
  "/api/portafoglio/:id_utente",
  (req, res) => {
    const idUtente =
      Number(req.params.id_utente);

    if (
      !Number.isInteger(idUtente) ||
      idUtente <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo utente non valido"
      });

      return;
    }

    const cercaSql = `
      SELECT
        id_portafoglio,
        id_utente,
        saldo
      FROM portafogli
      WHERE id_utente = ?
      LIMIT 1
    `;

    db.query(
      cercaSql,
      [idUtente],
      (error, rows) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore nel recupero del portafoglio",
            dettaglio: error.message
          });

          return;
        }

        if (rows.length > 0) {
          res.json(rows[0]);
          return;
        }

        const creaSql = `
          INSERT INTO portafogli (
            id_utente,
            saldo
          )
          VALUES (?, 0.00)
        `;

        db.query(
          creaSql,
          [idUtente],
          (insertError, result) => {
            if (insertError) {
              res.status(500).json({
                error:
                  "Errore nella creazione del portafoglio",
                dettaglio:
                  insertError.message
              });

              return;
            }

            res.status(201).json({
              id_portafoglio:
                result.insertId,

              id_utente:
                idUtente,

              saldo: "0.00"
            });
          }
        );
      }
    );
  }
);

// =====================================================
// CARTE DI PAGAMENTO
// =====================================================

app.get(
  "/api/carte/:id_utente",
  (req, res) => {
    const idUtente =
      Number(req.params.id_utente);

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

    db.query(
      sql,
      [idUtente],
      (error, rows) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore nel recupero delle carte",
            dettaglio: error.message
          });

          return;
        }

        res.json(rows);
      }
    );
  }
);

app.post("/api/carte", (req, res) => {
  const {
    id_utente,
    intestatario,
    numero_carta,
    circuito,
    scadenza
  } = req.body;

  const idUtente =
    Number(id_utente);

  if (
    !Number.isInteger(idUtente) ||
    idUtente <= 0 ||
    !intestatario ||
    !numero_carta ||
    !circuito ||
    !scadenza
  ) {
    res.status(400).json({
      error:
        "Tutti i campi della carta sono obbligatori"
    });

    return;
  }

  const numeroPulito =
    String(numero_carta).replace(
      /\s+/g,
      ""
    );

  if (
    !/^[0-9]{12}$/.test(
      numeroPulito
    )
  ) {
    res.status(400).json({
      error:
        "Il numero carta deve contenere esattamente 12 cifre"
    });

    return;
  }

  if (
    !/^\d{2}\/\d{4}$/.test(
      scadenza
    )
  ) {
    res.status(400).json({
      error:
        "La scadenza deve essere nel formato MM/AAAA"
    });

    return;
  }

  const mese =
    Number(scadenza.slice(0, 2));

  const anno =
    Number(scadenza.slice(3, 7));

  if (
    mese < 1 ||
    mese > 12 ||
    anno < 2024 ||
    anno > 2100
  ) {
    res.status(400).json({
      error:
        "Scadenza carta non valida"
    });

    return;
  }

  const ultimeQuattro =
    numeroPulito.slice(-4);

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

  db.query(
    sql,
    [
      idUtente,
      String(intestatario).trim(),
      String(circuito).trim(),
      ultimeQuattro,
      String(scadenza).trim()
    ],
    (error, result) => {
      if (error) {
        res.status(500).json({
          error:
            "Errore durante il salvataggio della carta",
          dettaglio: error.message
        });

        return;
      }

      res.status(201).json({
        message:
          "Carta aggiunta correttamente",

        id_carta:
          result.insertId,

        ultime_quattro:
          ultimeQuattro
      });
    }
  );
});

// Elimina una carta.
app.delete(
  "/api/carte/:id_carta",
  (req, res) => {
    const idCarta =
      Number(req.params.id_carta);

    const idUtente =
      Number(req.body.id_utente);

    if (
      !Number.isInteger(idCarta) ||
      idCarta <= 0 ||
      !Number.isInteger(idUtente) ||
      idUtente <= 0
    ) {
      res.status(400).json({
        error:
          "Dati della carta non validi"
      });

      return;
    }

    const sql = `
      DELETE FROM carte_pagamento
      WHERE id_carta = ?
        AND id_utente = ?
    `;

    db.query(
      sql,
      [
        idCarta,
        idUtente
      ],
      (error, result) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore durante l'eliminazione della carta",
            dettaglio: error.message
          });

          return;
        }

        if (
          result.affectedRows === 0
        ) {
          res.status(404).json({
            error:
              "Carta non trovata oppure non appartenente all'utente"
          });

          return;
        }

        res.json({
          message:
            "Carta eliminata correttamente",

          id_carta:
            idCarta
        });
      }
    );
  }
);

// =====================================================
// RICARICA PORTAFOGLIO
// =====================================================

app.post(
  "/api/portafoglio/ricarica",
  (req, res) => {
    const idUtente =
      Number(req.body.id_utente);

    const idCarta =
      Number(req.body.id_carta);

    const importo =
      Number(req.body.importo);

    if (
      !Number.isInteger(idUtente) ||
      idUtente <= 0 ||
      !Number.isInteger(idCarta) ||
      idCarta <= 0 ||
      Number.isNaN(importo) ||
      importo <= 0
    ) {
      res.status(400).json({
        error:
          "Carta e importo non validi"
      });

      return;
    }

    const verificaCartaSql = `
      SELECT
        id_carta,
        circuito,
        ultime_quattro
      FROM carte_pagamento
      WHERE id_carta = ?
        AND id_utente = ?
      LIMIT 1
    `;

    db.query(
      verificaCartaSql,
      [
        idCarta,
        idUtente
      ],
      (cardError, cards) => {
        if (cardError) {
          res.status(500).json({
            error:
              "Errore durante la verifica della carta",
            dettaglio:
              cardError.message
          });

          return;
        }

        if (cards.length === 0) {
          res.status(403).json({
            error:
              "Carta non trovata"
          });

          return;
        }

        const carta = cards[0];

        const contaSql = `
          SELECT
            COUNT(*) AS numero_ricariche
          FROM ricariche_portafoglio
          WHERE id_utente = ?
        `;

        db.query(
          contaSql,
          [idUtente],
          (countError, countRows) => {
            if (countError) {
              res.status(500).json({
                error:
                  "Errore durante il controllo delle ricariche",
                dettaglio:
                  countError.message
              });

              return;
            }

            const primaRicarica =
              Number(
                countRows[0]
                  .numero_ricariche
              ) === 0;

            const bonus =
              primaRicarica &&
              importo >= 20
                ? 5
                : 0;

            const totale =
              importo + bonus;

            db.getConnection(
              (
                connectionError,
                connection
              ) => {
                if (
                  connectionError
                ) {
                  res.status(500).json({
                    error:
                      "Errore di connessione al database",
                    dettaglio:
                      connectionError.message
                  });

                  return;
                }

                connection.beginTransaction(
                  (
                    transactionError
                  ) => {
                    if (
                      transactionError
                    ) {
                      connection.release();

                      res.status(500).json({
                        error:
                          "Errore durante l'avvio della ricarica",
                        dettaglio:
                          transactionError.message
                      });

                      return;
                    }

                    const creaPortafoglioSql = `
                      INSERT INTO portafogli (
                        id_utente,
                        saldo
                      )
                      VALUES (?, 0.00)
                      ON DUPLICATE KEY UPDATE
                        id_utente = VALUES(
                          id_utente
                        )
                    `;

                    connection.query(
                      creaPortafoglioSql,
                      [idUtente],
                      (
                        walletError
                      ) => {
                        if (
                          walletError
                        ) {
                          return connection.rollback(
                            () => {
                              connection.release();

                              res
                                .status(500)
                                .json({
                                  error:
                                    "Errore durante il controllo del portafoglio",
                                  dettaglio:
                                    walletError.message
                                });
                            }
                          );
                        }

                        const aggiornaSaldoSql = `
                          UPDATE portafogli
                          SET saldo = saldo + ?
                          WHERE id_utente = ?
                        `;

                        connection.query(
                          aggiornaSaldoSql,
                          [
                            totale,
                            idUtente
                          ],
                          (
                            balanceError
                          ) => {
                            if (
                              balanceError
                            ) {
                              return connection.rollback(
                                () => {
                                  connection.release();

                                  res
                                    .status(500)
                                    .json({
                                      error:
                                        "Errore durante l'aggiornamento del saldo",
                                      dettaglio:
                                        balanceError.message
                                    });
                                }
                              );
                            }

                            const metodo =
                              `${carta.circuito} •••• ${carta.ultime_quattro}`;

                            const registraSql = `
                              INSERT INTO ricariche_portafoglio (
                                id_utente,
                                importo,
                                bonus_applicato,
                                totale_accreditato,
                                metodo
                              )
                              VALUES (?, ?, ?, ?, ?)
                            `;

                            connection.query(
                              registraSql,
                              [
                                idUtente,
                                importo,
                                bonus,
                                totale,
                                metodo
                              ],
                              (
                                rechargeError
                              ) => {
                                if (
                                  rechargeError
                                ) {
                                  return connection.rollback(
                                    () => {
                                      connection.release();

                                      res
                                        .status(500)
                                        .json({
                                          error:
                                            "Errore durante la registrazione della ricarica",
                                          dettaglio:
                                            rechargeError.message
                                        });
                                    }
                                  );
                                }

                                const saldoSql = `
                                  SELECT saldo
                                  FROM portafogli
                                  WHERE id_utente = ?
                                `;

                                connection.query(
                                  saldoSql,
                                  [
                                    idUtente
                                  ],
                                  (
                                    balanceReadError,
                                    balanceRows
                                  ) => {
                                    if (
                                      balanceReadError
                                    ) {
                                      return connection.rollback(
                                        () => {
                                          connection.release();

                                          res
                                            .status(500)
                                            .json({
                                              error:
                                                "Errore durante il recupero del saldo",
                                              dettaglio:
                                                balanceReadError.message
                                            });
                                        }
                                      );
                                    }

                                    connection.commit(
                                      (
                                        commitError
                                      ) => {
                                        if (
                                          commitError
                                        ) {
                                          return connection.rollback(
                                            () => {
                                              connection.release();

                                              res
                                                .status(500)
                                                .json({
                                                  error:
                                                    "Errore durante il completamento della ricarica",
                                                  dettaglio:
                                                    commitError.message
                                                });
                                            }
                                          );
                                        }

                                        connection.release();

                                        res.json({
                                          message:
                                            "Ricarica effettuata correttamente",

                                          saldo:
                                            balanceRows[0]
                                              .saldo,

                                          carta_usata:
                                            metodo,

                                          prima_ricarica:
                                            primaRicarica,

                                          bonus_applicato:
                                            bonus,

                                          totale_accreditato:
                                            totale
                                        });
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  }
);

// Storico ricariche.
app.get(
  "/api/portafoglio/:id_utente/ricariche",
  (req, res) => {
    const idUtente =
      Number(req.params.id_utente);

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

    db.query(
      sql,
      [idUtente],
      (error, rows) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore nel recupero delle ricariche",
            dettaglio: error.message
          });

          return;
        }

        res.json(rows);
      }
    );
  }
);

// =====================================================
// SEGNALAZIONI
// =====================================================

app.get("/api/segnalazioni", (req, res) => {
  const sql = `
    SELECT
      s.id_segnalazione,
      u.nome,
      u.cognome,
      s.id_mezzo,
      s.tipo_segnalazione,
      s.descrizione,
      s.stato,
      s.data_segnalazione
    FROM segnalazioni s
    JOIN utenti u
      ON s.id_utente = u.id_utente
    ORDER BY s.id_segnalazione DESC
  `;

  db.query(sql, (error, rows) => {
    if (error) {
      res.status(500).json({
        error:
          "Errore nel recupero delle segnalazioni",
        dettaglio: error.message
      });

      return;
    }

    res.json(rows);
  });
});

// Crea una segnalazione di supporto.
app.post(
  "/api/supporto/segnalazioni",
  (req, res) => {
    const {
      id_utente,
      nome_utente,
      categoria,
      tipo_problema,
      descrizione,
      posizione
    } = req.body;

    if (
      !categoria ||
      !tipo_problema ||
      !descrizione
    ) {
      res.status(400).json({
        error:
          "Categoria, tipo di problema e descrizione sono obbligatori"
      });

      return;
    }

    const sql = `
      INSERT INTO supporto_segnalazioni (
        id_utente,
        nome_utente,
        categoria,
        tipo_problema,
        descrizione,
        posizione
      )
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
      (error, result) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore durante l'invio della segnalazione",
            dettaglio: error.message
          });

          return;
        }

        res.status(201).json({
          message:
            "Segnalazione inviata correttamente",

          id_segnalazione:
            result.insertId
        });
      }
    );
  }
);

// Recupera le segnalazioni di supporto.
app.get(
  "/api/supporto/segnalazioni",
  (req, res) => {
    const sql = `
      SELECT *
      FROM supporto_segnalazioni
      ORDER BY data_creazione DESC
    `;

    db.query(sql, (error, rows) => {
      if (error) {
        res.status(500).json({
          error:
            "Errore durante il recupero delle segnalazioni",
          dettaglio: error.message
        });

        return;
      }

      res.json(rows);
    });
  }
);

// Modifica lo stato di una segnalazione.
app.put(
  "/api/supporto/segnalazioni/:id_segnalazione/stato",
  (req, res) => {
    const idSegnalazione =
      Number(
        req.params.id_segnalazione
      );

    const stato =
      String(req.body.stato || "")
        .trim()
        .toLowerCase();

    const statiConsentiti = [
      "nuova",
      "in_lavorazione",
      "risolta"
    ];

    if (
      !Number.isInteger(
        idSegnalazione
      ) ||
      idSegnalazione <= 0
    ) {
      res.status(400).json({
        error:
          "Identificativo segnalazione non valido"
      });

      return;
    }

    if (
      !statiConsentiti.includes(
        stato
      )
    ) {
      res.status(400).json({
        error: "Stato non valido"
      });

      return;
    }

    const sql = `
      UPDATE supporto_segnalazioni
      SET stato = ?
      WHERE id_segnalazione = ?
    `;

    db.query(
      sql,
      [
        stato,
        idSegnalazione
      ],
      (error, result) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore durante l'aggiornamento della segnalazione",
            dettaglio: error.message
          });

          return;
        }

        if (
          result.affectedRows === 0
        ) {
          res.status(404).json({
            error:
              "Segnalazione non trovata"
          });

          return;
        }

        res.json({
          message:
            "Stato segnalazione aggiornato correttamente"
        });
      }
    );
  }
);

// =====================================================
// CHAT DI SUPPORTO
// =====================================================

// Crea una conversazione.
app.post(
  "/api/supporto/chat/conversazioni",
  (req, res) => {
    const {
      id_utente,
      nome_utente
    } = req.body;

    const sql = `
      INSERT INTO supporto_chat_conversazioni (
        id_utente,
        nome_utente
      )
      VALUES (?, ?)
    `;

    db.query(
      sql,
      [
        id_utente || null,
        nome_utente || "Utente"
      ],
      (error, result) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore durante l'apertura della chat",
            dettaglio: error.message
          });

          return;
        }

        res.status(201).json({
          message:
            "Conversazione aperta correttamente",

          id_conversazione:
            result.insertId
        });
      }
    );
  }
);

// Recupera tutte le conversazioni.
app.get(
  "/api/supporto/chat/conversazioni",
  (req, res) => {
    const sql = `
      SELECT
        c.id_conversazione,
        c.id_utente,
        c.nome_utente,
        c.stato,
        c.data_creazione,
        (
          SELECT m.testo
          FROM supporto_chat_messaggi m
          WHERE m.id_conversazione =
            c.id_conversazione
          ORDER BY m.data_invio DESC
          LIMIT 1
        ) AS ultimo_messaggio
      FROM supporto_chat_conversazioni c
      ORDER BY c.data_creazione DESC
    `;

    db.query(sql, (error, rows) => {
      if (error) {
        res.status(500).json({
          error:
            "Errore durante il recupero delle conversazioni",
          dettaglio: error.message
        });

        return;
      }

      res.json(rows);
    });
  }
);

// Recupera i messaggi di una conversazione.
app.get(
  "/api/supporto/chat/:id_conversazione/messaggi",
  (req, res) => {
    const idConversazione =
      Number(
        req.params.id_conversazione
      );

    const sql = `
      SELECT *
      FROM supporto_chat_messaggi
      WHERE id_conversazione = ?
      ORDER BY data_invio ASC
    `;

    db.query(
      sql,
      [idConversazione],
      (error, rows) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore durante il recupero dei messaggi",
            dettaglio: error.message
          });

          return;
        }

        res.json(rows);
      }
    );
  }
);

// Invia un messaggio.
app.post(
  "/api/supporto/chat/:id_conversazione/messaggi",
  (req, res) => {
    const idConversazione =
      Number(
        req.params.id_conversazione
      );

    const mittente =
      String(req.body.mittente || "")
        .trim()
        .toLowerCase();

    const testo =
      String(req.body.testo || "")
        .trim();

    if (
      !Number.isInteger(
        idConversazione
      ) ||
      idConversazione <= 0 ||
      !mittente ||
      !testo
    ) {
      res.status(400).json({
        error:
          "Conversazione, mittente e testo sono obbligatori"
      });

      return;
    }

    if (
      ![
        "utente",
        "operatore"
      ].includes(mittente)
    ) {
      res.status(400).json({
        error:
          "Mittente non valido"
      });

      return;
    }

    const sql = `
      INSERT INTO supporto_chat_messaggi (
        id_conversazione,
        mittente,
        testo
      )
      VALUES (?, ?, ?)
    `;

    db.query(
      sql,
      [
        idConversazione,
        mittente,
        testo
      ],
      (error, result) => {
        if (error) {
          res.status(500).json({
            error:
              "Errore durante l'invio del messaggio",
            dettaglio: error.message
          });

          return;
        }

        res.status(201).json({
          message:
            "Messaggio inviato correttamente",

          id_messaggio:
            result.insertId
        });
      }
    );
  }
);


// =====================================================
// GESTIONE ROTTE API NON TROVATE
// =====================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    error: "Endpoint API non trovato"
  });
});

// =====================================================
// AVVIO DEL SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(
    `Server MoveLanDs avviato sulla porta ${PORT}`
  );
});