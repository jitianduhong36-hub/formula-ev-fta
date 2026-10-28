export const groupColors=[
 {color:'#1565c0',fill:'#eaf2ff',name:'青'}, {color:'#ad3d13',fill:'#fff0e8',name:'橙'},
 {color:'#28743b',fill:'#eaf7ed',name:'緑'}, {color:'#743da6',fill:'#f4edff',name:'紫'},
 {color:'#b12b62',fill:'#ffeef5',name:'桃'}, {color:'#007779',fill:'#e6f8f7',name:'青緑'},
 {color:'#806000',fill:'#fff8d9',name:'黄'}, {color:'#52616b',fill:'#edf1f4',name:'灰'}
];
const clone=m=>JSON.parse(JSON.stringify(m));
export const eventGroup=(m,n)=>(m.groups||[]).find(g=>g.id===n.groupId);
export const groupTheme=g=>groupColors.find(c=>c.color===g?.color);
export function matchesEvent(m,n,query=''){
 const norm=s=>String(s).normalize('NFKC').toLocaleLowerCase('ja');
 const hay=norm([n.id,n.label,n.type,eventGroup(m,n)?.name||'未分類'].join(' '));
 return norm(query).trim().split(/\s+/u).every(word=>hay.includes(word));
}
export function validateGroups(m){
 if(m.groups!==undefined&&(!Array.isArray(m.groups)||m.groups.length>40))throw Error('グループは最大40件です');
 const ids=new Set(),names=new Set();for(const g of m.groups||[]){
  if(!g||typeof g.id!=='string'||!g.id||g.id.length>80||ids.has(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>40||!groupTheme(g))throw Error('グループのID・名称・色を確認してください');
  const name=g.name.trim().normalize('NFKC').toLocaleLowerCase('ja');if(names.has(name))throw Error('同じ名前のグループがあります');ids.add(g.id);names.add(name);
 }
 for(const n of m.nodes)if(n.groupId!==undefined&&(typeof n.groupId!=='string'||!ids.has(n.groupId)))throw Error('事象のグループが見つかりません: '+n.id);
}
export function saveGroup(model,group,assignId){
 const m=clone(model);m.groups=m.groups||[];const i=m.groups.findIndex(g=>g.id===group.id),g={...group,name:group.name.trim()};
 if(i<0)m.groups.push(g);else m.groups[i]=g;
 if(assignId){const n=m.nodes.find(n=>n.id===assignId);if(!n)throw Error('割り当てる事象が見つかりません');n.groupId=g.id;}
 validateGroups(m);return m;
}
export function removeGroup(model,id){const m=clone(model);m.groups=(m.groups||[]).filter(g=>g.id!==id);for(const n of m.nodes)if(n.groupId===id)delete n.groupId;return m;}
