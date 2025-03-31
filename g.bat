@echo off
git add . && git commit -m "%*" && git push && echo Done! || echo Failed! 