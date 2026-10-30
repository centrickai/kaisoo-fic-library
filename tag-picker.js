/* Searchable, scrollable replacement UI for the dynamic #tagFilter select.
   Keeps the existing filter logic in app.js and admin.js unchanged. */
(() => {
 'use strict';
 const select=document.getElementById('tagFilter');
 const wrapper=document.getElementById('tagPicker');
 if(!select||!wrapper)return;
 const trigger=document.getElementById('tagPickerTrigger');
 const label=document.getElementById('tagPickerLabel');
 const panel=document.getElementById('tagPickerPanel');
 const search=document.getElementById('tagPickerSearch');
 const list=document.getElementById('tagPickerList');
 let entries=[];
 function sync(){
   const current=[...select.options].find(o=>o.value===select.value);
   const name=current?.textContent||'All tags';
   label.textContent=select.value?name.replace(/\s+\(\d+\)$/,''):'All tags';
   trigger.title=label.textContent;
 }
 function rebuild(){
   entries=[];
   for(const child of select.children){
     if(child.tagName==='OPTION'){entries.push({value:child.value,text:child.textContent,group:''});}
     else if(child.tagName==='OPTGROUP'){
       for(const opt of child.children){if(opt.tagName==='OPTION')entries.push({value:opt.value,text:opt.textContent,group:child.label})}
     }
   }
   sync();
   if(!panel.hidden)renderList();
 }
 function renderList(){
   const query=search.value.trim().toLocaleLowerCase();
   const frag=document.createDocumentFragment();let previousGroup=null,count=0;
   for(const item of entries){
     if(query && !(`${item.text} ${item.group}`).toLocaleLowerCase().includes(query) && item.value)continue;
     if(item.group && item.group!==previousGroup){const heading=document.createElement('div');heading.className='tag-picker-group';heading.textContent=item.group;frag.appendChild(heading)}
     previousGroup=item.group;
     const btn=document.createElement('button');btn.type='button';btn.className='tag-picker-item';btn.setAttribute('role','option');btn.setAttribute('aria-selected',String(select.value===item.value));btn.textContent=item.text;
     btn.addEventListener('click',()=>{select.value=item.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close()});
     frag.appendChild(btn);count++;
   }
   if(!count){const empty=document.createElement('div');empty.className='tag-picker-empty';empty.textContent='No matching tags';frag.appendChild(empty)}
   list.replaceChildren(frag);
 }
 function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false')}
 function open(){panel.hidden=false;trigger.setAttribute('aria-expanded','true');search.value='';renderList();search.focus()}
 trigger.addEventListener('click',()=>panel.hidden?open():close());
 search.addEventListener('input',renderList);
 document.addEventListener('pointerdown',e=>{if(!wrapper.contains(e.target))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();trigger.focus()}});
 select.addEventListener('change',sync);
 new MutationObserver(rebuild).observe(select,{childList:true,subtree:true});
 rebuild();
})();
