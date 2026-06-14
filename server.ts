import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { google } from 'googleapis';
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Helper to authenticate with Google Sheets
async function getGoogleSheetsClient() {
  const credentials_email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const credentials_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!credentials_email || !credentials_key) {
    return null;
  }
  const auth = new google.auth.JWT({
    email: credentials_email,
    key: credentials_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

// Ensure the Google Sheet structure is prepared
async function setupGoogleSheet() {
  const sheets = await getGoogleSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!sheets || !spreadsheetId) return;

  try {
    // Just write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:H1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Trip ID', 'User Email', 'Origin', 'Destination', 'Distance (km)', 'Duration (min)', 'Fare Paid', 'Date']],
      },
    });
    console.log('Google Sheet initialized');
  } catch (err: any) {
    console.error('Error setting up Google Sheet:', err.message);
  }
}

// API Routes
app.get('/api/search', async (req: any, res: any) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);
    const data = await response.json();
    
    // Format to match old nominatim format somewhat or just send as is
    // Old nominatim: [{ display_name: "...", name: "...", lat: "1", lon: "2" }]
    const formatted = data.features.map((f: any) => {
      const parts = [f.properties.name, f.properties.city, f.properties.state].filter(Boolean);
      const uniqueParts = [...new Set(parts)];
      return {
        display_name: uniqueParts.join(', '),
        name: f.properties.name,
        lat: f.geometry.coordinates[1].toString(),
        lon: f.geometry.coordinates[0].toString()
      };
    });
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/api/trips', async (req: any, res: any) => {
  const { origin, destination, distanceKm, durationMin, farePaid, userId, userEmail } = req.body;
  const tripId = Array.from(Array(16), () => Math.floor(Math.random() * 36).toString(36)).join('');
  const createdAt = new Date().toISOString();

  res.json({ success: true, tripId });

  // Sync to Google Sheets asynchronously
  try {
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (sheets && spreadsheetId) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:A',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[tripId, userEmail || userId, origin, destination, distanceKm, durationMin, farePaid, createdAt]],
        },
      });
      console.log('Synced trip to Google Sheets');
    }
  } catch (err: any) {
    console.error('Failed to sync to Google Sheets:', err.message);
  }
});

app.post('/api/insight', async (req: any, res: any) => {
  const { origin, destination, fares } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.json({ insight: "AI insights are not available. Please configure the GEMINI_API_KEY." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are a smart assistant in FareSync. User is looking for rides from "${origin}" to "${destination}".
Available fares: 
${JSON.stringify(fares.map((f: any) => `${f.platform} ${f.type}: ₹${f.price} (${f.eta} min away, ${f.duration} min ride)`))}

Provide a very short, helpful insight (max 2 sentences) recommending the best option. Mention if the user should wait or book now. Do NOT use markdown.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    res.json({ insight: response.text });
  } catch (err: any) {
    console.error('Gemini error:', err);
    res.json({ insight: "Currently unable to generate AI insight." });
  }
});

async function startServer() {
  await setupGoogleSheet();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
