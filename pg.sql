-- Europa 5 Grandes Ligas ZC – estado do jogo (Postgres). Idempotente.
CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,nick TEXT UNIQUE NOT NULL,pass_hash TEXT NOT NULL,is_admin BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INT REFERENCES users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS game_state(id INT PRIMARY KEY DEFAULT 1,season INT NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pre',start_date DATE,auto BOOLEAN NOT NULL DEFAULT false,market_open BOOLEAN NOT NULL DEFAULT true,auction_open BOOLEAN NOT NULL DEFAULT false,version INT NOT NULL DEFAULT 1,CHECK(id=1));
CREATE TABLE IF NOT EXISTS club_state(club_id INT PRIMARY KEY,budget BIGINT NOT NULL,manager_id INT UNIQUE REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS player_state(player_id INT PRIMARY KEY,club_id INT);
CREATE TABLE IF NOT EXISTS matches(id SERIAL PRIMARY KEY,season INT NOT NULL,comp TEXT NOT NULL,league_id INT,round INT,md INT,stage TEXT,tie INT,kickoff TIMESTAMPTZ,home INT,away INT,hg INT,ag INT,pens TEXT,winner INT,neutral BOOLEAN NOT NULL DEFAULT false,played BOOLEAN NOT NULL DEFAULT false,details JSONB);
CREATE INDEX IF NOT EXISTS m_season ON matches(season,md);
CREATE TABLE IF NOT EXISTS auction_lots(id SERIAL PRIMARY KEY,season INT NOT NULL,player_id INT NOT NULL,from_club INT,min_bid BIGINT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',winner_club INT,price BIGINT,created_by INT,created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS auction_bids(id SERIAL PRIMARY KEY,lot_id INT REFERENCES auction_lots(id) ON DELETE CASCADE,club_id INT NOT NULL,user_id INT,amount BIGINT NOT NULL,at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS offers(id SERIAL PRIMARY KEY,season INT NOT NULL,player_id INT NOT NULL,buyer_club INT NOT NULL,seller_club INT NOT NULL,buyer_user INT,fee BIGINT NOT NULL,counter_fee BIGINT,status TEXT NOT NULL,msg TEXT,created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS transfers(id SERIAL PRIMARY KEY,season INT NOT NULL,player_id INT NOT NULL,from_club INT,to_club INT,fee BIGINT NOT NULL DEFAULT 0,kind TEXT,at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS euro_slots(season INT NOT NULL,comp TEXT NOT NULL,club_id INT NOT NULL,league_id INT,pos INT,via TEXT,PRIMARY KEY(season,club_id));
CREATE TABLE IF NOT EXISTS snapshots(season INT PRIMARY KEY,data JSONB NOT NULL,at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS log(id SERIAL PRIMARY KEY,season INT,text TEXT NOT NULL,user_id INT,at TIMESTAMPTZ DEFAULT now());
INSERT INTO game_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
-- Cargos (23/11/2026): membro/moderador/admin. Migração sem perda: contas com is_admin viram 'admin'; is_admin segue espelhando role='admin'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'membro';
UPDATE users SET role='admin' WHERE is_admin AND role='membro';
-- Campeonatos personalizados (23/11/2026): separados da carreira principal; enxuto (config/estado em JSONB, gols só [jogador,clube]).
CREATE TABLE IF NOT EXISTS custom_comps(id SERIAL PRIMARY KEY,name TEXT NOT NULL,cfg JSONB NOT NULL,state JSONB NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'running',season INT NOT NULL DEFAULT 1,parent_id INT,created_by INT,created_at TIMESTAMPTZ DEFAULT now(),finished_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS custom_matches(id SERIAL PRIMARY KEY,comp_id INT NOT NULL REFERENCES custom_comps(id) ON DELETE CASCADE,part TEXT NOT NULL,round INT NOT NULL,stage TEXT,tie INT,leg INT NOT NULL DEFAULT 1,home INT NOT NULL,away INT NOT NULL,hg INT,ag INT,pens TEXT,played BOOLEAN NOT NULL DEFAULT false,goals JSONB);
CREATE INDEX IF NOT EXISTS cm_comp ON custom_matches(comp_id,part,round);
