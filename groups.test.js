import test from 'node:test';import assert from 'node:assert/strict';
import {saveGroup,removeGroup,matchesEvent} from './groups.js';import {validate,analyze} from './engine.js';
import {mergeModels} from './collaboration.js';import {renderDiagram} from './diagram.js';
const base=()=>({version:1,title:'test',top:'T',nodes:[{id:'T',label:'top',type:'OR',children:['A','B']},{id:'A',label:'CAN通信喪失',type:'BASIC',p:.1},{id:'B',label:'電源喪失',type:'BASIC',p:.2}]});
const blue={id:'G1',name:'通信系',color:'#1565c0'},orange={id:'G2',name:'電源系',color:'#ad3d13'};
test('groups survive JSON and leave probabilities and cut sets unchanged',()=>{
 const b=base(),m=saveGroup(b,blue,'A');assert.equal(b.groups,undefined);validate(m);const restored=JSON.parse(JSON.stringify(m));validate(restored);
 assert.deepEqual(analyze(restored),analyze(b));assert.equal(restored.nodes[1].groupId,'G1');
 const svg=renderDiagram(restored).svg;assert.match(svg,/通信系/);assert.match(svg,/#eaf2ff/);assert.match(svg,/#1565c0/);
 const removed=removeGroup(restored,'G1');validate(removed);assert.equal(removed.nodes[1].groupId,undefined);assert.equal(restored.nodes[1].groupId,'G1');assert.deepEqual(removed.nodes[0].children,['A','B']);
});
test('group search accepts partial names, IDs, fullwidth and multiple tokens',()=>{
 const m=saveGroup(base(),blue,'A'),a=m.nodes[1];assert.ok(matchesEvent(m,a,'ｃａｎ 通信系'));assert.ok(matchesEvent(m,a,'Ａ'));assert.ok(matchesEvent(m,a,'喪失'));assert.ok(!matchesEvent(m,a,'電源系'));assert.ok(matchesEvent(m,a,''));
});
test('group metadata validates references, names and safe palette colors',()=>{
 const m=saveGroup(base(),blue,'A');assert.throws(()=>saveGroup(m,{...orange,name:'通信系'}));assert.throws(()=>saveGroup(m,{...orange,color:'url(javascript:bad)'}));assert.throws(()=>saveGroup(m,{...orange,name:'   '}));
 const bad=base();bad.nodes[1].groupId='missing';assert.throws(()=>validate(bad));
 const evil=saveGroup(base(),{...blue,name:'<script>&"'},'A');const svg=renderDiagram(evil).svg;assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));
});
test('independent group creation and event edits merge',()=>{
 const b=base(),l=saveGroup(b,blue,'A'),r=saveGroup(b,orange,'B');r.nodes[2].p=.4;
 const merged=mergeModels(b,l,r);assert.deepEqual(merged.conflicts,[]);assert.equal(merged.model.groups.length,2);assert.equal(merged.model.nodes[1].groupId,'G1');assert.equal(merged.model.nodes[2].groupId,'G2');assert.equal(merged.model.nodes[2].p,.4);
});
test('group name and color merge separately; concurrent color edits conflict',()=>{
 const b=saveGroup(base(),blue,'A'),l=structuredClone(b),r=structuredClone(b);l.groups[0].name='CAN系';r.groups[0].color='#28743b';
 const merged=mergeModels(b,l,r);assert.deepEqual(merged.conflicts,[]);assert.equal(merged.model.groups[0].name,'CAN系');assert.equal(merged.model.groups[0].color,'#28743b');l.groups[0].color='#743da6';assert.ok(mergeModels(b,l,r).conflicts.includes('group.G1.color'));
});
test('group deletion versus a new assignment is reported instead of losing metadata',()=>{
 const b=saveGroup(base(),blue,'A'),l=removeGroup(b,'G1'),r=structuredClone(b);r.nodes[2].groupId='G1';const merged=mergeModels(b,l,r);assert.ok(merged.conflicts.some(c=>c.includes('グループ')));
});
