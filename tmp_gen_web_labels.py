"""
Generate YOLO labels for 60 web images using weak supervision:
- Class from folder name
- BBox = center 0.85x0.85 (covers typical central stock photo composition)

This is "weak but useful" for training data augmentation. Model learns
there's an object of the class "somewhere in the middle of the image".
"""
import os
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SRC = r"C:\Users\Steve\my-prototype-logistics\web_test_images"
CLASS_MAP = {
    "insect": 0, "color_anomaly": 1, "bone": 2,
    "glass": 3, "hair": 4, "mold": 5,
}

# Weak bbox: centered, 85% of image
YOLO_LABEL = "0.5 0.5 0.85 0.85"

count = 0
for cls_name, cls_id in CLASS_MAP.items():
    cls_dir = os.path.join(SRC, cls_name)
    if not os.path.isdir(cls_dir): continue
    for fn in sorted(os.listdir(cls_dir)):
        if not fn.endswith('.jpg'): continue
        stem = os.path.splitext(fn)[0]
        lbl_path = os.path.join(cls_dir, stem + '.txt')
        with open(lbl_path, 'w') as f:
            f.write(f"{cls_id} {YOLO_LABEL}\n")
        count += 1

print(f"Generated {count} weak labels in {SRC}/<class>/<file>.txt")
print(f"Each label: class_id + center bbox 0.85x0.85")
