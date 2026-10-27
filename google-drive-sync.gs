// This template contains no private key. Configure it in the private Apps Script
// project, not in the public GitHub repository. The source database remains Supabase.
var FTA_DRIVE_FOLDER='11zncejxIxqCL_KQ3NVhNfIaVGV-3nC8t';
var FTA_BACKEND='https://rcrhykdzuddvgypbqptg.supabase.co';
var FTA_PUBLIC_KEY='sb_publishable_LMeZSQNznXyT9fGJ_3kS6Q__jVoh6I0';

function setupFtaDriveSync(){
  var props=PropertiesService.getScriptProperties();
  if(!props.getProperty('FTA_EXPORT_KEY'))throw new Error('FTA_EXPORT_KEYをプロジェクトのスクリプトプロパティに設定してください。');
  DriveApp.getFolderById(FTA_DRIVE_FOLDER).getName();
  rpcFta_('activate',{});
  if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='syncFtaToDrive';}))
    ScriptApp.newTrigger('syncFtaToDrive').timeBased().everyMinutes(1).create();
  syncFtaToDrive();
  console.log('FTA自動保存を設定しました。約1分ごとに指定フォルダーへ作成・更新します。');
}
function syncFtaToDrive(){
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try{
    var jobs=rpcFta_('pull',{p_limit:5}),folder=DriveApp.getFolderById(FTA_DRIVE_FOLDER);
    jobs.forEach(function(job){
      try{
        var file=findFtaFile_(folder,job),name=ftaFileName_(job),text=JSON.stringify(job.model,null,2);
        if(!file)file=folder.createFile(Utilities.newBlob(text,'application/json',name));
        else file.setContent(text).setName(name);
        file.setDescription('FTA_ROOM:'+job.id+'\n'+String(job.model.title||'FTA')+'\nSupabase revision '+job.revision+'\nJSONバックアップ。共同編集はFTAアプリで行ってください。');
        PropertiesService.getScriptProperties().setProperty('FTA_FILE_'+job.id,file.getId());
        var ack=rpcFta_('ack',{p_id:job.id,p_lease:job.lease,p_revision:job.revision,p_file_id:file.getId(),p_error:null});
        if(!ack.accepted)throw new Error('Lease expired before acknowledgement');
      }catch(error){
        rpcFta_('ack',{p_id:job.id,p_lease:job.lease,p_revision:job.revision,p_file_id:null,p_error:String(error.message||error).slice(0,300)});
        console.error('FTA export failed for room '+job.id+': '+error.message);
      }
    });
  }finally{lock.releaseLock();}
}
function findFtaFile_(folder,job){
  var id=job.file_id||PropertiesService.getScriptProperties().getProperty('FTA_FILE_'+job.id);
  if(id){var f=DriveApp.getFileById(id);if(f.isTrashed())throw new Error('Driveファイルがゴミ箱にあります。移動先・復元を確認してください。');var ps=f.getParents(),inside=false;while(ps.hasNext())if(ps.next().getId()===FTA_DRIVE_FOLDER)inside=true;if(!inside)throw new Error('Driveファイルが指定フォルダーの外へ移動されています。');return f;}
  var files=folder.getFiles();while(files.hasNext()){var file=files.next();if((file.getDescription()||'').split('\n')[0]==='FTA_ROOM:'+job.id)return file;}return null;
}
function ftaFileName_(job){return String(job.model.title||'FTA').replace(/[\r\n/\\]/g,' ').slice(0,80)+' ['+job.id+'].json';}
function rpcFta_(name,payload){
  payload.p_key=PropertiesService.getScriptProperties().getProperty('FTA_EXPORT_KEY');
  var response=UrlFetchApp.fetch(FTA_BACKEND+'/rest/v1/rpc/fta_drive_'+name,{method:'post',contentType:'application/json',headers:{apikey:FTA_PUBLIC_KEY},payload:JSON.stringify(payload),muteHttpExceptions:true});
  var data=JSON.parse(response.getContentText());if(response.getResponseCode()>=300)throw new Error(data.message||'FTA通信エラー');return data;
}
