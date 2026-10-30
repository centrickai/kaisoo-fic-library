'use strict';
const $=id=>document.getElementById(id);
const clean=s=>String(s??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asArray=v=>Array.isArray(v)?v:[];
const compact=n=>Number.isFinite(Number(n))&&Number(n)>0?new Intl.NumberFormat('en').format(Number(n)):'Unknown';
let fics=[];
function tagMarkup(f,full=false){const items=[...asArray(f.relationships),...asArray(f.characters),...asArray(f.tags)];const visible=full?items:items.slice(0,5);return visible.map(t=>`<span class="tag">${esc(t)}</span>`).join('')+(!full&&items.length>5?`<span class="tag more">+${items.length-5}</span>`:'')}
function render(){const query=$('search').value.toLowerCase().trim(), fandom=$('fandomFilter').value;
 const all=[...new Set(fics.map(f=>f.fandom).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 $('fandomFilter').innerHTML='<option value="">All fandoms</option>'+all.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');$('fandomFilter').value=fandom;
 const filtered=fics.filter(f=>(!fandom||f.fandom===fandom)&&(!query||[f.title,f.author,f.summary,f.fandom,...asArray(f.relationships),...asArray(f.characters),...asArray(f.tags)].join(' ').toLowerCase().includes(query)));
 const sort=$('sort').value;filtered.sort((a,b)=>sort==='title'?clean(a.title).localeCompare(clean(b.title)):sort==='author'?clean(a.author).localeCompare(clean(b.author)):sort==='words'?(Number(b.words)||0)-(Number(a.words)||0):(Number(b.added)||0)-(Number(a.added)||0));
 $('ficCount').textContent=filtered.length;$('note').textContent=`${fics.length} published works`;
 $('library').innerHTML=filtered.map(f=>`<div class="fic-card" tabindex="0" role="button" data-id="${esc(f.id)}"><div class="card-top"><span class="fandom">${esc(f.fandom||f.format||'Fanfiction')}</span></div><h3>${esc(f.title)}</h3><div class="byline">by ${esc(f.author||'Unknown author')}</div><p class="card-summary">${esc(f.summary||'No summary provided.')}</p><div class="tags">${tagMarkup(f)}</div><div class="card-bottom"><span>${compact(f.words)} words</span><span>${esc(f.format||'Download')}</span></div></div>`).join('');
 $('empty').classList.toggle('hidden',filtered.length>0);
 $('empty').querySelector('h2').textContent=fics.length?'No matching stories':'No fics yet';
 $('empty').querySelector('p').textContent=fics.length?'Try different tags or another search.':'The catalog has not been published yet.';
}
function showDetail(id){const f=fics.find(x=>x.id===id);if(!f)return;
 $('detailFilename').textContent=`${f.format||''} · ${f.filename||''}`;
 $('detailTitle').textContent=f.title||'Untitled';$('detailAuthor').textContent='by '+(f.author||'Unknown author');$('detailTags').innerHTML=tagMarkup(f,true);
 $('detailSummary').textContent=f.summary||'No summary provided.';
 $('detailMeta').textContent=`${compact(f.words)} words · ${f.rating||'Rating unknown'}${f.category?' · '+f.category:''}${asArray(f.warnings).length?' · '+f.warnings.join(', '):''}${f.chapters?' · '+f.chapters:''}${f.published?' · Published '+f.published:''}`;
 const link=$('downloadBtn');link.href=f.downloadUrl||'#';link.download=f.downloadName||f.filename||'fic';link.hidden=!f.downloadUrl;
 $('detailDialog').showModal();}
async function init(){try{const response=await fetch('catalog.json',{cache:'no-store'});if(!response.ok)throw Error(`Catalog not found (${response.status})`);const json=await response.json();fics=(Array.isArray(json)?json:json.fics||[]).filter(f=>f&&typeof f.id==='string'&&typeof f.downloadUrl==='string'&&/^downloads\/[a-zA-Z0-9_.()\-]+$/.test(f.downloadUrl));render()}catch(e){console.warn(e);$('empty').querySelector('p').textContent='Could not load catalog.json. Publish the ZIP from the admin page and run this site through Live Server or a web host.'}
 ['search','fandomFilter','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
 $('library').addEventListener('click',e=>{const el=e.target.closest('[data-id]');if(el)showDetail(el.dataset.id)});
 $('library').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const el=e.target.closest('[data-id]');if(el){e.preventDefault();showDetail(el.dataset.id)}}});
 $('closeDetail').onclick=()=>$('detailDialog').close();}
document.addEventListener('DOMContentLoaded',init);
