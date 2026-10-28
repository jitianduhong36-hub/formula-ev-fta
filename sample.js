export const sample={version:1,title:'走行中に駆動力を喪失',mission:'1走行（例示値・実測値に置換）',top:'TOP',groups:[{id:'POWER',name:'電源・高電圧',color:'#ad3d13'},{id:'CONTROL',name:'通信・制御',color:'#1565c0'},{id:'SENSOR',name:'センサー',color:'#743da6'}],nodes:[
 {id:'TOP',label:'走行中に駆動力を喪失',type:'OR',children:['HV','CTRL']},
 {id:'HV',groupId:'POWER',label:'高電圧系が遮断',type:'OR',children:['LV','SDC','AIR']},
 {id:'CTRL',groupId:'CONTROL',label:'トルク指令が停止',type:'OR',children:['LV','CAN','DUAL']},
 {id:'DUAL',groupId:'SENSOR',label:'ペダル両系統が故障',type:'AND',children:['APPS1','APPS2']},
 {id:'LV',groupId:'POWER',label:'共通12V電源の喪失',type:'BASIC',p:0.002},
 {id:'SDC',groupId:'POWER',label:'SDC配線の断線',type:'BASIC',p:0.001},
 {id:'AIR',groupId:'POWER',label:'AIRの開放故障',type:'BASIC',p:0.0005},
 {id:'CAN',groupId:'CONTROL',label:'CAN通信の喪失',type:'BASIC',p:0.0015},
 {id:'APPS1',groupId:'SENSOR',label:'APPS系統1の故障',type:'BASIC',p:0.003},
 {id:'APPS2',groupId:'SENSOR',label:'APPS系統2の故障',type:'BASIC',p:0.003}
]};
