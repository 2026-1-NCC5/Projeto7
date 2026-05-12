import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  CalendarDays,
  CalendarPlus,
  Camera,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Trophy,
  User as UserIcon,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";
import logoEmpath from "@/assets/empathtech-logo.svg";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavLeaf = {
  to: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
};

// Itens principais — exibidos lado a lado na navbar (desktop) para todos.
const PRIMARY_NAV: NavLeaf[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/atividades", label: "Atividades", icon: Activity },
  { to: "/coleta", label: "Coleta", icon: Camera },
  { to: "/grupos", label: "Grupos", icon: Users },
  { to: "/eventos", label: "Eventos", icon: CalendarDays },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/minhas-coletas", label: "Minhas coletas", icon: History },
];

// Itens admin — ficam no dropdown junto com perfil/sair.
const ADMIN_NAV: NavLeaf[] = [
  { to: "/eventos/novo", label: "Criar evento", icon: CalendarPlus, adminOnly: true },
  { to: "/admin", label: "Painel admin", icon: LayoutDashboard, adminOnly: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!user) return <>{children}</>;

  const isAdmin = user.cargo === "admin";
  const primaryItems = PRIMARY_NAV;
  const adminItems = isAdmin ? ADMIN_NAV : [];
  // Bottom nav mobile: até 5 atalhos rápidos sem admin.
  const bottomItems = primaryItems
    .filter((n) => ["/", "/atividades", "/coleta", "/grupos", "/eventos", "/ranking"].includes(n.to))
    .slice(0, 5);

  const initials = `${user.nome?.[0] ?? ""}${user.sobrenome?.[0] ?? ""}`.toUpperCase();

  const isItemActive = (to: string) =>
    pathname === to || (to !== "/" && pathname.startsWith(to));

  const doLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ====== Header Desktop ====== */}
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground shadow-md border-b border-sidebar-border">
        <div className="w-full max-w-[1400px] mx-auto flex items-center gap-3 px-3 md:px-4 lg:px-6 py-2.5">
          {/* Logo — esquerda */}
          <Link to="/" className="flex items-center gap-2 group shrink-0 mr-auto">
            <img
              src={logoEmpath}
              alt="EmpathTech — voltar para início"
              className="h-7 w-auto group-hover:opacity-90 transition"
            />
          </Link>

          {/* Navbar principal — direita, lado a lado em sm+ */}
          <nav
            aria-label="Navegação principal"
            className="hidden sm:flex items-center gap-0.5 min-w-0 overflow-x-auto scrollbar-thin"
          >
            {primaryItems.map((it) => (
              <HeaderLink
                key={it.to}
                to={it.to}
                label={it.label}
                Icon={it.icon}
                active={isItemActive(it.to)}
              />
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {/* Menu apenas em mobile (< sm) */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Abrir menu"
                className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-sidebar-accent transition"
              >
                <Menu className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Navegação
                </DropdownMenuLabel>
                {primaryItems.map((it) => (
                  <DropdownMenuItem key={it.to} asChild>
                    <Link to={it.to} className="cursor-pointer">
                      <it.icon className="h-4 w-4" /> {it.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar dropdown — perfil, admin (se houver) e sair */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Menu do usuário"
                className="flex items-center gap-2 rounded-full p-0.5 hover:bg-sidebar-accent transition"
              >
                <div className="w-9 h-9 rounded-full gradient-warm text-secondary-foreground flex items-center justify-center font-bold text-sm shadow-warm">
                  {initials || "?"}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="font-semibold truncate">
                    {user.nome} {user.sobrenome}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-primary font-bold">
                    {isAdmin ? "Administrador" : "Membro"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/minhas-coletas" className="cursor-pointer">
                    <UserIcon className="h-4 w-4" /> Meu perfil
                  </Link>
                </DropdownMenuItem>
                {adminItems.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Administração
                    </DropdownMenuLabel>
                    {adminItems.map((it) => (
                      <DropdownMenuItem key={it.to} asChild>
                        <Link to={it.to} className="cursor-pointer">
                          <it.icon className="h-4 w-4" /> {it.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={doLogout} className="cursor-pointer text-destructive">
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-6 min-w-0">{children}</main>

      {/* Bottom Nav Mobile - tap rápido */}
      <BottomNav items={bottomItems} pathname={pathname} />
    </div>
  );
}

function HeaderLink({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-lg text-[13px] lg:text-sm font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-warm"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function BottomNav({ items, pathname }: { items: NavLeaf[]; pathname: string }) {
  const flat = items.slice(0, 5);
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-sidebar text-sidebar-foreground border-t border-sidebar-border z-30">
      <div className="flex justify-around">
        {flat.map((it) => {
          const active =
            pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to));
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2 text-[10px]",
                active ? "text-secondary" : "text-sidebar-foreground/70",
              )}
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
