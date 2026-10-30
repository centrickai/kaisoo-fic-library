'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg=window.FIC_SHELF_CONFIG;
let client, fics=[], editId=null, importing=false;
const showMessage=(message,bad=false)=>{const p=$('adminMessage');p.textContent=message;p.style.color=bad?'#9c3333':'#765c8a'};
const list=v=>String(v||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
function render(){const q=$('search').value.toLowerCase(),filter=$('publishedFilter').value;
 const rows=fics.filter(f=>(!q||[f.title,f.author,f.summary,f.fandom,...(f.tags||[]),...(f.relationships||[])].join(' ').toLowerCase().includes(q))&&(!filter||(filter==='published'?f.published:!f.published)));
 $('ficCount').textContent=rows.length;$('note').textContent=`${fics.length} total`;
 $('library').innerHTML=rows.map(f=>`<article class="fic-card admin-card"><div class="card-top"><span class="fandom">${esc(f.fandom||'Fanfiction')}</span><span class="status">${f.published?'Published':'Draft'}</span></div><h3>${esc(f.title)}</h3><div class="byline">by ${esc(f.author||'Unknown author')}</div><p class="card-summary">${esc(f.summary||'No summary detected.')}</p><div class="admin-actions"><button class="outlined" data-edit="${esc(f.id)}">Edit metadata</button><button class="subtle" data-publish="${esc(f.id)}">${f.published?'Unpublish':'Publish'}</button></div></article>`).join('');$('empty').classList.toggle('hidden',rows.length>0);
}
async function refresh(){const {data,error}=await client.from('fics').select('*').order('created_at',{ascending:false}).limit(1000);if(error)throw error;fics=data||[];render()}
async function guard(){const {data:{user},error}=await client.auth.getUser();if(error||!user)return false;const {data,error:adminError}=await client.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();return !adminError&&!!data}
async function setAuth(){const allowed=await guard();$('loginView').classList.toggle('hidden',allowed);$('adminView').classList.toggle('hidden',!allowed);$('logout').classList.toggle('hidden',!allowed);if(allowed){await refresh()}return allowed}
async function hashFile(file){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function uploadFile(file){
 const hash=await hashFile(file);
 const {data:existing,error:findError}=await client.from('fics').select('id').eq('sha256',hash).maybeSingle();if(findError)throw findError;if(existing)throw Error('Already imported (identical file)');
 const meta=await extract(file);
 const id=crypto.randomUUID(),ext=extension(file.name),path=`${id}.${ext}`;
 const {error:uploadError}=await client.storage.from(cfg.bucket).upload(path,file,{contentType:file.type||({'epub':'application/epub+zip','pdf':'application/pdf','txt':'text/plain','html':'text/html','htm':'text/html','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[ext]||'application/octet-stream'),upsert:false});if(uploadError)throw uploadError;
 const record={id,file_path:path,filename:file.name,format:ext,title:meta.title||nameFromFile(file.name),author:meta.author||'',summary:meta.summary||'',fandom:meta.fandom||'',relationships:meta.relationships||[],characters:meta.characters||[],tags:meta.tags||[],warnings:meta.warnings||[],category:meta.category||'',rating:meta.rating||'',words:Number(meta.words)||null,chapters:meta.chapters||'',published_date:meta.published||null,source_url:meta.sourceUrl||'',sha256:hash,published:false};
 const {error:insertError}=await client.from('fics').insert(record);if(insertError){await client.storage.from(cfg.bucket).remove([path]);throw insertError}
}
async function importFiles(fileList){if(importing)return;const files=[...fileList].filter(f=>/\.(epub|html?|pdf|txt|docx)$/i.test(f.name));if(!files.length){showMessage('No supported files selected.',true);return}
 importing=true;$('progress').classList.remove('hidden');let success=0,fail=[];
 for(let i=0;i<files.length;i++){$('progressText').textContent=`Importing ${files[i].name}`;$('progressCount').textContent=`${i+1}/${files.length}`;$('progressFill').style.width=`${100*i/files.length}%`;
  try{await uploadFile(files[i]);success++}catch(e){fail.push(`${files[i].name}: ${e.message}`);console.error(e)}
 }
 $('progressFill').style.width='100%';$('progressText').textContent='Import complete';importing=false;
 showMessage(`${success} imported as drafts; ${fail.length} failed.${fail.length?' Errors: '+fail.slice(0,5).join(' | '):''}`,!!fail.length);await refresh();
}
function edit(id){const f=fics.find(x=>x.id===id);if(!f)return;editId=id;
 for(const field of ['Title','Author','Fandom','Summary','Rating'])$('edit'+field).value=f[field.toLowerCase()]||'';
 for(const field of ['Relationships','Characters','Tags','Warnings'])$('edit'+field).value=(f[field.toLowerCase()]||[]).join('\n');
 $('editWords').value=f.words??'';$('editPublished').checked=!!f.published;$('editDialog').showModal();
}
async function saveEdit(e){e.preventDefault();const fields={title:$('editTitle').value.trim(),author:$('editAuthor').value.trim(),fandom:$('editFandom').value.trim(),summary:$('editSummary').value.trim(),rating:$('editRating').value.trim(),words:$('editWords').value?Number($('editWords').value):null,relationships:list($('editRelationships').value),characters:list($('editCharacters').value),tags:list($('editTags').value),warnings:list($('editWarnings').value),published:$('editPublished').checked};
 const {error}=await client.from('fics').update(fields).eq('id',editId);if(error){showMessage(error.message,true);return}$('editDialog').close();showMessage('Metadata saved. Public website updates when refreshed.');await refresh();
}
async function togglePublish(id){const f=fics.find(x=>x.id===id);if(!f)return;const {error}=await client.from('fics').update({published:!f.published}).eq('id',id);if(error)showMessage(error.message,true);else{showMessage(f.published?'Unpublished.':'Published.');await refresh()}}
async function deleteFic(){const f=fics.find(x=>x.id===editId);if(!f||!confirm(`Permanently delete "${f.title}" and its uploaded file?`))return;
 // Delete database row first so no public record survives a partial failure.
 const {error}=await client.from('fics').delete().eq('id',editId);if(error){showMessage(error.message,true);return}
 const {error:fileError}=await client.storage.from(cfg.bucket).remove([f.file_path]);$('editDialog').close();showMessage(fileError?'Record deleted, but file removal failed: '+fileError.message:'Fic and file deleted.',!!fileError);await refresh();
}
async function init(){try{if(!cfg||cfg.url.includes('YOUR-PROJECT')||cfg.publishableKey.includes('YOUR-'))throw Error('Configure your Supabase URL and publishable key in config.js');client=supabase.createClient(cfg.url,cfg.publishableKey);await setAuth()}catch(e){$('loginError').textContent=e.message;console.error(e)}
 $('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').textContent='';try{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;if(!await setAuth()){await client.auth.signOut();throw Error('This user is not on the admin allowlist. Add the user ID to admin_users via the Supabase SQL Editor.')}$('password').value=''}catch(ex){$('loginError').textContent=ex.message}};
 $('logout').onclick=async()=>{await client.auth.signOut();await setAuth()};
 $('importBtn').onclick=()=>$('fileInput').click();$('folderBtn').onclick=()=>$('folderInput').click();
 $('fileInput').onchange=e=>{importFiles(e.target.files);e.target.value=''};$('folderInput').onchange=e=>{importFiles(e.target.files);e.target.value=''};
 $('search').oninput=render;$('publishedFilter').onchange=render;
 $('library').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.edit)edit(b.dataset.edit);if(b.dataset.publish)togglePublish(b.dataset.publish)};
 $('editForm').onsubmit=saveEdit;$('closeEdit').onclick=()=>$('editDialog').close();$('deleteBtn').onclick=deleteFic;
}
document.addEventListener('DOMContentLoaded',init);
