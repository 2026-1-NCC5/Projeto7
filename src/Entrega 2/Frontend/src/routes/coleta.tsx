import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  BadgePercent,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  MousePointerClick,
  Package,
  Play,
  RotateCcw,
  Send,
  Square,
  Tag,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/routes/index";
import {
  api,
  drawDetectionsOnCanvas,
  formatCurrencyBRL,
  formatNumber,
  nomeAmigavel,
  normalizeDetections,
  normalizeDetectionsWithBbox,
  type Coleta,
  type ColetaResumo,
  type Detection,
  type DetectionWithBbox,
  type Evento,
  type EventoResumo,
  type GrupoMeu,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

const searchSchema = z.object({
  eventoId: z.coerce.number().int().positive().optional(),
});

export const Route = createFileRoute("/coleta")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Coleta — EmpathTech" },
      {
        name: "description",
        content:
          "Câmera + IA: escolha a direção do fluxo e capture os itens em tempo real ou foto a foto.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <ColetaPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const FRAME_INTERVAL_MS = 500;

type Phase = "setup" | "running" | "review" | "done";
type Direction = "lr" | "rl";
type CaptureMode = "video" | "photo";

function ColetaPage() {
  const { user } = useAuth();
  const { eventoId: eventoIdParam } = Route.useSearch();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [grupos, setGrupos] = useState<GrupoMeu[]>([]);
  const [grupoId, setGrupoId] = useState<string>("");
  const [direction, setDirection] = useState<Direction>("lr");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("video");
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [loadingInit, setLoadingInit] = useState(true);

  const [phase, setPhase] = useState<Phase>("setup");
  const [coleta, setColeta] = useState<Coleta | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // contadores locais por classe
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});
  const [recent, setRecent] = useState<{ class: string; ts: number }[]>([]);
  const [resumoFinal, setResumoFinal] = useState<ColetaResumo | null>(null);

  // Metadados agregados por classe técnica (nome amigável, tipo, valor,
  // amostras de confiança). Tudo opcional — se o backend/AI não enviar,
  // o card mostra apenas o nome bruto e o contador.
  type ClassMeta = {
    nome_exibicao?: string | null;
    nome_padronizado?: string | null;
    tipo_alimento?: string | null;
    valor_unitario_brl?: number | null;
    confidences: number[];
  };
  const [metaByClass, setMetaByClass] = useState<Record<string, ClassMeta>>({});

  // overlay de detecções em tempo real (bboxes + labels)
  const [showOverlay, setShowOverlay] = useState(true);
  const [activeDetections, setActiveDetections] = useState<DetectionWithBbox[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  // canvas oculto usado para extrair o frame da câmera e enviar à IA
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // canvas sobreposto ao vídeo usado para desenhar bboxes/labels
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const seenTracksRef = useRef<Set<string>>(new Set());
  const pendingDetectionsRef = useRef<Set<Promise<unknown>>>(new Set());
  const failedDetectionsRef = useRef<Detection[]>([]);

  // Carrega evento + grupos do usuário.
  // Se vier ?eventoId=N na URL, usamos esse evento (resolve casos em que
  // /eventos/atual/resumo retorna null mesmo havendo eventos disponíveis,
  // ou em que o usuário quer coletar em outro evento aberto).
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoadingInit(true);
      try {
        const r = await api.eventos.atualResumo();
        if (!alive) return;
        setResumo(r);

        // Decide qual evento usar: prioriza o param, cai no atual.
        let evt: Evento | null = r.evento ?? null;
        if (eventoIdParam) {
          if (r.evento && r.evento.id === eventoIdParam) {
            evt = r.evento;
          } else {
            // Constrói um stub de evento — temos só o id. Tentamos enriquecer
            // o nome buscando pelo ranking (que não exige dados sensíveis).
            evt = {
              id: eventoIdParam,
              nome: `Evento #${eventoIdParam}`,
              descricao: null,
              local_evento: null,
              data_inicio: new Date().toISOString(),
              data_fim: null,
              status: "ativo",
            };
            // Best-effort para descobrir o nome real via dashboard de admin.
            try {
              if (user.cargo === "admin") {
                const d = await api.eventos.dashboardGeral({ admin_id: user.id });
                const match = d.comparativo_eventos.find(
                  (c) => c.evento_id === eventoIdParam,
                );
                if (alive && match) {
                  evt = { ...evt!, nome: match.nome };
                }
              }
            } catch {
              /* não-crítico */
            }
          }
        }
        if (!alive) return;
        setEvento(evt);

        if (evt) {
          const g = await api.grupos.meus(user.id, evt.id);
          if (!alive) return;
          setGrupos(g);
          if (g[0]) setGrupoId(String(g[0].id));
        }
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : "Erro");
      } finally {
        if (alive) setLoadingInit(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, eventoIdParam]);

  // Cleanup
  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function openCameraStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
  }

  async function iniciar() {
    if (!user) return;
    if (!evento) {
      toast.error("Nenhum evento selecionado.");
      return;
    }
    if (!grupoId) {
      toast.error("Selecione um grupo.");
      return;
    }
    setBusy(true);
    try {
      const stream = await openCameraStream();

      setPhase("running");
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("Elemento de vídeo não disponível para iniciar a câmera.");
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await new Promise<void>((res) => {
        if (video.readyState >= 1) return res();
        video.onloadedmetadata = () => res();
      });
      await video.play();

      console.log("[coleta] start ->", { evento_id: evento.id, grupo_id: Number(grupoId), usuario_id: user.id });
      const c = await api.coleta.start({
        evento_id: evento.id,
        grupo_id: Number(grupoId),
        usuario_id: user.id,
      });
      console.log("[coleta] start <- coleta criada:", c);
      setColeta(c);

      // Sessão IA com a direção escolhida.
      console.log("[coleta] ai.sessionStart ->", { direction, minConfidence });
      const s = await api.ai.sessionStart(direction, minConfidence);
      console.log("[coleta] ai.sessionStart <- session:", s);
      setSessionId(s.session_id);

      seenTracksRef.current = new Set();
      pendingDetectionsRef.current = new Set();
      failedDetectionsRef.current = [];
      setLocalCounts({});
      setMetaByClass({});
      setRecent([]);
      setResumoFinal(null);
      setPhase("running");

      // Modo vídeo: loop automático. Modo foto: o usuário dispara cada captura.
      if (captureMode === "video") {
        intervalRef.current = window.setInterval(
          () => loopFrame(c.id, s.session_id),
          FRAME_INTERVAL_MS,
        );
      }
      toast.success(
        captureMode === "video"
          ? "Coleta iniciada! Passe os itens pela linha."
          : "Coleta iniciada! Tire fotos dos itens.",
      );
    } catch (e) {
      const message =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Permissão de câmera negada. Habilite o acesso à câmera no navegador."
          : e instanceof Error
            ? e.message
            : "Falha ao iniciar";
      toast.error(message);
      stopCamera();
      setColeta(null);
      setSessionId(null);
      setPhase("setup");
    } finally {
      setBusy(false);
    }
  }

  async function capturarFoto() {
    if (!coleta || !sessionId) return;
    setCapturing(true);
    try {
      const before = totalLocal;
      await loopFrame(coleta.id, sessionId);
      // Pequeno delay para o estado refletir antes do feedback.
      window.setTimeout(() => {
        const after = Object.values(localCountsRef.current).reduce((a, b) => a + b, 0);
        const novos = after - before;
        if (novos > 0) {
          toast.success(`${novos} novo(s) item(ns) detectado(s).`);
        } else {
          toast.message("Nenhum item novo nessa foto.");
        }
      }, 100);
    } finally {
      setCapturing(false);
    }
  }

  // Ref espelho dos counts para feedback imediato após loopFrame.
  const localCountsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    localCountsRef.current = localCounts;
  }, [localCounts]);

  // Atualiza o agregado por classe com nome/tipo/valor/confiança vindo das
  // detecções recém recebidas. Mantém o último valor não-nulo de cada campo.
  function mergeMetaFromDetections(detections: Detection[]) {
    if (!detections.length) return;
    setMetaByClass((prev) => {
      const next: Record<string, ClassMeta> = { ...prev };
      detections.forEach((d) => {
        const cur = next[d.class] ?? { confidences: [] };
        // Mantém só as últimas 20 amostras de confiança por classe.
        const confidences = [...cur.confidences, d.confidence].slice(-20);
        next[d.class] = {
          nome_exibicao: d.nome_exibicao ?? cur.nome_exibicao ?? null,
          nome_padronizado: d.nome_padronizado ?? cur.nome_padronizado ?? null,
          tipo_alimento: d.tipo_alimento ?? cur.tipo_alimento ?? null,
          valor_unitario_brl:
            d.valor_unitario_brl ?? cur.valor_unitario_brl ?? null,
          confidences,
        };
      });
      return next;
    });
  }

  // Desenha as bboxes/labels no canvas sobreposto ao vídeo sempre que
  // muda o conjunto de detecções ativas ou o toggle do overlay.
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    if (phase !== "running") return;

    // Mantém o canvas sincronizado com a resolução do frame.
    if (video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showOverlay && activeDetections.length > 0) {
      drawDetectionsOnCanvas(canvas, activeDetections, {
        strokeColor: "#22c55e",
        textColor: "#0b1f1f",
        fillOpacity: 0.15,
        lineWidth: 3,
        fontSize: 16,
      });
    }
  }, [showOverlay, activeDetections, phase]);

  // Validação manual no modo foto: clique numa bbox conta o item.
  async function validarDeteccaoManual(detection: DetectionWithBbox) {
    if (!coleta) return;
    const detectionForBackend: Detection = {
      track_id: `manual-${detection.track_id}-${Date.now()}`,
      class: detection.class,
      confidence: detection.confidence,
      classe_modelo: detection.classe_modelo ?? detection.class,
      nome_padronizado: detection.nome_padronizado ?? null,
      nome_exibicao: detection.nome_exibicao ?? null,
      tipo_alimento: detection.tipo_alimento ?? null,
      peso_unitario_g: detection.peso_unitario_g ?? null,
      volume_unitario_ml: detection.volume_unitario_ml ?? null,
      valor_unitario_brl: detection.valor_unitario_brl ?? null,
      valor_total_brl: detection.valor_total_brl ?? detection.valor_unitario_brl ?? null,
    };
    setLocalCounts((prev) => ({
      ...prev,
      [detection.class]: (prev[detection.class] ?? 0) + 1,
    }));
    mergeMetaFromDetections([detectionForBackend]);
    setRecent((prev) =>
      [{ class: detection.class, ts: Date.now() }, ...prev].slice(0, 8),
    );
    const nome = detection.nome_exibicao || detection.class;
    toast.success(
      `${nome} validado (${(detection.confidence * 100).toFixed(0)}%)`,
    );
    try {
      await api.coleta.detections(coleta.id, [detectionForBackend]);
    } catch (e) {
      console.error("Falha ao persistir detecção manual:", e);
      failedDetectionsRef.current.push(detectionForBackend);
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (captureMode !== "photo") return;
    if (!coleta || activeDetections.length === 0) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    for (const det of activeDetections) {
      const [x1, y1, x2, y2] = det.bbox;
      if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
        validarDeteccaoManual(det);
        return;
      }
    }
    toast.message("Clique em cima de um item destacado para validar.");
  }

  async function loopFrame(coletaId: number, sId: string) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      console.warn("[coleta] loopFrame abortado", { hasVideo: !!video, hasCanvas: !!canvas, readyState: video?.readyState });
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    console.log("[coleta] loopFrame -> enviando frame", { coletaId, sId, dataUrlBytes: dataUrl.length });
    try {
      const res = await api.ai.sessionFrame(sId, dataUrl);
      console.log("[coleta] loopFrame <- resposta IA:", res);

      // Detecções ativas (todas as bboxes visíveis no frame) — usadas para
      // desenhar o overlay e permitir validação manual no modo foto.
      const activeNow = normalizeDetectionsWithBbox(res.active_detections);
      console.log("[coleta] active_detections normalizadas:", activeNow);
      setActiveDetections(activeNow);

      const detections = normalizeDetections(res.new_events);
      console.log("[coleta] new_events normalizados:", detections);
      const fresh = detections.filter((d) => !seenTracksRef.current.has(d.track_id));
      console.log("[coleta] fresh (não vistas ainda):", fresh);
      fresh.forEach((d) => seenTracksRef.current.add(d.track_id));
      if (fresh.length === 0) return;

      setLocalCounts((prev) => {
        const next = { ...prev };
        fresh.forEach((d) => {
          next[d.class] = (next[d.class] ?? 0) + 1;
        });
        console.log("[coleta] localCounts atualizado:", next);
        return next;
      });
      setRecent((prev) =>
        [...fresh.map((d) => ({ class: d.class, ts: Date.now() })), ...prev].slice(0, 8),
      );
      mergeMetaFromDetections(fresh);

      console.log("[coleta] persistindo detecções no backend:", {
        coletaId,
        count: fresh.length,
        detections: fresh,
      });
      const p = api.coleta
        .detections(coletaId, fresh)
        .then((r) => {
          console.log("[coleta] detections persistidas com sucesso:", r);
        })
        .catch((e) => {
          console.error("[coleta] Falha ao persistir detecções:", e);
          failedDetectionsRef.current.push(...fresh);
        })
        .finally(() => {
          pendingDetectionsRef.current.delete(p);
        });
      pendingDetectionsRef.current.add(p);
    } catch (e) {
      console.error("[coleta] loopFrame erro:", e);
    }
  }

  async function flushFailedDetections(coletaId: number) {
    if (failedDetectionsRef.current.length === 0) return;
    const batch = failedDetectionsRef.current.splice(0);
    console.log("[coleta] reenviando detecções falhas:", {
      coletaId,
      count: batch.length,
      detections: batch,
    });
    try {
      const result = await api.coleta.detections(coletaId, batch);
      console.log("[coleta] reenvio concluído:", result);
    } catch (e) {
      console.error("Reenvio de detecções falhou:", e);
      failedDetectionsRef.current.unshift(...batch);
      throw e;
    }
  }

  async function pararCamera() {
    if (!coleta || !sessionId) return;
    setBusy(true);
    try {
      stopCamera();

      if (pendingDetectionsRef.current.size > 0) {
        await Promise.allSettled(Array.from(pendingDetectionsRef.current));
      }

      try {
        await flushFailedDetections(coleta.id);
      } catch {
        toast.warning(
          "Alguns itens detectados não foram salvos no servidor. Tentaremos novamente ao confirmar.",
        );
      }

      try {
        await api.ai.sessionFinalize(sessionId);
      } catch {
        /* ignore */
      }

      try {
        const r = await api.coleta.resumo(coleta.id);
        setResumoFinal(r);
      } catch (e) {
        console.error("Falha ao buscar resumo:", e);
        toast.error(
          "Não foi possível carregar o resumo do servidor. Os itens detectados continuam visíveis.",
        );
      }
      setPhase("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao parar");
    } finally {
      setBusy(false);
    }
  }

  async function confirmar() {
    if (!coleta || !user) {
      console.warn("[coleta] confirmar abortado", { coleta, user });
      return;
    }
    setBusy(true);
    try {
      console.log("[coleta] confirmar -> pendentes:", pendingDetectionsRef.current.size, "failed:", failedDetectionsRef.current.length);
      if (pendingDetectionsRef.current.size > 0) {
        await Promise.allSettled(Array.from(pendingDetectionsRef.current));
      }
      try {
        await flushFailedDetections(coleta.id);
      } catch (e) {
        console.error("[coleta] flushFailedDetections falhou:", e);
        toast.warning(
          "Alguns itens não puderam ser salvos no servidor, mas a coleta será finalizada.",
        );
      }
      console.log("[coleta] coleta.finalize ->", { coletaId: coleta.id, userId: user.id });
      const r = await api.coleta.finalize(coleta.id, user.id);
      console.log("[coleta] coleta.finalize <-", r);
      if (r.itens.length === 0 && totalLocal > 0 && resumoFinal && resumoFinal.itens.length > 0) {
        console.warn("[coleta] finalize retornou 0 itens, mantendo resumo local prévio");
        setResumoFinal({ ...r, itens: resumoFinal.itens });
      } else {
        setResumoFinal(r);
      }
      setPhase("done");
      toast.success("Coleta confirmada e salva!");
    } catch (e) {
      console.error("[coleta] confirmar erro:", e);
      toast.error(e instanceof Error ? e.message : "Erro ao confirmar");
    } finally {
      setBusy(false);
    }
  }

  function reiniciar() {
    stopCamera();
    setColeta(null);
    setSessionId(null);
    setLocalCounts({});
    setMetaByClass({});
    setRecent([]);
    setResumoFinal(null);
    setActiveDetections([]);
    pendingDetectionsRef.current = new Set();
    failedDetectionsRef.current = [];
    seenTracksRef.current = new Set();
    setPhase("setup");
  }

  const totalLocal = Object.values(localCounts).reduce((a, b) => a + b, 0);
  const reviewUsesLocal =
    phase === "review" && (!resumoFinal || resumoFinal.itens.length === 0);

  if (loadingInit) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  // Aviso quando o usuário forçou um evento via param mas o backend não o
  // considera "atual". Permite continuar a coleta mesmo assim.
  const usandoEventoForcado =
    !!evento && (!resumo?.evento || resumo.evento.id !== evento.id);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        {phase === "running" && (
          <span className="text-xs px-2 py-1 rounded-full bg-success/15 text-success font-medium">
            Coleta em andamento
          </span>
        )}
      </div>

      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Camera className="h-7 w-7 text-primary" /> Coleta inteligente
        </h1>
        <p className="text-sm text-muted-foreground">
          Escolha o sentido do fluxo, o modo de captura e comece a registrar os itens.
        </p>
        {evento && (
          <div className="mt-2 text-xs text-muted-foreground">
            Evento: <strong className="text-foreground">{evento.nome}</strong>
          </div>
        )}
      </header>

      {!evento ? (
        <EmptyState
          title="Sem evento selecionado"
          message="Abra um evento na lista de eventos e clique em ‘Coletar neste evento’."
        />
      ) : grupos.length === 0 ? (
        <EmptyState
          title="Você não está em nenhum grupo deste evento"
          message="Vá em Grupos e crie ou peça para entrar em um."
        />
      ) : (
        <>
          {/* Setup */}
          {phase === "setup" && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-6">
              {usandoEventoForcado && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
                  Este evento não está marcado como “atual” pelo servidor, mas
                  você pode coletar normalmente nele.
                </div>
              )}

              {/* Grupo */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Grupo</label>
                <Select value={grupoId} onValueChange={setGrupoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {grupos.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.nome} {g.sou_lider ? "· líder" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Direção */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Sentido do fluxo</div>
                <p className="text-xs text-muted-foreground">
                  Defina o sentido em que os itens vão cruzar a linha central da câmera.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <DirectionCard
                    active={direction === "lr"}
                    onClick={() => setDirection("lr")}
                    icon={<ArrowRightLeft className="h-5 w-5 rotate-180" />}
                    title="Esquerda → Direita"
                    hint="Os itens entram pela esquerda e saem pela direita."
                  />
                  <DirectionCard
                    active={direction === "rl"}
                    onClick={() => setDirection("rl")}
                    icon={<ArrowLeftRight className="h-5 w-5" />}
                    title="Direita → Esquerda"
                    hint="Os itens entram pela direita e saem pela esquerda."
                  />
                </div>
              </div>

              {/* Modo de captura */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Modo de captura</div>
                <p className="text-xs text-muted-foreground">
                  Vídeo contínuo registra automaticamente. Por foto, você dispara cada captura.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ModeCard
                    active={captureMode === "video"}
                    onClick={() => setCaptureMode("video")}
                    icon={<Clapperboard className="h-5 w-5" />}
                    title="Vídeo contínuo"
                    hint="Captura automática a cada 0,5s."
                  />
                  <ModeCard
                    active={captureMode === "photo"}
                    onClick={() => setCaptureMode("photo")}
                    icon={<ImagePlus className="h-5 w-5" />}
                    title="Foto a foto"
                    hint="Você decide quando capturar."
                  />
                </div>
              </div>

              {/* Confiança mínima da IA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Confiança mínima da IA</div>
                  <span className="text-xs font-bold text-primary tabular-nums">
                    {Math.round(minConfidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Apenas itens detectados acima desse limiar serão contados. Aumente para
                  mais rigor, diminua para capturar itens difíceis.
                </p>
                <Slider
                  value={[minConfidence]}
                  onValueChange={(v) => setMinConfidence(v[0] ?? 0.5)}
                  min={0.2}
                  max={0.9}
                  step={0.05}
                  aria-label="Confiança mínima"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span>Permissivo</span>
                  <span>Padrão (50%)</span>
                  <span>Rigoroso</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border">
                <Button
                  onClick={iniciar}
                  disabled={busy || !grupoId}
                  className="gradient-warm text-secondary-foreground shadow-warm h-11 px-6 flex-1"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Iniciar coleta
                    </>
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Será solicitado acesso à câmera. Use HTTPS em produção.
              </div>
            </div>
          )}

          {/* Running / Review */}
          {(phase === "running" || phase === "review") && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-glow">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {phase === "running" && (
                    <>
                      {/* Canvas overlay com bboxes/labels da IA. Em modo
                          foto também recebe cliques para validar itens. */}
                      <canvas
                        ref={overlayCanvasRef}
                        onClick={handleOverlayClick}
                        className={`absolute inset-0 w-full h-full ${
                          captureMode === "photo" && showOverlay
                            ? "cursor-pointer"
                            : "pointer-events-none"
                        }`}
                      />

                      {/* Linha central + setas: somente no modo vídeo,
                          que conta por cruzamento da linha. */}
                      {captureMode === "video" && (
                        <>
                          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-secondary shadow-warm pointer-events-none animate-pulse" />
                          <div className="absolute top-1/2 -translate-y-1/2 left-3 right-3 flex justify-between pointer-events-none">
                            {direction === "lr" ? (
                              <>
                                <span className="px-2 py-1 rounded-md bg-success/80 text-success-foreground text-[11px] font-bold">→ entra</span>
                                <span className="px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-bold">sai →</span>
                              </>
                            ) : (
                              <>
                                <span className="px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-bold">← sai</span>
                                <span className="px-2 py-1 rounded-md bg-success/80 text-success-foreground text-[11px] font-bold">← entra</span>
                              </>
                            )}
                          </div>
                        </>
                      )}

                      {/* Modo foto: dica de clicar nos itens destacados. */}
                      {captureMode === "photo" && (
                        <div className="absolute bottom-20 inset-x-0 flex justify-center pointer-events-none">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium backdrop-blur">
                            <MousePointerClick className="h-3.5 w-3.5" />
                            {showOverlay
                              ? "Clique no item destacado para validar"
                              : "Tire uma foto e ative o overlay para validar"}
                          </div>
                        </div>
                      )}

                      <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-success text-success-foreground text-xs font-bold uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-success-foreground animate-pulse" />
                        {captureMode === "video" ? "Ao vivo" : "Câmera pronta"}
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowOverlay((v) => !v)}
                          title={showOverlay ? "Ocultar labels da IA" : "Mostrar labels da IA"}
                          aria-pressed={showOverlay}
                          className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                        >
                          {showOverlay ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>
                        <div className="px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur">
                          Coleta #{coleta?.id}
                        </div>
                      </div>

                      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white pointer-events-none">
                        <div className="text-xs uppercase tracking-widest opacity-80">
                          Total agora
                        </div>
                        <div className="text-4xl font-bold leading-none">
                          {formatNumber(totalLocal)}
                        </div>
                      </div>
                    </>
                  )}
                  {phase === "review" && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white">
                      <div className="text-center space-y-2">
                        <Square className="h-10 w-10 mx-auto" />
                        <div className="font-bold text-lg">Câmera parada</div>
                        <div className="text-sm opacity-80">Revise os itens e confirme abaixo.</div>
                      </div>
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />

                {phase === "running" ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {captureMode === "photo" && (
                      <Button
                        onClick={capturarFoto}
                        disabled={busy || capturing}
                        className="flex-1 h-11 gradient-warm text-secondary-foreground shadow-warm"
                      >
                        {capturing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ImagePlus className="h-4 w-4" /> Capturar foto
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={pararCamera}
                      disabled={busy}
                      variant="outline"
                      className="flex-1 h-11"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Square className="h-4 w-4" /> Parar e revisar
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        stopCamera();
                        reiniciar();
                        toast.message("Coleta cancelada (sem confirmar).");
                      }}
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={confirmar}
                      disabled={busy}
                      className="flex-1 h-11 gradient-warm text-secondary-foreground shadow-warm"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4" /> Confirmar e enviar
                        </>
                      )}
                    </Button>
                    <Button onClick={reiniciar} variant="outline">
                      <RotateCcw className="h-4 w-4" /> Descartar
                    </Button>
                  </div>
                )}
              </div>

              {/* Painel de contagem */}
              <aside className="rounded-2xl border border-border bg-card p-4 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">
                    Itens detectados
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {phase === "review" && resumoFinal && !reviewUsesLocal
                      ? formatNumber(resumoFinal.itens.reduce((a, i) => a + i.quantidade, 0))
                      : formatNumber(totalLocal)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    {direction === "lr" ? (
                      <>Sentido: esquerda → direita</>
                    ) : (
                      <>Sentido: direita → esquerda</>
                    )}
                    {" · "}
                    {captureMode === "video" ? "vídeo" : "foto"}
                  </div>
                  {reviewUsesLocal && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Mostrando contagem local (resumo do servidor indisponível).
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Package className="h-4 w-4" /> Por alimento
                  </div>
                  <ul className="space-y-1.5 max-h-72 overflow-auto pr-1">
                    {phase === "review" && resumoFinal && !reviewUsesLocal
                      ? resumoFinal.itens.map((i) => {
                          const nome = nomeAmigavel({
                            alimento: i.alimento,
                            nome_padronizado: i.nome_padronizado ?? null,
                          });
                          const valorTotal =
                            i.valor_total_brl ??
                            (i.valor_unitario_brl != null
                              ? Number(i.valor_unitario_brl) * Number(i.quantidade)
                              : null);
                          return (
                            <li
                              key={i.id}
                              className="text-sm bg-muted/50 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium">{nome}</span>
                                <span className="font-bold text-primary tabular-nums">
                                  {formatNumber(i.quantidade)}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1 truncate">
                                  {i.tipo_alimento && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary/25 text-secondary-foreground font-medium">
                                      <Tag className="h-2.5 w-2.5" />
                                      {i.tipo_alimento}
                                    </span>
                                  )}
                                </span>
                                {valorTotal != null && (
                                  <span className="font-semibold text-foreground tabular-nums">
                                    {formatCurrencyBRL(valorTotal)}
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })
                      : Object.entries(localCounts)
                          .sort((a, b) => b[1] - a[1])
                          .map(([k, v]) => {
                            const meta = metaByClass[k];
                            const nome = meta?.nome_exibicao || k;
                            const valorTotal =
                              meta?.valor_unitario_brl != null
                                ? Number(meta.valor_unitario_brl) * v
                                : null;
                            return (
                              <li
                                key={k}
                                className="text-sm bg-muted/50 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate font-medium capitalize">{nome}</span>
                                  <span className="font-bold text-primary tabular-nums">
                                    {formatNumber(v)}
                                  </span>
                                </div>
                                {(meta?.tipo_alimento || valorTotal != null) && (
                                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1 truncate">
                                      {meta?.tipo_alimento && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary/25 text-secondary-foreground font-medium">
                                          <Tag className="h-2.5 w-2.5" />
                                          {meta.tipo_alimento}
                                        </span>
                                      )}
                                    </span>
                                    {valorTotal != null && (
                                      <span className="font-semibold text-foreground tabular-nums">
                                        {formatCurrencyBRL(valorTotal)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                    {phase === "running" && Object.keys(localCounts).length === 0 && (
                      <li className="text-xs text-muted-foreground p-3 text-center">
                        {captureMode === "video"
                          ? "Aguardando primeiro item…"
                          : "Aponte a câmera e tire a primeira foto."}
                      </li>
                    )}
                    {phase === "review" && Object.keys(localCounts).length === 0 && !resumoFinal && (
                      <li className="text-xs text-muted-foreground p-3 text-center">
                        Nenhum item detectado.
                      </li>
                    )}
                  </ul>

                  {/* Totalizador de valor (BRL) — só aparece se houver preço. */}
                  {(() => {
                    let total = 0;
                    let temValor = false;
                    if (phase === "review" && resumoFinal && !reviewUsesLocal) {
                      resumoFinal.itens.forEach((i) => {
                        const vt =
                          i.valor_total_brl ??
                          (i.valor_unitario_brl != null
                            ? Number(i.valor_unitario_brl) * Number(i.quantidade)
                            : null);
                        if (vt != null) {
                          total += Number(vt);
                          temValor = true;
                        }
                      });
                    } else {
                      Object.entries(localCounts).forEach(([k, v]) => {
                        const vu = metaByClass[k]?.valor_unitario_brl;
                        if (vu != null) {
                          total += Number(vu) * v;
                          temValor = true;
                        }
                      });
                    }
                    if (!temValor) return null;
                    return (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Valor estimado</span>
                        <span className="font-bold text-primary tabular-nums">
                          {formatCurrencyBRL(total)}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Dropdown discreto: índice de confiança da IA por item.
                    Informativo — não interfere no fluxo de coleta. */}
                {(() => {
                  const linhas: { nome: string; pct: number; n: number }[] = [];
                  if (phase === "review" && resumoFinal && !reviewUsesLocal) {
                    resumoFinal.itens.forEach((i) => {
                      if (i.confidence_media != null) {
                        linhas.push({
                          nome: nomeAmigavel({
                            alimento: i.alimento,
                            nome_padronizado: i.nome_padronizado ?? null,
                          }),
                          pct: Number(i.confidence_media) * 100,
                          n: Number(i.quantidade),
                        });
                      }
                    });
                  } else {
                    Object.entries(metaByClass).forEach(([k, m]) => {
                      if (m.confidences.length > 0) {
                        const avg =
                          m.confidences.reduce((a, b) => a + b, 0) /
                          m.confidences.length;
                        linhas.push({
                          nome: m.nome_exibicao || k,
                          pct: avg * 100,
                          n: m.confidences.length,
                        });
                      }
                    });
                  }
                  if (linhas.length === 0) return null;
                  const mediaGeral =
                    linhas.reduce((a, l) => a + l.pct, 0) / linhas.length;
                  return (
                    <details className="group rounded-lg border border-border/60 bg-muted/30 text-xs">
                      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-3 py-2 select-none">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <BadgePercent className="h-3.5 w-3.5" />
                          Confiança da IA
                          <span className="text-foreground font-semibold tabular-nums">
                            {mediaGeral.toFixed(0)}%
                          </span>
                          <span className="text-muted-foreground/70">· média</span>
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-3 pb-2 pt-1 space-y-1">
                        <p className="text-[10px] text-muted-foreground/80 leading-snug">
                          Quanto maior o %, mais segura a IA está sobre o item.
                          Apenas informativo — não afeta o que foi contado.
                        </p>
                        <ul className="space-y-0.5">
                          {linhas
                            .sort((a, b) => b.pct - a.pct)
                            .map((l) => (
                              <li
                                key={l.nome}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="truncate capitalize text-muted-foreground">
                                  {l.nome}
                                </span>
                                <span className="tabular-nums text-foreground/80 font-medium">
                                  {l.pct.toFixed(0)}%
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </details>
                  );
                })()}

                {phase === "running" && recent.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-secondary" /> Detecções recentes
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recent.map((r, i) => (
                        <span
                          key={`${r.ts}-${i}`}
                          className="text-[11px] px-2 py-1 rounded-full bg-secondary/30 text-secondary-foreground font-medium animate-in fade-in slide-in-from-bottom-1"
                        >
                          {r.class}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          )}

          {/* Done */}
          {phase === "done" && resumoFinal && (
            (() => {
              const usandoLocal = resumoFinal.itens.length === 0 && totalLocal > 0;
              const totalExibido = usandoLocal
                ? totalLocal
                : resumoFinal.itens.reduce((a, i) => a + i.quantidade, 0);
              const itensExibidos = usandoLocal
                ? Object.entries(localCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v], idx) => ({ id: -idx - 1, alimento: k, quantidade: v }))
                : resumoFinal.itens;
              return (
                <div className="rounded-2xl border border-success/30 bg-success/10 p-6 text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
                  <h2 className="text-2xl font-bold">Coleta finalizada!</h2>
                  <p className="text-muted-foreground">
                    Total de <strong>{formatNumber(totalExibido)}</strong> itens registrados.
                  </p>
                  {usandoLocal && (
                    <p className="text-xs text-warning-foreground bg-warning/30 rounded-lg px-3 py-2 inline-block">
                      Mostrando contagem local — o servidor não retornou os itens.
                      Confira sua conexão com o backend.
                    </p>
                  )}
                  {itensExibidos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item foi detectado.</p>
                  ) : (
                    <ul className="grid sm:grid-cols-2 gap-2 text-left max-w-md mx-auto">
                      {itensExibidos.map((i) => {
                        const item = i as ColetaResumo["itens"][number];
                        const nome = nomeAmigavel({
                          alimento: item.alimento,
                          nome_padronizado: item.nome_padronizado ?? null,
                        });
                        const valorTotal =
                          item.valor_total_brl ??
                          (item.valor_unitario_brl != null
                            ? Number(item.valor_unitario_brl) * Number(item.quantidade)
                            : null);
                        return (
                          <li
                            key={item.id}
                            className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="capitalize truncate font-medium">{nome}</span>
                              <span className="font-bold text-primary tabular-nums">
                                {formatNumber(item.quantidade)}
                              </span>
                            </div>
                            {(item.tipo_alimento || valorTotal != null) && (
                              <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                {item.tipo_alimento ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary/25 text-secondary-foreground font-medium">
                                    <Tag className="h-2.5 w-2.5" />
                                    {item.tipo_alimento}
                                  </span>
                                ) : (
                                  <span />
                                )}
                                {valorTotal != null && (
                                  <span className="font-semibold text-foreground tabular-nums">
                                    {formatCurrencyBRL(valorTotal)}
                                  </span>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button asChild variant="outline">
                      <Link to="/">
                        <ArrowLeft className="h-4 w-4" /> Voltar ao início
                      </Link>
                    </Button>
                    <Button onClick={reiniciar} className="gradient-warm text-secondary-foreground">
                      <Camera className="h-4 w-4" /> Nova coleta
                    </Button>
                  </div>
                </div>
              );
            })()
          )}
        </>
      )}
    </div>
  );
}

function DirectionCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-xl border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-background hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </span>
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
    </button>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-xl border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 ${
        active
          ? "border-secondary bg-secondary/10 shadow-sm"
          : "border-border bg-background hover:border-secondary/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
            active ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </span>
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
    </button>
  );
}
