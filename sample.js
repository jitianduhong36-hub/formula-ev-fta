export const sample={version:1,title:'走行中に駆動力を喪失',mission:'1走行（例示値・実測値に置換）',top:'TOP',nodes:[
 {id:'TOP',label:'走行中に駆動力を喪失',type:'OR',children:['HV','CTRL']},
 {id:'HV',label:'高電圧系が遮断',type:'OR',children:['LV','SDC','AIR']},
 {id:'CTRL',label:'トルク指令が停止',type:'OR',children:['LV','CAN','DUAL']},
 {id:'DUAL',label:'ペダル両系統が故障',type:'AND',children:['APPS1','APPS2']},
 {id:'LV',label:'共通12V電源の喪失',type:'BASIC',p:0.002},
 {id:'SDC',label:'SDC配線の断線',type:'BASIC',p:0.001},
 {id:'AIR',label:'AIRの開放故障',type:'BASIC',p:0.0005},
 {id:'CAN',label:'CAN通信の喪失',type:'BASIC',p:0.0015},
 {id:'APPS1',label:'APPS系統1の故障',type:'BASIC',p:0.003},
 {id:'APPS2',label:'APPS系統2の故障',type:'BASIC',p:0.003}
]};
