import {displayId} from './event-codes.js?v=codes1';
import {eventGroup,groupTheme} from './groups.js?v=codes1';
// Expand each model event only once. Other occurrences are references to the
// same ID, so every displayed branch has its own lane without changing the FTA.
export function layoutDiagram(model){
 const map=new Map(model.nodes.map(n=>[n.id,n])),expanded=new Set(),counts=new Map(),nodes=[],edges=[];
 const width=216,height=104,gap=44,row=188,pad=28;
 function build(id,depth){
  const reference=expanded.has(id),node={id,depth,reference,children:[],key:nodes.length};
  nodes.push(node);counts.set(id,(counts.get(id)||0)+1);expanded.add(id);
  if(!reference&&map.get(id).type!=='BASIC')node.children=map.get(id).children.map(child=>build(child,depth+1));
  node.span=Math.max(width,node.children.reduce((s,c)=>s+c.span,0)+Math.max(0,node.children.length-1)*gap);
  return node;
 }
 const root=build(model.top,0),canvasWidth=Math.max(760,root.span+pad*2);
 function place(n,left){
  n.x=left+n.span/2;n.y=pad+n.depth*row;
  let childLeft=left;
  n.children.forEach((c,i)=>{
   place(c,childLeft);childLeft+=c.span+gap;
   const start={x:n.x+((i+1)/(n.children.length+1)-.5)*180,y:n.y+height},end={x:c.x,y:c.y},mid=(start.y+end.y)/2;
   edges.push({parent:n.id,child:c.id,from:n.key,to:c.key,start,end,mid,
    path:`M ${start.x} ${start.y} C ${start.x} ${mid}, ${end.x} ${mid}, ${end.x} ${end.y}`});
  });
 }
 place(root,(canvasWidth-root.span)/2);
 const shared=new Map([...counts].filter(([,n])=>n>1).map(([id],i)=>[id,i+1]));
 return {nodes,edges,shared,width:canvasWidth,height:pad*2+height+Math.max(...nodes.map(n=>n.depth))*row,nodeWidth:width,nodeHeight:height};
}

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function renderDiagram(model){
 const layout=layoutDiagram(model),map=new Map(model.nodes.map(n=>[n.id,n]));
 const fmt=p=>p===0?'0':p.toPrecision(5),short=s=>[...s].length>14?[...s].slice(0,13).join('')+'…':s;
 let body=layout.edges.map(e=>`<path class="tree-edge" data-parent="${escape(e.parent)}" data-child="${escape(e.child)}" d="${e.path}" fill="none" stroke="#668c95" stroke-width="2" marker-end="url(#fta-arrow)"><title>${escape(map.get(e.parent).label+' → '+map.get(e.child).label)}</title></path>`).join('');
 for(const p of layout.nodes){
  const n=map.get(p.id),basic=n.type==='BASIC',common=layout.shared.get(n.id),group=eventGroup(model,n),theme=groupTheme(group),light=basic||p.reference||!!group;
  const lines=Array.from(n.label).join('').match(/.{1,14}/gu)||[''];
  const heading=(p.reference?'参照 · ':'')+(common?`共通${common} · `:'')+n.type+' / '+short(displayId(n));
  const footer=p.reference?(basic?'p = '+fmt(n.p)+' · 同じ事象':'同じ事象を参照（展開は別の枝）'):(basic?'p = '+fmt(n.p):n.type==='AND'?'すべての子事象':'いずれかの子事象');
  const groupLabel=group?`<text x="${p.x}" y="${p.y+14}" text-anchor="middle" font-size="10" fill="${group.color}">${escape([...group.name].slice(0,16).join('')+([...group.name].length>16?'…':''))}</text>`:'';
  body+=`<g class="node${p.reference?' reference':''}" data-id="${escape(n.id)}" data-occurrence="${p.key}" tabindex="0" role="button" aria-label="${escape(n.label+(common?' 共通事象 同じID':'')+' を編集')}"><title>${escape(displayId(n)+' / '+n.label+'（内部ID：'+n.id+'）'+(common?'：同じIDの表示です。どの箱から編集しても全ての参照に反映します。':'')+(group?' グループ：'+group.name:'')+(p.reference&&!basic?' 下位原因は最初の表示で展開しています。':''))}</title><rect x="${p.x-108}" y="${p.y}" width="216" height="104" rx="${basic?22:7}" fill="${theme?.fill||(light?'#f2faf6':'#163d45')}" stroke="${group?.color||(common?'#b57a25':light?'#8dbfaf':'#163d45')}"${p.reference?' stroke-dasharray="5 3"':''}/>${groupLabel}<text x="${p.x}" y="${p.y+(group?31:20)}" text-anchor="middle" font-size="10" fill="${light?'#08745c':'#78e1c4'}">${escape(heading)}</text>${lines.slice(0,2).map((s,i)=>`<text x="${p.x}" y="${p.y+(group?51:45)+i*17}" text-anchor="middle" font-size="12" fill="${light?'#183b40':'white'}">${escape(s)}</text>`).join('')}<text x="${p.x}" y="${p.y+89}" text-anchor="middle" font-size="10" fill="${light?'#537b70':'#b5cecf'}">${escape(footer)}</text></g>`;
 }
 const note=layout.shared.size?'共通番号・IDが同じ箱は、同じ事象です。参照の箱を分けて表示し、線の交差を避けています。':'線ごとに接続口と経路を分けています。';
 const noteLines=note.match(new RegExp(`.{1,${Math.floor((layout.width-56)/12)}}`,'gu'))||[''],svgHeight=layout.height+20+18*noteLines.length;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${svgHeight}" viewBox="0 0 ${layout.width} ${svgHeight}" font-family="sans-serif"><title>${escape(model.title||'フォールトツリー')}</title><desc>${escape(note)}</desc><defs><marker id="fta-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 6 3 L 0 6 Z" fill="#668c95"/></marker></defs><rect width="100%" height="100%" fill="white"/>${body}${noteLines.map((line,i)=>`<text x="28" y="${layout.height+18+i*18}" font-size="12" fill="#526e72">${escape(line)}</text>`).join('')}</svg>`;
 return {svg,note,layout};
}
