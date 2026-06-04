"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { API_BASE_URL } from "./lib/api";

interface Leitura {
  data: string;
  vazio: number;
  ponta: number;
  cheias: number;
  total: number;
  injVazio: number;
  injPonta: number;
  injCheias: number;
  injTotal: number;
}

function fmt(n: number) {
  return n.toLocaleString("pt-PT");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "01/06/2026" -> "Jun 2026"
function fmtMonthYear(date: string) {
  const [, m, y] = date.split("/").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

// "01/06/2026" -> "1 Jun"
function fmtDayMonth(date: string) {
  const [d, m] = date.split("/").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

// "01/06/2026" -> "1 Jun 2026"
function fmtDayMonthYear(date: string) {
  const [d, m, y] = date.split("/").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// Last calendar day of the month containing `date` (day-0 of next month).
function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

type Granularity = "daily" | "monthly";

// The "uploaded" flag lives in localStorage and is set by the upload page. We
// read it as an external store (rather than an effect) so the overview can stay
// gated behind the upload prompt without tripping the set-state-in-effect rule.
// `getServerSnapshot` returns false so SSR renders the prompt by default.
function subscribeUploaded(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function useUploaded() {
  return useSyncExternalStore(
    subscribeUploaded,
    () => localStorage.getItem("energia:uploaded") === "1",
    () => false,
  );
}

// Chart series colours — deliberately distinct hues so the two areas never read
// as the same colour: consumption = blue, injection (solar) = green.
const CONSUMO_COLOR = "#2563eb";
const INJECAO_COLOR = "#16a34a";

// A point on the line chart. `diff` is the plotted value (consumption vs. the
// previous period); `vazio`/`ponta`/`cheias`/`total` are the meter readings at
// the end of the period, used by the click-through breakdown.
interface ChartPoint {
  key: string; // unique id used for selection + x-axis category
  axisLabel: string; // short x-axis tick label, e.g. "Apr 2026"
  fullLabel: string; // verbose label for tooltip / breakdown header
  diff: number | null;
  injDiff: number | null; // injected (solar) energy vs. the previous period
  vazio: number;
  ponta: number;
  cheias: number;
  total: number;
}

export default function Home() {
  const [data, setData] = useState<Leitura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [tableOpen, setTableOpen] = useState(false);
  // Whether a spreadsheet has been uploaded. Set on the upload page after a
  // successful upload; the overview stays gated behind the prompt until then.
  const uploaded = useUploaded();

  // Only load the dashboard data once the user has uploaded a spreadsheet.
  // `loading` starts true and is cleared in the callbacks, so we never call
  // setState synchronously in the effect body.
  useEffect(() => {
    if (!uploaded) return;
    fetch(`${API_BASE_URL}/api/leituras`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [uploaded]);

  const parseDate = (s: string) => {
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  };

  // Table rows, most recent day first.
  const tableRows = [...data].sort(
    (a, b) => parseDate(b.data) - parseDate(a.data),
  );

  // Day-over-day consumption, computed in chronological order: the total change
  // and the per-tariff split (vazio/ponta/cheias) for each day. The first day
  // has no previous reading, so both are null.
  const diffByDate = new Map<string, number | null>();
  const injDiffByDate = new Map<string, number | null>();
  const tariffDiffByDate = new Map<
    string,
    { vazio: number; ponta: number; cheias: number } | null
  >();
  [...data]
    .sort((a, b) => parseDate(a.data) - parseDate(b.data))
    .forEach((row, i, arr) => {
      if (i === 0) {
        diffByDate.set(row.data, null);
        injDiffByDate.set(row.data, null);
        tariffDiffByDate.set(row.data, null);
        return;
      }
      const prev = arr[i - 1];
      diffByDate.set(row.data, row.total - prev.total);
      injDiffByDate.set(row.data, row.injTotal - prev.injTotal);
      tariffDiffByDate.set(row.data, {
        vazio: row.vazio - prev.vazio,
        ponta: row.ponta - prev.ponta,
        cheias: row.cheias - prev.cheias,
      });
    });

  // Readings in chronological order — the basis for every chart series.
  const chrono = [...data].sort(
    (a, b) => parseDate(a.data) - parseDate(b.data),
  );

  // Daily series. Plotted value is `diff` (day-over-day consumption); the first
  // day has no previous reading so its diff is null (gap).
  const dailyPoints: ChartPoint[] = chrono.map((row) => {
    const diff = diffByDate.get(row.data) ?? null;
    return {
      key: row.data,
      axisLabel: fmtDayMonth(row.data),
      fullLabel: fmtDayMonthYear(row.data),
      diff,
      injDiff: injDiffByDate.get(row.data) ?? null,
      vazio: row.vazio,
      ponta: row.ponta,
      cheias: row.cheias,
      total: row.total,
    };
  });

  // Monthly series. Each bucket holds the readings of one calendar month; its
  // plotted value is month-over-month consumption (this month's closing total
  // minus the previous month's), and the breakdown shows the month-end reading.
  const monthMap = new Map<string, Leitura[]>();
  for (const row of chrono) {
    const [, m, y] = row.data.split("/").map(Number);
    const mk = `${y}-${String(m).padStart(2, "0")}`;
    (monthMap.get(mk) ?? monthMap.set(mk, []).get(mk)!).push(row);
  }
  // Drop incomplete months — ones whose latest reading doesn't reach the last
  // calendar day. Otherwise a partial month (e.g. data only up to 1 Jun) is
  // summed as a few days and shown as a full month, a misleading steep drop.
  const allMonths = [...monthMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const completeMonths = allMonths.filter(([, rows]) => {
    const end = rows[rows.length - 1];
    const [d, m, y] = end.data.split("/").map(Number);
    return d === daysInMonth(y, m);
  });
  const excludedMonths = allMonths.length - completeMonths.length;
  const monthlyPoints: ChartPoint[] = completeMonths.map(([mk, rows]) => {
    const end = rows[rows.length - 1]; // chronologically last reading of the month
    // Monthly consumption = sum of the daily diffs falling within this month.
    // This telescopes to (month close − previous month close), so the first
    // kept month still gets a value from its own readings — no prior month
    // required (the global-first day's diff is null, counted as 0).
    const diff = rows.reduce((s, r) => s + (diffByDate.get(r.data) ?? 0), 0);
    const injDiff = rows.reduce(
      (s, r) => s + (injDiffByDate.get(r.data) ?? 0),
      0,
    );
    return {
      key: mk,
      axisLabel: fmtMonthYear(end.data),
      fullLabel: fmtMonthYear(end.data),
      diff,
      injDiff,
      vazio: end.vazio,
      ponta: end.ponta,
      cheias: end.cheias,
      total: end.total,
    };
  });

  const chartData = granularity === "daily" ? dailyPoints : monthlyPoints;
  const selected = chartData.find((d) => d.key === selectedDate) ?? null;
  const axisLabelByKey = new Map(chartData.map((d) => [d.key, d.axisLabel]));
  const fullLabelByKey = new Map(chartData.map((d) => [d.key, d.fullLabel]));

  // Summary stats over the Δ DIA (day-over-day consumption) values — the first
  // day has no previous reading so it is excluded. The raw `total` is a
  // cumulative meter reading, so max/min/avg of it would be meaningless.
  const dailyDiffs = [...diffByDate.values()].filter(
    (v): v is number => v != null,
  );
  const maxDiff = dailyDiffs.length ? Math.max(...dailyDiffs) : 0;
  const minDiff = dailyDiffs.length ? Math.min(...dailyDiffs) : 0;
  const avgDiff = dailyDiffs.length
    ? Math.round(dailyDiffs.reduce((s, v) => s + v, 0) / dailyDiffs.length)
    : 0;

  // Tariff split for the whole period. The vazio/ponta/cheias values are
  // cumulative meter readings, so consumption per tariff = last reading − first.
  const first = chrono[0];
  const last = chrono[chrono.length - 1];
  const periodSplit =
    chrono.length >= 2
      ? {
          vazio: last.vazio - first.vazio,
          ponta: last.ponta - first.ponta,
          cheias: last.cheias - first.cheias,
        }
      : { vazio: 0, ponta: 0, cheias: 0 };
  const periodTotal =
    periodSplit.vazio + periodSplit.ponta + periodSplit.cheias;
  const tariffSegs = [
    {
      key: "vazio" as const,
      label: "Vazio",
      desc: "fora de ponta",
      color: "var(--accent)",
    },
    {
      key: "ponta" as const,
      label: "Ponta",
      desc: "hora de pico",
      color: "var(--red)",
    },
    {
      key: "cheias" as const,
      label: "Cheias",
      desc: "hora intermédia",
      color: "#d97706",
    },
  ];

  const thBase: React.CSSProperties = {
    padding: "0.9rem 1.25rem",
    fontSize: "1rem",
    fontWeight: 600,
    letterSpacing: "0.02em",
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  return (
    <main
      style={{ maxWidth: 920, margin: "0 auto", padding: "3.5rem 1.5rem 4rem" }}
    >
      {/* Header */}
      <header style={{ marginBottom: "2.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "0.75rem",
          }}
        >
          <Link
            href="/upload"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              padding: "0.45rem 0.95rem",
              color: "var(--text-secondary)",
              fontSize: "1rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            ↑ Carregar folha
          </Link>
        </div>
        <h1
          style={{
            fontSize: "2.75rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: "var(--text-primary)",
          }}
        >
          Leituras de Energia
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1.25rem",
            marginTop: "0.5rem",
          }}
        >
          Energia ativa consumida (kWh), por período tarifário.
        </p>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: "1rem",
            marginTop: "0.6rem",
          }}
        >
          Vazio = fora de ponta · Ponta = hora de pico · Cheias = hora
          intermédia
        </p>
      </header>

      {/* Stats */}
      {!loading && !error && data.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "0.85rem",
            marginBottom: "2rem",
          }}
        >
          {[
            {
              label: "Dias",
              value: dailyDiffs.length.toString(),
              unit: "com variação",
            },
            { label: "Δ Dia máx.", value: fmt(maxDiff), unit: "kWh/dia" },
            { label: "Δ Dia mín.", value: fmt(minDiff), unit: "kWh/dia" },
            { label: "Δ Dia média", value: fmt(avgDiff), unit: "kWh/dia" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div
                style={{
                  fontSize: "1rem",
                  color: "var(--text-secondary)",
                  marginBottom: "0.45rem",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: "1rem",
                  color: "var(--text-muted)",
                  marginTop: "0.25rem",
                }}
              >
                {s.unit}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Line chart — total consumption per day (DIA). Click a point for the breakdown. */}
      {!loading && !error && chartData.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            padding: "1.75rem 1.5rem 1.25rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.4rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.4rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {granularity === "daily"
                ? "Variação diária do consumo"
                : "Variação mensal do consumo"}
            </h2>
            {/* Granularity toggle */}
            <div
              style={{
                display: "inline-flex",
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {(
                [
                  { g: "daily", label: "Diário" },
                  { g: "monthly", label: "Mensal" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.g}
                  onClick={() => {
                    setGranularity(opt.g);
                    setSelectedDate(null);
                  }}
                  style={{
                    border: "none",
                    background:
                      granularity === opt.g ? "var(--accent)" : "transparent",
                    color:
                      granularity === opt.g ? "#fff" : "var(--text-secondary)",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    padding: "0.4rem 0.95rem",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              fontSize: "0.95rem",
              color: "var(--text-muted)",
              marginBottom: "1.25rem",
            }}
          >
            Clique num ponto para ver o detalhe
            {granularity === "monthly" &&
              excludedMonths > 0 &&
              ` · ${excludedMonths} ${excludedMonths === 1 ? "mês incompleto omitido" : "meses incompletos omitidos"}`}
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 4, left: 4 }}
              onClick={(state) => {
                const p = (
                  state as unknown as {
                    activePayload?: { payload: ChartPoint }[];
                  }
                )?.activePayload?.[0]?.payload;
                if (p) setSelectedDate((cur) => (cur === p.key ? null : p.key));
              }}
              style={{ cursor: "pointer" }}
            >
              <defs>
                <linearGradient id="fillConsumo" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={CONSUMO_COLOR}
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor={CONSUMO_COLOR}
                    stopOpacity={0.03}
                  />
                </linearGradient>
                <linearGradient id="fillInjecao" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={INJECAO_COLOR}
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor={INJECAO_COLOR}
                    stopOpacity={0.03}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="key"
                tickFormatter={(k: string) => axisLabelByKey.get(k) ?? k}
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                tickMargin={8}
                minTickGap={28}
                stroke="var(--border-strong)"
              />
              <YAxis
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                tickFormatter={(v: number) => fmt(v)}
                width={64}
                stroke="var(--border-strong)"
                label={{
                  value: "kWh",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--text-muted)", fontSize: 12 },
                }}
              />
              <Tooltip
                labelFormatter={(k) =>
                  fullLabelByKey.get(String(k)) ?? String(k)
                }
                formatter={(v, name) => {
                  if (v == null) return ["—", name as string];
                  const n = Number(v);
                  return [`${n > 0 ? "+" : ""}${fmt(n)} kWh`, name as string];
                }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface)",
                  fontSize: "0.95rem",
                }}
                labelStyle={{ color: "var(--text-secondary)" }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                wrapperStyle={{
                  fontSize: "0.95rem",
                  color: "var(--text-secondary)",
                }}
              />
              <ReferenceLine
                y={0}
                stroke="var(--border-strong)"
                strokeDasharray="4 4"
              />
              <Area
                type="monotone"
                dataKey="diff"
                name={
                  granularity === "daily"
                    ? "Consumo (variação diária)"
                    : "Consumo (variação mensal)"
                }
                connectNulls
                stroke={CONSUMO_COLOR}
                strokeWidth={2}
                fill="url(#fillConsumo)"
                dot={(props: {
                  cx?: number;
                  cy?: number;
                  payload?: ChartPoint;
                  index?: number;
                }) => {
                  const { cx, cy, payload } = props;
                  // Skip points with no value (e.g. the first day has no previous
                  // reading to diff against) — otherwise a stray dot renders at the
                  // top-left against the y-axis with nothing to click.
                  if (payload?.diff == null || cy == null) {
                    return <g key={payload?.key ?? props.index} />;
                  }
                  const isSel = payload?.key === selectedDate;
                  return (
                    <circle
                      key={payload?.key ?? props.index}
                      cx={cx}
                      cy={cy}
                      r={isSel ? 7 : 4}
                      fill={isSel ? CONSUMO_COLOR : "var(--surface)"}
                      stroke={CONSUMO_COLOR}
                      strokeWidth={2}
                      style={{ cursor: "pointer" }}
                    />
                  );
                }}
                activeDot={{ r: 7 }}
              />
              <Area
                type="monotone"
                dataKey="injDiff"
                name={
                  granularity === "daily"
                    ? "Injeção (variação diária)"
                    : "Injeção (variação mensal)"
                }
                connectNulls
                stroke={INJECAO_COLOR}
                strokeWidth={2}
                fill="url(#fillInjecao)"
                dot={false}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Breakdown panel for the clicked point */}
          {selected && (
            <div
              style={{
                marginTop: "1.25rem",
                borderTop: "1px solid var(--border)",
                paddingTop: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <div
                    style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}
                  >
                    {granularity === "daily"
                      ? "Detalhe do dia"
                      : "Detalhe do mês"}
                  </div>
                  <div
                    style={{
                      fontSize: "1.35rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {selected.fullLabel}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDate(null)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 8,
                    color: "var(--text-secondary)",
                    fontSize: "0.95rem",
                    padding: "0.35rem 0.8rem",
                    cursor: "pointer",
                  }}
                >
                  Fechar
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                {(
                  [
                    { key: "vazio", label: "Vazio", color: "var(--accent)" },
                    { key: "ponta", label: "Ponta", color: "var(--red)" },
                    { key: "cheias", label: "Cheias", color: "#d97706" },
                    {
                      key: "total",
                      label: "Total",
                      color: "var(--text-primary)",
                    },
                  ] as const
                ).map((seg) => {
                  const value = selected[seg.key];
                  const pct =
                    selected.total > 0 && seg.key !== "total"
                      ? Math.round((value / selected.total) * 100)
                      : null;
                  return (
                    <div key={seg.key} className="stat-card">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.45rem",
                          marginBottom: "0.45rem",
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: seg.color,
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.95rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {seg.label}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "1.6rem",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          fontFamily: "var(--font-mono)",
                          lineHeight: 1.1,
                        }}
                      >
                        {fmt(value)}
                      </div>
                      <div
                        style={{
                          fontSize: "0.9rem",
                          color: "var(--text-muted)",
                          marginTop: "0.25rem",
                        }}
                      >
                        kWh{pct != null ? ` · ${pct}%` : ""}
                      </div>
                      {pct != null && (
                        <div
                          style={{
                            marginTop: "0.6rem",
                            height: 5,
                            borderRadius: 3,
                            background: "var(--border)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: seg.color,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && uploaded && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            padding: "3rem 2rem",
            textAlign: "center",
          }}
        >
          <div className="loading-bar" style={{ marginBottom: "1.25rem" }} />
          <div style={{ color: "var(--text-secondary)", fontSize: "1.125rem" }}>
            A carregar dados…
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
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
            Erro de ligação
          </div>
          <div
            style={{ color: "var(--text-secondary)", fontSize: "1.0625rem" }}
          >
            {error}
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

      {/* Default state — until a spreadsheet is uploaded, the overview (charts
          and tables) stays hidden behind a friendly prompt. */}
      {!uploaded && (
        <div
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: 12,
            background: "var(--surface)",
            padding: "3.5rem 2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "2.5rem",
              lineHeight: 1,
              marginBottom: "1.1rem",
            }}
            aria-hidden
          >
            📄
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "0.5rem",
            }}
          >
            Carregue uma folha para ver o resumo
          </div>
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: "1.0625rem",
              maxWidth: 440,
              margin: "0 auto 1.5rem",
            }}
          >
            Para ver os gráficos e as tabelas de consumo, comece por carregar uma
            folha de cálculo com a folha{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>Leituras</span>.
          </div>
          <Link
            href="/upload"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              background: "var(--accent)",
              color: "#fff",
              fontSize: "1.0625rem",
              fontWeight: 600,
              padding: "0.7rem 1.5rem",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            ↑ Carregar folha
          </Link>
        </div>
      )}

      {/* Tariff breakdown — Vazio / Ponta / Cheias split for the whole period. */}
      {!loading && !error && periodTotal > 0 && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            padding: "1.75rem 1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.4rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Repartição por período tarifário
            </h2>
            <span style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>
              {fmtDayMonthYear(first.data)} – {fmtDayMonthYear(last.data)} ·{" "}
              {fmt(periodTotal)} kWh
            </span>
          </div>

          {/* Stacked proportion bar */}
          <div
            style={{
              display: "flex",
              height: 22,
              borderRadius: 6,
              overflow: "hidden",
              marginBottom: "1.5rem",
            }}
          >
            {tariffSegs.map((seg) => {
              const pct = (periodSplit[seg.key] / periodTotal) * 100;
              return (
                <div
                  key={seg.key}
                  title={`${seg.label}: ${fmt(periodSplit[seg.key])} kWh (${pct.toFixed(1)}%)`}
                  style={{ width: `${pct}%`, background: seg.color }}
                />
              );
            })}
          </div>

          {/* Labelled legend explaining each tariff */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
            }}
          >
            {tariffSegs.map((seg) => {
              const value = periodSplit[seg.key];
              const pct = (value / periodTotal) * 100;
              return (
                <div
                  key={seg.key}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: seg.color,
                      marginTop: "0.35rem",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {seg.label}{" "}
                      <span
                        style={{ fontWeight: 400, color: "var(--text-muted)" }}
                      >
                        · {seg.desc}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "1.35rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        fontFamily: "var(--font-mono)",
                        lineHeight: 1.2,
                      }}
                    >
                      {pct.toFixed(1)}%
                    </div>
                    <div
                      style={{
                        fontSize: "0.95rem",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {fmt(value)} kWh
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table — collapsible so the chart stays the hero of the page. */}
      {!loading && !error && data.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setTableOpen((o) => !o)}
            aria-expanded={tableOpen}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              padding: "1rem 1.25rem",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              style={{
                fontSize: "1.15rem",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Tabela de leituras
              <span
                style={{
                  fontSize: "1rem",
                  fontWeight: 400,
                  color: "var(--text-muted)",
                  marginLeft: "0.6rem",
                }}
              >
                {data.length} {data.length === 1 ? "registo" : "registos"}
              </span>
            </span>
            <span
              style={{
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              {tableOpen ? "Ocultar dados" : "Ver dados completos"}
              <span
                style={{
                  display: "inline-block",
                  transform: tableOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s",
                }}
              >
                ▾
              </span>
            </span>
          </button>
          {tableOpen && (
            <div
              style={{
                overflowX: "auto",
                borderTop: "1px solid var(--border)",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "1.125rem",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid var(--border-strong)" }}
                  >
                    <th style={{ ...thBase, textAlign: "left" }}>Data</th>
                    <th style={{ ...thBase, textAlign: "right" }}>Δ Dia</th>
                    <th style={{ ...thBase, textAlign: "left", width: "45%" }}>
                      Repartição tarifária
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => {
                    const diff = diffByDate.get(row.data);
                    const t = tariffDiffByDate.get(row.data);
                    const tTotal = t ? t.vazio + t.ponta + t.cheias : 0;
                    return (
                      <tr
                        key={row.data}
                        className="table-row"
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td
                          style={{
                            padding: "0.7rem 1.25rem",
                            color: "var(--text-secondary)",
                            fontFamily: "var(--font-mono)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtDayMonthYear(row.data)}
                        </td>
                        <td
                          style={{
                            padding: "0.7rem 1.25rem",
                            textAlign: "right",
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            color:
                              diff == null
                                ? "var(--text-muted)"
                                : "var(--text-primary)",
                          }}
                        >
                          {diff == null ? "—" : `${fmt(diff)} kWh`}
                        </td>
                        <td style={{ padding: "0.7rem 1.25rem" }}>
                          {t && tTotal > 0 ? (
                            <>
                              <div
                                style={{
                                  display: "flex",
                                  height: 14,
                                  borderRadius: 4,
                                  overflow: "hidden",
                                  marginBottom: "0.35rem",
                                }}
                              >
                                {tariffSegs.map((seg) => {
                                  const pct = (t[seg.key] / tTotal) * 100;
                                  return (
                                    <div
                                      key={seg.key}
                                      title={`${seg.label}: ${fmt(t[seg.key])} kWh (${pct.toFixed(0)}%)`}
                                      style={{
                                        width: `${pct}%`,
                                        background: seg.color,
                                      }}
                                    />
                                  );
                                })}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "0.85rem",
                                  fontSize: "0.9rem",
                                  color: "var(--text-muted)",
                                  fontFamily: "var(--font-mono)",
                                }}
                              >
                                {tariffSegs.map((seg) => (
                                  <span
                                    key={seg.key}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.3rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 2,
                                        background: seg.color,
                                      }}
                                    />
                                    {seg.label} {fmt(t[seg.key])}
                                  </span>
                                ))}
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p
        style={{
          marginTop: "1.5rem",
          fontSize: "1rem",
          color: "var(--text-muted)",
        }}
      >
        Fonte: operador de rede de distribuição · valores em kWh
      </p>
    </main>
  );
}
