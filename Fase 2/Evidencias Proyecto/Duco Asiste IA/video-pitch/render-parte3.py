"""Final chapter aligned to the cleaned narration, with an explicit prototype roadmap."""
import json
import subprocess
from pathlib import Path
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "parte3"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
info = json.loads((OUT/"audio-info.json").read_text(encoding="utf-8"))
audio_edit = json.loads((OUT/"edicion-audio.json").read_text(encoding="utf-8"))
duration = info["seconds"] + 1.2
assert info.get("mastered") and not audio_edit["wordRangesRemoved"]
proof = json.loads((OUT/"demostracion.json").read_text(encoding="utf-8"))
assert proof["passed"] and proof["cleanup"]["clean"]

def at(original):
    for r in audio_edit["retainedRanges"]:
        if original < r["sourceStart"]: return r["outputStart"]
        if original <= r["sourceEnd"]: return r["outputStart"] + original-r["sourceStart"]
    return info["seconds"]

def load_clips(part):
    return {c["name"]:c for c in json.loads((ROOT/f"parte{part}"/"clips.json").read_text(encoding="utf-8"))}
c1,c2,c3 = load_clips(1),load_clips(2),load_clips(3)
shots = [
    ("valor",c2["cierre"],0,8.8,"desktop"),
    ("visitante",c2["destino"],8.8,13.5,"desktop"),
    ("institucion",c3["valoraciones"],13.5,20.8,"desktop"),
    ("valoracion",c3["valoracion_guardada"],20.8,24.6,"desktop"),
    ("revision",c3["admin_pendiente"],24.6,28.45,"desktop"),
    ("aprobacion",c3["admin_aprobar"],28.45,29.85,"desktop"),
    ("confirmacion",c3["admin_confirmado"],29.85,31.5,"desktop"),
    ("prototipo",c2["evidencia1"],31.5,40.1,"desktop"),
    ("visitante_sin_instalar",c2["destino"],40.1,45.2,"desktop"),
    ("despliegue_propuesto",c1["busqueda"],45.2,51,"desktop"),
    ("evidencias",c2["fuente"],51,59.4,"desktop"),
    ("siguiente_paso",c3["movil"],59.4,65.65,"mobile"),
    ("experiencia",c3["despedida"],65.65,70.4,"desktop"),
    ("personas",c2["evidencia1"],70.4,75.15,"desktop"),
    ("marca",c3["despedida"],75.15,77.282,"desktop"),
]
scenes = [{"name":name,"clip":clip,"start":at(start),"end":at(end),"layout":layout} for name,clip,start,end,layout in shots]
scenes[-1]["end"] = duration
transition = .35

cases = json.loads((ROOT.parent/"documentacion/Evidencias_Casos_de_Uso_Duco_Asiste_2026-11-05/resultados.json").read_text(encoding="utf-8"))
acceptance = json.loads((ROOT.parent/"tests/evidence/acceptance.json").read_text(encoding="utf-8"))
assert len(cases["cases"])==31 and acceptance["passed"]
suites=len(acceptance["results"])
assert all(r["passed"] for r in acceptance["results"])
(OUT/"evidencia-resumen.json").write_text(json.dumps({"documentedUseCases":31,"automatedSuites":suites,
    "suitesPassed":True,"suiteRunDate":acceptance["date"],"physicalDeviceValidation":"pending",
    "productionDeployment":"proposed, not certified"},indent=2),encoding="utf-8")

def clock(seconds):
    cs=round(seconds*100)
    return f"{cs//360000}:{cs//6000%60:02}:{cs//100%60:02}.{cs%100:02}"
events=[]
def txt(start,end,value,x,y,size=62,color="FFFFFF",style="Text",layer=10,raw=False):
    start,end=(start,end) if raw else (at(start),at(end))
    fade_out=650 if end>=duration-.1 else 160
    tags=f"{{\\an7\\move({x+18},{y},{x},{y},0,420)\\fad(200,{fade_out})\\fs{size}\\1c&H{color}&}}"
    events.append(f"Dialogue: {layer},{clock(start)},{clock(end)},{style},,0,0,0,,{tags}{value}")
def shape(start,end,path,x=0,y=0,color="FFFFFF",alpha="00",layer=5):
    tags=f"{{\\an7\\pos({x},{y})\\p1\\1c&H{color}&\\1a&H{alpha}&\\fad(220,160)}}"
    events.append(f"Dialogue: {layer},{clock(at(start))},{clock(at(end))},Text,,0,0,0,,{tags}{path}")
def box(start,end,x,y,w,h):
    shape(start,end,f"m 0 0 l {w} 0 {w} {h} 0 {h}",x,y,"6F4720","44")
    shape(start,end,f"m 0 0 l {w} 0 {w} 2 0 2",x,y,"21C3FF","00",6)
def arrow(start,end,x,y):
    shape(start,end,"m 0 0 l 60 0 60 -10 80 6 60 22 60 12 0 12",x,y,"21C3FF","00",7)

txt(0,duration,"DUCO ASISTE   /   03",96,58,25,style="Tag",layer=20,raw=True)
txt(13.5,31.5,"DEMOSTRACI\u00d3N EDITADA",1515,58,19,style="Tag",layer=20)
txt(0,8.8,"EL VALOR",100,233,28,"D8C5AF","Label")
txt(.9,8.8,"De una pregunta",96,370,91,style="Title")
txt(4.9,8.8,"a una orientaci\u00f3n \u00fatil.",96,500,83,"21C3FF","Title")
txt(9.1,13.5,"PARA EL VISITANTE",100,809,25,"D8C5AF","Label")
txt(10.3,13.5,"Una interacci\u00f3n m\u00e1s directa.",96,889,65,style="Title")
txt(13.8,20.8,"PARA LA INSTITUCI\u00d3N",100,809,25,"D8C5AF","Label")
txt(15.4,20.8,"Orientar mejor. Escuchar al usuario.",96,889,59,"21C3FF","Title")
txt(21,24.6,"Valoraciones que ayudan a mejorar.",96,889,61,style="Title")
txt(24.8,28.45,"REVISI\u00d3N HUMANA",100,809,25,"D8C5AF","Label")
txt(26,28.45,"Antes de publicar conocimiento.",96,889,63,"21C3FF","Title")
txt(28.6,31.5,"Propuesta revisada y aprobada.",96,889,64,style="Title")

txt(31.8,40.1,"PROTOTIPO ACTUAL",100,230,28,"D8C5AF","Label")
txt(33.4,40.1,"Ollama como herramienta de prueba.",96,351,78,style="Title")
for x in [96,700,1304]:box(34.5,40.1,x,535,520,170)
txt(34.5,40.1,"Sitio web",145,580,47,style="Title")
txt(35.1,40.1,"IA / Ollama",745,580,47,"21C3FF","Title")
txt(36.4,40.1,"Gu\u00eda visual",1348,580,47,style="Title")
arrow(35.0,40.1,610,610);arrow(36.2,40.1,1214,610)
txt(37.2,40.1,"Para demostrar y probar el funcionamiento.",100,814,43,"D8C5AF")
txt(40.3,45.2,"DISE\u00d1O DE LA SOLUCI\u00d3N FINAL",100,241,27,"D8C5AF","Label")
txt(41.2,45.2,"El visitante usa el sitio.",96,390,91,style="Title")
txt(42.1,45.2,"No instala Ollama.",96,530,94,"21C3FF","Title")
txt(45.5,51,"PROPUESTA FINAL / POR DESPLEGAR",100,230,27,"D8C5AF","Label")
txt(46.5,51,"Un servicio integrado al sitio.",96,354,88,style="Title")
for x in [96,700,1304]:box(47.2,51,x,535,520,170)
txt(47.2,51,"Visitante",145,580,44,style="Title")
txt(47.7,51,"Sitio + Duco",745,580,44,"21C3FF","Title")
txt(48.4,51,"Servicio de IA",1348,580,44,style="Title")
arrow(47.6,51,610,610);arrow(48.2,51,1214,610)

txt(51.2,59.4,"DOCUMENTACI\u00d3N Y PRUEBAS DEL PROTOTIPO",100,230,27,"D8C5AF","Label")
box(51.4,59.4,96,370,804,370);box(54.2,59.4,1020,370,804,370)
txt(51.4,59.4,"31",140,398,170,"21C3FF","Title")
txt(52.4,59.4,"casos de uso documentados",145,636,39,style="Title")
txt(54.2,59.4,str(suites),1060,398,170,"21C3FF","Title")
txt(55.7,59.4,"suites automatizadas aprobadas",1065,636,36,style="Title")
txt(57.5,59.4,"Evidencia del prototipo: ejecuci\u00f3n del 5 de noviembre de 2026.",100,830,27,"D8C5AF")

txt(59.6,65.65,"PR\u00d3XIMA ETAPA",100,233,28,"D8C5AF","Label")
txt(60.5,65.65,"Validar en terreno.",96,370,94,style="Title")
txt(62.4,65.65,"Usuarios reales.",100,551,53)
txt(63.7,65.65,"Dispositivos f\u00edsicos.",100,633,53,"21C3FF")
txt(61.7,65.65,"VISTA M\u00d3VIL EMULADA",100,840,23,"D8C5AF","Label")
txt(64,65.65,"Las pruebas f\u00edsicas siguen pendientes.",100,901,28,"D8C5AF")

txt(65.9,70.4,"Una buena experiencia digital",96,352,84,style="Title")
txt(67.7,70.4,"no es solo publicar informaci\u00f3n.",96,489,80,"21C3FF","Title")
txt(70.55,75.15,"Es ayudar a encontrarla.",96,365,94,style="Title")
txt(73,75.15,"Y a comprenderla.",96,510,104,"21C3FF","Title")
txt(at(75.15),duration,"Duco Asiste",96,374,118,style="Title",raw=True)
txt(at(75.9),duration,"Orienta. Muestra. Acompa\u00f1a.",100,558,56,"21C3FF",raw=True)
txt(at(76.4),duration,"ASISTENTE VIRTUAL PARA DUOC UC",100,760,26,"D8C5AF","Label",raw=True)
events.append(f"Dialogue: 21,{clock(0)},{clock(duration)},Text,,0,0,0,,{{\\an7\\pos(96,1020)\\p1\\1c&HFFFFFF&\\1a&HCE&}}m 0 0 l 1728 0 1728 3 0 3")
events.append(f"Dialogue: 22,{clock(0)},{clock(duration)},Text,,0,0,0,,{{\\an7\\pos(96,1020)\\p1\\1c&H21C3FF&\\clip(96,1020,96,1024)\\t(0,{round(duration*1000)},\\clip(96,1020,1824,1024))}}m 0 0 l 1728 0 1728 3 0 3")
styles=(ROOT/"parte1/titulos.ass").read_text(encoding="utf-8-sig").split("[Events]")[0]
(OUT/"titulos.ass").write_text(styles+"[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"+"\n".join(events)+"\n",encoding="utf-8-sig")

command=[FFMPEG,"-hide_banner","-y","-filter_complex_threads","2"]
filters=[]
for index,s in enumerate(scenes):
    clip=s["clip"];available=clip["duration"]-.1;target=s["end"]-s["start"]+(transition if index<len(scenes)-1 else 0)
    command += ["-ss",str(clip["start"]),"-t",str(available),"-i",clip["file"]]
    if s["layout"]=="mobile":
        geometry="scale=430:932:flags=lanczos,pad=1920:1080:1300:74:color=0x04182A,drawbox=x=1290:y=64:w=450:h=952:color=0xAFC5D8@0.5:t=2"
    else:geometry="scale=1920:1080:flags=lanczos"
    filters.append(f"[{index}:v]setpts=(PTS-STARTPTS)*{target/available:.9f},fps=30,{geometry},setsar=1,format=yuv420p,settb=AVTB[v{index}]")
last="v0"
for index in range(1,len(scenes)):
    label=f"cut{index}";filters.append(f"[{last}][v{index}]xfade=transition=fade:duration={transition}:offset={scenes[index]['start']}[{label}]");last=label
overlays=[("final",0,at(8.8)+.2),("lower",at(8.8)-.15,at(31.5)+.15),
    ("question",at(31.5),at(59.4)+.15),("question",at(65.65),duration)]
for n,(name,start,end) in enumerate(overlays,len(scenes)):
    command += ["-loop","1","-framerate","30","-i",str(ROOT/"parte1/graphics"/(name+".png"))]
    fade_out=end+.1 if end==duration else end-.25
    filters.append(f"[{n}:v]format=rgba,fade=t=in:st={start}:d=0.25:alpha=1,fade=t=out:st={fade_out}:d=0.25:alpha=1[g{n}]")
    label=f"shade{n}";filters.append(f"[{last}][g{n}]overlay=0:0:enable='between(t,{start},{end})':shortest=1[{label}]");last=label
logo_index=len(scenes)+len(overlays)
command += ["-loop","1","-framerate","30","-i",str(ROOT.parent/"assets/duco-avatar.png")]
filters.append(f"[{logo_index}:v]scale=370:370:flags=lanczos,format=rgba,fade=t=in:st={at(75.15)}:d=0.35:alpha=1[logo]")
filters.append(f"[{last}][logo]overlay=x=1385:y=331:enable='gte(t,{at(75.15)})':shortest=1[branded]")
audio_index=logo_index+1
command += ["-i",info["source"]]
filters.append(f"[branded]tpad=stop_mode=clone:stop_duration=0.5,trim=duration={duration},ass=filename=titulos.ass,fade=t=out:st={duration-.65}:d=0.65,format=yuv420p[video]")
filters.append(f"[{audio_index}:a]apad=pad_dur=1.2,atrim=duration={duration},afade=t=out:st={duration-.55}:d=0.55,volume=1dB,aresample=48000[audio]")
command += ["-filter_complex",";".join(filters),"-map","[video]","-map","[audio]","-t",str(duration),"-r","30",
    "-c:v","libx264","-preset","medium","-crf","18","-threads","6","-pix_fmt","yuv420p",
    "-c:a","aac","-b:a","192k","-ar","48000","-ac","2","-movflags","+faststart",
    "-metadata","title=Duco Asiste - Pitch - Parte 3 - Cierre","-progress","render-progress.txt","-nostats",str(OUT/"Duco_Asiste_Pitch_Parte_3.mp4")]
(OUT/"edicion.json").write_text(json.dumps({"videoSeconds":duration,"audioEditedSeconds":info["seconds"],"outroHoldSeconds":1.2,
    "size":[1920,1080],"fps":30,"audioMasteredOnce":True,"deliveryGainDb":1,"scenes":[{k:v for k,v in s.items() if k!="clip"} for s in scenes],
    "claims":"Prototype functions, recorded moderation demo with temporary records, planned production deployment, physical validation still pending.",
    "audioEdit":"7 non-word pause cuts, impulse repair and gentle noise reduction; no generated or replaced voice."},indent=2),encoding="utf-8")
(OUT/"render-command.json").write_text(json.dumps(command,ensure_ascii=False,indent=2),encoding="utf-8")
print(f"Rendering final chapter: {duration:.3f}s with cleaned narration",flush=True)
with (OUT/"render.log").open("w",encoding="utf-8") as log:
    r=subprocess.run(command,cwd=OUT,stdout=log,stderr=subprocess.STDOUT)
if r.returncode:
    print((OUT/"render.log").read_text(encoding="utf-8")[-9000:]);raise SystemExit(r.returncode)
print(str(OUT/"Duco_Asiste_Pitch_Parte_3.mp4"),flush=True)
