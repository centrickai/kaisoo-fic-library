THE FIC SHELF — SUPABASE EDITION (STATIC HTML/CSS/JS)
========================================================

HOW IT WORKS
admin.html -> Supabase Auth -> admin-only database writes + Storage uploads
index.html -> published database records -> original file download link
Imported works are DRAFTS until you publish them through admin.html.
No local IndexedDB/export-ZIP step. All visitors share the same catalog.

SETUP
1. Create a Supabase project at https://supabase.com/dashboard
2. In SQL Editor, run the entire setup.sql file ONCE in the new project.
3. In Authentication -> Users, create one email/password user for yourself.
   For simplicity, use Add user; create only the account you control.
4. Copy that user's UUID from Authentication -> Users.
5. Run this SQL in SQL Editor (replace the placeholder UUID):

   insert into public.admin_users (user_id)
   values ('PASTE-YOUR-AUTH-USER-UUID-HERE');

6. In Project Settings -> API / API Keys, copy the project URL and the
   public publishable key (legacy anon key also works) into config.js.
   Never use a secret key or service_role key in browser files.
7. Open the project in VS Code, start Live Server, and open admin.html.
   Log in with the email/password from step 3.
8. Import files (EPUB, PDF, HTML, TXT, DOCX) or a folder. New uploads
   are drafts. Click Edit metadata -> Published -> Save changes to make
   a work appear on index.html, or click Publish on its admin card.
9. Open index.html with Live Server. Once the database is configured,
   published works appear here. Refresh the page after admin changes.
10. Deploy ALL static site files to GitHub Pages/Netlify/etc. The same
    Supabase project URL and publishable key work online. The admin page
    may be deployed too: access is controlled by Auth + RLS, not hiding it.
    Restrict signup or ensure only approved user UUIDs are allowlisted.

PUBLIC DOWNLOADS
- The public Storage bucket lets readers download without signing in.
- Any person with a direct file URL can access its file, even if you
  subsequently unpublish the catalog listing. To revoke a file URL,
  delete the file or move it to a private bucket (requires new design).
- The download button opens the file URL. Depending on browser and file
  format, the file may download or open in another tab.
- For large files, the 50 MB SQL bucket limit applies. Hosting costs
  and file transfer limits depend on your Supabase plan.

METADATA
- Browser-side parsing uses JSZip (EPUB), PDF.js, and Mammoth (DOCX).
- AO3 EPUB may carry embedded original tags; PDFs and unstructured
  files often require corrections. Scanned PDFs need OCR (not included).
- Parsing libraries are loaded by CDN and require internet access.
- Extracting very large files can use considerable browser memory.
- Import errors are shown in admin dashboard. Duplicate file hashes
  are blocked; file names are preserved as record metadata.

SECURITY
- No frontend-only shared password: email/password auth is managed
  by Supabase, with an explicit database allowlist of admin users.
- Row Level Security protects database edits and Storage writes.
- Do not publish copyrighted works without necessary permission.
- Back up original files; this app is not a backup service.

FILES
index.html + app.js        Public browsing and downloads
admin.html + admin.js      Protected upload/edit/publish dashboard
extractor.js               Local metadata parsing in admin browser
config.js                  Public Supabase project settings
style.css                  Shared visual design
setup.sql                  Database schema and security policies
README.txt                 These instructions

TROUBLESHOOTING
- Login works, admin access denied: check your user UUID in admin_users.
- Imported file not shown: new files are drafts; publish it first.
- Error "row-level security": ensure setup.sql ran successfully.
- Error "Bucket not found": check setup.sql and cfg.bucket in config.js.
- Empty public page: verify config.js, publish status, and browser console.
- Avoid opening pages as file://; use Live Server (http://localhost...).
