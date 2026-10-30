THE FIC SHELF — ADMIN + PUBLIC DOWNLOAD CATALOG

1. Open the entire folder in VS Code. Launch admin.html via Live Server.
2. Import the original EPUB/PDF/HTML/TXT/DOCX files from your computer.
3. Edit metadata as needed. The originals are stored in this browser's IndexedDB while you work.
4. Click Export public website ZIP in the upper-right corner.
5. Extract the downloaded fic-shelf-public.zip. It includes index.html,
   style.css, app.js, catalog.json and downloads/ with each original fic.
6. Publish ONLY the contents of that public ZIP to your static host,
   for example GitHub Pages. Do NOT publish admin.html or admin.js.

Users see details and Download fic only. The public website fetches
catalog.json and file downloads from your published site, not from
IndexedDB or the admin workspace.

Admin access: this is a LOCAL publishing workflow, not a login-based
backend. Keeping admin files off the published site prevents visitors
from seeing admin controls, but does not provide authenticated server
admin features. Real online admin accounts and uploads require a backend.

IMPORTANT: Browser storage may be erased by clearing site data. Keep
your source fics backed up. Re-export and republish to apply edits.
For works you do not own, verify you have permission to redistribute
the downloaded files before putting them on a public website.

Internet is required for the CDN parsing libraries on the admin page.
Use Live Server, not a file:// URL, for ZIP export and catalog loading.
