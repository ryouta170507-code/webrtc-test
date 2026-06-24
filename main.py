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

# main.py に一時追加する /debug3
import sys, os, importlib, importlib.util
from fastapi import FastAPI

app = FastAPI()

@app.get("/debug3")
def debug3():
    sp = [p for p in sys.path if 'site-packages' in p]
    sample = {}
    for p in sp[:3]:
        try:
            names = sorted(os.listdir(p))
            # livekit に関するファイル/フォルダだけ抽出
            livekit_related = [n for n in names if n.lower().startswith('livekit')]
            sample[p] = {"count": len(names), "livekit_related": livekit_related[:200]}
        except Exception as e:
            sample[p] = {"error": str(e)}
    # 試しに import してみる
    import_results = {}
    for mod in ("livekit_api", "livekit"):
        try:
            m = importlib.import_module(mod)
            import_results[mod] = {
                "imported": True,
                "module_file": getattr(m, "__file__", None),
                "attrs_sample": sorted([a for a in dir(m) if not a.startswith("_")])[:80]
            }
        except Exception as e:
            import_results[mod] = {"imported": False, "error": str(e)}
    # プロジェクトルートに livekit* があるか
    root_files = sorted([f for f in os.listdir('.') if f.lower().startswith('livekit')])
    return {"python": sys.version, "site_packages_livekit_samples": sample, "import_results": import_results, "project_root_livekit_files": root_files}

# 一時追加: /debug4
import importlib.util, os, sys
from fastapi import FastAPI

app = FastAPI()

@app.get("/debug4")
def debug4():
    spec = importlib.util.find_spec("livekit")
    if spec is None:
        return {"error": "livekit spec not found"}
    locations = None
    try:
        locations = list(spec.submodule_search_locations) if spec.submodule_search_locations else None
    except Exception as e:
        locations = f"error getting submodule_search_locations: {e}"

    samples = {}
    if locations:
        for loc in locations:
            try:
                samples[loc] = sorted(os.listdir(loc))
            except Exception as e:
                samples[loc] = f"error listing: {e}"
    else:
        samples["note"] = "no submodule_search_locations (namespace or single-file package)"

    # さらに、試しに common candidate imports and attributes
    import_results = {}
    for candidate in ("livekit", "livekit.access", "livekit.tokens", "livekit.api", "livekit.auth"):
        try:
            m = __import__(candidate, fromlist=["*"])
            import_results[candidate] = {
                "imported": True,
                "file": getattr(m, "__file__", None),
                "attrs_sample": sorted([a for a in dir(m) if not a.startswith("_")])[:200]
            }
        except Exception as e:
            import_results[candidate] = {"imported": False, "error": str(e)}

    return {"python": sys.version, "spec": {"name": spec.name, "origin": getattr(spec, "origin", None)}, "locations": locations, "samples": samples, "import_results": import_results}


API_KEY = "REDACTED"
API_SECRET = "REDACTED"
ROOM_NAME = "team-room"

app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

# main.py の /token 部分をこれに置き換えてください（既存の app 定義と衝突しないように）
@app.get("/token")
def get_token(identity: str):
    # 試しにいくつかの候補パスで import を試す
    import importlib
    candidates = [
        ("livekit_api", ["AccessToken", "VideoGrant"]),
        ("livekit", ["AccessToken", "VideoGrant"]),
        ("livekit.tokens", ["AccessToken", "VideoGrant"]),
        ("livekit.access", ["AccessToken", "VideoGrant"]),
    ]
    imported = None
    last_err = None
    for mod_name, attrs in candidates:
        try:
            mod = importlib.import_module(mod_name)
            # check attributes
            if all(hasattr(mod, a) for a in attrs):
                AccessToken = getattr(mod, "AccessToken")
                VideoGrant = getattr(mod, "VideoGrant")
                imported = (mod_name, "direct")
                break
            # sometimes AccessToken is in a submodule
            for sub in ["tokens", "auth", "access", "api"]:
                try:
                    submod = importlib.import_module(f"{mod_name}.{sub}")
                    if all(hasattr(submod, a) for a in attrs):
                        AccessToken = getattr(submod, "AccessToken")
                        VideoGrant = getattr(submod, "VideoGrant")
                        imported = (f"{mod_name}.{sub}", "sub")
                        break
                except Exception:
                    pass
            if imported:
                break
        except Exception as e:
            last_err = str(e)
    if not imported:
        return {"error": "cannot import AccessToken/VideoGrant", "detail": last_err or "not found in candidates"}

    # ここまで来れば AccessToken と VideoGrant が使える
    grant = VideoGrant(room_join=True, room=ROOM_NAME)
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)
    return {"token": token.to_jwt(), "imported_from": imported}
