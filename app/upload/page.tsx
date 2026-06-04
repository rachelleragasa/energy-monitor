"use client";
import Link from "next/link";
import { useRef, useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; registos: number }
  | { kind: "error"; message: string };

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isXlsx = (f: File) => /\.(xlsx|xls)$/i.test(f.name);

  function pick(f: File | null) {
    if (!f) return;
    if (!isXlsx(f)) {
      setStatus({
        kind: "error",
        message: "Formato inválido. Escolha um ficheiro .xlsx ou .xls.",
      });
      return;
    }
    setFile(f);
    setStatus({ kind: "idle" });
  }

  async function upload() {
    if (!file) return;
    setStatus({ kind: "uploading" });
    const body = new FormData();
    body.append("file", file);
    try {
      const r = await fetch("http://localhost:8000/api/upload", {
        method: "POST",
        body,
      });
      if (!r.ok) {
        const detail = await r
          .json()
          .then((d) => d.detail as string)
          .catch(() => null);
        throw new Error(detail ?? `HTTP ${r.status}`);
      }
      const d = (await r.json()) as { registos: number };
      // Unlock the overview on the home page — it stays gated until an upload
      // has succeeded at least once.
      localStorage.setItem("energia:uploaded", "1");
      setStatus({ kind: "success", registos: d.registos });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Falha no carregamento.",
      });
    }
  }

  return (
    <main
      style={{ maxWidth: 920, margin: "0 auto", padding: "3.5rem 1.5rem 4rem" }}
    >
      {/* Header */}
      <header style={{ marginBottom: "2.5rem" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            color: "var(--text-secondary)",
            fontSize: "1rem",
            textDecoration: "none",
            marginBottom: "1.25rem",
          }}
        >
          ← Voltar às leituras
        </Link>
        <h1
          style={{
            fontSize: "2.75rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: "var(--text-primary)",
          }}
        >
          Carregar folha de cálculo
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1.25rem",
            marginTop: "0.5rem",
          }}
        >
          Envie um ficheiro Excel (.xlsx) com a folha{" "}
          <span style={{ fontFamily: "var(--font-mono)" }}>Leituras</span> para
          substituir os dados atuais.
        </p>
      </header>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border-strong)"}`,
          borderRadius: 12,
          background: dragging ? "var(--accent-soft)" : "var(--surface)",
          padding: "3rem 2rem",
          textAlign: "center",
          cursor: "pointer",
          transition: "background 0.15s, border-color 0.15s",
          marginBottom: "1.5rem",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />
        <div
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "0.4rem",
          }}
        >
          {file ? file.name : "Arraste um ficheiro para aqui"}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "1rem" }}>
          {file
            ? `${(file.size / 1024).toFixed(0)} KB · clique para trocar`
            : "ou clique para escolher · .xlsx, .xls"}
        </div>
      </div>

      {/* Action */}
      <button
        onClick={upload}
        disabled={!file || status.kind === "uploading"}
        style={{
          appearance: "none",
          border: "none",
          borderRadius: 8,
          background:
            !file || status.kind === "uploading"
              ? "var(--border-strong)"
              : "var(--accent)",
          color: "#fff",
          fontSize: "1.0625rem",
          fontWeight: 600,
          padding: "0.7rem 1.5rem",
          cursor: !file || status.kind === "uploading" ? "default" : "pointer",
        }}
      >
        {status.kind === "uploading" ? "A carregar…" : "Carregar dados"}
      </button>

      {/* Feedback */}
      {status.kind === "success" && (
        <div
          style={{
            marginTop: "1.5rem",
            border: "1px solid #bbf7d0",
            borderRadius: 12,
            background: "#f0fdf4",
            padding: "1.5rem 1.75rem",
          }}
        >
          <div
            style={{
              color: "var(--accent)",
              fontSize: "1.25rem",
              fontWeight: 600,
              marginBottom: "0.4rem",
            }}
          >
            Dados atualizados
          </div>
          <div
            style={{ color: "var(--text-secondary)", fontSize: "1.0625rem" }}
          >
            {status.registos}{" "}
            {status.registos === 1 ? "registo importado" : "registos importados"}.
          </div>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginTop: "0.9rem",
              color: "var(--accent)",
              fontWeight: 600,
              fontSize: "1.0625rem",
              textDecoration: "none",
            }}
          >
            Ver leituras →
          </Link>
        </div>
      )}

      {status.kind === "error" && (
        <div
          style={{
            marginTop: "1.5rem",
            border: "1px solid #fecaca",
            borderRadius: 12,
            background: "#fef2f2",
            padding: "1.5rem 1.75rem",
          }}
        >
          <div
            style={{
              color: "var(--red)",
              fontSize: "1.25rem",
              fontWeight: 600,
              marginBottom: "0.4rem",
            }}
          >
            Não foi possível carregar
          </div>
          <div
            style={{ color: "var(--text-secondary)", fontSize: "1.0625rem" }}
          >
            {status.message}
          </div>
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "1rem",
              marginTop: "0.6rem",
            }}
          >
            Confirme que o backend está a correr em localhost:8000.
          </div>
        </div>
      )}
    </main>
  );
}
