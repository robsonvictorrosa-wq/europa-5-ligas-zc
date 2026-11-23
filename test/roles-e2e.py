# Teste de cargos (200/403 por papel). Uso: python3 test/roles-e2e.py http://localhost:3150 <PIN do Robshow local>. Cria TesteMod/TesteMembro/TesteAdm2 (apague depois em produção).
import json,urllib.request,sys
B=sys.argv[1]; APIN=sys.argv[2]
def call(m,u,b=None,t=None):
  r=urllib.request.Request(B+u,method=m,data=json.dumps(b or {}).encode() if m!='GET' else None,headers={'content-type':'application/json',**({'authorization':'Bearer '+t} if t else {})})
  try:
    with urllib.request.urlopen(r) as x: return x.status,json.load(x)
  except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b'{}')
A=call('POST','/api/auth/login',{'nick':'Robshow','pin':APIN})[1]['token']
tok={};ids={}
for n in ['TesteMod','TesteMembro','TesteAdm2']:
  st,r=call('POST','/api/auth/register',{'nick':n,'pin':'9876'})
  if st!=200: st,r=call('POST','/api/auth/login',{'nick':n,'pin':'9876'})
  tok[n]=r['token'];ids[n]=r['user']['id']
ok=True
def exp(label,got,want):
  global ok
  good=(got==want) if isinstance(want,int) else (got in want)
  ok&=good;print(('OK  ' if good else 'FAIL'),label,got,'esperado',want)
# promote
exp('admin promove mod',call('POST',f"/api/admin/users/{ids['TesteMod']}/role",{'role':'moderador'},A)[0],200)
exp('admin promove adm2',call('POST',f"/api/admin/users/{ids['TesteAdm2']}/role",{'role':'admin'},A)[0],200)
rob=[u for u in call('GET','/api/admin/users',t=A)[1] if u['nick']=='Robshow'][0]
exp('rebaixar fixo Robshow',call('POST',f"/api/admin/users/{rob['id']}/role",{'role':'membro'},tok['TesteAdm2'])[0],403)
exp('cargo inválido',call('POST',f"/api/admin/users/{ids['TesteMembro']}/role",{'role':'rei'},A)[0],400)
for n,want in [('TesteMod','moderador'),('TesteMembro','membro'),('TesteAdm2','admin')]:
  exp('/api/me role '+n,call('GET','/api/me',t=tok[n])[1]['user']['role'],want)
exp('/api/me role Robshow',call('GET','/api/me',t=A)[1]['user']['role'],'admin')
st=call('GET','/api/state')[1]; mk=st['market_open']
MODR=[('POST','/api/admin/market',{'open':not mk}),('POST','/api/admin/market',{'open':mk}),('GET','/api/admin/fc27?q=Wirtz',None),('POST','/api/admin/auction/open',{}),('POST','/api/admin/auction/close',{})]
ADMR=[('GET','/api/admin/users',None),('POST','/api/admin/season/auto',{'on':False}),('POST','/api/admin/season/schedule',{'start_date':'bad'}),('POST','/api/admin/season/new',{}),('POST','/api/admin/season/reset',{}),('POST',f"/api/admin/users/{ids['TesteMembro']}/role",{'role':'membro'}),('POST','/api/admin/clubs/757/manager',{'nick':'zzz-nao-existe'})]
for n in ['TesteMembro','TesteMod','TesteAdm2']:
  t=tok[n]
  for m,u,b in MODR:
    st,_=call(m,u,b,t); exp(f'{n:12} {u}',st,403 if n=='TesteMembro' else [200,400])
  for m,u,b in ADMR:
    st,_=call(m,u,b,t); exp(f'{n:12} {u}',st,403 if n!='TesteAdm2' else [200,400,404])
exp('sem login',call('POST','/api/admin/market',{'open':mk})[0],401)
# season/next: mod allowed (may be 200 or 400 depending on state)
exp('mod season/next',call('POST','/api/admin/season/next',{},tok['TesteMod'])[0],[200,400])
exp('membro season/next',call('POST','/api/admin/season/next',{},tok['TesteMembro'])[0],403)
# demote back
exp('admin rebaixa adm2→membro',call('POST',f"/api/admin/users/{ids['TesteAdm2']}/role",{'role':'membro'},A)[0],200)
exp('ex-admin perde acesso',call('GET','/api/admin/users',t=tok['TesteAdm2'])[0],403)
print('ids de teste:',ids)
print('TUDO OK' if ok else 'FALHAS')
