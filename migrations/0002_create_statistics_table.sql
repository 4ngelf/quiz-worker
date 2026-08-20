PRAGMA foreign_keys = 0;

BEGIN TRANSACTION;

CREATE TABLE temp_submitted AS SELECT * FROM submitted;

DROP TABLE submitted;

CREATE TABLE submitted (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date VARCHAR NOT NULL,
  session_id VARCHAR NOT NULL UNIQUE
);

INSERT INTO submitted (id, date, session_id) SELECT id, date, '00000000-0000-0000-0000-000000000000' FROM temp_submitted;

DROP TABLE temp_submitted;

CREATE TABLE IF NOT EXISTS statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id VARCHAR NOT NULL,
  submitted_id INTEGER,
  optional_information TEXT,
  access_datetime VARCHAR NOT NULL,
  event VARCHAR NOT NULL,
  FOREIGN KEY (submitted_id) REFERENCES submitted(id)
    ON UPDATE CASCADE
);

COMMIT;

PRAGMA foreign_keys = 1;
