const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const F=path.join(__dirname,'data.json'),H=path.join(__dirname,'pasabuy_marketplace.html'),PORT=process.env.PORT||3000,MAX=25*1024*1024;
let cache=null,pool=null;
if(process.env.DATABASE_URL){const {Pool}=require('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}})}
async function load(){
  if(pool){await pool.query('create table if not exists kv(k text primary key, v text)');const r=await pool.query("select v from kv where k='db'");cache=r.rows[0]?r.rows[0].v:null}
  else if(fs.existsSync(F))cache=fs.readFileSync(F,'utf8');
}
function persist(t){
  if(pool)pool.query("insert into kv(k,v) values('db',$1) on conflict(k) do update set v=excluded.v",[t]).catch(e=>console.error('DB save failed:',e.message));
  else fs.writeFileSync(F,t);
}
const server=http.createServer((q,r)=>{
  if(q.url.startsWith('/api/db')){
    if(q.method==='GET'){r.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return r.end(cache||'null')}
    if(q.method==='PUT'){let b=[],n=0;q.on('data',c=>{n+=c.length;if(n>MAX){r.writeHead(413);r.end('too big');q.destroy()}else b.push(c)});q.on('end',()=>{if(n>MAX)return;try{const t=Buffer.concat(b).toString();JSON.parse(t);cache=t;persist(t);r.writeHead(200);r.end('ok')}catch(e){r.writeHead(400);r.end('bad')}});return}
  }
  if(q.url==='/'||q.url.startsWith('/?')){r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return r.end(fs.readFileSync(H))}
  r.writeHead(404);r.end('Not found');
});
load().catch(e=>console.error('Could not load saved data:',e.message)).then(()=>server.listen(PORT,'0.0.0.0',()=>{
  console.log('Pasabuy is running ('+(pool?'saving to database':'saving to data.json')+')');
  console.log('  This computer:        http://localhost:'+PORT);
  Object.values(os.networkInterfaces()).flat().filter(i=>i.family==='IPv4'&&!i.internal).forEach(i=>console.log('  Phones on same Wi-Fi: http://'+i.address+':'+PORT));
}));
