'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr = v => Array.isArray(v) ? v : [];
const cfg = window.FIC_SHELF_CONFIG;
let client, fics = [];
const STORE_KEY = 'ficShelfReaderV1';
function readPrefs(){try{const v=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');return {saved: Array.isArray(v.saved)?v.saved:[],downloaded:Array.isArray(v.downloaded)?v.downloaded:[],view:v.view==='compact'?'compact':'cards'};}catch{return {saved:[],downloaded:[],view:'cards'}}}
let prefs=readPrefs(), onlySaved=false, currentId=null;
function persist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(prefs))}catch(e){console.warn('Reading list storage unavailable',e)}}
function isSaved(id){return prefs.saved.includes(String(id))}
function downloaded(id){return prefs.downloaded.includes(String(id))}
function toggleSaved(id){id=String(id);prefs.saved=isSaved(id)?prefs.saved.filter(x=>x!==id):[...prefs.saved,id];persist();render();if(currentId===id)updateDetailControls(id)}
function updateDetailControls(id){const b=$('saveDetailBtn');const saved=isSaved(id);b.textContent=saved?'♥ Saved for Later':'♡ Save for Later';b.setAttribute('aria-pressed',String(saved));$('downloadStatus').textContent=downloaded(id)?'✓ Downloaded on this device':''}
function renderReaderTools(){const savedVisible=fics.filter(f=>isSaved(f.id)).length;$('savedCount').textContent=savedVisible;$('allWorksBtn').classList.toggle('active',!onlySaved);$('allWorksBtn').setAttribute('aria-pressed',String(!onlySaved));$('readingListBtn').classList.toggle('active',onlySaved);$('readingListBtn').setAttribute('aria-pressed',String(onlySaved));$('cardViewBtn').classList.toggle('active',prefs.view==='cards');$('compactViewBtn').classList.toggle('active',prefs.view==='compact');$('cardViewBtn').setAttribute('aria-pressed',String(prefs.view==='cards'));$('compactViewBtn').setAttribute('aria-pressed',String(prefs.view==='compact'));$('library').classList.toggle('compact-library',prefs.view==='compact')}
function similarFor(f){const pool=fics.filter(x=>x.id!==f.id);const normalize=values=>new Set(arr(values).map(t=>String(t).toLowerCase().trim()).filter(Boolean));const rel=normalize(f.relationships), tg=normalize(f.tags), chars=normalize(f.characters);const scores=pool.map(x=>{const hits=(a,b)=>[...a].filter(v=>b.has(v)).length;let score=hits(rel,normalize(x.relationships))*5+hits(tg,normalize(x.tags))*2+hits(chars,normalize(x.characters));if(f.fandom&&x.fandom===f.fandom)score+=2;return {fic:x,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.fic.title).localeCompare(String(b.fic.title)));return scores.slice(0,4).map(x=>x.fic)}
function showSimilar(f){const container=$('similarFics');const results=similarFor(f);container.replaceChildren();if(!results.length){container.textContent='No similar stories found yet.';return}for(const x of results){const b=document.createElement('button');b.type='button';b.className='similar-item';b.dataset.similarId=x.id;const title=document.createElement('strong');title.textContent=x.title;const author=document.createElement('span');author.textContent='by '+(x.author||'Unknown author');b.append(title,author);container.appendChild(b)}}
const count = n => Number(n)>0?Number(n).toLocaleString('en-US'):'Unknown';
function tags(f,full=false){const t=[...arr(f.relationships),...arr(f.characters),...arr(f.tags)];const v=full?t:t.slice(0,5);return v.map(x=>`<span class="tag">${esc(x)}</span>`).join('')+(!full&&t.length>5?`<span class="tag more">+${t.length-5}</span>`:'');}

// Build a live tag selector from the records returned by Supabase.
// A category prefix keeps identically named relationship/character/freeform tags distinct.
const TAG_FIELDS = [
 ['relationships', 'Relationships'],
 ['characters', 'Characters'],
 ['tags', 'Additional tags'],
 ['warnings', 'Warnings']
];
const tagValues = v => Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()) : [];
function refreshTagOptions() {
 const element = $('tagFilter');
 const chosen = element.value;
 const groups = TAG_FIELDS.map(([field, label]) => {
   const counts = new Map();
   for (const fic of fics) {
     for (const tag of new Set(tagValues(fic[field]).map(t => t.trim()))) {
       counts.set(tag, (counts.get(tag) || 0) + 1);
     }
   }
   return {field, label, items:[...counts].sort((a,b)=>a[0].localeCompare(b[0],undefined,{sensitivity:'base'}))};
 });
 // Use DOM APIs to preserve literal tag text and avoid interpreting tags as HTML.
 element.replaceChildren(new Option('All tags', ''));
 for (const {field, label, items} of groups) {
   if (!items.length) continue;
   const group = document.createElement('optgroup');
   group.label = label;
   for (const [tag, n] of items) group.appendChild(new Option(`${tag} (${n})`, JSON.stringify([field,tag])));
   element.appendChild(group);
 }
 element.value = chosen;
 if (element.selectedIndex < 0) element.value = '';
}
function matchesSelectedTag(fic) {
 const selected = $('tagFilter').value;
 if (!selected) return true;
 try {
   const [field, tag] = JSON.parse(selected);
   return TAG_FIELDS.some(([f])=>f===field) && tagValues(fic[field]).some(value=>value.trim()===tag);
 } catch { return true; }
}

function render(){
 const q=$('search').value.trim().toLowerCase(),selected=$('fandomFilter').value,source=$('sourceFilter').value;
 const fs=[...new Set(fics.map(f=>f.fandom).filter(Boolean))].sort();
 $('fandomFilter').innerHTML='<option value="">All fandoms</option>'+fs.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');$('fandomFilter').value=selected;
 const filtered=fics.filter(f=>(!onlySaved||isSaved(f.id))&&(!selected||f.fandom===selected)&&(!source||(f.source_type||'unsorted')===source)&&matchesSelectedTag(f)&&(!q||[f.title,f.author,f.summary,f.fandom,...arr(f.relationships),...arr(f.characters),...arr(f.tags)].join(' ').toLowerCase().includes(q)));
 const sort=$('sort').value;filtered.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='author'?(a.author||'').localeCompare(b.author||''):sort==='words'?(b.words||0)-(a.words||0):new Date(b.created_at)-new Date(a.created_at));
 $('ficCount').textContent=filtered.length;$('note').textContent=`${fics.length} published works`;
 $('library').innerHTML=filtered.map(f=>`<div class="fic-card" tabindex="0" role="button" data-id="${esc(f.id)}" aria-label="View details for ${esc(f.title)}"><div class="card-top"><span class="fandom">${esc(f.fandom||f.format||'Fanfiction')}</span><div class="card-badges"><span class="status">${(f.source_type||'unsorted')==='ao3'?'AO3':'Unknown / Unsorted'}</span><button type="button" class="card-save ${isSaved(f.id)?'is-saved':''}" data-save-id="${esc(f.id)}" aria-label="${isSaved(f.id)?'Remove from':'Add to'} reading list" aria-pressed="${isSaved(f.id)}">${isSaved(f.id)?'♥':'♡'}</button></div></div><h3>${esc(f.title)}</h3><div class="byline">by ${esc(f.author||'Unknown author')}</div><p class="card-summary">${esc(f.summary||'No summary provided.')}</p><div class="tags">${tags(f)}</div><div class="card-bottom"><span>${count(f.words)} words${downloaded(f.id)?' · ✓ Downloaded':''}</span><span>${esc((f.format||'').toUpperCase())}</span></div></div>`).join('');
 renderReaderTools();
 $('empty').classList.toggle('hidden',filtered.length>0);
 $('empty').querySelector('h2').textContent=fics.length?'No matching stories':'No fics yet';
 $('empty').querySelector('p').textContent=fics.length?'Try a different search or filter.':'No published works are available yet.';
}
function detail(id){const f=fics.find(x=>x.id===id);if(!f)return;currentId=String(id);updateDetailControls(currentId);showSimilar(f);
 $('detailFilename').textContent=`${(f.format||'').toUpperCase()} · ${f.title||''}`;$('detailTitle').textContent=f.title;$('detailAuthor').textContent='by '+(f.author||'Unknown author');$('detailTags').innerHTML=tags(f,true);$('detailSummary').textContent=f.summary||'No summary provided.';
 $('detailMeta').textContent=`${count(f.words)} words · ${f.rating||'Rating unknown'}${f.category?' · '+f.category:''}${arr(f.warnings).length?' · '+f.warnings.join(', '):''}${f.chapters?' · '+f.chapters:''}${f.published?' · Published '+f.published:''}`;
 const link=$('downloadBtn');
 const publicUrl=client.storage.from(cfg.bucket).getPublicUrl(f.file_path).data.publicUrl;
 const originalName=f.filename||`${f.title||'fanfic'}.${f.format||'epub'}`;
 const downloadUrl=new URL(publicUrl);
 downloadUrl.searchParams.set('download',originalName);
 link.href=downloadUrl.toString();link.removeAttribute('download');link.removeAttribute('target');link.setAttribute('rel','noopener noreferrer');link.hidden=false;
 $('detailDialog').showModal();
}
async function load(){const {data,error}=await client.from('fics').select('*').eq('published',true).order('created_at',{ascending:false}).limit(1000);if(error)throw error;fics=data||[];refreshTagOptions();render()}
async function init(){
 try{if(!cfg||cfg.url.includes('YOUR-PROJECT')||cfg.publishableKey.includes('YOUR-'))throw Error('Add your Supabase URL and publishable key to config.js');client=supabase.createClient(cfg.url,cfg.publishableKey);await load()}catch(e){$('note').textContent=e.message;console.error(e);}
 ['search','sourceFilter','tagFilter','fandomFilter','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
 $('library').addEventListener('click',e=>{const save=e.target.closest('[data-save-id]');if(save){e.stopPropagation();toggleSaved(save.dataset.saveId);return}const el=e.target.closest('[data-id]');if(el)detail(el.dataset.id)});
 $('library').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const el=e.target.closest('[data-id]');if(el){e.preventDefault();detail(el.dataset.id)}}});
 $('closeDetail').onclick=()=>$('detailDialog').close();
 $('saveDetailBtn').addEventListener('click',()=>{if(currentId)toggleSaved(currentId)});
 $('downloadBtn').addEventListener('click',()=>{if(!currentId)return;if(!downloaded(currentId)){prefs.downloaded.push(currentId);persist()}updateDetailControls(currentId);render()});
 $('similarFics').addEventListener('click',e=>{const b=e.target.closest('[data-similar-id]');if(b)detail(b.dataset.similarId)});
 $('readingListBtn').addEventListener('click',()=>{onlySaved=true;render()});
 $('allWorksBtn').addEventListener('click',()=>{onlySaved=false;render()});
 $('cardViewBtn').addEventListener('click',()=>{prefs.view='cards';persist();render()});
 $('compactViewBtn').addEventListener('click',()=>{prefs.view='compact';persist();render()});
 $('surpriseBtn').addEventListener('click',()=>{const cards=[...$('library').querySelectorAll('.fic-card[data-id]')];if(!cards.length){$('note').textContent='No fics match the current filters.';return}const choice=cards[Math.floor(Math.random()*cards.length)];detail(choice.dataset.id)});
 $('detailDialog').addEventListener('close',()=>{currentId=null});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&client)load().catch(console.error)});
}
document.addEventListener('DOMContentLoaded',init);
