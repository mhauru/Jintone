"use strict";

///////////////////////////////////////////////////////////////////////////////
// Global constants.

// TODO Turn this into a generator that actually returns arbitrarily many primes.
const all_primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const synth = new Tone.PolySynth(4, Tone.Synth).toMaster();

///////////////////////////////////////////////////////////////////////////////
// Functions for arithmetic with coordinate representations of tones.

function tones_equal(tone1, tone2) {
    // Ensure that if there's a length difference, tone1 is longer.
    if (tone1.length < tone2.length) [tone1, tone2] = [tone2, tone1];
    for (let i = 0; i < tone1.length; i++) {
        let c1 = tone1[i]
        // If tone2 has less values, assume it's padded with zeros at the end.
        let c2 = (i < tone2.length ? tone2[i] : 0.0)
        if (c1 !== c2) return false;
    }
    return true;
}

function neg_tone(tone) {
    return tone.map(a => -a);
}

function subtract_tone(tone1, tone2) {
    // Ensure that if there's a length difference, tone1 is longer.
    let flip = (tone1.length < tone2.length);
    if (flip) [tone1, tone2] = [tone2, tone1];
    let res = new Array(tone1.length);
    for (let i = 0; i < res.length; i++) {
        let c1 = tone1[i]
        // If tone2 has less values, assume it's padded with zeros at the end.
        let c2 = (i < tone2.length ? tone2[i] : 0.0)
        res[i] = c2 - c1
        if (flip) res[i] = -res[i];
    }
    return res;
}

function sum_tones(tone1, tone2) {
    // Ensure that if there's a length difference, tone1 is longer.
    if (tone1.length < tone2.length) [tone1, tone2] = [tone2, tone1];
    let res = new Array(tone1.length);
    for (let i = 0; i < res.length; i++) {
        let c1 = tone1[i]
        // If tone2 has less values, assume it's padded with zeros at the end.
        let c2 = (i < tone2.length ? tone2[i] : 0.0)
        res[i] = c1 + c2
    }
    return res;
}

function fraction(interval) {
    let num = 1.0, denom = 1.0;
    for (let i = 0; i < interval.length; i += 1) {
        let p = scale_fig.primes[i];
        let c = interval[i];
        if (c > 0) num *= Math.pow(p, c);
        else denom *= Math.pow(p,-c);
    }
    return [num, denom];
}

function prime_decompose(num, denom) {
    let tone = [0];
    let i = 0;
    while (i < scale_fig.primes.length) {
        let p = scale_fig.primes[i];
        let num_divisible = (num % p == 0);
        let denom_divisible = (denom % p == 0);
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

function harm_dist(scale_fig, tone1, tone2) {
    let interval = subtract_tone(tone1, tone2);
    let d = 0.0;
    for (let i = 0; i < interval.length; i++) {
        let p = scale_fig.primes[i];
        let c = interval[i];
        let p_str = p.toString()
        let step;
        if (scale_fig.harm_dist_steps.hasOwnProperty(p_str)) {
            step = scale_fig.harm_dist_steps[p_str]
        } else {
            step = +Infinity;
        }
        if (c != 0.0) d += step * Math.abs(c);
    }
    return d;
}

function pitch_factor(interval) {
    let pf = 1.0;
    for (let i = 0; i < interval.length; i += 1) {
        let p = scale_fig.primes[i];
        let c = interval[i];
        pf *= Math.pow(p, c);
    }
    return pf;
}

///////////////////////////////////////////////////////////////////////////////
// TODO Come up with a title.

// TODO Make all these adjustable.
let style = {
    "opacity_harm_norm": true,
    "base_tone_border_size": 4.0,
    "base_tone_border_color": "#000000",
}

let canvas = SVG("div_canvas");

// TODO Make all these adjustable.
let scale_fig = {
    "canvas": canvas,
    "horizontal_zoom": 1,
    "y_shifts": {},
    "style": style,
    "origin_freq": 440,
    "base_tones": [],
    "step_intervals": {},
    "harm_dist_steps": {},
    "primes": [],

    "max_harm_norm": 8,

    "tones": {},
    "boundary_tones": {},
    "steps": [],
}


function is_in_viewbox(scale_fig, x, y) {
    let viewbox_left = scale_fig.canvas.viewbox().x;
    let viewbox_right = viewbox_left + scale_fig.canvas.viewbox().width;
    let viewbox_top = scale_fig.canvas.viewbox().y;
    let viewbox_bottom = viewbox_top + scale_fig.canvas.viewbox().height;
    let in_box_hor = (viewbox_left < x && x < viewbox_right);
    let in_box_ver = (viewbox_top < y && y < viewbox_bottom);
    let in_box = in_box_hor && in_box_ver;
    return in_box;
}

function is_in_viewclosure(scale_fig, x, y) {
    let viewbox_left   = scale_fig.canvas.viewbox().x;
    let viewbox_right  = viewbox_left + scale_fig.canvas.viewbox().width;
    let viewbox_top    = scale_fig.canvas.viewbox().y;
    let viewbox_bottom = viewbox_top + scale_fig.canvas.viewbox().height;
    let max_prime = Math.max(...scale_fig.primes)
    let max_xjump = scale_fig.horizontal_zoom * Math.log2(max_prime);
    let max_yjump = Math.max(...Object.values(scale_fig.y_shifts));
    let closure_left   = viewbox_left - max_xjump
    let closure_right  = viewbox_right + max_xjump
    let closure_top    = viewbox_top - max_yjump
    let closure_bottom = viewbox_bottom + max_yjump
    let in_closure_hor = (closure_left < x && x < closure_right);
    let in_closure_ver = (closure_top < y && y < closure_bottom);
    let in_closure = in_closure_hor && in_closure_ver;
    return in_closure;
}

function start_tone(tone) {
    synth.triggerAttack(tone);
}

function stop_tone(tone) {
    synth.triggerRelease(tone);
}

function resize_canvas(scale_fig) {
    let w = window.innerWidth;
    let h = window.innerHeight;
    let c = scale_fig.canvas;
    c.size(w,h).viewbox(-w/2, -h/2, w, h);
}

let range_zoom = document.getElementById("range_zoom");
function range_zoom_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.horizontal_zoom = value;
    range_zoom.value = value;
    reposition_all(scale_fig);
}
range_zoom.oninput = function() {
    range_zoom_oninput(this.value);
}

let num_origin_freq = document.getElementById("num_origin_freq");
function num_origin_freq_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.origin_freq = value;
    num_origin_freq.value = value;
}
num_origin_freq.oninput = function() {
    num_origin_freq_oninput(this.value);
}

let num_tone_radius = document.getElementById("num_tone_radius");
function num_tone_radius_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.style["tone_radius"] = parseFloat(value);
    num_tone_radius.value = value;
    rescale_tones(scale_fig);
}
num_tone_radius.oninput = function() {
    num_tone_radius_oninput(this.value)
}

let tone_color = document.getElementById("tone_color");
function tone_color_oninput(value) {
    // TODO Refer to global scope scale_fig like this?
    scale_fig.style["tone_color"] = value;
    tone_color.value = value;
    recolor_tones(scale_fig);
}
tone_color.oninput = function() {
    tone_color_oninput(this.value);
}

function rescale_tones(scale_fig) {
    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        tone.scale_svg_tone();
    });
}

function set_pitchlines_visibility(scale_fig) {
    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        tone.set_svg_pitchline_visibility();
    });
}

let checkbox_pitchlines = document.getElementById("checkbox_pitchlines");
function checkbox_pitchlines_onclick(value) {
    scale_fig.style["draw_pitchlines"] = value;
    checkbox_pitchlines.checked = value;
    set_pitchlines_visibility(scale_fig);
}
checkbox_pitchlines.onclick = function() {
    checkbox_pitchlines_onclick(this.checked);
}

let color_pitchlines = document.getElementById("color_pitchlines");
function color_pitchlines_oninput(value) {
    scale_fig.style["pitchline_color"] = value;
    color_pitchlines.value = value;
    recolor_pitchlines(scale_fig);
}
color_pitchlines.oninput = function() {
    color_pitchlines_oninput(this.value);
}

function yshift_onchange(prime, shift) {
    let p_str = prime.toString();
    let in_text = document.getElementById(`in_text_yshift_${prime}`);
    let in_range = document.getElementById(`in_range_yshift_${prime}`);
    if (in_text != null) in_text.value = shift.toString();
    if (in_range != null) in_range.value = shift.toString();
    // TODO Reading scale_fig from global scope?
    let old_shift = scale_fig.y_shifts[p_str];
    scale_fig.y_shifts[p_str] = shift;
    reposition_all(scale_fig);
    // TODO We assume here that the viewbox is always centered at the origin.
    if (Math.abs(old_shift) > Math.abs(shift)) {
        generate_tones();
    } else {
        delete_tones();
    }
}

function harm_dist_step_onchange(prime, dist) {
    let p_str = prime.toString();
    let old_dist = scale_fig.harm_dist_steps[p_str];
    scale_fig.harm_dist_steps[p_str] = dist;
    let in_range = document.getElementById(`in_range_harmdiststep_${prime}`);
    let in_text = document.getElementById(`in_text_harmdiststep_${prime}`);
    if (in_range != null) in_range.value = dist;
    if (in_text != null) in_text.value = dist.toString();
    recolor_tones();
    reopacitate_steps();
    if (old_dist > dist) {
        generate_tones();
    } else {
        delete_tones();
    }
}

function reposition_all(scale_fig) {
    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        tone.position_svg();
    });
}

function recolor_steps() {
    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        Object.entries(tone.steps).forEach(([label, step]) => {
            step.color();
        });
    });
}

function reopacitate_steps() {
    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        Object.entries(tone.steps).forEach(([label, step]) => {
            step.opacitate();
        });
    });
}

function recolor_tones() {
    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        tone.color_svg_tone();
    });
}

function recolor_pitchlines() {
    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        tone.color_svg_pitchline();
    });
}

// Generate default starting state.

range_zoom_oninput(200);
num_origin_freq_oninput(440);
tone_color_oninput("#ac0006");
num_tone_radius_oninput(13.0);
checkbox_pitchlines_onclick(true);
color_pitchlines_oninput("#c7c7c7");

// Manually chosen y_shifts for nice spacing.
//let vertical_zoom = 250
//let y_shifts = {
//'2': 0,
//'3': horizontal_zoom*Math.log2(4/3),
//'5': horizontal_zoom*Math.log2(5/4)},
//'3': horizontal_zoom*Math.sqrt(Math.log2(4/3)*Math.log2(3/2)),
//'5': horizontal_zoom*Math.sqrt(Math.log2(5/4)*Math.log2(8/5))},
//'3': vertical_zoom*Math.log2(3/2)-125,
//'5': vertical_zoom*Math.log2(5/4)+100,
//}

// Make y-distance match harmonic distance
//let s = 30  // Scale
//let y_shifts = {
//    '2': s*harm_dist_steps[2],
//    '3': s*harm_dist_steps[3],
//    '5': s*harm_dist_steps[5],
//}

resize_canvas(scale_fig);

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

class StepInterval {
    constructor(label, interval, color) {
        this.label = label;
        this._interval_ = [];
        this._color_ = "";
        this.initialize_html()
        this.set_listeners()
        this.interval = interval;
        this.color = color;
    }

    initialize_html() {
        let div = document.createElement("div");
        div.innerHTML = `Generating interval ${this.label}<br>`;
        this.div = div;

        let in_fraction_rep = document.createElement("input");
        in_fraction_rep.type = "text";
        in_fraction_rep.size = "3";
        this.in_fraction_rep = in_fraction_rep;

        let in_coordinate_rep = document.createElement("input");
        in_coordinate_rep.type = "text";
        in_coordinate_rep.size = "7";
        this.in_coordinate_rep = in_coordinate_rep;

        let span_decimal_rep = document.createElement("span");
        this.span_decimal_rep = span_decimal_rep;

        let span_name_rep = document.createElement("span");
        this.span_name_rep = span_name_rep;

        let in_color = document.createElement("input");
        in_color.type = "color";
        this.in_color = in_color;

        let par_reps = document.createElement("p");
        par_reps.innerHTML = "Interval: "
        par_reps.appendChild(in_fraction_rep);
        par_reps.appendChild(in_coordinate_rep);
        par_reps.appendChild(span_decimal_rep);
        par_reps.appendChild(span_name_rep);
        this.par_reps = par_reps;
        div.appendChild(par_reps);

        let par_color = document.createElement("p");
        par_color.innerHTML = "Color: "
        par_color.appendChild(in_color);
        this.par_color = par_color;
        div.appendChild(par_color);
        // TODO Add buttons for de(activating), and for mirroring (including also
        // the negative of the same interval).
    }

    set_listeners() {
        let t = this;
        this.in_color.oninput = function() {
            t.color = this.value;
        }
        this.in_coordinate_rep.onchange = function() {
            // TODO Sanitize and check input format.
            // TODO Check that this interval doesn't exist already. Same in the other setter functions.
            let interval = t.parse_in_coordinate_rep_value(this.value);
            t.interval = interval;
        }
        this.in_fraction_rep.onchange = function() {
            let interval = t.parse_in_fraction_rep_value(this.value);
            t.interval = interval;
        }
    }
    
    get pitch_factor() {
        return pitch_factor(this.interval);
    }
    
    get fraction() {
        return fraction(this.interval);
    }

    // TODO Static method?
    parse_in_fraction_rep_value(value) {
        let [num, denom] = value.split("/")
        if (denom == undefined) denom = "1";
        num = Number(num); denom = Number(denom);
        let tone = prime_decompose(num, denom)
        return tone
    }

    // TODO Static method?
    parse_in_coordinate_rep_value(value) {
        return JSON.parse(value);
    }

    set_fraction_rep_value(tone) {
        let [num, denom] = fraction(tone);
        let str = num.toString() + "/" + denom.toString();
        this.in_fraction_rep.value = str;
    }

    set_decimal_rep_value(tone) {
        let pf = pitch_factor(tone);
        this.span_decimal_rep.innerHTML = pf.toString();
    }

    set_coordinate_rep_value(tone) {
        this.in_coordinate_rep.value = JSON.stringify(tone);
    }

    get color() { return this._color_; }
    set color(color) {
        this._color_ = color;
        this.in_color.value = color;
        // TODO recolor_steps();  // TODO Should this call happen here?
    }

    get interval() { return this._interval_; }
    set interval(interval) {
        if (this._interval_ == interval) return;
        let _interval_ = this._interval_;
        _interval_.splice(0, _interval_.length);
        _interval_.splice(0, interval.length, ...interval);
        this.set_coordinate_rep_value(_interval_);
        this.set_decimal_rep_value(_interval_);
        this.set_fraction_rep_value(_interval_);
        // TODO Check name, set name_rep
        // TODO reposition_step(scale_fig);  // TODO Should this call happen here?
    }

}

class Step {
    constructor(label, origin) {
        this.label = label;
        this.origin = origin;
        this.update_endpoint();
        this.initialize_svg();
        this.position();
        this.color();
        this.opacitate();
    }

    initialize_svg() {
        let grad = scale_fig.canvas.gradient('linear', function(stop) {
            stop.at({"offset": 0});
            stop.at({"offset": 1});
        });
        grad.attr("gradientUnits", "userSpaceOnUse");
        let svg_step = scale_fig.canvas.line(0,0,0,0).attr({
            "visibility": "hidden",
            "stroke": grad,
            "stroke-width": 2.5,
            "stroke-linecap": "butt",
            "stroke-linejoin": "miter",
            "stroke-miterlimit": 4,
            "stroke-opacity": 1,
        });
        this.grad = grad;
        this.svg_step = svg_step;
    }

    update_endpoint() {
        let origin_coords = this.origin.coords;
        let interval = scale_fig.step_intervals[this.label].interval;
        let endpoint_coords = sum_tones(origin_coords, interval);
        let endpoint = scale_fig.tones[endpoint_coords]
        this.endpoint = endpoint;
    }

    get has_endpoint() {
        return !(this.endpoint === undefined);
    }

    opacitate() {
        if (!(this.has_endpoint)) return;
        let svg_step = this.svg_step;
        let grad = this.grad;
        let max_harm_norm = scale_fig.max_harm_norm;
        let rel_hn1 = this.origin.rel_harm_norm;
        let rel_hn2 = this.endpoint.rel_harm_norm;
        grad.get(0).attr("stop-opacity", rel_hn1);
        grad.get(1).attr("stop-opacity", rel_hn2);
        if (rel_hn1 > 0 || rel_hn2 > 0) {
            svg_step.attr("visibility", "inherit");
        } else {
            svg_step.attr("visibility", "hidden");
        }
    }

    color() {
        if (!(this.has_endpoint)) return;
        let color = scale_fig.step_intervals[this.label].color;
        let svg_step = this.svg_step;
        let grad = this.grad;
        grad.get(0).attr("stop-color", color)
        grad.get(1).attr("stop-color", color)
    }

    position() {
        if (!(this.has_endpoint)) return;
        let svg_step = this.svg_step;
        let grad = this.grad;
        let origin = this.origin;
        let endpoint = this.endpoint;
        let [x1, y1] = [origin.xpos, origin.ypos];
        let [x2, y2] = [endpoint.xpos, endpoint.ypos];
        let r = scale_fig.style["tone_radius"];
        let step_length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        let x1_edge = x1 - r*(x1-x2)/step_length;
        let y1_edge = y1 - r*(y1-y2)/step_length;
        let x2_edge = x2 + r*(x1-x2)/step_length;
        let y2_edge = y2 + r*(y1-y2)/step_length;
        svg_step.attr("x1", x1_edge);
        svg_step.attr("x2", x2_edge);
        svg_step.attr("y1", y1_edge);
        svg_step.attr("y2", y2_edge);
        grad.attr("x1", x1);
        grad.attr("x2", x2);
        grad.attr("y1", y1);
        grad.attr("y2", y2);
    }
}

// TODO The "Object" part of the name is to avoid a name collission with
// Tone.js. Think about namespace management.
class ToneObject {
    // TODO Everything is recomputed from the minimal set of data necessary to
    // store.  This is easy, but slow. Optimize if necessary by storing some of
    // the data, avoiding recomputation if nothing has changed.
    constructor(coordinates, is_base) {
        this.coords = coordinates;
        this._is_base_ = is_base;
        this.steps = {};

        this.svg_tone = scale_fig.canvas.circle(1.0);
        // TODO Where do these numbers come from?
        this.svg_pitchline = scale_fig.canvas.path('M 0,-1000 V 2000')
        this.position_svg();
        this.color_svg();
        this.scale_svg_tone();
        this.set_listeners();
        this.add_steps();
    }

    set_listeners() {
        let t = this;
        let tone_on = function(ev) {
            // Prevent a touch event from also generating a mouse event.
            ev.preventDefault();
            start_tone(t.frequency);
        }
        let tone_off = function(ev) {
            // Prevent a touch event from also generating a mouse event.
            ev.preventDefault();
            stop_tone(t.frequency);
        }
        let svg_tone = this.svg_tone;
        svg_tone.mousedown(tone_on);
        svg_tone.mouseup(tone_off);
        svg_tone.mouseleave(tone_off);
        svg_tone.touchstart(tone_on);
        svg_tone.touchend(tone_off);
        svg_tone.touchleave(tone_off);
        svg_tone.touchcancel(tone_off);
    }

    set is_base(value) {
        this._is_base_ = value;
        this.color_svg_tone();
        this.scale_svg_tone();
    }

    get is_base() {
        return this._is_base_;
    }
    
    get pitch_factor() {
        let pf = 1.0;
        for (let i = 0; i < this.coords.length; i += 1) {
            let p = scale_fig.primes[i];
            let c = this.coords[i];
            pf *= Math.pow(p, c);
        }
        return pf;
    }

    get xpos() {
        return scale_fig.horizontal_zoom * Math.log2(this.pitch_factor);
    }

    get ypos() {
        let y = 0.0;
        for (let i = 0; i < this.coords.length; i += 1) {
            let p = scale_fig.primes[i];
            let c = this.coords[i];
            let p_str = p.toString();
            // TODO Is the check necessary?
            if (scale_fig.y_shifts.hasOwnProperty(p_str)) {
                y += -scale_fig.y_shifts[p_str] * c;
            }
        }
        return y;
    }

    get frequency() {
        return scale_fig.origin_freq * this.pitch_factor;
    }

    get harm_dists() {
        let harm_dists = [];
        for (let i = 0; i < scale_fig.base_tones.length; i += 1) {
            let bt = scale_fig.base_tones[i];
            let dist = harm_dist(scale_fig, this.coords, bt);  // TODO Remove explicit argument scale?
            harm_dists.push(dist);
        }
        return harm_dists;
    }

    get harm_norm() {
        return Math.min(...this.harm_dists);
    }

    get rel_harm_norm() {
        let hn = this.harm_norm;
        let rel_hn = Math.max(1.0 - hn/scale_fig.max_harm_norm, 0.0)
        if (!scale_fig.style['opacity_harm_norm'] && rel_hn > 0.0) {
            rel_hn = 1.0;
        }
        return rel_hn;
    }

    get inbounds() {
        // TODO Add note radius, to check if the edge of a note fits, rather
        // than center?
        let harm_close = (this.harm_norm <= scale_fig.max_harm_norm);
        let in_viewbox = is_in_viewbox(scale_fig, this.xpos, this.ypos);  // Remove explicit scale_fig reference?
        return harm_close && in_viewbox;
    }

    get inclosure() {
        let harm_close = (this.harm_norm <= scale_fig.max_harm_norm);
        let in_viewclosure = is_in_viewclosure(scale_fig, this.xpos, this.ypos);  // Remove explicit scale_fig reference?
        return harm_close && in_viewclosure;
    }

    add_steps() {
        Object.entries(scale_fig.step_intervals).forEach(
            ([label, step_interval]) => {
                if (label in this.steps) return;
                this.steps[label] = new Step(label, this);
            });
    }

    position_svg() {
        this.position_svg_tone();
        this.position_svg_pitchline();
        this.set_svg_pitchline_visibility();
        Object.entries(this.steps).forEach(([label, step]) => {
            step.position();
        });
    }

    color_svg() {
        this.color_svg_tone();
        this.color_svg_pitchline();
        this.set_svg_pitchline_visibility();
    }

    position_svg_tone() {
        this.svg_tone.attr({
            "cx": this.xpos,
            "cy": this.ypos,
        })
    }

    scale_svg_tone() {
        let svg_tone = this.svg_tone;
        let tone_radius = style["tone_radius"];
        if (this.is_base) {
            let border_size = style["base_tone_border_size"];
            tone_radius = tone_radius + border_size/2;
        }
        svg_tone.radius(tone_radius);
        Object.entries(this.steps).forEach(([label, step]) => {
            step.position();
        });
    }

    color_svg_tone() {
        let svg_tone = this.svg_tone;
        let rel_hn = this.rel_harm_norm;
        let style = scale_fig.style;
        let tone_color = style["tone_color"];
        if (this.is_base) {
            let border_color = style["base_tone_border_color"];
            let border_size = style["base_tone_border_size"];
            svg_tone.attr({
                "fill": tone_color,
                "fill-opacity": rel_hn,
                "stroke": border_color,
                "stroke-width": border_size,
            });
        } else {
            svg_tone.attr({
                "fill": tone_color,
                "fill-opacity": rel_hn,
                "stroke-width": 0.0,
            })
        }
    }

    position_svg_pitchline() {
        this.svg_pitchline.x(this.xpos)
    }

    set_svg_pitchline_visibility() {
        let svg_pitchline = this.svg_pitchline;
        let rel_hn = this.rel_harm_norm;
        if (scale_fig.style["draw_pitchlines"] && this.inbounds && rel_hn > 0) {
            svg_pitchline.attr("visibility", "inherit");
        } else {
            svg_pitchline.attr("visibility", "hidden");
        }
    }

    color_svg_pitchline() {
        let svg_pitchline = this.svg_pitchline;
        let rel_hn = this.rel_harm_norm;
        let style = scale_fig.style;
        let pitchline_color = style["pitchline_color"];
        // TODO Make more of these settings adjustable from Settings, and
        // stored with scale_fig.
        svg_pitchline.attr({
            "stroke": pitchline_color,
            "stroke-width": "1.0",
            "stroke-miterlimit": 4,
            "stroke-dasharray": "0.5, 0.5",
            "stroke-dashoffset": 0,
            "stroke-opacity": rel_hn,
        });
    }

}

function add_base_tone(base_tone) {
    scale_fig.base_tones.push(base_tone);
    let bt_str = base_tone.toString();
    if (bt_str in scale_fig.tones) {
        scale_fig.tones[bt_str].is_base = true;
    } else {
        let tone_obj = add_tone(base_tone, true);
        scale_fig.boundary_tones[bt_str] = tone_obj;
    }

    // Since harmonic distances may have changed, recolor existing tones.
    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        tone.color_svg();
    });

    generate_tones();
}

function generate_tones() {
    // TODO This doesn't work if a base_tone is outside of the viewbox closure.
    // Starting from the current boundary tones, i.e. tones that are not
    // inbounds (drawable) but are within the closure (close enough to
    // being drawable that they may be necessary to reach all drawable tones),
    // check whether any of them have actually come within the closure since we
    // last checked. If yes, generate all their neighbors (that don't already
    // exist), and recursively check whether they are within the closure.  At
    // the end, all possible tones within the closure, and all their neighbors,
    // should exist, but the neighbors that are outside the closure should not
    // further have their neighbors generated.
    let roots = Object.entries(scale_fig.boundary_tones);
    while (roots.length > 0) {
        let root_str, root_tone;
        [root_str, root_tone] = roots.pop();
        let inclosure = root_tone.inclosure;
        if (inclosure) {
            // The tone in question is close enough to the drawable tones, that
            // we generate more tones starting from it. After this, it will no
            // longer be a boundary tone.
            let added = add_neighbors(root_tone);
            roots = roots.concat(added);
            delete scale_fig.boundary_tones[root_str]
        }
    }
}

function delete_tones() {
    // TODO This doesn't work if a base_tone is outside of the viewbox closure.
    // The complement of generate_tones: Start from the boundary tones, working
    // inwards, deleting all tones that are two or more ste removed from the
    // closure zone.
    let leaves = Object.entries(scale_fig.boundary_tones);
    while (leaves.length > 0) {
        let leaf_str, leaf_tone;
        [leaf_str, leaf_tone] = leaves.pop();
        // TODO We actually know that at least all the tones we added during
        // this lop are inclosure. So this could be optimized by running the
        // inclosure filter before the main while loop, avoiding rechecking
        // inclosure. Then again, a storage system within Tone for
        // inclosure would do the same and more.
        let inclosure = leaf_tone.inclosure;
        if (!inclosure) {
            // The tone in question is close enough to the drawable tones, that
            // we generate more tones starting from it. After this, it will no
            // longer be a boundary tone.
            let still_boundary, marked;
            [still_boundary, marked] = mark_neighbors(leaf_tone);
            leaves = leaves.concat(marked);
            if (!still_boundary) {
                delete scale_fig.boundary_tones[leaf_str];
                // TODO Should probably do something else too.
                //leaf_tone.destroy();
                delete scale_fig.tones[leaf_str];
            }
        }
    }
}

function mark_neighbors(tone) {
    let neigh_coords, neigh_str, neigh_tone;
    let marked = [];
    let still_boundary = false;
    for (let i = 0; i < tone.coords.length; i += 1) {
        [-1,+1].forEach(function(increment) {
            neigh_coords = tone.coords.slice();
            neigh_coords[i] += increment;
            neigh_str = neigh_coords.toString();
            if (!(neigh_str in scale_fig.tones)) {
                // This tone doesn't exist, moving on.
                return;
            }
            neigh_tone = scale_fig.tones[neigh_str];
            if (neigh_tone.inclosure) {
                still_boundary = true;
            } else if (!(neigh_str in scale_fig.boundary_tones)) {
                scale_fig.boundary_tones[neigh_str] = neigh_tone;
                marked.push([neigh_str, neigh_tone]); 
            }
        });
    }
    return [still_boundary, marked];
}

function add_neighbors(tone) {
    let neigh_coords, neigh_str, neigh_tone;
    let added = [];
    for (let i = 0; i < tone.coords.length; i += 1) {
        [-1,+1].forEach(function(increment) {
            neigh_coords = tone.coords.slice();
            neigh_coords[i] += increment;
            neigh_str = neigh_coords.toString();
            if (neigh_str in scale_fig.tones) {
                // This tone exists already, moving on.
                return;
            }
            neigh_tone = add_tone(neigh_coords, false);
            added.push([neigh_str, neigh_tone]); 
            scale_fig.boundary_tones[neigh_str] = neigh_tone;
        });
    }
    return added;
}

function add_tone(tone, is_base) {
    let tone_str = tone.toString();
    let new_tone = new ToneObject(tone, is_base)
    scale_fig.tones[tone_str] = new_tone;
    return new_tone;
}

function add_step_interval(interval, color) {
    let existing_labels = Object.keys(scale_fig.step_intervals);
    let label = 1;
    while (existing_labels.includes(label.toString())) { label++; }
    label = label.toString();
    let step_interval = new StepInterval(label, interval, color);
    scale_fig.step_intervals[label] = step_interval;
    let div_gis = document.getElementById("div_gis");
    div_gis.appendChild(step_interval.div);

    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        tone.add_steps();
    });
}

function add_axis() {
    let prime = all_primes[scale_fig.primes.length];

    let in_text_yshift = document.createElement("input");
    in_text_yshift.id = `in_text_yshift_${prime}`
    in_text_yshift.type = "text";
    in_text_yshift.size = "2";

    let in_range_yshift = document.createElement("input");
    in_range_yshift.id = `in_range_yshift_${prime}`
    in_range_yshift.type = "range";
    in_range_yshift.step = 0.01;
    in_range_yshift.max = 500.0;
    in_range_yshift.min = -500.0;

    let in_text_harmdiststep = document.createElement("input");
    in_text_harmdiststep.id = `in_text_harmdiststep_${prime}`
    in_text_harmdiststep.type = "text";
    in_text_harmdiststep.size = "2";

    let in_range_harmdiststep = document.createElement("input");
    in_range_harmdiststep.id = `in_range_harmdiststep_${prime}`
    in_range_harmdiststep.type = "range";
    in_range_harmdiststep.step = 0.01;
    in_range_harmdiststep.max = 10.0;
    in_range_harmdiststep.min = 0.0;

    let par_y_shift = document.createElement("p");
    par_y_shift.innerHTML = "y-shift: ";
    par_y_shift.appendChild(in_text_yshift);
    par_y_shift.appendChild(in_range_yshift);

    let par_harm_dist_step = document.createElement("p");
    par_harm_dist_step.innerHTML = "Harmonic distance: ";
    par_harm_dist_step.appendChild(in_text_harmdiststep);
    par_harm_dist_step.appendChild(in_range_harmdiststep);

    let div_axis = document.createElement("div");
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

    scale_fig.primes.push(prime);

    Object.entries(scale_fig.tones).forEach(([coords, tone]) => {
        new_coords = coords.slice();
        new_coords.push(0);

        delete scale_fig.tones[coords];
        scale_fig.tones[new_coords] = tone;
        if (coords in scale_fig.boundary_tones) {
            delete scale_fig.boundary_tones[coords];
            scale_fig.boundary_tones[new_coords] = tone;
        }

        tone.coords = new_coords;
    });

    Object.entries(scale_fig.step_intervals).forEach(
        ([label, step_interval]) => {
            interval = step_interval.interval;
            new_interval = interval.slice();
            new_interval.push(0);
            step_interval.interval = new_interval;
        });
}

function remove_axis() {
    // TODO
    ;
}

add_axis();
add_axis();
add_axis();

// Rectilinear projection of 3D lattice.
let phi = 2.0*Math.PI*0.75  // Angle of the lattice against the projection
let spios = Math.sin(Math.PI/6.0)
let k = 1.0/(1.0 + spios)
let s = scale_fig.horizontal_zoom*(1.0+1.0/spios)  // Scale
let shift_2 =  Math.log2(2.0) * s*k * Math.cos(phi);
let shift_3 =  Math.log2(3.0/2.0) * s*k * Math.cos(phi+2*Math.PI/3.0);
let shift_5 =  Math.log2(5.0/4.0) * s*k * Math.cos(phi+4*Math.PI/3.0);
yshift_onchange(2, shift_2);
yshift_onchange(3, shift_3);
yshift_onchange(5, shift_5);


harm_dist_step_onchange(2, 0.0);
harm_dist_step_onchange(3, 0.2);
harm_dist_step_onchange(5, 4.0);

add_base_tone([0,0,0]);

add_step_interval([1,0,0], "#000000");
add_step_interval([-1,1,0], "#001bac");
add_step_interval([-2,0,1], "#ac5f00");

