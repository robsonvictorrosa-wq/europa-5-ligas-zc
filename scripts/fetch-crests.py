#!/usr/bin/env python3
"""Baixa os escudos reais dos 96 clubes (imagem principal do artigo na Wikipedia)
e salva em public/crests/<club_id>.png (128x128, fundo transparente). Rodar uma vez;
as imagens ficam versionadas no repo (sem hotlink)."""
import json, re, sys, time, urllib.parse, urllib.request
from io import BytesIO
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "crests"; OUT.mkdir(parents=True, exist_ok=True)
UA = "Europa5LigasZC/1.0 (modo carreira; https://github.com/robsonvictorrosa-wq/europa-5-ligas-zc)"
# FC27 usa nomes genéricos para clubes sem licença: Lombardia FC = Inter, Milano FC = Milan, Bergamo Calcio = Atalanta.
CLUBS = [
(212,"AFC Bournemouth"),(757,"Arsenal F.C."),(29,"Aston Villa F.C."),(189,"Brentford F.C."),(202,"Brighton & Hove Albion F.C."),
(340,"Chelsea F.C."),(545,"Coventry City F.C."),(207,"Crystal Palace F.C."),(374,"Everton F.C."),(149,"Fulham F.C."),
(559,"Hull City A.F.C."),(248,"Ipswich Town F.C."),(517,"Leeds United F.C."),(197,"Liverpool F.C."),(634,"Manchester United F.C."),
(684,"Manchester City F.C."),(311,"Newcastle United F.C."),(587,"Nottingham Forest F.C."),(536,"Tottenham Hotspur F.C."),(601,"Sunderland A.F.C."),
(645,"Athletic Bilbao"),(728,"Atlético Madrid"),(278,"CA Osasuna"),(439,"RC Celta de Vigo"),(69,"Deportivo Alavés"),(208,"Elche CF"),
(595,"FC Barcelona"),(369,"Getafe CF"),(304,"Levante UD"),(127,"Málaga CF"),(607,"Racing de Santander"),(410,"Deportivo de La Coruña"),
(292,"RCD Espanyol"),(513,"Rayo Vallecano"),(614,"Real Betis"),(224,"Real Madrid CF"),(577,"Real Sociedad"),(5,"Sevilla FC"),
(621,"Valencia CF"),(657,"Villarreal CF"),
(86,"AC Monza"),(133,"ACF Fiorentina"),(480,"AS Roma"),(605,"Atalanta BC"),(530,"Bologna FC 1909"),(496,"Cagliari Calcio"),
(223,"Como 1907"),(65,"Frosinone Calcio"),(144,"Genoa CFC"),(598,"Juventus FC"),(754,"Inter Milan"),(401,"AC Milan"),
(653,"Parma Calcio 1913"),(308,"SS Lazio"),(720,"SSC Napoli"),(390,"US Sassuolo Calcio"),(402,"Torino FC"),(147,"US Lecce"),
(424,"Udinese Calcio"),(222,"Venezia FC"),
(263,"1. FC Köln"),(493,"1. FSV Mainz 05"),(138,"Borussia Dortmund"),(431,"FC Augsburg"),(709,"FC Bayern Munich"),(477,"FC Schalke 04"),
(341,"Eintracht Frankfurt"),(423,"Hamburger SV"),(677,"Bayer 04 Leverkusen"),(661,"Borussia Mönchengladbach"),(411,"RB Leipzig"),
(592,"SC Freiburg"),(672,"SC Paderborn 07"),(31,"SV Elversberg"),(695,"SV Werder Bremen"),(364,"TSG Hoffenheim"),(727,"1. FC Union Berlin"),
(538,"VfB Stuttgart"),
(631,"AJ Auxerre"),(210,"AS Monaco FC"),(16,"Angers SCO"),(394,"ES Troyes AC"),(13,"FC Lorient"),(518,"Lille OSC"),(544,"Le Havre AC"),
(346,"Le Mans FC"),(596,"OGC Nice"),(262,"Olympique Lyonnais"),(377,"Olympique de Marseille"),(15,"Paris Saint-Germain F.C."),
(20,"Paris FC"),(516,"RC Lens"),(599,"Stade Brestois 29"),(119,"Stade Rennais F.C."),(21,"RC Strasbourg Alsace"),(23,"Toulouse FC"),
]
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(3*(i+1)); continue
            raise
    raise RuntimeError("429")
API = "https://en.wikipedia.org/w/api.php?"
def page_image(title):
    # usa a imagem do infobox do artigo (o escudo), não a pageimage (que pode ser foto do estádio)
    q = urllib.parse.urlencode({"action":"parse","page":title,"prop":"wikitext","section":0,"format":"json","redirects":1})
    wt = json.loads(get(API+q))["parse"]["wikitext"]["*"]
    m = re.search(r"\|\s*(?:image|logo|crest|clubcrest)\s*=\s*(?:\[\[)?(?:File:|Image:)?([^\n|\]<{]+)", wt, re.I)
    if not m or not m.group(1).strip(): return None, None
    f = m.group(1).strip()
    q = urllib.parse.urlencode({"action":"query","titles":"File:"+f,"prop":"imageinfo","iiprop":"url","iiurlwidth":256,"format":"json"})
    for p in json.loads(get(API+q))["query"]["pages"].values():
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("thumburl") or ii.get("url"): return ii.get("thumburl") or ii["url"], f
    return None, f
def save(blob, dest):
    im = Image.open(BytesIO(blob)).convert("RGBA"); im.thumbnail((128,128), Image.LANCZOS)
    c = Image.new("RGBA",(128,128),(0,0,0,0)); c.paste(im,((128-im.width)//2,(128-im.height)//2),im); c.save(dest,"PNG",optimize=True)
only = set(map(int, sys.argv[1:]))
log = []
for cid, title in CLUBS:
    if only and cid not in only: continue
    try:
        url, pi = page_image(title)
        if not url: raise RuntimeError("sem imagem")
        save(get(url), OUT/f"{cid}.png"); log.append((cid,title,pi)); print("OK ", cid, title, pi)
    except Exception as e:
        print("ERR", cid, title, e)
    time.sleep(0.3)
(Path("/tmp")/"e5-crests-log.json").write_text(json.dumps(log, ensure_ascii=False, indent=1))
