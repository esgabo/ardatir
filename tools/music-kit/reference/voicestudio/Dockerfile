# VoiceStudio stable image + AMD TheRock torch with native gfx1103 kernels (no HSA override)
FROM ghcr.io/debpalash/voicestudio:stable
ARG IDX=https://repo.amd.com/rocm/whl/gfx110X-all/
RUN pip uninstall -y torch torchaudio torchvision triton &&     pip install --no-cache-dir --index-url $IDX       "torch==2.8.0+rocm7.12.0" "torchaudio==2.8.0a0+rocm7.12.0" "torchvision==0.23.0a0+rocm7.12.0" &&     python3 -c "import torch,torchaudio,torchvision;print(torch.__version__,torch.version.hip,torchaudio.__version__,torchvision.__version__)"
COPY sitecustomize.py /opt/conda/lib/python3.11/site-packages/sitecustomize.py
# VoxCPM2 engine, in-process (VoiceStudio docs/engines/voxcpm2.md "pip install voxcpm into VoiceStudio Python env").
# The one-click sidecar would install torch 2.11 +cu128/+cpu, which has no gfx1103 path, so it goes in the app env
# on top of the TheRock torch. datasets<4 (via voxcpm) downgrades fsspec 2025.7.0 -> 2025.3.0; pip check is clean.
COPY voxcpm2-constraints.txt /tmp/voxcpm2-constraints.txt
RUN pip install --no-cache-dir -c /tmp/voxcpm2-constraints.txt "voxcpm==2.0.3" && pip check &&     python3 -c "import torch,voxcpm;print(torch.__version__,torch.version.hip,voxcpm.__file__)"
