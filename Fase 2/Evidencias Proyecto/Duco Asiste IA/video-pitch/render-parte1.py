"""Compose real website recordings with restrained motion graphics and narration."""
import json
import subprocess
from pathlib import Path
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "parte1"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
audio_info = json.loads((OUT / "audio-info.json").read_text(encoding="utf-8"))
duration = audio_info["seconds"]
clips = {c["name"]: c for c in json.loads((OUT / "clips.json").read_text(encoding="utf-8"))}
scenes = [
    ("inicio", 0, 4.5, 1.04, "center"),
    ("busqueda", 4.5, 13.1, 1.00, "center"),
    ("menus", 13.1, 20.0, 1.13, "top"),
    ("ficha", 20.0, 25.2, 1.04, "center"),
    ("pregunta", 25.2, 33.65, 1.03, "center"),
    ("duco", 33.65, duration, 1.00, "center"),
]
transition = 0.35

def ass_time(seconds):
    cs = round(seconds * 100)
    return f"{cs // 360000}:{cs // 6000 % 60:02}:{cs // 100 % 60:02}.{cs % 100:02}"

events = []
def text(start, end, value, x, y, size=62, color="FFFFFF", style="Text", layer=10):
    fade_out = 0 if end >= duration else 180
    tags = f"{{\\an7\\move({x+18},{y},{x},{y},0,420)\\fad(200,{fade_out})\\fs{size}\\1c&H{color}&}}"
    events.append(f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{tags}{value}")

text(0.0, duration, "DUCO ASISTE   /   01", 96, 58, 25, style="Tag", layer=20)
text(0.15, 4.45, "EL PROBLEMA", 100, 195, 28, "D8C5AF", "Label")
text(0.15, 4.45, "Encontrar informaci\u00f3n", 96, 305, 92, style="Title")
text(1.75, 4.45, "no siempre es encontrar", 100, 433, 63, "E5D7C9")
text(2.85, 4.45, "una respuesta.", 96, 526, 108, "21C3FF", "Title")
text(5.1, 13.15, "\u00bfQu\u00e9 estudiar?", 96, 897, 55, style="Title")
text(10.1, 13.15, "\u00bfD\u00f3nde?", 740, 897, 55, "21C3FF", "Title")
text(11.5, 13.15, "\u00bfQu\u00e9 aprender\u00e9?", 1205, 897, 49, style="Title")
text(13.5, 20.05, "EL RECORRIDO", 100, 809, 25, "D8C5AF", "Label")
text(14.2, 20.05, "Recorrer p\u00e1ginas", 96, 892, 48, style="Title")
text(16.15, 20.05, "Abrir men\u00fas", 740, 892, 48, "21C3FF", "Title")
text(17.35, 20.05, "Entender t\u00e9rminos", 1210, 892, 46, style="Title")
text(20.35, 25.25, "La informaci\u00f3n est\u00e1.", 96, 792, 73, style="Title")
text(22.15, 25.25, "Falta un camino m\u00e1s claro.", 96, 891, 66, "21C3FF", "Title")
text(25.5, 33.65, "LA PREGUNTA QUE NOS MOVI\u00d3", 100, 244, 27, "D8C5AF", "Label")
text(27.45, 33.65, "\u00bfY si el sitio", 96, 369, 112, style="Title")
text(28.8, 33.65, "pudiera acompa\u00f1arte?", 96, 511, 112, "21C3FF", "Title")
text(31.3, 33.65, "En vez de navegar a solas.", 100, 729, 48, "E5D7C9")
text(33.85, duration, "Duco Asiste", 96, 416, 114, style="Title")
text(35.6, duration, "Una experiencia m\u00e1s sencilla.", 100, 594, 49)
text(37.4, duration, "Una navegaci\u00f3n guiada.", 100, 669, 49, "21C3FF")
text(38.8, duration, "ASISTENTE VIRTUAL PARA DUOC UC", 100, 830, 24, "D8C5AF", "Label")
events.append(f"Dialogue: 21,{ass_time(0)},{ass_time(duration)},Text,,0,0,0,,{{\\an7\\pos(96,1020)\\p1\\1c&HFFFFFF&\\1a&HCE&}}m 0 0 l 1728 0 1728 3 0 3")
events.append(f"Dialogue: 22,{ass_time(0)},{ass_time(duration)},Text,,0,0,0,,{{\\an7\\pos(96,1020)\\p1\\1c&H21C3FF&\\clip(96,1020,96,1024)\\t(0,{round(duration*1000)},\\clip(96,1020,1824,1024))}}m 0 0 l 1728 0 1728 3 0 3")
ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Text,Bahnschrift,62,&H00FFFFFF,&H00FFFFFF,&H80000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Title,Bahnschrift,92,&H00FFFFFF,&H00FFFFFF,&H80000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Label,Bahnschrift,27,&H00FFFFFF,&H00FFFFFF,&H80000000,&H00000000,-1,0,0,0,100,100,3,0,1,0,0,7,0,0,0,1
Style: Tag,Bahnschrift,25,&H00FFFFFF,&H00FFFFFF,&H00311E07,&H00311E07,-1,0,0,0,100,100,2,0,3,12,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(events) + "\n"
(OUT / "titulos.ass").write_text(ass, encoding="utf-8-sig")

command = [FFMPEG, "-hide_banner", "-y", "-filter_complex_threads", "2"]
filters = []
for index, (name, start, end, zoom, anchor) in enumerate(scenes):
    clip = clips[name]
    target = end - start + (transition if index < len(scenes)-1 else 0)
    available = clip["duration"] - 0.12
    command += ["-ss", str(clip["start"]), "-t", str(available), "-i", clip["file"]]
    width = round(1920*zoom/2)*2
    height = round(1080*zoom/2)*2
    y = "0" if anchor == "top" else "(ih-oh)/2"
    filters.append(f"[{index}:v]setpts=(PTS-STARTPTS)*{target/available:.9f},fps=30,scale={width}:{height}:flags=lanczos,crop=1920:1080:(iw-ow)/2:{y},setsar=1,format=yuv420p,settb=AVTB[v{index}]")
last = "v0"
for index in range(1,len(scenes)):
    label = f"cut{index}"
    filters.append(f"[{last}][v{index}]xfade=transition=fade:duration={transition}:offset={scenes[index][1]}[{label}]")
    last = label

overlays = [("hook",0,4.55),("lower",4.35,25.45),("question",25.2,33.8),("final",33.6,duration)]
for n,(name,start,end) in enumerate(overlays,6):
    command += ["-loop","1","-framerate","30","-i",str(OUT/"graphics"/(name+".png"))]
    overlay_label = f"shade{n}"
    # Timing is absolute so fades also work on the concatenated website shots.
    fade_out = end + 0.1 if name == 'final' else max(start,end-0.25)
    filters.append(f"[{n}:v]format=rgba,fade=t=in:st={start}:d=0.25:alpha=1,fade=t=out:st={fade_out}:d=0.25:alpha=1[graphic{n}]")
    filters.append(f"[{last}][graphic{n}]overlay=0:0:enable='between(t,{start},{end})':shortest=1[{overlay_label}]")
    last = overlay_label

command += ["-i",audio_info["source"]]
filters.append(f"[{last}]ass=filename=titulos.ass,format=yuv420p[video]")
filters.append("[10:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[audio]")
command += ["-filter_complex",";".join(filters),"-map","[video]","-map","[audio]",
            "-t",str(duration),"-r","30","-c:v","libx264","-preset","medium","-crf","18",
            "-threads","6","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-ar","48000",
            "-ac","2","-movflags","+faststart","-metadata","title=Duco Asiste - Pitch - Parte 1",
            "-progress","render-progress.txt","-nostats",str(OUT/"Duco_Asiste_Pitch_Parte_1.mp4")]
(OUT / "edicion.json").write_text(json.dumps({"duration":duration,"size":[1920,1080],"fps":30,
    "codec":"H.264 / AAC","scenes":scenes,"audio":"Narracion original con ajuste de sonoridad; sin musica ni voz sintetica.",
    "transitions":transition,"frames":"Capturas en movimiento del sitio real; titulos y cursor son recursos editoriales."},ensure_ascii=False,indent=2),encoding="utf-8")
(OUT / "render-command.json").write_text(json.dumps(command,ensure_ascii=False,indent=2),encoding="utf-8")
with (OUT / "render.log").open("w",encoding="utf-8") as log:
    print("Rendering 1080p / 30 fps / original narration",flush=True)
    result = subprocess.run(command,cwd=OUT,stdout=log,stderr=subprocess.STDOUT)
    if result.returncode:
        print((OUT/"render.log").read_text(encoding="utf-8")[-7000:])
        raise SystemExit(result.returncode)
print(str(OUT/"Duco_Asiste_Pitch_Parte_1.mp4"),flush=True)
