from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from livekit import AccessToken, VideoGrant

app = FastAPI()

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
