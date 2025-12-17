with open('小程序/assets/css/desktop.css', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
open_braces = 0
for i, line in enumerate(lines):
    for char in line:
        if char == '{':
            open_braces += 1
        elif char == '}':
            open_braces -= 1
            if open_braces < 0:
                print(f"Error: Unexpected closing brace at line {i+1}")
                exit(1)

if open_braces > 0:
    print(f"Error: Missing {open_braces} closing braces at the end of file")
else:
    print("Syntax check passed: Braces are balanced")
