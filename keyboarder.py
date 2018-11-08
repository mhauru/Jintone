import random
import numpy as np
import itertools as itt

primes = (2,3,5,7,11,13,17,19,23,29)

def subtract_note(note1, note2):
    return tuple(c2 - c1 for c1, c2 in zip(note1, note2))

def neg_note(note):
    return tuple(-c for c in note)

def add_note(note1, note2):
    return tuple(c1 + c2 for c1, c2 in zip(note1, note2))


def pitch_factor(interval):
    i = 1
    for p, c in zip(primes, interval):
        i *= p**c
    return i


class Scale:
    base_notes = ()
    gen_intervals = ()
    harm_dist_steps = {}

    max_harm_norm = 0
    max_pitch_norm = 0

    notes = set()
    steps = set()

    def __init__(self, base_notes, gen_intervals, harm_dist_steps,
                 max_harm_norm, max_pitch_norm):
        self.base_notes = base_notes
        self.gen_intervals = gen_intervals
        self.harm_dist_steps = harm_dist_steps
        self.max_harm_norm = max_harm_norm
        self.max_pitch_norm = max_pitch_norm
        self.gen_scale()

    def harm_dist(self, note1, note2):
        interval = subtract_note(note1, note2)
        d = 0
        for p, c in zip(primes, interval):
            try:
                d += self.harm_dist_steps[p]*abs(c)
            except KeyError:
                if c != 0:
                    d = np.inf
        return d

    def harm_norm(self, note):
        return min(self.harm_dist(base, note) for base in self.base_notes)

    def gen_scale(self):
        notes_to_add = set(self.base_notes)
        while len(notes_to_add) > 0:
            note = notes_to_add.pop()
            self.notes.add(note)
            neg_gens = tuple(map(neg_note, self.gen_intervals))
            all_gens = self.gen_intervals + neg_gens
            for intrvl in all_gens:
                next_note = add_note(note, intrvl)
                if next_note in self.notes:
                    continue
                # Note that, even if a note is outside the max distance, we
                # still add the step to it, to allow drawing step lines that
                # fade to nothing.
                self.steps.add((note, next_note))
                # Figure out whether next_note should be included in this
                # scale.
                hn = self.harm_norm(next_note)
                pf = pitch_factor(next_note)
                is_harm_close = hn <= max_harm_norm
                is_pitch_close = (pf <= max_pitch_norm
                                  and 1/pf <= max_pitch_norm)
                if is_harm_close and is_pitch_close:
                    notes_to_add.add(next_note)


class ScaleFigure:

    stepline_template = """
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
    """
    grad_template = """
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
    """
    note_template = '<use href="#noteCircle" x="{:f}" y="{:f}" opacity="{:f}"/>\n'
    pitchline_template = '<use href="#pitchLine" x="{:f}" opacity="{:f}"/>\n'

    def __init__(self, scale, horizontal_zoom, y_shifts, colors):
        self.scale = scale
        self.horizontal_zoom = horizontal_zoom
        self.y_shifts = y_shifts
        self.colors = colors
        with open("svg_pre.svg-part", "r") as f:
            self.svg_pre = f.read()
        self.svg_defs = ""
        self.svg_steps = ""
        self.svg_notes = ""
        self.svg_pitchlines = ""
        self.svg_post = "\n</svg>"
        self.svg = ""
        self.redraw()

    def note_position(self, note):
        x = self.horizontal_zoom * np.log2(pitch_factor(note))
        y = 0
        for p, c in zip(primes, note):
            try:
                y += -self.y_shifts[p]*c
            except KeyError:
                pass
        return x, y

    def draw_note(self, note):
        hn = self.scale.harm_norm(note)
        rel_hn = max(1 - hn/self.scale.max_harm_norm, 0)
        x, y = self.note_position(note)
        note_line = self.note_template.format(x,y, rel_hn)
        pitchline_line = self.pitchline_template.format(x, rel_hn)
        self.svg_notes += note_line
        self.svg_pitchlines += pitchline_line

    def draw_step(self, step):
        note1, note2 = step
        interval = subtract_note(note2, note1)
        hn1 = self.scale.harm_norm(note1)
        hn2 = self.scale.harm_norm(note2)
        rel_hn1 = max(1 - hn1/self.scale.max_harm_norm, 0)
        rel_hn2 = max(1 - hn2/self.scale.max_harm_norm, 0)
        x1, y1 = self.note_position(note1)
        x2, y2 = self.note_position(note2)
        grad_name_in = "linGrad{}".format(random.randint(1, 1000000))  # TODO This is awful. I already had collisions.
        grad_name_out = "linGrad{}".format(random.randint(1, 1000000))  # TODO This is awful. I already had collisions.
        if interval in self.colors:
            color = self.colors[interval]
        else:
            color = self.colors[neg_note(interval)]
        def_line = self.grad_template.format(
            grad_name_in, color, rel_hn1, color, rel_hn2, grad_name_in,
            grad_name_out, x1, y1, x2, y2
        )
        svg_line = self.stepline_template.format(
            grad_name_out, x1, y1, x2-x1, y2-y1
        )
        self.svg_defs += def_line
        self.svg_intervals += svg_line


    def redraw(self):
        self.svg_notes = ""
        self.svg_intervals = ""
        self.svg_pitchlines = ""
        self.svg_defs = "<defs>\n"
        for note in self.scale.notes:
            self.draw_note(note)
        for step in self.scale.steps:
            self.draw_step(step)
        self.svg_post = "\n</svg>"
        self.svg_defs += "</defs>\n"
        self.svg = (self.svg_pre + self.svg_defs + self.svg_pitchlines +
                    self.svg_intervals + self.svg_notes + self.svg_post)

if __name__ == "__main__":
    max_harm_norm = 8
    max_pitch_norm = 8
    harm_dist_steps = {2:0, 3:2, 5:3}
    base_notes = ((0,0,0,0),)
    gen_intervals = ((1,0,0,0), (-1,1,0,0), (-2,0,1,0))

    horizontal_zoom = 250
    y_shifts = {2:0,
                3:horizontal_zoom*np.log2(3/2)-130,
                5:-horizontal_zoom*np.log2(5/4)-110}
    colors = {(1,0,0,0): "#000000",
              (-1,1,0,0): "#001bac",
              (-2,0,1,0): "#ac5f00"}


    s = Scale(base_notes, gen_intervals, harm_dist_steps, max_harm_norm,
              max_pitch_norm)
    for n in sorted(s.notes):
        print(n)
    print()
    for st in sorted(s.steps):
        print(st)
    sf = ScaleFigure(s, horizontal_zoom, y_shifts, colors)
    
    with open("keyboard_generated.svg", "w") as f:
        f.write(sf.svg)

