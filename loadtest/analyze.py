# Разбор сырых метрик k6 (results/<прогон>/raw.csv.gz): таблица по ступеням нагрузки, по эндпоинтам и график.
# Запуск: python loadtest/analyze.py run2
import csv
import gzip
import statistics
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

RES = Path(__file__).parent / "results" / (sys.argv[1] if len(sys.argv) > 1 else "run")
# Окна «полки» каждой ступени (секунды от старта), без участков разгона — см. stages в load.js
STAGES = [("20 VU", 30, 150), ("50 VU", 180, 240), ("100 VU", 270, 330)]


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))] if xs else float("nan")


reqs, vus = [], {}
with gzip.open(RES / "raw.csv.gz", "rt", newline="") as f:
    for row in csv.DictReader(f):
        m = row["metric_name"]
        if m == "http_req_duration":
            reqs.append((int(row["timestamp"]), float(row["metric_value"]), row["name"], row["status"]))
        elif m == "vus":
            vus[int(row["timestamp"])] = float(row["metric_value"])

t0 = min(t for t, *_ in reqs)
reqs = [(t - t0, d, n, s) for t, d, n, s in reqs]
vus = {t - t0: v for t, v in vus.items()}
ok_status = {"index": "200", "asset-js": "200", "asset-css": "200", "server-key": "200", "tools-unauth": "401"}


def row_stats(rs, seconds):
    ds = [d for _, d, _, _ in rs]
    errs = sum(1 for _, _, n, s in rs if ok_status.get(n) != s)
    return {
        "n": len(rs), "rps": len(rs) / seconds, "err": 100 * errs / max(1, len(rs)),
        "avg": statistics.mean(ds), "p50": pct(ds, 50), "p95": pct(ds, 95), "p99": pct(ds, 99), "max": max(ds),
    }


print("| Ступень | Запросов | RPS | Ошибки, % | Среднее, мс | p50 | p95 | p99 | max |")
print("|---|---|---|---|---|---|---|---|---|")
for label, a, b in STAGES:
    s = row_stats([r for r in reqs if a <= r[0] < b], b - a)
    print(f"| {label} | {s['n']} | {s['rps']:.1f} | {s['err']:.2f} | {s['avg']:.0f} | {s['p50']:.0f} | {s['p95']:.0f} | {s['p99']:.0f} | {s['max']:.0f} |")

total = max(t for t, *_ in reqs) + 1
print("\n| Эндпоинт | Запросов | Ошибки, % | p50, мс | p95 | p99 | max |")
print("|---|---|---|---|---|---|---|")
by_name = defaultdict(list)
for r in reqs:
    by_name[r[2]].append(r)
for name in ["index", "asset-css", "asset-js", "server-key", "tools-unauth"]:
    s = row_stats(by_name[name], total)
    print(f"| {name} | {s['n']} | {s['err']:.2f} | {s['p50']:.0f} | {s['p95']:.0f} | {s['p99']:.0f} | {s['max']:.0f} |")

# График по 5-секундным окнам: p50/p95 задержки и RPS на фоне числа пользователей
W = 5
buckets = defaultdict(list)
for t, d, *_ in reqs:
    buckets[t // W].append(d)
xs = sorted(buckets)
fig, ax1 = plt.subplots(figsize=(10, 4.5))
ax1.plot([x * W for x in xs], [pct(buckets[x], 50) for x in xs], label="p50, мс", color="#2b6cb0")
ax1.plot([x * W for x in xs], [pct(buckets[x], 95) for x in xs], label="p95, мс", color="#c05621")
ax1.set_xlabel("Время от старта, с")
ax1.set_ylabel("Время ответа, мс")
ax1.grid(alpha=0.3)
ax2 = ax1.twinx()
ax2.plot([x * W for x in xs], [len(buckets[x]) / W for x in xs], label="RPS", color="#718096", alpha=0.6)
vt = sorted(vus)
ax2.step(vt, [vus[t] for t in vt], label="VU", color="#2f855a", where="post")
ax2.set_ylabel("RPS / пользователи")
h1, l1 = ax1.get_legend_handles_labels()
h2, l2 = ax2.get_legend_handles_labels()
ax1.legend(h1 + h2, l1 + l2, loc="upper left")
ax1.set_title("stackalg.tech: время ответа и пропускная способность по ступеням нагрузки")
fig.tight_layout()
fig.savefig(RES / "timeline.png", dpi=120)
print(f"\nГрафик: {RES / 'timeline.png'}")
