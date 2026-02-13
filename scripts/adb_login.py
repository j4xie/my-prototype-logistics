"""
Reliable ADB login + tab screenshot script.
Uses subprocess with shell=False to avoid Git Bash escaping issues.
"""
import subprocess, sys, os, time, re
from PIL import Image

ADB = r"C:\Users\Steve\AppData\Local\Android\Sdk\platform-tools\adb.exe"
SS_DIR = r"C:\Users\Steve\my-prototype-logistics\screenshots"

def adb_cmd(*args):
    """Run ADB command directly (no shell interpretation)"""
    cmd = [ADB] + list(args)
    r = subprocess.run(cmd, capture_output=True, timeout=30)
    return r.stdout.decode('utf-8', errors='replace')

def tap(x, y):
    adb_cmd("shell", "input", "tap", str(x), str(y))

def swipe(x1, y1, x2, y2, ms=300):
    adb_cmd("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(ms))

def keyevent(code):
    adb_cmd("shell", "input", "keyevent", str(code))

def input_text(text):
    """Type text using ADB - handles underscores by using keyevent"""
    # Split text by underscore, type each part, insert underscore via keyevent
    parts = text.split('_')
    for i, part in enumerate(parts):
        if part:
            adb_cmd("shell", "input", "text", part)
        if i < len(parts) - 1:
            # Underscore = shift + minus on some layouts, but keyevent is more reliable
            # KEYCODE_MINUS with SHIFT doesn't work, use special approach
            # Write underscore to a file and use am broadcast
            adb_cmd("shell", "input", "text", "_")
    time.sleep(0.3)

def clear_field():
    """Select all and delete"""
    # Ctrl+A to select all
    adb_cmd("shell", "input", "keyevent", "KEYCODE_MOVE_END")
    time.sleep(0.1)
    # Select all text
    adb_cmd("shell", "input", "keyevent", "--longpress", "KEYCODE_DEL")
    time.sleep(0.2)
    # Triple-tap to select all, then delete
    tap(540, 0)  # dummy
    time.sleep(0.1)
    for _ in range(40):
        adb_cmd("shell", "input", "keyevent", "67")  # KEYCODE_DEL
    time.sleep(0.3)

def screenshot(name):
    """Take screenshot with resize"""
    raw_path = os.path.join(SS_DIR, f"{name}-raw.png")
    out_path = os.path.join(SS_DIR, f"{name}.png")
    with open(raw_path, "wb") as f:
        subprocess.run([ADB, "exec-out", "screencap", "-p"], stdout=f, check=True)
    img = Image.open(raw_path)
    w, h = img.size
    if h > 1600:
        ratio = 1600 / h
        img = img.resize((int(w * ratio), 1600), Image.LANCZOS)
    img.save(out_path)
    os.remove(raw_path)
    return out_path

def get_clickable_texts():
    """Get all text elements with their center positions"""
    adb_cmd("shell", "uiautomator", "dump", "/data/local/tmp/ui.xml")
    xml = adb_cmd("shell", "cat", "/data/local/tmp/ui.xml")
    elements = {}
    for m in re.finditer(r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
        text = m.group(1)
        if text.strip():
            cx = (int(m.group(2)) + int(m.group(4))) // 2
            cy = (int(m.group(3)) + int(m.group(5))) // 2
            elements[text] = (cx, cy)
    return elements

def find_and_tap(elements, *candidates):
    """Find element by text and tap it"""
    for c in candidates:
        for text, (x, y) in elements.items():
            if c.lower() in text.lower():
                tap(x, y)
                return True
    return False

def login_and_test(username, password, prefix, expected_tabs):
    """Full login + screenshot all tabs + logout flow"""
    print(f"\n{'='*50}")
    print(f"Testing: {username} ({prefix})")
    print(f"{'='*50}")

    # Step 1: Tap Login on landing page
    print("  [1] Tapping Login...")
    elements = get_clickable_texts()
    if not find_and_tap(elements, "Login", "登录"):
        tap(540, 1918)
    time.sleep(2)

    # Step 2: Get login form elements
    print("  [2] Entering credentials...")
    elements = get_clickable_texts()

    # Find and tap username field
    for hint in ["Enter username", "Username", "用户名", "请输入用户名"]:
        if hint in elements:
            tap(*elements[hint])
            break
    else:
        # Find the first EditText-like position (typically around y=430)
        tap(350, 430)
    time.sleep(0.5)

    # Clear and type username
    clear_field()
    input_text(username)
    time.sleep(0.5)

    # Find and tap password field
    for hint in ["Enter password", "Password", "密码", "请输入密码"]:
        if hint in elements:
            tap(*elements[hint])
            break
    else:
        tap(350, 620)
    time.sleep(0.5)

    # Clear and type password
    clear_field()
    input_text(password)
    time.sleep(0.5)

    screenshot(f"{prefix}-creds")

    # Step 3: Tap Login button
    print("  [3] Logging in...")
    elements = get_clickable_texts()
    if not find_and_tap(elements, "Login", "登录"):
        tap(540, 826)

    time.sleep(6)

    # Step 4: Dismiss welcome dialog if present
    elements = get_clickable_texts()
    find_and_tap(elements, "OK", "确定", "Got it")
    time.sleep(1)

    # Step 5: Screenshot all tabs
    print(f"  [4] Capturing {len(expected_tabs)} tabs...")
    tab_count = len(expected_tabs)
    tab_width = 1080 // tab_count
    tab_y = 2340

    results = []
    for i, tab_name in enumerate(expected_tabs):
        tab_x = tab_width // 2 + tab_width * i
        tap(tab_x, tab_y)
        time.sleep(3)
        ss_name = f"{prefix}-{tab_name}"
        screenshot(ss_name)
        print(f"    Tab {i+1}/{tab_count}: {tab_name}")
        results.append(ss_name)

    # Step 6: Logout
    print("  [5] Logging out...")
    # Go to last tab (Profile)
    last_tab_x = tab_width // 2 + tab_width * (tab_count - 1)
    tap(last_tab_x, tab_y)
    time.sleep(2)

    # Find Logout button - may need to scroll
    elements = get_clickable_texts()
    if "Logout" in elements or "退出登录" in elements:
        find_and_tap(elements, "Logout", "退出登录")
    else:
        # Scroll down to find it
        swipe(540, 1800, 540, 600, 500)
        time.sleep(1)
        elements = get_clickable_texts()
        find_and_tap(elements, "Logout", "退出登录", "退出")

    time.sleep(1)

    # Confirm logout dialog
    elements = get_clickable_texts()
    find_and_tap(elements, "Confirm", "确认", "OK", "Yes")
    time.sleep(3)

    screenshot(f"{prefix}-done")
    print(f"  DONE: {len(results)} tabs captured")
    return results


def main():
    roles = {
        "ws": ("workshop_sup1", "123456", "r5-ws",
               ["home", "processing", "reports", "profile"]),
        "wh": ("warehouse_mgr1", "123456", "r5-wh",
               ["home", "warehouse", "reports", "profile"]),
        "hr": ("hr_admin1", "123456", "r5-hr",
               ["home", "hr", "reports", "profile"]),
        "qi": ("quality_insp1", "123456", "r5-qi",
               ["home", "quality", "reports", "profile"]),
        "ds": ("dispatcher1", "123456", "r5-ds",
               ["home", "dispatch", "ai", "smartbi", "profile"]),
    }

    if len(sys.argv) < 2:
        print(f"Usage: python adb_login.py <role>")
        print(f"Available roles: {list(roles.keys())}")
        print(f"Or use 'all' to test all roles")
        return

    role_arg = sys.argv[1]

    if role_arg == "all":
        for role_key in roles:
            username, password, prefix, tabs = roles[role_key]
            login_and_test(username, password, prefix, tabs)
    elif role_arg in roles:
        username, password, prefix, tabs = roles[role_arg]
        login_and_test(username, password, prefix, tabs)
    else:
        print(f"Unknown role: {role_arg}")

if __name__ == "__main__":
    main()
