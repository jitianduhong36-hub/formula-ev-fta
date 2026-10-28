import {validate,analyze} from './engine.js?v=fmea1';
import {eventGroup} from './groups.js?v=fmea1';
import {draftNotice,fmeaConfig,autoOccurrence,rpn,validScore} from './fmea-config.js?v=fmea1';
import {rowId} from './fmea-model.js?v=fmea1';
export function graphIndex(model){const nodes=validate(model),parents=new Map(model.nodes.map(n=>[n.id,[]]));for(const n of model.nodes)for(const id of new Set(n.children||[]))parents.get(id).push(n.id);return {nodes,parents};}
export function reachableFrom(nodes,top){const seen=new Set();function visit(id){if(seen.has(id))return;seen.add(id);for(const c of nodes.get(id).children||[])visit(c);}visit(top);return seen;}
export function extractPaths(model,basic,top,limit=fmeaConfig.maxPathsPerRow,index=graphIndex(model)){
 const {nodes,parents}=index;if(!nodes.has(top)||!nodes.has(basic))throw Error('対象ノードがありません: '+(!nodes.has(top)?top:basic));const reach=reachableFrom(nodes,top),memo=new Map();
 function count(id){if(!reach.has(id))return 0n;if(id===top)return 1n;if(memo.has(id))return memo.get(id);const c=parents.get(id).reduce((s,p)=>s+count(p),0n);memo.set(id,c);return c;}
 const total=count(basic),paths=[];function walk(id,trail){if(paths.length>=limit)return;if(id===top){paths.push(trail);return;}for(const p of parents.get(id))if(count(p)>0n)walk(p,[...trail,p]);}
 if(total>0n&&limit>0)walk(basic,[basic]);return {paths,total:total.toString(),omitted:(total-BigInt(paths.length)).toString(),truncated:total>BigInt(paths.length)};
}
function stable(x){if(Array.isArray(x))return '['+x.map(stable).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';return JSON.stringify(x);}
async function hash(x){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(x))))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const label=(nodes,id)=>nodes.get(id)?.label||id;
export function coverageGaps(model,reachable){const parts=model.fmea?.parts||[],map=new Map(model.nodes.map(n=>[n.id,n])),gaps=[];
 if(!parts.length)gaps.push({id:'',name:'部品一覧未入力',status:'判定不可',detail:'部品一覧が未入力のため網羅性を判定できません。'});
 for(const p of parts){const basics=p.basicIds.filter(id=>map.get(id)?.type==='BASIC'),connected=basics.filter(id=>reachable.has(id));gaps.push({id:p.id,name:p.name||p.id,status:!basics.length?'FMEA未カバー':!connected.length?'トップ未接続':'関連事象あり・故障モード網羅性は未確認',detail:(!basics.length?'明示対応の基本事象なし':connected.length+'件接続 / '+basics.length+'件対応')+(p.basicIds.some(id=>!map.has(id))?'。削除済み・不明な対応IDあり':''),basicIds:basics});}
 for(const n of model.nodes)if(n.type==='BASIC'&&!reachable.has(n.id))gaps.push({id:n.id,name:n.label,status:'トップ未接続',detail:'選択した対象トップへ接続していない基本事象'});
 return gaps;
}
export async function generateFmea(model,options={}){
 const index=graphIndex(model),{nodes,parents}=index,targets=[...new Set(options.targetIds||model.fmea?.targetIds||[model.top])];if(!targets.length||targets.length>fmeaConfig.maxTargets)throw Error('対象トップは1〜8件を選択してください');for(const t of targets)if(!nodes.has(t))throw Error('FMEAの対象トップが削除されています。対象設定を選び直してください: '+t);
 const cfg={...fmeaConfig,...options},rows=[],details=[],cutSets=[],warnings=[],union=new Set();let budget=cfg.maxDetailPaths;
 for(const top of targets){const reach=reachableFrom(nodes,top);reach.forEach(id=>union.add(id));const analysis=options.analyzeTop?options.analyzeTop({...model,top}):analyze({...model,top});const cutError=analysis.cutError;
  const cuts=(analysis.cutSets||[]).map(c=>({...c,ids:[...c.ids].sort(),id:'CS:'+encodeURIComponent(top)+':'+encodeURIComponent(JSON.stringify([...c.ids].sort()))})).sort((a,b)=>a.ids.length-b.ids.length||a.id.localeCompare(b.id));for(const c of cuts)cutSets.push({...c,topId:top,top:label(nodes,top),names:c.ids.map(id=>label(nodes,id))});if(cutError)warnings.push(label(nodes,top)+'：カットセット未完了（'+cutError+'）');
  for(const basic of model.nodes.filter(n=>n.type==='BASIC'&&reach.has(n.id))){const id=rowId(basic.id,top),manual=model.fmea?.rows?.[id]||{},ownCuts=cuts.filter(c=>c.ids.includes(basic.id)),single=cutError?null:ownCuts.some(c=>c.ids.length===1),conditional=!cutError&&!single&&ownCuts.length>0;
   const pathResult=extractPaths(model,basic.id,top,Math.max(0,Math.min(cfg.maxPathsPerRow,budget)),index);budget-=pathResult.paths.length;
   const ancestor=new Set();function up(id){if(ancestor.has(id)||!reach.has(id))return;ancestor.add(id);if(id!==top)parents.get(id).forEach(up);}up(basic.id);
   const localParents=parents.get(basic.id).filter(id=>ancestor.has(id)),localEffect=basic.id===top?'基本事象が対象トップと同一':localParents.map(id=>{const n=nodes.get(id);return n.label+(n.type==='AND'?'【AND・追加の子事象も必要：'+n.children.filter(c=>c!==basic.id).map(c=>label(nodes,c)).join(' ＋ ')+'】':'【OR】');}).join('\n');
   const pathText=pathResult.paths.map(p=>p.map(id=>label(nodes,id)).join(' → '));
   const conditions=conditional?ownCuts.slice(0,cfg.maxConditions).map(c=>c.ids.filter(id=>id!==basic.id).map(id=>label(nodes,id)).join(' ＋ ')).join(' または ')+(ownCuts.length>cfg.maxConditions?'／ほか'+(ownCuts.length-cfg.maxConditions)+'件':''):'';
   const flag=cutError?'未確定(上限到達)':single?'単一故障点(FTAモデル上)':conditional?'冗長性喪失/劣化の候補・実機要確認':'該当なし（論理吸収等を要確認）';
   const ps=(model.fmea?.parts||[]).filter(p=>p.basicIds.includes(basic.id)),s=validScore(manual.S)?manual.S:model.fmea?.topSeverity?.[top]??null,autoO=autoOccurrence(basic.p),o=validScore(manual.O)?manual.O:autoO,d=validScore(manual.D)?manual.D:null;
   const reviewSource={basic:{id:basic.id,label:basic.label,p:basic.p,group: eventGroup(model,basic)?.name||''},top,mission:model.mission||'',ancestors:[...ancestor].sort().map(id=>{const n=nodes.get(id);return {id,label:n.label,type:n.type,children:[...new Set(n.children||[])].sort()};}),cuts:ownCuts.map(c=>({ids:c.ids,names:c.ids.map(id=>label(nodes,id))})),cutError:cutError||null,parts:ps,rule:cfg.version};
   const sourceHash=await hash(reviewSource),review=manual.reviewedHash===sourceHash?'確認済み':manual.reviewedHash?'再確認が必要':'未確認';
   const notes=[flag,conditions?'追加条件：'+conditions:'',BigInt(pathResult.total)>1n?'共通原因の可能性・複数経路あり':'',pathResult.truncated?'経路詳細は一部省略（全'+pathResult.total+'件中'+pathResult.paths.length+'件、ほか'+pathResult.omitted+'件）':'',basic.p===0?'p=0：要確認・未採点（手入力Oがあれば別表示）':'',!model.mission||model.mission.includes('未設定')?'評価期間未設定・要確認':'',!ps.length?'部品対応未入力':'',!manual.failureMode?'故障モードはFTA名称からの候補・妥当性要確認':'',review,manual.note||''].filter(Boolean);
   const row={id,basicId:basic.id,topId:top,top:label(nodes,top),basicLabel:basic.label,p:basic.p,mission:model.mission||'',group:eventGroup(model,basic)?.name||'未分類',groupId:basic.groupId||'',parts:ps.map(p=>[p.id,p.name,p.subsystem].filter(Boolean).join(' / ')).join('\n'),function:manual.function||'',failureMode:manual.failureMode||basic.label,cause:manual.cause||'',localEffect,upperEffect:pathText.join('\n')+(pathResult.truncated?'\n一部省略。経路の中間事象：'+[...ancestor].filter(id=>id!==basic.id&&id!==top).map(id=>label(nodes,id)).join('、'):''),endEffect:label(nodes,top)+(cutError?'（到達条件未確定）':single?'（単独で成立）':conditional?'（追加条件付き）':'（単独到達なし・寄与を要確認）'),S:s,O:o,D:d,autoO,rpn:rpn(s,o,d),sSource:validScore(manual.S)?'手入力':s!==null?'トップ設定（手入力）':'未入力',oSource:validScore(manual.O)?'手入力':autoO!==null?'自動算出（暫定・要確認）':'要確認・未採点',dSource:d===null?'未入力':'手入力',controls:manual.controls||'',detection:manual.detection||'',recommended:manual.recommended||'',note:manual.note||'',notes:notes.join('\n'),single,flag,conditions,cutIds:ownCuts.map(c=>c.id),review,sourceHash,pathCount:pathResult.total,pathsTruncated:pathResult.truncated};rows.push(row);
   if(pathResult.truncated)warnings.push(row.id+'：経路詳細を一部省略');for(const p of pathResult.paths){const gates=p.slice(1).map((id,i)=>{const n=nodes.get(id);return n.type==='AND'?n.label+'：他に '+n.children.filter(c=>c!==p[i]).map(c=>label(nodes,c)).join(' ＋ ')+' が必要':n.label+'：OR';});details.push({rowId:id,ids:p,text:p.map(id=>label(nodes,id)).join(' → '),conditions:gates.join('\n'),total:pathResult.total,truncated:pathResult.truncated});}
   if(pathResult.truncated)details.push({rowId:id,ids:[],text:'一部省略：ほか'+pathResult.omitted+'経路',conditions:'行生成は継続。上限値はfmea-config.jsで設定。',total:pathResult.total,truncated:true});
  }
 }
 const existing=new Set(rows.map(r=>r.id)),orphans=Object.entries(model.fmea?.rows||{}).filter(([id])=>!existing.has(id)).map(([id,data])=>({id,data,status:'孤立した行（削除済み／対象外）。手入力は保持。'}));
 return {draftNotice,config:cfg,rows,details,cutSets,gaps:coverageGaps(model,union),orphans,warnings,targets,mission:model.mission||'',title:model.title||''};
}
