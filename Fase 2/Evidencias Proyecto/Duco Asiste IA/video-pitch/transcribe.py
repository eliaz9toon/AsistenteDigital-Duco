"""Local-only transcription for aligning the user's narration with the edit."""
import json
import sys
from pathlib import Path
import av
import imageio_ffmpeg
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent
part = sys.argv[1] if len(sys.argv) > 1 else "1"
if part not in {"1", "2", "3"}:
    raise SystemExit("Expected part 1, 2 or 3")
OUT = ROOT / ("parte" + part)
OUT.mkdir(exist_ok=True)
audio = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(f"C:/Users/elias/Downloads/Parte{part}.mp3")
with av.open(str(audio)) as container:
    stream = container.streams.audio[0]
    metadata = {"source": str(audio), "seconds": container.duration / av.time_base,
                "sampleRate": stream.codec_context.sample_rate, "channels": stream.codec_context.channels,
                "ffmpeg": imageio_ffmpeg.get_ffmpeg_exe()}
(OUT / "audio-info.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
print(json.dumps(metadata), flush=True)
model_name = sys.argv[3] if len(sys.argv) > 3 else "small"
if model_name not in {"small", "medium", "large-v3-turbo"}:
    raise SystemExit("Unsupported local transcription model")
model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=6)
segments, info = model.transcribe(str(audio), language="es", beam_size=5, word_timestamps=True,
                                  vad_filter=True, initial_prompt="Duco Asiste. Duoc UC. Asistente virtual.")
result = {"language": info.language, "duration": info.duration, "segments": []}
for segment in segments:
    item = {"start": segment.start, "end": segment.end, "text": segment.text.strip(),
            "words": [{"start": w.start, "end": w.end, "word": w.word, "probability": w.probability}
                      for w in (segment.words or [])]}
    result["segments"].append(item)
    print(json.dumps(item, ensure_ascii=True), flush=True)
filename = "transcripcion.json" if model_name == "small" else f"transcripcion-{model_name}.json"
(OUT / filename).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
