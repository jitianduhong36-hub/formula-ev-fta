import {fmeaConfig,textFields,validScore} from './fmea-config.js?v=fmea1';
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x)),object=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function rowId(basic,top){return 'FM:'+encodeURIComponent(basic)+'@'+encodeURIComponent(top);}
export function splitRowId(id){const m=/^FM:([^@]+)@([^@]+)$/.exec(id);try{return m?{basicId:decodeURIComponent(m[1]),topId:decodeURIComponent(m[2])}:null;}catch{return null;}}
export function ensureFmea(model){const next=copy(model);next.fmea={schema:1,...next.fmea,topSeverity:{...next.fmea?.topSeverity},parts:copy(next.fmea?.parts||[]),rows:{...next.fmea?.rows}};return next;}
export function validateFmea(model){const f=model.fmea;if(f===undefined)return;if(!object(f)||f.schema!==1)throw Error('FMEA情報の形式が不正です');
 if(f.targetIds!==undefined&&(!Array.isArray(f.targetIds)||!f.targetIds.length||f.targetIds.length>fmeaConfig.maxTargets||f.targetIds.some(x=>typeof x!=='string'||x.length>80)))throw Error('FMEA対象トップは1〜8件で指定してください');
 if(f.topSeverity!==undefined){if(!object(f.topSeverity))throw Error('重大度設定が不正です');for(const v of Object.values(f.topSeverity))if(v!==null&&!validScore(v))throw Error('Sは1〜10の整数です');}
 if(f.rows!==undefined){if(!object(f.rows)||Object.keys(f.rows).length>fmeaConfig.maxRows)throw Error('FMEA保存行数の上限です');for(const [id,row]of Object.entries(f.rows)){if(!splitRowId(id)||!object(row))throw Error('FMEA行ID・情報が不正です');for(const k of textFields)if(row[k]!==undefined&&(typeof row[k]!=='string'||row[k].length>fmeaConfig.maxText))throw Error(k+'は500文字以内で入力してください');for(const k of ['S','O','D'])if(row[k]!==undefined&&row[k]!==null&&!validScore(row[k]))throw Error('S/O/Dは1〜10の整数、未入力は空欄にしてください');if(row.reviewedHash!==undefined&&(typeof row.reviewedHash!=='string'||row.reviewedHash.length>100))throw Error('確認済み情報が不正です');}}
 if(f.parts!==undefined){if(!Array.isArray(f.parts)||f.parts.length>fmeaConfig.maxParts)throw Error('部品一覧は最大500件です');const ids=new Set();for(const p of f.parts){if(!object(p)||typeof p.id!=='string'||!p.id.trim()||p.id.length>80||ids.has(p.id))throw Error('部品IDは重複せず80文字以内で入力してください');ids.add(p.id);for(const k of ['name','subsystem','function'])if(p[k]!==undefined&&(typeof p[k]!=='string'||p[k].length>500))throw Error('部品の記述は500文字以内です');if(!Array.isArray(p.basicIds)||p.basicIds.length>300||p.basicIds.some(x=>typeof x!=='string'||x.length>80))throw Error('部品に対応する基本事象IDが不正です');}}
}
// Merge keyed records recursively: independent row/field edits compose. Arrays
// (including each part's explicit mappings) are atomic so conflicts stay visible.
export function mergeFmea(base,local,remote,field){
 function merge(b,l,r,path){if((b===undefined||object(b))&&object(l)&&object(r)){const out={};for(const k of new Set([...Object.keys(r),...Object.keys(l),...Object.keys(b||{})])){const v=merge(b?.[k],l[k],r[k],path+'.'+k);if(v!==undefined)Object.defineProperty(out,k,{value:v,enumerable:true,writable:true,configurable:true});}return out;}return field(b,l,r,path);}
 if(base===undefined&&local===undefined&&remote===undefined)return undefined;
 const b=base||{},l=local||{},r=remote||{};const out=merge({...b,parts:undefined},{...l,parts:undefined},{...r,parts:undefined},'fmea');
 const maps=[b,l,r].map(f=>new Map((f.parts||[]).map(p=>[p.id,p]))),parts=[];for(const id of new Set([...maps[2].keys(),...maps[1].keys(),...maps[0].keys()])){const [pb,pl,pr]=maps.map(m=>m.get(id)),p=merge(pb,pl,pr,'fmea.parts.'+id);if(p)parts.push(copy(p));}out.parts=parts;
 return out;
}
