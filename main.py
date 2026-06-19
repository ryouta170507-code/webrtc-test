from livekit import AccessToken

API_KEY = "API5JKYXvyDCxvN"
API_SECRET = "7XcGx9xagBJK0fgbjT1Z1kxTAkrulZZf24pCvYnYOSa"
ROOM_NAME = "team-room"

@app.get("/token")
def get_token(identity: str):
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(room_join=True, room=ROOM_NAME)
    return {"token": token.to_jwt()}
