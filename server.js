// server.js
// Simple Express server for Render deployment.
// Supports two ways to provide Google credentials:
// 1) Place credentials.json in project root (recommended for repo-based deploy).
// 2) Set GOOGLE_SERVICE_ACCOUNT env var to the JSON string of the service account.
//
// Set environment variables (recommended on Render):
//   DRIVE_FOLDER_ID  - Google Drive Folder ID where images will be uploaded
//   SHEETS_ID        - Google Sheets spreadsheet ID to append rows
//   PORT             - optional (default 10000)
//
// IMPORTANT: do NOT commit credentials.json to public repos. Use Render environment secrets.
//
// To run locally:
// 1) npm install
// 2) put credentials.json in the project root or set GOOGLE_SERVICE_ACCOUNT env var
// 3) create .env with DRIVE_FOLDER_ID and SHEETS_ID
// 4) node server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(express.json());
const upload = multer({ dest: 'tmp_uploads/', limits: { fileSize: 100 * 1024 * 1024, files: 10 } });

const PORT = process.env.PORT || process.env.PORT_NUMBER || 10000;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const SHEETS_ID = process.env.SHEETS_ID;

if(!DRIVE_FOLDER_ID || !SHEETS_ID){
  console.error('Please set DRIVE_FOLDER_ID and SHEETS_ID in environment variables (or .env).');
  process.exit(1);
}

// prepare Google Auth - accept either JSON string in env or credentials.json file
let googleAuth;
if(process.env.GOOGLE_SERVICE_ACCOUNT){
  try{
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    googleAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
    });
  }catch(err){
    console.error('Invalid GOOGLE_SERVICE_ACCOUNT JSON:', err);
    process.exit(1);
  }
} else {
  const keyPath = path.join(__dirname, 'credentials.json');
  if(!fs.existsSync(keyPath)){
    console.error('No credentials.json found and GOOGLE_SERVICE_ACCOUNT env var not set.');
    process.exit(1);
  }
  googleAuth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
  });
}

let drive, sheets;
googleAuth.getClient().then(client=>{
  drive = google.drive({ version: 'v3', auth: client });
  sheets = google.sheets({ version: 'v4', auth: client });
  console.log('Google client ready');
}).catch(err=>{
  console.error('Google auth error:', err);
  process.exit(1);
});

// allow CORS from anywhere (you can restrict to your Tilda domain)
app.use(function(req, res, next){
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (req, res) => res.send('tilda-uploader backend is running'));

app.post('/upload', upload.array('images', 10), async (req, res) => {
  try{
    const files = req.files || [];
    if(files.length === 0) return res.status(400).json({ success:false, error:'Hech qanday rasm yuklanmadi.' });
    if(files.length > 10) return res.status(400).json({ success:false, error:'Maksimal 10 ta rasm ruxsat etiladi.' });
    const totalSize = files.reduce((s,f)=>s+f.size,0);
    if(totalSize > 100 * 1024 * 1024) return res.status(400).json({ success:false, error:'Fayllarning umumiy hajmi 100MB dan oshdi.' });

    const { firstName, lastName, phone } = req.body;
    if(!firstName || !lastName || !phone){
      files.forEach(f=> { try{ fs.unlinkSync(f.path) }catch(e){} });
      return res.status(400).json({ success:false, error:'Ism, familiya yoki telefon raqami toʻliq emas.' });
    }

    const uploaded = [];
    for(const f of files){
      const fileMetadata = { name: f.originalname, parents: [DRIVE_FOLDER_ID] };
      const media = { mimeType: f.mimetype, body: fs.createReadStream(f.path) };
      const createRes = await drive.files.create({ resource: fileMetadata, media: media, fields: 'id' });
      const fileId = createRes.data.id;
      // make readable by anyone with link (optional)
      try{
        await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
      }catch(e){
        console.warn('Permission set failed', e.message);
      }
      const meta = await drive.files.get({ fileId, fields: 'id, name, webViewLink, webContentLink' });
      uploaded.push({ id: meta.data.id, name: meta.data.name, link: meta.data.webViewLink || ('https://drive.google.com/uc?id=' + meta.data.id) });
      // cleanup temp file
      try{ fs.unlinkSync(f.path); }catch(e){}
    }

    // append to sheet
    const now = new Date().toISOString();
    const fileNames = uploaded.map(u=>u.name).join(' | ');
    const fileLinks = uploaded.map(u=>u.link).join(' | ');
    const row = [ now, firstName, lastName, phone, uploaded.length.toString(), fileNames, fileLinks ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEETS_ID,
      range: 'Sheet1!A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });

    return res.json({ success:true, uploaded });
  }catch(err){
    console.error('Upload error:', err);
    // cleanup
    if(req.files) req.files.forEach(f=> { try{ fs.unlinkSync(f.path) }catch(e){} });
    return res.status(500).json({ success:false, error: (err.message || 'Server xatosi') });
  }
});

app.listen(PORT, ()=> console.log('Server listening on port', PORT));
