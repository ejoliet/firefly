

// This file contains a javascript implementation of HealpixIndex written by CDS.
// This code is from a minified version (healpix.min.js) in the Aladin distribution.
// I unminified it and made it an ES5 javascript module.

// The original healpix code is on: http://healpix.sourceforge.net/
// it was written in C the ported to other languages including java.
// The java Healpix code was expanded to include a class called healpix.core.HealpixIndex
// This is the javascript for of HealpixIndex.
// it has the following objects: HealpixIndex, AngularPosition, SpatialVector, LongRangeSetBuilder, Utils
// in java they are all part of the healpix.code package.
// docs:
// https://healpix.jpl.nasa.gov/html/java/healpix/core/HealpixIndex.html
// https://healpix.jpl.nasa.gov/html/java/healpix/tools/SpatialVector.html
// https://healpix.jpl.nasa.gov/html/java/healpix/core/base/set/LongRangeSet.html




const Constants = {};
Constants.PI = Math.PI;
Constants.C_PR = Math.PI / 180;
Constants.VLEV = 2; Constants.EPS = 1e-7;
Constants.c = .105;
Constants.LN10 = Math.log(10);
Constants.PIOVER2 = Math.PI / 2;
Constants.TWOPI = 2 * Math.PI;
Constants.TWOTHIRD = 2 / 3;
Constants.ARCSECOND_RADIAN = 484813681109536e-20;

export const SpatialVector = function() {
    function t(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.ra_ = 0;
        this.dec_ = 0;
        this.okRaDec_ = !1;
    }
    t.prototype.setXYZ = function(t, s, i) {
        this.x = t;
        this.y = s;
        this.z = i;
        this.okRaDec_ = !1;
    };
    t.prototype.length = function() {
        return Math.sqrt(this.lengthSquared());
    };
    t.prototype.lengthSquared = function() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    };
    t.prototype.normalized = function() {
        const t = this.length();
        this.x /= t;
        this.y /= t;
        this.z /= t;
    };
    t.prototype.set = function(lon, lat) {
        this.ra_ = lon;
        this.dec_ = lat;
        this.okRaDec_ = !0;
        this.updateXYZ();
    };
    t.prototype.angle = function(v1) {
        const s = this.y * v1.z - this.z * v1.y;
        const i = this.z * v1.x - this.x * v1.z;
        const n = this.x * v1.y - this.y * v1.x;
        const a = Math.sqrt(s * s + i * i + n * n);
        return Math.abs(Math.atan2(a, this.dot(v1)));
    };
    t.prototype.get = function() {
        return [this.x, this.y, this.z];
    };
    t.prototype.toString = function() {
        return 'SpatialVector[' + this.x + ', ' + this.y + ', ' + this.z + ']';
    };
    t.prototype.cross = function(s) {
        return new t(this.y * s.z - s.y * this.z, this.z * s.x - s.z * this.x, this.x * s.y - s.x() * this.y);
    };
    t.prototype.equal = function(t) {
        return this.x ===t.x && this.y ===t.y && this.z ===t.z() ? !0 : !1;
    };
    t.prototype.mult = function(s) {
        return new t(s * this.x, s * this.y, s * this.z);
    };
    t.prototype.dot = function(v1) {
        return this.x * v1.x + this.y * v1.y + this.z * v1.z;
    };
    t.prototype.add = function(s) {
        return new t(this.x + s.x, this.y + s.y, this.z + s.z);
    };
    t.prototype.sub = function(s) {
        return new t(this.x - s.x, this.y - s.y, this.z - s.z);
    };
    t.prototype.dec = function() {
        return this.okRaDec_ || (this.normalized(), this.updateRaDec()), this.dec_;
    };
    t.prototype.ra = function() {
        return this.okRaDec_ || (this.normalized(), this.updateRaDec()), this.ra_;
    };
    t.prototype.updateXYZ = function() {
        const t = Math.cos(this.dec_ * Constants.C_PR);
        this.x = Math.cos(this.ra_ * Constants.C_PR) * t, this.y = Math.sin(this.ra_ * Constants.C_PR) * t, this.z = Math.sin(this.dec_ * Constants.C_PR);
    };
    t.prototype.updateRaDec = function() {
        this.dec_ = Math.asin(this.z) / Constants.C_PR;
        const t = Math.cos(this.dec_ * Constants.C_PR);
        this.ra_ = t > Constants.EPS || -Constants.EPS > t ? this.y > Constants.EPS || this.y < -Constants.EPS ? 0 > this.y ? 360 - Math.acos(this.x / t) / Constants.C_PR : Math.acos(this.x / t) / Constants.C_PR : 0 > this.x ? 180 : 0 : 0, this.okRaDec_ = !0;
    };
    t.prototype.toRaRadians = function() {
        let t = 0;
        return (0 !==this.x || 0 !==this.y) && (t = Math.atan2(this.y, this.x)), 0 > t && (t += 2 * Math.PI), t;
    };
    t.prototype.toDeRadians = function() {
        const t = this.z / this.length();
        const s = Math.acos(t);
        return Math.PI / 2 - s;
    };
    return t;
}();

export const AngularPosition = function() {
    let AngularPosition = function(theta, phi) {
        this.theta = theta;
        this.phi = phi;
    };
    AngularPosition.prototype.toString = function() {
        return 'theta: ' + this.theta + ', phi: ' + this.phi;
    };
    return AngularPosition;
}();

export const LongRangeSetBuilder = function() {
    function t() {
        this.items = [];
    }
    t.prototype.appendRange = function(t, s) {
        for (let i = t; s >= i; i++) i in this.items || this.items.push(i);
    };
    return t;
}();

export const HealpixIndex = function() {
    function t(nside) {
        this.nside = nside;
    }
    t.NS_MAX = 8192;
    t.ORDER_MAX = 13;
    t.NSIDELIST = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
    t.JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
    t.JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];
    t.XOFFSET = [-1, -1, 0, 1, 1, 1, 0, -1];
    t.YOFFSET = [0, 1, 1, 1, 0, -1, -1, -1];
    t.FACEARRAY = [
        [8, 9, 10, 11, -1, -1, -1, -1, 10, 11, 8, 9],
        [5, 6, 7, 4, 8, 9, 10, 11, 9, 10, 11, 8],
        [-1, -1, -1, -1, 5, 6, 7, 4, -1, -1, -1, -1],
        [4, 5, 6, 7, 11, 8, 9, 10, 11, 8, 9, 10],
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        [1, 2, 3, 0, 0, 1, 2, 3, 5, 6, 7, 4],
        [-1, -1, -1, -1, 7, 4, 5, 6, -1, -1, -1, -1],
        [3, 0, 1, 2, 3, 0, 1, 2, 4, 5, 6, 7],
        [2, 3, 0, 1, -1, -1, -1, -1, 0, 1, 2, 3]
    ];
    t.SWAPARRAY = [
        [0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3],
        [0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 6],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [6, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0],
        [3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0]
    ];
    t.Z0 = Constants.TWOTHIRD;
    t.prototype.init = function() {
        const s = 256;
        this.ctab = Array(s);
        this.utab = Array(s);
        for (let i = 0; 256 > i; ++i) this.ctab[i] = 1 & i | (2 & i) << 7 | (4 & i) >> 1 | (8 & i) << 6 | (16 & i) >> 2 | (32 & i) << 5 | (64 & i) >> 3 | (128 & i) << 4, this.utab[i] = 1 & i | (2 & i) << 1 | (4 & i) << 2 | (8 & i) << 3 | (16 & i) << 4 | (32 & i) << 5 | (64 & i) << 6 | (128 & i) << 7;
        this.nl2 = 2 * this.nside, this.nl3 = 3 * this.nside, this.nl4 = 4 * this.nside, this.npface = this.nside * this.nside, this.ncap = 2 * this.nside * (this.nside - 1), this.npix = 12 * this.npface, this.fact2 = 4 / this.npix, this.fact1 = (this.nside << 1) * this.fact2, this.order = t.nside2order(this.nside);
    };
    t.calculateNSide = function(s) {
        for (var i = 0, n = s * s, a = 180 / Constants.PI, e = 3600 * 3600 * 4 * Constants.PI * a * a, h = Utils.castToInt(e / n), r = h / 12, o = Math.sqrt(r), c = t.NS_MAX, u = 0, p = 0; t.NSIDELIST.length > p; p++) {
            if (c >= Math.abs(o - t.NSIDELIST[p]) && (c = Math.abs(o - t.NSIDELIST[p]), i = t.NSIDELIST[p], u = p), o > i && t.NS_MAX > o && (i = t.NSIDELIST[u + 1]), o > t.NS_MAX) return console.log('nside cannot be bigger than ' + t.NS_MAX), t.NS_MAX;
        }
        return i;
    };
    t.nside2order = function(nside) {
        return (nside & nside - 1) > 0 ? -1 : Utils.castToInt(t.log2(nside));
    };
    t.log2 = function(t) {
        return Math.log(t) / Math.log(2);
    };
    t.prototype.ang2pix_nest = function(theta, phi) {
        let a, e, h, r, o, c, u, p, l, d, f, I;
        if (phi >= Constants.TWOPI && (phi -= Constants.TWOPI), 0 > phi && (phi += Constants.TWOPI), theta > Constants.PI || 0 > theta) {
            throw {
                name: 'Illegal argument',
                message: 'theta must be between 0 and ' + Constants.PI
            };
        }
        if (phi > Constants.TWOPI || 0 > phi) {
            throw {
                name: 'Illegal argument',
                message: 'phi must be between 0 and ' + Constants.TWOPI
            };
        }
        if (a = Math.cos(theta), e = Math.abs(a), h = phi / Constants.PIOVER2, t.Z0 >= e) {
            const M = this.nside * (.5 + h);
            const y = this.nside * .75 * a;
            const u = M - y;
            const p = M + y;
            o = u >> this.order, c = p >> this.order, d = o=== c ? 4=== o ? 4 : o + 4 : c > o ? o : c + 8, f = Utils.castToInt(p & this.nside - 1), I = Utils.castToInt(this.nside - (u & this.nside - 1) - 1);
        } else {
            l = Utils.castToInt(h), l >= 4 && (l = 3), r = h - l;
            const g = this.nside * Math.sqrt(3 * (1 - e));
            u = Utils.castToInt(r * g), p = Utils.castToInt((1 - r) * g), u = Math.min(t.NS_MAX - 1, u), p = Math.min(t.NS_MAX - 1, p), a >= 0 ? (d = l, f = Utils.castToInt(this.nside - p - 1), I = Utils.castToInt(this.nside - u - 1)) : (d = l + 8, f = u, I = p);
        }
        return this.xyf2nest(f, I, d);
    };
    t.prototype.xyf2nest = function(t, s, i) {
        return (i << 2 * this.order) + (this.utab[255 & t] | this.utab[255 & t >> 8] << 16 | this.utab[255 & t >> 16] << 32 | this.utab[255 & t >> 24] << 48 | this.utab[255 & s] << 1 | this.utab[255 & s >> 8] << 17 | this.utab[255 & s >> 16] << 33 | this.utab[255 & s >> 24] << 49);
    };
    t.prototype.nest2xyf = function(t) {
        const s = {};
        s.face_num = t >> 2 * this.order;
        let i = t & this.npface - 1,
            n = (93823560581120 & i) >> 16 | (614882086624428e4 & i) >> 31 | 21845 & i | (1431633920 & i) >> 15;
        return s.ix = this.ctab[255 & n] | this.ctab[255 & n >> 8] << 4 | this.ctab[255 & n >> 16] << 16 | this.ctab[255 & n >> 24] << 20, i >>= 1, n = (93823560581120 & i) >> 16 | (614882086624428e4 & i) >> 31 | 21845 & i | (1431633920 & i) >> 15, s.iy = this.ctab[255 & n] | this.ctab[255 & n >> 8] << 4 | this.ctab[255 & n >> 16] << 16 | this.ctab[255 & n >> 24] << 20, s;
    };
    t.prototype.pix2ang_nest = function(ipix) {
        if (0 > ipix || ipix > this.npix - 1) {
            throw {
                name: 'Illegal argument',
                message: 'ipix out of range'
            };
        }
        let i, n, a;
        const e = this.nest2xyf(ipix);
        const h = e.ix;
        const r = e.iy;
        const o = e.face_num;
        const c = (t.JRLL[o] << this.order) - h - r - 1;
        this.nside > c ? (i = c, n = 1 - i * i * this.fact2, a = 0) : c > this.nl3 ? (i = this.nl4 - c, n = i * i * this.fact2 - 1, a = 0) : (i = this.nside, n = (this.nl2 - c) * this.fact1, a = 1 & c - this.nside);
        const theta = Math.acos(n);
        let p = (t.JPLL[o] * i + h - r + 1 + a) / 2;
        p > this.nl4 && (p -= this.nl4);
        1 > p && (p += this.nl4);
        const phi = (p - .5 * (a + 1)) * (Constants.PIOVER2 / i);
        return { theta, phi };
    };
    t.nside2Npix = function(nside) {
        if (0 > nside || (nside & -nside) !==nside || nside > t.NS_MAX) {
            throw {
                name: 'Illegal argument',
                message: 'nside should be >0, power of 2, <' + t.NS_MAX
            };
        }
        const i = 12 * nside * nside;
        return i;
    };
    t.prototype.xyf2ring = function(s, i, n) {
        var a, e, h, r = t.JRLL[n] * this.nside - s - i - 1;
        this.nside > r ? (a = r, h = 2 * a * (a - 1), e = 0) : r > 3 * this.nside ? (a = this.nl4 - r, h = this.npix - 2 * (a + 1) * a, e = 0) : (a = this.nside, h = this.ncap + (r - this.nside) * this.nl4, e = 1 & r - this.nside);
        var o = (t.JPLL[n] * a + s - i + 1 + e) / 2;
        return o > this.nl4 ? o -= this.nl4 : 1 > o && (o += this.nl4), h + o - 1;
    };
    t.prototype.nest2ring = function(t) {
        const s = this.nest2xyf(t);
        const i = this.xyf2ring(s.ix, s.iy, s.face_num);
        return i;
    };
    t.prototype.corners_nest = function(t, s) {
        const i = this.nest2ring(t);
        return this.corners_ring(i, s);
    };
    t.prototype.pix2ang_ring = function(t) {
        let s, i, n, a, e, h, r, o, c;
        if (0 > t || t > this.npix - 1) {
            throw {
                name: 'Illegal argument',
                message: 'ipix out of range'
            };
        }
        return h = t + 1, this.ncap >= h ? (o = h / 2, c = Utils.castToInt(o), n = Utils.castToInt(Math.sqrt(o - Math.sqrt(c))) + 1, a = h - 2 * n * (n - 1), s = Math.acos(1 - n * n * this.fact2), i = (a - .5) * Constants.PI / (2 * n)) : this.npix - this.ncap > t ? (e = t - this.ncap, n = e / this.nl4 + this.nside, a = e % this.nl4 + 1, r = (1 & n + this.nside) > 0 ? 1 : .5, s = Math.acos((this.nl2 - n) * this.fact1), i = (a - r) * Constants.PI / this.nl2) : (e = this.npix - t, n = Utils.castToInt(.5 * (1 + Math.sqrt(2 * e - 1))), a = 4 * n + 1 - (e - 2 * n * (n - 1)), s = Math.acos(-1 + Math.pow(n, 2) * this.fact2), i = (a - .5) * Constants.PI / (2 * n)), [s, i];
    };
    t.prototype.ring = function(ipix) {
        let s, i, n = 0;
        const a = ipix + 1;
        let   e = 0;
        return this.ncap >= a ? (i = a / 2, e = Utils.castToInt(i), n = Utils.castToInt(Math.sqrt(i - Math.sqrt(e))) + 1) : this.nl2 * (5 * this.nside + 1) >= a ? (s = Utils.castToInt(a - this.ncap - 1), n = Utils.castToInt(s / this.nl4 + this.nside)) : (s = this.npix - a + 1, i = s / 2, e = Utils.castToInt(i), n = Utils.castToInt(Math.sqrt(i - Math.sqrt(e))) + 1, n = this.nl4 - n), n;
    };
    t.prototype.integration_limits_in_costh = function(t) {
        let s, i, n, a;
        return a = 1 * this.nside, this.nside >= t ? (i = 1 - Math.pow(t, 2) / 3 / this.npface, n = 1 - Math.pow(t - 1, 2) / 3 / this.npface, s = t == this.nside ? 2 * (this.nside - 1) / 3 / a : 1 - Math.pow(t + 1, 2) / 3 / this.npface) : this.nl3 > t ? (i = 2 * (2 * this.nside - t) / 3 / a, n = 2 * (2 * this.nside - t + 1) / 3 / a, s = 2 * (2 * this.nside - t - 1) / 3 / a) : (n = t == this.nl3 ? 2 * (-this.nside + 1) / 3 / a : -1 + Math.pow(4 * this.nside - t + 1, 2) / 3 / this.npface, s = -1 + Math.pow(this.nl4 - t - 1, 2) / 3 / this.npface, i = -1 + Math.pow(this.nl4 - t, 2) / 3 / this.npface), [n, i, s];
    };
    t.prototype.pixel_boundaries = function(i_th, i_phi, i_zone, cos_theta) {
        let a, e, h, r, o, c, u, p;
        const l = 1 * this.nside;
        if (Math.abs(cos_theta) >= 1 - 1 / 3 / this.npface) return u = i_zone * Constants.PIOVER2, p = (i_zone + 1) * Constants.PIOVER2, [u, p];
        if (1.5 * cos_theta >= 1) a = Math.sqrt(3 * (1 - cos_theta)), e = 1 / l / a, h = i_phi, r = h - 1, o = i_th - i_phi, c = o + 1, u = Constants.PIOVER2 * (Math.max(r * e, 1 - c * e) + i_zone), p = Constants.PIOVER2 * (Math.min(1 - o * e, h * e) + i_zone);
        else if (1.5 * cos_theta > -1) {
            const d = .5 * (1 - 1.5 * cos_theta);
            const f = d + 1;
            const I = this.nside + i_th % 2;
            h = i_phi - (I - i_th) / 2, r = h - 1, o = (I + i_th) / 2 - i_phi, c = o + 1, u = Constants.PIOVER2 * (Math.max(f - c / l, -d + r / l) + i_zone), p = Constants.PIOVER2 * (Math.min(f - o / l, -d + h / l) + i_zone);
        } else {
            a = Math.sqrt(3 * (1 + cos_theta)), e = 1 / l / a;
            const M = 2 * this.nside;
            h = i_th - M + i_phi, r = h - 1, o = M - i_phi, c = o + 1, u = Constants.PIOVER2 * (Math.max(1 - (M - r) * e, (M - c) * e) + i_zone), p = Constants.PIOVER2 * (Math.min(1 - (M - h) * e, (M - o) * e) + i_zone);
        }
        return [u, p];
    };
    t.vector = function(theta, phi) {
        const i = Math.sin(theta) * Math.cos(phi);
        const n = Math.sin(theta) * Math.sin(phi);
        const a = Math.cos(theta);
        return new SpatialVector(i, n, a);
    };
    t.prototype.corners_ring = function(s, i) {
        var n = 2 * i + 2,
            a = Array(n),
            e = this.pix2ang_ring(s),
            h = Math.cos(e[0]),
            r = e[0],
            o = e[1],
            c = Utils.castToInt(o / Constants.PIOVER2),
            u = this.ring(s),
            p = Math.min(u, Math.min(this.nside, this.nl4 - u)),
            l = 0,
            d = Constants.PIOVER2 / p;
        l = u >= this.nside && this.nl3 >= u ? Utils.castToInt(o / d + u % 2 / 2) + 1 : Utils.castToInt(o / d) + 1, l -= c * p;
        var f = n / 2,
            I = this.integration_limits_in_costh(u),
            M = Math.acos(I[0]),
            y = Math.acos(I[2]),
            g = this.pixel_boundaries(u, l, c, I[0]);
        if (a[0] = l > p / 2 ? t.vector(M, g[1]) : t.vector(M, g[0]), g = this.pixel_boundaries(u, l, c, I[2]), a[f] = l > p / 2 ? t.vector(y, g[1]) : t.vector(y, g[0]), 1 == i) {
            var P = Math.acos(I[1]);
            g = this.pixel_boundaries(u, l, c, I[1]), a[1] = t.vector(P, g[0]), a[3] = t.vector(P, g[1]);
        } else {
            for (var x = I[2] - I[0], C = x / (i + 1), v = 1; i >= v; v++) h = I[0] + C * v, r = Math.acos(h), g = this.pixel_boundaries(u, l, c, h), a[v] = t.vector(r, g[0]), a[n - v] = t.vector(r, g[1]);
        }
        return a;
    };
    t.vec2Ang = function(spatialVector) {
        const s = spatialVector.z / spatialVector.length();
        const i = Math.acos(s);
        let n = 0;
        return (0 !==spatialVector.x || 0 !==spatialVector.y) && (n = Math.atan2(spatialVector.y, spatialVector.x)), 0 > n && (n += 2 * Math.PI), [i, n];
    };
    t.prototype.queryDisc = function(spatialVactor, radius, nest, inclusive) {
        if (0 > radius || radius > Constants.PI) {
            throw {
                name: 'Illegal argument',
                message: 'angular radius is in RADIAN and should be in [0,pi]'
            };
        }
        var e, h, r, o, c, u, p, l, d, f, I, M, y, g, P, x, C, v, _, R = new LongRangeSetBuilder,
            T = null,
            c = radius;
        if (inclusive && (c += Constants.PI / this.nl4), T = t.vec2Ang(spatialVactor), u = T[0], p = T[1], I = this.fact2, M = this.fact1, o = Math.cos(u), _ = 1 / Math.sqrt((1 - o) * (1 + o)), g = u - c, P = u + c, l = Math.cos(c), C = Math.cos(g), e = this.ringAbove(C) + 1, x = Math.cos(P), h = this.ringAbove(x), e > h && 0 == h && (h = e), 0 >= g) {
            for (let m = 1; e > m; ++m) this.inRing(m, 0, Math.PI, R);
        }
        for (r = e; h >= r; ++r) v = this.nside > r ? 1 - r * r * I : this.nl3 >= r ? (this.nl2 - r) * M : -1 + (this.nl4 - r) * (this.nl4 - r) * I, d = (l - v * o) * _, f = 1 - v * v - d * d, y = Math.atan2(Math.sqrt(f), d), isNaN(y) && (y = c), this.inRing(r, p, y, R);
        if (P >= Math.PI) {
            for (let m = h + 1; this.nl4 > m; ++m) this.inRing(m, 0, Math.PI, R, !1);
        }
        let b;
        if (nest) {
            for (var S = R.items, U = [], A = 0; S.length > A; A++) {
                var O = this.ring2nest(S[A]);
                U.indexOf(O) >= 0 || U.push(O);
            }
            b = U;
        } else b = R.items;
        return b;
    };
    t.prototype.inRing = function(t, s, i, n, a) {
        var e, h, r, o, c = !1,
            u = !1,
            p = 1e-12,
            l = 0,
            d = 0,
            f = 0,
            I = 0,
            M = (s - i) % Constants.TWOPI - p,
            y = s + i + p,
            g = (s + i) % Constants.TWOPI + p;
        if (p > Math.abs(i - Constants.PI) && (c = !0), t >= this.nside && this.nl3 >= t ? (d = t - this.nside + 1, r = this.ncap + this.nl4 * (d - 1), o = r + this.nl4 - 1, e = d % 2, h = this.nl4) : (this.nside > t ? (d = t, r = 2 * d * (d - 1), o = r + 4 * d - 1) : (d = 4 * this.nside - t, r = this.npix - 2 * d * (d + 1), o = r + 4 * d - 1), h = 4 * d, e = 1), c) return n.appendRange(r, o), void 0;
        if (l = e / 2, a) f = Math.round(h * M / Constants.TWOPI - l), I = Math.round(h * y / Constants.TWOPI - l), f %= h, I > h && (I %= h);
        else {
            if (f = Math.ceil(h * M / Constants.TWOPI - l), I = Utils.castToInt(h * g / Constants.TWOPI - l), f > I && 1 == t && (I = Utils.castToInt(h * y / Constants.TWOPI - l)), f == I + 1 && (f = I), 1 == f - I && Constants.PI > i * h) return console.log('the interval is too small and avay from center'), void 0;
            f = Math.min(f, h - 1), I = Math.max(I, 0);
        }
        if (f > I && (u = !0), u) f += r, I += r, n.appendRange(r, I), n.appendRange(f, o);
        else {
            if (0 > f) return f = Math.abs(f), n.appendRange(r, r + I), n.appendRange(o - f + 1, o), void 0;
            f += r, I += r, n.appendRange(f, I);
        }
    };
    t.prototype.ringAbove = function(t) {
        const s = Math.abs(t);
        if (s > Constants.TWOTHIRD) {
            const i = Utils.castToInt(this.nside * Math.sqrt(3 * (1 - s)));
            return t > 0 ? i : 4 * this.nside - i - 1;
        }
        return Utils.castToInt(this.nside * (2 - 1.5 * t));
    };
    t.prototype.ring2nest = function(t) {
        const s = this.ring2xyf(t);
        return this.xyf2nest(s.ix, s.iy, s.face_num);
    };
    t.prototype.ring2xyf = function(s) {
        let i, n, a, e;
        const h = {};
        if (this.ncap > s) {
            i = Utils.castToInt(.5 * (1 + Math.sqrt(1 + 2 * s))), n = s + 1 - 2 * i * (i - 1), a = 0, e = i, h.face_num = 0;
            let r = n - 1;
            r >= 2 * i && (h.face_num = 2, r -= 2 * i), r >= i && ++h.face_num;
        } else if (this.npix - this.ncap > s) {
            const o = s - this.ncap;
            this.order >= 0 ? (i = (o >> this.order + 2) + this.nside, n = (o & this.nl4 - 1) + 1) : (i = o / this.nl4 + this.nside, n = o % this.nl4 + 1), a = 1 & i + this.nside, e = this.nside;
            var c, u, p = i - this.nside + 1,
                l = this.nl2 + 2 - p;
            this.order >= 0 ? (c = n - Utils.castToInt(p / 2) + this.nside - 1 >> this.order, u = n - Utils.castToInt(l / 2) + this.nside - 1 >> this.order) : (c = (n - Utils.castToInt(p / 2) + this.nside - 1) / this.nside, u = (n - Utils.castToInt(l / 2) + this.nside - 1) / this.nside), h.face_num = u == c ? 4 == u ? 4 : Utils.castToInt(u) + 4 : c > u ? Utils.castToInt(u) : Utils.castToInt(c) + 8;
        } else {
            const o = this.npix - s;
            i = Utils.castToInt(.5 * (1 + Math.sqrt(2 * o - 1))), n = 4 * i + 1 - (o - 2 * i * (i - 1)), a = 0, e = i, i = 2 * this.nl2 - i, h.face_num = 8;
            let r = n - 1;
            r >= 2 * e && (h.face_num = 10, r -= 2 * e), r >= e && ++h.face_num;
        }
        var d = i - t.JRLL[h.face_num] * this.nside + 1,
            f = 2 * n - t.JPLL[h.face_num] * e - a - 1;
        return f >= this.nl2 && (f -= 8 * this.nside), h.ix = f - d >> 1, h.iy = -(f + d) >> 1, h;
    };
    return t;
}();

export const Utils = function() {};
Utils.radecToPolar = function(ra, dec) {
    return {
        theta: Math.PI / 2 - dec / 180 * Math.PI,
        phi: ra / 180 * Math.PI
    };
};
Utils.polarToRadec = function(t, s) {
    return {
        ra: 180 * s / Math.PI,
        dec: 180 * (Math.PI / 2 - t) / Math.PI
    };
};
Utils.castToInt = function(t) {
    return t > 0 ? Math.floor(t) : Math.ceil(t);
};

