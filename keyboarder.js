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
    if (note1.length < note2.length) [note1, note2] = [note2, note1];
    var res = new Array(note1.length);
    var c1, c2;
    for (var i = 0; i < res.length; i++) {
        c1 = note1[i]
        // If note2 has less values, assume it's padded with zeros at the end.
        c2 = (i < note2.length ? note2[i] : 0.0)
        res[i] = c2 - c1
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

function pitch_factor(interval) {
    pf = 1.0;
    for (i = 0; i < interval.length; i += 1) {
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
    var neg_gens = scale.gen_intervals.map(neg_note);
    var all_gens = scale.gen_intervals.concat(neg_gens);
    var j_note, j_next_note;
    while (j_notes_to_add.size > 0 && j_notes.size < scale.max_notes) {
        j_note = itr.next().value;
        j_notes_to_add.delete(j_note);
        j_notes.add(j_note);
        note = JSON.parse(j_note);
        all_gens.forEach(function(intrvl) {
            next_note = add_note(note, intrvl)
            j_next_note = JSON.stringify(next_note);
            if (!j_notes.has(j_next_note)) {
                // Note that, even if a note is outside the max distance, we
                // still add the step to it, to allow drawing step lines that
                // fade to nothing.
                steps.add([note, next_note]);
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
        });
    }
    scale.notes = [...j_notes].map(JSON.parse);
    scale.steps = [...steps];
    console.log(j_notes);
    console.log(scale.steps);
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

function draw_note(scale_fig, note, is_base=false) {
    var hn = harm_norm(scale_fig.scale, note);
    var rel_hn = Math.max(1.0 - hn/scale_fig.scale.max_harm_norm, 0.0)
    if (!scale_fig.style['opacity_harm_norm'] && rel_hn > 0.0) {
        rel_hn = 1.0;
    }
    var [x, y] = note_position(scale_fig, note);
    var style = scale_fig.style;
    var note_radius = style["note_radius"];
    var note_color = style["note_color"];
    if (is_base) {
        var border_color = style["base_note_border_color"];
        var border_size = style["base_note_border_size"];
        note_radius += border_size/2
        scale_fig.canvas.circle(2*note_radius).attr({
            "cx": x,
            "cy": y,
            "fill": note_color,
            "fill-opacity": rel_hn,
            "stroke": border_color,
            "stroke-width": border_size,
        });
    } else {
        scale_fig.canvas.circle(2*note_radius).attr({
            "cx": x,
            "cy": y,
            "fill": note_color,
            "fill-opacity": rel_hn,
        })
    }
}

function draw_pitchline(scale_fig, note) {
    var hn = harm_norm(scale_fig.scale, note);
    var rel_hn = Math.max(1.0 - hn/scale_fig.scale.max_harm_norm, 0.0)
    if (!scale_fig.style['opacity_harm_norm'] && rel_hn > 0.0) {
        rel_hn = 1.0;
    }
    var [x, y] = note_position(scale_fig, note);
    var style = scale_fig.style;
    if (scale_fig.style["draw_pitchlines"]) {
        scale_fig.canvas.path('M 0,-1000 V 2000').attr({
            "stroke": "#c7c7c7",
            "stroke-width": "1.0",
            "stroke-miterlimit": 4,
            "stroke-dasharray": "0.5, 0.5",
            "stroke-dashoffset": 0,
            "stroke-opacity": rel_hn,
        }).x(x)
    }
}

function draw_step(scale_fig, step) {
    var [note1, note2] = step
    var interval = subtract_note(note2, note1)
    var hn1 = harm_norm(scale_fig.scale, note1)
    var hn2 = harm_norm(scale_fig.scale, note2)
    var max_harm_norm = scale_fig.scale.max_harm_norm
    var rel_hn1 = Math.max(1 - hn1/max_harm_norm, 0)
    var rel_hn2 = Math.max(1 - hn2/max_harm_norm, 0)
    if (!scale_fig.style["opacity_harm_norm"]) {
        if (rel_hn1 > 0) rel_hn1 = 1;
        if (rel_hn2 > 0) rel_hn2 = 1;
    }
    var [x1, y1] = note_position(scale_fig, note1)
    var [x2, y2] = note_position(scale_fig, note2)
    var colors = style["colors"]
    var color;
    if (colors.hasOwnProperty(interval.toString())) {
        color = colors[interval.toString()]
    } else {
        color = colors[neg_note(interval).toString()]
    }

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
    var r = scale_fig.style["note_radius"]
    var step_length = Math.sqrt((x2-x1)**2 + (y2-y1)**2)
    var x1_edge = x1 - r*(x1-x2)/step_length
    var y1_edge = y1 - r*(y1-y2)/step_length
    var x2_edge = x2 + r*(x1-x2)/step_length
    var y2_edge = y2 + r*(y1-y2)/step_length
    //path_str = `m ${x1_edge} ${y1_edge} ${x2_edge-x1_edge} ${y2_edge-y1_edge}`
    scale_fig.canvas.line(x1_edge, y1_edge, x2_edge, y2_edge).attr({
        "stroke": grad,
        //"stroke": color,  // DEBUG
        "stroke-width": 2.5,
        "stroke-linecap": "butt",
        "stroke-linejoin": "miter",
        "stroke-miterlimit": 4,
        "stroke-opacity": 1,
    })
}

function redraw(scale_fig) {
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
var max_pitch_norm = 16;
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
var gen_intervals = [
    [1,0,0],
    [-1,1,0],
    [-2,0,1],
    //[2,-1,0],
    //[3,0,-1],
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
scale.gen_intervals = gen_intervals;
scale.harm_dist_steps = harm_dist_steps;
scale.max_harm_norm = max_harm_norm;
scale.max_pitch_norm = max_pitch_norm;
scale.max_notes = max_notes;

gen_scale(scale);

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

var colors = {
    [[1,0,0].toString()]: "#000000",
    [[-1,1,0].toString()]: "#001bac",
    [[-2,0,1].toString()]: "#ac5f00",
    //[[2,-1,0,0].toString()]: "#001bac",
    //[[3,0,-1,0].toString()]: "#ac5f00",
}
var style = {
    "draw_pitchlines": true,
    "opacity_harm_norm": true,
    "colors": colors,
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

console.log(scale.notes)  // DEBUG
redraw(scale_fig)
