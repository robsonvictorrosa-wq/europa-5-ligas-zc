# Teste dos campeonatos personalizados. Uso: python3 test/custom-e2e.py <url> <PIN do Robshow>  [--keep]
# Cria: Premier 20 pontos corridos ida/volta + copa + internacional; MLS 4 mata-mata; misto de 6 ligas grupos+mata-mata.
# Simula tudo, confere campeões, "nova temporada igual", 403 para membro/moderador. Apaga tudo no fim (salvo --keep).
import json,sys,urllib.request,urllib.parse,time
B=sys.argv[1];PIN=sys.argv[2];KEEP='--keep' in sys.argv
def call(m,u,b=None,t=None):
  r=urllib.request.Request(B+u,method=m,data=json.dumps(b or {}).encode() if m not in('GET','DELETE') else None,headers={'content-type':'application/json',**({'authorization':'Bearer '+t} if t else {})})
  try:
    with urllib.request.urlopen(r,timeout=300) as x: return x.status,json.load(x)
  except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b'{}')
ok=True
def exp(l,c):
  global ok;ok&=bool(c);print('OK  ' if c else 'FAIL',l)
A=call('POST','/api/auth/login',{'nick':'Robshow','pin':PIN})[1]['token']
lg=lambda n:call('GET','/api/admin/custom/clubs?'+urllib.parse.urlencode({'league':n}),t=A)[1]
pl=[c['id'] for c in lg('Premier League')];mls=[c['id'] for c in lg('Major League Soccer')][:4]
mix=[]
for n in ['LALIGA EA SPORTS','Serie A Enilive','Bundesliga',"Ligue 1 McDonald's",'Liga Portugal','Eredivisie']:mix+=[c['id'] for c in lg(n)][:2]
exp('Premier 20 clubes',len(pl)==20);exp('MLS 4',len(mls)==4);exp('misto 12',len(mix)==12)
ids=[]
def mk(body):
  st,r=call('POST','/api/admin/custom',body,A);exp('criar '+body['name']+' '+str(st)+' '+str(r.get('error','')),st==200);ids.append(r.get('id'));return r.get('id')
p1=mk({'name':'Teste Premier ZC','clubs':pl,'format':{'type':'league','double':True},'cup':True,'intl':{'enabled':True,'size':16,'from':4,'type':'groups','name':'Copa Continental Teste'}})
p2=mk({'name':'Teste MLS 4','clubs':mls,'format':{'type':'ko','legs':2}})
p3=mk({'name':'Teste Misto 6 ligas','clubs':mix,'format':{'type':'groups','groups':3,'adv':2,'double':False,'legs':1}})
st,_=call('POST','/api/admin/custom',{'name':'x','clubs':pl},A);exp('validação nome curto 400',st==400)
# permissões
for n,role in [('TesteCustMembro',None),('TesteCustMod','moderador')]:
  s,r=call('POST','/api/auth/register',{'nick':n,'pin':'9876'})
  if s!=200: s,r=call('POST','/api/auth/login',{'nick':n,'pin':'9876'})
  t=r['token'];uid=r['user']['id']
  if role: call('POST',f'/api/admin/users/{uid}/role',{'role':role},A)
  for m,u,b in [('POST','/api/admin/custom',{'name':'Hack','clubs':mls,'format':{'type':'ko'}}),('POST',f'/api/admin/custom/{p2}/next',{}),('POST',f'/api/admin/custom/{p2}/all',{}),('GET','/api/admin/custom/leagues',None),('DELETE',f'/api/admin/custom/{p2}',None)]:
    exp(f'{n} {m} {u} 403',call(m,u,b,t)[0]==403)
  exp(f'{n} vê lista (200)',call('GET','/api/custom',t=t)[0]==200)
  exp(f'{n} vê campeonato (200)',call('GET',f'/api/custom/{p1}',t=t)[0]==200)
# simular
s,r=call('POST',f'/api/admin/custom/{p2}/next',{},A);exp('MLS próxima rodada joga 2',r.get('played')==2)
t0=time.time()
for i in ids:
  s,r=call('POST',f'/api/admin/custom/{i}/all',{},A);exp(f'simular tudo {i} -> {r}',s==200 and r.get('finished'))
print('tempo simular tudo: %.1fs'%(time.time()-t0))
v1=call('GET',f'/api/custom/{p1}')[1];P={p['key']:p for p in v1['parts']}
exp('Premier: 380 jogos liga',len(P['main']['matches'])==380 and all(m['played'] for m in P['main']['matches']))
exp('Premier: campeão = 1º da tabela',P['main']['champion']['id']==P['main']['table'][0]['club_id'])
exp('Premier: copa com campeão',P['cup']['champion'] is not None);exp('Internacional 16 com 4 da Premier',len(P['intl']['clubs'])==16 and P['intl']['from']==4 and P['intl']['champion'])
exp('Internacional tem grupos',len(P['intl'].get('groups') or [])==4)
exp('artilharia',len(P['main']['scorers'])>0)
v2=call('GET',f'/api/custom/{p2}')[1];m2=v2['parts'][0]['matches'];exp('MLS: semis ida/volta (4) + final (1)',len(m2)==5 and v2['parts'][0]['champion'])
v3=call('GET',f'/api/custom/{p3}')[1];m3=v3['parts'][0];stg=sorted({m['stage'] for m in m3['matches']})
exp('Misto: grupos + preliminar + semis + final '+str(stg),'Preliminar' in stg and 'Final' in stg and len(m3['groups'])==3 and m3['champion'])
exp('status finished',all(call('GET',f'/api/custom/{i}')[1]['status']=='finished' for i in ids))
s,r=call('POST',f'/api/admin/custom/{p2}/again',{},A);exp('nova temporada igual',s==200);ids.append(r.get('id'))
v4=call('GET',f"/api/custom/{r.get('id')}")[1];exp('temporada 2, mesmos clubes',v4['season']==2 and sorted(c['id'] for c in v4['parts'][0]['clubs'])==sorted(mls))
exp('lista mostra campeão',any(c['champion'] for c in call('GET','/api/custom')[1]))
print('ids:',ids)
if not KEEP:
  for i in ids: call('DELETE',f'/api/admin/custom/{i}',None,A)
  exp('apagados',len(call('GET','/api/custom')[1])==0)
print('TUDO OK' if ok else 'FALHAS')
