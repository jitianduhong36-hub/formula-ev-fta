export const draftNotice='FTA起点のFMEA下書き。網羅性・故障モードの妥当性・検出手段は人が確認すること。';
export const fmeaConfig={version:'prototype-0.1-2026-10-28',label:'暫定独自基準・要確認（規格の採点表ではありません）',maxText:500,maxParts:500,maxTargets:8,maxRows:2400,maxPathsPerRow:200,maxDetailPaths:3000,maxConditions:5,pageSize:20,
 occurrence:[{min:.1,score:10},{min:.01,score:8},{min:.001,score:6},{min:.0001,score:4},{min:.00001,score:2},{min:0,score:1}]};
export const textFields=['function','failureMode','cause','controls','detection','recommended','note'];
export function validScore(v){return Number.isInteger(v)&&v>=1&&v<=10;}
export function autoOccurrence(p){if(!Number.isFinite(p)||p<=0||p>1)return null;return fmeaConfig.occurrence.find(b=>p>=b.min).score;}
export function rpn(s,o,d){return [s,o,d].every(validScore)?s*o*d:null;}
