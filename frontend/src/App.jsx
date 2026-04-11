import { useState, useRef, useCallback } from 'react'
import styles from './App.module.css'

const API = ''  // proxied via vite

export default function App() {
  const [mode, setMode] = useState('nth')       // 'nth' | 'seconds' | 'minutes'
  const [value, setValue] = useState(30)
  const [colorMode, setColorMode] = useState('rgb')  // 'rgb' | 'grey'
  const [video, setVideo] = useState(null)
  const [videoName, setVideoName] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [frames, setFrames] = useState([])
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const fileRef = useRef()
  const dropRef = useRef()

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('video/')) {
      loadVideo(file)
    }
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      loadVideo(file)
    }
  }

  const loadVideo = (file) => {
    setVideo(file)
    setVideoName(file.name)
    setFrames([])
    setMeta(null)
    setError('')
  }

  const handleExtract = async () => {
    if (!video) return
    setLoading(true)
    setError('')
    setFrames([])
    setMeta(null)
    setProgress('Uploading video...')

    const form = new FormData()
    form.append('video', video)
    form.append('mode', mode)
    form.append('value', value)
    form.append('color_mode', colorMode)

    try {
      setProgress('Extracting frames...')
      const res = await fetch(`${API}/extract`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setFrames(data.frames)
      setMeta(data.meta)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleDownload = async () => {
    if (!frames.length) return
    setDownloading(true)
    try {
      const res = await fetch(`${API}/download-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames })
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'frames.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  const formatTimestamp = (s) => {
    const m = Math.floor(s / 60)
    const sec = (s % 60).toFixed(2).padStart(5, '0')
    return `${String(m).padStart(2, '0')}:${sec}`
  }

  const modeLabel = mode === 'nth'
    ? `every ${value} frame${value === 1 ? '' : 's'}`
    : `every ${value} ${mode}`

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <span className={styles.logo}><span className={styles.accent}>TRI</span>FRAMES</span>
        {meta && (
          <div className={styles.metaBar}>
            <span>{meta.fps} fps</span>
            <span className={styles.dot}>·</span>
            <span>{formatTimestamp(meta.duration)}</span>
            <span className={styles.dot}>·</span>
            <span>{meta.total_frames.toLocaleString()} frames</span>
            <span className={styles.dot}>·</span>
            <span className={styles.accentText}>{meta.extracted_count} extracted</span>
          </div>
        )}
      </header>

      <div className={styles.layout}>
        {/* Sidebar controls */}
        <aside className={styles.sidebar}>
          {/* Upload */}
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
                  <span className={styles.fileSub}>or click to browse</span>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </section>

          {/* Mode */}
          <section className={styles.section}>
            <label className={styles.sectionLabel}>INTERVAL MODE</label>
            <div className={styles.modeGroup}>
              {[
                { key: 'nth', label: 'Every Nth Frame' },
                { key: 'seconds', label: 'Every X Seconds' },
                { key: 'minutes', label: 'Every X Minutes' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.modeBtn} ${mode === key ? styles.modeBtnActive : ''}`}
                  onClick={() => setMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Value */}
          <section className={styles.section}>
            <label className={styles.sectionLabel}>
              {mode === 'nth' ? 'FRAME INTERVAL' : mode === 'seconds' ? 'SECONDS' : 'MINUTES'}
            </label>
            <div className={styles.valueRow}>
              <button
                className={styles.stepBtn}
                onClick={() => setValue(v => Math.max(1, Number.parseFloat((v - (mode === 'nth' ? 1 : 0.5)).toFixed(2))))}
              >−</button>
              <input
                type="number"
                className={styles.valueInput}
                value={value}
                min={mode === 'nth' ? 1 : 0.1}
                step={mode === 'nth' ? 1 : 0.5}
                onChange={(e) => setValue(Math.max(mode === 'nth' ? 1 : 0.1, Number.parseFloat(e.target.value) || 1))}
              />
              <button
                className={styles.stepBtn}
                onClick={() => setValue(v => Number.parseFloat((v + (mode === 'nth' ? 1 : 0.5)).toFixed(2)))}
              >+</button>
            </div>
            <span className={styles.modeHint}>{modeLabel}</span>
          </section>

          {/* Color Mode */}
          <section className={styles.section}>
            <label className={styles.sectionLabel}>COLOR MODE</label>
            <div className={styles.modeGroup}>
              {[
                { key: 'rgb', label: 'RGB' },
                { key: 'grey', label: 'Greyscale' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.modeBtn} ${colorMode === key ? styles.modeBtnActive : ''}`}
                  onClick={() => setColorMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Extract button */}
          <button
            className={styles.extractBtn}
            onClick={handleExtract}
            disabled={!video || loading}
          >
            {loading ? progress || 'Processing...' : 'EXTRACT FRAMES'}
          </button>

          {/* Download */}
          {frames.length > 0 && (
            <button
              className={styles.downloadBtn}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Zipping...' : `↓ DOWNLOAD ZIP (${frames.length})`}
            </button>
          )}

          {error && <div className={styles.error}>{error}</div>}
        </aside>

        {/* Frame grid */}
        <main className={styles.main}>
          {frames.length === 0 && !loading && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>⬡</span>
              <span>No frames extracted yet</span>
            </div>
          )}

          {loading && (
            <div className={styles.empty}>
              <span className={styles.spinner} />
              <span className={styles.text}>{progress}</span>
            </div>
          )}

          {frames.length > 0 && (
            <div className={styles.grid}>
              {frames.map((f, i) => (
                <button
                  key={i}
                  className={styles.frameCard}
                  onClick={() => setLightbox(f)}
                >
                  <img
                    src={`data:image/jpeg;base64,${f.image}`}
                    alt={`Frame ${f.frame_number}`}
                    className={styles.frameImg}
                  />
                  <div className={styles.frameInfo}>
                    <span className={styles.frameNum}>#{f.frame_number}</span>
                    <span className={styles.frameTime}>{formatTimestamp(f.timestamp)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <button className={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <button className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <img
              src={`data:image/jpeg;base64,${lightbox.image}`}
              alt={`Frame ${lightbox.frame_number}`}
              className={styles.lightboxImg}
            />
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
