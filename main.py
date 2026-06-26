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
    try:
        api_mod = importlib.import_module("livekit.api")
    except Exception:
        api_mod = importlib.import_module("livekit")

    AccessToken = getattr(api_mod, "AccessToken", None)
    if AccessToken is None:
        raise ImportError("AccessToken が livekit.api に見つかりません")

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
        AccessToken, GrantClass = resolve_livekit_classes()
    except Exception as e:
        return {"error": "cannot import AccessToken/Grant", "detail": str(e)}

    grant = GrantClass(room_join=True, room=ROOM_NAME)
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)
    return {"token": token.to_jwt()}

@app.get("/debug_livekit")
def debug_livekit():
    import importlib, json
    out = {}
    try:
        mod = importlib.import_module("livekit.api")
        out["module"] = "livekit.api"
    except Exception as e1:
        try:
            mod = importlib.import_module("livekit")
            out["module"] = "livekit"
        except Exception as e2:
            return {"error": "cannot import livekit", "detail": str(e1) + " | " + str(e2)}
    out["attrs"] = sorted([name for name in dir(mod) if not name.startswith("_")])
    # もし AccessToken が別モジュールにあるかも知れないので top-level も確認
    try:
        import livekit
        out["livekit_attrs"] = sorted([n for n in dir(livekit) if not n.startswith("_")])
    except Exception:
        out["livekit_attrs"] = []
    return out

