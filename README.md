<div align="center">

# 🎯 Presentation Coach

<img src="src/frontend/public/dart-logo.svg" width="120" height="120" alt="Presentation Coach Logo" />

### A multimodal AI assistant that sees, hears, and coaches you in real-time.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Azure AI](https://img.shields.io/badge/Azure%20AI-Powered-0078D4)](https://azure.microsoft.com/en-us/solutions/ai/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue)](https://www.python.org/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB)](https://reactjs.org/)
[![Azure Developer CLI](https://img.shields.io/badge/azd-Compatible-0078D4)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/)

[Features](#-features) • [Getting Started](#-getting-started) • [Deployment](#-deployment) • [License](#-license)

---

<img src="fullpreview.png" alt="Presentation Coach Preview" width="90%" />

<br/>

<img src="demorun.gif" alt="Demo" width="90%" />

</div>

---

## 📖 About

**Presentation Coach** is a reference implementation demonstrating the power of multimodal AI. It acts as a virtual coach for startup founders, providing real-time feedback on their pitches.

By combining **Azure Voice Live API** for low-latency speech interaction and **Azure Content Understanding** for visual analysis of slides, it creates a holistic coaching session that mimics a real human interaction.

---

## ✨ Features

<div align="center">

| Feature | Description |
|:-------:|-------------|
| 🎙️ **Real-time Voice** | Low-latency speech-to-speech interaction using **Azure Voice Live API** |
| 👁️ **Visual Understanding** | Analyzes your screen share and slides using **Azure Content Understanding** |
| 🧠 **Smart Coaching** | **GPT-4.1** orchestrates the session with actionable feedback |
| ⚡ **Live Feedback** | Instantaneous responses via WebSockets for fluid conversation |
| 📊 **Structured Reports** | Generates detailed evaluation reports after every session |

</div>

### 🛠️ Tech Stack

<div align="center">

| Layer | Technologies |
|:-----:|--------------|
| **AI Services** | Azure Voice Live API, Azure Content Understanding, Microsoft Foundry (GPT-4.1-mini) |
| **Backend** | Python (Flask), WebSockets |
| **Frontend** | React, Fluent UI, Vite |
| **Infrastructure** | Azure Container Apps, Bicep, Azure Developer CLI (`azd`) |

</div>

## Getting Started

### Prerequisites

- **Azure Subscription** with access to:
  - Microsoft Foundry (GPT-4.1 & GPT-4.1-mini)
  - Azure Voice Live API
  - Azure AI Foundry
- **Development Tools**:
  - Python 3.11+
  - Node.js 20+
  - FFmpeg
  - [Azure Developer CLI (azd)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/aymenfurter/presentation-coach.git
   cd presentation-coach
   ```

2. **Configure Environment**
   Create a `.env` file in the root directory:

   ```ini
   AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
   AZURE_OPENAI_API_KEY=your-openai-api-key
   MODEL_DEPLOYMENT_NAME=gpt-4o
   ANALYSIS_MODEL_DEPLOYMENT_NAME=gpt-4.1-mini
   AZURE_AI_RESOURCE_NAME=your-ai-resource-name
   AZURE_AVATAR_CHARACTER=isabella
   CONTENT_UNDERSTANDING_ENDPOINT=https://your-content-understanding-resource.openai.azure.com/
   CONTENT_UNDERSTANDING_KEY=your-content-understanding-key
   ```

3. **Install Dependencies**

   **System:**
   ```bash
   sudo apt-get update && sudo apt-get install -y nodejs npm ffmpeg
   ```

   **Backend:**
   ```bash
   cd src/backend
   pip install -r requirements.txt
   ```

   **Frontend:**
   ```bash
   cd src/frontend
   npm install
   ```

### Running the App

Use the helper script to start both backend and frontend:

```bash
./scripts/start.sh
```

Open your browser and navigate to: `http://localhost:8015`

## Deployment

This project is designed to be deployed to Azure using the Azure Developer CLI (`azd`).

1. **Login to Azure**
   ```bash
   azd auth login
   ```

2. **Provision and Deploy**
   ```bash
   azd up
   ```

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with Azure AI</sub>
</div>
