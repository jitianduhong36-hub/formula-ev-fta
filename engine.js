import {validateGroups} from './groups.js?v=groups1';
export function validate(m){
 if(!m||m.version!==1||!Array.isArray(m.nodes)||m.nodes.length>150)throw Error('形式が不正です（version:1、最大150ノード）');
 const map=new Map();for(const n of m.nodes){if(!n||typeof n.id!=='string'||!n.id||n.id.length>80||map.has(n.id)||typeof n.label!=='string'||n.label.length>200||!['BASIC','AND','OR'].includes(n.type))throw Error('ノードのID・名称・種類を確認してください');map.set(n.id,n);if(n.type==='BASIC'){if(typeof n.p!=='number'||!Number.isFinite(n.p)||n.p<0||n.p>1)throw Error('確率は0〜1で入力してください');}else if(!Array.isArray(n.children)||!n.children.length||n.children.length>150||n.children.some(x=>typeof x!=='string'))throw Error('ゲートには子事象が必要です');}
 validateGroups(m);const active=new Set(),done=new Set();function walk(id){if(!map.has(id))throw Error('参照先がありません: '+id);if(active.has(id))throw Error('循環参照があります');if(done.has(id))return;active.add(id);const n=map.get(id);if(n.type!=='BASIC')n.children.forEach(walk);active.delete(id);done.add(id);}if(!map.has(m.top))throw Error('トップ事象を指定してください');for(const id of map.keys())walk(id);return map;
}
export function analyze(m){
 const map=validate(m),reachable=new Set();function visit(id){if(reachable.has(id))return;reachable.add(id);const n=map.get(id);if(n.type!=='BASIC')n.children.forEach(visit);}visit(m.top);
 const basics=m.nodes.filter(n=>reachable.has(n.id)&&n.type==='BASIC');
 const order=new Map(basics.map((n,i)=>[n.id,i]));const bdd=[null,null],unique=new Map(),cache=new Map();
 function mk(v,l,h){if(l===h)return l;const key=[v,l,h].join(',');if(unique.has(key))return unique.get(key);if(bdd.length>60000)throw Error('計算規模の上限です。ツリーを分割してください');const id=bdd.length;bdd.push({v,l,h});unique.set(key,id);return id;}
 function apply(op,a,b){if(a>b)[a,b]=[b,a];if(op==='AND'){if(a===0||b===0)return 0;if(a===1)return b;}else{if(a===1||b===1)return 1;if(a===0)return b;}if(a===b)return a;const key=[op,a,b].join(',');if(cache.has(key))return cache.get(key);const v=Math.min(bdd[a].v,bdd[b].v),split=x=>bdd[x].v===v?[bdd[x].l,bdd[x].h]:[x,x];const [al,ah]=split(a),[bl,bh]=split(b);const out=mk(v,apply(op,al,bl),apply(op,ah,bh));cache.set(key,out);return out;}
 const built=new Map();function build(id){if(built.has(id))return built.get(id);const n=map.get(id),r=n.type==='BASIC'?mk(order.get(id),0,1):n.children.map(build).reduce((a,b)=>apply(n.type,a,b),n.type==='AND'?1:0);built.set(id,r);return r;}const root=build(m.top);
 function probability(override=-1,value=0){const memo=new Map([[0,0],[1,1]]);function calc(id){if(memo.has(id))return memo.get(id);const n=bdd[id],p=n.v===override?value:basics[n.v].p;const q=(1-p)*calc(n.l)+p*calc(n.h);memo.set(id,q);return q;}return calc(root);}
 const q=probability();const importance=basics.map((n,i)=>{const q0=probability(i,0),q1=probability(i,1);return {id:n.id,label:n.label,p:n.p,birnbaum:q1-q0,fv:q===0?null:(q-q0)/q,raw:q===0?null:q1/q,rrw:q0===0?null:q/q0};}).sort((a,b)=>b.birnbaum-a.birnbaum);
 let operations=0;function minimal(sets){const out=[];sets.sort((a,b)=>a.size-b.size);for(const s of sets){if(++operations>3000000)throw Error('最小カットセット計算の上限です。ツリーを分割してください');if(!out.some(t=>[...t].every(x=>s.has(x))))out.push(s);if(out.length>5000)throw Error('最小カットセットが5000件を超えました');}return out;}
 const cutsCache=new Map();function cuts(id){if(cutsCache.has(id))return cutsCache.get(id);const n=map.get(id);let r;if(n.type==='BASIC')r=[new Set([id])];else if(n.type==='OR')r=minimal(n.children.flatMap(cuts));else{r=[new Set()];for(const c of n.children){const next=[];for(const a of r)for(const b of cuts(c)){if(next.length>100000)throw Error('カットセット中間展開の上限です');next.push(new Set([...a,...b]));}r=minimal(next);}}cutsCache.set(id,r);return r;}
 let cutSets=[],cutError=null;try{cutSets=cuts(m.top).map(s=>({ids:[...s],p:[...s].reduce((p,id)=>p*map.get(id).p,1)}));}catch(e){cutError=e.message;}
 return {q,importance,cutSets,cutError,bddNodes:bdd.length-2,unreachable:m.nodes.length-reachable.size};
}
