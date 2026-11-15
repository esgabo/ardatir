"""Minimal MusicGen(-melody) HTTP API. One model, loaded once at startup, kept resident; one generation at a time.

GET  /health    -> {"status": "ok"|"loading"|"error", "model", "device"}   (no auth, like VoiceStudio's)
POST /generate  multipart: description, melody (WAV, optional), duration (<=30), seed, top_k=250, cfg_coef=3.0
                -> audio/wav (mono, model sample rate, 32 kHz). Auth: Authorization: Bearer $MUSICGEN_API_KEY.
"""
import io
import logging
import os
import random
import secrets
import threading
import time

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse, Response

MODEL_ID = os.environ.get("MUSICGEN_MODEL", "facebook/musicgen-melody")
API_KEY = os.environ.get("MUSICGEN_API_KEY", "")
MAX_DURATION = 30.0
MAX_MELODY_BYTES = 50 * 1024 * 1024

log = logging.getLogger("musicgen")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")

app = FastAPI(title="musicgen")
state = {"model": None, "status": "loading", "error": None, "device": None}
gen_lock = threading.Lock()


def _device_name() -> str:
    if torch.cuda.is_available():
        return f"cuda ({torch.cuda.get_device_name(0)})"
    return "cpu"


def _load():
    try:
        from audiocraft.models import MusicGen

        t0 = time.time()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = MusicGen.get_pretrained(MODEL_ID, device=device)
        state.update(model=model, status="ok", device=_device_name())
        log.info("loaded %s on %s in %.1f s", MODEL_ID, state["device"], time.time() - t0)
    except Exception as e:  # keep the server up so /health can say why
        log.exception("model load failed")
        state.update(status="error", error=repr(e), device=_device_name())


@app.on_event("startup")
def _startup():
    threading.Thread(target=_load, daemon=True).start()


@app.get("/health")
def health():
    body = {"status": state["status"], "model": MODEL_ID, "device": state["device"] or _device_name()}
    if state["error"]:
        body["error"] = state["error"]
    return JSONResponse(body, status_code=200 if state["status"] == "ok" else 503)


def _check_auth(authorization: str | None):
    if not API_KEY:
        return
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not secrets.compare_digest(token.encode(), API_KEY.encode()):
        raise HTTPException(status_code=401, detail="invalid or missing bearer token")


def _seed_all(seed: int):
    random.seed(seed)
    np.random.seed(seed % (2**32))
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _generate(description, melody, melody_sr, duration, seed, top_k, cfg_coef):
    model = state["model"]
    with gen_lock:
        t0 = time.time()
        model.set_generation_params(use_sampling=True, top_k=top_k, duration=duration, cfg_coef=cfg_coef)
        _seed_all(seed)
        if melody is not None:
            wav = model.generate_with_chroma([description], melody[None], melody_sr)
        else:
            wav = model.generate([description])
        out = wav[0].detach().float().cpu().numpy().T  # [T, C]
        elapsed = time.time() - t0
    buf = io.BytesIO()
    sf.write(buf, out, model.sample_rate, format="WAV", subtype="PCM_16")
    log.info("generated %.1f s (melody=%s, seed=%d, top_k=%d, cfg=%.2f) in %.1f s",
             duration, melody is not None, seed, top_k, cfg_coef, elapsed)
    return buf.getvalue(), elapsed


@app.post("/generate")
async def generate(
    description: str = Form(...),
    duration: float = Form(10.0),
    seed: int = Form(...),
    top_k: int = Form(250),
    cfg_coef: float = Form(3.0),
    melody: UploadFile | None = File(None),
    authorization: str | None = Header(None),
):
    _check_auth(authorization)
    if state["status"] != "ok":
        raise HTTPException(status_code=503, detail=f"model {state['status']}")
    if not (0 < duration <= MAX_DURATION):
        raise HTTPException(status_code=422, detail=f"duration must be in (0, {MAX_DURATION:g}]")
    if top_k < 1:
        raise HTTPException(status_code=422, detail="top_k must be >= 1")

    mel, mel_sr = None, None
    if melody is not None and melody.filename:
        raw = await melody.read()
        if len(raw) > MAX_MELODY_BYTES:
            raise HTTPException(status_code=413, detail="melody too large")
        try:
            data, mel_sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)  # [T, C]
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"melody is not a readable WAV: {e}")
        mono = data.mean(axis=1, keepdims=True).T  # [1, T]
        mel = torch.from_numpy(np.ascontiguousarray(mono)).to(state["model"].device)

    audio, elapsed = await run_in_threadpool(_generate, description, mel, mel_sr, duration, seed, top_k, cfg_coef)
    return Response(content=audio, media_type="audio/wav",
                    headers={"X-Generation-Seconds": f"{elapsed:.2f}", "X-Model": MODEL_ID})
