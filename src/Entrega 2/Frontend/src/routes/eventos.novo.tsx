import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CalendarIcon, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProtectedRoute } from "@/components/protected-route";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDateTimeForDb } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/eventos/novo")({
  head: () => ({
    meta: [
      { title: "Criar evento — EmpathTech" },
      {
        name: "description",
        content: "Crie um novo evento de coleta na plataforma EmpathTech.",
      },
    ],
  }),
  component: () => (
    <ProtectedRoute adminOnly>
      <AppShell>
        <NovoEventoPage />
      </AppShell>
    </ProtectedRoute>
  ),
});

function NovoEventoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    local_evento: "",
    status: "ativo" as "planejado" | "ativo" | "finalizado",
  });
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [horaInicio, setHoraInicio] = useState<string>("09:00");
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [horaFim, setHoraFim] = useState<string>("18:00");
  const [loading, setLoading] = useState(false);

  const combineDateTime = (d: Date, hhmm: string) => {
    const [h, m] = hhmm.split(":").map((n) => Number(n) || 0);
    const out = new Date(d);
    out.setHours(h, m, 0, 0);
    return out;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !dataInicio) return;
    setLoading(true);
    try {
      // Quando o evento já nasce ATIVO, ele começa no instante exato da
      // criação — assim o backend e a UI ficam alinhados e o usuário pode
      // criar grupos / iniciar coletas imediatamente. Para outros status,
      // respeitamos a data/hora escolhida no formulário.
      const inicioDate =
        form.status === "ativo" ? new Date() : combineDateTime(dataInicio, horaInicio);
      const fimDate = dataFim ? combineDateTime(dataFim, horaFim) : undefined;
      const ev = await api.eventos.criar({
        admin_id: user.id,
        nome: form.nome,
        descricao: form.descricao || undefined,
        local_evento: form.local_evento || undefined,
        // Envia data/hora LOCAL formatada para `timestamp` sem timezone,
        // evitando o deslocamento causado por `toISOString()` (UTC).
        data_inicio: formatDateTimeForDb(inicioDate),
        data_fim: fimDate ? formatDateTimeForDb(fimDate) : undefined,
        status: form.status,
      });
      toast.success("Evento criado com sucesso!");
      navigate({
        to: "/eventos/$eventoId",
        params: { eventoId: String(ev.id) },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/eventos">
          <ArrowLeft className="h-4 w-4" /> Voltar para eventos
        </Link>
      </Button>

      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CalendarPlus className="h-7 w-7 text-primary" /> Criar evento
        </h1>
        <p className="text-sm text-muted-foreground">
          Defina os dados do evento. Apenas administradores podem criar.
        </p>
      </header>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="nome">Nome do evento *</Label>
          <Input
            id="nome"
            required
            maxLength={200}
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: Coleta solidária de outono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Descrição</Label>
          <Textarea
            id="desc"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Conte rapidamente o objetivo do evento."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="local">Local</Label>
          <Input
            id="local"
            value={form.local_evento}
            onChange={(e) => setForm({ ...form, local_evento: e.target.value })}
            placeholder="Ex.: Centro Comunitário Vila Esperança"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data de início *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataInicio && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {dataInicio
                    ? format(dataInicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 z-50"
                align="start"
                side="bottom"
                sideOffset={4}
                avoidCollisions
                collisionPadding={16}
              >
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              aria-label="Horário de início"
            />
          </div>
          <div className="space-y-2">
            <Label>Data de término</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataFim && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {dataFim
                    ? format(dataFim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : "Opcional"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 z-50"
                align="start"
                side="bottom"
                sideOffset={4}
                avoidCollisions
                collisionPadding={16}
              >
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  initialFocus
                  locale={ptBR}
                  disabled={(d) => (dataInicio ? d < dataInicio : false)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={horaFim}
              onChange={(e) => setHoraFim(e.target.value)}
              aria-label="Horário de término"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Status inicial</Label>
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
          <p className="text-xs text-muted-foreground">
            Apenas eventos com status <strong>ativo</strong> aceitam coletas em tempo real.
          </p>
          {form.status === "ativo" && (
            <p className="text-xs text-primary">
              ℹ️ Eventos criados como <strong>ativo</strong> começam no momento
              exato da criação — a data/hora de início acima será ignorada e
              substituída por agora.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button
            type="submit"
            className="gradient-warm text-secondary-foreground shadow-warm flex-1 sm:flex-initial"
            disabled={loading || !form.nome || !dataInicio}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CalendarPlus className="h-4 w-4" /> Criar evento
              </>
            )}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/eventos">Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}