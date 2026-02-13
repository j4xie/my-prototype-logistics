"""
Simple role testing with hardcoded coordinates.
Based on the positions that worked for factory_admin1 login.
Screen: 1080x2400
"""
import subprocess, sys, os, time, re
from PIL import Image

ADB = r'C:\Users\Steve\AppData\Local\Android\Sdk\platform-tools\adb.exe'
SS_DIR = r'C:\Users\Steve\my-prototype-logistics\screenshots'
PKG = 'com.cretas.foodtrace'

def adb(*args):
    r = subprocess.run([ADB] + list(args), capture_output=True, timeout=30)
    return r.stdout.decode('utf-8', errors='replace')

def tap(x, y):
    adb('shell', 'input', 'tap', str(x), str(y))

def type_text(text):
    adb('shell', 'input', 'text', text)
    time.sleep(0.3)

def screenshot(name):
    raw = os.path.join(SS_DIR, f'{name}-raw.png')
    out = os.path.join(SS_DIR, f'{name}.png')
    with open(raw, 'wb') as f:
        subprocess.run([ADB, 'exec-out', 'screencap', '-p'], stdout=f, check=True)
    img = Image.open(raw)
    w, h = img.size
    if h > 1600:
        ratio = 1600 / h
        img = img.resize((int(w * ratio), 1600), Image.LANCZOS)
    img.save(out)
    os.remove(raw)
    print(f'  SS: {name}.png')
    return out

def ui_texts():
    """Get all text elements"""
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/ui.xml')
    xml = adb('shell', 'cat', '/data/local/tmp/ui.xml')
    elems = {}
    for m in re.finditer(r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
        t = m.group(1).strip()
        if t:
            cx = (int(m.group(2)) + int(m.group(4))) // 2
            cy = (int(m.group(3)) + int(m.group(5))) // 2
            elems[t] = (cx, cy)
    return elems

def fresh_start():
    """Force stop, clear, relaunch"""
    print('  Fresh start...')
    adb('shell', 'am', 'force-stop', PKG)
    time.sleep(0.5)
    adb('shell', 'pm', 'clear', PKG)
    time.sleep(1)
    adb('shell', 'am', 'start', '-n', f'{PKG}/.MainActivity')
    # Wait for splash to finish - check periodically
    for i in range(15):
        time.sleep(1)
        elems = ui_texts()
        if 'Login' in elems or 'Register' in elems:
            print(f'  Landing page ready (after {i+1}s)')
            return True
    print('  WARNING: Landing page not detected after 15s')
    return False

def login(username, password, prefix):
    """Login using hardcoded landing page coordinates"""
    print(f'  Login as {username}...')

    # Step 1: Tap Login button on landing page
    # From previous UI dump: Login -> center at ~(540, 1918)
    elems = ui_texts()
    if 'Login' in elems:
        tap(elems['Login'][0], elems['Login'][1])
    else:
        tap(540, 1918)
    time.sleep(2)

    # Step 2: We should now be on login form
    # Get field positions from UI dump
    elems = ui_texts()
    screenshot(f'{prefix}-login-form')

    # Find and tap username input field
    username_pos = None
    for hint in ['Enter username', 'Please enter username']:
        if hint in elems:
            username_pos = elems[hint]
            break

    if username_pos:
        tap(username_pos[0], username_pos[1])
    else:
        # Fallback: tap the first input area
        tap(350, 430)
    time.sleep(0.5)

    # Type username
    type_text(username)
    time.sleep(0.5)

    # Find and tap password field
    password_pos = None
    for hint in ['Enter password', 'Please enter password']:
        if hint in elems:
            password_pos = elems[hint]
            break

    if password_pos:
        tap(password_pos[0], password_pos[1])
    else:
        tap(350, 620)
    time.sleep(0.5)

    # Type password
    type_text(password)
    time.sleep(0.5)

    # Step 3: Hide keyboard, then find and tap Login button
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
    time.sleep(0.5)

    elems = ui_texts()
    login_btn = None
    for text in ['Login', 'Sign In']:
        if text in elems:
            login_btn = elems[text]
            break

    if login_btn:
        tap(login_btn[0], login_btn[1])
    else:
        tap(540, 826)

    print('  Waiting for login response...')
    time.sleep(6)

    # Step 4: Dismiss welcome dialog
    for attempt in range(5):
        elems = ui_texts()
        if 'OK' in elems:
            tap(elems['OK'][0], elems['OK'][1])
            print(f'  Dialog dismissed (attempt {attempt+1})')
            time.sleep(2)
            break
        time.sleep(1)

    # Verify login
    elems = ui_texts()
    # Check if we see any tab-like elements at bottom
    bottom_elems = {k: v for k, v in elems.items() if v[1] > 2200}
    if bottom_elems:
        print(f'  Login SUCCESS - found bottom elements: {list(bottom_elems.keys())[:5]}')
        return True
    else:
        screenshot(f'{prefix}-login-fail')
        print(f'  Login FAILED - no bottom tabs found')
        return False

def capture_tabs(prefix):
    """Capture all tabs by finding bottom bar elements"""
    elems = ui_texts()

    # Find tab bar items (y > 2250, short text)
    tabs = []
    for text, (cx, cy) in elems.items():
        if 2250 < cy < 2400 and len(text) <= 6:
            tabs.append((cx, cy, text))
    tabs.sort(key=lambda t: t[0])

    if not tabs:
        print('  No tabs found! Taking single screenshot.')
        screenshot(f'{prefix}-no-tabs')
        return []

    # English name mapping
    name_map = {
        '首页': 'home', '批次': 'batch', '人员': 'staff', '设备': 'equipment',
        '我的': 'profile', 'AI分析': 'ai', '报表': 'reports',
        '智能分析': 'smartbi', '管理': 'manage', '调度': 'dispatch',
        '仓库': 'warehouse', '质检': 'quality', '考勤': 'attendance',
    }

    print(f'  Found {len(tabs)} tabs: {[t[2] for t in tabs]}')
    results = []

    for i, (tx, ty, tname) in enumerate(tabs):
        eng = name_map.get(tname, tname)
        tap(tx, ty)
        time.sleep(3)
        fname = f'{prefix}-{eng}'
        screenshot(fname)
        results.append((fname, tname, eng))

    return results

def test_one_role(username, password, prefix):
    """Full test for one role"""
    print(f'\n{"="*50}')
    print(f'  TESTING: {username}')
    print(f'{"="*50}')

    if not fresh_start():
        screenshot(f'{prefix}-start-fail')
        return None

    if not login(username, password, prefix):
        return None

    results = capture_tabs(prefix)

    # Scroll home page if on home tab
    if results:
        # Go back to home tab
        tap(results[0][0] if isinstance(results[0][0], int) else 108, 2340)
        time.sleep(1)

    print(f'  DONE: {len(results)} tabs captured for {username}')
    return results

if __name__ == '__main__':
    roles = [
        ('warehouse_mgr1', '123456', 'r5-wh'),
        ('hr_admin1', '123456', 'r5-hr'),
        ('quality_insp1', '123456', 'r5-qi'),
        ('dispatcher1', '123456', 'r5-ds'),
    ]

    if len(sys.argv) > 1:
        # Single role mode
        key = sys.argv[1]
        for u, p, pfx in roles:
            if key in pfx:
                test_one_role(u, p, pfx)
                break
    else:
        all_results = {}
        for u, p, pfx in roles:
            r = test_one_role(u, p, pfx)
            all_results[u] = r

        print(f'\n{"="*50}')
        print('  FINAL SUMMARY')
        print(f'{"="*50}')
        for user, tabs in all_results.items():
            if tabs:
                print(f'  {user}: {len(tabs)} tabs - {[t[2] for t in tabs]}')
            else:
                print(f'  {user}: FAILED')
