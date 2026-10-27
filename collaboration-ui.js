import {RoomClient,parseRoom,makeRoom,mergeModels} from './collaboration.js';
import {collaborationConfig} from './collaboration-config.js';
import {validate} from './engine.js';
const $=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x));
export function setupCollaboration({getModel,setModel,isDraft,lock}){
 let client=null,base=null,revision=0,dirty=false,busy=false,ready=false,conflict=false,generation=0,timer=null,stopped=false,failures=0;
 let storageKey='formula-ev-fta-v1';
 const status=s=>$('sync-status').textContent=s;
 const link=room=>location.origin+location.pathname+'#room='+room.id+'&key='+room.token;
 function roomUI(){for(const id of ['copy-room','leave-room'])$(id).hidden=!client;$('create-room').hidden=!!client;$('room-link').hidden=!client;if(client)$('room-link').value=link(client.room);}
 function backup(){try{localStorage.setItem(storageKey,JSON.stringify(getModel()));}catch{}}
 function schedule(delay=1500){clearTimeout(timer);if(!stopped&&client)timer=setTimeout(sync,delay);}
 function acceptRemote(r){validate(r.model);base=copy(r.model);revision=r.revision;setModel(copy(r.model));backup();}
 function resolveConflict(paths){conflict=true;$('conflict').hidden=false;status('競合あり · 自分の変更は保持されています');$('conflict-text').textContent='同時に変更された項目: '+paths.join('、')+'。自分の内容をJSON保存し、共有の最新版を読み込んで変更を反映し直してください。';}
 async function sync(){if(busy||!ready||conflict||stopped)return;busy=true;try{
  if(dirty){const sent=copy(getModel()),gen=generation,r=await client.write(sent,revision);validate(r.model);
   if(r.conflict){if(isDraft()){status('他の更新あり · 入力中の変更を反映するまで待機');return;}const merged=mergeModels(base,getModel(),r.model);if(merged.conflicts.length){resolveConflict(merged.conflicts);return;}base=copy(r.model);revision=r.revision;setModel(merged.model);backup();status('他の変更と統合中…');}
   else{base=copy(r.model);revision=r.revision;dirty=generation!==gen;status(dirty?'送信待ち…':'同期済み · r'+revision);}
  }else{const r=await client.read();validate(r.model);if(dirty)return;if(r.revision>revision){if(isDraft()){status('他の更新あり · 入力中の変更を反映するまで待機');return;}acceptRemote(r);}status('同期済み · r'+revision);}
 failures=0;}catch(e){failures++;status('未同期 · '+e.message+'（自動再試行します）');}finally{busy=false;schedule(failures?Math.min(30000,2000*2**Math.min(failures,4)):dirty?150:1500);}}
 async function start(room,create=false){client=new RoomClient(collaborationConfig,room);roomUI();lock(true);status(create?'共有ルームを作成中…':'共有ルームに接続中…');try{const r=create?await client.create(getModel()):await client.read();validate(r.model);storageKey='fta-room-draft:'+room.id;let draft=null;try{draft=JSON.parse(localStorage.getItem(storageKey));if(draft)validate(draft);}catch{draft=null;}acceptRemote(r);ready=true;location.hash='room='+room.id+'&key='+room.token;status('同期済み · r'+revision);if(draft&&JSON.stringify(draft)!==JSON.stringify(r.model)){$('recovery').hidden=false;$('recovery-save').onclick=()=>downloadDraft(draft);}$('recovery-close').onclick=()=>{$('recovery').hidden=true;};lock(false);schedule();}catch(e){status('接続できません: '+e.message);$('leave-room').hidden=false;}}
 function downloadDraft(m){const url=URL.createObjectURL(new Blob([JSON.stringify(m,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fta-local-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 $('create-room').onclick=async()=>{if(isDraft())return status('先に入力中の変更を反映してください');if(!confirm('現在のモデルをSupabaseに保存して共有します。共有リンクを知っている人は閲覧・編集できます。作成しますか？'))return;try{await start(makeRoom(),true);}catch(e){status(e.message);}};
 $('copy-room').onclick=async()=>{try{await navigator.clipboard.writeText($('room-link').value);status('共有リンクをコピーしました');}catch{$('room-link').select();status('リンク欄を選択しました。コピーしてください');}};
 $('leave-room').onclick=()=>{if((dirty||conflict||isDraft())&&!confirm('未同期または入力中の変更があります。必要ならJSON保存してから終了してください。個人用に戻りますか？'))return;stopped=true;clearTimeout(timer);location.hash='';location.reload();};
 $('conflict-save').onclick=()=>downloadDraft(getModel());$('conflict-latest').onclick=async()=>{if(!confirm('自分の変更を共有の最新版で置き換えます。先に必要な内容をJSON保存してください。'))return;try{const r=await client.read();acceptRemote(r);dirty=false;conflict=false;$('conflict').hidden=true;status('同期済み · r'+revision);schedule();}catch(e){status(e.message);}};
 addEventListener('beforeunload',e=>{if(dirty||conflict||isDraft()){e.preventDefault();e.returnValue='';}});
 addEventListener('hashchange',()=>{let room;try{room=parseRoom(location.hash);}catch{return;}if(room?.id!==client?.room.id||room?.token!==client?.room.token){status('共有リンクが変更されました。ページを再読込してください');}});
 let initial=null;try{initial=parseRoom(location.hash);}catch(e){status(e.message);lock(true);}if(initial)start(initial);else status('個人用 · この端末に保存');
 return {changed(){if(client){dirty=true;generation++;backup();status('送信待ち…');if(!busy)schedule(30);}},get storageKey(){return storageKey;},get active(){return !!client;}};
}
