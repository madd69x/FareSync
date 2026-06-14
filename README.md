<div align="center">
  <img src="https://ui-avatars.com/api/?name=F+S&background=00E5FF&color=161618&size=120&bold=true&rounded=true" alt="FareSync Logo" width="100" />

  # ⚡ FareSync
  
  **The Intelligent, Multi-Platform Ride-Hailing Aggregator**
  
  Compare fares, avoid surges with AI, and book the best ride instantly.<br/>
  Supported Platforms: **Uber, Ola, Rapido, inDrive, BluSmart, Namma Yatri**
  
  <br />

  ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
  ![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
  ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
  ![Gemini API](https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)

</div>

---

## 🚀 The Vision

Finding a ride shouldn't mean jumping between five different apps while watching prices surge. **FareSync** solves the modern travel dilemma. It provides a unified interface to instantly compare fares across all major ride-hailing networks. 

But it's not just a comparison tool—FareSync is powered by **Google Gemini AI** to act as your intelligent travel assistant. It analyzes real-time pricing brackets, identifies surge multipliers, and tells you whether to book now or wait for a better fare.

<br />

## ✨ Key Features

### 🚙 Universal Aggregation
Compare rides from **Uber, Ola, Rapido**, and more in a single unified dashboard. Filter your preferences seamlessly across categories like Cabs, Autos, Bikes, and SUVs.

### 🧠 Smart Insights (Powered by Gemini)
Stop guessing during peak hours. Our AI engine actively monitors the quoted fares against standard base rates for your city and distance, immediately warning you of surges and suggesting smart booking decisions.

### 🔗 Frictionless Deep Linking
Once you choose the winning fare, FareSync instantly transitions you to the provider's app or web portal. We auto-populate your precise **pickup and drop-off coordinates** so your booking is finalized with one tap.

### 📊 Personal Travel Analytics
Automatically sync and track your historical ride data. Visualize your spending patterns grouped by vehicle categories with beautiful, interactive **Recharts** visualizations.

### ☁️ Enterprise-Grade Data Sync
Your data is securely stored natively in **Firebase Firestore** with built-in OAuth authentication. Need even deeper control? Export your trip histories directly to **Google Sheets** for external accounting.

---

## 🛠 Tech Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend** | React, React Native (Web Maps), Tailwind CSS, Vite, Framer Motion, Lucide |
| **Backend** | Express.js, Node.js, TypeScript |
| **Database & Auth** | Firebase Authentication, Google Firestore |
| **Machine Learning** | Google Gemini API (`@google/genai`) |
| **Integrations** | Google Maps Platform, Google Sheets API v4, OSRM / Komoot Photon |

---

## ⚡ Getting Started

Ready to run FareSync locally? Follow these steps to get your environment up and running.

### 1. Clone & Install
```bash
git clone https://github.com/madd69x/FareSync/
cd FareSync
npm install
```

### 2. Configure Environment Secrets
Rename `.env.example` to `.env` in the root directory. You will need to provision API keys from Google Cloud and Gemini.

```env
# Backend JWT Config
JWT_SECRET=supersecret123

# Google Cloud Service Account (for Sheets Export)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Google Maps Platform (Maps & Places)
GOOGLE_MAPS_PLATFORM_KEY=your_google_maps_key
```

### 3. Connect Firebase
Ensure your `firebase-applet-config.json` is correctly set up with the Google Cloud project configuration to enable Firestore and Auth capabilities.

### 4. Ignite the Server
```bash
# Launch the development server
npm run dev
```
> Your app will be live at `http://localhost:3000`

---

## 📦 Production Build
When you're ready to deploy:
```bash
npm run build   # Bundles the frontend SPA and compiles the Express backend
npm run start   # Starts the Node.js production server
```

<br />

<div align="center">
  <i>Designed with precision. Built for speed.</i><br />
  <b>Apache License 2.0</b>
</div>
