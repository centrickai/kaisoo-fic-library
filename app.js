'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr = v => Array.isArray(v) ? v : [];
const cfg = window.FIC_SHELF_CONFIG;
let client, fics = [];
const count = n => Number(n)>0?Number(n).toLocaleString('en-US'):'Unknown';
function tags(f,full=false){const t=[...arr(f.relationships),...arr(f.characters),...arr(f.tags)];const v=full?t:t.slice(0,5);return v.map(x=>`<span class="tag">${esc(x)}</span>`).join('')+(!full&&t.length>5?`<span class="tag more">+${t.length-5}</span>`:'');}
function render(){
 const q=$('search').value.trim().toLowerCase(),selected=$('fandomFilter').value,source=$('sourceFilter').value;
 const fs=[...new Set(fics.map(f=>f.fandom).filter(Boolean))].sort();
 $('fandomFilter').innerHTML='<option value="">All fandoms</option>'+fs.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');$('fandomFilter').value=selected;
 const filtered=fics.filter(f=>(!selected||f.fandom===selected)&&(!source||(f.source_type||'unsorted')===source)&&(!q||[f.title,f.author,f.summary,f.fandom,...arr(f.relationships),...arr(f.characters),...arr(f.tags)].join(' ').toLowerCase().includes(q)));
 const sort=$('sort').value;filtered.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='author'?(a.author||'').localeCompare(b.author||''):sort==='words'?(b.words||0)-(a.words||0):new Date(b.created_at)-new Date(a.created_at));
 $('ficCount').textContent=filtered.length;$('note').textContent=`${fics.length} published works`;
 $('library').innerHTML=filtered.map(f=>`<div class="fic-card" tabindex="0" role="button" data-id="${esc(f.id)}"><div class="card-top"><span class="fandom">${esc(f.fandom||f.format||'Fanfiction')}</span><span class="status">${(f.source_type||'unsorted')==='ao3'?'AO3':'Unknown / Unsorted'}</span></div><h3>${esc(f.title)}</h3><div class="byline">by ${esc(f.author||'Unknown author')}</div><p class="card-summary">${esc(f.summary||'No summary provided.')}</p><div class="tags">${tags(f)}</div><div class="card-bottom"><span>${count(f.words)} words</span><span>${esc((f.format||'').toUpperCase())}</span></div></div>`).join('');
 $('empty').classList.toggle('hidden',filtered.length>0);
 $('empty').querySelector('h2').textContent=fics.length?'No matching stories':'No fics yet';
 $('empty').querySelector('p').textContent=fics.length?'Try a different search or filter.':'No published works are available yet.';
}
function detail(id){const f=fics.find(x=>x.id===id);if(!f)return;
 $('detailFilename').textContent=`${(f.format||'').toUpperCase()} · ${f.filename||''}`;$('detailTitle').textContent=f.title;$('detailAuthor').textContent='by '+(f.author||'Unknown author');$('detailTags').innerHTML=tags(f,true);$('detailSummary').textContent=f.summary||'No summary provided.';
 $('detailMeta').textContent=`${count(f.words)} words · ${f.rating||'Rating unknown'}${f.category?' · '+f.category:''}${arr(f.warnings).length?' · '+f.warnings.join(', '):''}${f.chapters?' · '+f.chapters:''}${f.published?' · Published '+f.published:''}`;
 const link=$('downloadBtn');
 const publicUrl=client.storage.from(cfg.bucket).getPublicUrl(f.file_path).data.publicUrl;
 const originalName=f.filename||`${f.title||'fanfic'}.${f.format||'epub'}`;
 const downloadUrl=new URL(publicUrl);
 downloadUrl.searchParams.set('download',originalName);
 link.href=downloadUrl.toString();link.removeAttribute('download');link.removeAttribute('target');link.setAttribute('rel','noopener noreferrer');link.hidden=false;
 $('detailDialog').showModal();
}
async function load(){const {data,error}=await client.from('fics').select('*').eq('published',true).order('created_at',{ascending:false}).limit(1000);if(error)throw error;fics=data||[];render()}
async function init(){
 try{if(!cfg||cfg.url.includes('YOUR-PROJECT')||cfg.publishableKey.includes('YOUR-'))throw Error('Add your Supabase URL and publishable key to config.js');client=supabase.createClient(cfg.url,cfg.publishableKey);await load()}catch(e){$('note').textContent=e.message;console.error(e);}
 ['search','sourceFilter','fandomFilter','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
 $('library').addEventListener('click',e=>{const el=e.target.closest('[data-id]');if(el)detail(el.dataset.id)});
 $('library').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const el=e.target.closest('[data-id]');if(el){e.preventDefault();detail(el.dataset.id)}}});
 $('closeDetail').onclick=()=>$('detailDialog').close();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&client)load().catch(console.error)});
}
document.addEventListener('DOMContentLoaded',init);
