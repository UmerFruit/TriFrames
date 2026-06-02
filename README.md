# TriFrames Triage

A video frame extraction tool. No fluff. Extract frames by interval (every Nth frame, time-based, or minute-based), choose RGB or greyscale output, and download all frames as a ZIP.

Built with an asynchronous FFmpeg backend to handle massive files (MKV, MP4, etc.), utilizing hardware acceleration for fast extractions.

## Features

- **Asynchronous Processing**: Non-blocking background workers prevent timeouts on long videos.
- **Real-Time Streaming UI**: Watch frames populate the grid instantly as they are extracted.
- **Hardware Acceleration**: GPU-accelerated FFmpeg decoding with keyframe-skipping for large files.
- **Multiple extraction modes**: Every Nth frame, every X seconds, or every X minutes
- **Color modes**: RGB color or greyscale
- **Batch download**: Export all frames directly to a server-side ZIP archive.
- **Lightbox preview**: Click any frame for full-size view

## Requirements

- **FFmpeg**: Must be installed and added to your system PATH (`sudo apt install ffmpeg`, `brew install ffmpeg`, or downloaded for Windows).
- Python 3.8+ (backend)
- Node.js 16+ (frontend)

## Quick Start

### One-command startup (Windows)

```bash
./start.bash

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
│   ├── app.py              # Flask API with Background Threading
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React component with async polling
│   │   ├── App.module.css  # Component styles
│   │   ├── main.jsx        # React entry point
│   │   └── index.css       # Global styles
│   ├── index.html          # HTML template
│   ├── vite.config.js      # Vite config
│   └── package.json        # NPM dependencies
├── .gitignore
├── README.md
└── start.bash              # Startup script

```

## API Endpoints

### POST /extract

Accepts the video file and starts the background FFmpeg task.

**Parameters (multipart/form-data):**

* `video`: Video file
* `mode`: 'nth' | 'seconds' | 'minutes'
* `value`: Interval value (number)
* `color_mode`: 'rgb' | 'grey'

**Response:**

```json
{
  "job_id": "uuid-string",
  "status_url": "/status/uuid-string"
}

```

### GET /status/<job_id>

Poll this endpoint to stream the extraction progress in real-time.

**Response (while processing):**

```json
{
  "status": "processing",
  "frames": [
    { "frame_number": 0, "timestamp": 0.0, "filename": "frame_0001.jpg" }
  ]
}

```

**Response (when finished):** Returns `status: "completed"` and injects a `download_url` into the JSON payload.

### GET /preview/<job_id>/

Serves the raw JPEG file directly from the temporary server extraction directory. Used by the React frontend to display grid images without consuming excessive RAM.

### GET /download/<job_id>

Downloads the final, fully-compiled ZIP file containing all extracted frames.

## Configuration

**Backend (app.py):**

* `MAX_CONTENT_LENGTH`: Max upload size (default: 5GB)
* `PORT`: Flask server port (default: 5000)

**Frontend (vite.config.js / App.jsx):**

* `port`: Dev server port (default: 5173)
* `API`: Target backend URL (default: http://localhost:5000)

## Development

**Dependencies:**

* Backend: Flask, Flask-Cors, opencv-python (for metadata calculation), FFMPEG (for video decoding)
* Frontend: React, Vite

## License

MIT

```

