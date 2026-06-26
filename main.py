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
    import importlib

    # 試すモジュール名の順序
    module_candidates = [
        "livekit.api",
        "livekit.access",
        "livekit",
    ]

    # Grant の候補名（大文字小文字をそのまま試す）
    grant_candidates = [
        "VideoGrant", "VideoGrants", "RoomJoinGrant", "JoinGrant", "Grant"
    ]

    for mod_name in module_candidates:
        try:
            api_mod = importlib.import_module(mod_name)
        except Exception:
            continue

        # AccessToken を探す（モジュール直下、または access サブモジュール）
        AccessToken = getattr(api_mod, "AccessToken", None)
        if AccessToken is None:
            try:
                access_mod = importlib.import_module("livekit.access")
                AccessToken = getattr(access_mod, "AccessToken", None)
            except Exception:
                AccessToken = None

        # Grant 系を自動検出（*grant で終わるものを優先）
        GrantClass = None
        for name in dir(api_mod):
            if name.lower().endswith("grant"):
                GrantClass = getattr(api_mod, name)
                break

        # 候補リストで明示的に探す
        if GrantClass is None:
            for cand in grant_candidates:
                if hasattr(api_mod, cand):
                    GrantClass = getattr(api_mod, cand)
                    break

        if AccessToken and GrantClass:
            return AccessToken, GrantClass

    # 見つからなければ明確なエラーを投げる
    raise ImportError("AccessToken/Grant が見つかりません")

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

