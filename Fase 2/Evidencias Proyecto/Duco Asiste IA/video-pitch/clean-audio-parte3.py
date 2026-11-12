"""Conservative speech edit: protected words, short crossfades and impulse cleanup."""
import json
import subprocess
from pathlib import Path
import av
import numpy as np
import imageio_ffmpeg
from faster_whisper.audio import decode_audio
from faster_whisper.vad import get_speech_timestamps, VadOptions

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "parte3"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
original_metadata = OUT / "audio-original-info.json"
original_info = json.loads((original_metadata if original_metadata.exists() else OUT / "audio-info.json").read_text(encoding="utf-8"))
source = original_info["source"]
sample_rate = 48000
speech_audio = decode_audio(source)
vad = get_speech_timestamps(speech_audio, VadOptions(threshold=.5, min_speech_duration_ms=120,
    min_silence_duration_ms=200, speech_pad_ms=120))
voice = [(s["start"] / 16000, s["end"] / 16000) for s in vad]
transcript = json.loads((OUT / "transcripcion.json").read_text(encoding="utf-8"))
words = [w for s in transcript["segments"] for w in s["words"] if w["end"] > w["start"]]
protected = [(max(0,w["start"]-.065),w["end"]+.085) for w in words]

def merged(intervals):
    result = []
    for start,end in sorted(intervals):
        if result and start <= result[-1][1]:
            result[-1][1] = max(result[-1][1],end)
        else:
            result.append([start,end])
    return result

def subtract(interval, blocked):
    pieces = [interval]
    for left,right in blocked:
        next_pieces = []
        for start,end in pieces:
            if right <= start or left >= end:
                next_pieces.append((start,end))
            else:
                if start < left: next_pieces.append((start,left))
                if right < end: next_pieces.append((right,end))
        pieces = next_pieces
    return pieces

raw_command = [FFMPEG,"-hide_banner","-loglevel","error","-i",source,"-vn","-ac","1","-ar",str(sample_rate),
    "-af","highpass=f=70,adeclick=w=55:o=80:a=2:t=3.5:b=1.5,afftdn=nr=5:nf=-50:tn=1",
    "-f","f32le","-c:a","pcm_f32le","pipe:1"]
print("Removing low-frequency rumble and reducing impulsive noise",flush=True)
decoded = subprocess.run(raw_command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
audio = np.frombuffer(decoded.stdout,dtype="<f4").copy()
original_duration = len(audio)/sample_rate
first_word = min(w["start"] for w in words)
last_word = max(w["end"] for w in words)
lead = max(0, min(first_word,voice[0][0])-.28)
tail = min(original_duration,max(last_word,voice[-1][1])+.65)
cuts = []
if lead > .15: cuts.append({"start":0,"end":lead,"reason":"Excess lead-in before speech"})
if original_duration-tail > .4: cuts.append({"start":tail,"end":original_duration,"reason":"Trailing pause and incidental mouth noise after the final sentence"})
blocked = merged(protected)
for (_,end),(start,_) in zip(voice,voice[1:]):
    if start-end < .4: continue
    # All cuts lie outside recognized words and the padded voice regions.
    for left,right in subtract((end,start),blocked):
        if right-left < .38: continue
        keep = .30 if right-left < .8 else .42
        remove = right-left-keep
        if remove < .08: continue
        midpoint = (left+right)/2
        cuts.append({"start":midpoint-remove/2,"end":midpoint+remove/2,"reason":"Shortened non-speech pause; protected word boundaries retained"})

# Quiet gaps are attenuated, not hard-muted, to preserve natural room tone.
envelope = np.ones(len(audio),dtype=np.float32)
fade_samples = round(.025*sample_rate)
for (_,end),(start,_) in zip(voice,voice[1:]):
    left,right = round(end*sample_rate),round(start*sample_rate)
    if right-left < 2*fade_samples: continue
    envelope[left:right] = .36
    envelope[left:left+fade_samples] = np.linspace(1,.36,fade_samples)
    envelope[right-fade_samples:right] = np.linspace(.36,1,fade_samples)
audio *= envelope
cuts.sort(key=lambda c:c["start"])
for cut in cuts:
    assert not any(cut["start"] < end and cut["end"] > start for start,end in protected),cut

keeps = []
cursor = 0
for cut in cuts:
    if cut["start"] > cursor: keeps.append((cursor,cut["start"]))
    cursor = max(cursor,cut["end"])
if cursor < original_duration: keeps.append((cursor,original_duration))
crossfade = round(.008*sample_rate)
chunks = []
mapping = []
output_samples = 0
for index,(start,end) in enumerate(keeps):
    piece = audio[round(start*sample_rate):round(end*sample_rate)].copy()
    if not len(piece): continue
    overlap = min(crossfade,len(piece),len(chunks[-1]) if chunks else 0)
    if overlap:
        ramp = np.linspace(0,1,overlap,dtype=np.float32)
        chunks[-1][-overlap:] = chunks[-1][-overlap:]*(1-ramp)+piece[:overlap]*ramp
        piece = piece[overlap:]
    offset = max(0,(output_samples-overlap)/sample_rate)
    mapping.append({"sourceStart":start,"sourceEnd":end,"outputStart":offset,"outputEnd":offset+end-start})
    chunks.append(piece)
    output_samples += len(piece)
edited = np.concatenate(chunks)
edge = min(round(.012*sample_rate),len(edited)//2)
edited[:edge] *= np.linspace(0,1,edge)
edited[-edge:] *= np.linspace(1,0,edge)
intermediate = OUT / "audio-cortes-f32.raw"
edited.astype("<f4").tofile(intermediate)
wav = OUT / "Parte3_Audio_Editado.wav"
master = [FFMPEG,"-hide_banner","-y","-f","f32le","-ar",str(sample_rate),"-ac","1","-i",str(intermediate),
    "-af","loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000","-c:a","pcm_s24le",str(wav)]
result = subprocess.run(master,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
if result.returncode: raise RuntimeError(result.stderr.decode(errors="replace"))
mp3 = OUT / "Parte3_Audio_Editado.mp3"
subprocess.run([FFMPEG,"-hide_banner","-loglevel","error","-y","-i",str(wav),"-c:a","libmp3lame","-b:a","192k",str(mp3)],check=True)
with av.open(str(wav)) as container:
    clean_duration = container.duration/av.time_base
report = {"original":source,"originalDecodedSeconds":original_duration,"originalContainerSeconds":original_info["seconds"],
    "edited":str(wav),"editedSeconds":clean_duration,"secondsRemoved":original_duration-clean_duration,
    "cuts":cuts,"retainedRanges":mapping,"crossfadeMs":8,"protectedWords":len(words),
    "filters":"70Hz high-pass; conservative impulse repair; 5dB spectral noise reduction; soft non-speech attenuation; -16 LUFS normalization",
    "speechSpeedChanged":False,"voiceSynthesized":False,"wordRangesRemoved":False,
    "limitations":"Automatic acoustic and transcription-guided edit. Pronunciation is not reconstructed; ambiguous spoken words are retained."}
(OUT / "edicion-audio.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
(OUT / "audio-original-info.json").write_text(json.dumps(original_info,indent=2),encoding="utf-8")
(OUT / "audio-info.json").write_text(json.dumps({"source":str(wav),"seconds":clean_duration,"sampleRate":48000,"channels":1,
    "originalSource":source,"mastered":True,"ffmpeg":FFMPEG},indent=2),encoding="utf-8")
print(json.dumps({"originalSeconds":original_duration,"editedSeconds":clean_duration,"cuts":len(cuts),"removedSeconds":original_duration-clean_duration,"audio":str(mp3)},ensure_ascii=True),flush=True)
