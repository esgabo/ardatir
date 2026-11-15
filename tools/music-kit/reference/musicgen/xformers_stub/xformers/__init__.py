"""Stub so `from xformers import ops` imports. audiocraft only calls xformers when its attention backend is
'xformers'; the default 'torch' backend (scaled_dot_product_attention) is what runs here."""
