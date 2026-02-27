import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo_contmax.png";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  showBack?: boolean;
  backTo?: string;
  showLogout?: boolean;
  actions?: React.ReactNode;
  /** Show user avatar with initials */
  userName?: string;
}

export function AppHeader({
  title,
  subtitle,
  breadcrumbs,
  showBack = false,
  backTo = "/",
  showLogout = false,
  actions,
  userName,
}: AppHeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const initials = userName
    ? userName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : null;

  return (
    <header className="sticky top-0 z-30 header-gradient text-primary-foreground shadow-lg animate-fade-in">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backTo)}
              title="Voltar"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <img src={logo} alt="Contmax" className="h-9 brightness-0 invert opacity-90" />
          <div>
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-primary-foreground/60 mb-0.5">
                {breadcrumbs.map((bc, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span>/</span>}
                    {bc.href ? (
                      <button
                        onClick={() => navigate(bc.href!)}
                        className="hover:text-primary-foreground/90 transition-colors"
                      >
                        {bc.label}
                      </button>
                    ) : (
                      <span>{bc.label}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
            <h1 className="text-lg font-bold leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs text-primary-foreground/60">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {initials && (
            <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
          )}
          {showLogout && (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              title="Sair"
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
