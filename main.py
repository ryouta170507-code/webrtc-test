from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles  
from livekit_api import AccessToken, VideoGrant

app = FastAPI()

API_KEY = "API5JKYXvyDCxvN"
API_SECRET = "7XcGx9xagBJK0fgbjT1Z1kxTAkrulZZf24pCvYnYOSa"
ROOM_NAME = "team-room"

# 静的ファイル
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

connected_clients: list[WebSocket] = []

@app.websocket("/ws/signal")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"【ログ】新しいクライアントが接続しました。現在の接続数: {len(connected_clients)}")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"【ログ】受信したデータ: {data}")

            for client in connected_clients:
                if client != websocket:
                    await client.send_text(data)

    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        print(f"【ログ】クライアントが切断しました。現在の接続数: {len(connected_clients)}")


@app.get("/token")
def get_token(identity: str):
    grant = VideoGrant(room_join=True, room=ROOM_NAME)

    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)

    return {"token": token.to_jwt()}
