from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from livekit_api import AccessToken, VideoGrant

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

API_KEY = "API5JKYXvyDCxvN"
API_SECRET = "7XcGx9xagBJK0fgbjT1Z1kxTAkrulZZf24pCvYnYOSa"
ROOM_NAME = "team-room"

app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

@app.get("/token")
def get_token(identity: str):
    grant = VideoGrant(room_join=True, room=ROOM_NAME)
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)
    return {"token": token.to_jwt()}
