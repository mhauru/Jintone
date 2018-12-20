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
        style="fill:none;
        stroke:url(#{});
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
    note_template = """
    <circle
        r="{r}"
        cx="{cx:f}"
        cy="{cy:f}"
        style="fill:{color};fill-opacity:{opacity:f}"
    />
    """
    base_note_template = """
    <circle
        r="{r}"
        cx="{cx:f}"
        cy="{cy:f}"
        style="fill:{color};fill-opacity:{opacity:f};
        stroke:{border_color};stroke-width:{border_size}"
    />
    """
    pitchline_template = '<use href="#pitchLine" x="{:f}" opacity="{:f}"/>\n'

    def __init__(self, scale, horizontal_zoom, y_shifts, style):
        self.scale = scale
        self.horizontal_zoom = horizontal_zoom
        self.y_shifts = y_shifts
        self.style = style
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

    def draw_note(self, note, is_base=False):
        hn = self.scale.harm_norm(note)
        rel_hn = max(1 - hn/self.scale.max_harm_norm, 0)
        if not self.style["opacity_harm_norm"] and rel_hn > 0:
            rel_hn = 1
        x, y = self.note_position(note)
        style = self.style
        note_radius = style["note_radius"]
        note_color = style["note_color"]
        if is_base:
            border_color = style["base_note_border_color"]
            border_size = style["base_note_border_size"]
            note_radius += border_size/2
            note_line = self.base_note_template.format(
                cx=x, cy=y, opacity=rel_hn, r=note_radius, color=note_color,
                border_color=border_color, border_size=border_size
            )
        else:
            note_line = self.note_template.format(
                cx=x, cy=y, opacity=rel_hn, r=note_radius, color=note_color
            )
        pitchline_line = self.pitchline_template.format(x, rel_hn)
        self.svg_notes += note_line
        if self.style["draw_pitchlines"]:
            self.svg_pitchlines += pitchline_line

    def draw_step(self, step):
        note1, note2 = step
        interval = subtract_note(note2, note1)
        hn1 = self.scale.harm_norm(note1)
        hn2 = self.scale.harm_norm(note2)
        rel_hn1 = max(1 - hn1/self.scale.max_harm_norm, 0)
        rel_hn2 = max(1 - hn2/self.scale.max_harm_norm, 0)
        if not self.style["opacity_harm_norm"]:
            if rel_hn1 > 0:
                rel_hn1 = 1
            if rel_hn2 > 0:
                rel_hn2 = 1
        x1, y1 = self.note_position(note1)
        x2, y2 = self.note_position(note2)
        # TODO This is awful. I already had collisions.
        grad_name_in = "linGrad{}".format(random.randint(1, 10000000))
        grad_name_out = "linGrad{}".format(random.randint(1, 10000000))
        colors = style["colors"]
        if interval in colors:
            color = colors[interval]
        else:
            color = colors[neg_note(interval)]
        def_line = self.grad_template.format(
            grad_name_in, color, rel_hn1, color, rel_hn2, grad_name_in,
            grad_name_out, x1, y1, x2, y2
        )
        r = self.style["note_radius"]
        step_length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
        x1_edge = x1 - r*(x1-x2)/step_length
        y1_edge = y1 - r*(y1-y2)/step_length
        x2_edge = x2 + r*(x1-x2)/step_length
        y2_edge = y2 + r*(y1-y2)/step_length
        svg_line = self.stepline_template.format(
            grad_name_out, x1_edge, y1_edge, x2_edge-x1_edge, y2_edge-y1_edge
        )
        self.svg_defs += def_line
        self.svg_intervals += svg_line


    def redraw(self):
        self.svg_notes = ""
        self.svg_intervals = ""
        self.svg_pitchlines = ""
        self.svg_defs = "<defs>\n"
        for note in self.scale.notes:
            is_base = note in self.scale.base_notes
            self.draw_note(note, is_base=is_base)
        for step in self.scale.steps:
            self.draw_step(step)
        self.svg_post = "\n</svg>"
        self.svg_defs += "</defs>\n"
        self.svg = (self.svg_pre + self.svg_defs + self.svg_pitchlines +
                    self.svg_intervals + self.svg_notes + self.svg_post)

if __name__ == "__main__":
    max_harm_norm = 8
    max_pitch_norm = 16
    harm_dist_steps = {
        #2:0.0,
        #3:3.0,
        #5:4.0
    }
    harm_dist_steps = {
        2:0.0,
        3:0.2,
        5:4.0
    }
    base_notes = (
        (0,0,0,0),
        #(-1,1,0,0),
        #(-2,0,1,0),
    )
    gen_intervals = (
        (1,0,0,0),
        (-1,1,0,0),
        (-2,0,1,0),
        #(2,-1,0,0),
        #(3,0,-1,0),
    )

    horizontal_zoom = 200
    #horizontal_zoom = 550

    # Manually chosen y_shifts for nice spacing.
    #vertical_zoom = 250
    #y_shifts = {
    #2:0,
    #3:horizontal_zoom*np.log2(4/3),
    #5:horizontal_zoom*np.log2(5/4)}
    #3:horizontal_zoom*np.sqrt(np.log2(4/3)*np.log2(3/2)),
    #5:horizontal_zoom*np.sqrt(np.log2(5/4)*np.log2(8/5))}
    #3:vertical_zoom*np.log2(3/2)-125,
    #5:vertical_zoom*np.log2(5/4)+100
    #}

    # Rectilinear projection of 3D lattice.
    phi = 2*np.pi*0.75  # Angle of the lattice against the projection
    spios = np.sin(np.pi/6)
    k = 1/(1 + spios)
    s = horizontal_zoom*(1+1/spios)  # Scale
    y_shifts = {
        2:np.log(2) * s*k * np.cos(phi),
        3:np.log(3/2) * s*k * np.cos(phi+2*np.pi/3),
        5:np.log(5/4) * s*k * np.cos(phi+4*np.pi/3)
    }

    # Make y-distance match harmonic distance
    #s = 30  # Scale
    #y_shifts = {
    #    2: s*harm_dist_steps[2],
    #    3: s*harm_dist_steps[3],
    #    5: s*harm_dist_steps[5],
    #}

    colors = {
        (1,0,0,0): "#000000",
        (-1,1,0,0): "#001bac",
        (-2,0,1,0): "#ac5f00",
        #(2,-1,0,0): "#001bac",
        #(3,0,-1,0): "#ac5f00"
    }
    style = {
        "draw_pitchlines": False,
        "opacity_harm_norm": True,
        "colors": colors,
        "note_color": "#ac0006",
        "note_radius": 8.0,
        "base_note_border_size": 4.0,
        "base_note_border_color": "#000000"
    }


    s = Scale(base_notes, gen_intervals, harm_dist_steps, max_harm_norm,
              max_pitch_norm)
    sf = ScaleFigure(s, horizontal_zoom, y_shifts, style)
    
    with open("keyboard_generated.svg", "w") as f:
        f.write(sf.svg)

