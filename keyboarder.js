"use strict";
const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
const synth = new Tone.PolySynth(4, Tone.Synth).toMaster();

function tones_equal(tone1, tone2) {
    // Ensure that if there's a length difference, tone1 is longer.
    if (tone1.length < tone2.length) [tone1, tone2] = [tone2, tone1];
    var c1, c2;
    for (var i = 0; i < tone1.length; i++) {
        c1 = tone1[i]
        // If tone2 has less values, assume it's padded with zeros at the end.
        c2 = (i < tone2.length ? tone2[i] : 0.0)
        if (c1 !== c2) return false;
    }
    return true;
}

function neg_tone(tone) {
    return tone.map(a => -a);
}

function subtract_tone(tone1, tone2) {
    // Ensure that if there's a length difference, tone1 is longer.
    if (tone1.length < tone2.length) var flip = true;
    if (flip) [tone1, tone2] = [tone2, tone1];
    var res = new Array(tone1.length);
    var c1, c2;
    for (var i = 0; i < res.length; i++) {
        c1 = tone1[i]
        // If tone2 has less values, assume it's padded with zeros at the end.
        c2 = (i < tone2.length ? tone2[i] : 0.0)
        res[i] = c2 - c1
        if (flip) res[i] = -res[i];
    }
    return res;
}

function add_tone(tone1, tone2) {
    // Ensure that if there's a length difference, tone1 is longer.
    if (tone1.length < tone2.length) [tone1, tone2] = [tone2, tone1];
    var res = new Array(tone1.length);
    var c1, c2;
    for (var i = 0; i < res.length; i++) {
        c1 = tone1[i]
        // If tone2 has less values, assume it's padded with zeros at the end.
        c2 = (i < tone2.length ? tone2[i] : 0.0)
        res[i] = c1 + c2
    }
    return res;
}

function fraction(interval) {
    var num = 1.0, denom = 1.0;
    var p, c;
    for (var i = 0; i < interval.length; i += 1) {
        p = primes[i];
        c = interval[i];
        if (c > 0) num *= Math.pow(p, c);
        else denom *= Math.pow(p,-c);
    }
    return [num, denom];
}

function prime_decompose(num, denom) {
    var tone = [0];
    var i = 0;
    var p, num_divisible, denom_divisible, num;
    while (i < primes.length) {
        p = primes[i];
        num_divisible = (num % p == 0);
        denom_divisible = (denom % p == 0);
        if (num_divisible) {
            num = num / p;
            tone[tone.length-1] += 1;
        }
        if (denom_divisible) {
            denom = denom / p;
            tone[tone.length-1] -= 1;
        }
        if (num == 1 && denom == 1) return tone;
        if (!num_divisible && !denom_divisible) {
            i += 1;
            tone.push(0);
        }
    }
    // TODO We should actually raise an error or something, because too large
    // primes were involved.
    return tone;
}

function pitch_factor(interval) {
    var pf = 1.0;
    var p, c;
    for (var i = 0; i < interval.length; i += 1) {
        p = primes[i];
        c = interval[i];
        pf *= Math.pow(p, c);
    }
    return pf;
}

function harm_dist(scale, tone1, tone2) {
    var interval = subtract_tone(tone1, tone2);
    var d = 0.0;
    var p, c, p_str, step;
    for (var i = 0; i < interval.length; i++) {
        p = primes[i];
        c = interval[i];
        p_str = p.toString()
        if (scale.harm_dist_steps.hasOwnProperty(p_str)) {
            step = scale.harm_dist_steps[p_str]
        } else {
            step = +Infinity;
        }
        if (c != 0.0) d += step * Math.abs(c);
    }
    return d;
}

function harm_norm(scale, tone) {
    var min_d = +Infinity;
    var d, base;
    for (var i = 0; i < scale.base_tones.length; i += 1) {
        base = scale.base_tones[i];
        d = harm_dist(scale, base, tone);
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
    var j_tones = new Set();
    var steps = new Set();
    var j_tones_to_add = new Set(scale.base_tones.map(JSON.stringify));
    var itr = j_tones_to_add.values();
    var gens = scale.gen_intervals;
    var j_tone, j_next_tone;
    var pos_gen, neg_gen;
    var tone, next_tone;
    var step;
    var hn, pf, is_harm_close, is_pitch_close;
    while (j_tones_to_add.size > 0 && j_tones.size < scale.max_tones) {
        j_tone = itr.next().value;
        j_tones_to_add.delete(j_tone);
        j_tones.add(j_tone);
        tone = JSON.parse(j_tone);
        for (var i = 0; i < gens.length; i += 1) {
            pos_gen = gens[i];
            neg_gen = neg_tone(pos_gen);
            for (let gen of [pos_gen, neg_gen]) {
                next_tone = add_tone(tone, gen);
                j_next_tone = JSON.stringify(next_tone);
                if (!j_tones.has(j_next_tone)) {
                    // Note that, even if a tone is outside the max distance,
                    // we still add the step to it, to allow drawing step lines
                    // that fade to nothing.
                    step = [tone, next_tone];
                    step.gen_interval = pos_gen;
                    steps.add(step);
                    // Figure out whether next_tone should be included in this
                    // scale.
                    hn = harm_norm(scale, next_tone);
                    pf = pitch_factor(next_tone);
                    is_harm_close = (hn <= max_harm_norm);
                    is_pitch_close = (pf <= max_pitch_norm
                        && 1/pf <= max_pitch_norm);
                    if (is_harm_close && is_pitch_close) {
                        j_tones_to_add.add(j_next_tone);
                    }
                }
            }
        }
    }
    scale.tones = [...j_tones].map(JSON.parse);
    scale.steps = [...steps];
}


function tone_position(scale_fig, tone) {
    var x = scale_fig.horizontal_zoom * Math.log2(pitch_factor(tone));
    var y = 0.0;
    var p, c, p_str;
    for (var i=0; i<tone.length; i++) {
        p = primes[i];
        c = tone[i];
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

function start_tone(tone) {
    synth.triggerAttack(tone);
}

function stop_tone(tone) {
    synth.triggerRelease(tone);
}

function draw_tone(scale_fig, tone, is_base=false) {
    var [x, y] = tone_position(scale_fig, tone);
    var in_box = is_in_viewbox(scale_fig, x, y);
    if (!in_box) return;
    var hn = harm_norm(scale_fig.scale, tone);
    var rel_hn = Math.max(1.0 - hn/scale_fig.scale.max_harm_norm, 0.0)
    if (!scale_fig.style['opacity_harm_norm'] && rel_hn > 0.0) {
        rel_hn = 1.0;
    }
    var style = scale_fig.style;
    var tone_radius = style["tone_radius"];
    var tone_color = style["tone_color"];
    var svg_tone;
    if (is_base) {
        var border_color = style["base_tone_border_color"];
        var border_size = style["base_tone_border_size"];
        tone_radius += border_size/2
        svg_tone = scale_fig.canvas.circle(2*tone_radius).attr({
            "cx": x,
            "cy": y,
            "fill": tone_color,
            "fill-opacity": rel_hn,
            "stroke": border_color,
            "stroke-width": border_size,
        });
    } else {
        svg_tone = scale_fig.canvas.circle(2*tone_radius).attr({
            "cx": x,
            "cy": y,
            "fill": tone_color,
            "fill-opacity": rel_hn,
        })
    }
    svg_tone.tone = tone;
    svg_tone.scale_fig = scale_fig;
    tone.svg_tone = svg_tone;

    var pf = pitch_factor(tone);
    var tone_on = function(ev) {
        // Prevent a touch event from also generating a mouse event.
        ev.preventDefault();
        // We recompute this every time, since origin_tone may have changed.
        var freq = scale_fig.scale.origin_tone * pf
        start_tone(freq);
    }
    var tone_off = function(ev) {
        // Prevent a touch event from also generating a mouse event.
        ev.preventDefault();
        // We recompute this every time, since origin_tone may have changed.
        var freq = scale_fig.scale.origin_tone * pf
        stop_tone(freq);
    }
    svg_tone.mousedown(tone_on);
    svg_tone.mouseup(tone_off);
    svg_tone.mouseleave(tone_off);
    svg_tone.touchstart(tone_on);
    svg_tone.touchend(tone_off);
    svg_tone.touchleave(tone_off);
    svg_tone.touchcancel(tone_off);
}

function draw_pitchline(scale_fig, tone) {
    if (!scale_fig.style["draw_pitchlines"]) return;
    var hn = harm_norm(scale_fig.scale, tone);
    var rel_hn = Math.max(1.0 - hn/scale_fig.scale.max_harm_norm, 0.0)
    if (!scale_fig.style['opacity_harm_norm'] && rel_hn > 0.0) {
        rel_hn = 1.0;
    }
    var [x, y] = tone_position(scale_fig, tone);
    var in_box = is_in_viewbox(scale_fig, x, y);
    if (!in_box) return;
    var style = scale_fig.style;
    var pitchline_color = style["pitchline_color"];
    var svg_pitchline = scale_fig.canvas.path('M 0,-1000 V 2000').attr({
        "stroke": pitchline_color,
        "stroke-width": "1.0",
        "stroke-miterlimit": 4,
        "stroke-dasharray": "0.5, 0.5",
        "stroke-dashoffset": 0,
        "stroke-opacity": rel_hn,
    })
    svg_pitchline.x(x)
    svg_pitchline.tone = tone;
    svg_pitchline.scale_fig = scale_fig;
    tone.svg_pitchline = svg_pitchline;
}

function draw_step(scale_fig, step) {
    var [tone1, tone2] = step;
    var interval = subtract_tone(tone2, tone1);
    var hn1 = harm_norm(scale_fig.scale, tone1);
    var hn2 = harm_norm(scale_fig.scale, tone2);
    var max_harm_norm = scale_fig.scale.max_harm_norm;
    var rel_hn1 = Math.max(1 - hn1/max_harm_norm, 0);
    var rel_hn2 = Math.max(1 - hn2/max_harm_norm, 0);
    if (!scale_fig.style["opacity_harm_norm"]) {
        if (rel_hn1 > 0) rel_hn1 = 1;
        if (rel_hn2 > 0) rel_hn2 = 1;
    }
    var [x1, y1] = tone_position(scale_fig, tone1);
    var [x2, y2] = tone_position(scale_fig, tone2);
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
    var r = scale_fig.style["tone_radius"];
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
    scale_fig.scale.tones.forEach(function(tone) {
        draw_pitchline(scale_fig, tone);
    });
    scale_fig.scale.steps.forEach(function(step) {
        draw_step(scale_fig, step);
    });
    var is_base;
    scale_fig.scale.tones.forEach(function(tone) {
        is_base = scale_fig.scale.base_tones.some(
            base => tones_equal(base, tone)
        )
        draw_tone(scale_fig, tone, is_base=is_base);
    });
}


// TODO Make all these adjustable.
var max_harm_norm = 8;
var max_pitch_norm = 64;
var max_tones = 1000
var base_tones = [
    [0,0,0],
    //[-1,1,0],
    //[-2,0,1],
];

var scale = {
    origin_tone: 440,
    base_tones: [],
    gen_intervals: [],
    harm_dist_steps: {},

    max_harm_norm: 0,
    max_pitch_norm: 0,

    tones: [],
    steps: [],
};

scale.base_tones = base_tones;
scale.max_harm_norm = max_harm_norm;
scale.max_pitch_norm = max_pitch_norm;
scale.max_tones = max_tones;

// TODO Make all these adjustable.
var style = {
    "opacity_harm_norm": true,
    "base_tone_border_size": 4.0,
    "base_tone_border_color": "#000000",
}

var canvas = SVG("div_canvas");

var scale_fig = {
    "canvas": canvas,
    "scale": scale,
    "horizontal_zoom": 1,
    "y_shifts": {},
    "style": style,
}

function resize_canvas(scale_fig) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var c = scale_fig.canvas;
    c.size(w,h).viewbox(-w/2, -h/2, w, h);
}

resize_canvas(scale_fig);

var range_zoom = document.getElementById("range_zoom");
function range_zoom_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.horizontal_zoom = value;
    range_zoom.value = value;
    reposition_all(scale_fig);
}
range_zoom.oninput = function() {
    range_zoom_oninput(this.value);
}

var num_origin_freq = document.getElementById("num_origin_freq");
function num_origin_freq_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.scale.origin_tone = value;
    num_origin_freq.value = value;
}
num_origin_freq.oninput = function() {
    num_origin_freq_oninput(this.value);
}

var num_tone_radius = document.getElementById("num_tone_radius");
function num_tone_radius_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.style["tone_radius"] = value;
    num_tone_radius.value = value;
    rescale_tones(scale_fig);
}
num_tone_radius.oninput = function() {
    num_tone_radius_oninput(this.value)
}

var tone_color = document.getElementById("tone_color");
function tone_color_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.style["tone_color"] = value;
    tone_color.value = value;
    recolor_tones(scale_fig);
}
tone_color.oninput = function() {
    tone_color_oninput(this.value);
}

function recolor_tones(scale_fig) {
    // TODO
}

function rescale_tones(scale_fig) {
    // TODO
}

function redraw_pitchlines(scale_fig) {
    // TODO
}

var checkbox_pitchlines = document.getElementById("checkbox_pitchlines");
function checkbox_pitchlines_onclick(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.style["draw_pitchlines"] = value;
    checkbox_pitchlines.checked = value;
    redraw_pitchlines(scale_fig);
}
checkbox_pitchlines.onclick = function() {
    checkbox_pitchlines_onclick(this.checked);
}

var color_pitchlines = document.getElementById("color_pitchlines");
function color_pitchlines_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.style["pitchlines_color"] = value;
    color_pitchlines.value = value;
    redraw_pitchlines(scale_fig);
}
color_pitchlines.oninput = function() {
    color_pitchlines_oninput(this.value);
}

function set_fraction_rep_value(rep, tone) {
    var [num, denom] = fraction(tone);
    rep.value = num.toString() + "/" + denom.toString();
}

function set_decimal_rep_value(rep, tone) {
    var pf = pitch_factor(tone);
    rep.innerHTML = pf.toString();
}

function set_coordinate_rep_value(rep, tone) {
    rep.value = JSON.stringify(tone)
}

function read_in_fraction_rep_value(rep) {
    var [num, denom] = rep.value.split("/")
    if (denom == undefined) denom = "1";
    num = Number(num); denom = Number(denom);
    var tone = prime_decompose(num, denom)
    return tone
}

function read_in_coordinate_rep_value(rep) {
    return JSON.parse(rep.value);
}

function overwrite_gen_interval(gen_interval, interval) {
    if (gen_interval == interval) return;
    gen_interval.splice(0, gen_interval.length);
    gen_interval.splice(0, interval.length, ...interval);
}

function yshift_onchange(prime, shift) {
    var in_text = document.getElementById(`in_text_yshift_${prime}`);
    var in_range = document.getElementById(`in_range_yshift_${prime}`);
    if (in_text != null) in_text.value = shift.toString();
    if (in_range != null) in_range.value = shift.toString();
    // TODO Reading scale_fig from global scope?
    scale_fig.y_shifts[prime.toString()] = shift;
    reposition_all(scale_fig);
}

function harm_dist_step_onchange(prime, dist) {
    scale_fig.scale.harm_dist_steps[prime.toString()] = dist;
    var in_range = document.getElementById(`in_range_harmdiststep_${prime}`);
    var in_text = document.getElementById(`in_text_harmdiststep_${prime}`);
    if (in_range != null) in_range.value = dist;
    if (in_text != null) in_text.value = dist.toString();
    // TODO reopacitate is what I would like to do here, but requires
    // rethinking adding tones to the scale, so later.
    //reopacitate_all(scale_fig);
    gen_scale(scale_fig.scale);
    redraw(scale_fig);
}

function add_axis(scale_fig, prime) {
    var in_text_yshift = document.createElement("input");
    in_text_yshift.id = `in_text_yshift_${prime}`
    in_text_yshift.type = "text";
    in_text_yshift.size = "2";
    var in_range_yshift = document.createElement("input");
    in_range_yshift.id = `in_range_yshift_${prime}`
    in_range_yshift.type = "range";
    in_range_yshift.step = 0.01;
    in_range_yshift.max = 500.0;
    in_range_yshift.min = -500.0;
    var in_text_harmdiststep = document.createElement("input");
    in_text_harmdiststep.id = `in_text_harmdiststep_${prime}`
    in_text_harmdiststep.type = "text";
    in_text_harmdiststep.size = "2";
    var in_range_harmdiststep = document.createElement("input");
    in_range_harmdiststep.id = `in_range_harmdiststep_${prime}`
    in_range_harmdiststep.type = "range";
    in_range_harmdiststep.step = 0.01;
    in_range_harmdiststep.max = 10.0;
    in_range_harmdiststep.min = 0.0;
    var par_y_shift = document.createElement("p");
    var par_harm_dist_step = document.createElement("p");
    par_y_shift.innerHTML = "y-shift: ";
    par_harm_dist_step.innerHTML = "Harmonic distance: ";
    par_y_shift.appendChild(in_text_yshift);
    par_y_shift.appendChild(in_range_yshift);
    par_harm_dist_step.appendChild(in_text_harmdiststep);
    par_harm_dist_step.appendChild(in_range_harmdiststep);

    var div_axis = document.createElement("div");
    div_axis.id = `div_axis_${prime}`
    div_axis.innerHTML = `Axis: ${prime}`;
    div_axis.appendChild(par_y_shift);
    div_axis.appendChild(par_harm_dist_step);
    document.getElementById("div_axes").appendChild(div_axis);;

    in_text_yshift.onchange = function() {
        // TODO Check input to be a number
        yshift_onchange(prime, parseFloat(this.value));
    }
    in_range_yshift.oninput = function() {
        yshift_onchange(prime, this.value);
    }
    in_text_harmdiststep.onchange = function() {
        // TODO Check input to be a number
        harm_dist_step_onchange(prime, parseFloat(this.value));
    }
    in_range_harmdiststep.oninput = function() {
        harm_dist_step_onchange(prime, this.value);
    }

    yshift_onchange(prime, 0.0);
    harm_dist_step_onchange(prime, Infinity);
}

function adjust_axes(scale_fig) {
    var max_length = 0;
    scale_fig.scale.gen_intervals.forEach(function(interval) {
        if (interval.length > max_length) max_length = interval.length;
    });
    var p;
    // TODO Implement removing axes as well.
    for (var i = 0; i < max_length; i++) {
        p = primes[i];
        if (!(p.toString() in scale_fig.y_shifts)) {
            add_axis(scale_fig, p);
        }
    }
}

function reopacitate_all(scale_fig) {
    scale_fig.scale.tones.forEach(function(tone) {
        var hn = harm_norm(scale_fig.scale, tone);
        var rel_hn = Math.max(1.0 - hn/scale_fig.scale.max_harm_norm, 0.0)
        if (!scale_fig.style['opacity_harm_norm'] && rel_hn > 0.0) {
            rel_hn = 1.0;
        }
        if (tone.hasOwnProperty("svg_tone")) {
            tone.svg_tone.attr("fill-opacity", rel_hn);
        }
        else {
            draw_tone(scale_fig, tone);
        }
        if (tone.hasOwnProperty("svg_pitchline")) {
            tone.svg_pitchline.attr("stroke-opacity", rel_hn);
        }
        else {
            draw_pitchline(scale_fig, tone);
        }
    })
    scale_fig.scale.steps.forEach(function(step) {
        if (step.hasOwnProperty("svg_step")) {
            var [tone1, tone2] = step;
            var hn1 = harm_norm(scale_fig.scale, tone1);
            var hn2 = harm_norm(scale_fig.scale, tone2);
            var max_harm_norm = scale_fig.scale.max_harm_norm;
            var rel_hn1 = Math.max(1 - hn1/max_harm_norm, 0);
            var rel_hn2 = Math.max(1 - hn2/max_harm_norm, 0);
            if (!scale_fig.style["opacity_harm_norm"]) {
                if (rel_hn1 > 0) rel_hn1 = 1;
                if (rel_hn2 > 0) rel_hn2 = 1;
            }
            var grad = step.svg_step.grad;
            grad.get(0).attr("stop-opacity", rel_hn1);
            grad.get(1).attr("stop-opacity", rel_hn2);
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

function add_generating_interval(scale_fig, interval=[0], color="#000000") {
    var gen_interval = interval;
    scale_fig.scale.gen_intervals.push(gen_interval);
    var div_gi = document.createElement("div");
    // TODO Make it "Generating interval #N"
    div_gi.innerHTML = "Generating interval<br>";
    div_gi.gen_interval = gen_interval;
    var in_fraction_rep = document.createElement("input");
    in_fraction_rep.type = "text";
    in_fraction_rep.size = "3";
    var in_coordinate_rep = document.createElement("input");
    in_coordinate_rep.type = "text";
    in_coordinate_rep.size = "7";
    var span_decimal_rep = document.createElement("span");
    var span_name_rep = document.createElement("span");
    var in_color = document.createElement("input");
    in_color.type = "color";
    var par_reps = document.createElement("p");
    var par_color = document.createElement("p");
    par_reps.innerHTML = "Interval: "
    par_color.innerHTML = "Color: "
    par_reps.appendChild(in_fraction_rep);
    par_reps.appendChild(in_coordinate_rep);
    par_reps.appendChild(span_decimal_rep);
    par_reps.appendChild(span_name_rep);
    par_color.appendChild(in_color);
    div_gi.appendChild(par_reps);
    div_gi.appendChild(par_color);
    var div_gis = document.getElementById("div_gis");
    div_gis.appendChild(div_gi);
    // TODO Add buttons for de(activating), and for mirroring (including also
    // the negative of the same interval).

    function color_onchange(color) {
        gen_interval.color = color;
        in_color.value = color;
        recolor_all(scale_fig);
    }

    function interval_onchange(interval) {
        set_coordinate_rep_value(in_coordinate_rep, interval);
        set_decimal_rep_value(span_decimal_rep, interval);
        set_fraction_rep_value(in_fraction_rep, interval);
        // TODO Check name, set name_rep
        overwrite_gen_interval(gen_interval, interval);
        adjust_axes(scale_fig);
        gen_scale(scale_fig.scale);
        redraw(scale_fig);
    }

    interval_onchange(interval);
    color_onchange(color);

    in_color.oninput = function() {
        color_onchange(this.value);
    }
    in_coordinate_rep.onchange = function() {
        // TODO Sanitize and check input format.
        // TODO Check that this interval doesn't exist already. Same in the other setter functions.
        var interval = read_in_coordinate_rep_value(this);
        interval_onchange(interval);
    }
    in_fraction_rep.onchange = function() {
        var interval = read_in_fraction_rep_value(this);
        interval_onchange(interval);
    }
}

function reposition_all(scale_fig) {
    var x, y;
    scale_fig.scale.tones.forEach(function(tone) {
        [x, y] = tone_position(scale_fig, tone)
        // TODO Remove tones if they go outside the viewbox.
        if (tone.hasOwnProperty("svg_tone")) {
            // If we had the old value of the slider, we could do this faster.
            // This is safer though.
            tone.svg_tone.attr("cx", x)
            tone.svg_tone.attr("cy", y)
        }
        else {
            draw_tone(scale_fig, tone)
        }
        if (tone.hasOwnProperty("svg_pitchline")) {
            // If we had the old value of the slider, we could do this faster.
            // This is safer though.
            tone.svg_pitchline.x(x)
        }
        else {
            draw_pitchline(scale_fig, tone)
        }
    })
    scale_fig.scale.steps.forEach(function(step) {
        if (step.hasOwnProperty("svg_step")) {
            var [tone1, tone2] = step;
            var [x1, y1] = tone_position(scale_fig, tone1);
            var [x2, y2] = tone_position(scale_fig, tone2);
            var svg_step = step.svg_step;
            var r = svg_step.scale_fig.style["tone_radius"]
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

// Generate default starting state.

range_zoom_oninput(200);
num_origin_freq_oninput(440);
tone_color_oninput("#ac0006");
num_tone_radius_oninput(13.0);
checkbox_pitchlines_onclick(true);
color_pitchlines_oninput("#c7c7c7");

add_generating_interval(scale_fig, [1,0,0], "#000000")
add_generating_interval(scale_fig, [-1,1,0], "#001bac")
add_generating_interval(scale_fig, [-2,0,1], "#ac5f00")

// Rectilinear projection of 3D lattice.
var phi = 2.0*Math.PI*0.75  // Angle of the lattice against the projection
var spios = Math.sin(Math.PI/6.0)
var k = 1.0/(1.0 + spios)
var s = scale_fig.horizontal_zoom*(1.0+1.0/spios)  // Scale
var shift_2 =  Math.log2(2.0) * s*k * Math.cos(phi);
var shift_3 =  Math.log2(3.0/2.0) * s*k * Math.cos(phi+2*Math.PI/3.0);
var shift_5 =  Math.log2(5.0/4.0) * s*k * Math.cos(phi+4*Math.PI/3.0);
yshift_onchange(2, shift_2);
yshift_onchange(3, shift_3);
yshift_onchange(5, shift_5);

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

// Make y-distance match harmonic distance
//var s = 30  // Scale
//var y_shifts = {
//    '2': s*harm_dist_steps[2],
//    '3': s*harm_dist_steps[3],
//    '5': s*harm_dist_steps[5],
//}

harm_dist_step_onchange(2, 0.0);
harm_dist_step_onchange(3, 0.2);
harm_dist_step_onchange(5, 4.0);

