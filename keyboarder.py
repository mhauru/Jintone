import random
import numpy as np
import itertools as itt


base_note = 440
horizontal_scale = 250

primes = (2,3,5,7)
harm_dist_constants = (0,2,3,100)

gen_intervals = ((-1,0,0,0), (1,0,0,0), (1,-1,0,0), (-1,1,0,0), (2,0,-1,0), (-2,0,1,0))
yshift_constants = (0,
                    horizontal_scale*np.log2(3/2)-130,
                    -horizontal_scale*np.log2(5/4)-110,
                    50)
colors = ("#000000", "#001bac", "#ac5f00")

def interval(note):
    i = 1
    for p, c in zip(primes, note):
        i *= p**c
    return i


def freq(note, base_note=base_note):
    return base_note*interval(note)


def harmonic_distance(note):
    d = 0
    for dc, c in zip(harm_dist_constants, note):
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
    rel_harm_dist = max(1 - harm_dist/max_harm_dist, 0)
    x, y = note_position(note)
    note_line = '<use href="#noteCircle" x="{:f}" y="{:f}" opacity="{:f}"/>\n'.format(x,y, rel_harm_dist)
    pitchline_line = '<use href="#pitchLine" x="{:f}" opacity="{:f}"/>\n'.format(x, rel_harm_dist)
    svg_notes += note_line
    svg_pitchlines += pitchline_line
    return None


def draw_interval(note, step):
    global svg_defs, svg_intervals, max_harm_dist
    orig_harm_dist = harmonic_distance(note)
    rel_orig_harm_dist = max(1 - orig_harm_dist/max_harm_dist, 0)
    target = tuple(n + s for n, s in zip(note, step))
    targ_harm_dist = harmonic_distance(target)
    rel_targ_harm_dist = max(1 - targ_harm_dist/max_harm_dist, 0)
    x, y = note_position(note)
    grad_name_in = "linGrad{}".format(random.randint(1,1000000))  # TODO This is awful. I already had collisions.
    grad_name_out = "linGrad{}".format(random.randint(1,1000000))  # TODO This is awful. I already had collisions.
    if step == (2,0,-1,0) or step == (-1,0,0,0) or step == (1,-1,0,0):
        pass
    else:
        if step == (1,0,0,0):
            x_shift = horizontal_scale*np.log2(2/1)
            y_shift = -yshift_constants[0]
            color = colors[0]
        if step == (-1,1,0,0):
            x_shift = horizontal_scale*np.log2(3/2)
            y_shift = -yshift_constants[1]
            color = colors[1]
        if step == (-2,0,1,0):
            x_shift = horizontal_scale*np.log2(5/4)
            y_shift = -yshift_constants[2]
            color = colors[2]
        def_line = """
<linearGradient
    id="{}">
    <stop
    style="stop-color:{};stop-opacity:{:f};"
    offset="0" />
    <stop
    style="stop-color:{};stop-opacity:{:f};"
    offset="1" />
</linearGradient>
<linearGradient
    href="#{}"
    id="{}"
    x1="{:f}"
    y1="{:f}"
    x2="{:f}"
    y2="{:f}"
    gradientUnits="userSpaceOnUse" />
        """.format(grad_name_in, color, rel_orig_harm_dist, color,
                   rel_targ_harm_dist, grad_name_in, grad_name_out, x, y,
                   x+x_shift, y+y_shift)
        svg_line = """
<path
    style="fill:none;stroke:url(#{});
    stroke-width:2.5;
    stroke-linecap:butt;
    stroke-linejoin:miter;
    stroke-miterlimit:4;
    stroke-dasharray:none;
    stroke-opacity:1"
    d="m {:f},{:f} {:f},{:f}"
/>
        """.format(grad_name_out, x, y, x_shift, y_shift)
        svg_defs += def_line
        svg_intervals += svg_line
    return None


if __name__ == "__main__":
    max_harm_dist = 8
    max_pitch_dist = 8

    svg_notes = ""
    svg_intervals = ""
    svg_pitchlines = ""
    svg_defs = "<defs>\n"

    notes_to_draw = {(0,0,0,0)}
    notes_drawn = set()
    while len(notes_to_draw) > 0:
        note = notes_to_draw.pop()
        notes_drawn.add(note)
        draw_note(note)
        for step in gen_intervals:
            # Note that some ghost notes are drawn, to have intervals gradient
            # to nothing.
            draw_interval(note, step)
            next_note = tuple(n + s for n, s in zip(note, step))
            harm_dist = harmonic_distance(next_note)
            intrvl = interval(next_note)
            is_harm_close = harm_dist <= max_harm_dist
            is_pitch_close = (intrvl <= max_pitch_dist
                              and 1/intrvl <= max_pitch_dist)
            if (is_harm_close and is_pitch_close
                    and next_note not in notes_drawn):
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
    svg_defs += "</defs>\n"
    svg = svg_pre + svg_defs + svg_pitchlines + svg_intervals + svg_notes + svg_post

    with open("keyboard_generated.svg", "w") as f:
        f.write(svg)

