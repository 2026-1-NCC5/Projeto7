import React, { useRef, useState, useEffect } from 'react';
import { api, normalizeDetections } from "@/lib/api";

export default function Collect() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const sessionIdRef = useRef(null);
  const frameTimerRef = useRef(null);
  const processingRef = useRef(false);
  const [collecting, setCollecting] = useState(false);
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [coletaId, setColetaId] = useState("");

  const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || 'http://localhost:8000';

  function stopCameraStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function stopFrameLoop() {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    processingRef.current = false;
  }

  async function finalizeSession() {
    if (!sessionIdRef.current) {
      return;
    }

    try {
      await fetch(`${AI_BASE_URL}/session/${sessionIdRef.current}/finalize`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Erro ao finalizar sessão:', error);
    } finally {
      sessionIdRef.current = null;
    }
  }

  async function captureAndSendFrame() {
    if (!videoRef.current || !sessionIdRef.current || processingRef.current) {
      return;
    }

    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      return;
    }

    processingRef.current = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.7);

      const response = await fetch(`${AI_BASE_URL}/session/${sessionIdRef.current}/frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_base64: imageBase64,
        }),
      });

      if (!response.ok) {
        return;
      }

      const result = await response.json();
      const newEvents = Array.isArray(result.new_events) ? result.new_events : [];

      if (newEvents.length > 0) {
        setItems((prevItems) => {
          const mapped = newEvents.map((event) => ({
            id: `${event.track_id}-${event.timestamp}`,
            name: event.class || 'Item desconhecido',
            timestamp: event.timestamp,
          }));
          return [...mapped, ...prevItems];
        });

        // Opcional: se o usuário fornecer um `Coleta ID`, encaminha as detecções
        // para o backend usando o cliente central (`api.coleta.detections`). Isso
        // permite persistir as detecções sem depender da rota completa /coleta.
        (async () => {
          try {
            const cid = Number(coletaId);
            if (cid && cid > 0) {
              const normalized = normalizeDetections(newEvents);
              if (normalized.length > 0) {
                await api.coleta.detections(cid, normalized);
              }
            }
          } catch (e) {
            console.warn('Falha ao persistir detecções pelo Collect.jsx:', e);
          }
        })();
      }

      if (typeof result.total_items === 'number') {
        setTotalItems(result.total_items);
      }
    } catch (error) {
      console.error('Erro ao enviar frame:', error);
    } finally {
      processingRef.current = false;
    }
  }

  async function startCollection() {
    setItems([]);
    setTotalItems(0);

    try {
      const startResponse = await fetch(`${AI_BASE_URL}/session/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ direction: 'lr' }),
      });

      if (!startResponse.ok) {
        throw new Error('Falha ao iniciar sessão de IA');
      }

      const startData = await startResponse.json();
      sessionIdRef.current = startData.session_id;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      frameTimerRef.current = setInterval(captureAndSendFrame, 700);
      setCollecting(true);
    } catch (error) {
      alert('Não foi possível iniciar a coleta com IA. Verifique se o serviço está rodando em http://localhost:8000');
      stopFrameLoop();
      stopCameraStream();
      await finalizeSession();
      setCollecting(false);
    }
  }

  async function stopCollection() {
    stopFrameLoop();
    stopCameraStream();
    await finalizeSession();
    setCollecting(false);
  }

  useEffect(() => {
    return () => {
      stopFrameLoop();
      stopCameraStream();
      finalizeSession();
    };
  }, []);

  return (
    <div className="container">
      <h2>Coleta</h2>
      <button onClick={() => (collecting ? stopCollection() : startCollection())}>
        {collecting ? 'Fechar Câmera' : 'Abrir Câmera'}
      </button>
      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 12, marginRight: 8 }}>Coleta ID (opcional):</label>
        <input
          value={coletaId}
          onChange={(e) => setColetaId(e.target.value)}
          placeholder="Digite o id da coleta para persistir"
          style={{ padding: '4px 8px', fontSize: 13, width: 160 }}
        />
      </div>
      <div style={{ marginTop: 10, fontWeight: 'bold' }}>Total contabilizado: {totalItems}</div>
      <div style={{ position: 'relative', margin: '20px 0', width: 320, height: 240 }}>
        <video ref={videoRef} autoPlay playsInline muted width={320} height={240} style={{ background: '#000', display: 'block' }} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 2,
            height: '100%',
            background: '#ff2d2d',
            pointerEvents: 'none',
          }}
        />
      </div>
      <h3>Itens coletados:</h3>
      <ul>
        {items.map(item => (
          <li key={item.id}>
            {item.name} {item.timestamp ? `- ${new Date(item.timestamp).toLocaleTimeString()}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
