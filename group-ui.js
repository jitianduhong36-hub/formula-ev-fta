import {groupColors,saveGroup,removeGroup} from './groups.js?v=groups1';
export function setupGroups({getModel,getSelected,applyModel,isBlocked,notice,onDraft}){
 const $=id=>document.getElementById(id),dialog=$('group-dialog');let pending=false;
 for(const c of groupColors){const o=new Option(c.name,c.color);$('group-color').append(o);}
 function fields(){const g=(getModel().groups||[]).find(g=>g.id===$('group-manage-select').value);$('group-name').value=g?.name||'';$('group-color').value=g?.color||groupColors[0].color;$('group-delete').disabled=!g;$('group-assign').checked=!g;swatch();}
 function swatch(){$('group-swatch').style.backgroundColor=$('group-color').value;}
 function close(){pending=false;dialog.close();onDraft();}
 $('manage-groups').onclick=()=>{if(isBlocked())return notice('先に入力中の変更を反映するか取り消し、接続が完了するまでお待ちください。');const sel=$('group-manage-select');sel.replaceChildren(new Option('新しいグループを作成',''));for(const g of getModel().groups||[])sel.append(new Option(g.name,g.id));fields();pending=true;dialog.showModal();onDraft();};
 $('group-manage-select').onchange=fields;$('group-color').onchange=swatch;$('group-cancel').onclick=close;dialog.addEventListener('cancel',()=>{pending=false;onDraft();});
 $('group-form').onsubmit=e=>{e.preventDefault();try{const group={id:$('group-manage-select').value||'G_'+crypto.randomUUID(),name:$('group-name').value,color:$('group-color').value};const m=saveGroup(getModel(),group,$('group-assign').checked?getSelected():null);close();applyModel(m,'グループの保存');}catch(e){$('group-error').textContent=e.message;}};
 $('group-delete').onclick=()=>{const id=$('group-manage-select').value,g=(getModel().groups||[]).find(g=>g.id===id);if(!g)return;if(!confirm('「'+g.name+'」を削除し、このグループの事象を全て「未分類」に戻します。事象や接続は残ります。続けますか？'))return;const m=removeGroup(getModel(),id);close();applyModel(m,'グループを削除');};
 dialog.addEventListener('close',()=>{$('group-error').textContent='';});
 return {get pending(){return pending;}};
}
