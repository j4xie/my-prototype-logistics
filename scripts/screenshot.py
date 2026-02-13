"""Helper to take and resize Android emulator screenshots"""
import subprocess, sys, os
from PIL import Image

ADB = "C:/Users/Steve/AppData/Local/Android/Sdk/platform-tools/adb.exe"
SS_DIR = "C:/Users/Steve/my-prototype-logistics/screenshots"

def take(name):
    """Take screenshot, resize to 720x1600, save as {name}.png"""
    raw = os.path.join(SS_DIR, f"{name}-raw.png")
    out = os.path.join(SS_DIR, f"{name}.png")
    subprocess.run([ADB, "exec-out", "screencap", "-p"], stdout=open(raw, "wb"), check=True)
    img = Image.open(raw)
    w, h = img.size
    if h > 1600:
        ratio = 1600 / h
        img = img.resize((int(w * ratio), 1600), Image.LANCZOS)
    img.save(out)
    os.remove(raw)
    print(f"Saved: {name}.png ({img.size[0]}x{img.size[1]})")
    return out

if __name__ == "__main__":
    if len(sys.argv) > 1:
        take(sys.argv[1])
    else:
        take("test")
