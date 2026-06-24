# main.py（抜粋・差し替え案）
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# デバッグで使うモジュール
import sys, pkgutil, importlib.util

app = FastAPI()

@app.get("/debug")
def debug():
    installed = sorted([m.name for m in pkgutil.iter_modules()])
    spec = importlib.util.find_spec("livekit_api")
    spec2 = importlib.util.find_spec("livekit")
    return {
        "python_version": sys.version,
        "sys_path_sample": sys.path[:6],
        "livekit_api_spec": None if spec is None else {"name": spec.name, "origin": getattr(spec, "origin", None)},
        "livekit_spec": None if spec2 is None else {"name": spec2.name, "origin": getattr(spec2, "origin", None)},
        "installed_sample": installed[:80]
    }

# 以下は静的ファイル等の設定
API_KEY = "REDACTED"
API_SECRET = "REDACTED"
ROOM_NAME = "team-room"

app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

# /token は livekit_api を実行時に import（遅延）
@app.get("/token")
def get_token(identity: str):
    try:
        from livekit_api import AccessToken, VideoGrant
    except Exception as e:
        # import に失敗したら原因を返す（デバッグ用。一時的に）
        return {"error": "cannot import livekit_api", "detail": str(e)}
    grant = VideoGrant(room_join=True, room=ROOM_NAME)
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)
    return {"token": token.to_jwt()}
