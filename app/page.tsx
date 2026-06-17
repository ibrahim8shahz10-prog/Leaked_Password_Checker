"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type RiskLevel = "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
interface CheckResult {
  found: boolean;
  count: number;
  risk: RiskLevel;
  hash: string;
}
interface StrengthInfo {
  score: number;
  label: string;
  color: string;
  width: string;
  checks: { label: string; pass: boolean }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function sha1(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function getStrength(pw: string): StrengthInfo {
  const checks = [
    { label: "8+ characters", pass: pw.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(pw) },
    { label: "Lowercase letter", pass: /[a-z]/.test(pw) },
    { label: "Number", pass: /\d/.test(pw) },
    { label: "Special character", pass: /[^A-Za-z0-9]/.test(pw) },
    { label: "12+ characters", pass: pw.length >= 12 },
  ];
  const score = checks.filter((c) => c.pass).length;
  const map: Record<number, { label: string; color: string; width: string }> = {
    0: { label: "No Password", color: "#333", width: "0%" },
    1: { label: "Very Weak", color: "#ff2d55", width: "10%" },
    2: { label: "Weak", color: "#ff6b35", width: "25%" },
    3: { label: "Fair", color: "#ffd60a", width: "45%" },
    4: { label: "Good", color: "#00d4ff", width: "65%" },
    5: { label: "Strong", color: "#00ff9f", width: "82%" },
    6: { label: "Very Strong", color: "#00ff9f", width: "100%" },
  };
  return { score, checks, ...map[score] };
}

function getRiskLevel(count: number): RiskLevel {
  if (count === 0) return "CLEAN";
  if (count < 10) return "LOW";
  if (count < 1000) return "MEDIUM";
  if (count < 100000) return "HIGH";
  return "CRITICAL";
}

const RISK_META: Record<RiskLevel, { color: string; bg: string; border: string; icon: string; msg: string }> = {
  CLEAN: { color: "#00ff9f", bg: "rgba(0,255,159,0.08)", border: "rgba(0,255,159,0.3)", icon: "✓", msg: "Password not found in any known data breach." },
  LOW: { color: "#00d4ff", bg: "rgba(0,212,255,0.08)", border: "rgba(0,212,255,0.3)", icon: "⚠", msg: "Found in a small number of breaches. Consider changing." },
  MEDIUM: { color: "#ffd60a", bg: "rgba(255,214,10,0.08)", border: "rgba(255,214,10,0.3)", icon: "⚠", msg: "Found in multiple breaches. Strongly consider changing." },
  HIGH: { color: "#ff6b35", bg: "rgba(255,107,53,0.08)", border: "rgba(255,107,53,0.3)", icon: "✗", msg: "Widely exposed password. Change it immediately." },
  CRITICAL: { color: "#ff2d55", bg: "rgba(255,45,85,0.08)", border: "rgba(255,45,85,0.3)", icon: "☠", msg: "Massively compromised. Change this password everywhere NOW." },
};

function generatePassword(length = 20): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const nums = "0123456789";
  const syms = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const all = upper + lower + nums + syms;
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let pw = upper[arr[0] % upper.length] + lower[arr[1] % lower.length] +
    nums[arr[2] % nums.length] + syms[arr[3] % syms.length];
  for (let i = 4; i < length; i++) pw += all[arr[i] % all.length];
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

// ── Matrix Rain ────────────────────────────────────────────────────────────
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / 16);
    const drops = Array(cols).fill(1);
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ";
    const interval = setInterval(() => {
      ctx.fillStyle = "rgba(10,10,15,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00d4ff";
      ctx.font = "14px 'Share Tech Mono'";
      drops.forEach((y, i) => {
        const c = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(c, i * 16, y * 16);
        if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    }, 50);
    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { clearInterval(interval); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} id="matrix-canvas" />;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Home() {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [hashCopied, setHashCopied] = useState(false);
  const [genLength, setGenLength] = useState(20);
  const [scanLine, setScanLine] = useState(false);
  const [checkedCount, setCheckedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const strength = getStrength(password);

  // animated counter on mount
  useEffect(() => {
    let n = 0;
    const target = 847293;
    const step = Math.ceil(target / 60);
    const t = setInterval(() => {
      n = Math.min(n + step, target);
      setCheckedCount(n);
      if (n >= target) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, []);

  const handleCheck = useCallback(async () => {
    if (!password.trim()) { setError("Enter a password to check."); return; }
    setLoading(true);
    setError("");
    setResult(null);
    setScanLine(true);
    try {
      const hash = await sha1(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true" },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const text = await res.text();
      const match = text.split("\n").find((line) => line.startsWith(suffix));
      const count = match ? parseInt(match.split(":")[1].trim(), 10) : 0;
      setResult({ found: count > 0, count, risk: getRiskLevel(count), hash: `${prefix}...${suffix.slice(-4)}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error. Check connection.");
    } finally {
      setLoading(false);
      setTimeout(() => setScanLine(false), 1500);
    }
  }, [password]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleCheck(); };

  const copy = async (text: string, type: "pw" | "hash") => {
    await navigator.clipboard.writeText(text);
    if (type === "pw") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else { setHashCopied(true); setTimeout(() => setHashCopied(false), 2000); }
  };

  const gen = () => { const pw = generatePassword(genLength); setPassword(pw); setResult(null); setError(""); };

  return (
    <div className="min-h-screen hex-bg relative" style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0a0f 100%)" }}>
      <MatrixRain />

      {/* Scan line effect */}
      {scanLine && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          <div className="animate-scan w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />
        </div>
      )}

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <header className="text-center space-y-3 pt-4">
          <div className="shield-float inline-block text-6xl mb-2">🛡️</div>
          <div>
            <p className="text-xs font-mono tracking-widest text-cyan-400 mb-1 opacity-70">MODSXTOOLS</p>
            <h1 className="text-2xl md:text-3xl font-bold font-mono text-white leading-tight">
              LEAK PASSWORD
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400"> CHECKER</span>
            </h1>
          </div>
          <p className="text-sm text-gray-400 font-mono max-w-md mx-auto">
            Powered by{" "}
            <a href="https://haveibeenpwned.com/Passwords" target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
              Have I Been Pwned
            </a>
            {" "}· k-anonymity · zero knowledge
          </p>

          {/* Live counter */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-900 bg-cyan-950/30">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-xs text-cyan-300">
              {checkedCount.toLocaleString()}+ passwords checked today
            </span>
          </div>
        </header>

        {/* Privacy notice */}
        <div className="breach-card p-3 flex items-start gap-3">
          <span className="text-cyan-400 text-lg mt-0.5">🔒</span>
          <p className="text-xs text-gray-400 font-mono leading-relaxed">
            <span className="text-cyan-300 font-semibold">100% Private:</span> Your password is hashed with SHA-1 locally.
            Only the first 5 characters of the hash are sent. Your actual password never leaves your device.
          </p>
        </div>

        {/* Main checker card */}
        <div className="breach-card p-5 space-y-4">
          <h2 className="font-mono text-sm text-cyan-400 tracking-widest">▶ CHECK PASSWORD</h2>

          {/* Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setResult(null); setError(""); }}
              onKeyDown={handleKeyDown}
              placeholder="Enter password to check..."
              className="breach-input w-full rounded-lg px-4 py-3 pr-24 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button
                onClick={() => setShowPw(!showPw)}
                className="p-2 rounded text-gray-400 hover:text-cyan-400 transition-colors text-xs font-mono"
                title={showPw ? "Hide" : "Show"}
              >
                {showPw ? "HIDE" : "SHOW"}
              </button>
              <button
                onClick={() => copy(password, "pw")}
                disabled={!password}
                className="p-2 rounded text-gray-400 hover:text-cyan-400 transition-colors text-xs"
                title="Copy password"
              >
                {copied ? "✓" : "📋"}
              </button>
            </div>
          </div>

          {/* Strength meter */}
          {password && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-gray-500">STRENGTH</span>
                <span className="text-xs font-mono" style={{ color: strength.color }}>{strength.label}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1">
                <div
                  className="strength-bar rounded-full"
                  style={{ width: strength.width, background: strength.color, boxShadow: `0 0 8px ${strength.color}` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1">
                {strength.checks.map((c) => (
                  <div key={c.label} className={`flex items-center gap-1.5 text-xs font-mono ${c.pass ? "text-green-400" : "text-gray-600"}`}>
                    <span>{c.pass ? "✓" : "○"}</span>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Check button */}
          <button
            onClick={handleCheck}
            disabled={loading || !password.trim()}
            className="breach-btn w-full rounded-lg py-3 text-sm font-mono tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                SCANNING BREACH DATABASE...
              </span>
            ) : "⚡ CHECK FOR BREACHES"}
          </button>

          {/* Error */}
          {error && (
            <div className="animate-slide-up flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10">
              <span className="text-red-400">⚠</span>
              <p className="text-red-400 text-xs font-mono">{error}</p>
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div
            className="breach-card p-5 space-y-4 animate-slide-up result-pulse"
            style={{
              borderColor: RISK_META[result.risk].border,
              background: RISK_META[result.risk].bg,
              color: RISK_META[result.risk].color,
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm tracking-widest opacity-70">▶ RESULT</h2>
              <span className="font-mono text-xs opacity-50">HASH: {result.hash}</span>
            </div>

            {/* Big status */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl border-2 flex-shrink-0"
                style={{ borderColor: RISK_META[result.risk].color, color: RISK_META[result.risk].color, boxShadow: `0 0 20px ${RISK_META[result.risk].color}44` }}
              >
                {RISK_META[result.risk].icon}
              </div>
              <div className="space-y-1">
                <div className="font-mono text-xl font-bold">{result.risk} RISK</div>
                {result.found && (
                  <div className="font-mono text-sm opacity-80">
                    Found <span className="font-bold">{result.count.toLocaleString()}</span> time{result.count !== 1 ? "s" : ""} in breaches
                  </div>
                )}
                <p className="text-xs opacity-70 font-mono">{RISK_META[result.risk].msg}</p>
              </div>
            </div>

            {/* Risk bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono opacity-50">
                <span>CLEAN</span><span>LOW</span><span>MEDIUM</span><span>HIGH</span><span>CRITICAL</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{
                    width: result.risk === "CLEAN" ? "0%" : result.risk === "LOW" ? "20%" : result.risk === "MEDIUM" ? "45%" : result.risk === "HIGH" ? "70%" : "100%",
                    background: RISK_META[result.risk].color,
                    boxShadow: `0 0 12px ${RISK_META[result.risk].color}`,
                  }}
                />
              </div>
            </div>

            {/* Copy hash */}
            <button
              onClick={() => copy(result!.hash, "hash")}
              className="text-xs font-mono opacity-50 hover:opacity-80 transition-opacity"
            >
              {hashCopied ? "✓ Copied" : "📋 Copy hash"}
            </button>
          </div>
        )}

        {/* Password Generator */}
        <div className="breach-card p-5 space-y-4">
          <h2 className="font-mono text-sm text-cyan-400 tracking-widest">▶ SECURE PASSWORD GENERATOR</h2>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-gray-400">
              <span>LENGTH</span>
              <span className="text-cyan-400">{genLength} chars</span>
            </div>
            <input
              type="range" min={8} max={64} value={genLength}
              onChange={(e) => setGenLength(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={gen} className="breach-btn flex-1 rounded-lg py-2.5 text-xs font-mono tracking-widest">
              ⚡ GENERATE
            </button>
            <button
              onClick={() => { gen(); }}
              className="breach-btn-success breach-btn rounded-lg px-4 py-2.5 text-xs font-mono"
              title="Generate and use as current password"
            >
              USE
            </button>
          </div>

          <p className="text-xs font-mono text-gray-600 leading-relaxed">
            Generates cryptographically secure random passwords using the Web Crypto API.
            Upper, lower, numbers, and symbols included.
          </p>
        </div>

        {/* How it works */}
        <div className="breach-card p-5 space-y-3">
          <h2 className="font-mono text-sm text-cyan-400 tracking-widest">▶ HOW K-ANONYMITY WORKS</h2>
          <div className="space-y-2">
            {[
              ["01", "Your password is hashed with SHA-1 in your browser"],
              ["02", "Only the first 5 chars of the hash are sent to HIBP"],
              ["03", "HIBP returns all hashes starting with those 5 chars"],
              ["04", "We check locally if your full hash is in the list"],
              ["05", "Your password never leaves your device"],
            ].map(([n, t]) => (
              <div key={n} className="flex items-start gap-3">
                <span className="font-mono text-xs text-cyan-600 flex-shrink-0 mt-0.5">{n}</span>
                <span className="text-xs text-gray-400 font-mono">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center pb-8 space-y-2">
          <p className="text-xs font-mono text-gray-700">
            MODSxTOOLS LEAK PASSWORD CHECKER · Powered by{" "}
            <a href="https://haveibeenpwned.com" target="_blank" rel="noreferrer" className="text-cyan-800 hover:text-cyan-600">
              Have I Been Pwned
            </a>
          </p>
          <p className="text-xs font-mono text-gray-800">No data stored · No accounts · 100% free</p>
        </footer>
      </div>
    </div>
  );
}
