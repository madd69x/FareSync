<div align="center">
  
  # ⚡ FareSync
  **The Ultimate Transit Aggregator & Smart Pricing Layer for Urban India.**
  
  [![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/expo-1C1E24?style=for-the-badge&logo=expo&logoColor=#D04A37)](https://expo.dev/)
  [![Hackathon](https://img.shields.io/badge/OneJourney_Hackathon-2026-00E5FF?style=for-the-badge)](#)
  [![Track](https://img.shields.io/badge/Track-Transparent_Pricing-FF2E93?style=for-the-badge)](#)

  <p align="center">
    <i>Stop searching. Start syncing.</i><br>
    Built by <b>Team Delta Transit</b> for the OneJourney Mobility Hackathon.
  </p>
</div>

---

## 🚀 The Vision
The modern Indian commuter suffers from "app fatigue"—juggling Uber, Ola, and Rapido to escape arbitrary surge pricing. **FareSync** is an intelligent aggregator layer designed to sit natively inside the OneJourney Super App. It allows users to compare live fares across all major fleets in a single tap and bypasses surge pricing using predictive algorithms, routing the booking via zero-friction deep links.

---

## 📸 App Interface

*(Replace these placeholder links with actual screenshots of your app)*
<div align="center">
  <img src="https://via.placeholder.com/250x500/121212/00E5FF?text=Dashboard+Screen" width="250" />
  <img src="https://via.placeholder.com/250x500/121212/FF2E93?text=Live+Fare+Matrix" width="250" />
  <img src="https://via.placeholder.com/250x500/121212/00FF66?text=SmartWait+AI" width="250" />
</div>

---

## ✨ Core Features & USP

| Feature | Description |
| :--- | :--- |
| 📊 **Parallel Fare Matrix** | Concurrently calculates and ranks rates across Bikes, Autos, Cabs, and SUVs from multiple platforms. |
| 🧠 **SmartWait AI** | A standout predictive feature. If a user searches during a peak 1.4x surge, the UI proactively recommends waiting: *"💡 Market demand dropping soon. Wait 12 mins to save ~20%."* |
| 🔗 **Zero-Friction Deep Links** | Tapping "Book" passes GPS coordinates directly into the native Uber/Ola app via Intent URIs, executing the transaction flawlessly. |
| 🗺️ **Context-Aware Routing** | Integrates with the **Google Maps Directions API** to base pricing algorithms on real-world distance and traffic durations. |
| 🌙 **Premium Material UI** | A stunning, high-conversion AMOLED dark-mode interface utilizing React Native LayoutAnimations for native Android fluidity. |

---

## 💼 Business Impact for OneJourney

Why does OneJourney need FareSync? 
1. **The "Kayak" Model:** By offering the ultimate comparison tool, users will open OneJourney *first* every single time they commute, drastically increasing Daily Active Users (DAUs).
2. **User Trust:** By actively warning users about surge pricing via SmartWait AI, OneJourney builds radical brand loyalty. 

---

## 🛠️ System Architecture

FareSync operates on a highly optimized, asynchronous data flow:

```mermaid
graph TD;
    A[User Inputs Destination] -->|Origin/Dest Data| B(Google Maps API);
    B -->|Distance & ETA| C{FareSync Pricing Engine};
    C -->|Calculates Base + Per/Km| D[Apply Time-of-Day Surge];
    D -->|Check > 1.4x Surge| E[Trigger SmartWait AI Banner];
    D --> F[Sort Array: Cheapest to Highest];
    F --> G[Render UI Matrix];
    G -->|User Taps 'Book'| H[Execute Native Deep Link uber://];