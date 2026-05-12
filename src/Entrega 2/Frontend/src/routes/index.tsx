import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  Camera,
  Clock,
  Package,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import {
  api,
  formatDuration,
  formatNumber,
  type EventoResumo,
  type GrupoRanking,
  type TopItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAlimentoNome } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — EmpathTech" },
      {
        name: "description",
        content: "Acompanhe o evento ativo, as coletas em tempo real e o ranking de grupos.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <Index />
      </AppShell>
    </ProtectedRoute>
  ),
});

function Index() {
  const { user } = useAuth();
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [eventos, setEventos] = useState<EventoCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const isAdmin = user?.cargo === "admin";

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const r = await api.eventos.atualResumo();
        if (!alive) return;
        setResumo(r);

        // Monta lista de eventos a exibir.
        // - Sempre inclui o evento atual (visível a todos).
        // - Se admin, busca os demais via dashboard.
        const listaIds: { id: number; nome: string }[] = [];
        if (r.evento) listaIds.push({ id: r.evento.id, nome: r.evento.nome });
        if (isAdmin) {
          try {
            const dash = await api.eventos.dashboardGeral({ admin_id: user.id });
            for (const e of dash.comparativo_eventos) {
              if (!listaIds.find((x) => x.id === e.evento_id)) {
                listaIds.push({ id: e.evento_id, nome: e.nome });
              }
            }
          } catch {
            /* sem permissão / offline */
          }
        }

        const cards = await Promise.all(
          listaIds.map(async ({ id, nome }) => {
            const ranking = await api.eventos
              .rankingGrupos(id)
              .then((x) => x.ranking_grupos)
              .catch(() => [] as GrupoRanking[]);
            const totalItens = ranking.reduce((s, g) => s + Number(g.total_itens || 0), 0);
            const topItens = aggregateTopItens(ranking);
            return {
              evento_id: id,
              nome,
              total_itens: totalItens,
              total_grupos: ranking.length,
              top_itens: topItens,
              ehAtual: r.evento?.id === id,
            };
          }),
        );
        if (!alive) return;
        setEventos(cards);
      } catch (e) {
        if (!alive) return;
        setErro(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, isAdmin]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Hero */}
      <section className="rounded-3xl gradient-hero text-sidebar-foreground p-6 sm:p-10 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary-glow/20 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="text-sm uppercase tracking-widest text-sidebar-foreground/70">
              Olá, {user?.nome} 👋
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
              {resumo?.evento ? resumo.evento.nome : "Nenhum evento ativo no momento"}
            </h1>
            {resumo?.evento?.local_evento && (
              <p className="text-sidebar-foreground/80">📍 {resumo.evento.local_evento}</p>
            )}
            {resumo?.evento && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-success text-success-foreground font-semibold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-foreground animate-pulse" />
                  {resumo.evento.status}
                </span>
                <span className="text-xs text-sidebar-foreground/70">
                  Iniciado em{" "}
                  {new Date(resumo.evento.data_inicio).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            )}
            {!resumo?.evento && !loading && (
              <p className="text-sidebar-foreground/80 max-w-lg">
                Assim que houver um evento ativo, ele aparecerá aqui com as estatísticas em tempo
                real.
              </p>
            )}
          </div>
          {resumo?.evento && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                to="/coleta"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-secondary text-secondary-foreground font-semibold shadow-warm hover:opacity-95 transition"
              >
                <Camera className="h-5 w-5" />
                Iniciar coleta
              </Link>
              <Link
                to="/eventos/$eventoId"
                params={{ eventoId: String(resumo.evento.id) }}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-sidebar-accent text-sidebar-foreground font-semibold hover:bg-sidebar-accent/80 transition"
              >
                <Trophy className="h-5 w-5" />
                Ver ranking
              </Link>
            </div>
          )}
        </div>
      </section>

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-4 text-sm">
          {erro}
        </div>
      )}

      {/* Métricas */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          icon={Package}
          label="Itens coletados"
          value={formatNumber(resumo?.total_itens ?? 0)}
          accent
        />
        <MetricCard
          icon={Activity}
          label="Coletas registradas"
          value={formatNumber(resumo?.total_coletas ?? 0)}
        />
        <MetricCard
          icon={Clock}
          label="Tempo de evento"
          value={formatDuration(resumo?.duracao_segundos ?? 0)}
        />
        <MetricCard
          icon={Users}
          label="Eventos exibidos"
          value={formatNumber(eventos.length)}
        />
      </section>

      {/* Cards de eventos */}
      <section>
        <header className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Eventos
            </h2>
            <p className="text-sm text-muted-foreground">
              Acesse cada evento para ver o ranking de itens e grupos.
            </p>
          </div>
          <Link
            to="/eventos"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Ver todos →
          </Link>
        </header>

        {loading ? (
          <SkeletonList />
        ) : eventos.length === 0 ? (
          <EmptyState
            title="Nenhum evento ainda"
            message="Quando houver eventos com coletas, eles aparecerão aqui."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {eventos.map((ev) => (
              <EventoCard key={ev.evento_id} ev={ev} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type EventoCardData = {
  evento_id: number;
  nome: string;
  total_itens: number;
  total_grupos: number;
  top_itens: TopItem[];
  ehAtual: boolean;
};

function aggregateTopItens(ranking: GrupoRanking[]): TopItem[] {
  const map = new Map<string, number>();
  for (const g of ranking) {
    for (const t of g.top3_itens || []) {
      const nome = formatAlimentoNome(t.nome);
      if (!nome) continue;
      map.set(nome, (map.get(nome) ?? 0) + Number(t.quantidade || 0));
    }
  }
  return Array.from(map.entries())
    .map(([nome, quantidade]) => ({ nome, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);
}

function EventoCard({
  ev,
}: {
  ev: EventoCardData;
}) {
  return (
    <Link
      to="/eventos/$eventoId"
      params={{ eventoId: String(ev.evento_id) }}
      className={`block rounded-2xl border p-5 hover:shadow-md transition group ${
        ev.ehAtual
          ? "border-success/40 bg-success/5 hover:border-success/60"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          {ev.ehAtual ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-success text-success-foreground font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-success-foreground animate-pulse" />
              Em andamento
            </span>
          ) : (
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Evento #{ev.evento_id}
            </div>
          )}
          <div className="font-bold text-lg truncate group-hover:text-primary transition">
            {ev.nome}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-primary leading-none">
            {formatNumber(ev.total_itens)}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            itens
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t border-border pt-3">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {ev.total_grupos} grupos
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" /> {ev.top_itens.length} tipos de itens
        </span>
      </div>
      {ev.top_itens.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Principais itens coletados
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ev.top_itens.map((t, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium"
              >
                {t.nome} · {formatNumber(t.quantidade)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">Sem coletas ainda</div>
      )}
    </Link>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 sm:p-5 border ${
        accent
          ? "gradient-warm text-secondary-foreground border-transparent shadow-warm"
          : "bg-card border-border"
      }`}
    >
      <Icon className={`h-5 w-5 ${accent ? "text-secondary-foreground/80" : "text-primary"}`} />
      <div className="mt-3 text-2xl sm:text-3xl font-bold leading-none">{value}</div>
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

export function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{message}</div>
    </div>
  );
}
