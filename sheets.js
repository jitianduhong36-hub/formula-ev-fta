import {validate} from './engine.js?v=groups1';
import {newNodeId} from './collaboration.js?v=groups1';
const copy=x=>JSON.parse(JSON.stringify(x));
export function localKey(hash){const id=new URLSearchParams(hash.replace(/^#/,'' )).get('local');return id&&/^[a-f0-9-]{36}$/i.test(id)?'fta-local:'+id:'formula-ev-fta-v1';}
export function blankSheet(title='新しい解析'){return {version:1,title:title.trim()||'新しい解析',mission:'未設定（評価期間を入力）',top:'TOP',nodes:[{id:'TOP',label:'解析したい故障（名称を変更）',type:'BASIC',p:0}]};}
export function addChild(model,parentId,type='BASIC'){
 if(!['BASIC','AND','OR'].includes(type))throw Error('事象の種類が不正です');const next=copy(model),parent=next.nodes.find(n=>n.id===parentId);if(!parent)throw Error('親事象を選んでください');
 if(parent.type==='BASIC'){parent.type='OR';parent.children=[];delete parent.p;}
 const id=newNodeId(),node={id,label:type==='BASIC'?'新しい原因（名称を変更）':'新しい中間事象',type};
 if(type==='BASIC')node.p=0;else{const leaf=newNodeId();node.children=[leaf];next.nodes.push({id:leaf,label:'新しい原因（名称を変更）',type:'BASIC',p:0});}
 parent.children.push(id);next.nodes.push(node);validate(next);return {model:next,id};
}
export function setupSheets({getModel,isUnsaved}){
 const list=document.getElementById('sheet-list');let entries=[];try{entries=JSON.parse(localStorage.getItem('fta-sheet-bookmarks')||'[]');if(!Array.isArray(entries))entries=[];}catch{}
 function validURL(href){try{const u=new URL(href);return u.origin===location.origin&&u.pathname===location.pathname&&u.hash;}catch{return false;}}
 entries=entries.filter(e=>e&&typeof e.name==='string'&&validURL(e.url)).slice(0,100);
 function render(){list.replaceChildren();if(!entries.length){const p=document.createElement('p');p.className='hint';p.textContent='シートを作成すると、ここから開けます。';list.append(p);}for(const e of entries){const a=document.createElement('a');a.href=e.url;a.className='sheet-bookmark';a.textContent=(e.cloud?'☁ クラウド · ':'端末内 · ')+e.name;a.onclick=ev=>{ev.preventDefault();if(isUnsaved())return alert('入力中または未同期の変更があります。先に「変更を反映」またはJSON保存してください。');location.href=e.url;location.reload();};list.append(a);}}
 function remember(cloud){const url=location.origin+location.pathname+location.hash;if(!location.hash)return;const entry={name:getModel().title||'名称未設定',url,cloud};entries=[entry,...entries.filter(e=>e.url!==url)].slice(0,100);try{localStorage.setItem('fta-sheet-bookmarks',JSON.stringify(entries));}catch{}render();}
 document.getElementById('new-sheet').onclick=()=>{if(isUnsaved())return alert('先に入力中の変更を反映し、クラウド保存を確認してください。');document.getElementById('new-sheet-dialog').showModal();};
 document.getElementById('new-sheet-cancel').onclick=()=>document.getElementById('new-sheet-dialog').close();
 document.getElementById('new-sheet-form').onsubmit=e=>{e.preventDefault();if(isUnsaved())return alert('現在の変更を先に保存してください');const title=document.getElementById('new-sheet-name').value;const cloud=document.getElementById('new-sheet-storage').value==='cloud',id=crypto.randomUUID();const model=blankSheet(title);try{localStorage.setItem('fta-local:'+id,JSON.stringify(model));}catch{return alert('端末内に新規シートを準備できません。保存容量を確認してください。');}location.href=location.origin+location.pathname+'#local='+id+(cloud?'&createcloud=1':'');location.reload();};
 render();if(location.hash.startsWith('#local=')&&!location.hash.includes('createcloud='))remember(false);
 return {remember};
}
