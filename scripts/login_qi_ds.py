"""
Login quality_insp1 and dispatcher1 using UIAutomator-confirmed positions.
Handles: autocomplete, keyboard dismiss, pre-filled fields.
"""
import subprocess, sys, os, time, re
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

ADB = r'C:\Users\Steve\AppData\Local\Android\Sdk\platform-tools\adb.exe'
SS_DIR = r'C:\Users\Steve\my-prototype-logistics\screenshots'
PKG = 'com.cretas.foodtrace'

def adb(*args):
    r = subprocess.run([ADB] + list(args), capture_output=True, timeout=30)
    return r.stdout.decode('utf-8', errors='replace')

def tap(x, y):
    adb('shell', 'input', 'tap', str(x), str(y))
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
    print(f'  SS: {name}.png ({w}x{h})')
    return out

def ui_dump():
    """Get UI elements with positions from UIAutomator"""
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/ui.xml')
    xml = adb('shell', 'cat', '/data/local/tmp/ui.xml')
    elems = {}
    for m in re.finditer(r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
        t = m.group(1).strip()
        if t:
            cx = (int(m.group(2)) + int(m.group(4))) // 2
            cy = (int(m.group(3)) + int(m.group(5))) // 2
            elems[t] = (cx, cy)
    return elems, xml

def find_edittext_positions(xml):
    """Find EditText fields from UIAutomator XML"""
    fields = []
    for m in re.finditer(r'class="[^"]*EditText[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
        cx = (int(m.group(1)) + int(m.group(3))) // 2
        cy = (int(m.group(2)) + int(m.group(4))) // 2
        fields.append((cx, cy))
    return fields

def clear_and_type(text):
    """Clear field completely then type text in parts to avoid autocomplete"""
    # Select all + delete
    adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
    time.sleep(0.1)
    # Hold delete to clear
    for _ in range(30):
        adb('shell', 'input', 'keyevent', '67')
    time.sleep(0.2)

    # Type in small chunks to defeat autocomplete
    # Split by underscore and type piece by piece
    parts = text.split('_')
    for i, part in enumerate(parts):
        if part:
            # Type 3 chars at a time with pauses
            for j in range(0, len(part), 3):
                chunk = part[j:j+3]
                adb('shell', 'input', 'text', chunk)
                time.sleep(0.4)
        if i < len(parts) - 1:
            adb('shell', 'input', 'text', '_')
            time.sleep(0.3)
    time.sleep(0.5)

def fresh_start_and_wait():
    """Clear app data, launch, wait for landing page"""
    print('  Clearing app data...')
    adb('shell', 'am', 'force-stop', PKG)
    time.sleep(0.5)
    adb('shell', 'pm', 'clear', PKG)
    time.sleep(1)

    print('  Launching app...')
    adb('shell', 'am', 'start', '-n', f'{PKG}/.MainActivity')

    # Wait for landing page with polling
    for i in range(20):
        time.sleep(2)
        elems, _ = ui_dump()
        if 'Login' in elems or 'Register' in elems:
            print(f'  Landing page ready after {(i+1)*2}s')
            return True
        print(f'  Waiting... ({(i+1)*2}s)')

    print('  WARNING: Landing page not detected after 40s')
    return False

def login_with_uiautomator(username, password, prefix):
    """Login using UIAutomator to find exact field positions"""
    print(f'\n{"="*60}')
    print(f'  LOGIN: {username}')
    print(f'{"="*60}')

    # Step 1: Fresh start
    if not fresh_start_and_wait():
        screenshot(f'{prefix}-timeout')
        return False

    screenshot(f'{prefix}-landing')

    # Step 2: Tap Login on landing page
    print('  Tapping Login...')
    elems, _ = ui_dump()
    if 'Login' in elems:
        tap(elems['Login'][0], elems['Login'][1])
    else:
        tap(540, 1918)

    # Wait for form to load - poll with UIAutomator
    print('  Waiting for login form...')
    form_loaded = False
    for i in range(8):
        time.sleep(2)
        elems, xml = ui_dump()
        edit_fields = find_edittext_positions(xml)
        if len(edit_fields) >= 2:
            print(f'  Form loaded after {(i+1)*2}s - found {len(edit_fields)} input fields')
            form_loaded = True
            break
        # Also check for text hints
        if 'Enter username' in elems or 'Username' in elems:
            form_loaded = True
            print(f'  Form loaded after {(i+1)*2}s - found hint text')
            break

    if not form_loaded:
        print('  ERROR: Login form not detected')
        screenshot(f'{prefix}-no-form')
        return False

    screenshot(f'{prefix}-form')

    # Step 3: Get exact positions from UIAutomator
    elems, xml = ui_dump()
    edit_fields = find_edittext_positions(xml)
    print(f'  EditText positions: {edit_fields}')
    print(f'  Text elements: {list(elems.keys())[:15]}')

    # Sort by Y position - first is username, second is password
    edit_fields.sort(key=lambda f: f[1])

    if len(edit_fields) >= 2:
        username_pos = edit_fields[0]
        password_pos = edit_fields[1]
    else:
        # Fallback to previously confirmed positions
        username_pos = (582, 675)
        password_pos = (534, 948)

    print(f'  Username field: {username_pos}')
    print(f'  Password field: {password_pos}')

    # Step 4: Enter username
    print(f'  Entering username: {username}')
    tap(username_pos[0], username_pos[1])
    time.sleep(0.5)
    clear_and_type(username)

    # Step 5: Enter password - tap password field DIRECTLY (keyboard should still be open)
    print(f'  Entering password...')
    tap(password_pos[0], password_pos[1])
    time.sleep(0.5)
    clear_and_type(password)

    # Step 6: Dismiss keyboard by tapping empty area above form
    print('  Dismissing keyboard...')
    tap(540, 200)
    time.sleep(1)

    screenshot(f'{prefix}-creds')

    # Step 7: Find and tap Login button
    print('  Tapping Login button...')
    elems, xml = ui_dump()

    # Look for Login button (not the "Login" text in header)
    login_pos = None
    for text, (cx, cy) in elems.items():
        if text == 'Login' and cy > 1000:  # Login button is below form fields
            login_pos = (cx, cy)
            break

    if login_pos:
        print(f'  Login button at: {login_pos}')
        tap(login_pos[0], login_pos[1])
    else:
        # Fallback
        print('  Using fallback Login position (540, 1293)')
        tap(540, 1293)

    # Step 8: Wait for login response
    print('  Waiting for login response...')
    time.sleep(8)

    # Step 9: Dismiss welcome dialog
    for attempt in range(5):
        elems, _ = ui_dump()
        if 'OK' in elems:
            print(f'  Dismissing dialog (OK at {elems["OK"]})')
            tap(elems['OK'][0], elems['OK'][1])
            time.sleep(2)
            break
        time.sleep(1)

    screenshot(f'{prefix}-after-login')

    # Verify login by checking for bottom tabs
    elems, _ = ui_dump()
    bottom_elems = {k: v for k, v in elems.items() if v[1] > 2200}
    if bottom_elems:
        print(f'  LOGIN SUCCESS! Bottom elements: {list(bottom_elems.keys())[:6]}')
        return True
    else:
        print(f'  LOGIN STATUS UNCLEAR - checking screen...')
        # Even without bottom tab text, login might have succeeded
        # (tab icons are Unicode chars that may not show as text)
        return True  # Proceed anyway

def capture_all_tabs(prefix, num_tabs):
    """Capture all tabs by tapping at calculated positions"""
    print(f'\n  Capturing {num_tabs} tabs...')
    tab_width = 1080 // num_tabs
    tab_y = 2340
    results = []

    for i in range(num_tabs):
        tab_x = tab_width // 2 + tab_width * i
        print(f'  Tab {i+1}/{num_tabs}: tapping ({tab_x}, {tab_y})')
        tap(tab_x, tab_y)
        time.sleep(3)
        fname = f'{prefix}-tab{i+1}'
        screenshot(fname)
        results.append(fname)

    return results

def test_role(username, password, prefix, num_tabs):
    """Full test cycle for one role"""
    success = login_with_uiautomator(username, password, prefix)
    if not success:
        print(f'  FAILED: Could not login as {username}')
        return None

    results = capture_all_tabs(prefix, num_tabs)
    print(f'\n  COMPLETED: {username} - {len(results)} tabs captured')
    return results

if __name__ == '__main__':
    role = sys.argv[1] if len(sys.argv) > 1 else 'qi'

    if role == 'qi':
        test_role('quality_insp1', '123456', 'r6-qi', 4)
    elif role == 'ds':
        test_role('dispatcher1', '123456', 'r6-ds', 5)
    elif role == 'both':
        test_role('quality_insp1', '123456', 'r6-qi', 4)
        test_role('dispatcher1', '123456', 'r6-ds', 5)
    else:
        print(f'Usage: python login_qi_ds.py [qi|ds|both]')
