"""Convierte un raw-YYYY-MM-DD.txt en el JSON de snapshot que usa la app."""
import json, sys, re, unicodedata
ALIAS = {
 "villa la angostura": "", "puerto": "Puerto Manzano", "faldeo manzano": "Puerto Manzano",
 "lomas de correntoso": "Lomas del Correntoso", "epulaufquen": "Epulafquen",
 "peumayen": "Peumayén", "altos de cumelen": "Cumelén", "el mallin": "El Mallín",
 "rincon del totoral": "Rincón del Totoral", "faldeo del bayo": "Faldeo del Bayo",
 "la villa": "La Villa (Puerto)",
}
def norm(b):
    k = unicodedata.normalize("NFKD", b).encode("ascii","ignore").decode().lower().strip()
    if k in ALIAS: return ALIAS[k]
    return b.strip()
def build(path):
    date = re.search(r"(\d{4}-\d{2}-\d{2})", path).group(1)
    rows = []
    for line in open(path, encoding="utf-8"):
        if not line.strip() or line.startswith("#"): continue
        src,id_,cur,price,barrio,cub,tot,dorm,slug = line.rstrip("\n").split(";")
        if barrio == "EXCLUIR" or cur != "USD" or int(price) < 20000: continue
        n = lambda x: int(x) if x else None
        rows.append([src, id_, int(price), norm(barrio) or "Sin barrio", n(cub), n(tot), n(dorm), slug or None])
    return {"date": date, "fields": ["src","id","price","barrio","m2cub","m2tot","dorm","slug"], "rows": rows}
if __name__ == "__main__":
    snap = build(sys.argv[1])
    out = sys.argv[1].replace("raw-","snapshot-").replace(".txt",".json")
    json.dump(snap, open(out,"w"), ensure_ascii=False, separators=(",",":"))
    from collections import Counter
    print(len(snap["rows"]), Counter(r[3] for r in snap["rows"]).most_common())
