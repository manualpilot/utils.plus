import type { ModeId } from "./engine";

export interface Dataset {
  value: DatasetId;
  label: string;
  sql: Record<ModeId, string>;
  query: Record<ModeId, string>;
}

export function datasetScript(dataset: Dataset, mode: ModeId): string {
  return `${dataset.sql[mode]}\n${dataset.query[mode]}`;
}

export type DatasetId = "library" | "movies";

export function isDataset(value: unknown): value is DatasetId {
  return DATASETS.some((dataset) => dataset.value === value);
}

export function datasetNamed(value: DatasetId): Dataset {
  return DATASETS.find((dataset) => dataset.value === value) ?? DATASETS[0];
}

export const DATASETS: Dataset[] = [
  {
    value: "library",
    label: "Library",
    sql: {
      sqlite: `CREATE TABLE authors (
  id      INTEGER PRIMARY KEY,
  name    TEXT    NOT NULL UNIQUE,
  country TEXT,
  born    INTEGER CHECK (born > 1700)
);

CREATE TABLE books (
  id        INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
  title     TEXT    NOT NULL,
  published INTEGER NOT NULL,
  pages     INTEGER,
  rating    REAL    CHECK (rating BETWEEN 0 AND 5),
  UNIQUE (author_id, title)
);

CREATE INDEX books_published ON books (published DESC);

CREATE VIEW author_totals AS
SELECT a.name AS author, COUNT(b.id) AS books, ROUND(AVG(b.rating), 2) AS rating
FROM authors a LEFT JOIN books b ON b.author_id = a.id
GROUP BY a.id, a.name;

INSERT INTO authors (name, country, born) VALUES
  ('Ursula K. Le Guin', 'United States', 1929),
  ('Ted Chiang',        'United States', 1967),
  ('Ann Leckie',        'United States', 1966),
  ('Stanisław Lem',     'Poland',        1921);

INSERT INTO books (author_id, title, published, pages, rating) VALUES
  (1, 'The Left Hand of Darkness', 1969, 304, 4.6),
  (1, 'The Dispossessed',          1974, 341, 4.7),
  (2, 'Stories of Your Life',      2002, 285, 4.5),
  (2, 'Exhalation',                2019, 350, 4.4),
  (3, 'Ancillary Justice',         2013, 386, 4.2),
  (4, 'Solaris',                   1961, 204, 4.3),
  (4, 'The Cyberiad',              1965, 295, 4.5);
`,
      postgres: `CREATE TABLE authors (
  id      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name    text     NOT NULL UNIQUE,
  country text,
  born    smallint CHECK (born > 1700)
);

CREATE TABLE books (
  id        integer      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id integer      NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
  title     text         NOT NULL,
  published smallint     NOT NULL,
  pages     integer,
  rating    numeric(2,1) CHECK (rating BETWEEN 0 AND 5),
  tags      text[]       NOT NULL DEFAULT '{}',
  UNIQUE (author_id, title)
);

CREATE INDEX books_published ON books (published DESC);

CREATE VIEW author_totals AS
SELECT a.name AS author, count(b.id) AS books, round(avg(b.rating), 2) AS rating
FROM authors a LEFT JOIN books b ON b.author_id = a.id
GROUP BY a.id, a.name;

CREATE SCHEMA library;

CREATE TABLE library.loans (
  id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  book_id  integer NOT NULL REFERENCES books (id),
  borrower text    NOT NULL,
  borrowed date    NOT NULL DEFAULT CURRENT_DATE,
  returned date,
  CHECK (returned IS NULL OR returned >= borrowed)
);

INSERT INTO authors (name, country, born) VALUES
  ('Ursula K. Le Guin', 'United States', 1929),
  ('Ted Chiang',        'United States', 1967),
  ('Ann Leckie',        'United States', 1966),
  ('Stanisław Lem',     'Poland',        1921);

INSERT INTO books (author_id, title, published, pages, rating, tags) VALUES
  (1, 'The Left Hand of Darkness', 1969, 304, 4.6, '{science fiction,classic}'),
  (1, 'The Dispossessed',          1974, 341, 4.7, '{science fiction,utopia}'),
  (2, 'Stories of Your Life',      2002, 285, 4.5, '{short stories}'),
  (2, 'Exhalation',                2019, 350, 4.4, '{short stories}'),
  (3, 'Ancillary Justice',         2013, 386, 4.2, '{space opera}'),
  (4, 'Solaris',                   1961, 204, 4.3, '{science fiction,classic}'),
  (4, 'The Cyberiad',              1965, 295, 4.5, '{fables,robots}');

INSERT INTO library.loans (book_id, borrower, borrowed, returned) VALUES
  (1, 'ada',    DATE '2026-01-04', DATE '2026-01-19'),
  (3, 'grace',  DATE '2026-02-11', NULL),
  (6, 'edsger', DATE '2026-02-14', NULL);
`,
    },
    query: {
      sqlite: `SELECT a.name AS author, b.title, b.published, b.rating
FROM books b
JOIN authors a ON a.id = b.author_id
ORDER BY b.rating DESC, b.published;
`,
      postgres: `SELECT a.name AS author, b.title, b.published, b.rating, b.tags
FROM books b
JOIN authors a ON a.id = b.author_id
ORDER BY b.rating DESC, b.published;
`,
    },
  },
  {
    value: "movies",
    label: "Movies",
    sql: {
      sqlite: `CREATE TABLE directors (
  id      INTEGER PRIMARY KEY,
  name    TEXT    NOT NULL UNIQUE,
  country TEXT,
  born    INTEGER CHECK (born > 1800)
);

CREATE TABLE films (
  id          INTEGER PRIMARY KEY,
  director_id INTEGER NOT NULL REFERENCES directors (id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  released    INTEGER NOT NULL,
  minutes     INTEGER CHECK (minutes > 0),
  rating      REAL    CHECK (rating BETWEEN 0 AND 10),
  UNIQUE (director_id, title)
);

CREATE TABLE genres (
  film_id INTEGER NOT NULL REFERENCES films (id) ON DELETE CASCADE,
  genre   TEXT    NOT NULL,
  PRIMARY KEY (film_id, genre)
);

CREATE TABLE showings (
  id      INTEGER PRIMARY KEY,
  film_id INTEGER NOT NULL REFERENCES films (id),
  screen  TEXT    NOT NULL,
  starts  TEXT    NOT NULL,
  sold    INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0)
);

CREATE INDEX films_released ON films (released DESC);
CREATE INDEX showings_starts ON showings (starts);

CREATE VIEW director_totals AS
SELECT d.name AS director, COUNT(f.id) AS films, ROUND(AVG(f.rating), 2) AS rating
FROM directors d LEFT JOIN films f ON f.director_id = d.id
GROUP BY d.id, d.name;

INSERT INTO directors (name, country, born) VALUES
  ('Agnès Varda',       'France',        1928),
  ('Hayao Miyazaki',    'Japan',         1941),
  ('Bong Joon-ho',      'South Korea',   1969),
  ('Céline Sciamma',    'France',        1978),
  ('Denis Villeneuve',  'Canada',        1967);

INSERT INTO films (director_id, title, released, minutes, rating) VALUES
  (1, 'Cléo from 5 to 7',              1962,  90, 7.9),
  (1, 'The Gleaners and I',            2000,  82, 7.7),
  (2, 'My Neighbour Totoro',           1988,  86, 8.1),
  (2, 'Spirited Away',                 2001, 125, 8.6),
  (3, 'Memories of Murder',            2003, 132, 8.1),
  (3, 'Parasite',                      2019, 132, 8.5),
  (4, 'Portrait of a Lady on Fire',    2019, 122, 8.1),
  (5, 'Arrival',                       2016, 116, 7.9),
  (5, 'Blade Runner 2049',             2017, 164, 8.0);

INSERT INTO genres (film_id, genre) VALUES
  (1, 'drama'), (2, 'documentary'), (3, 'animation'), (3, 'family'),
  (4, 'animation'), (4, 'fantasy'), (5, 'crime'), (5, 'thriller'),
  (6, 'thriller'), (6, 'drama'), (7, 'drama'), (7, 'romance'),
  (8, 'science fiction'), (9, 'science fiction'), (9, 'thriller');

INSERT INTO showings (film_id, screen, starts, sold) VALUES
  (6, 'Screen 1', '2026-03-06 19:30', 184),
  (6, 'Screen 1', '2026-03-07 19:30', 201),
  (4, 'Screen 2', '2026-03-07 14:00',  96),
  (7, 'Screen 2', '2026-03-08 20:15',  61),
  (9, 'Screen 3', '2026-03-08 21:00', 118);
`,
      postgres: `CREATE TABLE directors (
  id      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name    text     NOT NULL UNIQUE,
  country text,
  born    smallint CHECK (born > 1800)
);

CREATE TABLE films (
  id          integer      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  director_id integer      NOT NULL REFERENCES directors (id) ON DELETE CASCADE,
  title       text         NOT NULL,
  released    smallint     NOT NULL,
  minutes     smallint     CHECK (minutes > 0),
  rating      numeric(3,1) CHECK (rating BETWEEN 0 AND 10),
  genres      text[]       NOT NULL DEFAULT '{}',
  UNIQUE (director_id, title)
);

CREATE INDEX films_released ON films (released DESC);

CREATE VIEW director_totals AS
SELECT d.name AS director, count(f.id) AS films, round(avg(f.rating), 2) AS rating
FROM directors d LEFT JOIN films f ON f.director_id = d.id
GROUP BY d.id, d.name;

CREATE SCHEMA cinema;

CREATE TABLE cinema.showings (
  id      integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  film_id integer     NOT NULL REFERENCES films (id),
  screen  text        NOT NULL,
  starts  timestamptz NOT NULL,
  sold    integer     NOT NULL DEFAULT 0 CHECK (sold >= 0)
);

CREATE INDEX showings_starts ON cinema.showings (starts);

INSERT INTO directors (name, country, born) VALUES
  ('Agnès Varda',      'France',      1928),
  ('Hayao Miyazaki',   'Japan',       1941),
  ('Bong Joon-ho',     'South Korea', 1969),
  ('Céline Sciamma',   'France',      1978),
  ('Denis Villeneuve', 'Canada',      1967);

INSERT INTO films (director_id, title, released, minutes, rating, genres) VALUES
  (1, 'Cléo from 5 to 7',           1962,  90, 7.9, '{drama}'),
  (1, 'The Gleaners and I',         2000,  82, 7.7, '{documentary}'),
  (2, 'My Neighbour Totoro',        1988,  86, 8.1, '{animation,family}'),
  (2, 'Spirited Away',              2001, 125, 8.6, '{animation,fantasy}'),
  (3, 'Memories of Murder',         2003, 132, 8.1, '{crime,thriller}'),
  (3, 'Parasite',                   2019, 132, 8.5, '{thriller,drama}'),
  (4, 'Portrait of a Lady on Fire', 2019, 122, 8.1, '{drama,romance}'),
  (5, 'Arrival',                    2016, 116, 7.9, '{science fiction}'),
  (5, 'Blade Runner 2049',          2017, 164, 8.0, '{science fiction,thriller}');

INSERT INTO cinema.showings (film_id, screen, starts, sold) VALUES
  (6, 'Screen 1', TIMESTAMPTZ '2026-03-06 19:30+00', 184),
  (6, 'Screen 1', TIMESTAMPTZ '2026-03-07 19:30+00', 201),
  (4, 'Screen 2', TIMESTAMPTZ '2026-03-07 14:00+00',  96),
  (7, 'Screen 2', TIMESTAMPTZ '2026-03-08 20:15+00',  61),
  (9, 'Screen 3', TIMESTAMPTZ '2026-03-08 21:00+00', 118);
`,
    },
    query: {
      sqlite: `SELECT d.name AS director, f.title, f.released, f.rating
FROM films f
JOIN directors d ON d.id = f.director_id
ORDER BY f.rating DESC, f.released;
`,
      postgres: `SELECT d.name AS director, f.title, f.released, f.rating, f.genres
FROM films f
JOIN directors d ON d.id = f.director_id
ORDER BY f.rating DESC, f.released;
`,
    },
  },
];
