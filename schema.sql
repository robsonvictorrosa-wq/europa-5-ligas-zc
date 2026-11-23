-- Universo FC27 (somente leitura, gerado por import.js)
CREATE TABLE leagues(id INTEGER PRIMARY KEY,key TEXT,name TEXT,fc27_name TEXT,country TEXT,cup_name TEXT,in_game INT,n_clubs INT);
CREATE TABLE clubs(id INTEGER PRIMARY KEY,name TEXT,league_id INT,fc27_league TEXT,in_game INT,gender TEXT,n_players INT,overall REAL,squad_value INT,budget INT);
CREATE TABLE players(id INTEGER PRIMARY KEY,name TEXT,nationality TEXT,club_id INT,positions TEXT,primary_position TEXT,overall INT,potential INT,age INT,birth_date TEXT,height_cm INT,weight_kg INT,preferred_foot TEXT,weak_foot INT,skill_moves INT,gender TEXT,market_value INT,wage INT,release_clause INT,contract_end INT,stats TEXT);
CREATE INDEX ip_club ON players(club_id);CREATE INDEX ip_name ON players(name);CREATE INDEX ic_league ON clubs(league_id);
CREATE TABLE meta(k TEXT PRIMARY KEY,v TEXT);
