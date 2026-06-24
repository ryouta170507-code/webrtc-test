# 一時追加用 debug2 エンドポイント
import os
import sys
from fastapi import FastAPI

app = FastAPI()

@app.get("/debug2")
def debug2():
    # site-packages の候補パスを列挙して中身を返す（安全のため先頭のみ）
    sp = [p for p in sys.path if 'site-packages' in p]
    sample = {}
    for p in sp[:3]:
        try:
            sample[p] = sorted(os.listdir(p))[:200]
        except Exception as e:
            sample[p] = f"error: {e}"
    # プロジェクトルートの livekit 関連ファイル
    root_files = sorted([f for f in os.listdir('.') if f.lower().startswith('livekit')]) 
    return {"python": sys.version, "site_packages_samples": sample, "project_root_livekit_files": root_files}
