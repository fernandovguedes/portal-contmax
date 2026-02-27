import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Key, Plus, Shield, User, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

interface Profile {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface Module {
  id: string;
  nome: string;
  slug: string;
  organizacao_id: string | null;
}

interface Organizacao {
  id: string;
  nome: string;
  slug: string;
}

interface UserModule {
  user_id: string;
  module_id: string;
  can_edit: boolean;
}

export default function Admin() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [userModules, setUserModules] = useState<UserModule[]>([]);
  const [organizacoes, setOrganizacoes] = useState<Organizacao[]>([]);
  const [loading, setLoading] = useState(true);

  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUserName, setResetUserName] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchData = useCallback(async () => {
    const [profilesRes, rolesRes, modulesRes, userModulesRes, orgsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("user_roles").select("*"),
      supabase.from("modules").select("*").order("ordem"),
      supabase.from("user_modules").select("user_id, module_id, can_edit"),
      supabase.from("organizacoes").select("*").order("nome"),
    ]);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setRoles((rolesRes.data as UserRole[]) ?? []);
    setModules((modulesRes.data as Module[]) ?? []);
    setUserModules((userModulesRes.data as UserModule[]) ?? []);
    setOrganizacoes((orgsRes.data as Organizacao[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/");
      return;
    }
    if (!roleLoading && isAdmin) {
      fetchData();
    }
  }, [isAdmin, roleLoading, navigate, fetchData]);

  const isUserAdmin = (userId: string) => roles.some((r) => r.user_id === userId && r.role === "admin");

  const hasModule = (userId: string, moduleId: string) =>
    isUserAdmin(userId) || userModules.some((um) => um.user_id === userId && um.module_id === moduleId);

  const hasEditPermission = (userId: string, moduleId: string) =>
    isUserAdmin(userId) || userModules.some((um) => um.user_id === userId && um.module_id === moduleId && um.can_edit);

  const toggleModule = async (userId: string, moduleId: string) => {
    const exists = userModules.find((um) => um.user_id === userId && um.module_id === moduleId);
    if (exists) {
      await supabase.from("user_modules").delete().eq("user_id", userId).eq("module_id", moduleId);
      setUserModules((prev) => prev.filter((um) => !(um.user_id === userId && um.module_id === moduleId)));
    } else {
      const { data } = await supabase.from("user_modules").insert({ user_id: userId, module_id: moduleId }).select().single();
      if (data) setUserModules((prev) => [...prev, { ...(data as any), can_edit: false } as UserModule]);
    }
  };

  const toggleCanEdit = async (userId: string, moduleId: string) => {
    const um = userModules.find((um) => um.user_id === userId && um.module_id === moduleId);
    if (!um) return;
    const newVal = !um.can_edit;
    await supabase.from("user_modules").update({ can_edit: newVal } as any).eq("user_id", userId).eq("module_id", moduleId);
    setUserModules((prev) => prev.map((item) =>
      item.user_id === userId && item.module_id === moduleId ? { ...item, can_edit: newVal } : item
    ));
  };

  const toggleAdmin = async (userId: string) => {
    if (userId === user?.id) return; // Can't remove own admin
    const isAdm = isUserAdmin(userId);
    if (isAdm) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      setRoles((prev) => prev.filter((r) => !(r.user_id === userId && r.role === "admin")));
    } else {
      const { data } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" }).select().single();
      if (data) setRoles((prev) => [...prev, data as UserRole]);
    }
  };

  const toggleAtivo = async (profile: Profile) => {
    await supabase.from("profiles").update({ ativo: !profile.ativo }).eq("id", profile.id);
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, ativo: !p.ativo } : p)));
  };

  const updateModuleOrg = async (moduleId: string, orgId: string | null) => {
    await supabase.from("modules").update({ organizacao_id: orgId } as any).eq("id", moduleId);
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, organizacao_id: orgId } : m)));
    toast({ title: "Organização atualizada" });
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !newNome) return;
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke("create-admin", {
        body: { email: newEmail, password: newPassword, nome: newNome },
      });
      if (error) throw error;
      toast({ title: "Usuário criado", description: `${newNome} foi adicionado ao sistema.` });
      setNewUserOpen(false);
      setNewEmail("");
      setNewNome("");
      setNewPassword("");
      setTimeout(fetchData, 1500);
    } catch (err: any) {
      toast({ title: "Erro ao criar usuário", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const openResetPassword = (userId: string, userName: string) => {
    setResetUserId(userId);
    setResetUserName(userName);
    setResetPassword("");
    setResetPasswordOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword || resetPassword.length < 6) return;
    setResetting(true);
    try {
      const { error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: resetUserId, new_password: resetPassword },
      });
      if (error) throw error;
      toast({ title: "Senha alterada", description: `A senha de ${resetUserName} foi redefinida.` });
      setResetPasswordOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao alterar senha", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  if (roleLoading || loading) {
    return <LoadingSkeleton variant="portal" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Administração"
        subtitle="Usuários e Permissões"
        showBack
        breadcrumbs={[{ label: "Portal", href: "/" }, { label: "Administração" }]}
        actions={
          <Button
            onClick={() => setNewUserOpen(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <UserPlus className="mr-1 h-4 w-4" /> Novo Usuário
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> Usuários e Módulos
            </CardTitle>
            <CardDescription>Gerencie o acesso de cada usuário aos módulos do sistema. Admins têm acesso a todos os módulos automaticamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-x-auto shadow-sm table-zebra">
              <Table>
                <TableHeader>
                  <TableRow className="header-gradient text-primary-foreground hover:bg-transparent [&>th]:text-primary-foreground/90 [&>th]:font-semibold">
                    <TableHead rowSpan={2} className="align-bottom">Nome</TableHead>
                    <TableHead rowSpan={2} className="align-bottom">Email</TableHead>
                    <TableHead rowSpan={2} className="text-center align-bottom">Ativo</TableHead>
                    <TableHead rowSpan={2} className="text-center align-bottom">Admin</TableHead>
                    <TableHead rowSpan={2} className="text-center align-bottom">Senha</TableHead>
                    {modules.map((m) => (
                      <TableHead key={m.id} colSpan={2} className="text-center border-l">{m.nome}</TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="header-gradient text-primary-foreground hover:bg-transparent [&>th]:text-primary-foreground/90 [&>th]:text-xs">
                    {modules.map((m) => (
                      <React.Fragment key={`sub-${m.id}`}>
                        <TableHead className="text-center text-xs border-l">Acesso</TableHead>
                        <TableHead className="text-center text-xs">Editar</TableHead>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => {
                    const adm = isUserAdmin(p.id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nome || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} />
                        </TableCell>
                        <TableCell className="text-center">
                          {p.id === user?.id ? (
                            <Badge variant="default" className="text-[10px]">
                              <Shield className="h-3 w-3 mr-1" /> Você
                            </Badge>
                          ) : (
                            <Checkbox checked={adm} onCheckedChange={() => toggleAdmin(p.id)} />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={() => openResetPassword(p.id, p.nome || p.email)} title="Alterar senha">
                            <Key className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        {modules.map((m) => (
                          <React.Fragment key={`perm-${m.id}`}>
                            <TableCell className="text-center border-l">
                              {adm ? (
                                <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Auto</Badge>
                              ) : (
                                <Checkbox
                                  checked={hasModule(p.id, m.id)}
                                  onCheckedChange={() => toggleModule(p.id, m.id)}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {adm ? (
                                <Badge className="text-[10px] bg-accent/20 text-accent border-accent/30">Auto</Badge>
                              ) : (
                                <Checkbox
                                  checked={hasEditPermission(p.id, m.id)}
                                  disabled={!hasModule(p.id, m.id)}
                                  onCheckedChange={() => toggleCanEdit(p.id, m.id)}
                                />
                              )}
                            </TableCell>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        {/* Module Organization Assignment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Módulos e Organizações
            </CardTitle>
            <CardDescription>Defina qual base de clientes cada módulo utiliza.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-x-auto shadow-sm table-zebra">
              <Table>
                <TableHeader>
                  <TableRow className="header-gradient text-primary-foreground hover:bg-transparent [&>th]:text-primary-foreground/90 [&>th]:font-semibold">
                    <TableHead>Módulo</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Organização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.slug}</TableCell>
                      <TableCell>
                        <Select
                          value={m.organizacao_id ?? "none"}
                          onValueChange={(v) => updateModuleOrg(m.id, v === "none" ? null : v)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Nenhuma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {organizacoes.map((o) => (
                              <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo acesso ao sistema Contmax.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewUserOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creating || !newEmail || !newNome || !newPassword}>
              {creating ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para {resetUserName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resetting || resetPassword.length < 6}>
              {resetting ? "Alterando..." : "Alterar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
