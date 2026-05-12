import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Mapa canônico → forma formal (com acentuação e capitalização correta).
 * Cobre os principais alimentos coletados pelo sistema.
 */
const ALIMENTO_FORMAL: Record<string, string> = {
  arroz: "Arroz",
  feijao: "Feijão",
  macarrao: "Macarrão",
  leite: "Leite",
  oleo: "Óleo",
  acucar: "Açúcar",
  rice: "Arroz",
  beans: "Feijão",
  bean: "Feijão",
  pasta: "Macarrão",
  noodles: "Macarrão",
  noodle: "Macarrão",
  milk: "Leite",
  oil: "Óleo",
  sugar: "Açúcar",
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza nomes de alimentos vindos da IA/Backend (ex.: "arroz", "feijao",
 * "MACARRÃO", "rice") para uma forma formal exibida ao usuário
 * (ex.: "Arroz", "Feijão", "Macarrão").
 */
/**
 * Formata uma `Date` no padrão `YYYY-MM-DD HH:mm:ss` usando o horário LOCAL
 * do navegador (sem conversão para UTC).
 *
 * Necessário porque o backend usa colunas `timestamp` sem timezone no
 * PostgreSQL: enviar `toISOString()` causaria deslocamento de algumas horas
 * entre o que o usuário escolhe na UI e o que é salvo no banco.
 */
export function formatDateTimeForDb(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function formatAlimentoNome(rawName: string | null | undefined): string {
  const raw = String(rawName ?? "").trim();
  if (!raw) return "";
  const key = stripDiacritics(raw).toLowerCase();
  if (ALIMENTO_FORMAL[key]) return ALIMENTO_FORMAL[key];
  // fallback: capitaliza cada palavra mantendo acentos do original
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
