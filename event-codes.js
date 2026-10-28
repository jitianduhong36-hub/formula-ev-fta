// Human-facing event codes are independent of stable connection / FMEA keys.
export const systems=[
 ['BAT','バッテリー・電池','バッテリ 蓄電池 accumulator battery'],['BMS','バッテリー管理','電池監視 battery management'],
 ['HV','高電圧','高圧 high voltage'],['LV','低電圧・12V電源','低圧 補機 low voltage'],['SDC','シャットダウン回路','遮断 shutdown'],
 ['INV','インバーター','インバータ inverter'],['MOT','モーター','モータ motor'],['CAN','通信','通信線 network'],
 ['SENS','センサー','センサ APPS sensor'],['COOL','冷却','冷却水 ファン cooling'],['CHG','充電','充電器 charger'],
 ['CTRL','制御','ECU VCU control'],['EVT','その他・未分類','other']
];
export const displayId=n=>n.code||n.id;
export const systemText=n=>systems.find(s=>s[0]===n.system)?.join(' ')||'';
export function nextEventCode(model,system='EVT',exceptId){
 if(!systems.some(s=>s[0]===system))throw Error('系統を選択してください');
 const used=new Set(model.nodes.filter(n=>n.id!==exceptId).map(n=>displayId(n).toUpperCase()));
 for(let i=1;i<10000;i++){const value=system+'-'+String(i).padStart(3,'0');if(!used.has(value))return value;}
 throw Error('この系統の採番上限です。表示IDを手入力してください');
}
export function validateEventCodes(model){
 const codes=new Map();for(const n of model.nodes){
  if(n.system!==undefined&&!systems.some(s=>s[0]===n.system))throw Error('系統を確認してください: '+n.id);
  if(n.code!==undefined&&(typeof n.code!=='string'||!(/^[A-Z0-9][A-Z0-9_-]{0,39}$/i.test(n.code))))throw Error('表示IDは半角英数字・ハイフン・アンダーバーで1〜40文字です');
  const key=displayId(n).toUpperCase();if(codes.has(key)&&(n.code!==undefined||codes.get(key)))throw Error('表示IDが重複しています: '+displayId(n));codes.set(key,n.code!==undefined);
 }
}
