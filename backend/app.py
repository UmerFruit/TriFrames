import os
import cv2
import base64
import zipfile
import tempfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from io import BytesIO

app = Flask(__name__)
CORS(app)

app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max

def extract_frames(video_path, mode, value, color_mode='rgb'):
    """
    mode: 'nth' -> every Nth frame
          'seconds' -> every X seconds
          'minutes' -> every X minutes
    color_mode: 'rgb' -> color frames
                'grey' -> greyscale frames
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video file")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    # Calculate interval based on mode
    if mode == 'nth':
        interval_frames = max(1, int(value))
    else:
        interval_seconds = float(value) * (60 if mode == 'minutes' else 1)
        interval_frames = max(1, int(fps * interval_seconds))

    frames = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % interval_frames == 0:
            timestamp = frame_idx / fps if fps > 0 else 0
            frames.append({
                'frame_number': frame_idx,
                'timestamp': round(timestamp, 3),
                'image': encode_frame(frame, color_mode)
            })
        frame_idx += 1

    cap.release()
    return frames, round(duration, 2), total_frames, round(fps, 2)


def encode_frame(frame, color_mode='rgb'):
    if color_mode == 'grey':
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode('utf-8')


@app.route('/extract', methods=['POST'])
def extract():
    if 'video' not in request.files:
        return jsonify({'error': 'No video file provided'}), 400

    video = request.files['video']
    mode = request.form.get('mode', 'nth')
    value = request.form.get('value', '1')
    color_mode = request.form.get('color_mode', 'rgb')

    try:
        value = float(value)
        if value <= 0:
            raise ValueError()
    except ValueError:
        return jsonify({'error': 'Invalid interval value'}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(video.filename)[1]) as tmp:
        video.save(tmp.name)
        tmp_path = tmp.name

    try:
        frames, duration, total_frames, fps = extract_frames(tmp_path, mode, value, color_mode)
    except Exception as e:
        os.unlink(tmp_path)
        return jsonify({'error': str(e)}), 500

    os.unlink(tmp_path)

    return jsonify({
        'frames': frames,
        'meta': {
            'duration': duration,
            'total_frames': total_frames,
            'fps': fps,
            'extracted_count': len(frames)
        }
    })


@app.route('/download-zip', methods=['POST'])
def download_zip():
    data = request.get_json()
    frames = data.get('frames', [])

    if not frames:
        return jsonify({'error': 'No frames provided'}), 400

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, frame in enumerate(frames):
            img_data = base64.b64decode(frame['image'])
            filename = f"frame_{frame['frame_number']:06d}_t{frame['timestamp']}s.jpg"
            zf.writestr(filename, img_data)

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name='frames.zip'
    )


if __name__ == '__main__':
    app.run(debug=True, port=5000)
