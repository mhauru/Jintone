const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];

function notes_equal(note1, note2) {
    // Ensure that if there's a length difference, note1 is longer.
    if (note1.length < note2.length) [note1, note2] = [note2, note1];
    var c1, c2;
    for (var i = 0; i < note1.length; i++) {
        c1 = note1[i]
        // If note2 has less values, assume it's padded with zeros at the end.
        c2 = (i < note2.length ? note2[i] : 0.0)
        if (c1 !== c2) return false;
    }
    return true;
}

function neg_note(note) {
    return note.map(a => -a);
}

function subtract_note(note1, note2) {
    // Ensure that if there's a length difference, note1 is longer.
    if (note1.length < note2.length) var flip = true;
    if (flip) [note1, note2] = [note2, note1];
    var res = new Array(note1.length);
    var c1, c2;
    for (var i = 0; i < res.length; i++) {
        c1 = note1[i]
        // If note2 has less values, assume it's padded with zeros at the end.
        c2 = (i < note2.length ? note2[i] : 0.0)
        res[i] = c2 - c1
        if (flip) res[i] = -res[i];
    }
    return res;
}

function add_note(note1, note2) {
    // Ensure that if there's a length difference, note1 is longer.
    if (note1.length < note2.length) [note1, note2] = [note2, note1];
    var res = new Array(note1.length);
    var c1, c2;
    for (var i = 0; i < res.length; i++) {
        c1 = note1[i]
        // If note2 has less values, assume it's padded with zeros at the end.
        c2 = (i < note2.length ? note2[i] : 0.0)
        res[i] = c1 + c2
    }
    return res;
}

function fraction(interval) {
    var num = 1.0, denom = 1.0;
    for (var i = 0; i < interval.length; i += 1) {
        p = primes[i];
        c = interval[i];
        if (c > 0) num *= Math.pow(p, c);
        else denom *= Math.pow(p,-c);
    }
    return [num, denom];
}

function prime_decompose(num, denom) {
    var note = [0];
    var i = 0;
    while (i < primes.length) {
        p = primes[i];
        num_divisible = (num % p == 0);
        denom_divisible = (denom % p == 0);
        if (num_divisible) {
            num = num / p;
            note[note.length-1] += 1;
        }
        if (denom_divisible) {
            denom = denom / p;
            note[note.length-1] -= 1;
        }
        if (num == 1 && denom == 1) return note;
        if (!num_divisible && !denom_divisible) {
            i += 1;
            note.push(0);
        }
    }
    // TODO We should actually raise an error or something, because too large
    // primes were involved.
    return note;
}

function pitch_factor(interval) {
    pf = 1.0;
    for (var i = 0; i < interval.length; i += 1) {
        p = primes[i];
        c = interval[i];
        pf *= Math.pow(p, c);
    }
    return pf;
}

function harm_dist(scale, note1, note2) {
    var interval = subtract_note(note1, note2);
    var d = 0.0;
    for (i = 0; i < interval.length; i += 1) {
        p = primes[i];
        c = interval[i];
        p_str = p.toString()
        if (scale.harm_dist_steps.hasOwnProperty(p_str)) {
            d += scale.harm_dist_steps[p_str] * Math.abs(c);
        } else {
            if (c != 0) {
                d = +Infinity;
            }
        }
    }
    return d;
}

function harm_norm(scale, note) {
    var min_d = +Infinity;
    var d, base;
    for (i = 0; i < scale.base_notes.length; i += 1) {
        base = scale.base_notes[i];
        d = harm_dist(scale, base, note);
        if (d < min_d) min_d = d;
    }
    return d;
}

function gen_scale(scale) {
    // We disgustingly turn everything into strings with JSON, temporarily.  I
    // blame Javascript's lack of useful things, such as user-defined value
    // types.
    // TODO
    // Or alternatively, we go math-smart on the generation, instead of just
    // hopping along in a graph.
    var j_notes = new Set();
    var steps = new Set();
    var j_notes_to_add = new Set(scale.base_notes.map(JSON.stringify));
    var itr = j_notes_to_add.values();
    var gens = scale.gen_intervals;
    var j_note, j_next_note;
    while (j_notes_to_add.size > 0 && j_notes.size < scale.max_notes) {
        j_note = itr.next().value;
        j_notes_to_add.delete(j_note);
        j_notes.add(j_note);
        note = JSON.parse(j_note);
        for (var i = 0; i < gens.length; i += 1) {
            pos_gen = gens[i];
            neg_gen = neg_note(pos_gen);
            for (let gen of [pos_gen, neg_gen]) {
                next_note = add_note(note, gen);
                j_next_note = JSON.stringify(next_note);
                if (!j_notes.has(j_next_note)) {
                    // Note that, even if a note is outside the max distance,
                    // we still add the step to it, to allow drawing step lines
                    // that fade to nothing.
                    var step = [note, next_note];
                    step.gen_interval = pos_gen;
                    steps.add(step);
                    // Figure out whether next_note should be included in this
                    // scale.
                    hn = harm_norm(scale, next_note);
                    pf = pitch_factor(next_note);
                    is_harm_close = (hn <= max_harm_norm);
                    is_pitch_close = (pf <= max_pitch_norm
                        && 1/pf <= max_pitch_norm);
                    if (is_harm_close && is_pitch_close) {
                        j_notes_to_add.add(j_next_note);
                    }
                }
            }
        }
    }
    scale.notes = [...j_notes].map(JSON.parse);
    scale.steps = [...steps];
}


function note_position(scale_fig, note) {
    var x = scale_fig.horizontal_zoom * Math.log2(pitch_factor(note));
    var y = 0.0;
    var p, c, p_str;
    for (var i=0; i<note.length; i++) {
        p = primes[i];
        c = note[i];
        p_str = p.toString();
        if (scale_fig.y_shifts.hasOwnProperty(p_str)) {
            y += -scale_fig.y_shifts[p_str] * c;
        }
    }
    return [x, y];
}

function is_in_viewbox(scale_fig, x, y) {
    var viewbox_left = scale_fig.canvas.viewbox().x;
    var viewbox_right = viewbox_left + scale_fig.canvas.viewbox().width;
    var viewbox_top = scale_fig.canvas.viewbox().y;
    var viewbox_bottom = viewbox_top + scale_fig.canvas.viewbox().height;
    var in_box_hor = (viewbox_left < x && x < viewbox_right);
    var in_box_ver = (viewbox_top < y && y < viewbox_bottom);
    var in_box = in_box_hor && in_box_ver;
    return in_box;
}

function draw_note(scale_fig, note, is_base=false) {
    var [x, y] = note_position(scale_fig, note);
    var in_box = is_in_viewbox(scale_fig, x, y);
    if (!in_box) return;
    var hn = harm_norm(scale_fig.scale, note);
    var rel_hn = Math.max(1.0 - hn/scale_fig.scale.max_harm_norm, 0.0)
    if (!scale_fig.style['opacity_harm_norm'] && rel_hn > 0.0) {
        rel_hn = 1.0;
    }
    var style = scale_fig.style;
    var note_radius = style["note_radius"];
    var note_color = style["note_color"];
    var svg_note;
    if (is_base) {
        var border_color = style["base_note_border_color"];
        var border_size = style["base_note_border_size"];
        note_radius += border_size/2
        svg_note = scale_fig.canvas.circle(2*note_radius).attr({
            "cx": x,
            "cy": y,
            "fill": note_color,
            "fill-opacity": rel_hn,
            "stroke": border_color,
            "stroke-width": border_size,
        });
    } else {
        svg_note = scale_fig.canvas.circle(2*note_radius).attr({
            "cx": x,
            "cy": y,
            "fill": note_color,
            "fill-opacity": rel_hn,
        })
    }
    svg_note.note = note;
    svg_note.scale_fig = scale_fig;
    note.svg_note = svg_note;
}

function draw_pitchline(scale_fig, note) {
    if (!scale_fig.style["draw_pitchlines"]) return;
    var hn = harm_norm(scale_fig.scale, note);
    var rel_hn = Math.max(1.0 - hn/scale_fig.scale.max_harm_norm, 0.0)
    if (!scale_fig.style['opacity_harm_norm'] && rel_hn > 0.0) {
        rel_hn = 1.0;
    }
    var [x, y] = note_position(scale_fig, note);
    var in_box = is_in_viewbox(scale_fig, x, y);
    if (!in_box) return;
    var style = scale_fig.style;
    var svg_pitchline = scale_fig.canvas.path('M 0,-1000 V 2000').attr({
        "stroke": "#c7c7c7",
        "stroke-width": "1.0",
        "stroke-miterlimit": 4,
        "stroke-dasharray": "0.5, 0.5",
        "stroke-dashoffset": 0,
        "stroke-opacity": rel_hn,
    })
    svg_pitchline.x(x)
    svg_pitchline.note = note;
    svg_pitchline.scale_fig = scale_fig;
    note.svg_pitchline = svg_pitchline;
}

function draw_step(scale_fig, step) {
    var [note1, note2] = step;
    var interval = subtract_note(note2, note1);
    var hn1 = harm_norm(scale_fig.scale, note1);
    var hn2 = harm_norm(scale_fig.scale, note2);
    var max_harm_norm = scale_fig.scale.max_harm_norm;
    var rel_hn1 = Math.max(1 - hn1/max_harm_norm, 0);
    var rel_hn2 = Math.max(1 - hn2/max_harm_norm, 0);
    if (!scale_fig.style["opacity_harm_norm"]) {
        if (rel_hn1 > 0) rel_hn1 = 1;
        if (rel_hn2 > 0) rel_hn2 = 1;
    }
    var [x1, y1] = note_position(scale_fig, note1);
    var [x2, y2] = note_position(scale_fig, note2);
    var in_box1 = is_in_viewbox(scale_fig, x1, y1);
    var in_box2 = is_in_viewbox(scale_fig, x2, y2);
    if (!in_box1 && !in_box2) return;
    var color = step.gen_interval.color;

    var grad = scale_fig.canvas.gradient('linear', function(stop) {
        stop.at({ offset: 0, color: color, opacity: rel_hn1 });
        stop.at({ offset: 1, color: color, opacity: rel_hn2 });
    });
    grad.attr({
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        gradientUnits: "userSpaceOnUse",
    });
    var r = scale_fig.style["note_radius"];
    var step_length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    var x1_edge = x1 - r*(x1-x2)/step_length;
    var y1_edge = y1 - r*(y1-y2)/step_length;
    var x2_edge = x2 + r*(x1-x2)/step_length;
    var y2_edge = y2 + r*(y1-y2)/step_length;
    var svg_step = scale_fig.canvas.line(
        x1_edge, y1_edge, x2_edge, y2_edge
    ).attr({
        "stroke": grad,
        "stroke-width": 2.5,
        "stroke-linecap": "butt",
        "stroke-linejoin": "miter",
        "stroke-miterlimit": 4,
        "stroke-opacity": 1,
    });
    svg_step.grad = grad
    svg_step.scale_fig = scale_fig
    svg_step.step = step
    step.svg_step = svg_step
}

function redraw(scale_fig) {
    scale_fig.canvas.clear()
    // Note that the order of these three parts determines which one is
    // above/below which.
    scale_fig.scale.notes.forEach(function(note) {
        draw_pitchline(scale_fig, note);
    });
    scale_fig.scale.steps.forEach(function(step) {
        draw_step(scale_fig, step);
    });
    scale_fig.scale.notes.forEach(function(note) {
        is_base = scale_fig.scale.base_notes.some(
            base => notes_equal(base, note)
        )
        draw_note(scale_fig, note, is_base=is_base);
    });
}


var max_harm_norm = 8;
var max_pitch_norm = 64;
var max_notes = 1000
var harm_dist_steps = {
    '2': 0.0,
    '3': 0.2,
    '5': 4.0,
};
var base_notes = [
    [0,0,0],
    //[-1,1,0],
    //[-2,0,1],
];

var scale = {
    base_notes: [],
    gen_intervals: [],
    harm_dist_steps: {},

    max_harm_norm: 0,
    max_pitch_norm: 0,

    notes: [],
    steps: [],
};

scale.base_notes = base_notes;
scale.harm_dist_steps = harm_dist_steps;
scale.max_harm_norm = max_harm_norm;
scale.max_pitch_norm = max_pitch_norm;
scale.max_notes = max_notes;

var horizontal_zoom = 200
// var horizontal_zoom = 550

// Manually chosen y_shifts for nice spacing.
//var vertical_zoom = 250
//var y_shifts = {
//'2': 0,
//'3': horizontal_zoom*Math.log2(4/3),
//'5': horizontal_zoom*Math.log2(5/4)},
//'3': horizontal_zoom*Math.sqrt(Math.log2(4/3)*Math.log2(3/2)),
//'5': horizontal_zoom*Math.sqrt(Math.log2(5/4)*Math.log2(8/5))},
//'3': vertical_zoom*Math.log2(3/2)-125,
//'5': vertical_zoom*Math.log2(5/4)+100,
//}

// Rectilinear projection of 3D lattice.
var phi = 2.0*Math.PI*0.75  // Angle of the lattice against the projection
var spios = Math.sin(Math.PI/6.0)
var k = 1.0/(1.0 + spios)
var s = horizontal_zoom*(1.0+1.0/spios)  // Scale
var y_shifts = {
    '2': Math.log2(2.0) * s*k * Math.cos(phi),
    '3': Math.log2(3.0/2.0) * s*k * Math.cos(phi+2*Math.PI/3.0),
    '5': Math.log2(5.0/4.0) * s*k * Math.cos(phi+4*Math.PI/3.0)
}

// Make y-distance match harmonic distance
//var s = 30  // Scale
//var y_shifts = {
//    '2': s*harm_dist_steps[2],
//    '3': s*harm_dist_steps[3],
//    '5': s*harm_dist_steps[5],
//}

var style = {
    "draw_pitchlines": true,
    "opacity_harm_norm": true,
    "note_color": "#ac0006",
    "note_radius": 8.0,
    "base_note_border_size": 4.0,
    "base_note_border_color": "#000000",
}

var canvas = SVG('canvas');
canvas.size(1500, 700).viewbox(-750, -350, 1500, 700);

var scale_fig = {
    "canvas": canvas,
    "scale": scale,
    "horizontal_zoom": horizontal_zoom,
    "y_shifts": y_shifts,
    "style": style,
}

var zoomrange = document.getElementById("zoomrange");
zoomrange.value = horizontal_zoom
zoomrange.min = 100
zoomrange.max = 700
zoomrange.scale_fig = scale_fig
zoomrange.oninput = function() {
    scale_fig = this.scale_fig
    scale_fig.horizontal_zoom = this.value;
    reposition_all(scale_fig)
}

function set_fraction_rep_value(rep, note) {
    var [num, denom] = fraction(note);
    rep.value = num.toString() + "/" + denom.toString();
}

function set_decimal_rep_value(rep, note) {
    var pf = pitch_factor(note);
    rep.innerHTML = pf.toString();
}

function set_coordinate_rep_value(rep, note) {
    rep.value = JSON.stringify(note)
}

function read_in_fraction_rep_value(rep) {
    var [num, denom] = rep.value.split("/")
    if (denom == undefined) denom = "1";
    num = Number(num); denom = Number(denom);
    note = prime_decompose(num, denom)
    return note
}

function read_in_coordinate_rep_value(rep) {
    return JSON.parse(rep.value);
}

function overwrite_gen_interval(gen_interval, note) {
    gen_interval.splice(0, gen_interval.length);
    gen_interval.splice(0, note.length, ...note);
}

function add_generating_interval(scale_fig, interval=[0], color="#000000") {
    var gen_interval = interval;
    gen_interval.color = color;
    scale_fig.scale.gen_intervals.push(gen_interval);
    var div_gi = document.createElement("div");
    // TODO Make it "Generating interval #N"
    div_gi.innerHTML = "Generating interval<br>";
    div_gi.gen_interval = gen_interval;
    var in_fraction_rep = document.createElement("input");
    in_fraction_rep.type = "text";
    in_fraction_rep.size = "3";
    set_fraction_rep_value(in_fraction_rep, gen_interval)
    var in_coordinate_rep = document.createElement("input");
    in_coordinate_rep.type = "text";
    in_coordinate_rep.size = "7";
    set_coordinate_rep_value(in_coordinate_rep, gen_interval)
    var span_decimal_rep = document.createElement("span");
    set_decimal_rep_value(span_decimal_rep, gen_interval)
    var span_name_rep = document.createElement("span");
    var in_color = document.createElement("input");
    in_color.type = "color";
    in_color.value = color;
    var par_reps = document.createElement("p");
    var par_color = document.createElement("p");
    var par_y_shift = document.createElement("p");
    var par_harm_dist_step = document.createElement("p");
    par_reps.innerHTML = "Interval: "
    par_color.innerHTML = "Color: "
    par_y_shift.innerHTML = "y-shift: "
    par_harm_dist_step.innerHTML = "Harmonic distance: "
    par_reps.appendChild(in_fraction_rep);
    par_reps.appendChild(in_coordinate_rep);
    par_reps.appendChild(span_decimal_rep);
    par_reps.appendChild(span_name_rep);
    par_color.appendChild(in_color);
    div_gi.appendChild(par_reps);
    div_gi.appendChild(par_color);
    document.body.appendChild(div_gi);
    // TODO Add buttons for de(activating), and for mirroring (including also
    // the negative of the same interval).
    in_color.oninput = function() {
        gen_interval.color = this.value;
        recolor_all(scale_fig);
    }
    in_coordinate_rep.onchange = function() {
        // TODO Sanitize and check input format.
        // TODO Check that this interval doesn't exist already. Same in the other setter functions.
        var note = read_in_coordinate_rep_value(this);
        set_fraction_rep_value(in_fraction_rep, note);
        set_decimal_rep_value(span_decimal_rep, note);
        overwrite_gen_interval(gen_interval, note);
        // TODO Check name, set name_rep
        gen_scale(scale_fig.scale);
        redraw(scale_fig);
    }
    in_fraction_rep.onchange = function() {
        var note = read_in_fraction_rep_value(this);
        set_coordinate_rep_value(in_coordinate_rep, note);
        set_decimal_rep_value(span_decimal_rep, note);
        // TODO Check name, set name_rep
        overwrite_gen_interval(gen_interval, note);
        gen_scale(scale_fig.scale);
        redraw(scale_fig);
    }
    // TODO All this is actually based on primes and not intervals.
    //var in_text_yshift = document.createElement("input");
    //in_text_yshift.type = "text";
    //in_text_yshift.size = "2"
    //var in_range_yshift = document.createElement("input");
    //in_range_yshift.type = "range";
    //var in_text_harmdiststep = document.createElement("input");
    //in_text_harmdiststep.type = "text";
    //in_text_harmdiststep.size = "2"
    //var in_range_harmdiststep = document.createElement("input");
    //in_range_harmdiststep.type = "range"
    //par_y_shift.appendChild(in_text_yshift);
    //par_y_shift.appendChild(in_range_yshift);
    //par_harm_dist_step.appendChild(in_text_harmdiststep);
    //par_harm_dist_step.appendChild(in_range_harmdiststep);
    //in_text_yshift.onchange = function() {
    //    // TODO Check input to be a number
    //    in_range_yshift.value = this.value
    //    reposition_all(scale_fig)
    //}
    //in_range_yshift.oninput = function() {
    //    in_text_yshift.value = this.value
    //    reposition_all(scale_fig)
    //}
    //in_text_harmdiststep.onchange = function() {
    //    // TODO Check input to be a number
    //    in_range_harmdiststep.value = this.value
    //}
    //in_range_harmdiststep.oninput = function() {
    //    in_text_harmdiststep.value = this.value
    //}
}

function reposition_all(scale_fig) {
    scale_fig.scale.notes.forEach(function(note) {
        [x, y] = note_position(scale_fig, note)
        // TODO Remove notes if they go outside the viewbox.
        if (note.hasOwnProperty("svg_note")) {
            // If we had the old value of the slider, we could do this faster.
            // This is safer though.
            note.svg_note.attr("cx", x)
            note.svg_note.attr("cy", y)
        }
        else {
            draw_note(scale_fig, note)
        }
        if (note.hasOwnProperty("svg_pitchline")) {
            // If we had the old value of the slider, we could do this faster.
            // This is safer though.
            note.svg_pitchline.x(x)
        }
        else {
            draw_pitchline(scale_fig, note)
        }
    })
    scale_fig.scale.steps.forEach(function(step) {
        if (step.hasOwnProperty("svg_step")) {
            var [note1, note2] = step;
            var [x1, y1] = note_position(scale_fig, note1);
            var [x2, y2] = note_position(scale_fig, note2);
            var svg_step = step.svg_step;
            var r = svg_step.scale_fig.style["note_radius"]
            var step_length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
            var x1_edge = x1 - r*(x1-x2)/step_length;
            var y1_edge = y1 - r*(y1-y2)/step_length;
            var x2_edge = x2 + r*(x1-x2)/step_length;
            var y2_edge = y2 + r*(y1-y2)/step_length;
            svg_step.attr("x1", x1_edge);
            svg_step.attr("x2", x2_edge);
            svg_step.attr("y1", y1_edge);
            svg_step.attr("y2", y2_edge);
            var grad = svg_step.grad;
            grad.attr("x1", x1);
            grad.attr("x2", x2);
            grad.attr("y1", y1);
            grad.attr("y2", y2);
        }
        else {
            draw_step(scale_fig, step);
        }
    })
}

function recolor_all(scale_fig) {
    scale_fig.scale.steps.forEach(function(step) {
        if (step.hasOwnProperty("svg_step")) {
            var color = step.gen_interval.color;
            var svg_step = step.svg_step
            var grad = svg_step.grad
            grad.get(0).attr("stop-color", color)
            grad.get(1).attr("stop-color", color)
        }
        else {
            draw_step(scale_fig, step)
        }
    })
}

add_generating_interval(scale_fig, interval=[1,0,0], color="#000000")
add_generating_interval(scale_fig, interval=[-1,1,0], color="#001bac")
add_generating_interval(scale_fig, interval=[-2,0,1], color="#ac5f00")
gen_scale(scale);
redraw(scale_fig)
