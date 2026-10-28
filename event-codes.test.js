import test from 'node:test';
import assert from 'node:assert/strict';
import {sample} from './sample.js';
import {analyze,validate} from './engine.js';
import {nextEventCode} from './event-codes.js';
import {matchesEvent} from './groups.js';
import {addChild} from './sheets.js';
import {generateFmea} from './fmea-engine.js';
import {mergeModels} from './collaboration.js';
test('human code changes preserve shared connections, probability and FMEA manual keys',async()=>{
 const m=structuredClone(sample),before=analyze(m);m.fmea={schema:1,rows:{'FM:LV@TOP':{D:4,note:'保持'}},parts:[],topSeverity:{}};
 Object.assign(m.nodes.find(n=>n.id==='LV'),{code:'BAT-001',system:'BAT'});validate(m);
 assert.equal(analyze(m).q,before.q);assert.deepEqual(analyze(m).cutSets,before.cutSets);
 const r=(await generateFmea(m)).rows.find(r=>r.basicId==='LV');assert.equal(r.id,'FM:LV@TOP');assert.equal(r.D,4);assert.equal(r.note,'保持');assert.equal(r.eventCode,'BAT-001');
 for(const q of ['電池','バッテリ','battery','bat001','ＢＡＴ－００１'])assert.ok(matchesEvent(m,m.nodes.find(n=>n.id==='LV'),q),q);
});
test('codes skip used display IDs, reject duplicates and invalid symbols',()=>{
 const m=structuredClone(sample);Object.assign(m.nodes[0],{code:'BAT-001',system:'BAT'});assert.equal(nextEventCode(m,'BAT'),'BAT-002');
 m.nodes[1].code='bat-001';assert.throws(()=>validate(m),/重複/);m.nodes[1].code='bad id';assert.throws(()=>validate(m),/表示ID/);
});
test('new child and gate leaf inherit explicit system with separate codes',()=>{
 const m=structuredClone(sample);m.nodes[0].system='BAT';m.nodes[0].code='BAT-001';const r=addChild(m,'TOP','AND');const gate=r.model.nodes.find(n=>n.id===r.id),leaf=r.model.nodes.find(n=>n.id===gate.children[0]);assert.equal(gate.code,'BAT-002');assert.equal(leaf.code,'BAT-003');assert.equal(leaf.system,'BAT');
});
test('concurrent code collision is surfaced as conflict instead of silently duplicated',()=>{
 const b=structuredClone(sample),l=structuredClone(b),r=structuredClone(b);l.nodes[1].code='CAN-001';r.nodes[2].code='CAN-001';assert.ok(mergeModels(b,l,r).conflicts.length);
});
