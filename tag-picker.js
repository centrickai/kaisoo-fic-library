/* Consistent searchable dropdowns for all public/admin toolbar filters.
   Native <select> elements remain the source of truth for existing filter code. */
(()=>{
 'use strict';
 function bind(select,wrapper){
   let trigger=wrapper.querySelector('.tag-picker-trigger');
   let panel=wrapper.querySelector('.tag-picker-panel');
   let search=wrapper.querySelector('.tag-picker-panel input');
   let list=wrapper.querySelector('.tag-picker-list');
   let label=wrapper.querySelector('.tag-picker-trigger span:first-child');
   const popups=()=>[...document.querySelectorAll('.tag-picker-panel:not([hidden])')];
   let entries=[];
   function sync(){
     const option=[...select.options].find(o=>o.value===select.value);
     label.textContent=option?.textContent?.replace(/\s+\(\d+\)$/,'')||select.options[0]?.textContent||'All';
     trigger.title=label.textContent;
   }
   function close(){panel.hidden=true;trigger.setAttribute('aria-expanded','false')}
   function rebuild(){
     entries=[];
     for(const child of select.children){
       if(child.tagName==='OPTION')entries.push({value:child.value,text:child.textContent,group:''});
       if(child.tagName==='OPTGROUP')for(const opt of child.children)if(opt.tagName==='OPTION')entries.push({value:opt.value,text:opt.textContent,group:child.label});
     }
     sync();if(!panel.hidden)render();
   }
   function render(){
     const q=search.value.trim().toLocaleLowerCase();let lastGroup='';let n=0;
     const frag=document.createDocumentFragment();
     for(const item of entries){
       if(q && !(`${item.text} ${item.group}`).toLocaleLowerCase().includes(q))continue;
       if(item.group!==lastGroup && item.group){const h=document.createElement('div');h.className='tag-picker-group';h.textContent=item.group;frag.appendChild(h)}
       lastGroup=item.group;
       const b=document.createElement('button');b.type='button';b.className='tag-picker-item';b.setAttribute('role','option');b.setAttribute('aria-selected',String(select.value===item.value));b.textContent=item.text;
       b.addEventListener('click',()=>{select.value=item.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close();trigger.focus()});
       frag.appendChild(b);n++;
     }
     if(!n){const el=document.createElement('div');el.className='tag-picker-empty';el.textContent='No matching options';frag.appendChild(el)}
     list.replaceChildren(frag);
   }
   function open(){for(const p of popups()){p.hidden=true;p.parentElement.querySelector('.tag-picker-trigger')?.setAttribute('aria-expanded','false')}
     panel.hidden=false;trigger.setAttribute('aria-expanded','true');search.value='';render();search.focus();
   }
   trigger.addEventListener('click',()=>panel.hidden?open():close());
   search.addEventListener('input',render);
   select.addEventListener('change',sync);
   new MutationObserver(rebuild).observe(select,{childList:true,subtree:true,characterData:true});
   document.addEventListener('pointerdown',e=>{if(!wrapper.contains(e.target))close()});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();trigger.focus()}});
   rebuild();
 }
 function make(select){
   if(!select||select.closest('.tag-picker'))return;
   const wrapper=document.createElement('div');wrapper.className='tag-picker';
   const placeholder=select.options[0]?.textContent||'All';
   select.before(wrapper);wrapper.appendChild(select);
   select.classList.add('tag-picker-native');select.tabIndex=-1;
   const trigger=document.createElement('button');trigger.type='button';trigger.className='tag-picker-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
   const label=document.createElement('span');label.textContent=placeholder;
   const arrow=document.createElement('span');arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');trigger.append(label,arrow);
   const panel=document.createElement('div');panel.className='tag-picker-panel';panel.hidden=true;
   const search=document.createElement('input');search.type='search';search.autocomplete='off';search.placeholder='Search options…';search.setAttribute('aria-label','Search '+placeholder.toLowerCase());
   const list=document.createElement('div');list.className='tag-picker-list';list.setAttribute('role','listbox');list.setAttribute('aria-label',placeholder);
   panel.append(search,list);wrapper.append(trigger,panel);
   bind(select,wrapper);
 }
 // Existing tags picker is constructed in HTML; use the exact same behavior for it.
 const tag=document.getElementById('tagFilter');if(tag&&tag.closest('.tag-picker'))bind(tag,tag.closest('.tag-picker'));
 for(const id of ['sourceFilter','fandomFilter','sort','publishedFilter'])make(document.getElementById(id));
})();
