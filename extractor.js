/* Browser-side EPUB, PDF, DOCX, HTML and TXT metadata extraction. */
const split = value => String(value || '').split(/\s*[,;|]\s*/).map(x=>x.trim()).filter(Boolean);
const clean = s => String(s ?? '').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
const nameFromFile = name => name.replace(/\.(epub|html?|pdf|txt|docx)$/i,'').replace(/[_]+/g,' ').trim();
const extension = name => (name.split('.').pop() || '').toLowerCase();
const textOf = el => el?.textContent?.trim() || '';
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

