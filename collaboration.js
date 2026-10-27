import {validate} from './engine.js';
const copy=x=>JSON.parse(JSON.stringify(x)),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Three-way merge: edits to different fields/nodes compose; same-field edits conflict.
export function mergeModels(base,local,remote){
 const conflicts=[],out=copy(remote);function field(b,l,r,path){if(equal(l,b))return r;if(equal(r,b)||equal(l,r))return l;conflicts.push(path);return r;}
 for(const k of ['title','mission','top'])out[k]=field(base[k],local[k],remote[k],k);
 const b=new Map(base.nodes.map(n=>[n.id,n])),l=new Map(local.nodes.map(n=>[n.id,n])),r=new Map(remote.nodes.map(n=>[n.id,n]));out.nodes=[];
 for(const id of new Set([...r.keys(),...l.keys(),...b.keys()])){const bn=b.get(id),ln=l.get(id),rn=r.get(id);let n;
  if(!bn||!ln||!rn)n=field(bn,ln,rn,id);
  else if(ln.type!==bn.type||rn.type!==bn.type)n=field(bn,ln,rn,id);
  else {n={id};for(const k of new Set([...Object.keys(bn),...Object.keys(ln),...Object.keys(rn)])){if(k!=='id'){const v=field(bn[k],ln[k],rn[k],id+'.'+k);if(v!==undefined)n[k]=copy(v);}}}
  if(n)out.nodes.push(copy(n));
 }
 if(!conflicts.length){try{validate(out);}catch(e){conflicts.push('ツリー構造: '+e.message);}}
 return {model:out,conflicts};
}
export function parseRoom(hash){const p=new URLSearchParams(hash.replace(/^#/,''));const id=p.get('room'),token=p.get('key');if(!id&&!token)return null;if(!/^[0-9a-f-]{36}$/i.test(id||'')||!/^[0-9a-f]{64}$/i.test(token||''))throw Error('共有リンクの形式が不正です');return {id,token};}
export function makeRoom(){return {id:crypto.randomUUID(),token:[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('')};}
export function newNodeId(){return 'E_'+crypto.randomUUID().slice(0,18);}
export class RoomClient{
 constructor(config,room){if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!config.key)throw Error('共同編集サービスが未設定です');this.url=config.url;this.key=config.key;this.room=room;}
 async rpc(name,extra={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch(this.url+'/rest/v1/rpc/fta_'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:this.key},body:JSON.stringify({p_id:this.room.id,p_token:this.room.token,...extra}),signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.message||'共有サービスとの通信に失敗しました');return data;}finally{clearTimeout(timer);}}
 create(model){return this.rpc('create',{p_model:model});}read(){return this.rpc('read');}write(model,revision){return this.rpc('write',{p_model:model,p_expected:revision});}
}
