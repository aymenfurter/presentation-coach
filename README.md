<div align="center">

<img src="src/frontend/public/dart-logo.svg" width="100" height="100" alt="Presentation Coach" />

### Practice your pitch with an AI coach that sees your slides and hears your voice.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://reactjs.org/)
[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Faymenfurter%2Fpresentation-coach%2Fmain%2Finfra%2Fdeployment.json)

[How it works](#how-it-works) · [Tech Stack](#tech-stack) · [Getting Started](#getting-started)

<img src="fullpreview.png" alt="Presentation Coach" width="90%" />

</div>

---

## How it works

**Live practice:** Start a session and watch a welcome video from your AI coach. When you're ready, share your screen and present. After you finish, watch a brief review video, then get a detailed analysis of your performance.

**Analyze a recording:** Upload a video of a past presentation and get the same analysis—pacing, slide quality, and actionable suggestions.

### Analysis includes

- **Pacing timeline** — See where you spoke too fast, too slow, or at a good pace
- **Slide-by-slide scores** — Each slide gets a quality rating with specific improvements
- **Checklist evaluation** — Did you cover the key points for your presentation type?
- **Timestamped suggestions** — Click any feedback item to jump to that moment in the video

<div align="center">
<img src="demorun.gif" alt="Demo" width="85%" />
</div>

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Backend | Python, Flask, WebSockets |
| Frontend | React, TypeScript, Fluent UI, Vite |
| AI | Microsoft Foundry (GPT-4.1), Azure Content Understanding |
| Infrastructure | Azure Container Apps, Bicep |

---

## Getting Started

> Requires Python 3.11+, Node.js 20+, FFmpeg, and an Azure subscription with access to Microsoft Foundry and Content Understanding.

### One-click deployment

Click the button below to deploy directly to Azure:

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Faymenfurter%2Fpresentation-coach%2Fmain%2Finfra%2Fdeployment.json)

### Run locally

```bash
git clone https://github.com/aymenfurter/presentation-coach.git
cd presentation-coach
cp .env.example .env   # Add your Azure credentials
./scripts/start.sh     # Installs dependencies and starts the app
```

### Deploy with Azure Developer CLI

```bash
azd auth login
azd up
```
