// Europa 5 Grandes Ligas ZC – servidor (Node 20 + Express). Universo FC27 em SQLite (data/game.db, gerado por import.js) + estado em Postgres (DATABASE_URL).
const express=require('express'),D=require('better-sqlite3'),path=require('path');
const app=express();
app.get('/api/health',(q,r)=>r.json({ok:true})); // responde sem depender do banco
const PORT=process.env.PORT||3050;app.listen(PORT,()=>console.log('Europa 5 Ligas ZC na porta',PORT));
global.__act='boot';{let t=Date.now();setInterval(()=>{const d=Date.now()-t-1000;if(d>2000)console.log('LAG',d,'ms durante',global.__act);t=Date.now();},1000).unref();}
app.use(require('compression')());app.use(express.json());
app.use(express.static(path.join(__dirname,'public'),{setHeaders:(r,f)=>{if(/\.(js|css|html)$/.test(f))r.setHeader('Cache-Control','no-cache');}}));
const uni=new D(path.join(__dirname,'data/game.db'),{readonly:true});
if(!process.env.DATABASE_URL){console.error('DATABASE_URL ausente: defina o Postgres (Neon) do jogo');app.use('/api',(q,r)=>r.status(503).json({error:'Banco não configurado'}));}
else{const G=require('./game')(uni,process.env.DATABASE_URL);const SE=require('./season')(G);require('./api')(app,G,SE);G.ready.catch(e=>console.error('BOOT Postgres ERRO',e));}
app.use('/api',(q,r)=>r.status(404).json({error:'Rota não encontrada'}));
console.log('BOOT rotas OK');
