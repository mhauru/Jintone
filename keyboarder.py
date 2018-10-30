import numpy as np
import itertools as itt


base_note = 440
primes = [2,3,5,7]
distance_constants = [0,2,3,100]
yshift_constants = [0,120,10,50]
horizontal_scale = 250


def interval(note):
    i = 1
    for p, c in zip(primes, note):
        i *= p**c
    return i


def freq(note, base_note=base_note):
    return base_note*interval(note)


def harmonic_distance(note):
    d = 0
    for dc, c in zip(distance_constants, note):
        d += dc*abs(c)
    return d


def note_position(note):
    x = horizontal_scale*np.log2(interval(note))
    y = 0
    for ys, c in zip(yshift_constants, note):
        y += -ys*c
    return x, y
    

def draw_note(note):
    global svg_mid
    x, y = note_position(note)
    svg_line = '<use href="#noteCircle" x="{:f}" y="{:f}"/>\n<use href="#pitchLine" x="{:f}"/>\n'.format(x,y,x)
    svg_mid += svg_line
    return None


def draw_interval(note, step):
    global svg_mid
    x, y = note_position(note)
    if step == (1,0,0,0):
        stepname = "octaveUp"
    elif step == (-1,0,0,0):
        stepname = "octaveDown"
    if step == (-1,1,0,0):
        stepname = "threeUp"
    elif step == (1,-1,0,0):
        stepname = "threeDown"
    if step == (-2,0,1,0):
        stepname = "fiveUp"
    elif step == (2,0,-1,0):
        stepname = "fiveDown"
    svg_line = '<use href="#{}" x="{:f}" y="{:f}"/>\n'.format(stepname, x, y)
    svg_mid += svg_line
    return None


if __name__ == "__main__":
    max_harm_dist = 6
    max_pitch_dist = 8

    svg_mid = ""

    notes_to_draw = {(0,0,0,0)}
    notes_drawn = set()
    while len(notes_to_draw) > 0:
        note = notes_to_draw.pop()
        notes_drawn.add(note)
        draw_note(note)
        for step in ((-1,0,0,0), (1,0,0,0), (1,-1,0,0), (-1,1,0,0), (2,0,-1,0), (-2,0,1,0)):
            next_note = tuple(n + s for n, s in zip(note, step))
            harm_dist = harmonic_distance(next_note)
            intrvl = interval(next_note)
            print()
            print(note)
            print(next_note)
            #print(notes_to_draw)
            #print(notes_drawn)
            print(harm_dist, intrvl)
            if (harm_dist <= max_harm_dist and
                    (intrvl <= max_pitch_dist
                     and 1/intrvl <= max_pitch_dist)):
                    draw_interval(note, step)
                    if next_note not in notes_drawn:
                        notes_to_draw.add(next_note)
        
    svg_pre = """<?xml version="1.0" encoding="UTF-8" standalone="no"?>

<svg
width="1000"
height="500"
viewBox="-500 -250 1000 500"
version="1.1"
id="svg8"
xmlns:dc="http://purl.org/dc/elements/1.1/"
xmlns:cc="http://creativecommons.org/ns#"
xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
xmlns:svg="http://www.w3.org/2000/svg"
xmlns="http://www.w3.org/2000/svg">

<defs>

<circle
id="noteCircle"
style="fill:#ac0006;fill-opacity:1;stroke:none;stroke-width:1.5;stroke-miterlimit:4;stroke-dasharray:none;stroke-dashoffset:0;stroke-opacity:1"
r="10.0" />

<path
style="fill:none;stroke:#c7c7c7;stroke-width:3.0;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:0.5, 0.5;stroke-dashoffset:0;stroke-opacity:1"
d="M 0,-250 V 500"
id="pitchLine"
/>

<path
style="fill:none;stroke:#000000;stroke-width:1.5;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
d="M 0,0 {:f},{:f}"
id="octaveUp"
/>

<path
style="fill:none;stroke:#000000;stroke-width:1.5;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
d="M 0,0 {:f},{:f}"
id="octaveDown"
/>

<path
style="fill:none;stroke:#001bac;stroke-width:1.5;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
d="m 0,0 {:f},{:f}"
id="threeUp"
/>

<path
style="fill:none;stroke:#001bac;stroke-width:1.5;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
d="m 0,0 {:f},{:f}"
id="threeDown"
/>

<path
style="fill:none;stroke:#ac5f00;stroke-width:1.5;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
d="m 0,0 {:f},{:f}"
id="fiveUp"
/>

<path
style="fill:none;stroke:#ac5f00;stroke-width:1.5;stroke-linecap:butt;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"
d="m 0,0 {:f},{:f}"
id="fiveDown"
/>

</defs>
    """.format(horizontal_scale*np.log2(2/1), -yshift_constants[0],
               horizontal_scale*np.log2(1/2), yshift_constants[0],
               horizontal_scale*np.log2(3/2), -yshift_constants[1],
               horizontal_scale*np.log2(2/3), yshift_constants[1],
               horizontal_scale*np.log2(5/4), -yshift_constants[2],
               horizontal_scale*np.log2(4/5), yshift_constants[2])
    svg_post = """
</svg>
    """
    svg = svg_pre + svg_mid + svg_post

    with open("keyboard_generated.svg", "w") as f:
        f.write(svg)
