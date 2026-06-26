import os
import importlib
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

API_KEY = os.environ.get("LIVEKIT_API_KEY")
API_SECRET = os.environ.get("LIVEKIT_API_SECRET")
ROOM_NAME = os.environ.get("LIVEKIT_ROOM_NAME", "team-room")

app = FastAPI()
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

def resolve_livekit_classes():
    api_mod = importlib.import_module("livekit.api")
    AccessToken = getattr(api_mod, "AccessToken")
    GrantClass = None
    for name in dir(api_mod):
        if name.lower().endswith("grant"):
            GrantClass = getattr(api_mod, name)
            break
    if GrantClass is None:
        raise ImportError("Grant クラスが livekit.api に見つかりません")
    return AccessToken, GrantClass

@app.get("/token")
def get_token(identity: str):
    if not API_KEY or not API_SECRET:
        return {"error": "LIVEKIT_API_KEY または LIVEKIT_API_SECRET が設定されていません"}
       try:
            api_mod = importlib.import_module("livekit.api")
        except Exception:
    api_mod = importlib.import_module("livekit")

    grant = GrantClass(room_join=True, room=ROOM_NAME)
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)
    return {"token": token.to_jwt()}
