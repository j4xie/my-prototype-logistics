"""
Comprehensive 6-role RN app testing via ADB.
Handles: login, dialog dismissal, tab screenshots, logout via pm clear.
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

def keyevent(code):
    adb('shell', 'input', 'keyevent', code)

def type_text(text):
    """Type text handling underscores"""
    adb('shell', 'input', 'text', text)
    time.sleep(0.3)

def clear_field():
    """Select all and delete text in focused field"""
    # Move to end, then delete all
    adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
    time.sleep(0.1)
    for _ in range(50):
        adb('shell', 'input', 'keyevent', '67')
    time.sleep(0.2)

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
    return out

def ui_dump():
    """Get UI elements {text: (cx, cy)}"""
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

def find_tap(elems, *names):
    for n in names:
        for k, v in elems.items():
            if n.lower() in k.lower():
                tap(v[0], v[1])
                return True
    return False

def fresh_start():
    """Kill app, clear data, relaunch"""
    adb('shell', 'am', 'force-stop', PKG)
    time.sleep(0.5)
    adb('shell', 'pm', 'clear', PKG)
    time.sleep(1)
    adb('shell', 'am', 'start', '-n', f'{PKG}/.MainActivity')
    time.sleep(7)  # Wait for splash + landing

def do_login(username, password, prefix):
    """Login and dismiss welcome dialog. Returns True if successful."""
    print(f'  Logging in as {username}...')

    # Tap Login on landing page
    elems = ui_dump()
    if not find_tap(elems, 'Login'):
        tap(540, 1918)
    time.sleep(2)

    # Enter username
    elems = ui_dump()
    # Tap username field
    for hint in ['Enter username', 'Username', 'username']:
        if hint in elems:
            tap(elems[hint][0], elems[hint][1])
            break
    else:
        tap(350, 430)
    time.sleep(0.5)
    clear_field()
    type_text(username)
    time.sleep(0.3)

    # Enter password - tap password field
    for hint in ['Enter password', 'Password', 'password']:
        if hint in elems:
            tap(elems[hint][0], elems[hint][1])
            break
    else:
        tap(350, 620)
    time.sleep(0.5)
    clear_field()
    type_text(password)
    time.sleep(0.3)

    # Hide keyboard
    keyevent('KEYCODE_BACK')
    time.sleep(0.5)

    # Tap Login button
    elems = ui_dump()
    if not find_tap(elems, 'Login'):
        tap(540, 826)
    time.sleep(6)

    # Dismiss welcome dialog - try multiple times
    for attempt in range(3):
        elems = ui_dump()
        if find_tap(elems, 'OK'):
            print(f'  Dismissed dialog (attempt {attempt+1})')
            time.sleep(2)
            break
        time.sleep(1)

    # Verify we're logged in by checking for tab bar
    screenshot(f'{prefix}-after-login')
    return True

def capture_tabs(prefix):
    """Discover and capture all tabs using UI dump"""
    elems = ui_dump()

    # Find tab labels at bottom of screen (y > 2200)
    tabs = []
    for text, (cx, cy) in elems.items():
        if cy > 2250 and cy < 2400 and len(text) <= 6:
            tabs.append((cx, cy, text))

    tabs.sort(key=lambda t: t[0])  # Sort by x position

    if not tabs:
        print('  WARNING: No tabs found!')
        return []

    print(f'  Found {len(tabs)} tabs: {[t[2] for t in tabs]}')

    results = []
    for i, (tx, ty, tname) in enumerate(tabs):
        # Map Chinese tab names to English filenames
        name_map = {
            '首页': 'home', '主页': 'home', 'Home': 'home',
            '批次': 'batch', '加工': 'processing',
            '人员': 'staff', '员工': 'staff',
            '设备': 'equipment',
            '我的': 'profile', 'Profile': 'profile',
            'AI分析': 'ai', 'AI': 'ai',
            '报表': 'reports',
            '智能分析': 'smartbi', 'SmartBI': 'smartbi',
            '管理': 'manage',
            '调度': 'dispatch',
            '仓库': 'warehouse', '库存': 'warehouse',
            '质检': 'quality',
            '考勤': 'attendance',
        }
        eng_name = name_map.get(tname, f'tab{i+1}')
        fname = f'{prefix}-{eng_name}'

        tap(tx, ty)
        time.sleep(3)
        screenshot(fname)
        results.append((fname, tname))
        print(f'    [{i+1}/{len(tabs)}] {tname} -> {eng_name}')

    return results

def test_role(username, password, prefix):
    """Full test cycle for one role"""
    print(f'\n{"="*60}')
    print(f'  ROLE: {username} (prefix: {prefix})')
    print(f'{"="*60}')

    fresh_start()
    screenshot(f'{prefix}-landing')

    if not do_login(username, password, prefix):
        print('  FAILED: Could not login')
        return None

    results = capture_tabs(prefix)
    print(f'  COMPLETED: {len(results)} tabs captured')
    return results

def main():
    roles = [
        ('warehouse_mgr1', '123456', 'r5-wh'),
        ('hr_admin1', '123456', 'r5-hr'),
        ('quality_insp1', '123456', 'r5-qi'),
        ('dispatcher1', '123456', 'r5-ds'),
    ]

    if len(sys.argv) > 1 and sys.argv[1] == 'single':
        # Test a single role
        role_map = {r[2].split('-')[1]: r for r in roles}
        key = sys.argv[2] if len(sys.argv) > 2 else 'wh'
        if key in role_map:
            test_role(*role_map[key])
        return

    all_results = {}
    for username, password, prefix in roles:
        results = test_role(username, password, prefix)
        all_results[username] = results

    print(f'\n{"="*60}')
    print('  SUMMARY')
    print(f'{"="*60}')
    for user, tabs in all_results.items():
        if tabs:
            tab_names = [t[1] for t in tabs]
            print(f'  {user}: {len(tabs)} tabs - {tab_names}')
        else:
            print(f'  {user}: FAILED')

if __name__ == '__main__':
    main()
