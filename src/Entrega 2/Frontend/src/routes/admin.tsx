import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  Crown,
  ExternalLink,
  FileDown,
  Flame,
  Loader2,
  Package,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatAlimentoNome, formatDateTimeForDb } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
  formatDuration,
  formatNumber,
  type DashboardGeral,
  type EventoResumo,
  type GrupoRanking,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportarDashboardPDF, exportarRankingEventoPDF } from "@/lib/pdf-export";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel admin — EmpathTech" },
      {
        name: "description",
        content: "Métricas e gestão de eventos da plataforma EmpathTech para administradores.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute adminOnly>
      <AppShell>
        <AdminPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

type Granularity = "day" | "week" | "month";

function AdminPage() {
  const { user } = useAuth();
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [data, setData] = useState<DashboardGeral | null>(null);
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [topGrupos, setTopGrupos] = useState<GrupoRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCriar, setOpenCriar] = useState(false);

  // Drill-down: ranking de um evento escolhido (qualquer um dos comparativos)
  const [eventoFoco, setEventoFoco] = useState<string>("");
  const [rankingFoco, setRankingFoco] = useState<GrupoRanking[]>([]);
  const [loadingFoco, setLoadingFoco] = useState(false);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        api.eventos.dashboardGeral({ admin_id: user.id, granularity }),
        api.eventos.atualResumo(),
      ]);
      setData(d);
      setResumo(r);
      if (r.evento) {
        try {
          const g = await api.eventos.rankingGrupos(r.evento.id);
          setTopGrupos(g.ranking_grupos.slice(0, 5));
        } catch {
          setTopGrupos([]);
        }
      } else {
        setTopGrupos([]);
      }
      // Define o evento foco padrão
      if (!eventoFoco) {
        const fallback = r.evento?.id ?? d.comparativo_eventos[0]?.evento_id;
        if (fallback) setEventoFoco(String(fallback));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, user?.id]);

  // Carrega ranking do evento foco
  useEffect(() => {
    if (!eventoFoco) return;
    let alive = true;
    (async () => {
      try {
        setLoadingFoco(true);
        const g = await api.eventos.rankingGrupos(Number(eventoFoco));
        if (alive) setRankingFoco(g.ranking_grupos);
      } catch {
        if (alive) setRankingFoco([]);
      } finally {
        if (alive) setLoadingFoco(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [eventoFoco]);

  const totals = useMemo(() => {
    const tl = data?.timeline ?? [];
    return {
      itens: tl.reduce((a, b) => a + Number(b.total_itens || 0), 0),
      coletas: tl.reduce((a, b) => a + Number(b.total_coletas || 0), 0),
      mediaItensPorColeta:
        tl.reduce((a, b) => a + Number(b.total_coletas || 0), 0) > 0
          ? tl.reduce((a, b) => a + Number(b.total_itens || 0), 0) /
            tl.reduce((a, b) => a + Number(b.total_coletas || 0), 0)
          : 0,
    };
  }, [data]);

  const tlChart =
    data?.timeline.map((t) => ({
      periodo: new Date(t.periodo).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      }),
      itens: Number(t.total_itens),
      coletas: Number(t.total_coletas),
    })) ?? [];

  const compChart =
    data?.comparativo_eventos.map((e) => ({
      nome: e.nome,
      id: e.evento_id,
      itens: Number(e.total_itens),
    })) ?? [];

  const topAlimentosFoco = useMemo(() => {
    const m = new Map<string, number>();
    rankingFoco.forEach((g) => {
      g.top3_itens.forEach((t) => {
        const nome = formatAlimentoNome(t.nome);
        if (!nome) return;
        m.set(nome, (m.get(nome) ?? 0) + Number(t.quantidade));
      });
    });
    return Array.from(m.entries())
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8);
  }, [rankingFoco]);

  const eventoFocoNome =
    compChart.find((e) => String(e.id) === eventoFoco)?.nome ??
    (resumo?.evento?.id === Number(eventoFoco) ? resumo?.evento?.nome : `#${eventoFoco}`);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> Painel administrativo
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão geral de eventos, coletas e desempenho dos grupos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Por dia</SelectItem>
              <SelectItem value="week">Por semana</SelectItem>
              <SelectItem value="month">Por mês</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={!data}
            onClick={() => {
              if (!data) return;
              exportarDashboardPDF({ dashboard: data, resumo, granularity });
              toast.success("PDF gerado!");
            }}
          >
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button asChild variant="outline">
            <Link to="/eventos">
              <CalendarDays className="h-4 w-4" /> Ver eventos
            </Link>
          </Button>
          <Dialog open={openCriar} onOpenChange={setOpenCriar}>
            <DialogTrigger asChild>
              <Button className="gradient-warm text-secondary-foreground shadow-warm">
                <CalendarPlus className="h-4 w-4" /> Novo evento
              </Button>
            </DialogTrigger>
            <CriarEventoDialog
              onCreated={() => {
                setOpenCriar(false);
                carregar();
              }}
            />
          </Dialog>
        </div>
      </header>

      {/* Métricas globais */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          icon={Activity}
          label="Coletas no período"
          value={formatNumber(totals.coletas)}
        />
        <Metric
          icon={TrendingUp}
          label="Itens no período"
          value={formatNumber(totals.itens)}
          accent
        />
        <Metric
          icon={Package}
          label="Média itens/coleta"
          value={totals.mediaItensPorColeta.toFixed(1)}
        />
        <Metric
          icon={Crown}
          label="Evento atual"
          value={resumo?.evento?.nome ?? "—"}
          small
        />
      </section>

      {loading && (
        <div className="text-center py-10">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
        </div>
      )}

      <Tabs defaultValue="visao" className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="eventos">Por evento</TabsTrigger>
          <TabsTrigger value="atual">Evento atual</TabsTrigger>
        </TabsList>

        {/* === Aba 1: Visão geral === */}
        <TabsContent value="visao" className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h2 className="text-lg font-bold mb-1">Coletas ao longo do tempo</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Soma de itens e coletas agrupados por{" "}
              {granularity === "day" ? "dia" : granularity === "week" ? "semana" : "mês"}.
            </p>
            {tlChart.length === 0 ? (
              <EmptyState title="Sem dados" message="Nenhuma coleta no período." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tlChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="periodo"
                      stroke="var(--color-muted-foreground)"
                      fontSize={12}
                    />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="itens"
                      name="Itens"
                      stroke="var(--color-chart-1)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="coletas"
                      name="Coletas"
                      stroke="var(--color-chart-2)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <h2 className="text-lg font-bold mb-1">Comparativo de eventos</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Total de itens coletados por evento. Clique para ver detalhes.
              </p>
              {compChart.length === 0 ? (
                <EmptyState title="Sem eventos" message="Crie um evento para comparar." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="nome"
                        stroke="var(--color-muted-foreground)"
                        fontSize={12}
                      />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 12,
                        }}
                      />
                      <Bar
                        dataKey="itens"
                        radius={[8, 8, 0, 0]}
                        cursor="pointer"
                        onClick={(d: any) => d?.id && setEventoFoco(String(d.id))}
                      >
                        {compChart.map((e, i) => (
                          <Cell
                            key={e.id}
                            fill={
                              String(e.id) === eventoFoco
                                ? "var(--color-chart-2)"
                                : "var(--color-chart-1)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-secondary" />
                Top 5 grupos · evento atual
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Ranking de grupos com seus itens líderes.
              </p>
              {topGrupos.length === 0 ? (
                <EmptyState title="Sem grupos" message="Nenhum grupo coletando ainda." />
              ) : (
                <ol className="space-y-2">
                  {topGrupos.map((g, idx) => (
                    <li
                      key={g.id}
                      className="flex items-center gap-3 bg-muted/50 rounded-xl p-3"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          idx === 0
                            ? "gradient-warm text-secondary-foreground"
                            : "bg-accent text-accent-foreground"
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate text-sm">{g.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {g.top3_itens
                            .map(
                              (t) =>
                                `${formatAlimentoNome(t.nome)} (${formatNumber(t.quantidade)})`,
                            )
                            .join(" · ") || "—"}
                        </div>
                      </div>
                      <div className="font-bold text-primary">
                        {formatNumber(g.total_itens)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </TabsContent>

        {/* === Aba 2: Por evento (drill-down) === */}
        <TabsContent value="eventos" className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Análise detalhada por evento</h2>
                <p className="text-xs text-muted-foreground">
                  Selecione um evento para ver grupos, alimentos mais coletados e participação.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={eventoFoco} onValueChange={setEventoFoco}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecione um evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {compChart.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.nome} · {formatNumber(e.itens)} itens
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eventoFoco && (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/eventos/$eventoId"
                        params={{ eventoId: eventoFoco }}
                        className="whitespace-nowrap"
                      >
                        <ExternalLink className="h-4 w-4" /> Abrir
                      </Link>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={rankingFoco.length === 0}
                      onClick={() => {
                        exportarRankingEventoPDF({
                          eventoId: Number(eventoFoco),
                          eventoNome: eventoFocoNome,
                          ranking: rankingFoco,
                        });
                        toast.success("PDF gerado!");
                      }}
                    >
                      <FileDown className="h-4 w-4" /> PDF
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>

          {loadingFoco ? (
            <div className="text-center py-10">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
            </div>
          ) : !eventoFoco ? (
            <EmptyState title="Selecione um evento" message="Escolha um evento acima." />
          ) : (
            <>
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Metric
                  icon={Users}
                  label="Grupos participando"
                  value={formatNumber(rankingFoco.length)}
                />
                <Metric
                  icon={Package}
                  label="Itens coletados"
                  value={formatNumber(
                    rankingFoco.reduce((a, b) => a + Number(b.total_itens || 0), 0),
                  )}
                  accent
                />
                <Metric
                  icon={Flame}
                  label="Top alimento"
                  value={topAlimentosFoco[0]?.nome ?? "—"}
                  small
                />
                <Metric
                  icon={Crown}
                  label="Líder"
                  value={rankingFoco[0]?.nome ?? "—"}
                  small
                />
              </section>

              <section className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                  <h3 className="text-base font-bold mb-3">
                    Ranking de grupos · {eventoFocoNome}
                  </h3>
                  {rankingFoco.length === 0 ? (
                    <EmptyState title="Sem grupos" message="Ninguém coletou neste evento." />
                  ) : (
                    <ol className="space-y-2 max-h-[26rem] overflow-auto pr-1">
                      {rankingFoco.map((g, idx) => (
                        <li
                          key={g.id}
                          className="flex items-center gap-3 bg-muted/50 rounded-xl p-3"
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              idx === 0
                                ? "gradient-warm text-secondary-foreground"
                                : "bg-accent text-accent-foreground"
                            }`}
                          >
                            #{idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate text-sm">{g.nome}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {g.top3_itens
                                .map((t) => formatAlimentoNome(t.nome))
                                .join(" · ") || "—"}
                            </div>
                          </div>
                          <div className="font-bold text-primary text-sm">
                            {formatNumber(g.total_itens)}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                  <h3 className="text-base font-bold mb-3">
                    Alimentos mais coletados (top 8)
                  </h3>
                  {topAlimentosFoco.length === 0 ? (
                    <EmptyState
                      title="Sem dados"
                      message="Nenhum alimento registrado ainda."
                    />
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topAlimentosFoco} layout="vertical">
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--color-border)"
                          />
                          <XAxis
                            type="number"
                            stroke="var(--color-muted-foreground)"
                            fontSize={12}
                          />
                          <YAxis
                            dataKey="nome"
                            type="category"
                            stroke="var(--color-muted-foreground)"
                            fontSize={11}
                            width={100}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "var(--color-card)",
                              border: "1px solid var(--color-border)",
                              borderRadius: 12,
                            }}
                          />
                          <Bar
                            dataKey="quantidade"
                            fill="var(--color-chart-2)"
                            radius={[0, 8, 8, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </TabsContent>

        {/* === Aba 3: Evento atual === */}
        <TabsContent value="atual" className="space-y-6">
          {!resumo?.evento ? (
            <EmptyState
              title="Sem evento ativo"
              message="Crie um novo evento para começar a coletar."
            />
          ) : (
            <>
              <section className="rounded-2xl gradient-hero text-sidebar-foreground p-6 relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-secondary/20 blur-3xl" />
                <div className="relative z-10 grid sm:grid-cols-3 gap-6">
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase tracking-widest text-sidebar-foreground/70">
                      Evento ativo
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold mt-1">
                      {resumo.evento.nome}
                    </h2>
                    {resumo.evento.local_evento && (
                      <p className="text-sidebar-foreground/80 mt-1">
                        📍 {resumo.evento.local_evento}
                      </p>
                    )}
                    {resumo.evento.descricao && (
                      <p className="text-sidebar-foreground/70 text-sm mt-2 max-w-prose">
                        {resumo.evento.descricao}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-sidebar-foreground/60">
                        Itens coletados
                      </div>
                      <div className="text-3xl font-bold">
                        {formatNumber(resumo.total_itens)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-sidebar-foreground/60">
                        Coletas
                      </div>
                      <div className="text-3xl font-bold">
                        {formatNumber(resumo.total_coletas)}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="text-xs uppercase tracking-widest text-sidebar-foreground/60">
                        Tempo decorrido
                      </div>
                      <div className="text-base font-semibold">
                        {formatDuration(resumo.duracao_segundos)}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <Button asChild variant="outline">
                <Link
                  to="/eventos/$eventoId"
                  params={{ eventoId: String(resumo.evento.id) }}
                >
                  <ExternalLink className="h-4 w-4" /> Abrir página completa do evento
                </Link>
              </Button>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
  small,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        accent
          ? "gradient-warm text-secondary-foreground border-transparent shadow-warm"
          : "bg-card border-border"
      }`}
    >
      <Icon className={`h-5 w-5 ${accent ? "" : "text-primary"}`} />
      <div
        className={`mt-2 font-bold leading-tight ${
          small ? "text-base truncate" : "text-2xl sm:text-3xl"
        }`}
      >
        {value}
      </div>
      <div
        className={`text-xs mt-1 uppercase tracking-wider ${
          accent ? "text-secondary-foreground/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

function CriarEventoDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    local_evento: "",
    data_inicio: "",
    data_fim: "",
    status: "ativo" as "planejado" | "ativo" | "finalizado",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      // Status `ativo` → começa AGORA (alinhado ao backend). Outros status
      // mantêm a data/hora escolhida pelo admin.
      const inicioDate =
        form.status === "ativo" ? new Date() : new Date(form.data_inicio);
      const fimDate = form.data_fim ? new Date(form.data_fim) : undefined;
      await api.eventos.criar({
        admin_id: user.id,
        nome: form.nome,
        descricao: form.descricao || undefined,
        local_evento: form.local_evento || undefined,
        // Formato local `YYYY-MM-DD HH:mm:ss` para `timestamp` sem timezone.
        data_inicio: formatDateTimeForDb(inicioDate),
        data_fim: fimDate ? formatDateTimeForDb(fimDate) : undefined,
        status: form.status,
      });
      toast.success("Evento criado!");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Criar evento</DialogTitle>
        <DialogDescription>Apenas administradores podem criar eventos.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            required
            value={form.nome}
            maxLength={200}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Local</Label>
          <Input
            value={form.local_evento}
            onChange={(e) => setForm({ ...form, local_evento: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Início</Label>
            <Input
              type="datetime-local"
              required
              value={form.data_inicio}
              onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fim</Label>
            <Input
              type="datetime-local"
              value={form.data_fim}
              onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planejado">Planejado</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
            </SelectContent>
          </Select>
          {form.status === "ativo" && (
            <p className="text-xs text-primary">
              ℹ️ Evento <strong>ativo</strong> começa no momento da criação.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="submit"
            className="gradient-warm text-secondary-foreground shadow-warm"
            disabled={loading || !form.nome || !form.data_inicio}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
