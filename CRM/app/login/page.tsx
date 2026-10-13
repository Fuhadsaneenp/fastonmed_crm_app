"use client";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import styles from "./login.module.css";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import FastonmedLogo from "@/components/FastonmedLogo";
import { loginToBackend, saveAuthSession } from "@/lib/api-client";

const DEMO_USERS = [
  { email: "fuhad@fastonmed.com", username: "fuhad", password: "growth123", role: "Super Admin", name: "Fuhad" },
  { email: "hashim@fastonmed.com", username: "hashim", password: "hashim123", role: "Operations Manager", name: "Hashim" },
  { email: "riyas@fastonmed.com", username: "riyas", password: "riyas123", role: "Sales Executive", name: "Riyas" },
  { email: "fidha@fastonmed.com", username: "fidha", password: "fidha123", role: "Client Relations", name: "Fidha" },
  { email: "user1@fastonmed.com", username: "user1", password: "user123", role: "Staff", name: "User 1" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorField, setErrorField] = useState<"username" | "password" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorField(null);
    setErrorMessage(null);

    const trimmedInput = email.trim();
    if (!trimmedInput) {
      setErrorField("username");
      setErrorMessage("The username is not listed");
      toast.error("The username is not listed");
      return;
    }

    const normalized = trimmedInput.toLowerCase();
    const matchedUser = DEMO_USERS.find(
      (u) =>
        u.email.toLowerCase() === normalized ||
        u.username.toLowerCase() === normalized ||
        u.email.split("@")[0].toLowerCase() === normalized ||
        u.name.toLowerCase() === normalized
    );

    if (!matchedUser) {
      setErrorField("username");
      setErrorMessage("The username is not listed");
      toast.error("The username is not listed");
      return;
    }

    if (!password || password !== matchedUser.password) {
      setErrorField("password");
      setErrorMessage("The password is wrong");
      toast.error("The password is wrong");
      return;
    }

    setLoading(true);
    try {
      let user;
      try {
        user = await loginToBackend(matchedUser.email, password);
      } catch (backendError) {
        console.warn("Backend API login threw error, using fallback session:", backendError);
        user = {
          id: `user-${matchedUser.role.toLowerCase().replace(/\s+/g, "-")}`,
          name: matchedUser.name,
          email: matchedUser.email,
          role: matchedUser.role,
        };
        saveAuthSession(user, "session-token-" + Date.now());
      }
      toast.success(`Welcome back, ${user.name}!`);
      router.push(window.innerWidth < 768 ? "/dashboard" : "/hub");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in to FastonMed API");
      console.error("FastonMed API login failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.background} aria-hidden="true">
        <div className={styles.ribbonOne} /><div className={styles.ribbonTwo} />
        <div className={styles.orb} />
      </div>
      <div className={styles.content}>
        <header className={styles.brand}>
          <FastonmedLogo size="xl" theme="dark" />
          <span className={styles.brandCaption}>YOUR WORKSPACE, CONNECTED.</span>
        </header>
        <section className={styles.card} aria-labelledby="login-heading">
          <span className={styles.eyebrow}>FASTONMED CRM</span>
          <h1 id="login-heading">Welcome back</h1>
          <p className={styles.intro}>Everything you need. One workspace.<br />Sign in to get started.</p>
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="login-username">Username or email</label>
              <input id="login-username" name="username" type="text" value={email}
                autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                placeholder="Your username or email" aria-invalid={errorField === "username"}
                aria-describedby={errorField === "username" ? "login-error" : undefined}
                onChange={(e) => { setEmail(e.target.value); if (errorField === "username") { setErrorField(null); setErrorMessage(null); } }} />
            </div>
            <div className={styles.field}>
              <label htmlFor="login-password">Password</label>
              <div className={styles.passwordWrap}>
                <input id="login-password" name="password" type={showPassword ? "text" : "password"}
                  value={password} autoComplete="current-password" placeholder="Enter your password"
                  aria-invalid={errorField === "password"}
                  aria-describedby={errorField === "password" ? "login-error" : undefined}
                  onChange={(e) => { setPassword(e.target.value); if (errorField === "password") { setErrorField(null); setErrorMessage(null); } }} />
                <button type="button" className={styles.eye} onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {errorMessage && <p id="login-error" role="alert" className={styles.error}>{errorMessage}</p>}
            <button type="submit" disabled={loading} className={styles.submit}>
              {loading ? "Signing in…" : "Sign in"}
              {loading ? <span className={styles.spinner} /> : <ArrowRight size={20} />}
            </button>
          </form>
          <div className={styles.divider} />
          <p className={styles.access}><LockKeyhole size={14} /> Your FastonMed team workspace</p>
        </section>
        <footer className={styles.footer}>© 2026 FastonMed. All rights reserved.</footer>
      </div>
    </main>
  );
}
