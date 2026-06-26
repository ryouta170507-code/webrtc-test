import os
import importlib
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

API_KEY = os.environ.get("LIVEKIT_API_KEY")
API_SECRET = os.environ.get("LIVEKIT_API_SECRET")
ROOM_NAME = os.environ.get("LIVEKIT_ROOM_NAME", "team-room")

app = FastAPI()

# 静的ファイル
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

# --- LiveKit クラスを動的に探す ---
def resolve_livekit_classes():
    api_mod = importlib.import_module("livekit.api")

    # AccessToken は livekit.api に存在
    AccessToken = getattr(api_mod, "AccessToken")

    # VideoGrant を探す（livekit.api 内の *Grant クラス）
    VideoGrant = None
    for name in dir(api_mod):
        if name.lower().endswith("grant"):
            VideoGrant = getattr(api_mod, name)
            break

    if VideoGrant is None:
        raise ImportError("VideoGrant が livekit.api 内に見つかりません")

    return AccessToken, VideoGrant

# --- Token 発行 ---
@app.get("/token")
def get_token(identity: str):
    if not API_KEY or not API_SECRET:
        return {"error": "LIVEKIT_API_KEY または LIVEKIT_API_SECRET が設定されていません"}

    try:
        AccessToken, VideoGrant = resolve_livekit_classes()
    except Exception as e:
        return {"error": "cannot import AccessToken/VideoGrant", "detail": str(e)}

    grant = VideoGrant(room_join=True, room=ROOM_NAME)
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)

    return {"token": token.to_jwt()}
