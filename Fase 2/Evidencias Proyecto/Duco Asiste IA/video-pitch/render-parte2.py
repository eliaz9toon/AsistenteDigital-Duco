"""Part 2: source-verified real demonstrations, edited to fit the narration."""
import json
import subprocess
from pathlib import Path
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "parte2"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
audio_info = json.loads((OUT / "audio-info.json").read_text(encoding="utf-8"))
duration = audio_info["seconds"]
clips = {c["name"]: c for c in json.loads((OUT / "clips.json").read_text(encoding="utf-8"))}
proof = json.loads((OUT / "demostracion.json").read_text(encoding="utf-8"))
assert proof["passed"], "The real demonstration must pass before exporting."
scenes = [
    ("intro", 0, 5.3, 1.00, "center"),
    ("accion", 5.3, 10.85, 1.00, "center"),
    ("solicitud", 10.85, 16.55, 1.00, "center"),
    ("destino", 16.55, 21.75, 1.00, "center"),
    ("evidencia1", 21.75, 25.9, 1.00, "center"),
    ("fuente", 25.9, 29.75, 1.04, "top"),
    ("menus", 29.75, 32.25, 1.10, "top"),
    ("pestana", 32.25, 33.75, 1.02, "center"),
    ("scroll", 33.75, 36.85, 1.00, "center"),
    ("contexto_antes", 36.85, 40.9, 1.00, "center"),
    ("contexto_despues", 40.9, 45.8, 1.00, "center"),
    ("cierre", 45.8, duration, 1.00, "center"),
]
transition = 0.35

def ass_time(seconds):
    cs = round(seconds * 100)
    return f"{cs // 360000}:{cs // 6000 % 60:02}:{cs // 100 % 60:02}.{cs % 100:02}"

events = []
def text(start, end, value, x, y, size=62, color="FFFFFF", style="Text", layer=10):
    fade_out = 0 if end >= duration else 160
    tags = f"{{\\an7\\move({x+18},{y},{x},{y},0,420)\\fad(200,{fade_out})\\fs{size}\\1c&H{color}&}}"
    events.append(f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{tags}{value}")

text(0, duration, "DUCO ASISTE   /   02", 96, 58, 25, style="Tag", layer=20)
text(5.3, 45.8, "DEMOSTRACI\u00d3N EDITADA", 1515, 58, 19, style="Tag", layer=20)
text(0.2, 5.28, "LA SOLUCI\u00d3N", 100, 233, 28, "D8C5AF", "Label")
text(1.1, 5.28, "No solo responde.", 96, 405, 96, style="Title")
text(2.9, 5.28, "Te ayuda a encontrar el camino.", 100, 585, 48, "D8C5AF")
text(6.1, 10.85, "Act\u00faa sobre la p\u00e1gina.", 96, 888, 68, "21C3FF", "Title")
text(11.2, 16.5, "UNA PETICI\u00d3N, UN DESTINO", 100, 809, 25, "D8C5AF", "Label")
text(13.75, 16.5, "\u00abLl\u00e9vame a Ingenier\u00eda en Inform\u00e1tica\u00bb", 96, 893, 55, style="Title")
text(17.0, 21.7, "La ficha correcta,", 96, 806, 65, style="Title")
text(18.7, 21.7, "sin buscar a ciegas.", 96, 891, 65, "21C3FF", "Title")
text(22.05, 25.85, "EXPLICAR Y MOSTRAR", 100, 809, 25, "D8C5AF", "Label")
text(23.1, 25.85, "Una explicaci\u00f3n con respaldo.", 96, 889, 62, style="Title")
text(26.0, 29.7, "P\u00e1rrafos fuente, a la vista.", 96, 889, 65, "21C3FF", "Title")
text(29.95, 32.25, "Abrir men\u00fas.", 96, 889, 65, "21C3FF", "Title")
text(32.35, 33.75, "Seleccionar pesta\u00f1as.", 96, 889, 61, style="Title")
text(33.95, 36.85, "Llegar a la secci\u00f3n indicada.", 96, 889, 61, "21C3FF", "Title")
text(37.0, 40.85, "LA CONVERSACI\u00d3N CONTIN\u00daA", 100, 809, 25, "D8C5AF", "Label")
text(38.0, 40.85, "El contexto viaja contigo.", 96, 889, 63, style="Title")
text(41.1, 45.8, "Otra p\u00e1gina.", 96, 809, 63, style="Title")
text(42.7, 45.8, "La misma conversaci\u00f3n.", 96, 894, 63, "21C3FF", "Title")
text(46.1, 49.4, "M\u00e1s que instrucciones.", 96, 420, 80, style="Title")
text(49.45, duration, "Orienta.", 96, 342, 100, style="Title")
text(50.8, duration, "Muestra.", 96, 479, 100, "21C3FF", "Title")
text(51.65, duration, "Acompa\u00f1a.", 96, 616, 100, style="Title")
text(52.4, duration, "DENTRO DEL SITIO, PASO A PASO", 100, 831, 24, "D8C5AF", "Label")
events.append(f"Dialogue: 21,{ass_time(0)},{ass_time(duration)},Text,,0,0,0,,{{\\an7\\pos(96,1020)\\p1\\1c&HFFFFFF&\\1a&HCE&}}m 0 0 l 1728 0 1728 3 0 3")
events.append(f"Dialogue: 22,{ass_time(0)},{ass_time(duration)},Text,,0,0,0,,{{\\an7\\pos(96,1020)\\p1\\1c&H21C3FF&\\clip(96,1020,96,1024)\\t(0,{round(duration*1000)},\\clip(96,1020,1824,1024))}}m 0 0 l 1728 0 1728 3 0 3")
styles = (ROOT / "parte1" / "titulos.ass").read_text(encoding="utf-8-sig").split("[Events]")[0]
ass = styles + "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n" + "\n".join(events) + "\n"
(OUT / "titulos.ass").write_text(ass, encoding="utf-8-sig")

command = [FFMPEG, "-hide_banner", "-y", "-filter_complex_threads", "2"]
filters = []
for index, (name, start, end, zoom, anchor) in enumerate(scenes):
    clip = clips[name]
    target = end - start + (transition if index < len(scenes)-1 else 0)
    available = clip["duration"] - 0.10
    assert available > 0.5
    command += ["-ss", str(clip["start"]), "-t", str(available), "-i", clip["file"]]
    width, height = round(1920*zoom/2)*2, round(1080*zoom/2)*2
    y = "0" if anchor == "top" else "(ih-oh)/2"
    filters.append(f"[{index}:v]setpts=(PTS-STARTPTS)*{target/available:.9f},fps=30,scale={width}:{height}:flags=lanczos,crop=1920:1080:(iw-ow)/2:{y},setsar=1,format=yuv420p,settb=AVTB[v{index}]")
last = "v0"
for index in range(1, len(scenes)):
    label = f"cut{index}"
    filters.append(f"[{last}][v{index}]xfade=transition=fade:duration={transition}:offset={scenes[index][1]}[{label}]")
    last = label

overlays = [("final",0,5.45),("lower",5.15,46.1),("final",45.8,duration)]
for n, (name,start,end) in enumerate(overlays, len(scenes)):
    command += ["-loop","1","-framerate","30","-i",str(ROOT/"parte1"/"graphics"/(name+".png"))]
    fade_out = end + 0.1 if end == duration else end - 0.25
    filters.append(f"[{n}:v]format=rgba,fade=t=in:st={start}:d=0.25:alpha=1,fade=t=out:st={fade_out}:d=0.25:alpha=1[graphic{n}]")
    label = f"shade{n}"
    filters.append(f"[{last}][graphic{n}]overlay=0:0:enable='between(t,{start},{end})':shortest=1[{label}]")
    last = label

audio_index = len(scenes) + len(overlays)
command += ["-i", audio_info["source"]]
filters.append(f"[{last}]tpad=stop_mode=clone:stop_duration=0.5,trim=duration={duration},ass=filename=titulos.ass,format=yuv420p[video]")
filters.append(f"[{audio_index}:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[audio]")
command += ["-filter_complex",";".join(filters),"-map","[video]","-map","[audio]",
            "-t",str(duration),"-r","30","-c:v","libx264","-preset","medium","-crf","18",
            "-threads","6","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-ar","48000","-ac","2",
            "-movflags","+faststart","-metadata","title=Duco Asiste - Pitch - Parte 2",
            "-progress","render-progress.txt","-nostats",str(OUT/"Duco_Asiste_Pitch_Parte_2.mp4")]
(OUT / "edicion.json").write_text(json.dumps({"duration":duration,"size":[1920,1080],"fps":30,"codec":"H.264 / AAC",
    "scenes":scenes,"transitionSeconds":transition,"audio":"Original voice with loudness adjustment; mono converted to stereo for consistency with Part 1.",
    "disclosure":"Demostracion editada: waiting times removed and footage retimed. Replies and actual app behavior are not fabricated."},indent=2),encoding="utf-8")
(OUT / "render-command.json").write_text(json.dumps(command,ensure_ascii=False,indent=2),encoding="utf-8")
with (OUT / "render.log").open("w",encoding="utf-8") as log:
    print("Rendering Part 2: 1080p / 30 fps / original narration",flush=True)
    result = subprocess.run(command,cwd=OUT,stdout=log,stderr=subprocess.STDOUT)
    if result.returncode:
        print((OUT/"render.log").read_text(encoding="utf-8")[-7000:])
        raise SystemExit(result.returncode)
print(str(OUT/"Duco_Asiste_Pitch_Parte_2.mp4"),flush=True)
