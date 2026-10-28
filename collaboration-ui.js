import {RoomClient,parseRoom,makeRoom,mergeModels} from './collaboration.js?v=fmea1';
import {collaborationConfig} from './collaboration-config.js?v=fmea1';
import {validate} from './engine.js?v=fmea1';
import {localKey} from './sheets.js?v=fmea1';
import {setupDriveStatus} from './drive-ui.js?v=fmea1';
const $=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x));
export function setupCollaboration({getModel,setModel,isDraft,lock,onSaved=()=>{}}){
 let client=null,base=null,revision=0,dirty=false,busy=false,ready=false,conflict=false,generation=0,timer=null,stopped=false,failures=0;
 let storageKey=localKey(location.hash),pingTimer=null,pinging=false,checkedAt=null,driveStatus=null;
 const clientId=crypto.randomUUID();let displayName='編集者-'+clientId.slice(0,4);try{displayName=localStorage.getItem('fta-display-name')||displayName;}catch{}
 $('display-name').value=displayName;
 function savedState(){ $('cloud-state').textContent=!client?'端末内保存（クラウド未保存）':!ready?'クラウド接続中':conflict?'競合あり · 自分の変更は未保存':dirty?'クラウド送信待ち':isDraft()?'入力中 · 「変更を反映」で保存':'クラウド保存済み · r'+revision; $('cloud-check').textContent=checkedAt?'最終クラウド確認 '+checkedAt.toLocaleTimeString('ja-JP'):'';}
 const status=s=>{$('sync-status').textContent=s;savedState();};
 function checked(){checkedAt=new Date();savedState();}
 const link=room=>location.origin+location.pathname+'#room='+room.id+'&key='+room.token;
 function roomUI(){for(const id of ['copy-room','leave-room','sync-now','presence-panel'])$(id).hidden=!client;$('create-room').hidden=!!client;$('room-link').hidden=!client;if(client){$('room-link').value=link(client.room);$('sheet-identity').textContent='共有シートID: '+client.room.id.slice(0,8);}}
 function backup(){try{localStorage.setItem(storageKey,JSON.stringify(getModel()));}catch{}}
 function schedule(delay=1500){clearTimeout(timer);if(!stopped&&client)timer=setTimeout(sync,delay);}
 function acceptRemote(r){validate(r.model);base=copy(r.model);revision=r.revision;setModel(copy(r.model));backup();checked();onSaved(true);}
 async function ping(){if(pinging||!ready||stopped)return;pinging=true;try{const r=await client.rpc('presence_ping',{p_client:clientId,p_name:displayName,p_seen:revision,p_state:conflict?'conflict':dirty?'saving':isDraft()?'editing':'synced'});const others=r.peers.filter(p=>p.client!==clientId);$('presence-summary').textContent='接続中 '+r.peers.length+'画面（自分を含む）';$('peer-list').replaceChildren();for(const p of others){const line=document.createElement('div');line.textContent=p.name+' · '+(p.state==='conflict'?'競合を解決中':p.state==='editing'?'入力中':p.state==='saving'?'保存中':p.seen>=revision?'最新版 r'+revision+' を受信済み':'r'+p.seen+' を受信 · 更新待ち');$('peer-list').append(line);}$('presence-note').textContent=others.length?others.every(p=>p.seen>=revision)?'接続中のほかの画面が、この版を受信したことを確認しました（人が読んだことは示しません）。':'相手の受信を待っています。入力中・通信状況により反映が遅れる場合があります。':'ほかの参加者はまだ確認できません。同じ共有リンクを送って開いてもらってください。';}catch{$('presence-summary').textContent='参加状況を確認できません（再確認します）';}finally{pinging=false;clearTimeout(pingTimer);if(!stopped)pingTimer=setTimeout(ping,3000);}}
 function resolveConflict(paths){conflict=true;$('conflict').hidden=false;status('競合あり · 自分の変更は保持されています');$('conflict-text').textContent='同時に変更された項目: '+paths.join('、')+'。自分の内容をJSON保存し、共有の最新版を読み込んで変更を反映し直してください。';}
 async function sync(){if(busy||!ready||conflict||stopped)return;busy=true;try{
  if(dirty){const sent=copy(getModel()),gen=generation,r=await client.write(sent,revision);validate(r.model);
   if(r.conflict){if(isDraft()){status('他の更新あり · 入力中の変更を反映するまで待機');return;}const merged=mergeModels(base,getModel(),r.model);if(merged.conflicts.length){resolveConflict(merged.conflicts);return;}base=copy(r.model);revision=r.revision;setModel(merged.model);backup();status('他の変更と統合中…');}
   else{base=copy(r.model);revision=r.revision;dirty=generation!==gen;checked();onSaved(true);status(dirty?'送信待ち…':'同期済み · r'+revision);}
  }else{const r=await client.read();validate(r.model);checked();if(dirty)return;if(r.revision>revision){if(isDraft()){status('他の更新あり · 入力中の変更を反映するまで待機');return;}acceptRemote(r);}status('同期済み · r'+revision);}
 failures=0;}catch(e){failures++;status('未同期 · '+e.message+'（自動再試行します）');}finally{busy=false;schedule(failures?Math.min(30000,2000*2**Math.min(failures,4)):dirty?150:1500);}}
 async function start(room,create=false){client=new RoomClient(collaborationConfig,room);roomUI();lock(true);status(create?'共有ルームを作成中…':'共有ルームに接続中…');try{const r=create?await client.create(getModel()):await client.read();validate(r.model);storageKey='fta-room-draft:'+room.id;let draft=null;try{draft=JSON.parse(localStorage.getItem(storageKey));if(draft)validate(draft);}catch{draft=null;}acceptRemote(r);ready=true;location.hash='room='+room.id+'&key='+room.token;status('同期済み · r'+revision);if(draft&&JSON.stringify(draft)!==JSON.stringify(r.model)){$('recovery').hidden=false;$('recovery-save').onclick=()=>downloadDraft(draft);}$('recovery-close').onclick=()=>{$('recovery').hidden=true;};lock(false);onSaved(true);driveStatus=setupDriveStatus(client,()=>ready&&!stopped);ping();schedule();}catch(e){status('接続できません: '+e.message);$('leave-room').hidden=false;}}
 function downloadDraft(m){const url=URL.createObjectURL(new Blob([JSON.stringify(m,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fta-local-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 $('create-room').onclick=async()=>{if(isDraft())return status('先に入力中の変更を反映してください');if(!confirm('現在のモデルをSupabaseに保存して共有します。共有リンクを知っている人は閲覧・編集できます。作成しますか？'))return;try{await start(makeRoom(),true);}catch(e){status(e.message);}};
 $('copy-room').onclick=async()=>{try{await navigator.clipboard.writeText($('room-link').value);status('共有リンクをコピーしました');}catch{$('room-link').select();status('リンク欄を選択しました。コピーしてください');}};
 $('display-name').onchange=()=>{displayName=$('display-name').value.trim().slice(0,32)||'編集者-'+clientId.slice(0,4);$('display-name').value=displayName;try{localStorage.setItem('fta-display-name',displayName);}catch{}ping();};
 $('sync-now').onclick=()=>{if(conflict)return status('競合を解決してから同期してください');sync();ping();};
 $('leave-room').onclick=()=>{if((dirty||conflict||isDraft())&&!confirm('未同期または入力中の変更があります。必要ならJSON保存してから終了してください。個人用に戻りますか？'))return;stopped=true;clearTimeout(timer);location.href=location.origin+location.pathname;location.reload();};
 $('conflict-save').onclick=()=>downloadDraft(getModel());$('conflict-latest').onclick=async()=>{if(!confirm('自分の変更を共有の最新版で置き換えます。先に必要な内容をJSON保存してください。'))return;try{const r=await client.read();acceptRemote(r);dirty=false;conflict=false;$('conflict').hidden=true;status('同期済み · r'+revision);schedule();}catch(e){status(e.message);}};
 addEventListener('beforeunload',e=>{if(dirty||conflict||isDraft()){e.preventDefault();e.returnValue='';}});
 addEventListener('hashchange',()=>{let room;try{room=parseRoom(location.hash);}catch{return;}if(room?.id!==client?.room.id||room?.token!==client?.room.token){status('共有リンクが変更されました。ページを再読込してください');}});
 let initial=null;try{initial=parseRoom(location.hash);}catch(e){status(e.message);lock(true);}if(initial)start(initial);else if(new URLSearchParams(location.hash.slice(1)).get('createcloud')==='1')start(makeRoom(),true);else status('個人用 · この端末に保存');
 return {changed(){if(client){dirty=true;generation++;backup();status('送信待ち…');if(!busy)schedule(30);}},draftChanged(){savedState();},get unsaved(){return dirty||conflict||isDraft();},get storageKey(){return storageKey;},get active(){return !!client;}};
}
