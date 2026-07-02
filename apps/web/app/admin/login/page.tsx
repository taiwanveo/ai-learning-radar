"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    setPending(false);
    if (!response.ok) {
      setError("帳號或密碼不正確");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className={styles.shell}>
      <form className={styles.card} onSubmit={submit}>
        <p className="eyebrow">ADMIN CONSOLE</p>
        <h1>管理後台登入</h1>
        <label>
          電子郵件
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          密碼
          <input name="password" type="password" autoComplete="current-password" minLength={12} required />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={pending}>{pending ? "登入中…" : "登入"}</button>
      </form>
    </main>
  );
}
