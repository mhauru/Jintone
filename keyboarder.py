import numpy as np
import itertools as itt


base_note = 440
horizontal_scale = 250
primes = [2,3,5,7]
distance_constants = [0,2,3,100]
yshift_constants = [0,
                    horizontal_scale*np.log2(3/2)-130,
                    -horizontal_scale*np.log2(5/4)-110,
                    50]


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
    global svg_notes, svg_pitchlines, max_harm_dist
    harm_dist = harmonic_distance(note)
    rel_harm_dist = 1 - harm_dist/max_harm_dist
    x, y = note_position(note)
    note_line = '<use href="#noteCircle" x="{:f}" y="{:f}" opacity="{:f}"/>\n'.format(x,y, rel_harm_dist)
    pitchline_line = '<use href="#pitchLine" x="{:f}" opacity="{:f}"/>\n'.format(x, rel_harm_dist)
    svg_notes += note_line
    svg_pitchlines += pitchline_line
    return None


def draw_interval(note, step):
    global svg_intervals, max_harm_dist
    harm_dist = harmonic_distance(note)
    rel_harm_dist = 1 - harm_dist/max_harm_dist
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
    svg_line = '<use href="#{}" x="{:f}" y="{:f}" opacity="{:f}"/>\n'.format(stepname, x, y, rel_harm_dist)
    svg_intervals += svg_line
    return None


if __name__ == "__main__":
    max_harm_dist = 6
    max_pitch_dist = 8

    svg_notes = ""
    svg_intervals = ""
    svg_pitchlines = ""

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
            if (harm_dist <= max_harm_dist and
                    (intrvl <= max_pitch_dist
                     and 1/intrvl <= max_pitch_dist)):
                    draw_interval(note, step)
                    if next_note not in notes_drawn:
                        notes_to_draw.add(next_note)
        
    with open("svg_pre.svg-part", "r") as f:
        svg_pre = f.read()
    svg_pre = svg_pre.format(
        horizontal_scale*np.log2(2/1), -yshift_constants[0],
        horizontal_scale*np.log2(1/2), yshift_constants[0],
        horizontal_scale*np.log2(3/2), -yshift_constants[1],
        horizontal_scale*np.log2(2/3), yshift_constants[1],
        horizontal_scale*np.log2(5/4), -yshift_constants[2],
        horizontal_scale*np.log2(4/5), yshift_constants[2]
    )
    svg_post = "\n</svg>"
    svg = svg_pre + svg_pitchlines + svg_intervals + svg_notes + svg_post

    with open("keyboard_generated.svg", "w") as f:
        f.write(svg)

