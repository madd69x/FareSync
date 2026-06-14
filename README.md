# FareSync - The Smart Ride-Hailing Aggregator

**FareSync** is a unified ride-hailing aggregator application designed to help users find the best, cheapest, and fastest rides from popular platforms like Uber, Ola, Rapido, inDrive, BluSmart, and Namma Yatri. By leveraging real-time AI insights and intuitive mapping, FareSync brings transparency and choice directly to the user's fingertips.

It deep-links directly onto the respective platforms, meaning a user can plan exactly what they want in one interface before being transferred to their provider of choice for final booking.

## Features

- 🚕 **Multi-Platform Aggregation**: Compares rides and prices from major ride-hailing services (Uber, Ola, Rapido, etc.), categorizing by cab, auto, bike, and SUV.
- ✨ **AI Smart Insights**: Uses Google's **Gemini AI** to analyze current fares and distance, instantly providing customized insights (e.g., whether you should book now or wait out a surge).
- 📍 **Deep-Linked Booking**: Instantly transfers origin and destination coordinates directly to the Uber, Ola, or Rapido app natively or via web using pre-filled parameters. 
- 📊 **Historical Trip & Spend Tracking**: Visualizes past travel history and spending analytics using **Recharts**, grouped by vehicle categories.
- ☁️ **Cloud Data Sync**: Saves users' trip histories natively to **Firebase Firestore** and exports data to **Google Sheets** for deeper spreadsheet management.
- 🗺 **Interactive Web Maps**: Built with React Native Web Maps / Leaflet for dynamic, custom-styled map routing between destinations.

## Tech Stack

- **Frontend**: React (via React Native for Web), Tailwind CSS, Vite, Recharts, Lucide React
- **Backend / Routing**: Express.js, TypeScript
- **Database / Auth**: Firebase (Auth & Firestore)
- **AI & Integrations**: 
  - `@google/genai` (Gemini API)
  - Google Sheets API v4
  - OSRM / Komoot Photon API (for fast geocoding and routing metrics)

## Pre-Requisites

Make sure you have Node.js and npm installed on your machine.
You will also need various API keys to unleash the full capability of the app.

## Quick Start

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd <repository_directory>
   ```

2. **Install the dependencies:**
   ```bash
   npm install
   ```

3. **Configure the Environment:**
   A `.env.example` file is included in the root. Rename or copy it to `.env` and fill out your keys:
   ```env
   # Used for backend JWTs (if applicable)
   JWT_SECRET=supersecret123

   # JSON details from a Google Cloud Service Account
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

   # Target Spreadsheet ID to export user trip data
   GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here

   # Gemini API Key for Smart Ride Insights
   GEMINI_API_KEY=your_gemini_api_key

   # Google Maps Platform Key (for Address autocomplete / map UI rendering)
   GOOGLE_MAPS_PLATFORM_KEY=your_google_maps_key
   ```

4. **Connect Firebase:**
   Ensure that the `firebase-applet-config.json` file is correctly populated with your Firebase project properties so the client successfully maps to your backend Firestore cluster.

5. **Start the development server:**
   ```bash
   npm run dev
   ```

   The app will run locally on `http://localhost:3000`.

## Scripts

- `npm run dev`: Runs the application in development mode.
- `npm run build`: Bundles the full-stack application (frontend + backend ESBuilds).
- `npm run start`: Starts the production build node server.

## Overview of Operation
- Login via Google authentication or email/password.
- Search for a pickup location and dropoff destination.
- The app automatically calculates estimates and standard pricing brackets, and routes it to the Gemini AI to determine if prices are recommended or inflated.
- Filter by preferred vehicle types or sort by ETA and Pricing.
- Press **Book Ride** to securely transition directly to the chosen operator's domain (or mobile app) pre-filled with pickup and dropoff locations using precise deep links.

## License
Apache License 2.0
