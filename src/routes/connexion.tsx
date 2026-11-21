import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LoaderCircle, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell, metadata } from "@/components/label-pulse/shared";
import { signIn, signUp } from "@/lib/backend";
import { supabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/connexion")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect: string } => ({
    redirect:
      typeof search["redirect"] === "string" && search["redirect"].startsWith("/")
        ? search["redirect"]
        : "/extractions",
  }),
  head: () => metadata("Connexion", "Connectez-vous à Zikindé pour lancer des extractions."),
  component: Connexion,
});

function Connexion() {
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.includes("@")) return setError("Saisissez une adresse e-mail valide.");
    if (password.length < 6)
      return setError("Le mot de passe doit contenir au moins 6 caractères.");
    setBusy(true);
    try {
      if (mode === "connexion") {
        await signIn(email, password);
      } else if (!(await signUp(email, password))) {
        setInfo(
          "Compte créé. Confirmez votre adresse avec le lien reçu par e-mail, puis connectez-vous.",
        );
        setMode("connexion");
        return;
      }
      window.location.assign(redirect); // recharge complète : la session est relue partout
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message.includes("Invalid login credentials")
          ? "E-mail ou mot de passe incorrect."
          : message.includes("Email not confirmed")
            ? "Adresse e-mail pas encore confirmée : cliquez sur le lien reçu."
            : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="content-page" style={{ maxWidth: 440 }}>
        <div className="eyebrow">
          <span className="small-line" /> ESPACE LABEL
        </div>
        <h1>{mode === "connexion" ? "Connexion" : "Créer un compte"}</h1>
        {!supabaseConfigured() && (
          <p className="text-destructive">Backend non configuré (clé Supabase manquante).</p>
        )}
        <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-muted-foreground" role="status">
              {info}
            </p>
          )}
          <Button type="submit" disabled={busy || !supabaseConfigured()}>
            {busy ? (
              <LoaderCircle className="animate-spin" />
            ) : mode === "connexion" ? (
              <LogIn />
            ) : (
              <UserPlus />
            )}
            {mode === "connexion" ? "Se connecter" : "Créer le compte"}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setMode(mode === "connexion" ? "inscription" : "connexion");
              setError(null);
            }}
          >
            {mode === "connexion"
              ? "Pas encore de compte ? En créer un"
              : "Déjà un compte ? Se connecter"}
          </Button>
        </form>
      </main>
    </Shell>
  );
}
