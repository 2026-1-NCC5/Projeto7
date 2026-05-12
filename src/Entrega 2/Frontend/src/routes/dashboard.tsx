import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Coins,
  Crown,
  Flame,
  Layers,
  Loader2,
  Package,
  PieChart as PieIcon,
  Scale,
  Trophy,
  User as UserIcon,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/routes/index";
import {
  api,
  formatCurrencyBRL,
  formatMassOrVolume,
  formatNumber,
  formatTipoAlimento,
  lookupAlimentoMeta,
  type DashboardGeral,
  type EventoResumo,
  type GrupoMeu,
  type GrupoRanking,
  type TopItem,
  type UsuarioRanking,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EmpathTech" },
      {
        name: "description",
        content:
          "Visão detalhada das coletas: quantidade, peso, valor estimado e distribuição por tipo de alimento.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <DashboardPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-success)",
];

function dedupById<T extends { id: number | string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr ?? []) {
    const k = String(it.id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

// ------------------------------------------------------------------
// Enriquecimento dos top-items vindos do backend (apenas nome + quantidade)
// usando o catálogo local CATALOGO_ALIMENTOS.
// ------------------------------------------------------------------

type ItemEnriquecido = {
  key: string;
  nome: string;
  nome_padronizado: string;
  tipo_alimento: string;
  quantidade: number;
  peso_total_g: number; // 0 se não houver peso
  volume_total_ml: number;
  valor_total_brl: number;
};

function enrichItems(items: TopItem[]): ItemEnriquecido[] {
  const map = new Map<string, ItemEnriquecido>();
  for (const it of items) {
    const meta = lookupAlimentoMeta(it.nome);
    const key = meta?.classe_modelo || meta?.nome_padronizado || it.nome;
    const nome = meta?.nome_exibicao || it.nome;
    const tipo = meta?.tipo_alimento || "outros";
    const peso = Number(meta?.peso_unitario_g ?? 0);
    const vol = Number(meta?.volume_unitario_ml ?? 0);
    const val = Number(meta?.valor_unitario_brl ?? 0);
    const qtd = Number(it.quantidade ?? 0);
    const cur = map.get(key) ?? {
      key,
      nome,
      nome_padronizado: meta?.nome_padronizado || it.nome,
      tipo_alimento: tipo,
      quantidade: 0,
      peso_total_g: 0,
      volume_total_ml: 0,
      valor_total_brl: 0,
    };
    cur.quantidade += qtd;
    cur.peso_total_g += peso * qtd;
    cur.volume_total_ml += vol * qtd;
    cur.valor_total_brl += val * qtd;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.quantidade - a.quantidade);
}

function aggregatePorTipo(items: ItemEnriquecido[]) {
  const m = new Map<string, { tipo: string; quantidade: number; peso_g: number; valor: number }>();
  for (const it of items) {
    const cur = m.get(it.tipo_alimento) ?? {
      tipo: formatTipoAlimento(it.tipo_alimento),
      quantidade: 0,
      peso_g: 0,
      valor: 0,
    };
    cur.quantidade += it.quantidade;
    cur.peso_g += it.peso_total_g;
    cur.valor += it.valor_total_brl;
    m.set(it.tipo_alimento, cur);
  }
  return Array.from(m.values()).sort((a, b) => b.quantidade - a.quantidade);
}

function totalsOf(items: ItemEnriquecido[]) {
  return items.reduce(
    (a, b) => ({
      quantidade: a.quantidade + b.quantidade,
      peso_g: a.peso_g + b.peso_total_g,
      volume_ml: a.volume_ml + b.volume_total_ml,
      valor: a.valor + b.valor_total_brl,
      tipos: a.tipos.add(b.tipo_alimento),
    }),
    { quantidade: 0, peso_g: 0, volume_ml: 0, valor: 0, tipos: new Set<string>() },
  );
}

// ------------------------------------------------------------------
// Página principal
// ------------------------------------------------------------------

function DashboardPage() {
  const { user } = useAuth();
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [dashboard, setDashboard] = useState<DashboardGeral | null>(null);
  const [rankingAtual, setRankingAtual] = useState<GrupoRanking[]>([]);
  const [loading, setLoading] = useState(true);

  const [eventos, setEventos] = useState<{ id: number; nome: string }[]>([]);
  const [eventoSel, setEventoSel] = useState<string>("");
  const [rankingEvento, setRankingEvento] = useState<GrupoRanking[]>([]);
  const [loadingEvento, setLoadingEvento] = useState(false);

  const [grupoSel, setGrupoSel] = useState<string>("");
  const [usuariosGrupo, setUsuariosGrupo] = useState<UsuarioRanking[]>([]);
  const [loadingGrupo, setLoadingGrupo] = useState(false);

  const [meusGrupos, setMeusGrupos] = useState<GrupoMeu[]>([]);
  const [meuTotalQtd, setMeuTotalQtd] = useState(0);
  const [meuTopItens, setMeuTopItens] = useState<TopItem[]>([]);

  const isAdmin = user?.cargo === "admin";

  // Carrega visão geral.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await api.eventos.atualResumo();
        if (!alive) return;
        setResumo(r);

        // Lista de eventos (admin → todos via dashboardGeral; user → só o atual)
        const list: { id: number; nome: string }[] = [];
        if (r.evento) list.push({ id: r.evento.id, nome: r.evento.nome });
        let dash: DashboardGeral | null = null;
        if (isAdmin) {
          try {
            dash = await api.eventos.dashboardGeral({ admin_id: user.id, granularity: "day" });
            for (const e of dash.comparativo_eventos) {
              if (!list.find((x) => x.id === e.evento_id)) {
                list.push({ id: e.evento_id, nome: e.nome });
              }
            }
          } catch {
            /* ok */
          }
        }
        if (!alive) return;
        setDashboard(dash);
        setEventos(list);
        if (list[0]) setEventoSel(String(list[0].id));

        // Ranking do evento atual
        if (r.evento) {
          try {
            const g = await api.eventos.rankingGrupos(r.evento.id);
            if (alive) setRankingAtual(g.ranking_grupos);
          } catch {
            if (alive) setRankingAtual([]);
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, isAdmin]);

  // Ranking do evento selecionado
  useEffect(() => {
    if (!eventoSel) return;
    let alive = true;
    (async () => {
      setLoadingEvento(true);
      try {
        const g = await api.eventos.rankingGrupos(Number(eventoSel));
        if (!alive) return;
        setRankingEvento(dedupById(g.ranking_grupos));
        if (g.ranking_grupos[0]) setGrupoSel(String(g.ranking_grupos[0].id));
        else setGrupoSel("");
      } catch {
        if (alive) {
          setRankingEvento([]);
          setGrupoSel("");
        }
      } finally {
        if (alive) setLoadingEvento(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventoSel]);

  // Usuários do grupo selecionado dentro do evento selecionado
  useEffect(() => {
    if (!grupoSel || !eventoSel) {
      setUsuariosGrupo([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoadingGrupo(true);
      try {
        const r = await api.grupos.rankingUsuarios(Number(grupoSel), Number(eventoSel));
        if (alive) setUsuariosGrupo(r.ranking_usuarios);
      } catch {
        if (alive) setUsuariosGrupo([]);
      } finally {
        if (alive) setLoadingGrupo(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [grupoSel, eventoSel]);

  // Métricas do usuário logado em todos os seus grupos do evento atual.
  useEffect(() => {
    if (!user || !resumo?.evento) return;
    let alive = true;
    (async () => {
      try {
        const meus = await api.grupos.meus(user.id, resumo.evento!.id);
        if (!alive) return;
        setMeusGrupos(dedupById(meus));
        let total = 0;
        const mapItens = new Map<string, number>();
        for (const g of meus) {
          try {
            const r = await api.grupos.rankingUsuarios(g.id, resumo.evento!.id);
            const me = r.ranking_usuarios.find((u) => u.id === user.id);
            if (me) {
              total += Number(me.total_itens || 0);
              for (const t of me.top3_itens || []) {
                mapItens.set(t.nome, (mapItens.get(t.nome) ?? 0) + Number(t.quantidade || 0));
              }
            }
          } catch {
            /* ignora */
          }
        }
        if (!alive) return;
        setMeuTotalQtd(total);
        setMeuTopItens(
          Array.from(mapItens.entries()).map(([nome, quantidade]) => ({ nome, quantidade })),
        );
      } catch {
        if (alive) {
          setMeusGrupos([]);
          setMeuTotalQtd(0);
          setMeuTopItens([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, resumo?.evento?.id]);

  // ===== Derivações memoizadas para gráficos =====

  const itensGerais = useMemo(() => {
    const all: TopItem[] = [];
    for (const g of rankingAtual) for (const t of g.top3_itens || []) all.push(t);
    return enrichItems(all);
  }, [rankingAtual]);

  const itensEventoSel = useMemo(() => {
    const all: TopItem[] = [];
    for (const g of rankingEvento) for (const t of g.top3_itens || []) all.push(t);
    return enrichItems(all);
  }, [rankingEvento]);

  const itensGrupoSel = useMemo(() => {
    const all: TopItem[] = [];
    for (const u of usuariosGrupo) for (const t of u.top3_itens || []) all.push(t);
    return enrichItems(all);
  }, [usuariosGrupo]);

  const itensUsuario = useMemo(() => enrichItems(meuTopItens), [meuTopItens]);

  const totaisGerais = totalsOf(itensGerais);
  const totaisEvento = totalsOf(itensEventoSel);
  const totaisGrupo = totalsOf(itensGrupoSel);
  const totaisUsuario = totalsOf(itensUsuario);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" /> Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão detalhada das coletas — quantidade, peso, valor estimado e tipo de alimento.
        </p>
      </header>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto" />
        </div>
      ) : (
        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="bg-muted overflow-x-auto">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="evento">Por evento</TabsTrigger>
            <TabsTrigger value="grupo">Por grupo</TabsTrigger>
            <TabsTrigger value="usuario">Eu</TabsTrigger>
          </TabsList>

          {/* ====== GERAL (evento atual) ====== */}
          <TabsContent value="geral" className="space-y-6">
            {!resumo?.evento ? (
              <EmptyState
                title="Sem evento ativo"
                message="Quando houver um evento em andamento, esta aba mostrará a visão geral."
              />
            ) : (
              <>
                <KpiGrid
                  label={`Evento atual: ${resumo.evento.nome}`}
                  totals={totaisGerais}
                  fallbackQtd={resumo.total_itens}
                />
                {dashboard && dashboard.timeline.length > 0 && (
                  <Card title="Coletas ao longo do tempo" desc="Itens e coletas por dia.">
                    <div className="h-72">
                      <ResponsiveContainer>
                        <LineChart
                          data={dashboard.timeline.map((t) => ({
                            periodo: new Date(t.periodo).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                            }),
                            itens: Number(t.total_itens),
                            coletas: Number(t.total_coletas),
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="periodo" stroke="var(--color-muted-foreground)" fontSize={12} />
                          <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend />
                          <Line type="monotone" dataKey="itens" name="Itens" stroke="var(--color-chart-1)" strokeWidth={3} />
                          <Line type="monotone" dataKey="coletas" name="Coletas" stroke="var(--color-chart-2)" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
                <ChartsGrid items={itensGerais} contexto={resumo.evento.nome} />
              </>
            )}
          </TabsContent>

          {/* ====== POR EVENTO ====== */}
          <TabsContent value="evento" className="space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Evento
                </label>
                <Select value={eventoSel} onValueChange={setEventoSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventos.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {eventoSel && (
                <Link
                  to="/eventos/$eventoId"
                  params={{ eventoId: eventoSel }}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Abrir página do evento →
                </Link>
              )}
            </div>

            {loadingEvento ? (
              <div className="text-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              </div>
            ) : !eventoSel ? (
              <EmptyState title="Selecione um evento" message="Escolha um evento para ver as métricas." />
            ) : rankingEvento.length === 0 ? (
              <EmptyState title="Sem coletas" message="Este evento ainda não tem coletas registradas." />
            ) : (
              <>
                <KpiGrid label={`Evento: ${eventos.find((e) => String(e.id) === eventoSel)?.nome ?? ""}`} totals={totaisEvento} fallbackQtd={rankingEvento.reduce((a, b) => a + Number(b.total_itens || 0), 0)} />
                <RankingGruposChart grupos={rankingEvento} />
                <ChartsGrid items={itensEventoSel} contexto="evento" />
              </>
            )}
          </TabsContent>

          {/* ====== POR GRUPO ====== */}
          <TabsContent value="grupo" className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Evento
                </label>
                <Select value={eventoSel} onValueChange={setEventoSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventos.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Grupo
                </label>
                <Select value={grupoSel} onValueChange={setGrupoSel} disabled={rankingEvento.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {rankingEvento.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.nome} · {formatNumber(g.total_itens)} itens
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingGrupo ? (
              <div className="text-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              </div>
            ) : !grupoSel ? (
              <EmptyState title="Selecione um grupo" message="Escolha um grupo para detalhar." />
            ) : usuariosGrupo.length === 0 ? (
              <EmptyState title="Sem coletas" message="Este grupo ainda não registrou itens." />
            ) : (
              <>
                <KpiGrid
                  label={`Grupo: ${rankingEvento.find((g) => String(g.id) === grupoSel)?.nome ?? ""}`}
                  totals={totaisGrupo}
                  fallbackQtd={usuariosGrupo.reduce((a, b) => a + Number(b.total_itens || 0), 0)}
                />
                <RankingUsuariosChart usuarios={usuariosGrupo} />
                <ChartsGrid items={itensGrupoSel} contexto="grupo" />
              </>
            )}
          </TabsContent>

          {/* ====== EU ====== */}
          <TabsContent value="usuario" className="space-y-6">
            {!resumo?.evento ? (
              <EmptyState title="Sem evento ativo" message="Sua visão pessoal aparece quando há evento em andamento." />
            ) : (
              <>
                <KpiGrid label={`Você · ${resumo.evento.nome}`} totals={totaisUsuario} fallbackQtd={meuTotalQtd} />
                <Card title="Seus grupos no evento" desc={`${meusGrupos.length} grupo(s) inscrito(s)`}>
                  {meusGrupos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Você ainda não tem grupos inscritos.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {meusGrupos.map((g) => (
                        <li
                          key={g.id}
                          className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold inline-flex items-center gap-1.5"
                        >
                          <Users className="h-3 w-3" /> {g.nome}
                          {g.sou_lider && <Crown className="h-3 w-3 text-secondary" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <ChartsGrid items={itensUsuario} contexto="você" />
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================================
// Subcomponentes
// ============================================================

const tooltipStyle = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
};

function Card({
  title,
  desc,
  children,
  icon: Icon,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  icon?: typeof Package;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-bold flex items-center gap-2">
        {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
        {title}
      </h2>
      {desc && <p className="text-xs text-muted-foreground mb-3 mt-0.5">{desc}</p>}
      <div className={desc ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        accent
          ? "gradient-warm text-secondary-foreground border-transparent shadow-warm"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-2xl sm:text-3xl font-bold leading-tight mt-1">{value}</div>
      {hint && <div className="text-[11px] opacity-70 mt-0.5">{hint}</div>}
    </div>
  );
}

function KpiGrid({
  label,
  totals,
  fallbackQtd,
}: {
  label: string;
  totals: { quantidade: number; peso_g: number; volume_ml: number; valor: number; tipos: Set<string> };
  fallbackQtd?: number;
}) {
  const qtd = totals.quantidade || fallbackQtd || 0;
  return (
    <section className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Package} label="Itens coletados" value={formatNumber(qtd)} accent />
        <KpiCard
          icon={Scale}
          label="Peso estimado"
          value={formatMassOrVolume({ peso_g: totals.peso_g })}
          hint={
            totals.volume_ml > 0
              ? `+ ${formatMassOrVolume({ volume_ml: totals.volume_ml })} de volume`
              : "baseado no catálogo"
          }
        />
        <KpiCard
          icon={Coins}
          label="Valor estimado"
          value={formatCurrencyBRL(totals.valor)}
          hint="estimativa via catálogo"
        />
        <KpiCard
          icon={Layers}
          label="Tipos de alimento"
          value={formatNumber(totals.tipos.size)}
          hint="categorias distintas"
        />
      </div>
    </section>
  );
}

function ChartsGrid({ items, contexto }: { items: ItemEnriquecido[]; contexto: string }) {
  const porTipo = aggregatePorTipo(items);
  const top10 = items.slice(0, 10);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Sem itens detalhados"
        message={`Não há dados suficientes em ${contexto} para gerar gráficos.`}
      />
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {/* Quantidade por alimento */}
      <Card title="Quantidade por alimento" desc="Top 10 itens mais coletados." icon={Package}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={top10} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis dataKey="nome" type="category" stroke="var(--color-muted-foreground)" fontSize={11} width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="quantidade" radius={[0, 8, 8, 0]}>
                {top10.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Distribuição por item (pie) — agora por NOME do item, não por segmento */}
      <Card title="Distribuição por item" desc="Participação de cada alimento no total coletado." icon={PieIcon}>
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatNumber(Number(v)), String(n)]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={top10}
                dataKey="quantidade"
                nameKey="nome"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {top10.map((it, i) => (
                  <Cell key={`${it.key}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Distribuição por tipo de alimento (donut) */}
      <Card title="Distribuição por tipo" desc="Participação de cada categoria no total coletado." icon={Layers}>
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any, n: any) => [formatNumber(Number(v)), String(n)]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={porTipo}
                dataKey="quantidade"
                nameKey="tipo"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
              >
                {porTipo.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Valor estimado por alimento (top 10) */}
      <Card title="Valor por alimento" desc="Top 10 itens por valor estimado em R$." icon={Coins}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart
              data={top10
                .filter((i) => i.valor_total_brl > 0)
                .map((i) => ({ nome: i.nome, valor: +i.valor_total_brl.toFixed(2) }))}
              layout="vertical"
              margin={{ left: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickFormatter={(v) => `R$${Number(v).toFixed(0)}`}
              />
              <YAxis dataKey="nome" type="category" stroke="var(--color-muted-foreground)" fontSize={11} width={120} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => formatCurrencyBRL(Number(v))}
              />
              <Bar dataKey="valor" radius={[0, 8, 8, 0]} fill="var(--color-secondary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Valor por tipo */}
      <Card title="Valor estimado por tipo" desc="Quanto cada categoria representa em R$." icon={Coins}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={porTipo}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="tipo" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickFormatter={(v) => `R$${Number(v).toFixed(0)}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => formatCurrencyBRL(Number(v))}
              />
              <Bar dataKey="valor" radius={[8, 8, 0, 0]} fill="var(--color-chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Peso por alimento (apenas itens com peso) */}
      <Card title="Peso por alimento" desc="Massa total estimada (kg) com base no catálogo." icon={Scale}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart
              data={top10
                .filter((i) => i.peso_total_g > 0)
                .map((i) => ({ nome: i.nome, kg: +(i.peso_total_g / 1000).toFixed(2) }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="nome" stroke="var(--color-muted-foreground)" fontSize={10} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickFormatter={(v) => `${v}kg`} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => `${Number(v).toLocaleString("pt-BR")} kg`}
              />
              <Bar dataKey="kg" radius={[8, 8, 0, 0]} fill="var(--color-chart-3)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabela detalhada */}
      <div className="lg:col-span-2">
        <Card title="Detalhamento por item" desc="Tabela com quantidade, peso e valor estimado.">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Alimento</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3 text-right">Qtd</th>
                  <th className="py-2 pr-3 text-right">Peso/Vol</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.key} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{it.nome}</td>
                    <td className="py-2 pr-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {formatTipoAlimento(it.tipo_alimento)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-bold text-primary">
                      {formatNumber(it.quantidade)}
                    </td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">
                      {it.peso_total_g > 0
                        ? formatMassOrVolume({ peso_g: it.peso_total_g })
                        : it.volume_total_ml > 0
                          ? formatMassOrVolume({ volume_ml: it.volume_total_ml })
                          : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right text-secondary font-semibold">
                      {it.valor_total_brl > 0 ? formatCurrencyBRL(it.valor_total_brl) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RankingGruposChart({ grupos }: { grupos: GrupoRanking[] }) {
  const data = [...grupos]
    .sort((a, b) => b.total_itens - a.total_itens)
    .slice(0, 10)
    .map((g) => ({ nome: g.nome, itens: Number(g.total_itens) }));
  return (
    <Card title="Ranking de grupos" desc="Top 10 grupos por itens coletados." icon={Trophy}>
      <div className="h-72">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="nome" stroke="var(--color-muted-foreground)" fontSize={10} interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="itens" radius={[8, 8, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "var(--color-secondary)" : "var(--color-chart-1)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function RankingUsuariosChart({ usuarios }: { usuarios: UsuarioRanking[] }) {
  const data = [...usuarios]
    .sort((a, b) => b.total_itens - a.total_itens)
    .slice(0, 8)
    .map((u) => ({
      nome: `${u.nome}`,
      itens: Number(u.total_itens),
    }));
  return (
    <Card title="Participação dos usuários" desc="Top contribuintes do grupo (radar)." icon={UserIcon}>
      <div className="h-72">
        <ResponsiveContainer>
          <RadarChart data={data}>
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis dataKey="nome" stroke="var(--color-muted-foreground)" fontSize={11} />
            <Radar
              name="Itens"
              dataKey="itens"
              stroke="var(--color-chart-1)"
              fill="var(--color-chart-1)"
              fillOpacity={0.4}
            />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
