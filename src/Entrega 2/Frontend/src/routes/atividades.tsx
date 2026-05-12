import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Camera,
  Clock,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/routes/index";
import {
  api,
  formatDuration,
  formatNumber,
  type EventoResumo,
  type GrupoRanking,
  type UsuarioRanking,
} from "@/lib/api";
import { formatAlimentoNome } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/atividades")({
  head: () => ({
    meta: [
      { title: "Atividades em tempo real — EmpathTech" },
      {
        name: "description",
        content:
          "Acompanhe eventos em andamento, coletas registradas e grupos participantes em tempo real.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell>
        <AtividadesPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

type GrupoComLideres = GrupoRanking & {
  lider?: UsuarioRanking | null;
  participantes: number;
};

function AtividadesPage() {
  const [resumo, setResumo] = useState<EventoResumo | null>(null);
  const [grupos, setGrupos] = useState<GrupoComLideres[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const carregar = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await api.eventos.atualResumo();
      setResumo(r);
      if (r.evento) {
        const ranking = await api.eventos.rankingGrupos(r.evento.id);
        const eventoId = r.evento.id;
        // Para cada grupo, busca o ranking de usuários para descobrir líder/participantes.
        const detalhes = await Promise.all(
          ranking.ranking_grupos.map(async (g) => {
            try {
              const ru = await api.grupos.rankingUsuarios(g.id, eventoId);
              const top = ru.ranking_usuarios?.[0] ?? null;
              return {
                ...g,
                lider: top,
                participantes: ru.ranking_usuarios?.length ?? 0,
              } as GrupoComLideres;
            } catch {
              return { ...g, lider: null, participantes: 0 } as GrupoComLideres;
            }
          }),
        );
        setGrupos(detalhes);
      } else {
        setGrupos([]);
      }
      setUpdatedAt(new Date());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar atividades");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    carregar();
    // Auto-refresh a cada 30s para sensação de "tempo real"
    const id = setInterval(() => carregar(true), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalParticipantes = useMemo(
    () => grupos.reduce((acc, g) => acc + g.participantes, 0),
    [grupos],
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" /> Atividades
          </h1>
          <p className="text-sm text-muted-foreground">
            Eventos acontecendo agora, coletas registradas e grupos envolvidos.
            {updatedAt && (
              <span className="ml-2 text-xs">
                · atualizado{" "}
                {updatedAt.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => carregar(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button asChild className="gradient-warm text-secondary-foreground shadow-warm">
            <Link to="/coleta">
              <Sparkles className="h-4 w-4" /> Coletar agora
            </Link>
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto" />
        </div>
      ) : !resumo?.evento ? (
        <EmptyState
          title="Nenhum evento acontecendo agora"
          message="Quando um evento estiver ativo, ele aparecerá aqui com as coletas e grupos envolvidos em tempo real."
        />
      ) : (
        <>
          {/* Card do evento ativo */}
          <section className="rounded-2xl border border-success/30 bg-gradient-to-br from-success/15 to-success/5 p-5 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-success text-success-foreground font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-success-foreground animate-pulse" />
                Em andamento
              </span>
              {resumo.evento.local_evento && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {resumo.evento.local_evento}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />{" "}
                {new Date(resumo.evento.data_inicio).toLocaleString("pt-BR")}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{resumo.evento.nome}</h2>
              {resumo.evento.descricao && (
                <p className="text-sm text-muted-foreground mt-1">
                  {resumo.evento.descricao}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric
                icon={Package}
                label="Itens coletados"
                value={formatNumber(resumo.total_itens)}
              />
              <Metric
                icon={Camera}
                label="Coletas"
                value={formatNumber(resumo.total_coletas)}
              />
              <Metric
                icon={Users}
                label="Grupos ativos"
                value={formatNumber(grupos.length)}
              />
              <Metric
                icon={Clock}
                label="Duração"
                value={formatDuration(resumo.duracao_segundos)}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/eventos/$eventoId"
                  params={{ eventoId: String(resumo.evento.id) }}
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Ver ranking completo
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/grupos">
                  <Users className="h-3.5 w-3.5" /> Meus grupos
                </Link>
              </Button>
            </div>
          </section>

          {/* Grupos envolvidos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Grupos participando
                <span className="text-sm font-normal text-muted-foreground">
                  ({grupos.length})
                </span>
              </h2>
              {totalParticipantes > 0 && (
                <span className="text-xs text-muted-foreground">
                  {totalParticipantes} colaborador(es) ativo(s)
                </span>
              )}
            </div>

            {grupos.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum grupo registrou coletas ainda neste evento.
              </div>
            ) : (
              <ul className="grid md:grid-cols-2 gap-3">
                {grupos.map((g, i) => (
                  <li
                    key={g.id}
                    className="rounded-2xl border border-border bg-card p-4 space-y-3 hover:shadow-md transition"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                          i === 0
                            ? "bg-secondary text-secondary-foreground shadow-warm"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {i === 0 ? <Trophy className="h-5 w-5" /> : `#${i + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{g.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {g.participantes} participante(s)
                          {g.lider && (
                            <>
                              {" "}
                              · destaque:{" "}
                              <span className="text-foreground font-medium">
                                {g.lider.nome} {g.lider.sobrenome}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-primary">
                          {formatNumber(g.total_itens)}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          itens
                        </div>
                      </div>
                    </div>

                    {g.top3_itens?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {g.top3_itens.slice(0, 3).map((it) => (
                          <span
                            key={it.nome}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {formatAlimentoNome(it.nome)}
                            <strong className="text-foreground">
                              {formatNumber(it.quantidade)}
                            </strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-background/60 border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-xl font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}
