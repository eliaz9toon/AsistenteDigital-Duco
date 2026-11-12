import json
import sys
from pathlib import Path
import av

part = sys.argv[1] if len(sys.argv) > 1 else "1"
if part not in {"1", "2", "3"}:
    raise SystemExit("Expected part 1, 2 or 3")
ROOT = Path(__file__).resolve().parent / ("parte" + part)
audio_info = json.loads((ROOT / "audio-info.json").read_text(encoding="utf-8"))
outro_hold = json.loads((ROOT / "edicion.json").read_text(encoding="utf-8")).get("outroHoldSeconds",0) if part == "3" else 0
expected_duration = audio_info["seconds"] + outro_hold
video = ROOT / f"Duco_Asiste_Pitch_Parte_{part}.mp4"
qa = ROOT / "revision"
qa.mkdir(exist_ok=True)
times_by_part = {
    "1":[0.8,3.4,6.5,11.9,14.5,16.8,18.5,23.8,28.3,30.4,35.8,38.9,40.7,40.9],
    "2":[3.5,8.5,14.5,19.5,24.5,27.5,31.0,33.1,35.5,39.0,44.0,49.0,52.5,53.9],
    "3":[3.0,10.0,17.0,21.5,25.8,28.9,35.0,41.3,46.0,55.6,60.0,66.8,71.2,74.4,76.5],
}
times = times_by_part[part]
with av.open(str(video)) as container:
    stream = container.streams.video[0]
    audio = container.streams.audio[0]
    report = {"file": str(video), "seconds": container.duration / av.time_base,
              "width": stream.width, "height": stream.height, "fps": str(stream.average_rate),
              "videoCodec": stream.codec_context.name, "audioCodec": audio.codec_context.name,
              "sampleRate": audio.codec_context.sample_rate, "channels": audio.codec_context.channels,
              "frames": 0, "samples": []}
    pending = iter(times)
    target = next(pending, None)
    for frame in container.decode(stream):
        report["frames"] += 1
        if target is not None and frame.time >= target:
            file = qa / f"frame-{target:04.1f}.png"
            frame.to_image().save(file)
            report["samples"].append({"target": target, "actual": frame.time, "file": file.name})
            target = next(pending, None)
assert report["width"] == 1920 and report["height"] == 1080
assert report["fps"] == "30"
assert abs(report["seconds"] - expected_duration) < 0.1
assert report["frames"] >= int((expected_duration - 0.05) * 30)
assert len(report["samples"]) == len(times)
with av.open(str(video)) as container:
    report["audioDecodedSeconds"] = sum(f.samples for f in container.decode(audio=0)) / report["sampleRate"]
with av.open(audio_info["source"]) as container:
    rate = container.streams.audio[0].codec_context.sample_rate
    report["sourceAudioDecodedSeconds"] = sum(f.samples for f in container.decode(audio=0)) / rate
report["outroSilenceSeconds"] = outro_hold
assert abs(report["audioDecodedSeconds"] - report["sourceAudioDecodedSeconds"] - outro_hold) < 0.15
report["decodePassed"] = True
(ROOT / "validacion.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report))
