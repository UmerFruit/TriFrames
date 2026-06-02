import os
import uuid
import tempfile
import subprocess
import threading
import zipfile
import cv2
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = 5000 * 1024 * 1024  # 5GB max
jobs = {}

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'Video file is too large! Please upload a smaller file.'}), 413

def build_ffmpeg_command(input_path, output_dir, mode, value, color_mode):
    output_pattern = os.path.join(output_dir, "frame_%04d.jpg")
    vf_filters = []
    
    cmd = ["ffmpeg", "-y", "-hwaccel", "auto", "-threads", "0"]
    if mode in ['seconds', 'minutes']: cmd.extend(["-skip_frame", "nokey"])
    
    cmd.extend(["-i", input_path])

    if mode == 'seconds': vf_filters.append(f"fps=1/{value}")
    elif mode == 'minutes': vf_filters.append(f"fps=1/{float(value) * 60}")
    elif mode == 'nth':
        vf_filters.append(f"select='not(mod(n,{int(value)}))'")
        vf_filters.append("setpts=N/FRAME_RATE/TB") 

    if color_mode == 'grey': vf_filters.append("format=gray")

    cmd.extend(["-vf", ",".join(vf_filters), "-q:v", "2", output_pattern])
    return cmd

def process_video_task(job_id, video_path, mode, value, color_mode, frame_dir):
    """Background worker now receives the pre-made frame_dir."""
    try:
        cmd = build_ffmpeg_command(video_path, frame_dir, mode, value, color_mode)
        # Run FFmpeg (This populates the frame_dir over time)
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # Once FFmpeg finishes, zip the folder contents
        zip_temp = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        zip_path = zip_temp.name
        zip_temp.close()
        
        filenames = sorted([f for f in os.listdir(frame_dir) if f.endswith('.jpg')])
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for filename in filenames:
                zf.write(os.path.join(frame_dir, filename), arcname=filename)
        
        # Mark as fully done
        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['file'] = zip_path
            
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['message'] = str(e)
    finally:
        if os.path.exists(video_path): os.remove(video_path)


@app.route('/extract', methods=['POST'])
def extract_async():
    if 'video' not in request.files: return jsonify({'error': 'No video file provided'}), 400
    video = request.files['video']
    mode = request.form.get('mode', 'seconds')
    value = request.form.get('value', '1')
    color_mode = request.form.get('color_mode', 'rgb')

    job_id = str(uuid.uuid4())
    
    # 1. Save video
    tmp_vid = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(video.filename)[1])
    video.save(tmp_vid.name)
    tmp_vid.close()

    # 2. Create the output directory IMMEDIATELY so we can poll it
    frame_dir = tempfile.mkdtemp()
    
    # 3. Calculate metadata instantly
    cap = cv2.VideoCapture(tmp_vid.name)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.release()

    interval_sec, interval_frames = 0, 1
    if mode == 'seconds':
        interval_sec = float(value)
        interval_frames = interval_sec * fps
    elif mode == 'minutes':
        interval_sec = float(value) * 60
        interval_frames = interval_sec * fps
    elif mode == 'nth':
        interval_frames = int(value)
        interval_sec = interval_frames / fps

    # Register job with all tracking info
    jobs[job_id] = {
        'status': 'processing',
        'frame_dir': frame_dir,
        'fps': fps,
        'interval_sec': interval_sec,
        'interval_frames': interval_frames
    }

    # Start thread
    threading.Thread(target=process_video_task, args=(job_id, tmp_vid.name, mode, value, color_mode, frame_dir)).start()

    return jsonify({'job_id': job_id, 'status_url': f'/status/{job_id}'}), 202


@app.route('/status/<job_id>', methods=['GET'])
def check_status(job_id):
    job = jobs.get(job_id)
    if not job: return jsonify({'error': 'Job not found'}), 404

    # DYNAMIC STREAMING LOGIC: Always check the folder for new files
    current_frames = []
    if os.path.exists(job['frame_dir']):
        filenames = sorted([f for f in os.listdir(job['frame_dir']) if f.endswith('.jpg')])
        for i, filename in enumerate(filenames):
            current_frames.append({
                'frame_number': int(i * job['interval_frames']),
                'timestamp': round(i * job['interval_sec'], 3),
                'filename': filename
            })

    response = {
        'status': job['status'],
        'frames': current_frames # Send whatever is extracted so far
    }
    
    if job['status'] == 'completed':
        response['download_url'] = f'/download/{job_id}'
    elif job['status'] == 'error':
        response['message'] = job.get('message', 'Unknown error')

    return jsonify(response)


@app.route('/preview/<job_id>/<filename>', methods=['GET'])
def serve_preview(job_id, filename):
    job = jobs.get(job_id)
    if not job or 'frame_dir' not in job: return "Image not found", 404
    return send_file(os.path.join(job['frame_dir'], filename), mimetype='image/jpeg')

@app.route('/download/<job_id>', methods=['GET'])
def download_result(job_id):
    job = jobs.get(job_id)
    if not job or job['status'] != 'completed': return jsonify({'error': 'File not ready'}), 404
    return send_file(job['file'], mimetype='application/zip', as_attachment=True, download_name='frames.zip')

if __name__ == '__main__':
    app.run(debug=True, port=5000)