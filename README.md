# Frame Triage

A minimal, dark-themed video frame extraction tool. No fluff. Extract frames by interval (every Nth frame, time-based, or minute-based), choose RGB or greyscale output, and download all frames as a ZIP.

## Features

- **Multiple extraction modes**: Every Nth frame, every X seconds, or every X minutes
- **Color modes**: RGB color or greyscale
- **Dark theme**: Clean, minimal interface
- **Batch download**: Export all frames as a ZIP with metadata in filenames
- **Video metadata**: See FPS, duration, total frames, and extraction count at a glance
- **Lightbox preview**: Click any frame for full-size view

## Requirements

- Python 3.8+ (backend)
- Node.js 16+ (frontend)

## Quick Start

### One-command startup (Windows)

```bash
./start.ps1
```

This launches both backend and frontend. Open http://localhost:5173 in your browser.

### Manual startup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
# Runs on http://localhost:5000
```

**Frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

## Project Structure

```
triageTool/
├── backend/
│   ├── app.py              # Flask API
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component
│   │   ├── App.module.css  # Component styles
│   │   ├── main.jsx        # React entry point
│   │   └── index.css       # Global styles
│   ├── index.html          # HTML template
│   ├── vite.config.js      # Vite config (proxies /extract and /download-zip to backend)
│   └── package.json        # NPM dependencies
├── .gitignore
├── README.md
└── start.ps1               # Startup script
```

## API Endpoints

### POST /extract
Extract frames from a video file.

**Parameters:**
- `video`: Video file (multipart/form-data)
- `mode`: 'nth' | 'seconds' | 'minutes'
- `value`: Interval value (number)
- `color_mode`: 'rgb' | 'grey'

**Response:**
```json
{
  "frames": [
    {
      "frame_number": 0,
      "timestamp": 0.0,
      "image": "base64_encoded_jpeg"
    }
  ],
  "meta": {
    "fps": 30.0,
    "duration": 100.5,
    "total_frames": 3000,
    "extracted_count": 100
  }
}
```

### POST /download-zip
Download extracted frames as ZIP.

**Body:**
```json
{
  "frames": [{ "frame_number": 0, "timestamp": 0.0, "image": "..." }]
}
```

**Response:** ZIP file with JPEG frames

## Configuration

**Backend (app.py):**
- `MAX_CONTENT_LENGTH`: Max upload size (default: 500MB)
- `JPEG_QUALITY`: Output quality (default: 85%)
- `PORT`: Flask server port (default: 5000)

**Frontend (vite.config.js):**
- `port`: Dev server port (default: 5173)
- `proxy`: API target (default: http://localhost:5000)

## Development

**Dependencies:**
- Backend: Flask, flask-cors, opencv-python
- Frontend: React, Vite

**Code style:**
- Minimal, clean architecture
- Dark theme with neon accent (#e8ff47)
- Responsive CSS Grid layout

## License

MIT

## Author

Created as a minimal frame extraction utility.
