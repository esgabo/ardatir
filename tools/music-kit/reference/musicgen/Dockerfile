# MusicGen-melody (audiocraft) on the 780M iGPU, its own service beside VoiceStudio.
# Built FROM the VoiceStudio TheRock image only to reuse its layers (TheRock torch 2.8.0+rocm7.12.0 with native
# gfx1103 kernels, demucs, transformers, ...). It runs as a separate container and process; nothing of VoiceStudio's
# is loaded. audiocraft pins torch 2.1 / xformers / av 11, so it goes in with --no-deps; the extra deps are added
# under the same TheRock constraints so pip can't replace the torch stack.
FROM voicestudio:therock712
COPY constraints.txt /tmp/musicgen-constraints.txt
RUN pip install --no-cache-dir -c /tmp/musicgen-constraints.txt "flashy>=0.0.1" "hydra-core>=1.1" hydra_colorlog encodec && \
    pip install --no-cache-dir --no-deps "audiocraft==1.3.0"
# audiocraft imports xformers at module level; on ROCm we use torch SDPA (audiocraft's default 'torch' backend), so a stub is enough
COPY xformers_stub/xformers /opt/musicgen-stubs/xformers
COPY server.py /opt/musicgen/server.py
ENV PYTHONPATH=/opt/musicgen-stubs \
    TORCH_COMPILE_DISABLE=1 \
    HF_HOME=/data/hf \
    TORCH_HOME=/data/torch \
    AUDIOCRAFT_CACHE_DIR=/data/audiocraft \
    PYTHONUNBUFFERED=1
RUN python3 -c "import torch, audiocraft; from audiocraft.models import MusicGen; print(torch.__version__, torch.version.hip, audiocraft.__version__)"
WORKDIR /opt/musicgen
EXPOSE 3910
ENTRYPOINT []
CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "3910", "--workers", "1"]
