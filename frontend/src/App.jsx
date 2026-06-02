import { useState, useRef, useCallback } from 'react'
import styles from './App.module.css'

const API = 'http://localhost:5000'

export default function App() {
  const [mode, setMode] = useState('nth')
  const [value, setValue] = useState(30)
  const [colorMode, setColorMode] = useState('rgb')
  const [video, setVideo] = useState(null)
  const [videoName, setVideoName] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  
  const [jobId, setJobId] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [frames, setFrames] = useState([])
  const [lightbox, setLightbox] = useState(null)

  const fileRef = useRef()
  const dropRef = useRef()

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('video/')) loadVideo(file)
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) loadVideo(file)
  }

  const loadVideo = (file) => {
    setVideo(file)
    setVideoName(file.name)
    setError('')
    setJobId(null)
    setDownloadUrl(null)
    setFrames([])
    setLightbox(null)
  }

  const handleExtract = async () => {
    if (!video) return
    setLoading(true)
    setError('')
    setJobId(null)
    setDownloadUrl(null)
    setFrames([])
    setProgress('Uploading video...')

    const form = new FormData()
    form.append('video', video)
    form.append('mode', mode)
    form.append('value', value)
    form.append('color_mode', colorMode)

    try {
      const res = await fetch(`${API}/extract`, { method: 'POST', body: form })
      const contentType = res.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned HTML. Is Flask running on port 5000?")
      }
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start extraction')
      
      setJobId(data.job_id)
      setProgress('Extracting frames...')
      pollStatus(data.job_id)

    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const pollStatus = async (currentJobId) => {
    try {
      const res = await fetch(`${API}/status/${currentJobId}`)
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      // STREAMING: Always update frames state, even if status is still 'processing'
      if (data.frames) {
        setFrames(data.frames)
      }

      if (data.status === 'completed') {
        setLoading(false)
        setProgress('')
        setDownloadUrl(data.download_url)
      } else if (data.status === 'error') {
        throw new Error(data.message || 'Error processing video')
      } else {
        // FAST POLLING: Ping every 1 second to create a fluid streaming effect
        setTimeout(() => pollStatus(currentJobId), 1000)
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
      setProgress('')
    }
  }

  const handleDownload = () => {
    if (!downloadUrl) return
    const a = document.createElement('a')
    a.href = `${API}${downloadUrl}`
    a.download = 'frames.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const formatTimestamp = (s) => {
    const m = Math.floor(s / 60)
    const sec = (s % 60).toFixed(2).padStart(5, '0')
    return `${String(m).padStart(2, '0')}:${sec}`
  }

  const modeLabel = mode === 'nth' ? `every ${value} frame${value === 1 ? '' : 's'}` : `every ${value} ${mode}`

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.logo}><span className={styles.accent}>TRI</span>FRAMES</span>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          {/* Upload, Mode, Value, Color sections omitted for brevity but remain unchanged */}
          
          <section className={styles.section}>
            <label className={styles.sectionLabel}>VIDEO</label>
            <button
              ref={dropRef}
              className={`${styles.dropzone} ${video ? styles.dropzoneActive : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current.click()}
            >
              {video ? (
                <>
                  <span className={styles.fileIcon}>▶</span>
                  <span className={styles.fileName}>{videoName}</span>
                  <span className={styles.fileSub}>{(video.size / 1024 / 1024).toFixed(1)} MB</span>
                </>
              ) : (
                <>
                  <span className={styles.fileIcon}>↑</span>
                  <span className={styles.fileName}>Drop video here</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </section>

          <section className={styles.section}>
            <label className={styles.sectionLabel}>INTERVAL MODE</label>
            <div className={styles.modeGroup}>
              {['nth', 'seconds', 'minutes'].map((key) => (
                <button key={key} className={`${styles.modeBtn} ${mode === key ? styles.modeBtnActive : ''}`} onClick={() => setMode(key)}>
                  {key === 'nth' ? 'Every Nth Frame' : key === 'seconds' ? 'Every X Seconds' : 'Every X Minutes'}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <label className={styles.sectionLabel}>{mode === 'nth' ? 'FRAME INTERVAL' : mode === 'seconds' ? 'SECONDS' : 'MINUTES'}</label>
            <div className={styles.valueRow}>
              <button className={styles.stepBtn} onClick={() => setValue(v => Math.max(1, Number.parseFloat((v - (mode === 'nth' ? 1 : 0.5)).toFixed(2))))}>−</button>
              <input type="number" className={styles.valueInput} value={value} min={mode === 'nth' ? 1 : 0.1} step={mode === 'nth' ? 1 : 0.5} onChange={(e) => setValue(Math.max(mode === 'nth' ? 1 : 0.1, Number.parseFloat(e.target.value) || 1))} />
              <button className={styles.stepBtn} onClick={() => setValue(v => Number.parseFloat((v + (mode === 'nth' ? 1 : 0.5)).toFixed(2)))}>+</button>
            </div>
          </section>

          <section className={styles.section}>
            <label className={styles.sectionLabel}>COLOR MODE</label>
            <div className={styles.modeGroup}>
              {['rgb', 'grey'].map((key) => (
                <button key={key} className={`${styles.modeBtn} ${colorMode === key ? styles.modeBtnActive : ''}`} onClick={() => setColorMode(key)}>
                  {key === 'rgb' ? 'RGB' : 'Greyscale'}
                </button>
              ))}
            </div>
          </section>

          <button className={styles.extractBtn} onClick={handleExtract} disabled={!video || loading}>
            {loading ? 'PROCESSING...' : 'EXTRACT FRAMES'}
          </button>

          {downloadUrl && !loading && (
            <button className={styles.downloadBtn} onClick={handleDownload}>
               ↓ DOWNLOAD ZIP ({frames.length})
            </button>
          )}

          {error && <div className={styles.error}>{error}</div>}
        </aside>

        <main className={styles.main}>
          {/* Initial Empty State */}
          {!loading && frames.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>⬡</span>
              <span>Upload a video to begin extraction</span>
            </div>
          )}

          {/* Loading state ONLY when NO frames have been extracted yet */}
          {loading && frames.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.spinner} />
              <span className={styles.text}>{progress}</span>
            </div>
          )}

          {/* STREAMING UI: The Grid renders alongside a small streaming indicator */}
          {frames.length > 0 && (
            <>
              {loading && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent)' }}>
                   <span className={styles.spinner} style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                   <span style={{ fontSize: '13px', fontFamily: 'var(--mono)' }}>Streaming... ({frames.length} frames extracted)</span>
                </div>
              )}
              
              <div className={styles.grid}>
                {frames.map((f, i) => (
                  <button key={i} className={styles.frameCard} onClick={() => setLightbox(f)}>
                    <img
                      src={`${API}/preview/${jobId}/${f.filename}`}
                      alt={`Frame ${f.frame_number}`}
                      className={styles.frameImg}
                      loading="lazy"
                    />
                    <div className={styles.frameInfo}>
                      <span className={styles.frameNum}>#{f.frame_number}</span>
                      <span className={styles.frameTime}>{formatTimestamp(f.timestamp)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {lightbox && (
        <button className={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <button className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <img src={`${API}/preview/${jobId}/${lightbox.filename}`} alt="Frame Preview" className={styles.lightboxImg} />
            <div className={styles.lightboxMeta}>
              <b>Frame #{lightbox.frame_number}</b>
              <span>{formatTimestamp(lightbox.timestamp)}</span>
              <button className={styles.lightboxClose} onClick={() => setLightbox(null)}>Close</button>
            </div>
          </button>
        </button>
      )}
    </div>
  )
}