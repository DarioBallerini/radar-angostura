import re,sys,os,pathlib
SRC=pathlib.Path(__file__).parent.parent/"index.html"
UXCSS=(pathlib.Path(__file__).parent/"ux.css").read_text()
UXJS=(pathlib.Path(__file__).parent/"ux.js").read_text()
# colores fijos del mapa en el JS original -> claves
KEYS={"#e8e3d3":"land","#ddd6c3":"topo","#efeadf":"nod1","#d8d0bd":"nod2","#a9d0de":"lake","#6fa8bd":"lakeS","#7fb1c4":"water","#cfc6b1":"road","#fffdf8":"halo","#b07a45":"route","#1c2d2b":"ink","#7d8a84":"lblmute","#2c6f88":"lakelbl","#8a5a32":"routelbl","#6c7a73":"scale","#d9d3c4":"nodata"}
RAMP0='["#2b6f8c","#4e9a93","#93bf86","#e2c36b","#d98945","#b4452c"]'
T={}
T["carta"]=dict(fonts="family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500;600",
 theme="#10283a",
 map=dict(land="#eceee8",topo="#e1e5de",nod1="#f2f3ef",nod2="#dfe3dc",lake="#b6d5e2",lakeS="#6f9fb7",water="#8db8cb",road="#c5cbc4",halo="#ffffff",route="#d2502e",ink="#10283a",lblmute="#7b8a90",lakelbl="#2a6585",routelbl="#b5462a",scale="#5a6b72",nodata="#dde1dc"),
 ramp='["#1b4f72","#2f7f96","#69ad9f","#c9d68f","#f0b86a","#d9542f"]',
 css="""
:root{--ink:#eef1ef;--deep:#ffffff;--raise:#eaeeed;--line:#d3dbda;--fog:#10283a;--mute:#5b6c74;--glacier:#1b5f80;--arrayan:#d9542f;--bosque:#2f6b55;--good:#2f7a4f;--warn:#b07a12;--bad:#c2402a;--meter:#1b5f80;
--display:"Archivo",system-ui,sans-serif;--body:"Archivo",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace;--r-s:3px}
html,body{font-stretch:100%}
h1,h2,h3{font-stretch:118%;font-weight:700;letter-spacing:-.005em}
header{background:#10283a;border:0;color:#fff;padding:10px 24px}
header::after{height:0}
.brand{display:flex;align-items:baseline;gap:14px}
.brand h1{color:#fff;font-size:21px;font-stretch:125%;text-transform:uppercase;letter-spacing:.06em;font-weight:800}
.brand h1 span{color:#8fd0e6}
.brand::after{content:"40°45′S · 71°39′O";font:500 11px var(--mono);color:#8fa9b8;letter-spacing:.04em}
nav,.opsw{background:transparent;border:1px solid #2f4a5c;border-radius:3px;height:38px;padding:2px}
nav a,.opsw button{border-radius:2px;color:#b9cbd6;font-size:13px;font-stretch:112%;text-transform:uppercase;letter-spacing:.06em}
nav a[aria-current="page"],.opsw button[aria-pressed="true"]{background:#fff;color:#10283a}
.pmax input{background:#173449;border:1px solid #2f4a5c;color:#fff;border-radius:3px;height:38px}
.pmax input::placeholder{color:#8fa9b8}
.presets button{background:transparent;border-color:#2f4a5c;color:#b9cbd6}
.presets button[aria-pressed="true"]{background:#d9542f;border-color:#d9542f;color:#fff}
.kpis{gap:0;border:1px solid var(--line);background:var(--deep);border-radius:3px}
.kpi{border:0;border-right:1px solid var(--line);border-radius:0;background:transparent}
.kpi:last-child{border-right:0}
.kpi small{font-stretch:112%;letter-spacing:.1em;font-size:11px}
.kpi em{color:var(--mute)}
.mapbox,.panel,.card,.tablewrap,.nlist li,.hc{border-radius:3px}
.mapbox{border-color:#b9c4c6}
.chip{border-radius:2px;background:#fff;font-stretch:110%;text-transform:uppercase;letter-spacing:.05em;font-size:11.5px;font-weight:600}
.chip[aria-pressed="true"]{background:#10283a;border-color:#10283a;color:#fff}
.zoom button{border-radius:2px;background:#fff}
.legend{background:rgba(255,255,255,.95)}
.panel h2{font-size:24px}
.eyebrow{font-stretch:115%;letter-spacing:.12em;color:#d9542f;font-weight:600}
.mini li a{background:transparent;border-bottom:1px solid var(--line);border-radius:0;padding:9px 6px}
.mini li a:hover{background:var(--raise)}
.backbtn{border-radius:2px;background:#fff}
.field input,.field select{border-radius:3px;background:#fff}
.field{font-stretch:110%;text-transform:uppercase;letter-spacing:.07em;font-size:11px;font-weight:600}
th{font-stretch:112%;background:#f6f8f7}
.tag{border-radius:2px}
.tag.new{background:#d9542f;color:#fff}
.pulse div.risk{border-color:#d9542f}
.btn,.pager button{border-radius:2px}
.pager button[aria-current="page"]{background:#10283a;border-color:#10283a}
.star[aria-pressed="true"]{color:#d9542f}
.hc-l a,.hc-l button{border-radius:2px!important}
@media (max-width:720px){header{padding:10px 14px}.brand::after{display:none}
 nav{background:#10283a;border-top:0}nav a{color:#8fa9b8}nav a[aria-current="page"]{background:rgba(255,255,255,.1);color:#fff}
 .kpis{border:0;background:transparent}.kpi{border:1px solid var(--line);background:#fff;border-radius:3px}
 .maptools{background:#fff}.fbtn{border-radius:3px}}
""")
T["bosque"]=dict(fonts="family=Instrument+Serif:ital@0;1&family=Geist:wght@400..700&family=Geist+Mono:wght@400;500;600",
 theme="#0f1713",
 map=dict(land="#17221d",topo="#1c2822",nod1="#1a2520",nod2="#24322b",lake="#1d3c4b",lakeS="#2e6177",water="#2a5466",road="#33443b",halo="#0f1713",route="#c98a4a",ink="#eef2ea",lblmute="#7f948a",lakelbl="#7fb6c9",routelbl="#d6a06a",scale="#8a9c93",nodata="#26332d"),
 ramp='["#2a7f86","#46a08b","#93c46e","#e6c65c","#eb8f45","#e2573d"]',
 css="""
:root{--ink:#0f1713;--deep:#151f1a;--raise:#1c2822;--line:#2a3931;--fog:#ecf0e8;--mute:#93a59b;--glacier:#9fd6c6;--arrayan:#e9b44c;--bosque:#8fcf7a;--good:#8fcf7a;--warn:#e9b44c;--bad:#f07a5a;--meter:#e9b44c;
--display:"Instrument Serif",Georgia,serif;--body:"Geist",system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,monospace;color-scheme:dark;--r-s:8px}
a{color:#9fd6c6}
h1,h2,h3{font-weight:400;letter-spacing:0}
header{background:#0f1713;border-bottom:1px solid #22302a}
header::after{height:0}
.brand h1{font-size:34px;font-weight:400;color:#ecf0e8}
.brand h1 span{font-style:italic;color:#e9b44c}
nav,.opsw{background:#151f1a;border-color:#2a3931}
nav a[aria-current="page"]{background:#ecf0e8;color:#0f1713}
.opsw button[aria-pressed="true"]{background:#e9b44c;color:#1a1408}
.pmax input{background:#151f1a;border-color:#2a3931;color:#ecf0e8}
.presets button[aria-pressed="true"]{background:#e9b44c;color:#1a1408;border-color:#e9b44c}
.kpi{background:linear-gradient(180deg,#17221d,#131c18);border-color:#24332c;border-radius:14px}
.kpi b{font-family:var(--display);font-weight:400;font-size:32px;letter-spacing:0}
.kpi small{letter-spacing:.12em;font-size:10.5px}
.kpi em{color:#93a59b}
.mapbox{background:#17221d;border-color:#24332c;border-radius:18px}
.chip{background:rgba(15,23,19,.85);border-color:#2a3931;color:#b9c7bf;backdrop-filter:blur(6px)}
.chip[aria-pressed="true"]{background:#ecf0e8;color:#0f1713;border-color:#ecf0e8}
.zoom button{background:rgba(15,23,19,.85);border-color:#2a3931;color:#ecf0e8}
.legend{background:linear-gradient(0deg,rgba(15,23,19,.96),rgba(15,23,19,.7))}
.maptip{background:rgba(15,23,19,.96);border-color:#2a3931}
.panel{background:#151f1a;border-color:#24332c;border-radius:18px}
.panel h2{font-size:34px;line-height:1.05}
.eyebrow{color:#e9b44c;letter-spacing:.14em;font-size:10.5px}
.stats div,.mini li a{background:#1a2520}
.mini li a:hover{background:#22302a}
.backbtn{background:#1c2822;border-color:#2a3931}
.field input,.field select{background:#151f1a;border-color:#2a3931}
th{background:#151f1a}
tr:hover td{background:#17221d}
.tag{background:#2a3931;color:#dfe6dc}
.tag.new{background:rgba(233,180,76,.18);color:#e9b44c}
.star{color:#3a4b43}.star[aria-pressed="true"]{color:#e9b44c}
.pager button{background:#151f1a}
.pager button[aria-current="page"]{background:#ecf0e8;color:#0f1713;border-color:#ecf0e8}
.hc{background:#151f1a;border-color:#24332c;border-radius:16px}
.hc-p{font-family:var(--display)!important;font-weight:400!important;font-size:26px!important}
.hc-l a{background:#1c2822!important;border-color:#2a3931!important;color:#9fd6c6!important}
.noterow textarea,.hc textarea{background:#0f1713}
.fbtn{background:#ecf0e8;color:#0f1713;border-color:#ecf0e8}
@media (max-width:720px){.brand h1{font-size:30px}nav{background:rgba(15,23,19,.95);border-top-color:#22302a}nav a[aria-current="page"]{background:rgba(233,180,76,.14);color:#e9b44c}.maptools{background:#151f1a;border-color:#24332c}.legend{background:#151f1a}}
""")
T["parque"]=dict(fonts="family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700",
 theme="#4a3426",
 map=dict(land="#f2f0e6",topo="#e8e5d8",nod1="#f4f2ea",nod2="#e1ddcf",lake="#9cc9de",lakeS="#5f9ab8",water="#7fb4cc",road="#d3cdbd",halo="#ffffff",route="#4a3426",ink="#1f1a15",lblmute="#827a6c",lakelbl="#1f5f80",routelbl="#4a3426",scale="#6b655b",nodata="#e3e0d6"),
 ramp='["#1f5a3a","#4d8a4a","#a3bf55","#f2c42c","#e58a2b","#b9401f"]',
 css="""
:root{--ink:#ffffff;--deep:#ffffff;--raise:#f2f1ec;--line:#e0ded6;--fog:#1f1a15;--mute:#6e675c;--glacier:#1f5a3a;--arrayan:#f2c42c;--bosque:#1f5a3a;--good:#1f7a3f;--warn:#b98a00;--bad:#b9401f;--meter:#1f5a3a;
--display:"Barlow Condensed",sans-serif;--body:"Barlow",sans-serif;--mono:"Barlow",sans-serif;--r-s:4px}
.num,.kpi b,.stats b,.hc-p,.pager button,td{font-variant-numeric:tabular-nums}
h1,h2,h3{text-transform:uppercase;letter-spacing:.01em;font-weight:700}
header{background:#4a3426;border:0;padding:10px 24px;box-shadow:inset 0 -4px 0 #f2c42c}
header::after{height:0}
.brand h1{color:#f2c42c;font-size:30px;font-weight:800;letter-spacing:.02em;display:inline-flex;align-items:center;gap:10px}
.brand h1 span{color:#fff}
.brand h1::before{content:"";width:28px;height:22px;background:#f2c42c;clip-path:polygon(0 100%,35% 30%,52% 58%,70% 0,100% 100%)}
nav,.opsw{background:#3a281d;border:0;border-radius:4px}
nav a,.opsw button{font-family:var(--display);text-transform:uppercase;font-size:16px;letter-spacing:.04em;color:#e8d9c8;border-radius:3px;font-weight:600}
nav a[aria-current="page"],.opsw button[aria-pressed="true"]{background:#f2c42c;color:#2b1d13}
.pmax input{background:#fff;border:0;border-radius:4px;font-weight:600}
.presets button{background:#3a281d;border:0;color:#e8d9c8;font-family:var(--display);font-size:15px}
.presets button[aria-pressed="true"]{background:#fff;color:#2b1d13}
.kpi{border:0;border-left:4px solid #1f5a3a;border-radius:0;background:#f6f5f0}
.kpi b{font-family:var(--display);font-size:32px;font-weight:700}
.kpi small{font-family:var(--display);font-size:14px;letter-spacing:.06em;font-weight:600;color:#4a3426}
.kpi em{color:var(--mute)}
.mapbox{border-radius:6px;border:2px solid #4a3426}
.chip{font-family:var(--display);text-transform:uppercase;font-size:14px;letter-spacing:.04em;font-weight:600;border-radius:3px;background:#fff;color:#4a3426;border-color:#d5cfbf}
.chip[aria-pressed="true"]{background:#1f5a3a;border-color:#1f5a3a;color:#fff}
.zoom button{border-radius:3px;background:#fff}
.legend{background:rgba(255,255,255,.95)}
.panel{border-radius:6px;border:1px solid #e0ded6;background:#fff}
.panel h2{font-size:30px}
.eyebrow{font-family:var(--display);font-weight:600;font-size:14px;color:#1f5a3a;letter-spacing:.06em}
.mini li a{background:#f6f5f0;border-radius:3px}
.backbtn{border-radius:3px;background:#f2c42c;border:0;color:#2b1d13;font-weight:600}
.field{font-family:var(--display);text-transform:uppercase;font-size:13px;letter-spacing:.05em;font-weight:600;color:#4a3426}
.field input,.field select{border-radius:4px;border:1.5px solid #d5cfbf}
th{font-family:var(--display);font-size:14px;color:#4a3426;background:#f6f5f0}
.tablewrap,.nlist li,.hc{border-radius:6px}
.tag{border-radius:2px;font-family:var(--body);font-weight:700}
.tag.new{background:#f2c42c;color:#2b1d13}
.pulse div.risk{border-color:#f2c42c}
.star[aria-pressed="true"]{color:#e5a10b}
.pager button[aria-current="page"]{background:#1f5a3a;border-color:#1f5a3a}
.hc{border:1px solid #e0ded6;border-top:4px solid #1f5a3a}
.hc-p{font-family:var(--display)!important;font-size:26px!important;font-weight:700!important}
.hc-l a{background:#1f5a3a!important;color:#fff!important;border:0!important;border-radius:3px!important}
.hc-l button{border-radius:3px!important}
.fbtn{background:#1f5a3a;border-color:#1f5a3a;color:#fff;border-radius:4px}
@media (max-width:720px){header{padding:10px 14px}.brand h1{font-size:28px}
 nav{background:#4a3426;border:0}nav a{color:#e8d9c8}nav a[aria-current="page"]{background:#f2c42c;color:#2b1d13}
 .maptools{background:#fff}}
""")
for name,t in T.items():
    h=SRC.read_text()
    h=h.replace(RAMP0,t["ramp"])
    for hx,k in KEYS.items(): h=re.sub(re.escape(hx),t["map"][k],h,flags=re.I)
    h=re.sub(r'href="https://fonts.googleapis.com/css2\?[^"]+"',f'href="https://fonts.googleapis.com/css2?{t["fonts"]}&display=swap"',h)
    h=h.replace('<meta name="theme-color" content="#1e6a86">',f'<meta name="theme-color" content="{t["theme"]}">')
    h=h.replace("</style>",UXCSS+t["css"]+"</style>",1)
    h=h.replace("</body>","<script>"+UXJS+"</script></body>")
    d=pathlib.Path(__file__).parent/name; d.mkdir(exist_ok=True)
    (d/"index.html").write_text(h)
    for f in ("data","favicon.svg","favicon-32.png","apple-touch-icon.png"):
        l=d/f
        if not l.exists(): os.symlink("../../"+f,l)
print("ok")
