from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse  # 👈 これを追加！
from livekit.api import AccessToken

app = FastAPI()

API_KEY = "API5JKYXvyDCxvN"
API_SECRET = "7XcGx9xagBJK0fgbjT1Z1kxTAkrulZZf24pCvYnYOSa"
ROOM_NAME = "team-room"

connected_clients: list[WebSocket] = []

app = FastAPI()

# 👇 ここから3行を追加！
@app.get("/")
def read_index():
    return FileResponse("index.html")
# 👆 ここまでを追加！

API_KEY = "API5JKYXvyDCxvN"
# ...（以下はそのまま）

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
    # 1. 権限をオブジェクトではなく、ただの辞書(dict)として作ります
    grants = {
        "room_join": True,
        "room": ROOM_NAME
    }
    
    # 2. AccessToken を組み立て、作成した辞書をそのまま渡します
    token = (
        AccessToken(API_KEY, API_SECRET)
        .with_identity(identity)
        .with_grants(grants)  # 👈 ここに上の grants を渡すのがポイントです
    )
    
    # 3. トークンを文字列にして返します
    return {"token": token.to_jwt().decode('utf-8')}
