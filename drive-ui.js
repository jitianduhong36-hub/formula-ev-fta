export function describeDrive(s,now=Date.now()){
 if(!s.enabled)return 'Google Drive：初期設定待ち';
 if(!s.enrolled)return 'Google Drive：このシートは未登録';
 if(s.error)return 'Google Drive：保存エラー（自動再試行） '+s.error;
 if(!s.worker_seen||now-new Date(s.worker_seen).getTime()>5*60*1000)return 'Google Drive：自動保存の実行確認が途切れています';
 if(s.saved>=s.requested&&s.saved>0)return 'Google Drive 保存済み · r'+s.saved;
 return 'Google Drive：保存待ち（通常は約1分ごとに処理）';
}
export function setupDriveStatus(client,isReady){
 const state=document.getElementById('drive-state'),file=document.getElementById('drive-file'),enroll=document.getElementById('drive-enroll');let busy=false,timer;
 async function refresh(){if(!isReady())return;document.getElementById('drive-panel').hidden=false;if(busy)return;busy=true;try{const s=await client.rpc('drive_status');state.textContent=describeDrive(s);file.hidden=!s.file_id;if(s.file_id&&/^[A-Za-z0-9_-]{10,200}$/.test(s.file_id))file.href='https://drive.google.com/file/d/'+s.file_id+'/view';enroll.hidden=s.enrolled;enroll.disabled=!s.enabled;}catch{state.textContent='Google Drive：状態を確認できません';}finally{busy=false;clearTimeout(timer);timer=setTimeout(refresh,15000);}}
 enroll.onclick=async()=>{if(!confirm('このシートの内容を指定のGoogle DriveフォルダーへJSON保存し、以後の変更も自動反映します。フォルダーのアクセス権を持つ人が読めるようになります。登録しますか？'))return;try{await client.rpc('drive_enroll');refresh();}catch(e){state.textContent=e.message;}};
 refresh();return {refresh};
}
