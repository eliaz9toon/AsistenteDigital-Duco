"""Decode and review the edited speech locally, without changing its timing metadata."""
import json
from pathlib import Path
import av
import numpy as np
from faster_whisper import WhisperModel

OUT = Path(__file__).resolve().parent / "parte3"
audio = OUT / "Parte3_Audio_Editado.wav"
chunks = []
with av.open(str(audio)) as container:
    rate = container.streams.audio[0].codec_context.sample_rate
    for frame in container.decode(audio=0):
        chunks.append(frame.to_ndarray().astype(np.float64).reshape(-1))
samples = np.concatenate(chunks) / (2**31)
assert np.isfinite(samples).all()
report = {"seconds":len(samples)/rate,"peakDbfs":float(20*np.log10(np.max(np.abs(samples))+1e-12)),
          "clippedSamples":int(np.count_nonzero(np.abs(samples)>=.99999)),"segments":[]}
assert report["clippedSamples"] == 0
model = WhisperModel("large-v3-turbo",device="cpu",compute_type="int8",cpu_threads=6)
segments,info = model.transcribe(str(audio),language="es",beam_size=5,word_timestamps=True,
    vad_filter=True,initial_prompt="Duco Asiste. Duoc UC. Ollama.")
for s in segments:
    item = {"start":s.start,"end":s.end,"text":s.text.strip(),
        "words":[{"start":w.start,"end":w.end,"word":w.word} for w in (s.words or [])]}
    report["segments"].append(item)
    print(json.dumps({"start":s.start,"end":s.end,"text":s.text.strip()},ensure_ascii=True),flush=True)
report["decodePassed"] = True
(OUT / "revision-audio-editado.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k!="segments"}),flush=True)
