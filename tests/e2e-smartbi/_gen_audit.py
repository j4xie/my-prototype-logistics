import os

Q = chr(39)
BS = chr(92)
NL = chr(10)
target = os.path.join(os.path.dirname(__file__), 'tests', 'ui-audit.spec.ts')
lines = []

def a(s):
    lines.append(s)

