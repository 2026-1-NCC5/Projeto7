// Centraliza chamadas ao Backend (Node/Express) e ao AI-Service (FastAPI).
// Configurável via VITE_BACKEND_URL e VITE_AI_URL. Defaults para localhost.

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:3000";
const AI_URL = (import.meta.env.VITE_AI_URL as string | undefined) ?? "http://localhost:8000";

export const API_CONFIG = { BACKEND_URL, AI_URL };

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const shouldLog = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV) && path.startsWith("/coletas");
  if (shouldLog) {
    console.log("[api] request ->", {
      base,
      path,
      method: init?.method ?? "GET",
      body: init?.body,
    });
  }
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // sem body
  }
  if (!res.ok || (payload && payload.error)) {
    if (shouldLog) {
      console.error("[api] response erro ->", {
        path,
        status: res.status,
        payload,
      });
    }
    throw new Error(payload?.error || `Erro ${res.status} em ${path}`);
  }

  if (shouldLog) {
    console.log("[api] response ok ->", {
      path,
      status: res.status,
      payload,
    });
  }
  return payload as T;
}

const backend = <T>(path: string, init?: RequestInit) => request<T>(BACKEND_URL, path, init);
const ai = <T>(path: string, init?: RequestInit) => request<T>(AI_URL, path, init);

// ===== Tipos =====
export type User = {
  id: number;
  nome: string;
  sobrenome: string;
  email: string;
  cargo: "admin" | "user";
};

export type Evento = {
  id: number;
  nome: string;
  descricao: string | null;
  local_evento: string | null;
  data_inicio: string;
  data_fim: string | null;
  status: "planejado" | "ativo" | "finalizado";
};

export type EventoResumo = {
  evento: Evento | null;
  total_coletas: number;
  total_itens: number;
  duracao_segundos: number;
  // Campos novos do contrato v1.0.1 (todos opcionais)
  grupos_inscritos?: number;
  total_valor_coletado?: number;
  total_peso_g?: number;
  quantidade_total_itens?: number;
};

export type TopItem = { nome: string; quantidade: number };

export type GrupoRanking = {
  id: number;
  nome: string;
  total_itens: number;
  top3_itens: TopItem[];
  // Campos novos opcionais
  posicao?: number;
  total_valor?: number;
  total_peso_g?: number;
  membros_coletando?: number;
};

export type UsuarioRanking = {
  id: number;
  nome: string;
  sobrenome: string;
  total_itens: number;
  top3_itens: TopItem[];
  // Campos novos opcionais
  posicao?: number;
  total_valor?: number;
  total_peso_g?: number;
  coletas_realizadas?: number;
};

export type GrupoMeu = {
  id: number;
  nome: string;
  sou_lider: boolean;
  // Campos novos opcionais
  cargo?: "lider" | "membro";
  eventos?: { evento_id: number; status?: string }[];
};

export type Coleta = {
  id: number;
  evento_id: number;
  grupo_id: number;
  usuario_id: number;
  data_hora_coleta: string;
  status: "em_andamento" | "finalizado" | "cancelado";
};

export type ColetaTotalizadores = {
  quantidade_total_itens?: number;
  peso_total_g?: number;
  valor_total_brl?: number;
  itens_por_tipo?: Record<string, number>;
  valor_por_tipo?: Record<string, number>;
};

export type ColetaResumo = {
  coleta: Coleta & { finalizado_em?: string };
  itens: ColetaItemResumo[];
  totalizadores?: ColetaTotalizadores;
};

// Metadados enriquecidos que podem acompanhar uma detecção/item, vindos do
// catálogo de alimentos (backend/AI). Todos opcionais para manter compat.
export type AlimentoMeta = {
  classe_modelo?: string | null;
  nome_padronizado?: string | null;
  nome_exibicao?: string | null;
  tipo_alimento?: string | null;
  peso_unitario_g?: number | null;
  volume_unitario_ml?: number | null;
  valor_unitario_brl?: number | null;
  valor_total_brl?: number | null;
  quantidade_detectada?: number | null;
};

export type Detection = {
  track_id: string;
  class: string;
  confidence: number;
} & AlimentoMeta;

export type DetectionWithBbox = Detection & {
  bbox: [number, number, number, number];
};

export type ColetaItemResumo = {
  id: number;
  alimento: string;
  quantidade: number;
  // Campos enriquecidos opcionais
  nome_padronizado?: string | null;
  classe_modelo?: string | null;
  tipo_alimento?: string | null;
  peso_unitario_g?: number | null;
  peso_total_g?: number | null;
  valor_unitario_brl?: number | null;
  valor_total_brl?: number | null;
  confidence_media?: number | null;
};

export type DashboardGeral = {
  timeline: { periodo: string; total_coletas: number; total_itens: number }[];
  comparativo_eventos: { evento_id: number; nome: string; total_itens: number }[];
  // Campos novos opcionais do contrato v1.0.1
  total_eventos?: number;
  eventos_ativos?: number;
  total_valor_semana?: number;
  total_peso_g?: number;
  total_itens_coletados?: number;
  media_valor_por_grupo?: number;
  series?: {
    data: string;
    valor_total?: number;
    peso_total_g?: number;
    quantidade_itens?: number;
    itens_por_tipo?: Record<string, number>;
  }[];
};

export type AnaliseColeta = {
  coleta_id: number;
  graficos: Record<string, any>;
};

// ===== Normalizadores (compat antigo <-> novo contrato v1.0.1) =====
const TOKEN_KEY = "auth_token";
function storeToken(token: unknown) {
  if (typeof window === "undefined") return;
  if (typeof token === "string" && token.length > 0) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  }
}
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function normalizeEventoResumo(raw: any): EventoResumo {
  if (!raw) {
    return { evento: null, total_coletas: 0, total_itens: 0, duracao_segundos: 0 };
  }
  // Contrato antigo: já vem com `evento`
  if (raw.evento !== undefined) {
    return {
      evento: raw.evento ?? null,
      total_coletas: Number(raw.total_coletas ?? 0),
      total_itens: Number(raw.total_itens ?? raw.quantidade_total_itens ?? 0),
      duracao_segundos: Number(raw.duracao_segundos ?? 0),
      grupos_inscritos: raw.grupos_inscritos,
      total_valor_coletado: raw.total_valor_coletado,
      total_peso_g: raw.total_peso_g,
      quantidade_total_itens: raw.quantidade_total_itens,
    };
  }
  // Contrato novo (flat): {evento_id, nome, status, data_inicio, ...}
  if (raw.evento_id) {
    const evento: Evento = {
      id: Number(raw.evento_id),
      nome: String(raw.nome ?? ""),
      descricao: raw.descricao ?? null,
      local_evento: raw.local_evento ?? null,
      data_inicio: raw.data_inicio,
      data_fim: raw.data_fim ?? null,
      status: raw.status ?? "ativo",
    };
    return {
      evento,
      total_coletas: Number(raw.total_coletas ?? 0),
      total_itens: Number(raw.quantidade_total_itens ?? raw.total_itens ?? 0),
      duracao_segundos: Number(raw.duracao_segundos ?? 0),
      grupos_inscritos: raw.grupos_inscritos,
      total_valor_coletado: raw.total_valor_coletado,
      total_peso_g: raw.total_peso_g,
      quantidade_total_itens: raw.quantidade_total_itens,
    };
  }
  return { evento: null, total_coletas: 0, total_itens: 0, duracao_segundos: 0 };
}

function normalizeGrupoRanking(arr: any[]): GrupoRanking[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((g) => ({
    id: Number(g.id ?? g.grupo_id),
    nome: String(g.nome ?? g.nome_grupo ?? ""),
    total_itens: Number(g.total_itens ?? g.quantidade_itens ?? 0),
    top3_itens: Array.isArray(g.top3_itens) ? g.top3_itens : [],
    posicao: g.posicao,
    total_valor: g.total_valor,
    total_peso_g: g.total_peso_g,
    membros_coletando: g.membros_coletando,
  }));
}

function normalizeUsuarioRanking(arr: any[]): UsuarioRanking[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((u) => ({
    id: Number(u.id ?? u.usuario_id),
    nome: String(u.nome ?? ""),
    sobrenome: String(u.sobrenome ?? ""),
    total_itens: Number(u.total_itens ?? u.quantidade_itens ?? 0),
    top3_itens: Array.isArray(u.top3_itens) ? u.top3_itens : [],
    posicao: u.posicao,
    total_valor: u.total_valor,
    total_peso_g: u.total_peso_g,
    coletas_realizadas: u.coletas_realizadas,
  }));
}

function normalizeGruposMeus(arr: any[]): GrupoMeu[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((g) => ({
    id: Number(g.id),
    nome: String(g.nome ?? ""),
    sou_lider:
      typeof g.sou_lider === "boolean" ? g.sou_lider : g.cargo === "lider",
    cargo: g.cargo,
    eventos: g.eventos,
  }));
}

function normalizeDashboardGeral(raw: any): DashboardGeral {
  if (!raw) return { timeline: [], comparativo_eventos: [] };
  // Contrato antigo
  if (Array.isArray(raw.timeline) || Array.isArray(raw.comparativo_eventos)) {
    return {
      timeline: raw.timeline ?? [],
      comparativo_eventos: raw.comparativo_eventos ?? [],
      ...raw,
    };
  }
  // Contrato novo (series)
  const series: any[] = Array.isArray(raw.series) ? raw.series : [];
  return {
    timeline: series.map((s) => ({
      periodo: String(s.data ?? s.periodo ?? ""),
      total_coletas: Number(s.total_coletas ?? 0),
      total_itens: Number(s.quantidade_itens ?? s.total_itens ?? 0),
    })),
    comparativo_eventos: Array.isArray(raw.comparativo_eventos)
      ? raw.comparativo_eventos
      : [],
    total_eventos: raw.total_eventos,
    eventos_ativos: raw.eventos_ativos,
    total_valor_semana: raw.total_valor_semana,
    total_peso_g: raw.total_peso_g,
    total_itens_coletados: raw.total_itens_coletados,
    media_valor_por_grupo: raw.media_valor_por_grupo,
    series: raw.series,
  };
}

function normalizeColetaResumo(raw: any): ColetaResumo {
  if (!raw) {
    return {
      coleta: {
        id: 0,
        evento_id: 0,
        grupo_id: 0,
        usuario_id: 0,
        data_hora_coleta: "",
        status: "em_andamento",
      },
      itens: [],
    };
  }
  // Contrato antigo: {coleta:{...}, itens:[...]}
  if (raw.coleta) {
    return {
      coleta: raw.coleta,
      itens: Array.isArray(raw.itens) ? raw.itens : [],
      totalizadores: raw.totalizadores ?? raw.resumo,
    };
  }
  // Contrato novo (flat): {coleta_id, status, evento_id, grupo_id, usuario_id, itens, totalizadores}
  const coleta: Coleta & { finalizado_em?: string } = {
    id: Number(raw.coleta_id ?? raw.id ?? 0),
    evento_id: Number(raw.evento_id ?? 0),
    grupo_id: Number(raw.grupo_id ?? 0),
    usuario_id: Number(raw.usuario_id ?? 0),
    data_hora_coleta: raw.data_hora_coleta ?? raw.criado_em ?? "",
    status: raw.status ?? "em_andamento",
    finalizado_em: raw.finalizado_em,
  };
  const itens: ColetaItemResumo[] = Array.isArray(raw.itens)
    ? raw.itens.map((it: any, idx: number) => ({
        id: Number(it.id ?? it.alimento_id ?? idx),
        alimento: String(it.alimento ?? it.nome_exibicao ?? it.nome ?? ""),
        quantidade: Number(it.quantidade ?? 0),
        nome_padronizado: it.nome_padronizado ?? null,
        nome_exibicao: it.nome_exibicao ?? null,
        classe_modelo: it.classe_modelo ?? null,
        tipo_alimento: it.tipo_alimento ?? null,
        peso_unitario_g: it.peso_unitario_g ?? null,
        peso_total_g: it.peso_total_g ?? null,
        valor_unitario_brl: it.valor_unitario_brl ?? null,
        valor_total_brl: it.valor_total_brl ?? null,
        confidence_media: it.confidence_media ?? null,
      }))
    : [];
  return { coleta, itens, totalizadores: raw.totalizadores ?? raw.resumo };
}

// Serializa uma Detection no payload novo do backend (mantém `track_id` p/ compat).
function serializeDetectionForBackend(d: Detection): Record<string, any> {
  const out: Record<string, any> = {
    track_id: d.track_id,
    ia_track_id: d.track_id,
    class: d.class,
    confidence: d.confidence,
    quantidade_detectada: Number(d.quantidade_detectada ?? 1),
  };
  if (d.peso_unitario_g != null) out.peso_total_g = d.peso_unitario_g;
  if (d.valor_unitario_brl != null) out.valor_unitario_brl = d.valor_unitario_brl;
  if (d.nome_exibicao) out.nome_exibicao = d.nome_exibicao;
  if (d.nome_padronizado) out.nome_padronizado = d.nome_padronizado;
  if (d.classe_modelo) out.classe_modelo = d.classe_modelo;
  if (d.tipo_alimento) out.tipo_alimento = d.tipo_alimento;
  return out;
}

// ===== API =====
export const api = {
  auth: {
    register: async (data: { nome: string; sobrenome: string; email: string; senha: string }) => {
      const res = await backend<{ user: User; token?: string }>("/users/register", {
        method: "POST",
        body: JSON.stringify(data),
      });
      storeToken(res.token);
      return res;
    },
    login: async (data: { email: string; senha: string }) => {
      const res = await backend<{ user: User; token?: string }>("/users/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      storeToken(res.token);
      return res;
    },
  },
  eventos: {
    atualResumo: async () =>
      normalizeEventoResumo(await backend<any>("/eventos/atual/resumo")),
    rankingGrupos: async (eventoId: number) => {
      const raw = await backend<any>(`/eventos/${eventoId}/ranking-grupos`);
      return {
        evento_id: Number(raw?.evento_id ?? eventoId),
        ranking_grupos: normalizeGrupoRanking(raw?.ranking_grupos ?? []),
      };
    },
    criar: (data: {
      admin_id: number;
      nome: string;
      descricao?: string;
      local_evento?: string;
      data_inicio: string;
      data_fim?: string;
      status?: "planejado" | "ativo" | "finalizado";
    }) => backend<Evento>("/eventos", { method: "POST", body: JSON.stringify(data) }),
    deletar: (eventoId: number, data: { admin_id: number }) =>
      backend<{ sucesso: true; evento_id: number; mensagem: string }>(
        `/eventos/${eventoId}`,
        { method: "DELETE", body: JSON.stringify(data) },
      ),
    dashboardGeral: async (params: {
      admin_id: number;
      from?: string;
      to?: string;
      granularity?: "day" | "week" | "month";
    }) => {
      const q = new URLSearchParams();
      q.set("admin_id", String(params.admin_id));
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      if (params.granularity) q.set("granularity", params.granularity);
      const raw = await backend<any>(`/eventos/admin/dashboard/geral?${q.toString()}`);
      return normalizeDashboardGeral(raw);
    },
  },
  grupos: {
    criar: (data: {
      nome: string;
      descricao?: string;
      criado_por: number;
      evento_id?: number;
      integrantes_emails: string[];
    }) => backend<any>("/grupos", { method: "POST", body: JSON.stringify(data) }),
    entrarEvento: (grupoId: number, data: { solicitante_id: number; evento_id: number }) =>
      backend<{ sucesso: true }>(
        `/grupos/${grupoId}/entrar-evento`,
        { method: "POST", body: JSON.stringify(data) },
      ),
    sairEvento: (grupoId: number, data: { solicitante_id: number; evento_id: number }) =>
      backend<{ sucesso: true; grupo_id: number; evento_id: number; mensagem: string }>(
        `/grupos/${grupoId}/sair-evento`,
        { method: "DELETE", body: JSON.stringify(data) },
      ),
    deletar: (grupoId: number, data: { solicitante_id: number }) =>
      backend<{ sucesso: true; grupo_id: number; mensagem: string }>(
        `/grupos/${grupoId}`,
        { method: "DELETE", body: JSON.stringify(data) },
      ),
    meus: async (usuarioId: number, eventoId?: number) => {
      const q = new URLSearchParams();
      q.set("usuarioId", String(usuarioId));
      if (eventoId) q.set("eventoId", String(eventoId));
      const raw = await backend<any>(`/grupos/meus/lista?${q.toString()}`);
      return normalizeGruposMeus(Array.isArray(raw) ? raw : []);
    },
    rankingUsuarios: async (grupoId: number, eventoId: number) => {
      const raw = await backend<any>(
        `/grupos/${grupoId}/ranking-usuarios?eventoId=${eventoId}`,
      );
      return {
        grupo_id: Number(raw?.grupo_id ?? grupoId),
        evento_id: Number(raw?.evento_id ?? eventoId),
        ranking_usuarios: normalizeUsuarioRanking(raw?.ranking_usuarios ?? []),
      };
    },
  },
  coleta: {
    start: (data: { evento_id: number; grupo_id: number; usuario_id: number }) =>
      backend<Coleta>("/coletas/start", { method: "POST", body: JSON.stringify(data) }),
    detections: (coletaId: number, detections: Detection[]) =>
      backend<{
        coleta_id: number;
        inserted_events: number;
        duplicated_events?: number;
        resumo?: ColetaTotalizadores;
      }>(`/coletas/${coletaId}/detections`, {
        method: "POST",
        body: JSON.stringify({ detections: detections.map(serializeDetectionForBackend) }),
      }),
    resumo: async (coletaId: number) =>
      normalizeColetaResumo(await backend<any>(`/coletas/${coletaId}/resumo`)),
    finalize: async (coletaId: number, usuario_id: number) =>
      normalizeColetaResumo(
        await backend<any>(`/coletas/${coletaId}/finalize`, {
          method: "POST",
          body: JSON.stringify({ usuario_id }),
        }),
      ),
    analises: (coletaId: number) =>
      backend<AnaliseColeta>(`/coletas/${coletaId}/analises`),
  },
  ai: {
    sessionStart: (direction: "lr" | "rl" = "lr", min_confidence: number = 0.5) =>
      ai<{ session_id: string }>("/session/start", {
        method: "POST",
        body: JSON.stringify({ direction, min_confidence }),
      }),
    sessionFrame: (sessionId: string, image_base64: string) =>
      ai<{
        new_events?: any[];
        active_detections?: any[];
        totals?: Record<string, number>;
      }>(`/session/${sessionId}/frame`, {
        method: "POST",
        body: JSON.stringify({ image_base64 }),
      }),
    sessionFinalize: (sessionId: string) =>
      ai<{ ok: boolean }>(`/session/${sessionId}/finalize`, { method: "POST" }),
  },
};

// Extrai metadados enriquecidos opcionais (catálogo de alimentos) de um
// objeto recebido da IA ou do backend. Mantém compatibilidade com o
// contrato antigo: todos os campos podem vir indefinidos.
function pickAlimentoMeta(e: any): AlimentoMeta {
  const num = (v: any): number | null =>
    v === null || v === undefined || v === "" ? null : Number(v);
  return {
    classe_modelo: e.classe_modelo ?? e.class ?? null,
    nome_padronizado: e.nome_padronizado ?? null,
    nome_exibicao: e.nome_exibicao ?? e.display_name ?? null,
    tipo_alimento: e.tipo_alimento ?? e.tipo ?? null,
    peso_unitario_g: num(e.peso_unitario_g),
    volume_unitario_ml: num(e.volume_unitario_ml),
    valor_unitario_brl: num(e.valor_unitario_brl ?? e.valor_unitario ?? e.valor),
    valor_total_brl: num(e.valor_total_brl ?? e.valor_total),
    quantidade_detectada: num(e.quantidade ?? e.quantidade_detectada ?? 1),
  };
}

// Normaliza eventos do AI para formato do backend
export function normalizeDetections(events: any[] | undefined | null): Detection[] {
  if (!Array.isArray(events)) return [];
  return events
    .map((e) => ({
      track_id: String(e.track_id ?? e.id ?? ""),
      class: String(e.class ?? e.class_name ?? e.label ?? ""),
      confidence: Number(e.confidence ?? e.conf ?? e.score ?? 0),
      ...pickAlimentoMeta(e),
    }))
    .filter((e) => e.track_id && e.class);
}

/**
 * Versão de `normalizeDetections` que preserva a bounding box devolvida
 * pelo AI-Service (`active_detections`). Usada pelo overlay visual em
 * `/coleta` para desenhar retângulos com label/confiança no Canvas.
 */
export function normalizeDetectionsWithBbox(
  detections: any[] | undefined | null,
): DetectionWithBbox[] {
  if (!Array.isArray(detections)) return [];
  return detections
    .map((d) => {
      const bbox = Array.isArray(d.bbox) && d.bbox.length === 4
        ? (d.bbox.map((n: any) => Number(n)) as [number, number, number, number])
        : ([0, 0, 0, 0] as [number, number, number, number]);
      return {
        track_id: String(d.track_id ?? d.id ?? ""),
        class: String(d.class ?? d.class_name ?? d.label ?? ""),
        confidence: Number(d.confidence ?? d.conf ?? d.score ?? 0),
        bbox,
        ...pickAlimentoMeta(d),
      };
    })
    .filter((d) => d.track_id && d.class);
}

/**
 * Desenha bounding boxes + label (classe + % de confiança) num canvas que
 * fica sobreposto ao vídeo da câmera. As coordenadas das bboxes estão no
 * espaço de pixels do frame original (mesmo tamanho do vídeo), por isso o
 * canvas precisa ter `width/height` iguais a `videoWidth/videoHeight`.
 */
export function drawDetectionsOnCanvas(
  canvas: HTMLCanvasElement,
  detections: DetectionWithBbox[],
  options?: {
    strokeColor?: string;
    textColor?: string;
    fillOpacity?: number;
    lineWidth?: number;
    fontSize?: number;
  },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const {
    strokeColor = "#22c55e",
    textColor = "#0b1f1f",
    fillOpacity = 0.12,
    lineWidth = 2,
    fontSize = 14,
  } = options ?? {};

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((det) => {
    const [x1, y1, x2, y2] = det.bbox;
    const w = x2 - x1;
    const h = y2 - y1;
    if (w <= 0 || h <= 0) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x1, y1, w, h);

    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = fillOpacity;
    ctx.fillRect(x1, y1, w, h);
    ctx.globalAlpha = 1;

    const labelName = det.nome_exibicao || det.class;
    const label = `${labelName} ${(det.confidence * 100).toFixed(0)}%`;
    const padding = 4;
    ctx.font = `bold ${fontSize}px sans-serif`;
    const metrics = ctx.measureText(label);
    const textWidth = metrics.width + padding * 2;
    const textHeight = fontSize + padding * 2;

    const labelY = y1 - textHeight < 0 ? y1 : y1 - textHeight;
    ctx.fillStyle = strokeColor;
    ctx.fillRect(x1, labelY, textWidth, textHeight);

    ctx.fillStyle = textColor;
    ctx.textBaseline = "top";
    ctx.fillText(label, x1 + padding, labelY + padding);
  });
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}h ${m}m ${r}s`;
}

export function formatNumber(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR");
}

/** Formata um valor monetário em BRL. Retorna "—" se nulo/indefinido. */
export function formatCurrencyBRL(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Retorna o nome mais amigável disponível para um item/detecção. */
export function nomeAmigavel(meta: {
  nome_exibicao?: string | null;
  nome_padronizado?: string | null;
  alimento?: string | null;
  class?: string | null;
}): string {
  return (
    meta.nome_exibicao ||
    meta.alimento ||
    meta.nome_padronizado ||
    meta.class ||
    "—"
  );
}
