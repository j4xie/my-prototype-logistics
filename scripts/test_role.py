"""Automated role testing for RN app via ADB"""
import subprocess, sys, os, time, re
from PIL import Image

ADB = "C:/Users/Steve/AppData/Local/Android/Sdk/platform-tools/adb.exe"
SS_DIR = "C:/Users/Steve/my-prototype-logistics/screenshots"

def adb(*args):
    cmd = [ADB] + list(args)
    r = subprocess.run(cmd, capture_output=True, timeout=30)
    return r.stdout.decode('utf-8', errors='replace')

def shell(*args):
    return adb("shell", *args)

def tap(x, y):
    shell("input", "tap", str(x), str(y))

def screenshot(name):
    raw = os.path.join(SS_DIR, f"{name}-raw.png")
    out = os.path.join(SS_DIR, f"{name}.png")
    with open(raw, "wb") as f:
        subprocess.run([ADB, "exec-out", "screencap", "-p"], stdout=f, check=True)
    img = Image.open(raw)
    w, h = img.size
    if h > 1600:
        ratio = 1600 / h
        img = img.resize((int(w * ratio), 1600), Image.LANCZOS)
    img.save(out)
    os.remove(raw)
    print(f"  Screenshot: {name}.png")
    return out

def clear_and_type(text):
    """Clear field and type text using adb"""
    # Select all + delete
    shell("input", "keyevent", "KEYCODE_MOVE_END")
    shell("input", "keyevent", "KEYCODE_MOVE_HOME")
    # Select all with shift
    for _ in range(30):
        shell("input", "keyevent", "67")  # backspace
    time.sleep(0.3)
    shell("input", "text", text)

def get_ui_elements():
    """Dump UI hierarchy and return text elements with bounds"""
    shell("uiautomator", "dump", "/data/local/tmp/ui.xml")
    xml = adb("shell", "cat", "/data/local/tmp/ui.xml")
    elements = []
    for match in re.finditer(r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
        text, x1, y1, x2, y2 = match.group(1), int(match.group(2)), int(match.group(3)), int(match.group(4)), int(match.group(5))
        if text:
            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            elements.append({"text": text, "x": cx, "y": cy, "bounds": (x1, y1, x2, y2)})
    return elements

def find_element(elements, text_pattern):
    """Find element by text (exact or partial match)"""
    for e in elements:
        if text_pattern.lower() in e["text"].lower():
            return e
    return None

def login(username, password, role_prefix):
    """Login with given credentials"""
    print(f"\n=== Logging in as {username} ===")

    # Tap Login button on landing page
    tap(540, 1918)  # Login button
    time.sleep(2)

    # Get UI elements to find input fields
    elements = get_ui_elements()

    # Find username field - look for hint text or EditText
    username_field = find_element(elements, "username") or find_element(elements, "用户名")
    if username_field:
        tap(username_field["x"], username_field["y"])
    else:
        # Default position for username field
        tap(540, 900)
    time.sleep(0.5)

    clear_and_type(username)
    time.sleep(0.5)

    # Find password field
    password_field = find_element(elements, "password") or find_element(elements, "密码")
    if password_field:
        tap(password_field["x"], password_field["y"])
    else:
        tap(540, 1100)
    time.sleep(0.5)

    clear_and_type(password)
    time.sleep(0.5)

    screenshot(f"{role_prefix}-login-filled")

    # Find and tap Login/登录 button
    elements = get_ui_elements()
    login_btn = find_element(elements, "Login") or find_element(elements, "登录")
    if login_btn:
        tap(login_btn["x"], login_btn["y"])
    else:
        tap(540, 1400)

    print("  Waiting for login...")
    time.sleep(5)

    # Check if there's a welcome dialog - dismiss it
    elements = get_ui_elements()
    ok_btn = find_element(elements, "OK") or find_element(elements, "确定")
    if ok_btn:
        tap(ok_btn["x"], ok_btn["y"])
        time.sleep(1)

    screenshot(f"{role_prefix}-home")

def screenshot_tabs(role_prefix, tab_count, tab_names):
    """Screenshot all tabs for a role"""
    print(f"  Capturing {tab_count} tabs...")

    # Tab positions - evenly spaced at bottom
    tab_width = 1080 // tab_count
    tab_y = 2340

    for i in range(tab_count):
        tab_x = tab_width // 2 + tab_width * i
        tap(tab_x, tab_y)
        time.sleep(3)  # Wait for tab to load
        name = tab_names[i] if i < len(tab_names) else f"tab{i+1}"
        screenshot(f"{role_prefix}-{name}")

def logout(role_prefix):
    """Logout from current role"""
    print("  Logging out...")
    # Go to last tab (Profile/我的)
    tap(990, 2340)
    time.sleep(1)

    # Scroll down to find Logout
    shell("input", "swipe", "540", "1800", "540", "800", "500")
    time.sleep(1)

    # Get elements and find Logout
    elements = get_ui_elements()
    logout_btn = find_element(elements, "Logout") or find_element(elements, "退出")
    if logout_btn:
        tap(logout_btn["x"], logout_btn["y"])
        time.sleep(1)
        # Confirm dialog
        elements = get_ui_elements()
        confirm = find_element(elements, "Confirm") or find_element(elements, "确认") or find_element(elements, "OK")
        if confirm:
            tap(confirm["x"], confirm["y"])
    else:
        # Try tapping where Logout usually is
        tap(360, 2100)
        time.sleep(1)
        tap(700, 1300)  # Confirm button

    time.sleep(3)
    screenshot(f"{role_prefix}-loggedout")
    print("  Logged out")

if __name__ == "__main__":
    role = sys.argv[1] if len(sys.argv) > 1 else "test"

    # Role configurations
    ROLES = {
        "ws": {
            "username": "workshop_sup1",
            "password": "123456",
            "prefix": "r5-ws",
            "tabs": 4,
            "tab_names": ["home", "processing", "reports", "profile"]
        },
        "wh": {
            "username": "warehouse_mgr1",
            "password": "123456",
            "prefix": "r5-wh",
            "tabs": 4,
            "tab_names": ["home", "warehouse", "reports", "profile"]
        },
        "hr": {
            "username": "hr_admin1",
            "password": "123456",
            "prefix": "r5-hr",
            "tabs": 4,
            "tab_names": ["home", "hr", "reports", "profile"]
        },
        "qi": {
            "username": "quality_insp1",
            "password": "123456",
            "prefix": "r5-qi",
            "tabs": 4,
            "tab_names": ["home", "quality", "reports", "profile"]
        },
        "ds": {
            "username": "dispatcher1",
            "password": "123456",
            "prefix": "r5-ds",
            "tabs": 5,
            "tab_names": ["home", "dispatch", "ai", "smartbi", "profile"]
        },
    }

    if role in ROLES:
        cfg = ROLES[role]
        login(cfg["username"], cfg["password"], cfg["prefix"])
        screenshot_tabs(cfg["prefix"], cfg["tabs"], cfg["tab_names"])
        logout(cfg["prefix"])
    else:
        print(f"Unknown role: {role}. Available: {list(ROLES.keys())}")
