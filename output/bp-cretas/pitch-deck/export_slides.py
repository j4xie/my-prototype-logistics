"""Export PPTX slides to PNG using PowerPoint COM automation."""
import comtypes.client
import os
import time

def export_slides(pptx_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    powerpoint = comtypes.client.CreateObject('PowerPoint.Application')
    powerpoint.Visible = 1
    abs_path = os.path.abspath(pptx_path)
    pres = powerpoint.Presentations.Open(abs_path, WithWindow=False)
    count = 0
    for i, slide in enumerate(pres.Slides, 1):
        out = os.path.abspath(os.path.join(output_dir, f'slide_{i:02d}.png'))
        slide.Export(out, 'PNG', 1920, 1080)
        count = i
    pres.Close()
    powerpoint.Quit()
    print(f'Exported {count} slides to {output_dir}')

base = 'C:/Users/Steve/my-prototype-logistics/output/bp-cretas/pitch-deck'
export_slides(f'{base}/pitch-deck.pptx', f'{base}/review/detailed')
time.sleep(1)
export_slides(f'{base}/pitch-deck-lite.pptx', f'{base}/review/lite')
