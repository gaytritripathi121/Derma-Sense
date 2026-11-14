# DermaSense AI — Explainable CNN-Based Skin Disease Screening System

DermaSense AI is a full-stack academic B.Tech Computer Science web application built strictly in **JavaScript (Node.js + Express + React JSX + TensorFlow.js)**. It acquires, validates, and trains a genuine 6-class convolutional neural network directly on the official **PAD-UFES-20** clinical skin lesion dataset from Mendeley Data (`zr7vgbcyr2 v1`), computes real gradient-weighted class activation maps (**Grad-CAM**), applies an independent deterministic patient-history rule engine, and produces Safe Corner routines and PDF screening reports.

> **Medical Disclaimer:** DermaSense AI is an experimental academic screening prototype. It does **not** provide a medical diagnosis, raw model softmax confidence is not clinical diagnostic probability, and a benign-looking output never rules out skin cancer. Always consult a qualified dermatologist.

---

## Key Technical Architecture

- **100% JavaScript ES6+ Stack:** Node.js, Express, React 19 (`.jsx`), Vite, Tailwind CSS v4, Recharts, jsPDF, Sharp, Multer, Zod. Zero TypeScript and zero Python/Flask/Streamlit dependencies.
- **Official PAD-UFES-20 Pipeline (`server/ml/datasetLoader.js`):**
  - Resumable chunked download directly from Mendeley Data (`metadata.csv` + `pad-ufes-20.zip`), plus manual ZIP/CSV fallback upload.
  - Strict 6-class mapping (`0: ACK`, `1: BCC`, `2: MEL`, `3: NEV`, `4: SCC` incl. Bowen's disease, `5: SEK`).
  - Patient-and-lesion Union-Find grouped stratified splitting (`70% train / 15% val / 15% test`) guaranteeing zero patient or lesion leakage across splits.
- **Genuine TensorFlow.js CNN (`server/ml/model.js` & `train.js`):**
  - Lightweight depthwise-separable CNN (`DermaNet-DSConv-v1`) on `192×192×3` RGB inputs.
  - Class-weighted categorical cross-entropy loss to address dataset imbalance (especially Melanoma).
  - Training-only geometric/photometric data augmentation, real epoch telemetry, early stopping, best/latest checkpoints, and full held-out test evaluation (accuracy, macro/weighted precision/recall/F1, 6×6 confusion matrix, one-vs-rest ROC-AUC, and ECE calibration bins).
- **Grad-CAM Explainability (`server/ml/gradcam.js`):**
  - Uses `tf.grad` from pre-softmax class logits back to `gradcam_target_relu`, channel-averaged gradient weights, ReLU rectification, and bicubic Jet colormap upsampling via `sharp`.
- **Safety & Separation of Concerns:**
  - `server/safety/imageQuality.js`: Format, size, dimension, Laplacian blur, and exposure validation.
  - `server/safety/confidence.js`: `70%` screening confidence gate triggering explicit `LOW CONFIDENCE` alerts and withholding condition-specific Safe Corner advice.
  - `server/rules/ruleEngine.js`: Independent JSON rule base (`rules.json`) evaluating self-reported clinical history without altering CNN scores or falsely claiming SHAP attribution.
  - Ephemeral session-scoped history (`server/services/sessionStore.js`), automated PDF export (`server/reports/pdfGenerator.js`), and `.ics` calendar export (`server/safeCorner/calendarExport.js`).

---

## Setup & Commands

```bash
# Install dependencies
npm install

# Run JS/JSX syntax & zero-TypeScript check
npm run lint

# Run automated unit and API tests
npm test

# Start development server (Express API + Vite middleware on port 3000)
npm run dev

# Build frontend for production and run
npm run build
npm start
```
