import test from 'node:test';import assert from 'node:assert/strict';
import {layoutDiagram,renderDiagram} from './diagram.js';import {sample} from './sample.js';import {analyze} from './engine.js';

test('shared causes get separate branch occurrences without changing the analysis',()=>{
 const before=JSON.stringify(sample),q=analyze(sample).q,l=layoutDiagram(sample);
 const lv=l.nodes.filter(n=>n.id==='LV');assert.equal(lv.length,2);assert.equal(lv.filter(n=>n.reference).length,1);
 assert.notEqual(lv[0].x,lv[1].x);assert.equal(l.shared.size,1);
 assert.equal(JSON.stringify(sample),before);assert.equal(analyze(sample).q,q);
 const svg=renderDiagram(sample).svg;assert.match(svg,/参照 · 共通1/);assert.match(svg,/marker-end/);
});

test('curved sibling paths remain separate and never pass through another box',()=>{
 const l=layoutDiagram(sample);assert.equal(new Set(l.edges.map(e=>e.path)).size,l.edges.length);
 for(const e of l.edges){
  const from=l.nodes[e.from],to=l.nodes[e.to];assert.equal(to.depth,from.depth+1);
  for(let k=1;k<100;k++){
   const t=k/100,u=1-t;
   const x=u*u*u*e.start.x+3*u*u*t*e.start.x+3*u*t*t*e.end.x+t*t*t*e.end.x;
   const y=u*u*u*e.start.y+3*u*u*t*e.mid+3*u*t*t*e.mid+t*t*t*e.end.y;
   assert.ok(!l.nodes.some(n=>x>n.x-108&&x<n.x+108&&y>n.y&&y<n.y+104));
  }
 }
 for(let i=0;i<l.nodes.length;i++)for(let j=i+1;j<l.nodes.length;j++){
  const a=l.nodes[i],b=l.nodes[j];if(a.depth===b.depth)assert.ok(Math.abs(a.x-b.x)>=260);
 }
});

test('shared gates expand once and remain bounded for a dense DAG',()=>{
 const nodes=Array.from({length:20},(_,i)=>({id:'G'+i,label:'ゲート'+i,type:'OR',children:Array.from({length:19-i},(_,k)=>'G'+(i+k+1))}));
 nodes[19]={id:'G19',label:'基本',type:'BASIC',p:.01};const m={version:1,top:'G0',nodes};
 const l=layoutDiagram(m);assert.equal(l.edges.length,190);assert.equal(l.nodes.length,191);
 assert.equal(l.nodes.filter(n=>!n.reference).length,20);
});

test('single top, long names and XML characters export correctly',()=>{
 const r=renderDiagram({version:1,top:'A<&',nodes:[{id:'A<&',label:'故障<「&」>😀',type:'BASIC',p:0}]});
 assert.equal(r.layout.edges.length,0);assert.match(r.svg,/A&lt;&amp;/);assert.match(r.svg,/故障&lt;/);assert.ok(!r.svg.includes('NaN'));
});
