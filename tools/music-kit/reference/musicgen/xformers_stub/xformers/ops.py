class LowerTriangularMask:  # referenced by audiocraft.modules.transformer
    pass


def memory_efficient_attention(*args, **kwargs):
    raise RuntimeError("xformers is a stub in this image; use audiocraft's 'torch' attention backend")


def unbind(x, dim):
    import torch
    return torch.unbind(x, dim)
