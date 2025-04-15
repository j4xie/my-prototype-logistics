#!/bin/bash
git add . && git commit -m "$*" && git push
[ $? -eq 0 ] && echo "完成！" || echo "出错，请检查" 