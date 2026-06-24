from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import sys, pkgutil, importlib.util, os

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

@app.get("/debug2")
def debug2():
    sp = [p for p in sys.path if 'site-packages' in p]
    sample = {}
    for p in sp[:3]:
        try:
            sample[p] = sorted(os.listdir(p))[:200]
        except Exception as e:
            sample[p] = f"error: {e}"
    root_files = sorted([f for f in os.listdir('.') if f.lower().startswith('livekit')])
    return {"python": sys.version, "site_packages_samples": sample, "project_root_livekit_files": root_files}

API_KEY = "REDACTED"
API_SECRET = "REDACTED"
ROOM_NAME = "team-room"

app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

@app.get("/token")
def get_token(identity: str):
    try:
        from livekit_api import AccessToken, VideoGrant
    except Exception as e:
        return {"error": "cannot import livekit_api", "detail": str(e)}
    grant = VideoGrant(room_join=True, room=ROOM_NAME)
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)
    return {"token": token.to_jwt()}
