# tilda-uploader

This project contains a ready-to-deploy backend for handling uploads from a Tilda form and saving images to Google Drive and metadata to Google Sheets.

## Files
- `frontend.html` — Paste into Tilda Zero Block -> Add HTML. Replace BACKEND_URL_HERE with your Render app URL.
- `server.js` — Express server for Render.
- `package.json`
- `.env.example` — example env variables.

## Quick steps to deploy on Render
1. Create a GitHub repo and upload the project files **except** your `credentials.json`.
2. On Render.com, create a new **Web Service** from the repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Add environment variables in Render dashboard:
   - `DRIVE_FOLDER_ID` — your Drive folder ID (you already have it)
   - `SHEETS_ID` — your Google Sheet ID
   - Recommended: add `GOOGLE_SERVICE_ACCOUNT` secret with the full JSON contents of your `credentials.json` (single-line JSON string). Alternatively, upload credentials.json into the repo (NOT recommended).
4. Deploy and note your app URL, e.g. `https://your-app.onrender.com`.
5. Open `frontend.html` and replace `BACKEND_URL_HERE` with your app URL, then paste the HTML into Tilda Zero Block -> Add HTML.
6. Test upload from Tilda.

## Notes & security
- **Do not** commit `credentials.json` to a public repo.
- Use Render's environment secrets to store the service account JSON for security.
- If you prefer to keep credentials.json as a file, put it in project root (but keep repo private).

## Troubleshooting
- If you get 401 errors, ensure the service account has access to the Drive folder (share the folder with service account email).
- Ensure Drive API and Sheets API are enabled in Google Cloud Console.
