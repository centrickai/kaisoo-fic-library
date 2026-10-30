/* The Fic Shelf — no server required. Dependencies for EPUB/PDF/DOCX load from CDNs. */
'use strict';
const $ = id => document.getElementById(id);
const DB_NAME = 'the-fic-shelf-admin-publisher-v2', STORE = 'fics';
let db, fics = [], selectedId = null, fontSize = 18;
const split = value => String(value || '').split(/\s*[,;|]\s*/).map(x=>x.trim()).filter(Boolean);
const dedupe = arr => [...new Set(arr.filter(Boolean))];
const clean = s => String(s ?? '').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
const nameFromFile = name => name.replace(/\.(epub|html?|pdf|txt|docx)$/i,'').replace(/[_]+/g,' ').trim();
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const extension = name => (name.split('.').pop() || '').toLowerCase();
const textOf = el => el?.textContent?.trim() || '';
function dbOpen(){return new Promise((res,rej)=>{let req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id'});req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
function transact(mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode), store=tx.objectStore(STORE);let result;try{result=fn(store)}catch(e){reject(e);return}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error)})}
const save = obj=>transact('readwrite',s=>s.put(obj));
const remove = id=>transact('readwrite',s=>s.delete(id));
function fetchAll(){return new Promise((resolve,reject)=>{const q=db.transaction(STORE).objectStore(STORE).getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
function getItem(id){return new Promise((resolve,reject)=>{const q=db.transaction(STORE).objectStore(STORE).get(id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
async function refresh(){fics=await fetchAll();render()}
function nodeTags(doc,selector){return [...doc.querySelectorAll(selector)].map(textOf).filter(Boolean)}
function parseXML(s){return new DOMParser().parseFromString(s,'application/xml')}
function parseHTML(s){return new DOMParser().parseFromString(s,'text/html')}
function first(doc,sel){return textOf(doc.querySelector(sel))}
function meta(doc,key){return doc.querySelector(`meta[name="${key}"],meta[property="${key}"]`)?.getAttribute('content')?.trim()||''}
function htmlToPlain(html){const doc=parseHTML(html);doc.querySelectorAll('script,style,nav').forEach(e=>e.remove());return doc.body?.innerText || doc.body?.textContent || ''}
function basicFromText(raw,fileName){
 const lines=raw.slice(0,22000).split(/\r?\n/).map(clean).filter(Boolean);const start=lines.slice(0,55).join('\n');
 const match=(keys)=>{for(const key of keys){const m=start.match(new RegExp('(?:^|\\n)'+key+'\\s*[:：]\\s*(.+)','im'));if(m)return clean(m[1])}return ''};
 const summary=match(['Summary','Description','Synopsis']);
 return {title:match(['Title'])||nameFromFile(fileName),author:match(['Author','By']),fandom:match(['Fandoms?']),relationships:split(match(['Relationships?','Pairings?','Ships?'])),characters:split(match(['Characters?'])),tags:split(match(['Additional Tags','Freeform Tags','Tags'])),summary,words:null,chapters:match(['Chapters?']),rating:match(['Rating']),sourceUrl:(raw.match(/https?:\/\/(?:www\.)?archiveofourown\.org\/works\/\d+/i)||[])[0]||'',text:raw};
}
function metaFromTitle(doc){return meta(doc,'citation_title')||meta(doc,'og:title')||doc.title||''}
function decodeHTMLMetadata(html,fileName){
 const doc=parseHTML(html);doc.querySelectorAll('script,style').forEach(n=>n.remove());
 const original=basicFromText(doc.body?.textContent||'',fileName);
 const get=sel=>nodeTags(doc,sel);const dd=cls=>get(`dd.${cls} a, dd.${cls} span`).filter(t=>t!==',');
 let main=doc.querySelector('#chapters')||doc.querySelector('#workskin')||doc.querySelector('main')||doc.body;
 const text=main?.textContent?.replace(/\n{3,}/g,'\n\n')||'';
 return {...original,title:first(doc,'h2.title')||first(doc,'h1.title')||meta(doc,'citation_title')||meta(doc,'og:title')||original.title,author:get('h3.byline a[rel="author"],a[rel="author"],h3.byline a').join(', ')||meta(doc,'citation_author')||original.author,fandom:dd('fandom').join(', ')||original.fandom,relationships:dd('relationship').length?dd('relationship'):original.relationships,characters:dd('character').length?dd('character'):original.characters,tags:dd('freeform').length?dd('freeform'):original.tags,rating:dd('rating').join(', ')||original.rating,summary:first(doc,'.summary blockquote')||first(doc,'.summary .userstuff')||meta(doc,'description')||original.summary,sourceUrl:doc.querySelector('a[href*="archiveofourown.org/works/"]')?.href||original.sourceUrl,text:clean(text)};
}
async function extractEPUB(file){
 if(!window.JSZip)throw Error('EPUB parsing library unavailable. Connect to the internet once and reload.');
 const zip=await JSZip.loadAsync(await file.arrayBuffer());
 const container=zip.file('META-INF/container.xml');if(!container)throw Error('Invalid EPUB (missing container.xml)');
 const containerXml=parseXML(await container.async('string'));
 const opfPath=containerXml.querySelector('rootfile')?.getAttribute('full-path');
 if(!opfPath||!zip.file(opfPath))throw Error('Invalid EPUB (missing package file)');
 const opf=parseXML(await zip.file(opfPath).async('string'));
 const elements=tag=>[...opf.getElementsByTagName('*')].filter(e=>e.localName===tag);
 const metadata=elements('metadata')[0], children=metadata?[...metadata.children]:[];
 const names=tag=>children.filter(e=>e.localName===tag).map(e=>clean(e.textContent));
 const subjects=names('subject');
 const manifest=new Map(elements('item').map(e=>[e.getAttribute('id'),{path:e.getAttribute('href'),media:e.getAttribute('media-type')}]));
 const spine=elements('itemref').map(e=>manifest.get(e.getAttribute('idref'))).filter(Boolean);
 const folder=opfPath.includes('/')?opfPath.slice(0,opfPath.lastIndexOf('/')+1):'';
 const parts=[];
 const ao3={};
 for(const item of spine){
  if(!/xhtml|html/i.test(item.media||''))continue;
  const full=folder+decodeURIComponent((item.path||'').split('#')[0]);
  const entry=zip.file(full)||Object.values(zip.files).find(x=>x.name.toLowerCase()===full.toLowerCase());
  if(!entry)continue;
  const html=await entry.async('string'),doc=parseHTML(html);
  // AO3 exports preserve distinct tag categories in the EPUB preface, even
  // when the OPF collapses them into untyped dc:subject entries.
  for(const dt of doc.querySelectorAll('dl.tags dt')){
   const label=clean(dt.textContent).replace(/:$/,'').toLowerCase();
   let dd=dt.nextElementSibling;
   if(!dd||dd.tagName.toLowerCase()!=='dd')continue;
   const linked=[...dd.querySelectorAll('a')].map(textOf).filter(Boolean);
   const values=linked.length?linked:[clean(dd.textContent)];
   if(label==='rating')ao3.rating=values.join(', ');
   if(label==='fandom'||label==='fandoms')ao3.fandom=values.join(', ');
   if(label==='relationship'||label==='relationships')ao3.relationships=values;
   if(label==='characters'||label==='character')ao3.characters=values;
   if(label==='additional tags'||label==='freeform tags')ao3.tags=values;
   if(label==='archive warning'||label==='archive warnings')ao3.warnings=values;
   if(label==='category'||label==='categories')ao3.category=values.join(', ');
   if(label==='stats'){
    const stats=clean(dd.textContent);
    ao3.words=Number((stats.match(/Words:\s*([\d,]+)/i)||[])[1]?.replace(/,/g,''))||null;
    ao3.chapters=(stats.match(/Chapters:\s*([^\s]+)/i)||[])[1]||'';
    ao3.published=(stats.match(/Published:\s*(\d{4}-\d{2}-\d{2})/i)||[])[1]||'';
   }
  }
  if(!ao3.sourceUrl){
   const anchor=[...doc.querySelectorAll('a[href]')].find(a=>/^https?:\/\/(www\.)?archiveofourown\.org\/works\/\d+\/?$/i.test(a.href));
   if(anchor)ao3.sourceUrl=anchor.href;
  }
  const chapter=doc.querySelector('#chapters');
  if(chapter)parts.push(clean(chapter.textContent));
  else if(!doc.querySelector('#preface,#afterword'))parts.push(clean(doc.body?.textContent||''));
 }
 const body=parts.join('\n\n');
 const desc=names('description')[0]||'';
 const title=names('title')[0]||nameFromFile(file.name);
 const author=names('creator').join(', ');
 const known=new Set([ao3.rating,ao3.fandom,ao3.category,...(ao3.relationships||[]),...(ao3.characters||[]),...(ao3.tags||[]),...(ao3.warnings||[]),'Fanworks']);
 return {title,author,summary:desc?clean(htmlToPlain(desc)):'',fandom:ao3.fandom||'',relationships:ao3.relationships||[],characters:ao3.characters||[],tags:ao3.tags||subjects.filter(x=>!known.has(x)),rating:ao3.rating||'',warnings:ao3.warnings||[],category:ao3.category||'',published:ao3.published||names('date')[0]?.slice(0,10)||'',chapters:ao3.chapters||'',words:ao3.words||null,sourceUrl:ao3.sourceUrl||'',text:body};
}
async function extractPDF(file){
 if(!window.pdfjsLib)throw Error('PDF parser unavailable. Connect to the internet once and reload.');
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;let pages=[];
 for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),content=await page.getTextContent();let lastY=null,line='';const rows=[];for(const part of content.items){if(lastY!==null&&Math.abs(part.transform[5]-lastY)>3){rows.push(line.trim());line=''}line+=(part.str||'')+(part.hasEOL?'\n':' ');lastY=part.transform[5]}rows.push(line.trim());pages.push(rows.join('\n'))}
 const extracted=pages.join('\n\n');const data=basicFromText(extracted,file.name);
 try{const info=(await pdf.getMetadata()).info;data.title=(info.Title&&!/^(untitled|microsoft|document)$/i.test(info.Title))?clean(info.Title):data.title;data.author=info.Author?clean(info.Author):data.author}catch{}
 data.text=extracted;data.chapters=String(pdf.numPages)+' PDF pages';return data;
}
async function extractDOCX(file){if(!window.mammoth)throw Error('DOCX parser unavailable. Connect to the internet once and reload.');const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return basicFromText(r.value,file.name)}
async function extract(file){const ext=extension(file.name);if(ext==='epub')return extractEPUB(file);if(ext==='pdf')return extractPDF(file);if(ext==='docx')return extractDOCX(file);if(ext==='htm'||ext==='html')return decodeHTMLMetadata(await file.text(),file.name);if(ext==='txt')return basicFromText(await file.text(),file.name);throw Error('Unsupported format: '+ext)}
async function hashFile(file){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')}
async function importFiles(list){const files=[...list].filter(f=>/\.(epub|pdf|html?|txt|docx)$/i.test(f.name));if(!files.length){alert('No supported files found.');return}
 $('progress').classList.remove('hidden');let imported=0,skipped=0,failed=[];const hashes=new Set(fics.map(f=>f.id));
 for(let i=0;i<files.length;i++){$('progressText').textContent='Importing '+files[i].name;$('progressCount').textContent=`${i+1} / ${files.length}`;$('progressFill').style.width=(i/files.length*100)+'%';await new Promise(r=>setTimeout(r,0));
  try{const file=files[i],id=await hashFile(file);if(hashes.has(id)){skipped++;continue}const data=await extract(file);const record={id,filename:file.name,format:extension(file.name).toUpperCase(),title:clean(data.title)||nameFromFile(file.name),author:clean(data.author),fandom:clean(data.fandom),relationships:data.relationships||[],characters:data.characters||[],tags:data.tags||[],rating:clean(data.rating),warnings:data.warnings||[],category:data.category||'',published:data.published||'',summary:clean(data.summary),chapters:clean(data.chapters),sourceUrl:data.sourceUrl||'',words:data.words||((data.text||'').trim().match(/\S+/g)||[]).length,text:data.text||'',fileBlob:file,downloadName:file.name,status:'Unread',favorite:false,added:Date.now()+i};await save(record);hashes.add(id);imported++}
  catch(e){console.warn('Import error:',files[i].name,e);failed.push(`${files[i].name}: ${e.message}`)}
 }
 $('progressFill').style.width='100%';$('progressText').textContent=`Imported ${imported} · Skipped ${skipped} duplicate(s) · ${failed.length} error(s)`;
 await refresh();if(failed.length){alert('Some files could not be read:\n\n'+failed.slice(0,12).join('\n')+(failed.length>12?'\n…and more':''))}setTimeout(()=>$('progress').classList.add('hidden'),8000);
}
const compact = n => n?new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n):'Unknown length';
function tagMarkup(item){const tags=[...item.relationships.map(t=>[t,'tag']),...item.tags.map(t=>[t,'tag character']),...item.characters.map(t=>[t,'tag character'])];return tags.slice(0,5).map(([t,cls])=>`<span class="${cls}">${escapeHTML(t)}</span>`).join('')+(tags.length>5?`<span class="tag more">+${tags.length-5}</span>`:'')}
function render(){let term=$('search').value.toLowerCase().trim(),fandom=$('fandomFilter').value,status=$('statusFilter').value;
 const fandoms=dedupe(fics.map(f=>f.fandom).filter(Boolean)).sort((a,b)=>a.localeCompare(b));$('fandomFilter').innerHTML='<option value="">All fandoms</option>'+fandoms.map(f=>`<option value="${escapeHTML(f)}">${escapeHTML(f)}</option>`).join('');$('fandomFilter').value=fandom;
 let matches=fics.filter(f=>(!fandom||f.fandom===fandom)&&(!status||f.status===status)&&(!term||[f.title,f.author,f.summary,f.fandom,...f.tags,...f.relationships,...f.characters].join(' ').toLowerCase().includes(term)));
 const sort=$('sort').value;matches.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='author'?a.author.localeCompare(b.author):sort==='words'?b.words-a.words:b.added-a.added);
 $('ficCount').textContent=matches.length;$('note').textContent=fics.length?`${fics.length} saved works`:'';
 $('library').innerHTML=matches.map(f=>`<div class="fic-card" tabindex="0" role="button" data-id="${f.id}"><div class="card-top"><span class="fandom">${escapeHTML(f.fandom||f.format)}</span><span class="heart ${f.favorite?'faved':''}">${f.favorite?'♥':'♡'}</span></div><h3>${escapeHTML(f.title)}</h3><div class="byline">by ${escapeHTML(f.author||'Unknown author')}</div><p class="card-summary">${escapeHTML(f.summary||'No summary detected. Open this fic to add one.')}</p><div class="tags">${tagMarkup(f)}</div><div class="card-bottom"><span>${compact(f.words)} words</span><span>${escapeHTML(f.status)}</span></div></div>`).join('');
 $('empty').classList.toggle('hidden',matches.length>0);$('empty').querySelector('h2').textContent=fics.length?'No matching stories':'Your shelf is waiting';$('empty').querySelector('p').textContent=fics.length?'Try another search or clear your filters.':'Import your offline fics. We’ll extract available metadata and build your searchable collection.';
}
function current(){return fics.find(f=>f.id===selectedId)}
function showDetail(id){selectedId=id;const f=current();if(!f)return;$('detailFilename').textContent=`${f.format} · ${f.filename}`;$('detailTitle').textContent=f.title;$('detailAuthor').textContent='by '+(f.author||'Unknown author');$('detailTags').innerHTML=tagMarkup(f);$('detailSummary').textContent=f.summary||'No summary detected. You can add one using Edit metadata.';$('detailMeta').textContent=`${compact(f.words)} words · ${f.rating||'Rating unknown'}${f.category?' · '+f.category:''}${f.warnings?.length?' · '+f.warnings.join(', '):''} · ${f.chapters||'Chapters unknown'}${f.published?' · Published '+f.published:''} · ${f.status}`;$('favoriteBtn').textContent=f.favorite?'♥ Favorited':'♡ Favorite';$('readBtn').disabled=!f.text;$('detailDialog').showModal()}
function openEdit(){const f=current();if(!f)return;for(const k of ['Title','Author','Fandom','Summary','Status'])$('edit'+k).value=f[k.toLowerCase()]||'';$('editRelationships').value=f.relationships.join(', ');$('editCharacters').value=f.characters.join(', ');$('editTags').value=f.tags.join(', ');$('detailDialog').close();$('editDialog').showModal()}
function reader(){const f=current();if(!f)return;$('detailDialog').close();$('readerTitle').textContent=f.title;$('readerAuthor').textContent=f.author||'Unknown author';$('readerContent').textContent=f.text||'Text unavailable for this file.';$('readerContent').style.fontSize=fontSize+'px';$('readerContent').scrollTop=0;$('readerDialog').showModal()}
async function init(){try{db=await dbOpen();await refresh()}catch(e){alert('Unable to open browser storage: '+e.message);console.error(e);return}
 $('importBtn').onclick=()=>$('fileInput').click();$('folderBtn').onclick=()=>$('folderInput').click();$('fileInput').onchange=e=>{importFiles(e.target.files);e.target.value=''};$('folderInput').onchange=e=>{importFiles(e.target.files);e.target.value=''};
 for(const id of ['search','fandomFilter','statusFilter','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
 $('library').addEventListener('click',e=>{let el=e.target.closest('[data-id]');if(el)showDetail(el.dataset.id)});$('library').addEventListener('keydown',e=>{if(e.key==='Enter'){const el=e.target.closest('[data-id]');if(el)showDetail(el.dataset.id)}});
 $('closeDetail').onclick=()=>$('detailDialog').close();$('closeEdit').onclick=$('cancelEdit').onclick=()=>$('editDialog').close();$('editBtn').onclick=openEdit;$('readBtn').onclick=reader;$('backReader').onclick=()=>$('readerDialog').close();
 $('favoriteBtn').onclick=async()=>{const f=current();f.favorite=!f.favorite;await save(f);await refresh();showDetail(f.id)};
 $('deleteBtn').onclick=async()=>{const f=current();if(confirm(`Permanently remove "${f.title}" from this browser library?`)){await remove(f.id);$('detailDialog').close();await refresh()}};
 $('editForm').onsubmit=async e=>{e.preventDefault();const f=current();for(const k of ['Title','Author','Fandom','Summary','Status'])f[k.toLowerCase()]=$('edit'+k).value.trim();f.relationships=split($('editRelationships').value);f.characters=split($('editCharacters').value);f.tags=split($('editTags').value);await save(f);$('editDialog').close();await refresh();showDetail(f.id)};
 $('increaseFont').onclick=()=>{$('readerContent').style.fontSize=(fontSize=Math.min(fontSize+2,32))+'px'};$('decreaseFont').onclick=()=>{$('readerContent').style.fontSize=(fontSize=Math.max(fontSize-2,12))+'px'};
 $('exportBtn').onclick=exportWebsite;
}

async function exportWebsite(){
 if(!window.JSZip){alert('Connect to the internet and reload to enable ZIP exporting.');return}
 const missing=fics.filter(f=>!(f.fileBlob instanceof Blob));
 if(missing.length){alert(`${missing.length} older imported file(s) have no original file attached. Remove those entries and reimport the originals to enable public downloads.`);return}
 const zip=new JSZip(), catalog=[];
 for(const f of fics){
  const safeName=(f.filename||'fic').replace(/[^a-zA-Z0-9_.()-]/g,'_');
  const path=`downloads/${f.id.slice(0,20)}-${safeName}`;
  zip.file(path,f.fileBlob);
  const {fileBlob,text,...data}=f;
  catalog.push({...data,downloadUrl:path});
 }
 zip.file('catalog.json',JSON.stringify({generatedAt:new Date().toISOString(),fics:catalog},null,2));
 const resp=await Promise.all(['index.html','style.css','app.js'].map(name=>fetch(name).then(r=>{if(!r.ok)throw Error('Cannot read '+name);return r.text()})));
 ['index.html','style.css','app.js'].forEach((name,i)=>zip.file(name,resp[i]));
 const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fic-shelf-public.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
document.addEventListener('DOMContentLoaded',init);
