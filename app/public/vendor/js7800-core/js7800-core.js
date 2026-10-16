//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
};
//#endregion
//#region js7800-core/mouse-stub.js
function n() {
	return 0;
}
function r() {
	return 0;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Pokey.js
var i = 2048, a = 16384, o = 16385, s = 16386, c = 16387, l = 16388, ee = 16389, te = 16390, ne = 16391, re = 16392, ie = 16395, ae = 16399, oe = 16392, se = 16394, ce = 128, le = 64, ue = 32, de = 16, fe = 15, pe = 128, me = 64, he = 32, ge = 16, _e = 8, ve = 4, ye = 2, be = 1, xe = 28, Se = 114, Ce = 15, we = 31, Te = 511, Ee = 131071, u = 0, De = 1, Oe = 2, ke = 3, Ae = 3, je = 8, Me = 0, Ne = 1, Pe = 2, Fe = [
	0,
	0,
	0
], Ie = 0, Le = Array(i), Re = i - 512, ze = 1787520, Be = 31440, Ve = 0, He = [
	0,
	0,
	0,
	0
], Ue = [
	0,
	0,
	0,
	0
], d = 0, We = [
	0,
	0,
	0,
	0
], Ge = [
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	0
], Ke = [
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	1
], qe = Array(Te), Je = Array(Ee), Ye = 0, Xe = 0, Ze = 0, Qe = 0, $e = [
	0,
	0,
	0,
	0
], et = [
	0,
	0,
	0,
	0
], tt = 0, nt = 0, rt = Array(511), it = Array(131071), at = 0, ot = 0, st = 0, ct = 0, lt = 0, ut = [
	228,
	228,
	228,
	228,
	228,
	228,
	228,
	228
], dt = 0, ft = 0, pt = 0, mt = [
	1,
	1,
	0,
	0
];
function ht(e, t, n, r, i) {
	for (var a = (1 << t) - 1, o = 0, s = 0, c = 0; c < a; c++) t == 17 ? e[s] = o >>> 6 : e[s] = o, s++, o = (o << n) + (o >>> r) + i & a;
}
function gt(e) {
	e = 31440, Be = e, console.log("set pokey sample rate: %d", Be);
}
function _t() {
	for (var e = 511, t = e, n = 0; n < e; n++) {
		var r = t >> 0 & 1 ^ t >> 5 & 1;
		t >>= 1, t = r << 8 | t, qe[n] = t & 1;
	}
}
function vt() {
	for (var e = (1 << 17) - 1, t = e, n = 0; n < e; n++) {
		var r = t >> 8 & 1 ^ t >> 13 & 1, i = t & 1;
		t >>= 1, t = t & 65407 | r << 7, t = i << 16 | t, Je[n] = t & 1;
	}
}
function yt() {
	lt = 0, dt = 0, Ve = 0;
	for (let e = 0; e < 32; e++) Ct[e] = 0;
	_t(), vt(), Ye = 0, Xe = 0, Ze = 0, Qe = 0, tt = (ze << 8) / Be | 0, nt = 0;
	for (var e = u; e <= ke; e++) We[e] = 0, $e[e] = 0, Ue[e] = 0, He[e] = 0;
	for (var t = 0; t < 8; t++) ut[t] = 228;
	ht(rt, 9, 8, 1, 384), ht(it, 17, 16, 1, 114688), st = 0, ct = 0, d = 0, at = 0, ot = 0, ft = 0, pt = 0, mt[0] = 1, mt[1] = 1, mt[2] = 0, mt[3] = 0, At(!0);
}
function bt() {}
function xt() {
	ft += Ie, dt < 228 && dt++;
}
function St(e) {
	lt-- > 0 && console.log("pokey_getRegister: %d", e);
	var t = 0, n = e & 15;
	if (n < 8) {
		var r = ut[n];
		return r <= dt ? r : dt;
	}
	switch (e) {
		case oe:
			for (var r = 0, i = 0; i < 8; i++) ut[n] <= dt && (r &= ~(1 << i));
			return r;
		case se:
			var a = ft + Xf();
			if (st & Ae) {
				var o = a - pt >>> 2;
				at = (o + at) % 511 | 0, ot = (o + ot) % 131071 | 0;
			} else at = 0, ot = 0;
			ct = d & pe ? rt[at] : it[ot], pt = a, ct ^= 255, t = ct;
	}
	return t;
}
var Ct = Array(32);
function wt(e, t) {
	switch (lt-- > 0 && console.log("pokey_setRegister: %d %d", e - 16384, t), Ct[e - 16384] = t, e) {
		case ie:
			st & 4 || (dt = 0);
			return;
		case ae:
			st = t, t & 4 && (dt = 228);
			return;
		case a:
			He[u] = t;
			break;
		case o:
			Ue[u] = t;
			break;
		case s:
			He[De] = t;
			break;
		case c:
			Ue[De] = t;
			break;
		case l:
			He[Oe] = t;
			break;
		case ee:
			Ue[Oe] = t;
			break;
		case te:
			He[ke] = t;
			break;
		case ne:
			Ue[ke] = t;
			break;
		case re: d = t;
	}
}
function Tt(e, t) {
	$e[e] = $e[e] + 1 & 255, $e[e] == 0 && et[e] == 0 && (et[e] = t);
}
function Et(e) {
	return et[e] > 0 ? (et[e]--, et[e] == 0) : 0;
}
function Dt(e) {
	$e[e] = He[e] ^ 255, et[e] = 0;
}
function Ot(e) {
	(Ue[e] & ce || Ke[Xe]) && (Ue[e] & ue ? We[e] ^= 1 : We[e] = Ue[e] & le ? Ge[Ye] : d & pe ? qe[Ze] : Je[Qe]);
}
function kt(e) {
	for (var t = Le, n = Ve, r = [
		1,
		xe,
		Se
	], i = e, a; e;) {
		var o = 0;
		for (a = 0; a < Ie / 8; a++) {
			var s, c = [
				0,
				0,
				0
			], l = d & be ? Pe : Ne;
			if (st & Ae) {
				for (s = 0; s < 3; s++) Fe[s]++, Fe[s] >= r[s] && (Fe[s] = 0, c[s] = 1);
				Ye = (Ye + 1) % Ce, Xe = (Xe + 1) % we, Ze = (Ze + 1) % Te, Qe = (Qe + 1) % Ee, d & me && c[Me] && (d & ge ? Tt(u, 7) : Tt(u, 4)), !(d & me) && c[l] && Tt(u, 1), d & he && c[Me] && (d & _e ? Tt(Oe, 7) : Tt(Oe, 4)), !(d & he) && c[l] && Tt(Oe, 1), c[l] && (d & ge || Tt(De, 1), d & _e || Tt(ke, 1));
			}
			Et(Oe) && (d & _e ? Tt(ke, 1) : Dt(Oe), Ot(Oe), mt[u] = d & ve ? We[u] : 1), Et(ke) && (d & _e && Dt(Oe), Dt(ke), Ot(ke), mt[De] = d & ye ? We[De] : 1), st & je && et[De] == 1 && Dt(u), Et(u) && (d & ge ? Tt(De, 1) : Dt(u), Ot(u)), Et(De) && (d & ge && Dt(u), Dt(De), Ot(De));
			for (var ee = u; ee <= ke; ee++) o += (We[ee] ^ mt[ee] || Ue[ee] & de ? Ue[ee] & fe : 0) << 2;
		}
		o /= a, nt += tt, t[n] = o, n++, e--;
	}
	Ve += i, Ve >= Re && (Ve = 0);
}
function At(e) {
	if (Ve = 0, e) for (var t = 0; t < i; t++) Le[t] = 0;
}
function jt(e) {
	Ie = e;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/3rdparty/ym2151.js
var Mt = function(e, t) {
	for (var n in t) t.hasOwnProperty(n) && (e[n] = t[n]);
	function r() {
		this.constructor = e;
	}
	r.prototype = t.prototype, e.prototype = new r();
}, Nt;
(function(e) {
	e.FM_PGBITS = 9, e.FM_RATIOBITS = 7, e.FM_LFOBITS = 8, e.FM_TLBITS = 7, e.FM_TLENTS = 1 << e.FM_TLBITS, e.FM_LFOENTS = 1 << e.FM_LFOBITS, e.FM_CLENTS = 8192, e.FM_OPSINBITS = 10, e.FM_OPSINENTS = 1 << e.FM_OPSINBITS, e.FM_EG_BOTTOM = 955, e.IS2EC_SHIFT = 20 + e.FM_PGBITS - 13;
})(Nt || (Nt = {})), (function(e) {
	(function(e) {
		e[e.typeN = 0] = "typeN", e[e.typeM = 1] = "typeM";
	})(e.OpType || (e.OpType = {})), e.OpType, e.pmtable, e.amtable, e.tablemade = !1;
	var t = function() {
		function t() {
			this.chip_ = null, this.out_ = 0, this.out2_ = 0, this.in2_ = 0, this.dp_ = 0, this.detune_ = 0, this.detune2_ = 0, this.multiple_ = 0, this.pg_count_ = 0, this.pg_diff_ = 0, this.pg_diff_lfo_ = 0, this.bn_ = 0, this.eg_level_ = 0, this.eg_level_on_next_phase_ = 0, this.eg_count_ = 0, this.eg_count_diff_ = 0, this.eg_out_ = 0, this.tl_out_ = 0, this.eg_rate_ = 0, this.eg_curve_count_ = 0, this.key_scale_rate_ = 0, this.eg_phase_ = t.EGPhase.next, this.ms_ = 0, this.tl_ = 0, this.tl_latch_ = 0, this.ar_ = 0, this.dr_ = 0, this.sr_ = 0, this.sl_ = 0, this.rr_ = 0, this.ks_ = 0, this.keyon_ = !1, this.amon_ = !1, this.param_changed_ = !1, this.mute_ = !1, this.dbgopout_ = 0, this.dbgpgout_ = 0, t.tablehasmade || this.MakeTable(), this.ar_ = this.dr_ = this.sr_ = this.rr_ = this.key_scale_rate_ = 0, this.ams_ = e.amtable[0][0], this.mute_ = !1, this.keyon_ = !1, this.tl_out_ = 0, this.multiple_ = 0, this.detune_ = 0, this.detune2_ = 0, this.ms_ = 0;
		}
		return t.prototype.SetChip = function(e) {
			this.chip_ = e;
		}, t.prototype.Reset = function() {
			this.tl_ = this.tl_latch_ = 127, this.ShiftPhase(t.EGPhase.off), this.eg_count_ = 0, this.eg_curve_count_ = 0, this.pg_count_ = 0, this.out_ = this.out2_ = 0, this.param_changed_ = !0;
		}, t.prototype.MakeTable = function() {
			for (var n = 0, r = 0; r < 256; r++) {
				var i = Math.floor(2 ** (13 - r / 256));
				i = i + 2 & -4, t.cltable[n++] = i, t.cltable[n++] = -i;
			}
			for (; n < e.FM_CLENTS;) t.cltable[n] = t.cltable[n - 512] / 2 | 0, n++;
			for (r = 0; r < e.FM_OPSINENTS / 2; r++) {
				var a = (r * 2 + 1) * Math.PI / e.FM_OPSINENTS, o = -256 * Math.log(Math.sin(a)) / Math.LN2, s = Math.floor(o + .5) + 1;
				t.sinetable[r] = s * 2, t.sinetable[e.FM_OPSINENTS / 2 + r] = s * 2 + 1;
			}
			e.MakeLFOTable(), t.tablehasmade = !0;
		}, t.prototype.SetDPBN = function(e, t) {
			this.dp_ = e, this.bn_ = t, this.param_changed_ = !0;
		}, t.prototype.Prepare = function() {
			if (this.param_changed_) {
				switch (this.param_changed_ = !1, this.pg_diff_ = (this.dp_ + t.dttable[this.detune_ + this.bn_]) * this.chip_.GetMulValue(this.detune2_, this.multiple_), this.pg_diff_lfo_ = this.pg_diff_ >> 11, this.key_scale_rate_ = this.bn_ >> 3 - this.ks_, this.tl_out_ = this.mute_ ? 1023 : this.tl_ * 8, this.eg_phase_) {
					case t.EGPhase.attack:
						this.SetEGRate(this.ar_ ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0);
						break;
					case t.EGPhase.decay:
						this.SetEGRate(this.dr_ ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0), this.eg_level_on_next_phase_ = this.sl_ * 8;
						break;
					case t.EGPhase.sustain:
						this.SetEGRate(this.sr_ ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0);
						break;
					case t.EGPhase.release: this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_));
				}
				this.ams_ = e.amtable[this.type_][this.amon_ ? this.ms_ >> 4 & 3 : 0], this.EGUpdate(), this.dbgopout_ = 0;
			}
		}, t.prototype.ShiftPhase = function(n) {
			switch (n) {
				case t.EGPhase.attack: if (this.ar_ + this.key_scale_rate_ < 62) {
					this.SetEGRate(this.ar_ ? Math.min(63, this.ar_ + this.key_scale_rate_) : 0), this.eg_phase_ = t.EGPhase.attack;
					break;
				}
				case t.EGPhase.decay: if (this.sl_) {
					this.eg_level_ = 0, this.eg_level_on_next_phase_ = this.sl_ * 8, this.SetEGRate(this.dr_ ? Math.min(63, this.dr_ + this.key_scale_rate_) : 0), this.eg_phase_ = t.EGPhase.decay;
					break;
				}
				case t.EGPhase.sustain:
					this.eg_level_ = this.sl_ * 8, this.eg_level_on_next_phase_ = 1024, this.SetEGRate(this.sr_ ? Math.min(63, this.sr_ + this.key_scale_rate_) : 0), this.eg_phase_ = t.EGPhase.sustain;
					break;
				case t.EGPhase.release: if (this.eg_phase_ === t.EGPhase.attack || this.eg_level_ < e.FM_EG_BOTTOM) {
					this.eg_level_on_next_phase_ = 1024, this.SetEGRate(Math.min(63, this.rr_ + this.key_scale_rate_)), this.eg_phase_ = t.EGPhase.release;
					break;
				}
				case t.EGPhase.off:
				default: this.eg_level_ = e.FM_EG_BOTTOM, this.eg_level_on_next_phase_ = e.FM_EG_BOTTOM, this.EGUpdate(), this.SetEGRate(0), this.eg_phase_ = t.EGPhase.off;
			}
		}, t.prototype.SetFNum = function(e) {
			this.dp_ = (e & 2047) << (e >> 11 & 7), this.bn_ = t.notetable[e >> 7 & 127], this.param_changed_ = !0;
		}, t.prototype.LogToLin = function(n) {
			return n < e.FM_CLENTS ? t.cltable[n] : 0;
		}, t.prototype.EGUpdate = function() {
			this.eg_out_ = Math.min(this.tl_out_ + this.eg_level_, 1023) << 3;
		}, t.prototype.SetEGRate = function(e) {
			this.eg_rate_ = e, this.eg_count_diff_ = t.decaytable2[e >> 2] * this.chip_.GetRatio();
		}, t.prototype.EGCalc = function() {
			if (this.eg_count_ = 6141 << e.FM_RATIOBITS, this.eg_phase_ === t.EGPhase.attack) {
				var n = t.attacktable[this.eg_rate_][this.eg_curve_count_ & 7];
				n >= 0 && (this.eg_level_ -= 1 + (this.eg_level_ >> n), this.eg_level_ <= 0 && this.ShiftPhase(t.EGPhase.decay)), this.EGUpdate();
			} else this.eg_level_ += t.decaytable1[this.eg_rate_][this.eg_curve_count_ & 7], this.eg_level_ >= this.eg_level_on_next_phase_ && this.ShiftPhase(this.eg_phase_ + 1), this.EGUpdate();
			this.eg_curve_count_++;
		}, t.prototype.EGStep = function() {
			this.eg_count_ -= this.eg_count_diff_, this.eg_count_ <= 0 && this.EGCalc();
		}, t.prototype.PGCalc = function() {
			var e = this.pg_count_;
			return this.pg_count_ += this.pg_diff_, this.dbgpgout_ = e, e;
		}, t.prototype.PGCalcL = function() {
			var e = this.pg_count_;
			return this.pg_count_ += this.pg_diff_ + (this.pg_diff_lfo_ * this.chip_.GetPMV() >> 5), this.dbgpgout_ = e, e;
		}, t.prototype.Calc = function(n) {
			this.EGStep(), this.out2_ = this.out_;
			var r = this.PGCalc() >> 20 + e.FM_PGBITS - e.FM_OPSINBITS;
			return r += n >> 20 + e.FM_PGBITS - e.FM_OPSINBITS - (2 + e.IS2EC_SHIFT), this.out_ = this.LogToLin(this.eg_out_ + t.sinetable[r & e.FM_OPSINENTS - 1]), this.dbgopout_ = this.out_, this.out_;
		}, t.prototype.CalcL = function(n) {
			this.EGStep();
			var r = this.PGCalcL() >> 20 + e.FM_PGBITS - e.FM_OPSINBITS;
			return r += n >> 20 + e.FM_PGBITS - e.FM_OPSINBITS - (2 + e.IS2EC_SHIFT), this.out_ = this.LogToLin(this.eg_out_ + t.sinetable[r & e.FM_OPSINENTS - 1] + this.ams_[this.chip_.GetAML()]), this.dbgopout_ = this.out_, this.out_;
		}, t.prototype.CalcN = function(e) {
			this.EGStep();
			var t = Math.max(0, 1023 - (this.tl_out_ + this.eg_level_)) << 1;
			return e = (e & 1) - 1, this.out_ = t + e ^ e, this.dbgopout_ = this.out_, this.out_;
		}, t.prototype.CalcFB = function(n) {
			this.EGStep();
			var r = this.out_ + this.out2_;
			this.out2_ = this.out_;
			var i = this.PGCalc() >> 20 + e.FM_PGBITS - e.FM_OPSINBITS;
			return n < 31 && (i += r << 1 + e.IS2EC_SHIFT >> n >> 20 + e.FM_PGBITS - e.FM_OPSINBITS), this.out_ = this.LogToLin(this.eg_out_ + t.sinetable[i & e.FM_OPSINENTS - 1]), this.dbgopout_ = this.out2_, this.out2_;
		}, t.prototype.CalcFBL = function(n) {
			this.EGStep();
			var r = this.out_ + this.out2_;
			this.out2_ = this.out_;
			var i = this.PGCalcL() >> 20 + e.FM_PGBITS - e.FM_OPSINBITS;
			return n < 31 && (i += r << 1 + e.IS2EC_SHIFT >> n >> 20 + e.FM_PGBITS - e.FM_OPSINBITS), this.out_ = this.LogToLin(this.eg_out_ + t.sinetable[i & e.FM_OPSINENTS - 1] + this.ams_[this.chip_.GetAML()]), this.dbgopout_ = this.out_, this.out_;
		}, t.prototype.ResetFB = function() {
			this.out_ = this.out2_ = 0;
		}, t.prototype.KeyOn = function() {
			this.keyon_ || (this.keyon_ = !0, (this.eg_phase_ === t.EGPhase.off || this.eg_phase_ === t.EGPhase.release) && (this.ShiftPhase(t.EGPhase.attack), this.EGUpdate(), this.in2_ = this.out_ = this.out2_ = 0, this.pg_count_ = 0));
		}, t.prototype.KeyOff = function() {
			this.keyon_ && (this.keyon_ = !1, this.ShiftPhase(t.EGPhase.release));
		}, t.prototype.IsOn = function() {
			return this.eg_phase_ - t.EGPhase.off;
		}, t.prototype.SetDT = function(e) {
			this.detune_ = e * 32, this.param_changed_ = !0;
		}, t.prototype.SetDT2 = function(e) {
			this.detune2_ = e & 3, this.param_changed_ = !0;
		}, t.prototype.SetMULTI = function(e) {
			this.multiple_ = e, this.param_changed_ = !0;
		}, t.prototype.SetTL = function(e) {
			this.tl_ = e, this.param_changed_ = !0;
		}, t.prototype.SetAR = function(e) {
			this.ar_ = e, this.param_changed_ = !0;
		}, t.prototype.SetDR = function(e) {
			this.dr_ = e, this.param_changed_ = !0;
		}, t.prototype.SetSR = function(e) {
			this.sr_ = e, this.param_changed_ = !0;
		}, t.prototype.SetSL = function(e) {
			this.sl_ = e, this.param_changed_ = !0;
		}, t.prototype.SetRR = function(e) {
			this.rr_ = e, this.param_changed_ = !0;
		}, t.prototype.SetKS = function(e) {
			this.ks_ = e, this.param_changed_ = !0;
		}, t.prototype.SetAMON = function(e) {
			this.amon_ = e, this.param_changed_ = !0;
		}, t.prototype.Mute = function(e) {
			this.mute_ = e, this.param_changed_ = !0;
		}, t.prototype.SetMS = function(e) {
			this.ms_ = e, this.param_changed_ = !0;
		}, t.prototype.Out = function() {
			return this.out_;
		}, t.notetable = [
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			1,
			2,
			3,
			3,
			3,
			3,
			3,
			3,
			3,
			4,
			4,
			4,
			4,
			4,
			4,
			4,
			5,
			6,
			7,
			7,
			7,
			7,
			7,
			7,
			7,
			8,
			8,
			8,
			8,
			8,
			8,
			8,
			9,
			10,
			11,
			11,
			11,
			11,
			11,
			11,
			11,
			12,
			12,
			12,
			12,
			12,
			12,
			12,
			13,
			14,
			15,
			15,
			15,
			15,
			15,
			15,
			15,
			16,
			16,
			16,
			16,
			16,
			16,
			16,
			17,
			18,
			19,
			19,
			19,
			19,
			19,
			19,
			19,
			20,
			20,
			20,
			20,
			20,
			20,
			20,
			21,
			22,
			23,
			23,
			23,
			23,
			23,
			23,
			23,
			24,
			24,
			24,
			24,
			24,
			24,
			24,
			25,
			26,
			27,
			27,
			27,
			27,
			27,
			27,
			27,
			28,
			28,
			28,
			28,
			28,
			28,
			28,
			29,
			30,
			31,
			31,
			31,
			31,
			31,
			31,
			31
		], t.dttable = [
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			2,
			2,
			2,
			2,
			2,
			2,
			2,
			2,
			4,
			4,
			4,
			4,
			4,
			6,
			6,
			6,
			8,
			8,
			8,
			10,
			10,
			12,
			12,
			14,
			16,
			16,
			16,
			16,
			2,
			2,
			2,
			2,
			4,
			4,
			4,
			4,
			4,
			6,
			6,
			6,
			8,
			8,
			8,
			10,
			10,
			12,
			12,
			14,
			16,
			16,
			18,
			20,
			22,
			24,
			26,
			28,
			32,
			32,
			32,
			32,
			4,
			4,
			4,
			4,
			4,
			6,
			6,
			6,
			8,
			8,
			8,
			10,
			10,
			12,
			12,
			14,
			16,
			16,
			18,
			20,
			22,
			24,
			26,
			28,
			32,
			34,
			38,
			40,
			44,
			44,
			44,
			44,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			0,
			-2,
			-2,
			-2,
			-2,
			-2,
			-2,
			-2,
			-2,
			-4,
			-4,
			-4,
			-4,
			-4,
			-6,
			-6,
			-6,
			-8,
			-8,
			-8,
			-10,
			-10,
			-12,
			-12,
			-14,
			-16,
			-16,
			-16,
			-16,
			-2,
			-2,
			-2,
			-2,
			-4,
			-4,
			-4,
			-4,
			-4,
			-6,
			-6,
			-6,
			-8,
			-8,
			-8,
			-10,
			-10,
			-12,
			-12,
			-14,
			-16,
			-16,
			-18,
			-20,
			-22,
			-24,
			-26,
			-28,
			-32,
			-32,
			-32,
			-32,
			-4,
			-4,
			-4,
			-4,
			-4,
			-6,
			-6,
			-6,
			-8,
			-8,
			-8,
			-10,
			-10,
			-12,
			-12,
			-14,
			-16,
			-16,
			-18,
			-20,
			-22,
			-24,
			-26,
			-28,
			-32,
			-34,
			-38,
			-40,
			-44,
			-44,
			-44,
			-44
		], t.decaytable1 = [
			[
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				0,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				0,
				1,
				0
			],
			[
				1,
				1,
				1,
				0,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				0
			],
			[
				1,
				1,
				1,
				1,
				1,
				1,
				1,
				1
			],
			[
				2,
				1,
				1,
				1,
				2,
				1,
				1,
				1
			],
			[
				2,
				1,
				2,
				1,
				2,
				1,
				2,
				1
			],
			[
				2,
				2,
				2,
				1,
				2,
				2,
				2,
				1
			],
			[
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2
			],
			[
				4,
				2,
				2,
				2,
				4,
				2,
				2,
				2
			],
			[
				4,
				2,
				4,
				2,
				4,
				2,
				4,
				2
			],
			[
				4,
				4,
				4,
				2,
				4,
				4,
				4,
				2
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				4
			],
			[
				8,
				4,
				4,
				4,
				8,
				4,
				4,
				4
			],
			[
				8,
				4,
				8,
				4,
				8,
				4,
				8,
				4
			],
			[
				8,
				8,
				8,
				4,
				8,
				8,
				8,
				4
			],
			[
				16,
				16,
				16,
				16,
				16,
				16,
				16,
				16
			],
			[
				16,
				16,
				16,
				16,
				16,
				16,
				16,
				16
			],
			[
				16,
				16,
				16,
				16,
				16,
				16,
				16,
				16
			],
			[
				16,
				16,
				16,
				16,
				16,
				16,
				16,
				16
			]
		], t.decaytable2 = [
			1,
			2,
			4,
			8,
			16,
			32,
			64,
			128,
			256,
			512,
			1024,
			2047,
			2047,
			2047,
			2047,
			2047
		], t.attacktable = [
			[
				-1,
				-1,
				-1,
				-1,
				-1,
				-1,
				-1,
				-1
			],
			[
				-1,
				-1,
				-1,
				-1,
				-1,
				-1,
				-1,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				4
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				4
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				4
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				4
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				-1,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				-1,
				4,
				-1
			],
			[
				4,
				4,
				4,
				-1,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				-1
			],
			[
				4,
				4,
				4,
				4,
				4,
				4,
				4,
				4
			],
			[
				3,
				4,
				4,
				4,
				3,
				4,
				4,
				4
			],
			[
				3,
				4,
				3,
				4,
				3,
				4,
				3,
				4
			],
			[
				3,
				3,
				3,
				4,
				3,
				3,
				3,
				4
			],
			[
				3,
				3,
				3,
				3,
				3,
				3,
				3,
				3
			],
			[
				2,
				3,
				3,
				3,
				2,
				3,
				3,
				3
			],
			[
				2,
				3,
				2,
				3,
				2,
				3,
				2,
				3
			],
			[
				2,
				2,
				2,
				3,
				2,
				2,
				2,
				3
			],
			[
				2,
				2,
				2,
				2,
				2,
				2,
				2,
				2
			],
			[
				1,
				2,
				2,
				2,
				1,
				2,
				2,
				2
			],
			[
				1,
				2,
				1,
				2,
				1,
				2,
				1,
				2
			],
			[
				1,
				1,
				1,
				2,
				1,
				1,
				1,
				2
			],
			[
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			],
			[
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			]
		], t.tablehasmade = !1, t.sinetable = Array(1024), t.cltable = Array(e.FM_CLENTS), t.EGPhase = {
			next: 0,
			attack: 1,
			decay: 2,
			sustain: 3,
			release: 4,
			off: 5
		}, t;
	}();
	e.Operator = t, e.Channel4 = function() {
		function n() {
			this.op = [
				new t(),
				new t(),
				new t(),
				new t()
			], this.tablehasmade = !1, this.fb = 0, this.buf = [
				,
				,
				,
				,
			], this.inop = [
				,
				,
				,
			], this.outop = [
				,
				,
				,
			], this.algo_ = 0, this.chip_ = null, this.tablehasmade || this.MakeTable(), this.SetAlgorithm(0), this.pms = e.pmtable[0][0];
		}
		return n.prototype.MakeTable = function() {
			for (var e = 0; e < 64; e++) n.kftable[e] = 65536 * 2 ** (e / 768) | 0;
		}, n.prototype.SetChip = function(e) {
			this.chip_ = e;
			for (var t = 0; t < 4; t++) this.op[t].SetChip(e);
		}, n.prototype.Reset = function() {
			for (var e = 0; e < 4; e++) this.op[e].Reset();
		}, n.prototype.Prepare = function() {
			for (var t = 0; t < 4; t++) this.op[t].Prepare();
			return this.pms = e.pmtable[this.op[0].type_][this.op[0].ms_ & 7], (this.op[0].IsOn() | this.op[1].IsOn() | this.op[2].IsOn() | this.op[3].IsOn() ? 1 : 0) | (this.op[0].ms_ & (this.op[0].amon_ || this.op[1].amon_ || this.op[2].amon_ || this.op[3].amon_ ? 55 : 7) ? 2 : 0);
		}, n.prototype.SetFNum = function(e) {
			for (var t = 0; t < 4; t++) this.op[t].SetFNum(e);
		}, n.prototype.SetKCKF = function(e, t) {
			var r = [
				5197,
				5506,
				5833,
				6180,
				6180,
				6547,
				6937,
				7349,
				7349,
				7786,
				8249,
				8740,
				8740,
				9259,
				9810,
				10394
			], i = 19 - (e >> 4 & 7), a = r[e & 15];
			a = (a + 2) / 4 * 4;
			var o = a * n.kftable[t & 63];
			o >>= 19, o <<= 19, o >>= i;
			var s = e >> 2 & 31;
			this.op[0].SetDPBN(o, s), this.op[1].SetDPBN(o, s), this.op[2].SetDPBN(o, s), this.op[3].SetDPBN(o, s);
		}, n.prototype.KeyControl = function(e) {
			e & 1 ? this.op[0].KeyOn() : this.op[0].KeyOff(), e & 2 ? this.op[1].KeyOn() : this.op[1].KeyOff(), e & 4 ? this.op[2].KeyOn() : this.op[2].KeyOff(), e & 8 ? this.op[3].KeyOn() : this.op[3].KeyOff();
		}, n.prototype.SetAlgorithm = function(e) {
			var t = [
				[
					0,
					1,
					1,
					2,
					2,
					3
				],
				[
					1,
					0,
					0,
					1,
					1,
					2
				],
				[
					1,
					1,
					1,
					0,
					0,
					2
				],
				[
					0,
					1,
					2,
					1,
					1,
					2
				],
				[
					0,
					1,
					2,
					2,
					2,
					1
				],
				[
					0,
					1,
					0,
					1,
					0,
					1
				],
				[
					0,
					1,
					2,
					1,
					2,
					1
				],
				[
					1,
					0,
					1,
					0,
					1,
					0
				]
			];
			this.inop[0] = t[e][0], this.outop[0] = t[e][1], this.inop[1] = t[e][2], this.outop[1] = t[e][3], this.inop[2] = t[e][4], this.outop[2] = t[e][5], this.op[0].ResetFB(), this.algo_ = e;
		}, n.prototype.Calc = function() {
			var e;
			switch (this.algo_) {
				case 0:
					this.op[2].Calc(this.op[1].Out()), this.op[1].Calc(this.op[0].Out()), e = this.op[3].Calc(this.op[2].Out()), this.op[0].CalcFB(this.fb);
					break;
				case 1:
					this.op[2].Calc(this.op[0].Out() + this.op[1].Out()), this.op[1].Calc(0), e = this.op[3].Calc(this.op[2].Out()), this.op[0].CalcFB(this.fb);
					break;
				case 2:
					this.op[2].Calc(this.op[1].Out()), this.op[1].Calc(0), e = this.op[3].Calc(this.op[0].Out() + this.op[2].Out()), this.op[0].CalcFB(this.fb);
					break;
				case 3:
					this.op[2].Calc(0), this.op[1].Calc(this.op[0].Out()), e = this.op[3].Calc(this.op[1].Out() + this.op[2].Out()), this.op[0].CalcFB(this.fb);
					break;
				case 4:
					this.op[2].Calc(0), e = this.op[1].Calc(this.op[0].Out()), e += this.op[3].Calc(this.op[2].Out()), this.op[0].CalcFB(this.fb);
					break;
				case 5:
					e = this.op[2].Calc(this.op[0].Out()), e += this.op[1].Calc(this.op[0].Out()), e += this.op[3].Calc(this.op[0].Out()), this.op[0].CalcFB(this.fb);
					break;
				case 6:
					e = this.op[2].Calc(0), e += this.op[1].Calc(this.op[0].Out()), e += this.op[3].Calc(0), this.op[0].CalcFB(this.fb);
					break;
				case 7: e = this.op[2].Calc(0), e += this.op[1].Calc(0), e += this.op[3].Calc(0), e += this.op[0].CalcFB(this.fb);
			}
			return e;
		}, n.prototype.CalcL = function() {
			this.chip_.SetPMV(this.pms[this.chip_.GetPML()]);
			var e;
			switch (this.algo_) {
				case 0:
					this.op[2].CalcL(this.op[1].Out()), this.op[1].CalcL(this.op[0].Out()), e = this.op[3].CalcL(this.op[2].Out()), this.op[0].CalcFBL(this.fb);
					break;
				case 1:
					this.op[2].CalcL(this.op[0].Out() + this.op[1].Out()), this.op[1].CalcL(0), e = this.op[3].CalcL(this.op[2].Out()), this.op[0].CalcFBL(this.fb);
					break;
				case 2:
					this.op[2].CalcL(this.op[1].Out()), this.op[1].CalcL(0), e = this.op[3].CalcL(this.op[0].Out() + this.op[2].Out()), this.op[0].CalcFBL(this.fb);
					break;
				case 3:
					this.op[2].CalcL(0), this.op[1].CalcL(this.op[0].Out()), e = this.op[3].CalcL(this.op[1].Out() + this.op[2].Out()), this.op[0].CalcFBL(this.fb);
					break;
				case 4:
					this.op[2].CalcL(0), e = this.op[1].CalcL(this.op[0].Out()), e += this.op[3].CalcL(this.op[2].Out()), this.op[0].CalcFBL(this.fb);
					break;
				case 5:
					e = this.op[2].CalcL(this.op[0].Out()), e += this.op[1].CalcL(this.op[0].Out()), e += this.op[3].CalcL(this.op[0].Out()), this.op[0].CalcFBL(this.fb);
					break;
				case 6:
					e = this.op[2].CalcL(0), e += this.op[1].CalcL(this.op[0].Out()), e += this.op[3].CalcL(0), this.op[0].CalcFBL(this.fb);
					break;
				case 7: e = this.op[2].CalcL(0), e += this.op[1].CalcL(0), e += this.op[3].CalcL(0), e += this.op[0].CalcFBL(this.fb);
			}
			return e;
		}, n.prototype.CalcN = function(e) {
			this.buf[1] = this.buf[2] = this.buf[3] = 0, this.buf[0] = this.op[0].out_, this.op[0].CalcFB(this.fb), this.buf[this.outop[0]] += this.op[1].Calc(this.buf[this.inop[0]]), this.buf[this.outop[1]] += this.op[2].Calc(this.buf[this.inop[1]]);
			var t = this.op[3].out_;
			return this.op[3].CalcN(e), this.buf[this.outop[2]] + t;
		}, n.prototype.CalcLN = function(e) {
			this.chip_.SetPMV(this.pms[this.chip_.GetPML()]), this.buf[1] = this.buf[2] = this.buf[3] = 0, this.buf[0] = this.op[0].out_, this.op[0].CalcFBL(this.fb), this.buf[this.outop[0]] += this.op[1].CalcL(this.buf[this.inop[0]]), this.buf[this.outop[1]] += this.op[2].CalcL(this.buf[this.inop[1]]);
			var t = this.op[3].out_;
			return this.op[3].CalcN(e), this.buf[this.outop[2]] + t;
		}, n.prototype.SetType = function(e) {
			for (var t = 0; t < 4; t++) this.op[t].type_ = e;
		}, n.prototype.SetFB = function(e) {
			this.fb = n.fbtable[e];
		}, n.prototype.SetMS = function(e) {
			for (var t = 0; t < 4; t++) this.op[t].SetMS(e);
		}, n.prototype.Mute = function(e) {
			for (var t = 0; t < 4; t++) this.op[t].Mute(e);
		}, n.fbtable = [
			31,
			7,
			6,
			5,
			4,
			3,
			2,
			1
		], n.kftable = Array(64), n;
	}(), e.Chip = function() {
		function t() {
			this.ratio_ = 0, this.aml_ = 0, this.pml_ = 0, this.pmv_ = 0;
		}
		return t.prototype.SetRatio = function(e) {
			e = Math.round(e), this.ratio_ !== e && (this.ratio_ = e, this.MakeTable());
		}, t.prototype.SetAML = function(t) {
			this.aml_ = t & e.FM_LFOENTS - 1;
		}, t.prototype.SetPML = function(t) {
			this.pml_ = t & e.FM_LFOENTS - 1;
		}, t.prototype.SetPMV = function(e) {
			this.pmv_ = e;
		}, t.prototype.GetMulValue = function(e, t) {
			return this.multable_[e][t];
		}, t.prototype.GetAML = function() {
			return this.aml_;
		}, t.prototype.GetPML = function() {
			return this.pml_;
		}, t.prototype.GetPMV = function() {
			return this.pmv_;
		}, t.prototype.GetRatio = function() {
			return this.ratio_;
		}, t.prototype.MakeTable = function() {
			var t, n, r = [
				1,
				1.414,
				1.581,
				1.732
			];
			for (this.multable_ = [
				,
				,
				,
				,
			], t = 0; t < 4; t++) {
				var i = r[t] * this.ratio_ / (1 << 2 + e.FM_RATIOBITS - e.FM_PGBITS);
				for (this.multable_[t] = Array(16), n = 0; n < 16; n++) {
					var a = n ? n * 2 : 1;
					this.multable_[t][n] = a * i | 0;
				}
			}
		}, t;
	}();
	function n() {
		if (!e.tablemade) {
			e.tablemade = !0;
			var t, n = [[
				0,
				1 / 360,
				2 / 360,
				3 / 360,
				4 / 360,
				6 / 360,
				12 / 360,
				24 / 360
			], [
				0,
				1 / 480,
				2 / 480,
				4 / 480,
				10 / 480,
				20 / 480,
				80 / 480,
				140 / 480
			]], r = [[
				31,
				6,
				4,
				3
			], [
				31,
				2,
				1,
				0
			]];
			e.pmtable = [, ,], e.amtable = [, ,];
			for (var i = 0; i < 2; i++) {
				for (e.pmtable[i] = Array(8), t = 0; t < 8; t++) {
					var a = n[i][t];
					e.pmtable[i][t] = Array(e.FM_LFOENTS);
					for (var o = 0; o < e.FM_LFOENTS; o++) {
						2 ** (a * (2 * o - e.FM_LFOENTS + 1) / (e.FM_LFOENTS - 1));
						var s = .6 * a * Math.sin(2 * o * Math.PI / e.FM_LFOENTS) + 1;
						e.pmtable[i][t][o] = 65536 * (s - 1) | 0;
					}
				}
				for (e.amtable[i] = [
					,
					,
					,
					,
				], t = 0; t < 4; t++) {
					e.amtable[i][t] = Array(e.FM_LFOENTS);
					for (var o = 0; o < e.FM_LFOENTS; o++) e.amtable[i][t][o] = (o * 4 >> r[i][t]) * 2 << 2;
				}
			}
		}
	}
	e.MakeLFOTable = n;
})(Nt || (Nt = {})), (function(e) {
	e.Timer = function() {
		function e() {
			this.OPM_LFOENTS = 512, this.regtc = 0, this.regta = [, ,], this.timera = 0, this.timera_count = 0, this.timerb = 0, this.timerb_count = 0, this.timer_step = 0;
		}
		return e.prototype.Reset = function() {
			this.timera_count = 0, this.timerb_count = 0;
		}, e.prototype.SetTimerControl = function(e) {
			var t = this.regtc ^ e;
			this.regtc = e, e & 16 && this.ResetStatus(1), e & 32 && this.ResetStatus(2), t & 1 && (this.timera_count = e & 1 ? this.timera : 0), t & 2 && (this.timerb_count = e & 2 ? this.timerb : 0);
		}, e.prototype.SetTimerA = function(e, t) {
			var n;
			this.regta[e & 1] = t, n = (this.regta[0] << 2) + (this.regta[1] & 3), this.timera = (1024 - n) * this.timer_step;
		}, e.prototype.SetTimerB = function(e) {
			this.timerb = (256 - e) * this.timer_step;
		}, e.prototype.Count = function(e) {
			var t = !1;
			if (this.timera_count && (this.timera_count -= e << 16, this.timera_count <= 0)) {
				for (t = !0, this.TimerA(); this.timera_count <= 0;) this.timera_count += this.timera;
				this.regtc & 4 && this.SetStatus(1);
			}
			if (this.timerb_count && (this.timerb_count -= e << 12, this.timerb_count <= 0)) {
				for (t = !0; this.timerb_count <= 0;) this.timerb_count += this.timerb;
				this.regtc & 8 && this.SetStatus(2);
			}
			return t;
		}, e.prototype.GetNextEvent = function() {
			var e = (this.timera_count + 65535 >> 16) - 1, t = (this.timerb_count + 4095 >> 12) - 1;
			return (e < t ? e : t) + 1;
		}, e.prototype.SetTimerBase = function(e) {
			this.timer_step = 65536e6 / e | 0;
		}, e.prototype.SetStatus = function(e) {}, e.prototype.ResetStatus = function(e) {}, e.prototype.TimerA = function() {}, e;
	}();
})(Nt || (Nt = {})), (function(e) {
	e.OPM = function(t) {
		Mt(n, t);
		function n() {
			t.call(this), this.fmvolume = 0, this.clock = 0, this.rate = 0, this.pcmrate = 0, this.pmd = 0, this.amd = 0, this.lfocount = 0, this.lfodcount = 0, this.lfo_count_ = 0, this.lfo_count_diff_ = 0, this.lfo_step_ = 0, this.lfo_count_prev_ = 0, this.lfowaveform = 0, this.rateratio = 0, this.noise = 0, this.noisecount = 0, this.noisedelta = 0, this.interpolation = !1, this.lfofreq = 0, this.status = 0, this.reg01 = 0, this.kc = Array(8), this.kf = Array(8), this.pan = Array(8), this.ch = [
				new e.Channel4(),
				new e.Channel4(),
				new e.Channel4(),
				new e.Channel4(),
				new e.Channel4(),
				new e.Channel4(),
				new e.Channel4(),
				new e.Channel4()
			], this.chip = new e.Chip(), this.lfo_count_ = 0, this.lfo_count_prev_ = -1, this.BuildLFOTable();
			for (var n = 0; n < 8; n++) this.ch[n].SetChip(this.chip), this.ch[n].SetType(1);
		}
		n.prototype.Init = function(e, t) {
			return this.SetRate(e, t) ? (this.Reset(), this.SetVolume(0), this.SetChannelMask(0), !0) : !1;
		}, n.prototype.SetRate = function(e, t) {
			return this.clock = e, this.pcmrate = t, this.rate = t, this.RebuildTimeTable(), !0;
		}, n.prototype.SetChannelMask = function(e) {
			for (var t = 0; t < 8; t++) this.ch[t].Mute(!!(e & 1 << t));
		}, n.prototype.Reset = function() {
			for (var e = 0; e < 256; e++) this.SetReg(e, 0);
			for (this.SetReg(25, 128), t.prototype.Reset.call(this), this.status = 0, this.noise = 12345, this.noisecount = 0, e = 0; e < 8; e++) this.ch[e].Reset();
		}, n.prototype.RebuildTimeTable = function() {
			var t = this.clock / 64;
			this.rateratio = ((t << e.FM_RATIOBITS) + this.rate / 2) / this.rate, this.SetTimerBase(t), this.chip.SetRatio(this.rateratio);
		}, n.prototype.SetVolume = function(e) {
			e = Math.min(e, 20), this.fmvolume = e > -192 ? 16384 * 10 ** (e / 40) | 0 : 0;
		}, n.prototype.SetStatus = function(e) {
			this.status & e || (this.status |= e, this.Intr(!0));
		}, n.prototype.GetStatus = function(e) {
			return this.status;
		}, n.prototype.ResetStatus = function(e) {
			this.status & e && (this.status &= ~e, this.status || this.Intr(!1));
		}, n.prototype.SetReg = function(t, n) {
			if (!(t >= 256)) {
				var r = t & 7;
				switch (t & 255) {
					case 1:
						n & 2 && (this.lfo_count_ = 0, this.lfo_count_prev_ = -1), this.reg01 = n;
						break;
					case 8:
						this.regtc & 128 ? (r = n & 7, n & 8 || this.ch[r].op[0].KeyOff(), n & 16 || this.ch[r].op[1].KeyOff(), n & 32 || this.ch[r].op[2].KeyOff(), n & 64 || this.ch[r].op[3].KeyOff()) : this.ch[n & 7].KeyControl(n >> 3);
						break;
					case 16:
					case 17:
						this.SetTimerA(t, n);
						break;
					case 18:
						this.SetTimerB(n);
						break;
					case 20:
						this.SetTimerControl(n);
						break;
					case 24:
						this.lfofreq = n, this.lfo_count_diff_ = this.rateratio * (16 + (this.lfofreq & 15) << 12 - e.FM_RATIOBITS) / (1 << 15 - (this.lfofreq >> 4));
						break;
					case 25:
						n & 128 ? this.pmd = n & 127 : this.amd = n & 127;
						break;
					case 27:
						this.lfowaveform = n & 3;
						break;
					case 32:
					case 33:
					case 34:
					case 35:
					case 36:
					case 37:
					case 38:
					case 39:
						this.ch[r].SetFB(n >> 3 & 7), this.ch[r].SetAlgorithm(n & 7), this.pan[r] = n >> 6 & 3;
						break;
					case 40:
					case 41:
					case 42:
					case 43:
					case 44:
					case 45:
					case 46:
					case 47:
						this.kc[r] = n, this.ch[r].SetKCKF(this.kc[r], this.kf[r]);
						break;
					case 48:
					case 49:
					case 50:
					case 51:
					case 52:
					case 53:
					case 54:
					case 55:
						this.kf[r] = n >> 2, this.ch[r].SetKCKF(this.kc[r], this.kf[r]);
						break;
					case 56:
					case 57:
					case 58:
					case 59:
					case 60:
					case 61:
					case 62:
					case 63:
						this.ch[r].SetMS(n << 4 | n >> 4);
						break;
					case 15:
						this.noisedelta = n, this.noisecount = 0;
						break;
					default: t >= 64 && this.SetParameter(t, n);
				}
			}
		}, n.prototype.SetParameter = function(e, t) {
			var n = [
				0,
				4,
				8,
				12,
				16,
				20,
				24,
				28,
				32,
				36,
				40,
				44,
				48,
				52,
				56,
				124
			], r = [
				0,
				2,
				1,
				3
			][e >> 3 & 3], i = this.ch[e & 7].op[r];
			switch (e >> 5 & 7) {
				case 2:
					i.SetDT(t >> 4 & 7), i.SetMULTI(t & 15);
					break;
				case 3:
					i.SetTL(t & 127);
					break;
				case 4:
					i.SetKS(t >> 6 & 3), i.SetAR((t & 31) * 2);
					break;
				case 5:
					i.SetDR((t & 31) * 2), i.SetAMON(!!(t & 128));
					break;
				case 6:
					i.SetSR((t & 31) * 2), i.SetDT2(t >> 6 & 3);
					break;
				case 7: i.SetSL(n[t >> 4 & 15]), i.SetRR((t & 15) * 4 + 2);
			}
		}, n.prototype.BuildLFOTable = function() {
			this.amtable = [
				,
				,
				,
				,
			], this.pmtable = [
				,
				,
				,
				,
			];
			for (var e = 0; e < 4; e++) {
				var t = 0;
				this.amtable[e] = Array(this.OPM_LFOENTS), this.pmtable[e] = Array(this.OPM_LFOENTS);
				for (var n = 0; n < this.OPM_LFOENTS; n++) {
					var r, i;
					switch (e) {
						case 0:
							i = (n + 256 & 511) / 2 - 128, r = 255 - n / 2;
							break;
						case 1:
							r = n < 256 ? 255 : 0, i = n < 256 ? 127 : -128;
							break;
						case 2:
							i = n + 128 & 511, i = i < 256 ? i - 128 : 383 - i, r = n < 256 ? 255 - n : n - 256;
							break;
						case 3: n & 3 || (t = (Math.random() * 32768 | 0) / 17 & 255), r = t, i = t - 128;
					}
					this.amtable[e][n] = r | 0, this.pmtable[e][n] = -i - 1 | 0;
				}
			}
		}, n.prototype.LFO = function() {
			var e;
			this.lfowaveform === 3 ? (this.lfo_count_ ^ this.lfo_count_prev_) & -131072 && (e = (Math.random() * 32768 | 0) / 17 & 255, this.chip.SetPML((e - 128) * this.pmd / 128 + 128), this.chip.SetAML(e * this.amd / 128)) : (e = this.lfo_count_ >> 15 & 510, this.chip.SetPML(this.pmtable[this.lfowaveform][e] * this.pmd / 128 + 128), this.chip.SetAML(this.amtable[this.lfowaveform][e] * this.amd / 128)), this.lfo_count_prev_ = this.lfo_count_, this.lfo_step_++, this.lfo_step_ & 7 || (this.lfo_count_ += this.lfo_count_diff_);
		}, n.prototype.Noise = function() {
			if (this.noisecount += 2 * this.rateratio, this.noisecount >= 32 << e.FM_RATIOBITS) {
				var t = 32 - (this.noisedelta & 31);
				t === 1 && (t = 2), this.noisecount -= t << e.FM_RATIOBITS, (this.noisedelta & 31) == 31 && (this.noisecount -= e.FM_RATIOBITS), this.noise = this.noise >> 1 ^ (this.noise & 1 ? 33800 : 0);
			}
			return this.noise;
		}, n.prototype.MixSub = function(e, t) {
			e & 16384 && (t[this.pan[0]] = this.ch[0].Calc()), e & 4096 && (t[this.pan[1]] += this.ch[1].Calc()), e & 1024 && (t[this.pan[2]] += this.ch[2].Calc()), e & 256 && (t[this.pan[3]] += this.ch[3].Calc()), e & 64 && (t[this.pan[4]] += this.ch[4].Calc()), e & 16 && (t[this.pan[5]] += this.ch[5].Calc()), e & 4 && (t[this.pan[6]] += this.ch[6].Calc()), e & 1 && (this.noisedelta & 128 ? t[this.pan[7]] += this.ch[7].CalcN(this.Noise()) : t[this.pan[7]] += this.ch[7].Calc());
		}, n.prototype.MixSubL = function(e, t) {
			e & 16384 && (t[this.pan[0]] = this.ch[0].CalcL()), e & 4096 && (t[this.pan[1]] += this.ch[1].CalcL()), e & 1024 && (t[this.pan[2]] += this.ch[2].CalcL()), e & 256 && (t[this.pan[3]] += this.ch[3].CalcL()), e & 64 && (t[this.pan[4]] += this.ch[4].CalcL()), e & 16 && (t[this.pan[5]] += this.ch[5].CalcL()), e & 4 && (t[this.pan[6]] += this.ch[6].CalcL()), e & 1 && (this.noisedelta & 128 ? t[this.pan[7]] += this.ch[7].CalcLN(this.Noise()) : t[this.pan[7]] += this.ch[7].CalcL());
		};
		var r = [
			,
			,
			,
			,
		];
		return n.prototype.mixStereo = function(e, t, n) {
			var i = 0;
			1 / this.attenuation;
			for (var a = 0; a < 8; a++) i = i << 2 | this.ch[a].Prepare();
			this.reg01 & 2 && (i &= 21845);
			var o = n | 0;
			for (a = 0; a < t; a++) r[1] = r[2] = r[3] = 0, this.LFO(), i & 43690 ? this.MixSubL(i, r) : this.MixSub(i, r), e[o++] = (r[1] + r[3] + r[2] + r[3]) / 256 * .33;
		}, n.prototype.Intr = function(e) {}, n;
	}(e.Timer);
})(Nt || (Nt = {}));
var Pt = 3579545, Ft = new Nt.OPM(), It = Ft.Init(Pt, 48e3);
console.log("YM Init: " + It);
function Lt() {
	Ft.Reset();
	for (let e = 0; e < Rt.length; e++) Rt[e] = 0;
}
var Rt = Array(256);
function zt() {
	return Rt;
}
function Bt(e, t) {
	Rt[e] = t, Ft.SetReg(e, t);
}
function Vt(e, t, n) {
	Ft.mixStereo(e, t, n), Ft.Count(t);
}
function Ht(e) {
	console.log("Set YM sample rate: " + e), Ft.SetRate(Pt, e);
}
function Ut() {
	return Ft.GetStatus();
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Xm.js
var Wt = St, Gt = wt, Kt = 131072, qt = Array(Kt), Jt = !1, Yt = !1, Xt = !1, Zt = !1, Qt = !1, $t = !1, en = !1, tn = !1, nn = 0, rn = 0, an = 0, on = 0, sn = 0, cn = 0;
function ln() {
	for (var e = 0; e < Kt; e++) qt[e] = 0;
	Jt = !1, Yt = !1, Xt = !1, Zt = !1, Qt = !1, $t = !1, en = !1, tn = !1, nn = 0, rn = 0, an = 0, on = 0, sn = 0, cn = 0, Lt(), un = 0, dn = 2, fn = -1;
}
var un = 0, dn = 2, fn = -1;
function pn(e) {
	if (Yt && e >= 1104 && e < 1120) {
		var t = Wt(16384 + (e - 1104));
		return t;
	}
	if (Xt && e >= 1120 && e <= 1121) return t = e & 1 ? Ut() : 0, fn != -1 && e & 1 && (fn > 0 ? fn-- : fn == 0 && dn > 0 && (t = 2, fn = un, dn--, dn === 0 && (fn = -1))), t;
	if (Jt && e >= 16384 && e < 32768 && !en) {
		var n = e - 16384;
		if (Zt) return qt[n];
		if (Qt && n < 8192) return tn ? qt[(n & 8191) + (an & 15) * 8192 | (nn & 1) << 8] : qt[(n & 8191) + (rn & 15) * 8192 | (nn & 1) << 8];
		if ($t && n >= 8192 && n < 16384) return tn ? qt[(n & 8191) + (an >> 4 & 15) * 8192 | (nn & 2) << 7] : qt[(n & 8191) + (rn >> 4 & 15) * 8192 | (nn & 2) << 7];
	}
	return 0;
}
function mn(e, t) {
	if (Yt && e >= 1104 && e < 1120) Gt(16384 + (e - 1104), t);
	else if (Xt && e >= 1120 && e <= 1121) e & 1 ? (Bt(cn, t), cn === 18 && t === 252 && (un = 129, fn = un)) : cn = t;
	else if (Jt && e >= 16384 && e < 32768) {
		var n = e - 16384;
		Zt ? qt[n] = t : Qt && n < 8192 ? qt[(n & 8191) + (rn & 15) * 8192] = t : $t && n >= 8192 && n < 16384 && (qt[(n & 8191) + (rn >> 4 & 15) * 8192] = t);
	} else e >= 1136 && e < 1152 && (e == 1136 ? (nn = t, Yt = nn & 16, Qt = nn & 32, $t = nn & 64, Xt = nn & 128) : e == 1144 ? rn = t : e == 1148 ? an = t : e == 1137 ? on = t : e == 1138 && (sn = t, Zt = sn & 1, en = sn & 2), Jt = Zt || Qt || $t);
}
function hn() {
	return Yt;
}
function gn(e) {
	Yt = e;
}
function _n() {
	return Jt;
}
function vn(e) {
	Jt = e;
}
function yn() {
	return Xt;
}
function bn(e) {
	Xt = e;
}
function xn(e) {
	tn = e;
}
function Sn() {
	return Zt;
}
function Cn(e) {
	Zt = e;
}
function wn() {
	return Qt;
}
function Tn(e) {
	Qt = e;
}
function En() {
	return $t;
}
function Dn(e) {
	$t = e;
}
function On() {
	return en;
}
function kn(e) {
	en = e;
}
function An() {
	return tn;
}
function jn() {
	return nn;
}
function Mn(e) {
	nn = e;
}
function Nn() {
	return rn;
}
function Pn(e) {
	rn = e;
}
function Fn() {
	return an;
}
function In(e) {
	an = e;
}
function Ln() {
	return on;
}
function Rn(e) {
	on = e;
}
function zn() {
	return sn;
}
function Bn(e) {
	sn = e;
}
function Vn() {
	return cn;
}
function Hn(e) {
	cn = e;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/common/events-common.js
var Un = {}, Wn = null;
function f(e, t) {
	this.topic = e, t && (this.onEvent = t);
}
f.prototype = {
	getTopic: function() {
		return this.topic;
	},
	onEvent: function(e) {}
};
function Gn(e) {
	if (Wn) {
		var t = new Wn.Listener();
		t.getTopic = function() {
			return e.getTopic();
		}, t.onEvent = function(t) {
			e.onEvent(t);
		}, Wn.addListener(t);
	} else {
		var n = e.getTopic(), r = Un[n];
		r || (r = [], Un[n] = r), r.push(e);
	}
}
function Kn(e, t) {
	if (Wn) Wn.fireEvent(e, t);
	else {
		var n = Un[e];
		if (n) for (var r = 0; r < n.length; r++) n[r].onEvent(t);
	}
}
function qn(e) {
	for (var t in Wn = e, Un) for (var n = Un[t], r = 0; r < n.length; r++) Gn(n[r]);
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/events.js
var Jn = /* @__PURE__ */ t({
	Listener: () => f,
	addListener: () => Gn,
	fireEvent: () => Kn,
	setParentEvents: () => qn
}), p = null, Yn = null, Xn = 8, Zn = 9, Qn = 10, $n = 11, er = 12, tr = 13, m = 640, nr = 641, h = 642, rr = 643, ir = 644, ar = 645, or = 660, sr = 661, cr = 662, lr = 663, ur = !1, dr = cr, fr = 0, pr = 0, mr = 0, hr = 0, gr = 0, _r = 0, vr = 0;
function yr() {
	xr(0), Sr(0), ur = !1, dr = cr, fr = 0, pr = 0, gr = !1, _r = 0, vr = 0;
}
function br(e) {
	p[m] = (~p[nr] | mr) & 255, e[0] && (p[m] = p[m] & 127), e[1] && (p[m] = p[m] & 191), e[2] && (p[m] = p[m] & 223), e[3] && (p[m] = p[m] & 239), e[6] && (p[m] = p[m] & 247), e[7] && (p[m] = p[m] & 251), e[8] && (p[m] = p[m] & 253), e[9] && (p[m] = p[m] & 254), p[h] = (~p[rr] | hr) & 255, e != null && (e[12] && (p[h] = p[h] & 254), e[13] && (p[h] = p[h] & 253), e[14] && (p[h] = p[h] & 247), e[15] && (p[h] = p[h] & 191), e[16] && (p[h] = p[h] & 127)), p[h] & 4 ? (p[Xn] &= 127, p[Zn] &= 127, e[4] || e[5] ? p[er] &= 127 : p[er] |= 128) : (p[er] |= 128, e[4] ? p[Zn] |= 128 : p[Zn] &= 127, e[5] ? p[Xn] |= 128 : p[Xn] &= 127), p[h] & 16 ? (p[Qn] &= 127, p[$n] &= 127, e[10] || e[11] ? p[tr] &= 127 : p[tr] |= 128) : (p[tr] |= 128, e[10] ? p[$n] |= 128 : p[$n] &= 127, e[11] ? p[Qn] |= 128 : p[Qn] &= 127);
}
function xr(e) {
	mr = e;
}
function Sr(e) {
	hr = e, p[h] = p[h] & 235, p[h] = (p[h] | (~p[rr] | hr) & 20) & 255;
}
function Cr(e, t) {
	switch (dr = e, fr = t, e) {
		case lr:
			pr = 1024, ur = !0;
			break;
		case or:
			pr = 1, ur = !0;
			break;
		case sr:
			pr = 8, ur = !0;
			break;
		case cr: pr = 64, ur = !0;
	}
	ur && (vr++, _r = pr * t, gr = !1);
}
function wr(e) {
	_r -= e, !gr && _r > 0 ? Yn(ir, _r / pr | 0) : gr ? _r >= -255 ? Yn(ir, _r & 255) : (Yn(ir, 0), ur = !1) : (_r = pr, Yn(ir, 0), p[ar] |= 128, p[ar + 16] |= 128, gr = !0);
}
function Tr() {
	return ur;
}
function Er() {
	p = g, Yn = _a;
}
function Dr() {
	return mr;
}
function Or() {
	return hr;
}
function kr() {
	return ur;
}
function Ar(e) {
	ur = e;
}
function jr() {
	return dr;
}
function Mr(e) {
	dr = e;
}
function Nr() {
	return fr;
}
function Pr(e) {
	fr = e;
}
function Fr() {
	return pr;
}
function Ir(e) {
	pr = e;
}
Gn(new f("init", Er));
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Tia.js
var Lr = 21, Rr = 22, zr = 23, Br = 24, Vr = 25, Hr = 26, Ur = 2048, Wr = 15, Gr = 31, Kr = 511, qr = Array(Ur), Jr = Ur, Yr = [
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	0
], Xr = [
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	1
], Zr = [
	0,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	1,
	1,
	0,
	1,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	1,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	1,
	1,
	1,
	1,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	0,
	0,
	1,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	0,
	1,
	0,
	0,
	1,
	0,
	1,
	0,
	1,
	0,
	1,
	1,
	1,
	0,
	0,
	1,
	0,
	1,
	1,
	0,
	0,
	1,
	1,
	1,
	1,
	1,
	0,
	0,
	0,
	1,
	1,
	0
], Qr = [
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	1,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0,
	0
], $r = [0, 0], ei = [0, 0], ti = [0, 0], ni = [0, 0], ri = [0, 0], ii = [0, 0], ai = [0, 0], oi = [0, 0], si = [0, 0], ci = 0;
function li(e) {
	oi[e]++, oi[e] == Gr && (oi[e] = 0), (!(ni[e] & 2) || !(ni[e] & 1) && Qr[oi[e]] || (ni[e] & 1) == 1 && Xr[oi[e]]) && (ni[e] & 4 ? $r[e] = $r[e] ? 0 : ii[e] : ni[e] & 8 ? ni[e] == 8 ? (si[e]++, si[e] == Kr && (si[e] = 0), $r[e] = Zr[si[e]] ? ii[e] : 0) : $r[e] = Xr[oi[e]] ? ii[e] : 0 : (ai[e]++, ai[e] == Wr && (ai[e] = 0), $r[e] = Yr[ai[e]] ? ii[e] : 0));
}
function ui() {
	ci = 0;
	for (var e = 0; e < 2; e++) $r[e] = 0, ei[e] = 0, ti[e] = 0, ni[e] = 0, ri[e] = 0, ii[e] = 0, ai[e] = 0, oi[e] = 0, si[e] = 0;
	di(!0);
}
function di(e) {
	if (ci = 0, e) for (var t = 0; t < Ur; t++) qr[t] = 0;
}
function fi(e, t) {
	var n = 0, r = 0;
	switch (e) {
		case Lr:
			ni[0] = t & 15, n = 0;
			break;
		case Rr:
			ni[1] = t & 15, n = 1;
			break;
		case zr:
			ri[0] = t & 31, n = 0;
			break;
		case Br:
			ri[1] = t & 31, n = 1;
			break;
		case Vr:
			ii[0] = (t & 15) << 2, n = 0;
			break;
		case Hr:
			ii[1] = (t & 15) << 2, n = 1;
			break;
		default: return;
	}
	ni[n] == 0 ? (r = 0, $r[n] = ii[n]) : (r = ri[n] + 1 & 255, ni[n] > 11 && (r = r * 3 & 255)), r != ei[n] && (ei[n] = r, (ti[n] == 0 || r == 0) && (ti[n] = r));
}
function pi(e) {
	for (var t = 0; t < e; t++) ti[0] > 1 ? ti[0]-- : ti[0] == 1 && (ti[0] = ei[0], li(0)), ti[1] > 1 ? ti[1]-- : ti[1] == 1 && (ti[1] = ei[1], li(1)), qr[ci++] = $r[0] + $r[1] & 255, ci >= Jr && (ci = 0);
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Bios.js
var mi = !1;
function hi() {
	return mi;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Memory.js
var gi = /* @__PURE__ */ t({
	ClearROM: () => ya,
	Read: () => ha,
	ReadMaria: () => ga,
	Reset: () => pa,
	SouperRam: () => na,
	Write: () => _a,
	WriteROM: () => va,
	mariaRam: () => ta,
	ram: () => g,
	rom: () => ea
}), _i = wt, vi = St, yi = fi, bi = Sr, xi = xr, Si = Cr, Ci = hn, wi = _n, Ti = yn, Ei = pn, Di = mn, Oi = !1, ki = null, Ai = 8, ji = 9, Mi = 10, Ni = 11, Pi = 12, Fi = 13, Ii = 21, Li = 22, Ri = 23, zi = 24, Bi = 25, Vi = 26, Hi = 36, Ui = 40, Wi = 640, Gi = 642, Ki = 644, qi = 645, Ji = 660, Yi = 661, Xi = 662, Zi = 663, Qi = 65536, $i = 32768, g = Array(Qi), ea = Array(Qi), ta = Array(Qi), na = Array($i), ra = !1, ia = !1, aa = !1, oa = !1, sa = !1, ca = !1, la = !1, ua = 0, da = !1, fa = !1;
function pa() {
	for (var e = 0; e < Qi; e++) g[e] = 0, ta[e] = 0, ea[e] = 1;
	for (e = 0; e < 16384; e++) ea[e] = 0;
	da = !1;
}
function ma(e) {
	var t;
	if (la && (e >= 1136 && e < 1152 || Ci() && e >= 1104 && e < 1136 || wi() && e >= 16384 && e < 32768 || Ti() && e >= 1120 && e <= 1121)) return Ei(e);
	if (!oa && ra && (!ia && !aa && e >= 16384 && e <= 16399 || aa && e >= 2048 && e < 2080 || ia && e >= 1104 && e < 1136)) return vi(aa ? 16384 + (e - 2048) : ia ? 16384 + (e - 1104) : e);
	if (e >= 32 && e <= 63 && e != Ui) return 0;
	switch (e) {
		case Ki:
		case Ki | 2: return g[qi] &= 127, g[Ki];
		case qi:
		case qi | 2: return t = g[qi], g[qi] &= 127, t;
		default:
			if (hs() === 8 && e >= 16384 && e < 32768) return na[ba(e)];
			if (fa) {
				if (ca && e >= 16384 && e <= 32767) return ta[e];
				if (ua === 0 || ua === 7) {
					if (e >= Hs() && e <= Ws()) return ta[e];
				} else if (ua == 4 && e >= 16384 && e <= 32767 || e >= 32768 && e <= 49151 || e >= 49152 && e <= 65535) return ta[e];
			}
			return g[e];
	}
}
function ha(e) {
	var t = ma(e);
	return t < 0 && console.error("Less than zero memory read: %d %d", e, t), t;
}
function ga(e) {
	fa = !0;
	var t = ma(e);
	return fa = !1, t < 0 && console.error("Less than zero memory read: %d %d", e, t), t;
}
function _a(e, t) {
	if (t < 0 && console.error("Less than zero memory write: %d %d", e, t), la && (e >= 1136 && e < 1152 || Ci() && e >= 1104 && e < 1136 || wi() && e >= 16384 && e < 32768 || Ti() && e >= 1120 && e <= 1121)) {
		Di(e, t);
		return;
	}
	if (ra && (!ia && !aa && e >= 16384 && e <= 16399 || aa && e >= 2048 && e < 2080 || ia && e >= 1104 && e < 1136)) {
		_i(aa ? 16384 + (e - 2048) : ia ? 16384 + (e - 1104) : e, t);
		return;
	}
	if (!ea[e] || ca && e >= 49152 && e <= 65535) {
		if (Oi && e >= 4096 && e <= 6143 && ki && ki.write(e, t), e >= 0 && e <= 15) da || (t & 1 && (da = !0, console.log("Lock: " + t), g[Ui] = 128), t & 4 && Uo() ? Bs() || Io() : t & 4);
		else switch (e) {
			case Hi:
				g[Hi] = 1;
				break;
			case Ai:
			case ji:
			case Mi:
			case Ni:
			case Pi:
			case Fi:
			case Ui: break;
			case Ii:
				yi(Ii, t);
				break;
			case Li:
				yi(Li, t);
				break;
			case Ri:
				yi(Ri, t);
				break;
			case zi:
				yi(zi, t);
				break;
			case Bi:
				yi(Bi, t);
				break;
			case Vi:
				yi(Vi, t);
				break;
			case Gi:
				bi(t);
				break;
			case Wi:
				xi(t);
				break;
			case Ji:
			case Ji | 8:
				Si(Ji, t);
				break;
			case Yi:
			case Yi | 8:
				Si(Yi, t);
				break;
			case Xi:
			case Xi | 8:
				Si(Xi, t);
				break;
			case Zi:
			case Zi | 8:
				Si(Zi, t);
				break;
			default:
				if (hs() == 8 && e >= 16384 && e < 32768) {
					na[ba(e)] = t;
					break;
				}
				ca && e >= 49152 && e <= 65535 ? ta[16384 + (e - 49152)] = t : (g[e] = t, e >= 8256 && e <= 8447 || e >= 8512 && e <= 8703 ? g[e - 8192] = t : e >= 64 && e <= 255 || e >= 320 && e <= 511 ? g[e + 8192] = t : e >= 10240 && e <= 12287 ? g[e - 2048] = t : e >= 8192 && e <= 10239 && (g[e + 2048] = t));
		}
	} else Lo(e, t);
}
function va(e, t, n, r) {
	var i = !1, a = 0;
	if (sa) {
		var o = hs();
		o === 0 || o === 7 ? (a = t, Vs(e), Us(e + t - 1), i = !0) : (e === 32768 || e === 49152 || o === 4 && e === 16384) && (a = 131072, i = !0);
	}
	if (e + t <= Qi && n != null) for (var s = 0; s < t; s++) g[e + s] = n[s + r], ea[e + s] = 1, i && (ta[e + s] = n[s + r + a]);
}
function ya(e, t) {
	if (e + t <= Qi) for (var n = 0; n < t; n++) g[e + n] = 0, ea[e + n] = 0, ca && e === 16384 && (ta[e + n] = 0);
}
function ba(e) {
	var t = e - 16384 >> 12;
	return Vo() & 4 && (e >= 24576 && e < 28672 ? t = Co[0] : e >= 28672 && e < 32768 && (t = Co[1])), e & 4095 | t << 12;
}
function xa() {
	ra = Yo(), ia = Xo(), aa = Zo(), la = es(), oa = Qo(), sa = ts(), ca = ns(), ua = hs();
}
Gn(new f("onCartridgeLoaded", xa)), Gn(new f("onHighScoreCartLoaded", function(e) {
	Oi = e;
})), Gn(new f("highScoreCallbackChanged", function(e) {
	ki = e;
}));
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/3rdparty/md5.js
function Sa(e, t) {
	var n = e[0], r = e[1], i = e[2], a = e[3];
	n = _(n, r, i, a, t[0], 7, -680876936), a = _(a, n, r, i, t[1], 12, -389564586), i = _(i, a, n, r, t[2], 17, 606105819), r = _(r, i, a, n, t[3], 22, -1044525330), n = _(n, r, i, a, t[4], 7, -176418897), a = _(a, n, r, i, t[5], 12, 1200080426), i = _(i, a, n, r, t[6], 17, -1473231341), r = _(r, i, a, n, t[7], 22, -45705983), n = _(n, r, i, a, t[8], 7, 1770035416), a = _(a, n, r, i, t[9], 12, -1958414417), i = _(i, a, n, r, t[10], 17, -42063), r = _(r, i, a, n, t[11], 22, -1990404162), n = _(n, r, i, a, t[12], 7, 1804603682), a = _(a, n, r, i, t[13], 12, -40341101), i = _(i, a, n, r, t[14], 17, -1502002290), r = _(r, i, a, n, t[15], 22, 1236535329), n = v(n, r, i, a, t[1], 5, -165796510), a = v(a, n, r, i, t[6], 9, -1069501632), i = v(i, a, n, r, t[11], 14, 643717713), r = v(r, i, a, n, t[0], 20, -373897302), n = v(n, r, i, a, t[5], 5, -701558691), a = v(a, n, r, i, t[10], 9, 38016083), i = v(i, a, n, r, t[15], 14, -660478335), r = v(r, i, a, n, t[4], 20, -405537848), n = v(n, r, i, a, t[9], 5, 568446438), a = v(a, n, r, i, t[14], 9, -1019803690), i = v(i, a, n, r, t[3], 14, -187363961), r = v(r, i, a, n, t[8], 20, 1163531501), n = v(n, r, i, a, t[13], 5, -1444681467), a = v(a, n, r, i, t[2], 9, -51403784), i = v(i, a, n, r, t[7], 14, 1735328473), r = v(r, i, a, n, t[12], 20, -1926607734), n = y(n, r, i, a, t[5], 4, -378558), a = y(a, n, r, i, t[8], 11, -2022574463), i = y(i, a, n, r, t[11], 16, 1839030562), r = y(r, i, a, n, t[14], 23, -35309556), n = y(n, r, i, a, t[1], 4, -1530992060), a = y(a, n, r, i, t[4], 11, 1272893353), i = y(i, a, n, r, t[7], 16, -155497632), r = y(r, i, a, n, t[10], 23, -1094730640), n = y(n, r, i, a, t[13], 4, 681279174), a = y(a, n, r, i, t[0], 11, -358537222), i = y(i, a, n, r, t[3], 16, -722521979), r = y(r, i, a, n, t[6], 23, 76029189), n = y(n, r, i, a, t[9], 4, -640364487), a = y(a, n, r, i, t[12], 11, -421815835), i = y(i, a, n, r, t[15], 16, 530742520), r = y(r, i, a, n, t[2], 23, -995338651), n = b(n, r, i, a, t[0], 6, -198630844), a = b(a, n, r, i, t[7], 10, 1126891415), i = b(i, a, n, r, t[14], 15, -1416354905), r = b(r, i, a, n, t[5], 21, -57434055), n = b(n, r, i, a, t[12], 6, 1700485571), a = b(a, n, r, i, t[3], 10, -1894986606), i = b(i, a, n, r, t[10], 15, -1051523), r = b(r, i, a, n, t[1], 21, -2054922799), n = b(n, r, i, a, t[8], 6, 1873313359), a = b(a, n, r, i, t[15], 10, -30611744), i = b(i, a, n, r, t[6], 15, -1560198380), r = b(r, i, a, n, t[13], 21, 1309151649), n = b(n, r, i, a, t[4], 6, -145523070), a = b(a, n, r, i, t[11], 10, -1120210379), i = b(i, a, n, r, t[2], 15, 718787259), r = b(r, i, a, n, t[9], 21, -343485551), e[0] = Aa(n, e[0]), e[1] = Aa(r, e[1]), e[2] = Aa(i, e[2]), e[3] = Aa(a, e[3]);
}
function Ca(e, t, n, r, i, a) {
	return t = Aa(Aa(t, e), Aa(r, a)), Aa(t << i | t >>> 32 - i, n);
}
function _(e, t, n, r, i, a, o) {
	return Ca(t & n | ~t & r, e, t, i, a, o);
}
function v(e, t, n, r, i, a, o) {
	return Ca(t & r | n & ~r, e, t, i, a, o);
}
function y(e, t, n, r, i, a, o) {
	return Ca(t ^ n ^ r, e, t, i, a, o);
}
function b(e, t, n, r, i, a, o) {
	return Ca(n ^ (t | ~r), e, t, i, a, o);
}
function wa(e) {
	for (var t = e.length, n = [
		1732584193,
		-271733879,
		-1732584194,
		271733878
	], r = 64; r <= e.length; r += 64) Sa(n, Ta(e.substring(r - 64, r)));
	e = e.substring(r - 64);
	var i = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	];
	for (r = 0; r < e.length; r++) i[r >> 2] |= e.charCodeAt(r) << (r % 4 << 3);
	if (i[r >> 2] |= 128 << (r % 4 << 3), r > 55) for (Sa(n, i), r = 0; r < 16; r++) i[r] = 0;
	return i[14] = t * 8, Sa(n, i), n;
}
function Ta(e) {
	for (var t = [], n = 0; n < 64; n += 4) t[n >> 2] = e.charCodeAt(n) + (e.charCodeAt(n + 1) << 8) + (e.charCodeAt(n + 2) << 16) + (e.charCodeAt(n + 3) << 24);
	return t;
}
var Ea = "0123456789abcdef".split("");
function Da(e) {
	for (var t = "", n = 0; n < 4; n++) t += Ea[e >> n * 8 + 4 & 15] + Ea[e >> n * 8 & 15];
	return t;
}
function Oa(e) {
	for (var t = 0; t < e.length; t++) e[t] = Da(e[t]);
	return e.join("");
}
function ka(e) {
	return Oa(wa(e));
}
function Aa(e, t) {
	return e + t & 4294967295;
}
ka("hello");
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Cartridge.js
var ja = /* @__PURE__ */ t({
	Buffer: () => C,
	CARTRIDGE_SOUPER_MODE_CHR: () => 2,
	CARTRIDGE_SOUPER_MODE_EXS: () => 4,
	CARTRIDGE_SOUPER_MODE_MFT: () => 1,
	CARTRIDGE_TYPE_NORMAL: () => 0,
	CARTRIDGE_TYPE_NORMAL_RAM: () => 7,
	CARTRIDGE_TYPE_SOUPER: () => 8,
	CARTRIDGE_TYPE_SUPERCART: () => 1,
	CARTRIDGE_TYPE_SUPERCART_LARGE: () => 2,
	CARTRIDGE_TYPE_SUPERCART_RAM: () => 3,
	CARTRIDGE_TYPE_SUPERCART_ROM: () => 4,
	GetBanksetsBegin: () => Hs,
	GetBanksetsEnd: () => Ws,
	GetCartridgeBank: () => Gs,
	GetCartridgeXM: () => $o,
	GetController1: () => xs,
	GetController2: () => Ss,
	GetCrossX: () => ks,
	GetCrossY: () => As,
	GetDigest: () => ds,
	GetFlags: () => ss,
	GetHblank: () => cs,
	GetLeftSwitch: () => ls,
	GetRegion: () => qo,
	GetRightSwitch: () => us,
	GetSize: () => ms,
	GetSouperMode: () => Vo,
	GetTitle: () => ps,
	GetType: () => hs,
	GetXmMode: () => Rs,
	GetXmModeDefault: () => zs,
	IsBanksets: () => ts,
	IsBupChip: () => as,
	IsComposite: () => Jo,
	IsDualAnalog: () => is,
	IsHaltBankedRam: () => ns,
	IsHighScoreCartEnabled: () => Is,
	IsLightGunEnabled: () => os,
	IsLoaded: () => Uo,
	IsPokey450Enabled: () => Xo,
	IsPokey800Enabled: () => Zo,
	IsPokeyEnabled: () => Yo,
	IsPokeyWriteOnly: () => Qo,
	IsStored: () => Bs,
	IsSwapButtons: () => rs,
	IsXmEnabled: () => es,
	Load: () => Fo,
	LoadHighScoreCart: () => Go,
	Release: () => Wo,
	SetBanksetsBegin: () => Vs,
	SetBanksetsEnd: () => Us,
	SetController1: () => ys,
	SetController2: () => bs,
	SetCrossX: () => Ds,
	SetCrossY: () => Os,
	SetDualAnalog: () => js,
	SetFlags: () => ws,
	SetHblank: () => Es,
	SetHighScoreCartEnabled: () => Fs,
	SetLeftSwitch: () => Ms,
	SetPokey: () => _s,
	SetPokey450: () => vs,
	SetRegion: () => Cs,
	SetRightSwitch: () => Ns,
	SetSouperMode: () => Bo,
	SetSwapButtons: () => Ps,
	SetTitle: () => fs,
	SetType: () => gs,
	SetXm: () => Ts,
	SetXmMode: () => Ls,
	SouperChrBank: () => xo,
	SouperRamBank: () => Co,
	Store: () => Io,
	StoreBank: () => Ro,
	Write: () => Lo
}), x = null, Ma = null, Na = null, Pa = 4096, Fa = 2048, Ia = null, La = 28, Ra = null, za = 5, Ba = 6, Va = 2, Ha = 32768, Ua = 32769, Wa = 32770, Ga = 32771, Ka = 32772, qa = 32773, Ja = 32775, Ya = "", Xa = "", S = 0, Za = 0, Qa = !1, $a = !1, eo = [1, 1], to = 0, no = 0, ro = 0, io = 0, ao = !1, oo = !1, so = 28, co = 1, lo = 0, uo = !1, fo = !1, po = !1, mo = !1, ho = 0, go = 0, _o = !1, vo = !1, yo = !1, bo = !1, xo = [, ,], So = 0, Co = [, ,], wo = 2, To = wo, Eo = !1, C = null, w = 0, Do = !1;
function Oo(e) {
	for (var t = [
		"A",
		"T",
		"A",
		"R",
		"I",
		"7",
		"8",
		"0",
		"0"
	], n = 0; n < 9; n++) if (t[n] != String.fromCharCode(e[n + 1])) return !1;
	return !0;
}
function ko(e) {
	for (var t = [">", ">"], n = 0; n < 2; n++) if (t[n] != String.fromCharCode(e[n + 1])) return !1;
	return !0;
}
function Ao(e) {
	return (S == 1 || S == 4 || S == 3) && w <= 65536 ? e & 3 : e;
}
function jo(e) {
	return Ao(e) * 16384;
}
function Mo(e, t) {
	var n = w;
	mo && (n >>= 1);
	var r = jo(t);
	r < n && (x(e, 16384, C, r), to = t);
}
function No(e) {
	if (mo && (e >>= 1), e <= 65536) {
		var t = S;
		S = 0, console.log("Update: no bits and <= 64k: %d, %d", t, S);
	} else if (e == 147456) {
		var t = S;
		S = 2, console.log("Update: size == 144k: %d, %d", t, S);
	} else if (e == 131072) {
		var t = S;
		S = 4, console.log("Update: size == 128k: %d, %d", t, S);
	} else {
		var t = S;
		S = 1, console.log("Update: default for > 64k: %d, %d", t, S);
	}
}
function Po(e) {
	console.log("Reading cartridge header");
	for (var t = [], n = 0; n < 32; n++) t[n] = e[n + 17];
	Ya = "";
	for (var r = 0; r < t.length; r++) Ya += String.fromCharCode(t[r]);
	console.log("Title: %s", Ya), w = e[49] << 24, w |= e[50] << 16, w |= e[51] << 8, w |= e[52], S = e[53] == 0 ? w > 131072 ? 2 : e[54] == 2 || e[54] == 3 ? 1 : e[54] == 4 || e[54] == 5 || e[54] == 6 || e[54] == 7 ? 3 : e[54] == 8 || e[54] == 9 || e[54] == 10 || e[54] == 11 ? 4 : 0 : e[53] & 2 ? za : e[53] & 1 ? Ba : e[53] == 16 ? 8 : 0, Qa = !!(e[54] & 1), $a = !!(e[54] & 64), yo = !!(e[53] & 128), ($a || yo) && (Qa = !0), eo[0] = e[55], eo[1] = e[56], Za = e[57] & 1, po = e[57] & 2 ? 1 : 0, no = 0, oo = !!(e[63] & 1 || (e[53] & 8) == 8), fo = e[58] & 3, mo = !!(e[53] & 32), mo && (w === 98304 || w === 106496) && (vo = !0), _o = !!(e[53] & 64), bo = !1;
	var i = e[54], a = e[53];
	if (e[53] & 2) S = za;
	else if (e[53] & 1) S = Ba;
	else if (e[53] & 16) S = 8;
	else if ((i & 10) == 10) {
		var o = S;
		S = 2, console.log("Update: (0x10) bit1 & bit3: %d, %d", o, S);
	} else if ((i & 18) == 18) {
		var o = S;
		S = 4, console.log("Update: (0x12) bit1 & bit4: %d, %d", o, S);
	} else if ((i & 6) == 6) {
		var o = S;
		S = 3, console.log("Update: (0x06) bit1 & bit2: %d, %d", o, S);
	} else if ((i & 2) == 2) {
		var o = S;
		S = 1, console.log("Update: (0x01) bit1: %d, %d", o, S);
	} else if (w <= 65536 && (i & 4) == 4) {
		var o = S;
		S = 7, console.log("Update: (0x04) bit2: %d, %d", o, S);
	} else No(w);
	if (mo) {
		if (S === 0 || S === 7) {
			if (S === 0 && _o) {
				var o = S;
				S = 7, console.log("Normal cart with halt based ram, switching type: %d, %d", o, S);
			}
		} else {
			var o = S;
			S = _o ? 3 : (i & 16) == 16 ? 4 : 1, o !== S && console.log("Bank switched banksets, switching type: %d, %d", o, S);
		}
	}
	console.log("Header info:"), i & 1 && console.log("  bit0: pokey at $4000"), i & 2 && console.log("  bit1: supergame bank switched"), i & 4 && console.log("  bit2: supergame ram at $4000"), i & 8 && console.log("  bit3: rom at $4000"), i & 16 && console.log("  bit4: bank 6 at $4000"), i & 32 && console.log("  bit5: supergame banked ram"), i & 64 && console.log("  bit6: pokey at $450"), i & 128 && console.log("  bit7: mirror ram at $4000"), a & 1 && console.log("  bit8: activision banking"), a & 2 && console.log("  bit9: absolute banking"), a & 4 && console.log("  bit10: pokey at $440"), a & 8 && console.log("  bit11: ym2151 at $460/$461"), a & 16 && console.log("  bit12: souper"), a & 32 && console.log("  bit13: banksets"), a & 64 && console.log("  bit14: halt banked ram"), a & 128 && console.log("  bit15: pokey@800"), console.log("  xm: %s", oo ? "1" : "0"), console.log("  banksets: %s", mo ? "1" : "0"), console.log("  pokey: %s", Qa ? "1" : "0"), console.log("  pokey450: %s", $a ? "1" : "0"), console.log("  pokey800: %s", yo ? "1" : "0"), console.log("  pokey write only: %s", vo ? "1" : "0"), console.log("  halt banked ram: %s", _o ? "1" : "0"), console.log("  tv type: %s", Za ? "PAL" : "NTSC"), console.log("  tv composite: %d\n", po), console.log("  Save device: [%d]%s%s", e[58], e[58] & 2 ? " SaveKey/AtariVox" : "", e[58] & 1 ? " HSC" : ""), console.log("  controller1: %d", eo[0]), console.log("  controller2: %d", eo[1]), console.log("  cartridge_type 53: %d", e[53]), console.log("  cartridge_type 54: %d", e[54]), console.log("  cartridge_size: %d", w), console.log("cartridge_type (from header): %d", S);
}
function Fo(e, t) {
	if (t <= 128) return console.log("Cartridge data is invalid."), !1;
	console.log("actual cartridge_size: %d", t), Wo();
	for (var n = [], r = 0; r < 128; r++) n[r] = e[r];
	if (ko(n)) return console.log("Prosystem doesn't support CC2 hacks."), !1;
	var i = 0;
	Oo(n) ? (console.log("Found cartridge header"), Po(n), t -= 128, i = 128, w != t && (console.log("!!! CARTRIDGE SIZE IN HEADER DOES NOT MATCH !!! : %d %d", w, t), t % 1024 == 0 ? (console.log("!!! ROM size is 1k multiple, using ROM size !!! : %d", t), w = t) : console.log("!!! ROM size is not 1k multiple, using header size !!! : %d", w))) : (console.log("Unable to find cartridge header"), w = t, No(t)), console.log("cartridge_type: %d", S), console.log("cartridge_size: %d", w), C = Array(w);
	for (var a = "", r = 0; r < w; r++) C[r] = e[r + i], a += String.fromCharCode(C[r]);
	if (Xa = ka(a), console.log("cartridge_digest: %s", Xa), Xa === "91041aadd1700a7a4076f4005f2c362f" || Xa === "66a90a41b11faa0f6d1e05aefb59ec6f") {
		console.log("Patching diagnostic cartridge...");
		var i = w - 6420 - 128;
		C[i + 0] = 223, C[i + 1] = 230;
	}
	var o = Ko(C.slice(w - 16384, w - 16384 + 1024));
	if (console.log("CRC 16: 0x" + o.toString(16)), (o & 65535) == 40586 && (console.log("Applying Pole Position II hack..."), ap(3)), S == Ba && Xa !== "ac03806cef2558fc795a7d5d8dba7bc0" && Xa !== "543484c00ba233736bcaba2da20eeea9" && Xa !== "de2ebafcf0e37aaa9d0e9525a7f4dd62") {
		var s = Array(8192);
		console.log("Swap hi and lo 8k...");
		for (var c = 0; c < w; c += 16384) {
			console.log("swap " + c);
			for (var l = 0; l < 8192; l++) s[l] = C[c + l];
			for (var l = 0; l < 8192; l++) C[c + l] = C[c + 8192 + l];
			for (var l = 0; l < 8192; l++) C[c + 8192 + l] = s[l];
		}
	}
	if (S === 8 && w === 1048576) {
		bo = !0;
		let e = window.Module._bupchip_GetMusicSize(), t = new Uint8Array(Module.HEAPU8.buffer, window.Module._bupchip_GetMusicBuffer(), e);
		for (let n = 0; n < e; n++) t[n] = C[524288 + n];
		window.Module._bupchip_Unpack();
	}
	return !0;
}
function Io() {
	Do = !0;
	var e = w;
	switch (mo && (e >>= 1), S) {
		case 0:
			x(65536 - e, e, C, 0);
			break;
		case 7:
			x(65536 - e, e, C, 0), Ma(16384, 16384);
			break;
		case 1:
			var t = e - 16384;
			t < e && (x(49152, 16384, C, t), Ro(0));
			break;
		case 2:
			var t = e - 16384;
			t < e && (x(49152, 16384, C, t), x(16384, 16384, C, jo(0)), Ro(0));
			break;
		case 3:
			var t = e - 16384;
			t < e && (x(49152, 16384, C, t), Ma(16384, 16384), Ro(0));
			break;
		case 4:
			var t = e - 16384;
			t < e && jo(6) < e && (x(49152, 16384, C, t), x(16384, 16384, C, jo(6)), Ro(0));
			break;
		case za:
			x(16384, 16384, C, 0), x(32768, 32768, C, jo(2));
			break;
		case Ba:
			122880 < e && (x(40960, 16384, C, 0), x(16384, 8192, C, 106496), x(24576, 8192, C, 98304), x(32768, 8192, C, 122880), x(57344, 8192, C, 114688));
			break;
		case 8: x(49152, 16384, C, jo(31)), x(32768, 16384, C, jo(0)), Ma(16384, 16384);
	}
}
function Lo(e, t) {
	var n = w;
	switch (mo && (n >>= 1), S) {
		case 1:
		case 3:
		case 4:
			var r = n / 16384;
			e >= 32768 && e < 49152 && Ao(t) < r && Ro(t);
			break;
		case 2:
			var r = n / 16384;
			e >= 32768 && e < 49152 && Ao(t) < r && Ro(t + 1);
			break;
		case za:
			e == 32768 && (t == 1 || t == 2) && Ro(t - 1);
			break;
		case Ba:
			e >= 65408 && Ro(e & 7);
			break;
		case 8:
			if (e >= 16384 && e < 32768) {
				memory_souper_ram[memory_souper_GetRamAddress(e)] = t;
				break;
			}
			switch (e) {
				case Ha:
					Ro(t & 31);
					break;
				case Ua:
					zo(0, t);
					break;
				case Wa:
					zo(1, t);
					break;
				case Ga:
					Bo(t);
					break;
				case Ka:
					Ho(0, t);
					break;
				case qa:
					Ho(1, t);
					break;
				case Ja: window.Module._bupchip_ProcessAudioCommand(t);
			}
	}
}
function Ro(e) {
	switch (S) {
		case 1:
			Mo(32768, e);
			break;
		case 3:
			Mo(32768, e);
			break;
		case 4:
			Mo(32768, e);
			break;
		case 2:
			Mo(32768, e);
			break;
		case za:
			Mo(16384, e);
			break;
		case Ba:
			Mo(40960, e);
			break;
		case 8: Mo(32768, e);
	}
}
function zo(e, t) {
	e < 2 && (xo[e] = t);
}
function Bo(e) {
	So = e;
}
function Vo() {
	return So;
}
function Ho(e, t) {
	e < 2 && (Co[e] = t & 7);
}
function Uo() {
	return C != null;
}
function Wo() {
	Do = !1, Eo = !1, C != null && (w = 0, C = null, Ya = "", S = 0, Za = 0, Qa = 0, $a = 0, yo = 0, oo = !1, eo = [1, 1], to = 0, no = 0, ro = 0, io = 0, so = La, ao = !1, co = 1, lo = 0, uo = !1, fo = !1, mo = !1, vo = !1, _o = !1);
}
function Go(e) {
	if (!fo || Za != Ra) {
		console.log(fo ? "Not loading high score cartridge, PAL region." : "High score cartridge is disabled (via db and cart header)."), e(!1);
		return;
	}
	var t = Ia.getRom();
	if (t == null) {
		console.log("Unable to locate high score cartridge."), e(!1);
		return;
	}
	if (console.log("Found high score cartridge."), ka(t) != "c8a73288ab97226c52602204ab894286") {
		console.log("High score cartridge hash is invalid."), e(!1);
		return;
	}
	Ia.loadSram(function(n) {
		if (n) {
			for (var r = 0; r < n.length && r < Fa; r++) Na(Pa + r, n[r]);
			for (var r = 0; r < t.length; r++) Na(12288 + r, t.charCodeAt(r));
			Eo = !0;
		}
		console.log("High score cart loaded: " + Eo), e(Eo);
	});
}
function Ko(e) {
	var t, n = 65535, r;
	for (t = 0; t < e.length; t++) for (n = e[t] ^ n, r = 0; r < 8; r++) n & 1 ? (n >>= 1, n ^= 40961) : n >>= 1;
	return n;
}
function qo() {
	return Za;
}
function Jo() {
	return po;
}
function Yo() {
	return Qa;
}
function Xo() {
	return $a;
}
function Zo() {
	return yo;
}
function Qo() {
	return vo;
}
function $o() {
	return oo;
}
function es() {
	return To == 2 ? oo : To;
}
function ts() {
	return mo;
}
function ns() {
	return _o;
}
function rs() {
	return uo;
}
function is() {
	return ao;
}
function as() {
	return bo;
}
function os() {
	return eo[0] == Va;
}
function ss() {
	return no;
}
function cs() {
	return so;
}
function ls() {
	return co;
}
function us() {
	return lo;
}
function ds() {
	return Xa;
}
function fs(e) {
	Ya = e;
}
function ps() {
	return Ya;
}
function ms() {
	return w;
}
function hs() {
	return S;
}
function gs(e) {
	S = e;
}
function _s(e) {
	Qa = e;
}
function vs(e) {
	$a = e;
}
function ys(e) {
	eo[0] = e;
}
function bs(e) {
	eo[1] = e;
}
function xs() {
	return eo[0];
}
function Ss() {
	return eo[1];
}
function Cs(e) {
	Za = e;
}
function ws(e) {
	no = e;
}
function Ts(e) {
	oo = e;
}
function Es(e) {
	so = e;
}
function Ds(e) {
	ro = e;
}
function Os(e) {
	io = e;
}
function ks() {
	return ro;
}
function As() {
	return io;
}
function js(e) {
	ao = e;
}
function Ms(e) {
	co = e;
}
function Ns(e) {
	lo = e;
}
function Ps(e) {
	uo = e;
}
function Fs(e) {
	fo = e;
}
function Is() {
	return fo;
}
function Ls(e) {
	To = e;
}
function Rs() {
	return To;
}
function zs() {
	return wo;
}
function Bs() {
	return Do;
}
function Vs(e) {
	ho = e;
}
function Hs() {
	return ho;
}
function Us(e) {
	go = e;
}
function Ws() {
	return go;
}
function Gs() {
	return to;
}
function Ks(e) {
	Ra = e.Region.REGION_NTSC, x = va, Ma = ya, Na = _a;
}
Gn(new f("init", function(e) {
	Ks(e);
})), Gn(new f("highScoreCallbackChanged", function(e) {
	Ia = e;
}));
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Pair.js
var T = function() {
	this._w = 0, this.wPlusPlus = function() {
		var e = this._w;
		return this.setW(this._w + 1), e;
	}, this.wMinusMinus = function() {
		var e = this._w;
		return this.setW(this._w - 1), e;
	}, this.wPlusEqual = function(e) {
		this.setW(this._w + e);
	}, this.wMinusEqual = function(e) {
		this.setW(this._w - e);
	}, this.setW = function(e) {
		this._w = e & 65535;
	}, this.getW = function() {
		return this._w;
	}, this.getBL = function() {
		return this._w & 255;
	}, this.getBLSigned = function() {
		var e = this.getBL();
		return (e & 128) > 0 ? e - 256 : e;
	}, this.setBL = function(e) {
		this.setW(this._w & 65280 | e & 255);
	}, this.blPlusEqual = function(e) {
		this.setBL(this.getBL() + e);
	}, this.getBH = function() {
		return (this._w & 65280) >>> 8;
	}, this.setBH = function(e) {
		this.setW(this._w & 255 | e << 8 & 65280);
	}, this.bhPlusEqual = function(e) {
		this.setBH(this.getBH() + e);
	}, this.copy = function(e) {
		this._w = e._w;
	};
}, E = ha, qs = _a, Js = g, Ys = 12, D = 0, O = 0, k = 0, A = 0, Xs = 0, j = new T(), Zs = 0, M = new T(), N = 0, Qs = !1, P = {
	C: 1,
	Z: 2,
	I: 4,
	D: 8,
	B: 16,
	R: 32,
	V: 64,
	N: 128
}, $s = {
	H: 65533,
	L: 65532
}, ec = {
	H: 65531,
	L: 65530
}, tc = {
	H: 65535,
	L: 65534
}, nc = [
	7,
	6,
	0,
	0,
	2,
	3,
	5,
	0,
	3,
	2,
	2,
	2,
	0,
	4,
	6,
	0,
	2,
	5,
	0,
	0,
	0,
	4,
	6,
	0,
	2,
	4,
	0,
	0,
	0,
	4,
	7,
	0,
	6,
	6,
	0,
	0,
	3,
	3,
	5,
	0,
	4,
	2,
	2,
	2,
	4,
	4,
	6,
	0,
	2,
	5,
	0,
	0,
	0,
	4,
	6,
	0,
	2,
	4,
	0,
	0,
	0,
	4,
	7,
	0,
	6,
	6,
	0,
	0,
	0,
	3,
	5,
	0,
	3,
	2,
	2,
	2,
	3,
	4,
	6,
	0,
	2,
	5,
	0,
	0,
	0,
	4,
	6,
	0,
	2,
	4,
	0,
	0,
	0,
	4,
	7,
	0,
	6,
	6,
	0,
	0,
	0,
	3,
	5,
	0,
	4,
	2,
	2,
	0,
	5,
	4,
	6,
	0,
	2,
	5,
	0,
	0,
	0,
	4,
	6,
	0,
	2,
	4,
	0,
	0,
	0,
	4,
	7,
	0,
	2,
	6,
	0,
	0,
	3,
	3,
	3,
	0,
	2,
	0,
	2,
	0,
	4,
	4,
	4,
	0,
	2,
	6,
	0,
	0,
	4,
	4,
	4,
	4,
	2,
	5,
	2,
	0,
	0,
	5,
	0,
	0,
	2,
	6,
	2,
	0,
	3,
	3,
	3,
	0,
	2,
	2,
	2,
	0,
	4,
	4,
	4,
	4,
	2,
	5,
	0,
	6,
	4,
	4,
	4,
	0,
	2,
	4,
	2,
	0,
	4,
	4,
	4,
	0,
	2,
	6,
	0,
	0,
	3,
	3,
	5,
	0,
	2,
	2,
	2,
	2,
	4,
	4,
	6,
	0,
	2,
	5,
	0,
	0,
	0,
	4,
	6,
	0,
	2,
	4,
	0,
	0,
	0,
	4,
	7,
	0,
	2,
	6,
	0,
	0,
	3,
	3,
	5,
	0,
	2,
	2,
	2,
	0,
	4,
	4,
	6,
	0,
	2,
	5,
	0,
	0,
	0,
	4,
	6,
	0,
	2,
	4,
	0,
	0,
	0,
	4,
	7,
	0
];
function rc(e) {
	qs(Xs + 256 & 65535, e), Xs = Xs - 1 & 255;
}
function ic() {
	return Xs = Xs + 1 & 255, E(Xs + 256 & 65535);
}
function F(e) {
	e ? A = A & ~P.Z & 255 : A |= P.Z, e & 128 ? A |= P.N : A = A & ~P.N & 255;
}
var ac = new T();
function oc(e) {
	e && (ac.copy(j), j.wPlusEqual(M.getBLSigned()), ac.getBH() == j.getBH() ? N++ : N += 2);
}
var sc = new T(), cc = new T();
function I(e) {
	sc.copy(M), cc.copy(M), sc.wMinusEqual(e), sc.getBH() != cc.getBH() && N++;
}
function L() {
	M.setBL(E(j.wPlusPlus())), M.setBH(E(j.wPlusPlus()));
}
function R() {
	M.setBL(E(j.wPlusPlus())), M.setBH(E(j.wPlusPlus())), M.wPlusEqual(O);
}
function lc() {
	M.setBL(E(j.wPlusPlus())), M.setBH(E(j.wPlusPlus())), M.wPlusEqual(k);
}
function z() {
	M.setW(j.wPlusPlus());
}
function uc() {
	var e = new T();
	e.setBL(E(j.wPlusPlus())), e.setBH(E(j.wPlusPlus())), M.setBL(E(e.getW())), M.setBH(E(e.getW() + 1));
}
function dc() {
	M.setBL(E(j.wPlusPlus()) + O), M.setBH(E(M.getBL() + 1)), M.setBL(E(M.getBL()));
}
function fc() {
	M.setBL(E(j.wPlusPlus())), M.setBH(E(M.getBL() + 1)), M.setBL(E(M.getBL())), M.wPlusEqual(k);
}
function pc() {
	M.setW(E(j.wPlusPlus()));
}
function B() {
	M.setW(E(j.wPlusPlus()));
}
function V() {
	M.setW(E(j.wPlusPlus())), M.blPlusEqual(O);
}
function mc() {
	M.setW(E(j.wPlusPlus())), M.blPlusEqual(k);
}
function hc() {
	var e = E(M.getW());
	if (A & P.D) {
		var t = (D & 15) + (e & 15) + (A & P.C) & 65535, n = (D >>> 4) + (e >>> 4) & 65535;
		t > 9 && (t = t + 6 & 65535, n = n + 1 & 65535);
		var r = new T();
		r.setW(D + e + (A & P.C)), r.getBL() ? A = A & ~P.Z & 255 : A |= P.Z, n & 8 ? A |= P.N : A = A & ~P.N & 255, ~(D ^ e) & (n << 4 ^ D) & 128 ? A |= P.V : A = A & ~P.V & 255, n > 9 && (n = n + 6 & 65535), n > 15 ? A |= P.C : A = A & ~P.C & 255, D = (n << 4 | t & 15) & 255;
	} else {
		var i = new T();
		i.setW(D + e + (A & P.C)), i.getBH() ? A |= P.C : A = A & ~P.C & 255, ~(D ^ e) & (D ^ i.getBL()) & 128 ? A |= P.V : A = A & ~P.V & 255, F(i.getBL()), D = i.getBL();
	}
}
function gc() {
	D &= E(M.getW()), F(D);
}
function _c() {
	D & 128 ? A |= P.C : A = A & ~P.C & 255, D = D << 1 & 255, F(D);
}
function vc() {
	var e = E(M.getW());
	e & 128 ? A |= P.C : A = A & ~P.C & 255, e = e << 1 & 255, qs(M.getW(), e), F(e);
}
function yc() {
	oc(!(A & P.C));
}
function bc() {
	oc(A & P.C);
}
function xc() {
	oc(A & P.Z);
}
function Sc() {
	var e = E(M.getW());
	e & D ? A = A & ~P.Z & 255 : A |= P.Z, A = A & ~P.V & 255, A = A & ~P.N & 255, A |= e & 64, A |= e & 128;
}
function Cc() {
	oc(A & P.N);
}
function wc() {
	oc(!(A & P.Z));
}
function Tc() {
	oc(!(A & P.N));
}
function Ec() {
	j.wPlusPlus(), A |= P.B, rc(j.getBH()), rc(j.getBL()), rc(A), A |= P.I, j.setBL(Js[tc.L]), j.setBH(Js[tc.H]);
}
function Dc() {
	oc(!(A & P.V));
}
function Oc() {
	oc(A & P.V);
}
function kc() {
	A = A & ~P.C & 255;
}
function Ac() {
	A = A & ~P.D & 255;
}
function jc() {
	A = A & ~P.I & 255;
}
function Mc() {
	A = A & ~P.V & 255;
}
function Nc() {
	var e = E(M.getW());
	D >= e ? A |= P.C : A = A & ~P.C & 255, F(D - e & 255);
}
function Pc() {
	var e = E(M.getW());
	O >= e ? A |= P.C : A = A & ~P.C & 255, F(O - e & 255);
}
function Fc() {
	var e = E(M.getW());
	k >= e ? A |= P.C : A = A & ~P.C & 255, F(k - e & 255);
}
function Ic() {
	var e = E(M.getW());
	e = e - 1 & 255, qs(M.getW(), e), F(e);
}
function Lc() {
	O = O - 1 & 255, F(O);
}
function Rc() {
	k = k - 1 & 255, F(k);
}
function zc() {
	D ^= E(M.getW()), F(D);
}
function Bc() {
	var e = E(M.getW());
	e = e + 1 & 255, qs(M.getW(), e), F(e);
}
function Vc() {
	O = O + 1 & 255, F(O);
}
function Hc() {
	k = k + 1 & 255, F(k);
}
function Uc() {
	j.copy(M);
}
function Wc() {
	j.wMinusMinus(), rc(j.getBH()), rc(j.getBL()), j.copy(M);
}
function Gc() {
	D = E(M.getW()), F(D);
}
function Kc() {
	O = E(M.getW()), F(O);
}
function qc() {
	k = E(M.getW()), F(k);
}
function Jc() {
	A = A & ~P.C & 255, A |= D & 1, D = D >>> 1 & 255, F(D);
}
function Yc() {
	var e = E(M.getW());
	A = A & ~P.C & 255, A |= e & 1, e = e >>> 1 & 255, qs(M.getW(), e), F(e);
}
function Xc() {
	D |= E(M.getW()), F(D);
}
function Zc() {
	rc(D);
}
function Qc() {
	A |= P.B, rc(A);
}
function $c() {
	D = ic(), F(D);
}
function el() {
	A = ic();
}
function tl() {
	var e = A;
	D & 128 ? A |= P.C : A = A & ~P.C & 255, D = D << 1 & 255, D |= e & P.C, F(D);
}
function nl() {
	var e = E(M.getW()), t = A;
	e & 128 ? A |= P.C : A = A & ~P.C & 255, e = e << 1 & 255, e |= t & 1, qs(M.getW(), e), F(e);
}
function rl() {
	var e = A;
	A = A & ~P.C & 255, A |= D & 1, D = D >>> 1 & 255, e & P.C && (D |= 128), F(D);
}
function il() {
	var e = E(M.getW()), t = A;
	A = A & ~P.C & 255, A |= e & 1, e = e >>> 1 & 255, t & 1 && (e |= 128), qs(M.getW(), e), F(e);
}
function al() {
	A = ic(), j.setBL(ic()), j.setBH(ic());
}
function ol() {
	j.setBL(ic()), j.setBH(ic()), j.wPlusPlus();
}
function sl() {
	var e = E(M.getW());
	if (A & P.D) {
		var t = new T();
		t.setW(D - e - !(A & P.C));
		var n = (D & 15) - (e & 15) - !(A & P.C), r = (D >>> 4) - (e >>> 4);
		n < 0 && (n -= 6, --r), r < 0 && (r -= 6);
		var i = new T();
		i.setW(D - e - !(A & P.C)), i.getBH() ? A = A & ~P.C & 255 : A |= P.C, (D ^ e) & (D ^ i.getBL()) & 128 ? A |= P.V : A = A & ~P.V & 255, F(i.getBL()), t.getBL() ? A = A & ~P.Z & 255 : A |= P.Z, D = (r << 4 | n & 15) & 255;
	} else {
		var i = new T();
		i.setW(D - e - !(A & P.C)), i.getBH() ? A = A & ~P.C & 255 : A |= P.C, (D ^ e) & (D ^ i.getBL()) & 128 ? A |= P.V : A = A & ~P.V & 255, F(i.getBL()), D = i.getBL();
	}
}
function cl() {
	var e = E(j.wPlusPlus()), t = D & O, n = t - e & 255;
	O = n, t >= e ? A |= P.C : A = A & ~P.C & 255, F(n);
}
function ll() {
	A |= P.C;
}
function ul() {
	A |= P.D;
}
function dl() {
	A |= P.I;
}
function fl() {
	qs(M.getW(), D), M.getW() < 0 && (console.error("sally_STA: %d, %d", M.getW(), D), HALT = !0);
}
function pl() {
	qs(M.getW(), O);
}
function ml() {
	qs(M.getW(), k);
}
function hl() {
	O = D, F(O);
}
function gl() {
	k = D, F(k);
}
function _l() {
	O = Xs, F(O);
}
function vl() {
	D = O, F(D);
}
function yl() {
	Xs = O;
}
function bl() {
	D = k, F(D);
}
function xl() {
	D = 0, O = 0, k = 0, A = P.R, Xs = 0, j.setW(0), Sl = 0;
}
var Sl = 0;
function Cl() {
	Qs = !1;
	var e = j.wPlusPlus();
	switch (Zs = E(e), N = nc[Zs], N === void 0 ? console.error("Unknown opcode, mem location: %d, %d", e, Zs.toString(16)) : Sl-- > 0 && console.log("Opcode:%s %d %d %d %d", Zs.toString(16), N, Xf(), 454, ip()), Zs) {
		case 203: return cl(), N;
		case 0: return Ec(), N;
		case 1: return dc(), Xc(), N;
		case 5: return B(), Xc(), N;
		case 6: return B(), vc(), N;
		case 8: return Qc(), N;
		case 9: return z(), Xc(), N;
		case 10: return _c(), N;
		case 13: return L(), Xc(), N;
		case 14: return L(), vc(), N;
		case 16: return pc(), Tc(), N;
		case 17: return fc(), Xc(), I(k), N;
		case 21: return V(), Xc(), N;
		case 22: return V(), vc(), N;
		case 24: return kc(), N;
		case 25: return lc(), Xc(), I(k), N;
		case 29: return R(), Xc(), I(O), N;
		case 30: return R(), vc(), N;
		case 32: return L(), Wc(), N;
		case 33: return dc(), gc(), N;
		case 36: return B(), Sc(), M.getW() == Ys && (Qs = !0), N;
		case 37: return B(), gc(), N;
		case 38: return B(), nl(), N;
		case 40: return el(), N;
		case 41: return z(), gc(), N;
		case 42: return tl(), N;
		case 44: return L(), Sc(), N;
		case 45: return L(), gc(), N;
		case 46: return L(), nl(), N;
		case 48: return pc(), Cc(), N;
		case 49: return fc(), gc(), I(k), N;
		case 53: return V(), gc(), N;
		case 54: return V(), nl(), N;
		case 56: return ll(), N;
		case 57: return lc(), gc(), I(k), N;
		case 61: return R(), gc(), I(O), N;
		case 62: return R(), nl(), N;
		case 64: return al(), N;
		case 65: return dc(), zc(), N;
		case 69: return B(), zc(), N;
		case 70: return B(), Yc(), N;
		case 72: return Zc(), N;
		case 73: return z(), zc(), N;
		case 74: return Jc(), N;
		case 76: return L(), Uc(), N;
		case 77: return L(), zc(), N;
		case 78: return L(), Yc(), N;
		case 80: return pc(), Dc(), N;
		case 81: return fc(), zc(), I(k), N;
		case 85: return V(), zc(), N;
		case 86: return V(), Yc(), N;
		case 88: return jc(), N;
		case 89: return lc(), zc(), I(k), N;
		case 93: return R(), zc(), I(O), N;
		case 94: return R(), Yc(), N;
		case 96: return ol(), N;
		case 97: return dc(), hc(), N;
		case 101: return B(), hc(), N;
		case 102: return B(), il(), N;
		case 104: return $c(), N;
		case 105: return z(), hc(), N;
		case 106: return rl(), N;
		case 108: return uc(), Uc(), N;
		case 109: return L(), hc(), N;
		case 110: return L(), il(), N;
		case 112: return pc(), Oc(), N;
		case 113: return fc(), hc(), I(k), N;
		case 117: return V(), hc(), N;
		case 118: return V(), il(), N;
		case 120: return dl(), N;
		case 121: return lc(), hc(), I(k), N;
		case 125: return R(), hc(), I(O), N;
		case 126: return R(), il(), N;
		case 129: return dc(), fl(), N;
		case 132: return B(), ml(), N;
		case 133: return B(), fl(), N;
		case 134: return B(), pl(), N;
		case 136: return Rc(), N;
		case 138: return vl(), N;
		case 140: return L(), ml(), N;
		case 141: return L(), fl(), N;
		case 142: return L(), pl(), N;
		case 144: return pc(), yc(), N;
		case 145: return fc(), fl(), N;
		case 148: return V(), ml(), N;
		case 149: return V(), fl(), N;
		case 150: return mc(), pl(), N;
		case 152: return bl(), N;
		case 153: return lc(), fl(), N;
		case 154: return yl(), N;
		case 157: return R(), fl(), N;
		case 160: return z(), qc(), N;
		case 161: return dc(), Gc(), N;
		case 162: return z(), Kc(), N;
		case 164: return B(), qc(), N;
		case 165: return B(), Gc(), N;
		case 166: return B(), Kc(), N;
		case 168: return gl(), N;
		case 169: return z(), Gc(), N;
		case 170: return hl(), N;
		case 172: return L(), qc(), N;
		case 173: return L(), Gc(), N;
		case 174: return L(), Kc(), N;
		case 176: return pc(), bc(), N;
		case 177: return fc(), Gc(), I(k), N;
		case 180: return V(), qc(), N;
		case 181: return V(), Gc(), N;
		case 182: return mc(), Kc(), N;
		case 184: return Mc(), N;
		case 185: return lc(), Gc(), I(k), N;
		case 186: return _l(), N;
		case 188: return R(), qc(), I(O), N;
		case 189: return R(), Gc(), I(O), N;
		case 190: return lc(), Kc(), I(k), N;
		case 192: return z(), Fc(), N;
		case 193: return dc(), Nc(), N;
		case 196: return B(), Fc(), N;
		case 197: return B(), Nc(), N;
		case 198: return B(), Ic(), N;
		case 200: return Hc(), N;
		case 201: return z(), Nc(), N;
		case 202: return Lc(), N;
		case 204: return L(), Fc(), N;
		case 205: return L(), Nc(), N;
		case 206: return L(), Ic(), N;
		case 208: return pc(), wc(), N;
		case 209: return fc(), Nc(), I(k), N;
		case 213: return V(), Nc(), N;
		case 214: return V(), Ic(), N;
		case 216: return Ac(), N;
		case 217: return lc(), Nc(), I(k), N;
		case 221: return R(), Nc(), I(O), N;
		case 222: return R(), Ic(), N;
		case 224: return z(), Pc(), N;
		case 225: return dc(), sl(), N;
		case 228: return B(), Pc(), N;
		case 229: return B(), sl(), N;
		case 230: return B(), Bc(), N;
		case 232: return Vc(), N;
		case 233: return z(), sl(), N;
		case 234: return N;
		case 236: return L(), Pc(), N;
		case 237: return L(), sl(), N;
		case 238: return L(), Bc(), N;
		case 240: return pc(), xc(), N;
		case 241: return fc(), sl(), I(k), N;
		case 245: return V(), sl(), N;
		case 246: return V(), Bc(), N;
		case 248: return ul(), N;
		case 249: return lc(), sl(), I(k), N;
		case 253: return R(), sl(), I(O), N;
		case 254: return R(), Bc(), N;
		case 75: return z(), gc(), Jc(), N;
		case 11:
		case 43: return z(), gc(), D & 128 ? A |= P.C : A = A & ~P.C & 255, N;
		case 179: return fc(), Gc(), hl(), N;
		case 151: return mc(), Qc(), Zc(), pl(), gc(), fl(), $c(), el(), N;
		case 100:
		case 137: return N;
		case 4:
			j.wPlusPlus();
			break;
		case 128: return N;
		case 175: return L(), Gc(), hl(), N;
		case 252:
		case 251:
		case 250:
		case 247:
		case 244:
		case 243:
		case 242:
		case 239:
		case 235:
		case 231:
		case 227:
		case 226:
		case 223:
		case 220:
		case 219:
		case 218:
		case 215:
		case 212:
		case 211:
		case 210:
		case 207:
		case 203:
		case 199:
		case 195:
		case 194:
		case 191:
		case 187:
		case 183:
		case 178:
		case 171:
		case 167:
		case 163:
		case 159:
		case 158:
		case 156:
		case 155:
		case 147:
		case 146:
		case 143:
		case 139:
		case 135:
		case 131:
		case 130:
		case 127:
		case 124:
		case 123:
		case 122:
		case 119:
		case 116:
		case 115:
		case 114:
		case 111:
		case 107:
		case 103:
		case 99:
		case 98:
		case 95:
		case 92:
		case 91:
		case 90:
		case 87:
		case 84:
		case 83:
		case 82:
		case 79:
		case 71:
		case 68:
		case 67:
		case 66:
		case 63:
		case 60:
		case 59:
		case 58:
		case 55:
		case 52:
		case 51:
		case 50:
		case 47:
		case 39:
		case 35:
		case 34:
		case 31:
		case 28:
		case 27:
		case 26:
		case 23:
		case 20:
		case 19:
		case 18:
		case 15:
		case 12:
		case 7:
		case 3:
		case 2: return N;
	}
	return N;
}
function wl() {
	return A = P.I | P.R | P.Z, j.setBL(Js[$s.L]), j.setBH(Js[$s.H]), 6;
}
function Tl() {
	return rc(j.getBH()), rc(j.getBL()), A = A & ~P.B & 255, rc(A), A |= P.I, j.setBL(Js[ec.L]), j.setBH(Js[ec.H]), 7;
}
function El() {
	return D;
}
function Dl(e) {
	D = e;
}
function Ol() {
	return O;
}
function kl(e) {
	O = e;
}
function Al() {
	return k;
}
function jl(e) {
	k = e;
}
function Ml() {
	return A;
}
function Nl(e) {
	A = e;
}
function Pl() {
	return Xs;
}
function Fl(e) {
	Xs = e;
}
function Il() {
	return j;
}
function Ll() {
	return Qs;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Rect.js
function Rl(e, t, n, r) {
	this.Update = function(e, t, n, r) {
		this.left = e, this.top = t, this.right = n, this.bottom = r, this.length = this.right - this.left + 1, this.height = this.bottom - this.top + 1, this.area = this.length * this.height;
	}, this.Copy = function(e) {
		this.Update(e.left, e.top, e.right, e.bottom);
	}, this.GetArea = function() {
		return this.area;
	}, this.GetLength = function() {
		return this.length;
	}, this.GetHeight = function() {
		return this.height;
	}, this.Update(e, t, n, r);
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Maria.js
var zl = /* @__PURE__ */ t({
	Clear: () => _u,
	IsNMI: () => yu,
	MARIA_CYCLE_LIMIT: () => 428,
	RenderScanline: () => gu,
	Reset: () => hu,
	SetSurface: () => vu,
	displayArea: () => U,
	visibleArea: () => ql
}), H = g, Bl = 32, Vl = 44, Hl = 48, Ul = 52, Wl = 60, Gl = 77440, Kl = 160, U = new Rl(0, 17, 319, 258), ql = new Rl(0, 26, 319, 248), Jl = null, Yl = [Array(Kl), Array(Kl)], Xl = 0, W = Yl[Xl], G = 0, Zl = !1, K = new T(), q = new T(), J = new T(), Y = 0, Ql = 0, $l = 0, eu = 0, tu = 0, nu = 0, X = !1, ru = !1, iu = !1, au = !1, ou = !1;
function Z(e) {
	if (ou) {
		var t, n;
		if (!(Vo() & 1) || e < 32768 || !(Vo() & 2) && e < 49152) return ha(e);
		if (e >= 49152) return ha(e - 32768);
		if (e < 40960) return ha(e + 16384);
		t = xo[e & 128 ? 1 : 0], n = ((t & 254) << 4 | t & 1) << 7;
		var r = e & 3967 | n;
		return r >= ms() ? 0 : C[r];
	}
	return au ? ga(e) : ha(e);
}
function su(e) {
	Y < Kl && (e ? W[Y] = Ql | e : H[Wl] & 4 && (W[Y] = Ql)), Y = Y + 1 & 255;
}
function cu(e, t) {
	var n = H[Wl] & 4, r = Ql & 16 | e | t;
	(r & 3 || n) && Y < Kl && (W[Y] = r), Y = Y + 1 & 255;
}
function lu() {
	return !!(J.getW() > 32767 && (tu && J.getW() & 4096 || eu && J.getW() & 2048));
}
function Q(e) {
	return e &= 255, e & 3 ? H[Bl + e] : H[Bl];
}
function uu() {
	var e = X ? H[J.getW()] : Z(J.getW());
	nu ? lu() ? Y = Y + 2 & 255 : (cu(e & 12, (e & 192) >>> 6), cu((e & 48) >>> 4, (e & 3) << 2)) : lu() ? Y = Y + 4 & 255 : (su((e & 192) >>> 6), su((e & 48) >>> 4), su((e & 12) >>> 2), su(e & 3)), J.wPlusPlus();
}
function du(e, t) {
	for (var n = 0; n < 8; n++) e[t + n] = e[t + n] & 15;
}
function fu(e, t) {
	var n = H[Wl] & 3, r = t;
	if (n == 0) for (var i = 0; i < Kl; i += 4) {
		var a = Q(W[i + 0]);
		e[r++] = a, e[r++] = a, a = Q(W[i + 1]), e[r++] = a, e[r++] = a, a = Q(W[i + 2]), e[r++] = a, e[r++] = a, a = Q(W[i + 3]), e[r++] = a, e[r++] = a, Zl && du(e, r - 8);
	}
	else if (n == 2) for (var i = 0; i < Kl; i += 4) e[r++] = Q(W[i + 0] & 16 | (W[i + 0] & 8) >>> 3 | W[i + 0] & 2), e[r++] = Q(W[i + 0] & 16 | (W[i + 0] & 4) >>> 2 | (W[i + 0] & 1) << 1), e[r++] = Q(W[i + 1] & 16 | (W[i + 1] & 8) >>> 3 | W[i + 1] & 2), e[r++] = Q(W[i + 1] & 16 | (W[i + 1] & 4) >>> 2 | (W[i + 1] & 1) << 1), e[r++] = Q(W[i + 2] & 16 | (W[i + 2] & 8) >>> 3 | W[i + 2] & 2), e[r++] = Q(W[i + 2] & 16 | (W[i + 2] & 4) >>> 2 | (W[i + 2] & 1) << 1), e[r++] = Q(W[i + 3] & 16 | (W[i + 3] & 8) >>> 3 | W[i + 3] & 2), e[r++] = Q(W[i + 3] & 16 | (W[i + 3] & 4) >>> 2 | (W[i + 3] & 1) << 1), Zl && du(e, r - 8);
	else if (n == 3) for (var i = 0; i < Kl; i += 4) e[r++] = Q(W[i + 0] & 30), e[r++] = Q(W[i + 0] & 28 | (W[i + 0] & 1) << 1), e[r++] = Q(W[i + 1] & 30), e[r++] = Q(W[i + 1] & 28 | (W[i + 1] & 1) << 1), e[r++] = Q(W[i + 2] & 30), e[r++] = Q(W[i + 2] & 28 | (W[i + 2] & 1) << 1), e[r++] = Q(W[i + 3] & 30), e[r++] = Q(W[i + 3] & 28 | (W[i + 3] & 1) << 1), Zl && du(e, r - 8);
	if (Jo() && (n == 2 || n == 3)) {
		var o = 0, s = 0, c = 0;
		c = e[t + 1] & 15;
		for (var r = t + 2; r < Kl * 2 + t - 1; r += 1) o = s, s = c, c = e[r] & 15, o == 0 && s > 5 && c == 0 && (e[r - 1] = e[r - 1] & 240 | (s >> 1) + 1, e[r - 2] = e[r - 1]);
	}
}
var pu = new T();
function mu() {
	G += 16;
	for (var e = X ? H[q.getW() + 1] : Z(q.getW() + 1); e & 95 && G < 428;) {
		var t = 0, n = 0;
		J.setBL(X ? H[q.getW()] : Z(q.getW())), J.setBH(X ? H[q.getW() + 2] : Z(q.getW() + 2)), e & 31 ? (G += 8, Ql = ((X ? H[q.getW() + 1] : Z(q.getW() + 1)) & 224) >>> 3 & 255, Y = X ? H[q.getW() + 3] : Z(q.getW() + 3), t = (X ? H[q.getW() + 1] : Z(q.getW() + 1)) & 31, t = (~t & 31) + 1 & 255, q.wPlusEqual(4)) : (G += 10, Ql = ((X ? H[q.getW() + 3] : Z(q.getW() + 3)) & 224) >>> 3 & 255, Y = X ? H[q.getW() + 4] : Z(q.getW() + 4), n = (X ? H[q.getW() + 1] : Z(q.getW() + 1)) & 32, nu = (X ? H[q.getW() + 1] : Z(q.getW() + 1)) & 128, t = (X ? H[q.getW() + 3] : Z(q.getW() + 3)) & 31, t = (t == 0 ? 32 : (~t & 31) + 1) & 255, q.wPlusEqual(5));
		var r = !1;
		if (n) {
			var i = H[Wl] & 16;
			pu.copy(J);
			for (var a = 0; a < t && !(G >= 428); a++) J.setBL(X ? H[pu.wPlusPlus()] : Z(pu.wPlusPlus())), J.setBH(H[Ul] + $l), lu() ? r || (G += 3, r = !0) : (G += 6, i && (G += 3)), uu(), i && uu();
		} else {
			J.bhPlusEqual($l);
			for (var a = 0; a < t && !(G >= 428); a++) lu() ? r || (G += 3, r = !0) : G += 3, uu();
		}
		e = X ? H[q.getW() + 1] : Z(q.getW() + 1);
	}
	$l == 0 && (G += 6, (X ? H[K.getW() + 3] : Z(K.getW() + 3)) & 128 && (G += 17));
}
function hu() {
	Jl || (Jl = js_get_blit_addr());
	for (var e = 0; e < Gl; e++) Jl[e] = 0;
	for (var e = 0; e < Kl; e++) Yl[0][e] = 0, Yl[1][e] = 0;
	G = 0, Zl = !1, K.setW(0), q.setW(0), J.setW(0), Y = 0, Ql = 0, $l = 0, eu = 0, tu = 0, nu = 0, ru = !1, au = !1;
}
function gu(e) {
	if (iu && (au = !0), G = 0, Zl = H[Wl] & 128, ru = !1, (H[Wl] & 96) != 64 && e >= ql.top && e <= ql.bottom) for (var t = Q(0), n = (e - U.top) * U.GetLength(), r = 0; r < Kl; r++) Jl[n++] = t, Jl[n++] = t;
	else if ((H[Wl] & 96) == 64 && e >= U.top && e <= U.bottom && (e == U.top && (K.setBL(H[Hl]), K.setBH(H[Vl]), eu = (X ? H[K.getW()] : Z(K.getW())) & 32, tu = (X ? H[K.getW()] : Z(K.getW())) & 64, $l = (X ? H[K.getW()] : Z(K.getW())) & 15, q.setBL(X ? H[K.getW() + 2] : Z(K.getW() + 2)), q.setBH(X ? H[K.getW() + 1] : Z(K.getW() + 1)), (X ? H[K.getW()] : Z(K.getW())) & 128 && (ru = !0)), e >= U.top && e != U.bottom)) {
		q.setBL(X ? H[K.getW() + 2] : Z(K.getW() + 2)), q.setBH(X ? H[K.getW() + 1] : Z(K.getW() + 1)), W = Yl[Xl], mu(), Xl = Xl == 1 ? 0 : 1, W = Yl[Xl], e >= ql.top && e <= ql.bottom && fu(Jl, (e - U.top) * U.GetLength());
		for (var r = 0; r < Kl; r++) W[r] = 0;
		e > U.top && ($l == 0 ? (K.wPlusEqual(3), eu = (X ? H[K.getW()] : Z(K.getW())) & 32, tu = (X ? H[K.getW()] : Z(K.getW())) & 64, $l = (X ? H[K.getW()] : Z(K.getW())) & 15, (X ? H[K.getW()] : Z(K.getW())) & 128 && (ru = !0)) : $l--);
	}
	return iu && (au = !1), G;
}
function _u() {
	for (var e = 0; e < Gl; e++) Jl[e] = 0;
}
function vu(e) {
	Jl = e;
}
function yu() {
	return ru;
}
Gn(new f("onCartridgeLoaded", function(e) {
	X = !e.IsXmEnabled() && !e.IsBanksets() && e.GetType() !== e.CARTRIDGE_TYPE_SOUPER, console.log("Maria RAM Direct: " + X), iu = e.IsBanksets(), ou = e.GetType() == 8;
}));
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Palette.js
var bu = 768, xu = !0, Su = Array(768);
function Cu(e) {
	for (var t = 0; t < bu; t++) Su[t] = e[t];
}
function wu(e) {
	for (var t = atob(e.split(",")[1]), n = [], r = 0; r < t.length; r++) n.push(t.charCodeAt(r));
	return n;
}
function Tu() {
	return xu;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/Sound.js
var Eu = /* @__PURE__ */ t({
	SetFrequency: () => Ju,
	SetMuted: () => qu,
	SetSampleRate: () => Xu,
	SetScanlines: () => Yu,
	SetStoreSoundCallback: () => Zu,
	Store: () => Ku
}), Du = Le, Ou = At, ku = qr, Au = di, ju = hn, Mu = yn, Nu = null, Pu = 8192, Fu = null, Iu = 0, Lu = 0, Ru = 0, zu = !1, Bu = !1, Vu = !1;
function Hu(e, t, n) {
	var r = e / n | 0, i = e % n | 0;
	return i != 0 && i >= t && r++, r;
}
function Uu(e, t, n, r) {
	for (var i = Ru, a = 0, o = 0, s = Iu * Lu << 1; o < r;) i >= s ? (n[o++] = e[a] + (t ? t[a] : 0), i -= s) : (a++, i += Ru);
}
var Wu = Array(Pu), Gu = Array(Pu);
function Ku() {
	var e = zu || ju(), t = Mu(), n = Nu(), r = Hu(Ru, n, Iu);
	if (Uu(ku, e ? Du : null, Wu, r), Bu) {
		let e = new Int16Array(Module.HEAP16.buffer, window.Module._bupchip_GetBupChipBuffer(), r << 1);
		for (let t = 0; t < r; t++) {
			let n = Wu[t] / 255, r = e[t * 2];
			r === void 0 ? Wu[t] = 0 : Wu[t] = (r / 32768 + e[t * 2 + 1] / 32768) / 2, Wu[t] = n * .4 + Wu[t] * .6, Wu[t] *= 255;
		}
	}
	return Au(), Ou(), t && Vt(Gu, r, 0), Vu || Fu(Wu, t ? Gu : null, r), !0;
}
function qu(e) {
	return Vu = e, !0;
}
function Ju(e) {
	Iu = e;
}
function Yu(e) {
	Lu = e;
}
function Xu(e) {
	Bu && (e = 31440), console.log("Set sample rate: %d", e), gt(e), Ht(e), Ru = e;
}
function Zu(e) {
	Fu = e;
}
function Qu() {
	zu = Yo(), Bu = as();
}
function $u() {
	Nu = qf;
}
Gn(new f("init", $u)), Gn(new f("onCartridgeLoaded", Qu));
//#endregion
//#region js7800-core/audio-stub.js
var ed = /* @__PURE__ */ t({
	reinit: () => ad,
	setOutputRate: () => id,
	takeSamples: () => od
}), td = null, nd = [];
function rd(e, t, n) {
	let r = new Float32Array(n);
	for (let i = 0; i < n; i++) r[i] = t ? (e[i] / 255 + t[i] / 128) / 2 : e[i] / 255;
	nd.push(r);
}
function id(e) {
	td = e;
}
function ad(e) {
	Zu(rd), Xu(td ?? e);
}
function od() {
	let e = 0;
	for (let t of nd) e += t.length;
	let t = new Float32Array(e), n = 0;
	for (let e of nd) t.set(e, n), n += e.length;
	return nd = [], t;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/palettes/NTSC/JS7800_NTSC_257_Cool-DK.pal
var sd = "data:application/octet-stream;base64,AAAAGhoaLCwsPDw8S0tLWVlZZmZmc3Nzf39/i4uLl5eXo6Ojrq6uubm5xMTEzs7OJxUANygARjgAVEcAYlUAb2MAfHAAiHwAlIgAn5QHqqAdtqsvwLY/y8FN1sxb4NZoRAAAUg0AYCEAbTIAekIAhlAAkl4AnWsAqXgCtIQbv5Atypw91KdL37JZ6b1n88hzVAAAYgAAbwYAex0AiC8AlD4An00Pqlsjtmg0wHVDy4FS1o1f4Jls6qR59bCF/7uRVwAAZQAAcgABfgoaih8sljE8okBLrU9ZuF1mw2pzznd/2IOM4o+X7Zuj96au/7G5TQArWwA7aABKdQBYgRlljStymTt+pUqLsFiWu2WixnKt0H+424vD5ZfO76LY+a3jNgBfRQBsUwB5YQiFbh6Rei+dhz+okk6znly+qWnJtXbTv4Leyo7o1Zry36X86bD/EAB+IwCLNAKWRBqiUiytYDy4bUvDeVnOhmbYknPjnYDtqYz3tJj/v6P/ya7/1Ln/AACJAAiVCx6hIDCsMT+3QU7CT1zNXWnXanbid4Lsg472j5r/m6X/prH/srz/vcb/ABF/ACWLADWXAEWiD1OuI2G5NG7EQ3rOUYbZX5LjbJ7tean3hbT/kb//ncr/qNX/AClgADltAEh6AFaGAGSSC3GeIH2pMYm0QZW/T6HKXazUarffd8Lpg83zj9f9m+L/ADcsAEY8AFVLAGJZAG9nBHxzG4iALZSMPZ+YTKujWrauZ8G5dMvEgNbPjODZmOvkAD0AAEsAAFkFAGccAHMuFoA+KYxMOZhaSKNoVq50ZLmBccSNfc+ZidmkleSvoe66ADkAAEgAAFYADGMAIXAAMn0AQokRUJUkXqA1a6xEeLdThMJgkMxtnNd6p+GGsuuSACsADjwAIkoAM1gAQ2YAUXMAX38AbIsAeZcEhaIcka4tnLk9qMRMs85avtlnyeN0JhUANigARTgAVEgAYVYAbmMAe3AAh30Ak4kAn5UHqqAdtasvwLc/y8FN1cxb4Ndo", cd = "data:application/octet-stream;base64,AAAAGhoaLCwsPDw8S0tLWVlZZmZmc3Nzf39/i4uLl5eXo6Ojrq6uubm5xMTEzs7OJxUANygARjgAVEcAYlUAb2MAfHAAiHwAlIgAn5QHqqAdtqsvwLY/y8FN1sxb4NZoRQAAUwsAYSAAbjEAekEAh1AAk10AnmoAqXcFtYMcwI8uyps+1aZM37Ja6r1o9Md0VQAAYwAAcAMAfBsAiC0AlD0AoEwVq1ontmc4wXRHzIBV1oxj4Zhw66N89a+I/7qUVwAAZAAAcQAPfggjih40li9DoT9SrE5fuFxswml5zXaF2IKR4o6d7Jqo9qWz/7C+SgA1WABEZQBTcgBgfxltiyt6lzuGokqSrVieuGWpw3K0zn+/2YvK45fU7aLf963pLwBnPwB0TQCAWwuMaSCYdTKkgkGvjlC6mV3FpWvPsHfau4Tkxo/u0Zv526f/5bL/AACDGQCPKwqbOyCmSjGxWEC8Zk/Hcl3Sf2rci3fnl4Pxoo/7rpv/uab/w7H/zrz/AACIABKUACWgFDarJ0W2OFTBR2HMVW7WY3vhcIfrfJP1iJ7/lKr/oLX/q8D/tsr/ABp3ACyDADyPAEubAFmmGmayLHO9PIDHS4zSWZfcZqPnc67xf7n7i8T/l8//o9n/AC9PAD9dAE5qAFt3AGmDBXWPHIKbLo6mPpqyTKW9WrDHaLvSdMbcgdHnjdvxmeX7ADsNAEkiAFgzAGVCAHJRCn5eH4prMJZ4QKKET62QXLicasOnds6yg9i9j+LImu3TADwAAEsAAFkAAGYADnMNIn8hM4syQ5dCUaNQX65ebLlreMR4hc6EkdmQnOOcqO6nADMAAEMADFEAIV8AMmwAQXgAUIUAXpEGa5wdeKgvhLM+kL5Nm8lbp9Nost51veiBEiEAJjIANkEARlAAVF4AYWsAbncAe4QAh5AAk5sMn6chqrIytb1CwMhQy9Je1d1rOQAASBoAViwAYzwAcEsAfVkAiWYAlXMAoH8ArIsOt5ciwaMzzK5D17lR4cRf685s", ld = "data:application/octet-stream;base64,AAAAGhoaLCwsPDw8S0tLWVlZZmZmc3Nzf39/i4uLl5eXo6Ojrq6uubm5xMTEzs7OJxUANygARjgAVEcAYlUAb2MAfHAAiHwAlIgAn5QHqqAdtqsvwLY/y8FN1sxb4NZoRgAAVAoAYh8AbzEAe0AAh08Ak10An2oAqnYHtYMdwI8vy5o/1aZN4LFb6rxp9Md1VgAAYwAAcAAAfRoAiSwAlTwAoEsarFkst2Y8wnNLzH9Z14tm4Zdz66N/9q6L/7mXVgAAZAAAcQAZfQYriR07lS5KoT5YrE1lt1tywmh/zXWL14GX4Y2i7Jmt9qS4/7DDRwA+VQBNYwBbcABofBl1iCuBlDuNoEqZq1iktmawwXO7zH/F1ovQ4Zfb66Ll9a7vKABuOQB7SACHVg+TYyOecDSqfUO1iVLAlV/KoGzVrHnft4XqwpH0zJ3+16j/4bP/AACGDgCSIhGeMyWpQzW0UUW/X1PKbGDVeW7fhXrpkYbznJL9qJ7/s6n/vrT/yb//AACGABqSACyeCDypHku0MFm/P2bKTnPUXH/faYvpdpfzgqP9jq7/mrn/pcT/sM7/ACJtADN6AEKGAFGSAF6eEmupJni0NoS/RZDKVJzUYaffbrPpe73zh8j9k9P/nt3/ADQ9AERMAFJaAGBnAG10A3mAG4WMLZGYPZ2kS6ivWbS6Z77FdMnPgNTajN7kmOnuADwAAEsAAFkXAGYqAHM6EYBJJYxXNpdkRaNxU65+YbmKbsSWes+hh9mtk+S4nu7CADoAAEgAAFcABmQAHXEAL30APooYTZUrW6E7aKxKdbdYgcJljc1ymdd+peKLsOyWACwADDwAIUsAMlkAQmYAUHMAXn8Aa4wAeJcGhKMdkK4unLk+p8RNss9bvdloyON1JxQAOCcARzgAVUcAY1UAcGIAfG8AiHwAlIgAoJQHq58dtqsvwbY/zMFN1stb4dZoRgAAVAkAYh8AbzAAfEAAiE4AlFwAn2kAqnYItoIewI4wy5o/1qZO4LFc6rxp9cd2", ud = "data:application/octet-stream;base64,AAAAGhoaLCwsPDw8S0tLWVlZZmZmc3Nzf39/i4uLl5eXo6Ojrq6uubm5xMTEzs7ODyIAIzMANEMARFEAUl8AYGwAbXgAeYUAhpEAkZwOnagiqLMztL5Dv8lRydNf1N5sNgUARRwAUy4AYT4Abk0AelsAh2gAknUAnoEAqY0MtZkhv6Qyyq9B1bpQ38Ve6dBrTQAAWwAAaBYAdSgAgTkAjUgAmVYApWMAsHAZu30sxok80JVK26BY5axm77dz+cJ/VwAAZQAAcgAAfhQAiicAljcaokYsrVU8uGJLw29Zznxm2Ihz4pR/7Z+L96uX/7ajVAAAYgAWbwAoewM5iBtIlC1Wnz1jqkxwtlp9wGeJy3SV1oCg4Iys6pi39aPC/6/MRABFUgBUYABhbQBuehp7hiyHkjyTnUueqVmqtGa1v3PAyn/L1IvV35fg6aPq8670JwBwNwB8RgCIVBCUYiSgbzSrfES2iFLBlGDMn23WqnnhtobrwJL1y53/1qn/4LT/AACGDwCSIxCdNCSpRDW0UkS/YFLKbWDUeW3fhnrpkYbznZL9qJ3/tKn/v7T/yb//AACHABeTACmfDTqqIki1M1fAQmTLUXHVXn3gbIrqeJX0hKH+kKz/nLf/p8L/s83/AB1zAC+AAD+MAE2YAFujF2iuKXW5OoLESY7PV5nZZKXkcbDufbv4isb/ldD/odv/ADBLAEBZAE9nAFx0AGqABHaMG4OYLY+jPZquTKa6WrHEZ7zPdMfagNHkjNzumOb4ADsJAEofAFgwAGVAAHJOCn5cH4tpMZZ2QKKCT62OXbiaasOmd86xg9i8j+PHm+3RADwAAEsAAFkAAGYADnMNIn8iM4szQpdCUaNRX65ebLlreMR4hc+EkdmQnOOcqO6nADQAAEMAClIAH18AMGwAQHkAT4UAXJEKap0fdqgwg7NAj75PmslcptRqsd52vOiDDiMAIjQAM0MAQ1EAUV8AX2wAbHkAeYUAhZEAkZ0OnKgiqLMzs75DvslRydNf095s", dd = "data:application/octet-stream;base64,AAAAGhoaLCwsPDw8S0tLWVlZZmZmc3Nzf39/i4uLl5eXo6Ojrq6uubm5xMTEzs7ODyIAIzMANEMARFEAUl8AYGwAbXgAeYUAhpEAkZwOnagiqLMztL5Dv8lRydNf1N5sNwQARhsAVC0AYj0Ab0wAe1oAiGcAk3QAn4AAqowNtZghwKQyy69C1rpQ4MVe6s9rTgAAXAAAaRQAdicAgzcAj0YAmlUApmIHsW8dvHwvx4g/0ZRN3J9b5qto8LZ1+sGCWAAAZQAAcgAAfxEAiyUOljYiokUzrVNCuGFRw25fznps2Id445KF7Z6R96mc/7WoUwAOYAAibQAzegFDhhpRkixfnjxsqUt5tFmFv2aRynOc1H+o34yz6Ze+86PJ/a7TPwBQTgBeWwBraQN3dRuEgi2Qjj2bmkynpVqysGe9u3TIxoDS0Yzd25jn5aPx8K/7HQB3LwCEPgCQTRSbWyenaDiydUe9gVXIjWPSmXDdpXznsIjxu5T7xqD/0Kv/27b/AACJAACUFxigKiqrOjq2SUnBV1fMZGXWcXLhfn7rior1lpb/oaL/ra3/uLj/wsP/AAqDAB+PADGbAECmFk+xKV28OWrHSHfSVoPcZI/mcZvxfab7ibH/lbz/ocf/rNL/ACVnADZ0AEWAAFSMAGGYDm6jInuvM4e6Q5PEUZ7PX6rabLXkecDuhcv4kdX/nOD/ADY1AEVEAFNSAGFgAG5tA3t6G4eGLZOSPZ6dTKqpWbW0Z8C/dMrJgNXUjN/fmOrpADwAAEsAAFkOAGciAHMzFIBDJ4xRN5hfR6NsVa55YrmFb8SRfM+ciNmolOSzn+6+ADkAAEgAAFYACmQAH3EAMX0AQIkUT5UnXaE3aqxHd7dVg8Jij8xvmtd8puGIseyUACwADjwAIkoAM1gAQ2YAUXMAX38AbIsAeJcEhaIcka4unLk9qMRMs85avtlnyeN0JxQANycARzgAVUcAYlUAb2MAfHAAiHwAlIgAn5QHq6AdtqsvwbY/y8FN1sxb4NZo", fd = "data:application/octet-stream;base64,AAAAGhoaLCwsPDw8S0tLWVlZZmZmc3Nzf39/i4uLl5eXo6Ojrq6uubm5xMTEzs7ODyIAIzMANEMARFEAUl8AYGwAbXgAeYUAhpEAkZwOnagiqLMztL5Dv8lRydNf1N5sOAEARxoAVSwAYzwAcEsAfFkAiGYAlHMAoIAAq4wNtpciwaMzzK5C1rlR4cRe689sUAAAXQAAaxEAdyUAhDYAkEUAm1MAp2EMsm4hvXoyyIdC0pNQ3Z5e56lr8bV4+8CEWAAAZQAAcgAAfw8AiyMXlzQqokM6rVJJuF9Xw21kznlx2IV+45GK7Z2W96ih/7OsUQAbXgAtawA9eABMhBlakCtnnDx0p0qAsliMvWaYyHOj03+v3Yu66JfE8qLP/K7aOgBZSQBmVwBzZAaAcR2Mfi6Xij6jlk2uoVu5rGjEt3XPwoHZzY3k2Jnu4qT47LD/EwB9JgCJNwCVRhmhVCusYTu3b0rCe1jNh2bXk3Lhn3/sqov2tZf/wKL/y67/1bn/AACJAAmVCh+hHzCsMUC3QE7CT1zNXWnXanbid4Lsg472j5r/m6b/prH/sbz/vMf/ABR9ACeJADiVAEegC1WsIGK3MW/CQXzMT4jXXZThap/sd6v2g7b/j8H/m8z/ptb/ACxYADxmAEtzAFl/AGaLCHOXHn+iL4yuP5e5TqPEW67OabnZdcTjgs/tjtn4muP/ADoaAEgsAFc8AGRLAHFZB31mHYpzL5WAP6GMTayXW7ejaMKudc25gtfEjuLPmezZADwAAEsAAFkAAGYACXMWH4ApMIw5QJdIT6NWXK5karlxdsR9g8+Jj9mVmuShpu6sADQAAEQACFIAHmAAL20AP3kAToUAXJEMaZ0hdqgygrRBjr5QmslepdRrsN53u+mEESIAJDMANUIARFEAU14AYGsAbXgAeoQAhpAAkpwNnqciqbMztL1Cv8hRytNe1N1rOQAASBoAViwAYzwAcEsAfVkAiWYAlXMAoH8ArIsOt5ciwaMzzK5D17lR4cRf685s", pd = "data:application/octet-stream;base64,AAAAHh4eMzMzRUVFV1dXZ2dndnZ2hYWFk5OToaGhr6+vvLy8ycnJ1tbW4+Pj7+/vJxUAOisATD4AXVAAbWEAfHAAi38AmY4Ap5wXtKotwrdAz8RS29Fi6N5y9OqB//ePRAAAVREAZikAdTwAhE4Akl8AoG8Arn4Qu4wnyJo71ahN4rZe7sNt+tB9/92L/+maVAAAZQAAdBEAgygAkjwAoE4QrV4ou247yH1N1Yxe4Zpu7qh9+raM/8Oa/9Co/9y1VwAAaAAAdwAOhhgmlC46okFMsFNcvWNsynN814KK5JCZ8J6m/Ky0/7nB/8bO/9PbTQArXgA+bgBQfRFgiyhwmjx/qE6OtV6cwm6qz3233IzE6JrR9aje/7bq/8P2/9D/NgBfSABvWQB+aReNeC2bh0CpllK2o2LDsXLQvoHdy4/p2J325av/8bj//cb//9L/EAB+JwCNOw6bTSapXjq2bUzEfV3Ri23dmXzqp4v2tZn/wqf/z7T/3MH/6M7/9Nv/AACJAA6YFSalKzqzP0zAUF3NYWzacHzmgIrzjpn/nKf/qrT/t8H/xc7/0dv/3uf/ABF/ACiOADycBU6qIF+3NW7ER33RWIzeaJrqeKj2hrb/lcP/o9D/sNz/vun/y/X/AClgADxwAE5/AF+OBm+cIX6qNYy3SJvEWajRabbeeMPqh9D2ld3/o+n/sfX/vv//ADcsAElAAFpRAGpiAHpxHIiAMpePRKWdVbKrZr+4dczFhNnSk+bfofLrrv73vP//AD0AAE4AAF8QAG8oE347Ko1NPZteT6luX7Z9b8OMftCajd2om+m1qfXCtv/PxP/cADkAAEsAAFwAGmsAL3sAQokSVJgpZKY9dLNOg8Bfkc1vn9p+reeNuvObx/+o1P+2ACsAEz8AKlAAPWEAT3EAYIAAb44AfpwRjaoom7g8qcVOttJexN5u0Ot93feM6v+aJhUAOiwATD8AXFEAbGEAfHEAioAAmI4App0XtKotwbhAzsVS29Ji595y8+uB//eP", md = "data:application/octet-stream;base64,AAAAHh4eMzMzRUVFV1dXZ2dndnZ2hYWFk5OToaGhr6+vvLy8ycnJ1tbW4+Pj7+/vJxUAOisATD4AXVAAbWEAfHAAi38AmY4Ap5wXtKotwrdAz8RS29Fi6N5y9OqB//ePRQAAVhAAZigAdjsAhU0Ak14AoW4Ar30RvIwoyZo81qhO47Vf78Ju+89+/9yM/+iaVQAAZQAAdQ8AhCcAkjsAoEwWrl0su20/yHxR1Yth4plx7qeA+rWP/8Kd/8+q/9u4VwAAZwAAdwAYhRculC1BokBSr1FjvWJzynKC14GQ44+e752s/Ku5/7jG/8bT/9LgSgA1WwBHawBZehFpiSh4lzyHpU6Vs16jwG6xzX2+2ozL5prY8qjk/7bx/8P9/9D/LwBnQgB3UwCGZBmUcy+igkKwkVO9n2TKrXPXuoLjx5Hw1J/84Kz/7br/+cf//9T/AACDHQCSMhSgRSutVj67ZlDIdmDVhXDhk3/uoY76r5z/vKr/ybf/1sT/4tH/797/AACIABaXBi2lIUCyNVG/SGLMWXHZaYHmeI/yh53+lav/o7j/scX/vtL/y9//2Ov/ABp3ADCGAEOUAFSiF2SwLXS9QIPKUZHXYp/jcq3wgbr8j8f/ndT/q+H/uO3/xvn/AC9PAEJgAFRwAGR/AHSNHYKcMpGpRZ+3Vq3EZrrRdsfehdTqk+H2oe3/r/n/vP//ADsNAE0lAF05AG1LBXxcIItsNZl7R6eKWLWYaMKmeM+0htvBlejOo/TbsP/nvv/zADwAAE4AAF4AA24CH30eNIwzRppGWKhXaLZnd8N3htCFlNyUoumisPWvvf+9yv/KADMAAEYAFlcALGcAP3cAUYUAYZQNcaImgK86j71MncpcqtZsuON7xe+K0vyY3v+mEiEAKTUAPUgAT1kAX2kAb3gAfocAjZUAm6MbqbEwtr5Dw8tV0Nhl3eR06fGD9v2SOQAASx4AXDMAa0UAe1YAiWcAmHYApoUAs5McwKEyza9E2rxV58lm89Z1/+OE/++T", hd = "data:application/octet-stream;base64,AAAAHh4eMzMzRUVFV1dXZ2dndnZ2hYWFk5OToaGhr6+vvLy8ycnJ1tbW4+Pj7+/vJxUAOisATD4AXVAAbWEAfHAAi38AmY4Ap5wXtKotwrdAz8RS29Fi6N5y9OqB//ePRgAAVw8AZycAdzsAhU0AlF0Aom0Ar3wTvYsqypk916dP47Vf78Jv/M9+/9uN/+ibVgAAZgAAdg0AhCUAkzkAoUsarlwwvGxDyXtU1opk4ph076aD+7SR/8Gf/86t/9u6VgAAZgAFdgAghRU1kyxHoT9Yr1FovGF4yXGH1oCV44+j752x+6q+/7jL/8XY/9LkRwA+WABPaABgeBFwhyl/lTyNo06bsF+pvm+3y37E2IzR5Jrd8Kjq/bb2/8P//9D/KQBuPAB9TgCMXxyabzGofkS1jFXCm2XPqHXctoTow5L10KD/3a7/6bv/9cj//9X/AACGEwCUKhmiPi+wT0K9YFPKcGTXf3PkjYLwnJH8qZ//t63/xLr/0cf/3dT/6uD/AACGAB2VADKjF0WwLVa9QWbLUnbXYoXkcpPwgaH8kK//nrz/q8n/udb/xuP/0+//ACFuADZ9AEiMAFmaD2moJ3i1O4fDTZbQXaPcbbHpfL71i8v/mdj/p+X/tfH/wv3/ADQ+AEZQAFdhAGhwAHd/HIaOMZScRKKqVbC3Zb3EdcrRhNfekuTqoPD3rvz/u///ADwAAE4HAF8hAG42DX5IJYxZOZppS6h5XLaHbMOWe9CkityxmOm+pvXLtP/Ywf/lADoAAEwAAF0AFWwAK3wAPoobUJkxYaZDcLRVf8Fljs51nNuDqueSt/SgxP+u0f+7AC0AEEAAJ1EAO2IATXEAXoEAbY8AfZ0Ti6sqmrg9p8VPtdJgwt9wz+t/3PiN6P+bJhUAOisATD8AXVAAbWEAfHEAi4AAmY4Ap5wXtKotwbhAzsVS29Ji595y9OuB//ePRQAAVxAAZycAdjsAhU0AlF4Aom0Ar30SvIspypk91qdO47Vf78Jv+89+/9yN/+ib", gd = "data:application/octet-stream;base64,AAAAHh4eMzMzRUVFV1dXZ2dndnZ2hYWFk5OToaGhr6+vvLy8ycnJ1tbW4+Pj7+/vDyIAJzYAO0kATVoAXmoAbXkAfYgAi5YAmaQcp7Ixtb9EwsxVz9lm3OV16PGE9P6SNgUASCAAWTUAaUcAeFgAh2gAlngAo4cAsZUbvqMwy7FD2L5U5ctl8dh0/eSD//GRTQAAXgEAbh4AfTMAi0YAmlcAqGcJtXYiwoU3z5RJ3KJa6K9q9b15/8qI/9aW/+OkVwAAaAAAdwUAhiAAlDUWokctsFhAvWhRynhi14dx5JWB8KOP/LCd/76r/8u4/9jFVAAAZQAadAAvgxNCkipUoD5krU90u2CDyHCR1X+f4Y2t7py6+qnH/7fU/8Th/9HtRABFVQBXZgBndRJ2hCmFkj2ToE6hrl+vu2+8yH7J1Y3W4pvj7qnv+rb7/8P//9D/JwBwOgB/TACOXR2cbTKpfEW3i1bEmWbRp3betITqwpP2z6H/26//6Lz/9Mn//9b/AACGFACUKxmiPi+wUEK9YFPKcGTXf3PkjoLwnJH8qp//t6z/xLr/0cf/3tT/6uD/AACHABuWADCjG0OxMFS+Q2XLVHTYZYPldJLxg6D9kq3/oLv/rcj/u9X/yOH/1e7/AB1zADKCAEWRAFafE2atKna6PoXHT5PUYKHhcK/tf7z5jcn/m9b/qeL/t+//xPv/ADBLAENcAFVsAGV7AHSKHYOYMpKmRKC0Vq7BZrvOdcjbhNXnk+Hzoe7/rvr/vP//ADsJAE0jAF03AG1JBn1aIItqNZl5R6eIWLWWacKkeM+yh9y/lejMo/TZsf/lvv/yADwAAE4AAF4AA24CH30fNIwzRppGV6hXaLZnd8N3htCGlNyUoumisPWwvf+9yv/KADQAAEYAFFcAKmgAPncAT4YAYJQQcKIof7A7jb1NnMpeqddut+N9xPCM0fya3v+oDiMAJjcAOkkATFoAXWoAbXkAfIgAi5cAmaQdp7IytL9EwcxWztlm2+V16PKE9P6T", _d = "data:application/octet-stream;base64,AAAAHh4eMzMzRUVFV1dXZ2dndnZ2hYWFk5OToaGhr6+vvLy8ycnJ1tbW4+Pj7+/vDyIAJzYAO0kATVoAXmoAbXkAfYgAi5YAmaQcp7Ixtb9EwsxVz9lm3OV16PGE9P6SNwQASR8AWjQAakYAeVgAiGgAlncApIYAspQbv6IxzLBD2b1V5cpl8td1/uSD//CSTgAAXwAAbxwAfjEAjUQAm1UAqWYOtnUmw4Q60JJM3aBd6a5t9rt8/8iK/9WZ/+KnWAAAaAAAdwEAhh4DlTMfo0Y0sFdGvWdXynZo14V35JSG8KKU/K+i/72w/8q9/9bKUwAOYwAmcwA6ghJMkCldnj1trE98uV+Kxm+Z036n4I207JvB+KnO/7bb/8Pn/9D0PwBQUQBgYQBwcRN/gCqOjj6cnU+qqmC3uHDExX/R0o3e3pzq66n397f//8T//9H/HQB3MgCGRQaUViGiZjWwdki9hVnKk2nXoXjkr4fwvJX8yaP/1rH/4r7/78v/+9j/AACJBAWXHyClNDWyR0fAWFjMaGjZd3jmhobylJX+oqP/sLD/vb7/ysv/19f/5OT/AAqDACORADifDkqtJlu6OmvITHrUXYnhbZftfKX6i7L/mcD/p83/tNn/web/zvL/ACVnADl2AEuFAFyUCmyiI3uvOIq9SpjKW6bWa7TjesHvic77l9v/pef/svP/wP//ADY1AEhHAFlYAGloAHl4HIeGMZaVRKSjVbGwZb++dczLhNjXkuXkoPHwrv38u///ADwAAE4AAF8XAG8tEH5AKIxSPJtiTahyXraBbsOQfdCejN2rmum5qPXGtf/Twv/fADkAAEsAAFwAGGwALnsAQYoVU5grY6Y/c7NQgsFhkM5xntqArOeOufOcxv+q0/+4ACwAEz8AKVAAPWEAT3EAX4AAb44AfpwRjaoom7g8qcVOttJew95u0Ot93feM6f+aJxQAOysATT4AXVAAbWAAfHAAi38AmY4Ap5wXtaotwrdAz8RS29Fi6N5y9OqB//eP", vd = "data:application/octet-stream;base64,AAAAHh4eMzMzRUVFV1dXZ2dndnZ2hYWFk5OToaGhr6+vvLy8ycnJ1tbW4+Pj7+/vDyIAJzYAO0kATVoAXmoAbXkAfYgAi5YAmaQcp7Ixtb9EwsxVz9lm3OV16PGE9P6SOAIASh4AWzMAa0YAelcAiWcAl3cApYUAs5QcwKIxza9E2r1V5spl8td1/+OE/++SUAAAYAAAcBoAfzAAjkMAnFQAqWQSt3QpxIM90ZFP3p9f6q1v9rp+/8iN/9Sb/+GpWAAAaAAAeAAAhhwOlTImo0Q6sFZMvmZdy3Vt14R85JOL8KGZ/K6n/7y0/8nB/9bOUQAaYQAwcQBDgBJUjylknTx0qk6DuF+RxW+f0n6t3oy665vH96jU/7bh/8Pt/9D5OgBYTABoXQB4bRWHfCyViz+jmVCxp2G+tHHLwYDYzo7k25zx6Kr99Lj//8X//9L/EwB9KgCLPgyaTyWnYDm1cEvCf1zPjWzcm3voqYr0t5j/xKb/0bP/3cD/6s3/9tr/AACJAA6YFSalKzqzP0zAUF3NYWzacHzmgIrzjpn/nKf/qrT/t8H/xc7/0dv/3uf/ABN9ACqMAD6aAE+oHmC1M3DDRX/QVo3cZ5zpdqn1hbf/k8T/odH/r93/vOr/yfb/ACxaAD9qAFF5AGGIA3GWH4CkNI6yRp2/V6rMaLjZd8XlhtLxlN7+ouv/sPf/vf//ADkcAEsxAFxEAGxVAXtmHop1M5iERqaSV7ShZ8Guds67hdvJlOfVovPir//uvf/7ADwAAE4AAF8AAG8RG34oMIw8Q5tOVaheZbZudMN9g9CMkt2aoOmorfW1u//DyP/PADUAAEcAEVgAKGgAPHgAToYAXpUUbqMqfbA+jL5QmstgqNdwteR/w/COz/yc3P+pDyIAJzcAOkkATFoAXWoAbXkAfIgAi5YAmaQcp7IytL9EwsxVz9lm2+V16PKE9P6TOAIASh8AWzQAa0YAelcAiWcAl3cApYYAspQcwKIxzbBE2b1V5spl8td1/uOE//CS", yd = /* @__PURE__ */ t({
	REGION_AUTO: () => 2,
	REGION_NTSC: () => 0,
	REGION_PAL: () => 1,
	REGION_PALETTE_NTSC: () => Vd,
	REGION_PALETTE_PAL: () => Hd,
	Reset: () => qd,
	getNtscPalette: () => Jd,
	getPalPalette: () => Yd,
	getPaletteIndex: () => Xd,
	getPaletteIndexDefault: () => Qd,
	setPaletteIndex: () => Zd
}), bd = wu(sd), xd = wu(cd), Sd = wu(ld), Cd = wu(ud), wd = wu(dd), Td = wu(fd), Ed = wu(pd), Dd = wu(md), Od = wu(hd), kd = wu(gd), Ad = wu(_d), jd = wu(vd), Md = 2, Nd = new Rl(0, 16, 319, 258), Pd = new Rl(0, 27, 319, 250), Fd = 60, Id = 263, Ld = new Rl(0, 16, 319, 308), Rd = new Rl(0, 26, 319, 297), zd = 50, Bd = 313, Vd = [
	0,
	0,
	0,
	37,
	37,
	37,
	52,
	52,
	52,
	79,
	79,
	79,
	91,
	91,
	91,
	105,
	105,
	105,
	123,
	123,
	123,
	138,
	138,
	138,
	167,
	167,
	167,
	185,
	185,
	185,
	197,
	197,
	197,
	208,
	208,
	208,
	215,
	215,
	215,
	225,
	225,
	225,
	244,
	244,
	244,
	255,
	255,
	255,
	76,
	50,
	0,
	98,
	58,
	0,
	123,
	74,
	0,
	154,
	96,
	0,
	181,
	116,
	0,
	204,
	133,
	0,
	231,
	158,
	8,
	247,
	175,
	16,
	255,
	195,
	24,
	255,
	208,
	32,
	255,
	216,
	40,
	255,
	223,
	48,
	255,
	230,
	59,
	255,
	244,
	64,
	255,
	250,
	75,
	255,
	255,
	80,
	153,
	37,
	0,
	170,
	37,
	0,
	180,
	37,
	0,
	211,
	48,
	0,
	221,
	72,
	2,
	226,
	80,
	9,
	244,
	103,
	0,
	244,
	117,
	16,
	255,
	158,
	16,
	255,
	172,
	32,
	255,
	186,
	58,
	255,
	191,
	80,
	255,
	198,
	109,
	255,
	213,
	128,
	255,
	228,
	144,
	255,
	230,
	153,
	152,
	12,
	12,
	153,
	12,
	12,
	194,
	19,
	0,
	211,
	19,
	0,
	226,
	53,
	0,
	227,
	64,
	0,
	228,
	64,
	32,
	229,
	82,
	48,
	253,
	120,
	84,
	255,
	138,
	106,
	255,
	152,
	124,
	255,
	164,
	139,
	255,
	179,
	158,
	255,
	194,
	178,
	255,
	208,
	186,
	255,
	215,
	192,
	153,
	0,
	0,
	169,
	0,
	0,
	194,
	4,
	0,
	211,
	4,
	0,
	218,
	4,
	0,
	219,
	8,
	0,
	228,
	32,
	32,
	246,
	64,
	64,
	251,
	112,
	112,
	251,
	126,
	126,
	251,
	143,
	143,
	255,
	159,
	159,
	255,
	171,
	171,
	255,
	185,
	185,
	255,
	201,
	201,
	255,
	207,
	207,
	126,
	0,
	80,
	128,
	0,
	80,
	128,
	0,
	95,
	149,
	11,
	116,
	170,
	34,
	136,
	187,
	47,
	154,
	206,
	63,
	173,
	215,
	90,
	182,
	228,
	103,
	195,
	239,
	114,
	206,
	251,
	126,
	218,
	255,
	141,
	225,
	255,
	157,
	229,
	255,
	165,
	231,
	255,
	175,
	234,
	255,
	184,
	236,
	72,
	0,
	108,
	92,
	4,
	136,
	101,
	13,
	144,
	123,
	35,
	167,
	147,
	59,
	191,
	157,
	69,
	201,
	167,
	79,
	211,
	178,
	90,
	222,
	189,
	101,
	233,
	197,
	109,
	241,
	206,
	118,
	250,
	213,
	131,
	255,
	218,
	144,
	255,
	222,
	156,
	255,
	226,
	169,
	255,
	230,
	182,
	255,
	27,
	0,
	112,
	34,
	27,
	141,
	55,
	48,
	162,
	72,
	65,
	179,
	89,
	82,
	196,
	99,
	92,
	206,
	111,
	104,
	218,
	125,
	118,
	232,
	135,
	128,
	248,
	147,
	140,
	255,
	157,
	151,
	255,
	168,
	163,
	255,
	179,
	175,
	255,
	188,
	184,
	255,
	196,
	193,
	255,
	218,
	209,
	255,
	0,
	13,
	127,
	0,
	18,
	167,
	0,
	24,
	192,
	10,
	43,
	209,
	27,
	74,
	227,
	47,
	88,
	240,
	55,
	104,
	255,
	73,
	121,
	255,
	91,
	133,
	255,
	109,
	150,
	255,
	127,
	163,
	255,
	140,
	173,
	255,
	150,
	180,
	255,
	168,
	192,
	255,
	183,
	203,
	255,
	198,
	214,
	255,
	0,
	41,
	90,
	0,
	56,
	118,
	0,
	72,
	146,
	0,
	92,
	172,
	0,
	113,
	198,
	0,
	134,
	208,
	10,
	155,
	223,
	26,
	168,
	236,
	43,
	182,
	255,
	63,
	194,
	255,
	69,
	203,
	255,
	89,
	211,
	255,
	127,
	218,
	255,
	143,
	222,
	255,
	160,
	226,
	255,
	176,
	235,
	255,
	0,
	56,
	57,
	0,
	60,
	72,
	0,
	61,
	91,
	2,
	102,
	127,
	3,
	115,
	131,
	0,
	156,
	170,
	0,
	161,
	187,
	1,
	164,
	204,
	3,
	187,
	255,
	5,
	218,
	226,
	24,
	229,
	255,
	52,
	234,
	255,
	73,
	239,
	255,
	102,
	242,
	255,
	132,
	244,
	255,
	158,
	249,
	255,
	0,
	74,
	0,
	0,
	93,
	0,
	0,
	112,
	0,
	0,
	139,
	0,
	0,
	169,
	0,
	0,
	187,
	5,
	0,
	189,
	0,
	2,
	208,
	5,
	26,
	213,
	64,
	90,
	241,
	119,
	130,
	239,
	167,
	132,
	237,
	209,
	137,
	255,
	237,
	125,
	255,
	255,
	147,
	255,
	255,
	155,
	255,
	255,
	34,
	74,
	3,
	39,
	83,
	4,
	48,
	100,
	5,
	60,
	119,
	12,
	69,
	140,
	17,
	90,
	165,
	19,
	27,
	210,
	9,
	31,
	221,
	0,
	61,
	205,
	45,
	61,
	205,
	48,
	88,
	204,
	64,
	96,
	211,
	80,
	162,
	236,
	85,
	179,
	242,
	74,
	187,
	246,
	93,
	196,
	248,
	112,
	46,
	63,
	12,
	54,
	74,
	15,
	64,
	86,
	21,
	70,
	95,
	23,
	87,
	119,
	26,
	101,
	133,
	28,
	116,
	147,
	29,
	143,
	165,
	37,
	173,
	183,
	44,
	188,
	199,
	48,
	201,
	213,
	51,
	212,
	224,
	59,
	224,
	236,
	66,
	234,
	246,
	69,
	240,
	253,
	71,
	244,
	255,
	111,
	85,
	36,
	0,
	90,
	44,
	0,
	108,
	59,
	0,
	121,
	75,
	0,
	185,
	117,
	0,
	187,
	133,
	0,
	193,
	161,
	32,
	208,
	176,
	47,
	222,
	190,
	63,
	230,
	198,
	69,
	237,
	205,
	87,
	245,
	219,
	98,
	251,
	229,
	105,
	252,
	238,
	111,
	253,
	243,
	119,
	253,
	243,
	127,
	92,
	39,
	0,
	92,
	47,
	0,
	113,
	59,
	0,
	123,
	72,
	0,
	185,
	104,
	32,
	187,
	114,
	32,
	197,
	134,
	41,
	215,
	150,
	51,
	230,
	164,
	64,
	244,
	177,
	75,
	253,
	193,
	88,
	255,
	204,
	85,
	255,
	212,
	97,
	255,
	221,
	105,
	255,
	230,
	121,
	255,
	234,
	152
], Hd = [
	0,
	0,
	0,
	28,
	28,
	28,
	57,
	57,
	57,
	89,
	89,
	89,
	121,
	121,
	121,
	146,
	146,
	146,
	171,
	171,
	171,
	188,
	188,
	188,
	205,
	205,
	205,
	217,
	217,
	217,
	230,
	230,
	230,
	236,
	236,
	236,
	242,
	242,
	242,
	248,
	248,
	248,
	255,
	255,
	255,
	255,
	255,
	255,
	38,
	48,
	1,
	36,
	56,
	3,
	35,
	64,
	5,
	81,
	84,
	27,
	128,
	105,
	49,
	151,
	129,
	53,
	175,
	153,
	58,
	194,
	167,
	62,
	213,
	181,
	67,
	219,
	192,
	61,
	225,
	203,
	56,
	226,
	216,
	54,
	227,
	229,
	52,
	239,
	242,
	88,
	251,
	255,
	125,
	251,
	255,
	125,
	57,
	23,
	1,
	94,
	35,
	4,
	131,
	48,
	8,
	165,
	71,
	22,
	200,
	95,
	36,
	227,
	120,
	32,
	255,
	145,
	29,
	255,
	171,
	29,
	255,
	197,
	29,
	255,
	206,
	52,
	255,
	216,
	76,
	255,
	230,
	81,
	255,
	244,
	86,
	255,
	249,
	119,
	255,
	255,
	152,
	255,
	255,
	152,
	69,
	25,
	4,
	114,
	30,
	17,
	159,
	36,
	30,
	179,
	58,
	32,
	200,
	81,
	34,
	227,
	105,
	32,
	255,
	129,
	30,
	255,
	140,
	37,
	255,
	152,
	44,
	255,
	174,
	56,
	255,
	197,
	69,
	255,
	197,
	89,
	255,
	198,
	109,
	255,
	213,
	135,
	255,
	228,
	161,
	255,
	228,
	161,
	74,
	23,
	4,
	126,
	26,
	13,
	178,
	29,
	23,
	200,
	33,
	25,
	223,
	37,
	28,
	236,
	59,
	56,
	250,
	82,
	85,
	252,
	97,
	97,
	255,
	112,
	110,
	255,
	127,
	126,
	255,
	143,
	143,
	255,
	157,
	158,
	255,
	171,
	173,
	255,
	185,
	189,
	255,
	199,
	206,
	255,
	199,
	206,
	5,
	5,
	104,
	59,
	19,
	109,
	113,
	34,
	114,
	139,
	42,
	140,
	165,
	50,
	166,
	185,
	56,
	186,
	205,
	62,
	207,
	219,
	71,
	221,
	234,
	81,
	235,
	244,
	95,
	245,
	254,
	109,
	255,
	254,
	122,
	253,
	255,
	135,
	251,
	255,
	149,
	253,
	255,
	164,
	255,
	255,
	164,
	255,
	40,
	4,
	121,
	64,
	9,
	132,
	89,
	15,
	144,
	112,
	36,
	157,
	136,
	57,
	170,
	164,
	65,
	195,
	192,
	74,
	220,
	208,
	84,
	237,
	224,
	94,
	255,
	233,
	109,
	255,
	242,
	124,
	255,
	248,
	138,
	255,
	255,
	152,
	255,
	254,
	161,
	255,
	254,
	171,
	255,
	254,
	171,
	255,
	53,
	8,
	138,
	66,
	10,
	173,
	80,
	12,
	208,
	100,
	40,
	208,
	121,
	69,
	208,
	141,
	75,
	212,
	162,
	81,
	217,
	176,
	88,
	236,
	190,
	96,
	255,
	197,
	107,
	255,
	204,
	119,
	255,
	209,
	131,
	255,
	215,
	144,
	255,
	219,
	157,
	255,
	223,
	170,
	255,
	223,
	170,
	255,
	5,
	30,
	129,
	6,
	38,
	165,
	8,
	47,
	202,
	38,
	61,
	212,
	68,
	76,
	222,
	79,
	90,
	238,
	90,
	104,
	255,
	101,
	117,
	255,
	113,
	131,
	255,
	128,
	145,
	255,
	144,
	160,
	255,
	151,
	169,
	255,
	159,
	178,
	255,
	175,
	190,
	255,
	192,
	203,
	255,
	192,
	203,
	255,
	5,
	30,
	129,
	6,
	38,
	165,
	8,
	47,
	202,
	38,
	61,
	212,
	68,
	76,
	222,
	79,
	90,
	238,
	90,
	104,
	255,
	101,
	117,
	255,
	113,
	131,
	255,
	128,
	145,
	255,
	144,
	160,
	255,
	151,
	169,
	255,
	159,
	178,
	255,
	175,
	190,
	255,
	192,
	203,
	255,
	192,
	203,
	255,
	12,
	4,
	139,
	34,
	24,
	160,
	56,
	45,
	181,
	72,
	62,
	199,
	88,
	79,
	218,
	97,
	89,
	236,
	107,
	100,
	255,
	122,
	116,
	255,
	138,
	132,
	255,
	145,
	142,
	255,
	153,
	152,
	255,
	165,
	163,
	255,
	177,
	174,
	255,
	184,
	184,
	255,
	192,
	194,
	255,
	192,
	194,
	255,
	29,
	41,
	90,
	29,
	56,
	118,
	29,
	72,
	146,
	28,
	92,
	172,
	28,
	113,
	198,
	50,
	134,
	207,
	72,
	155,
	217,
	78,
	168,
	236,
	85,
	182,
	255,
	112,
	199,
	255,
	140,
	216,
	255,
	147,
	219,
	255,
	155,
	223,
	255,
	175,
	228,
	255,
	195,
	233,
	255,
	195,
	233,
	255,
	47,
	67,
	2,
	57,
	82,
	2,
	68,
	97,
	3,
	65,
	122,
	18,
	62,
	148,
	33,
	74,
	159,
	46,
	87,
	171,
	59,
	92,
	189,
	85,
	97,
	208,
	112,
	105,
	226,
	122,
	114,
	245,
	132,
	124,
	250,
	141,
	135,
	255,
	151,
	154,
	255,
	166,
	173,
	255,
	182,
	173,
	255,
	182,
	10,
	65,
	8,
	13,
	84,
	10,
	16,
	104,
	13,
	19,
	125,
	15,
	22,
	146,
	18,
	25,
	165,
	20,
	28,
	185,
	23,
	30,
	201,
	25,
	33,
	217,
	27,
	71,
	228,
	45,
	110,
	240,
	64,
	120,
	247,
	77,
	131,
	255,
	91,
	154,
	255,
	122,
	178,
	255,
	154,
	178,
	255,
	154,
	4,
	65,
	11,
	5,
	83,
	14,
	6,
	102,
	17,
	7,
	119,
	20,
	8,
	136,
	23,
	9,
	155,
	26,
	11,
	175,
	29,
	72,
	196,
	31,
	134,
	217,
	34,
	143,
	233,
	36,
	153,
	249,
	39,
	168,
	252,
	65,
	183,
	255,
	91,
	201,
	255,
	110,
	220,
	255,
	129,
	220,
	255,
	129,
	2,
	53,
	15,
	7,
	63,
	21,
	12,
	74,
	28,
	45,
	95,
	30,
	79,
	116,
	32,
	89,
	131,
	36,
	100,
	146,
	40,
	130,
	161,
	46,
	161,
	176,
	52,
	169,
	193,
	58,
	178,
	210,
	65,
	196,
	217,
	69,
	214,
	225,
	73,
	228,
	240,
	78,
	242,
	255,
	83,
	242,
	255,
	83
], Ud = {
	0: Vd,
	1: bd,
	2: xd,
	3: Sd,
	4: Ed,
	5: Dd,
	6: Od
}, Wd = {
	0: Hd,
	1: Cd,
	2: wd,
	3: Td,
	4: kd,
	5: Ad,
	6: jd
}, Gd = 3, Kd = Gd;
function qd() {
	Md == 1 || Md == 2 && qo() == 1 ? (U.Copy(Ld), ql.Copy(Rd), Tu() && Cu(Wd[Kd]), Kf(zd), Yf(Bd), ad(zd * Bd * 2)) : (U.Copy(Nd), ql.Copy(Pd), Tu() && Cu(Ud[Kd]), Kf(Fd), Yf(Id), ad(Fd * Id * 2));
}
function Jd() {
	return Ud[Kd];
}
function Yd() {
	return Wd[Kd];
}
function Xd() {
	return Kd;
}
function Zd(e) {
	Kd = e;
}
function Qd() {
	return Gd;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/ExpansionModule.js
var $d = 131072;
Array($d);
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/ProSystem.js
var ef = /* @__PURE__ */ t({
	CYCLES_PER_SCANLINE: () => 454,
	Close: () => Hf,
	ExecuteFrame: () => Bf,
	GetCycles: () => Xf,
	GetDebug6502Cycles: () => tp,
	GetDebugCycleStealing: () => rp,
	GetDebugMariaCycles: () => ep,
	GetDebugSavedCycles: () => Qf,
	GetDebugWsync: () => np,
	GetDebugWsyncCount: () => $f,
	GetExtraCycles: () => Zf,
	GetFrame: () => qf,
	GetFrequency: () => Gf,
	GetMariaScanline: () => ip,
	GetScanlines: () => Jf,
	HBLANK_CYCLES: () => 136,
	IsActive: () => Uf,
	IsPaused: () => Wf,
	Pause: () => Vf,
	ProSystemLoad: () => lp,
	ProSystemSave: () => cp,
	Reset: () => jf,
	SetFrequency: () => Kf,
	SetMstatAdjust: () => ap,
	SetScanlines: () => Yf
}), tf = pi, nf = bt, rf = kt, af = xt, of = br, sf = Tr, cf = wr, lf = U, uf = gu, df = yu, ff = 428, pf = g, mf = Cl, hf = Tl, gf = os, _f = 12, vf = 36, yf = 40, bf = 60, xf = !1, Sf = !1, Cf = 60, wf = 0, Tf = 262, $ = 0, Ef = 0, Df = 1, Of = !1, kf = !1, Af = 28;
jt(454);
function jf(e) {
	Uo() && (Df = 1, Sf = !1, wf = 0, xl(), qd(), di(), yt(), ln(), pa(), _u(), hu(), yr(), hi() || Io(), e && Go(function(t) {
		Kn("onHighScoreCartLoaded", t), $ = wl() << 2, xf = !0, e();
	}));
}
function Mf() {
	var e = n(), t = r();
	Df >= e && Df <= e + 3 && $ >= (t | 0) - 1 ? pf[_f] &= 127 : pf[_f] |= 128;
}
var Nf = 0, Pf = 0, Ff = 0, If = 0, Lf = 0, Rf = !1, zf = !1;
function Bf(e) {
	var t = 0, n = 0, r = 0, i = gf() && (pf[bf] & 96) != 64;
	for (of(e), t = (Tf - 1) / 4 | 0, Nf = 0, Pf = 0, Ff = 0, If = 0, Lf = 0, (Of || kf) && nf(), Df = 1; Df <= Tf; Df++) {
		Df == lf.top ? pf[yf] = 0 : Df == lf.bottom - Ef && (pf[yf] = 128);
		var a = !1, o = 0;
		for (($ %= 454) | 0, i && Mf(); $ < Af;) if (o = mf() << 2, $ += o, i && Mf(), Ll() && ($ += 2, i && Mf()), sf() && cf(o >>> 2), pf[vf]) {
			Ff++, pf[vf] = 0, a = !0;
			break;
		}
		for (xn(!0), o = uf(Df) + 3 >>> 2 << 2, o > ff && (a = !0), xn(!1), $ += o, If += o, sf() && cf(o >>> 2), df() && (!a && $ < 454 && (o = mf() << 2, sf() && cf(o >>> 2), $ += o, pf[vf] && (Ff++, pf[vf] = 0, a = !0)), hf()); !a && $ < 454;) if (o = mf() << 2, $ += o, i && Mf(), Ll() && ($ += 2, i && Mf()), sf() && cf(o >>> 2), pf[vf]) {
			Ff++, pf[vf] = 0, a = !0;
			break;
		}
		a && $ < 454 && (sf() && cf(454 - $ >>> 2), $ = 454), Lf += $, i && Mf(), tf(2), (Of || kf) && rf(2), as() && (n++, n == t && (n = 0, window.Module._bupchip_Process(r), r++)), (Of || kf) && af();
	}
	wf++, wf >= Cf && (wf = 0);
}
function Vf(e) {
	xf && (Sf = e);
}
function Hf() {
	xf = !1, Sf = !1, Wo(), hu(), _u(), pa(), ui(), di(!0), yt(), At(!0);
}
function Uf() {
	return xf;
}
function Wf() {
	return Sf;
}
function Gf() {
	return Cf;
}
function Kf(e) {
	Cf = e, Ju(e);
}
function qf() {
	return wf;
}
function Jf() {
	return Tf;
}
function Yf(e) {
	Tf = e, Yu(e);
}
function Xf() {
	return $;
}
function Zf() {
	return Nf;
}
function Qf() {
	return Pf;
}
function $f() {
	return Ff;
}
function ep() {
	return If;
}
function tp() {
	return Lf;
}
function np() {
	return Rf;
}
function rp() {
	return zf;
}
function ip() {
	return Df;
}
function ap(e) {
	Ef = e;
}
function op() {
	Of = Yo(), kf = es();
}
Gn(new f("onCartridgeLoaded", op));
var sp = "PRO-SYSTEM STATE";
function cp() {
	let e = Array(40960 + $d + 4);
	console.log("Saving game state.");
	let t = 0, n = 0;
	for (; n < 16; n++) e[t + n] = sp.charCodeAt(n);
	for (t += 16, e[t++] = 1, n = 0; n < 4; n++) e[t + n] = 0;
	for (t += 4, n = 0; n < 32; n++) e[t + n] = ds().charCodeAt(n);
	for (t += 32, e[t++] = El(), e[t++] = Ol(), e[t++] = Al(), e[t++] = Ml(), e[t++] = Pl(), e[t++] = Il().getBL(), e[t++] = Il().getBH(), e[t++] = Gs(), n = 0; n < 16384; n++) e[t + n] = g[n];
	if (t += 16384, hs() == 3) {
		for (n = 0; n < 16384; n++) e[t + n] = g[16384 + n];
		t += 16384;
	}
	if (ns()) {
		for (n = 0; n < 16384; n++) e[t + n] = ta[16384 + n];
		t += 16384;
	}
	if (e[t++] = Dr(), e[t++] = Or(), e[t++] = +!!kr(), e[t++] = 255 & jr() >>> 8, e[t++] = 255 & jr(), e[t++] = Nr(), e[t++] = 255 & Fr() >>> 8, e[t++] = 255 & Fr(), $o()) {
		for (e[t++] = +!!_n(), e[t++] = +!!hn(), e[t++] = +!!yn(), e[t++] = +!!Sn(), e[t++] = +!!wn(), e[t++] = +!!En(), e[t++] = +!!On(), e[t++] = +!!An(), e[t++] = jn(), e[t++] = Nn(), e[t++] = Fn(), e[t++] = Ln(), e[t++] = zn(), e[t++] = Vn(), n = 0; n < Kt; n++) e[t + n] = qt[n];
		t += Kt;
	}
	let r = Ct;
	for (let n = 0; n < r.length; n++) e[t++] = r[n];
	r = zt();
	for (let n = 0; n < r.length; n++) e[t++] = r[n];
	if (hs() == 8) {
		for (e[t++] = xo[0], e[t++] = xo[1], e[t++] = Vo(), e[t++] = Co[0], e[t++] = Co[1], n = 0; n < na.length; n++) e[t++] = na[n];
		e[t++] = window.Module._bupchip_GetFlags(), e[t++] = window.Module._bupchip_GetVolumeValue(), e[t++] = window.Module._bupchip_GetCurrentSong();
	}
	return e.length = t, e;
}
function lp(e) {
	let t = e.length;
	console.log("Loading game state.");
	let n = 0;
	if (ns() && (n = 16384), t != 16741 + n && t != 33125 + n && t != 147827 + n && t != 164211 + n && t != 49517) return console.log("Save buffer has an invalid size."), !1;
	var r = 0;
	for (let t = 0; t < 16; t++) if (String.fromCharCode(e[r + t]) != sp[t]) return console.log("Buffer is not a valid ProSystem save state."), !1;
	r += 16, e[r++];
	for (let e = 0; e < 4; e++);
	r += 4, jf(null);
	let i = "";
	for (let t = 0; t < 32; t++) i += String.fromCharCode(e[r + t]);
	if (r += 32, ds() != i) return console.log("Load state digest [" + i + "] does not match loaded cartridge digest [" + cartridge_digest + "]."), !1;
	Dl(e[r++]), kl(e[r++]), jl(e[r++]), Nl(e[r++]), Fl(e[r++]), Il().setBL(e[r++]), Il().setBH(e[r++]), Ro(e[r++]);
	for (let t = 0; t < 16384; t++) g[t] = e[r + t];
	if (r += 16384, hs() == 3) {
		for (let t = 0; t < 16384; t++) g[16384 + t] = e[r + t];
		r += 16384;
	}
	if (ns()) {
		for (let t = 0; t < 16384; t++) ta[16384 + t] = e[r + t];
		r += 16384;
	}
	xr(e[r++]), Sr(e[r++]), Ar(e[r++] === 1);
	let a = e[r++], o = e[r++];
	if (Mr(a << 8 & 255 | o & 255), Pr(e[r++]), a = e[r++], o = e[r++], Ir(a << 8 & 255 | o & 255), $o()) {
		vn(e[r++] === 1), gn(e[r++] === 1), bn(e[r++] === 1), Cn(e[r++] === 1), Tn(e[r++] === 1), Dn(e[r++] === 1), kn(e[r++] === 1), xn(e[r++] === 1), Mn(e[r++]), Pn(e[r++]), In(e[r++]), Rn(e[r++]), Bn(e[r++]), Hn(e[r++]);
		for (let t = 0; t < Kt; t++) qt[t] = e[r++];
	}
	for (let t = 0; t < 32; t++) {
		let n = e[r++];
		wt(16384 + t, n);
	}
	for (let t = 0; t < 256; t++) {
		let n = e[r++];
		Bt(t, n);
	}
	if (hs() == 8) {
		xo[0] = e[r++], xo[1] = e[r++], Bo(e[r++]), Co[0] = e[r++], Co[1] = e[r++];
		for (let t = 0; t < na.length; t++) na[t] = e[r++];
		window.Module._bupchip_SetFlags(e[r++]), window.Module._bupchip_SetVolumeValue(e[r++]), window.Module._bupchip_SetCurrentSong(e[r++]), window.Module._bupchip_StateLoaded();
	}
	return console.log(e.length + ", " + r), !0;
}
//#endregion
//#region ../../../../../private/tmp/claude-501/-Users-annabelle-GitHub-CartridgeStudio/1ce4bccd-97eb-4bfe-a341-52783f170637/scratchpad/js7800src/js7800/src/js/prosystem/ProSystemDat.js
var up = {
	"4332c24e4f3bc72e7fe1b77adf66c2b7": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"0be996d25144966d5541c9eb4919b289": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	aadde920b3aaba03bc10b40bd0619c94: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"877dcc97a775ed55081864b2dbf5f1e2": {
		ty: "2",
		p: "f",
		c1: "2",
		c2: "2",
		r: "0",
		f: "0",
		crossx: "8",
		crossy: "8"
	},
	de3e9496cb7341f865f27e5a72c7f2f5: {
		ty: "2",
		p: "f",
		c1: "2",
		c2: "2",
		r: "1",
		f: "0",
		crossx: "10",
		crossy: "-6"
	},
	"404f95103b70975a42cb09946dc3adca": {
		ty: "3",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"5c66261d7be74184a047f77233919e06": {
		ty: "1",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hblank: "8"
	},
	"212ee2a6e66d8bb7fbf26f343cc8dc19": {
		ty: "1",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		hblank: "8"
	},
	"07342c78619ba6ffcc61c10e907e3b50": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"8fc3a695eaea3984912d98ed4a543376": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hblank: "28"
	},
	b558814d54904ce0582e2f6a801d03af: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		hblank: "28"
	},
	"42682415906c21c6af80e4198403ffda": {
		ty: "1",
		p: "f",
		c1: "2",
		c2: "1",
		r: "0",
		f: "0",
		crossx: "0",
		crossy: "8"
	},
	babe2bc2976688bafb8b23c192658126: {
		ty: "1",
		p: "f",
		c1: "2",
		c2: "1",
		r: "1",
		f: "0",
		crossx: "0",
		crossy: "12"
	},
	f5f6b69c5eb4b55fc163158d1a6b423e: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	fba002089fcfa176454ab507e0eb76cb: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"3e63be18e480fa63fce5e4c823286e53": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"5a09946e57dbe30408a8f253a28d07db": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"38c056a48472d9a9e16ebda5ed91dae7": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"93e4387864b014c155d7c17877990d1e": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"59d4edb0230b5acc918b94f6bc94779f": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"2e8e28f6ad8b9b9267d518d880c73ebb": {
		ty: "1",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"55da6c6c3974d013f517e725aa60f48e": {
		ty: "1",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	db691469128d9a4217ec7e315930b646: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"7cbe78fa06f47ba6516a67a4b003c9ee": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	a94e4560b6ad053a1c24e096f1262ebf: {
		ty: "2",
		p: "f",
		c1: "2",
		c2: "2",
		r: "0",
		f: "0",
		crossx: "13",
		crossy: "8"
	},
	"63db371d67a98daec547b2abd5e7aa95": {
		ty: "2",
		p: "f",
		c1: "2",
		c2: "2",
		r: "1",
		f: "0",
		crossx: "15",
		crossy: "7"
	},
	"179b76ff729d4849b8f66a502398acae": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	a2b8e2f159642c4b91de82e9a2928494: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"95ac811c7d27af0032ba090f28c107bd": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"2d5d99b993a885b063f9f22ce5e6523d": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"731879ea82fc0ca245e39e036fe293e6": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"408dca9fc40e2b5d805f403fa0509436": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"5e332fbfc1e0fc74223d2e73271ce650": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"4dc5f88243250461bd61053b13777060": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"19f1ee292a23636bd57d408b62de79c7": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"8e96ef14ce9b5d84bcbc996b66d6d4c7": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"543484c00ba233736bcaba2da20eeea9": {
		ty: "6",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	de2ebafcf0e37aaa9d0e9525a7f4dd62: {
		ty: "6",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"2251a6a0f3aec84cc0aff66fc9fa91e8": {
		ty: "5",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	e7709da8e49d3767301947a0a0b9d2e6: {
		ty: "5",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	d25d5d19188e9f149977c49eb0367cd1: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"23505651ac2e47f3637152066c3aa62f": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"07dbbfe612a0a28e283c01545e59f25e": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	e80f24e953563e6b61556737d67d3836: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	cf76b00244105b8e03cdc37677ec1073: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	de0d4f5a9bf1c1bddee3ed2f7ec51209: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	fb8d803b328b2e442548f7799cfa9a4a: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	f5dc7dc8e38072d3d65bd90a660148ce: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"06204dadc975be5e5e37e7cc66f984cf": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	fd9e78e201b6baafddfd3e1fbfe6ba31: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"0baec96787ce17f390e204de1a136e59": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	c3672482ca93f70eafd9134b936c3feb: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"8c2c2a1ea6e9a928a44c3151ba5c1ce3": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	baebc9246c087e893dfa489632157180: {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"80dead01ea2db5045f6f4443faa6fce8": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"045fd12050b7f2b842d5970f2414e912": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	dfb86f4d06f05ad00cf418f0a59a24f7: {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	f18b3b897a25ab3885b43b4bd141b396: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	f2dae0264a4b4a73762b9d7177e989f6: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	c3a5a8692a423d43d9d28dd5b7d109d9: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"5e0a1e832bbcea6facb832fde23a440a": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"17b3b764d33eae9b5260f01df7bb9d2f": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	f57d0af323d4e173fb49ed447f0563d7: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"2931b75811ad03f3ac9330838f3d231b": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"431ca060201ee1f9eb49d44962874049": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	d2e861306be78e44248bb71d7475d8a3: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"37b5692e33a98115e574185fa8398c22": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"6819c37b96063b024898a19dbae2df54": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	f2f5e5841e4dda89a2faf8933dc33ea6: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"2e9dbad6c0fa381a6cd1bb9abf98a104": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	bedc30ec43587e0c98fc38c39c1ef9d0: {
		ty: "4",
		p: "f",
		c1: "2",
		c2: "2",
		r: "0",
		f: "0",
		crossx: "-2",
		crossy: "12"
	},
	c80155d7eec9e3dcb79aa6b83c9ccd1e: {
		ty: "4",
		p: "f",
		c1: "2",
		c2: "2",
		r: "1",
		f: "0",
		crossx: "0",
		crossy: "10"
	},
	bc1e905db1008493a9632aa83ab4682b: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"6794ea31570eba0b88a0bf1ead3f3f1b": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"017066f522908081ec3ee624f5e4a8aa": {
		ty: "2",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "3"
	},
	"3bc8f554cf86f8132a623cc2201a564b": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"5330bfe428a6b601b7e76c2cfc4cd049": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	fc0ea52a9fac557251b65ee680d951e5: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"56469e8c5ff8983c6cb8dadc64eb0363": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"220121f771fc4b98cef97dc040e8d378": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	ea0c859aa54fe5eaf4c1f327fab06221: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"74569571a208f8b0b1ccfb22d7c914e1": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"8dba0425f0262e5704581d8757a1a6e3": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"1a5207870dec6fae9111cb747e20d8e3": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"386bded4a944bae455fedf56206dd1dd": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	ec206c8db4316eb1ebce9fc960da7d8f: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"05f43244465943ce819780a71a5b572a": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"33aea1e2b6634a1dec8c7006d9afda22": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"2837a8fd49b7fc7ccd70fd45b69c5099": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"86546808dc60961cdb1b20e761c50ab1": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"584582bb09ee8122e7fc09dc7d1ed813": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"865457e0e0f48253b08f77b9e18f93b2": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"1745feadabb24e7cefc375904c73fa4c": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	ac03806cef2558fc795a7d5d8dba7bc0: {
		ty: "6",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"442761655bb25ddfe5f7ab16bf591c6f": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	bfad016d6e77eaccec74c0340aded8b9: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"383ed9bd1efb9b6cb3388a777678c928": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"8f7eb10ad0bd75474abf0c6c36c08486": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"66ecaafe1b82ae68ffc96267aaf7a4d7": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		dualanalog: "t",
		hs: "t"
	},
	"980c35ae9625773a450aa7ef51751c04": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"53db322c201323fe2ca8f074c0a2bf86": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	b697d9c2d1b9f6cb21041286d1bbfa7f: {
		ty: "4",
		p: "f",
		c1: "2",
		c2: "2",
		r: "0",
		f: "0",
		crossx: "5",
		crossy: "-5"
	},
	"5469b4de0608f23a5c4f98f331c9e75f": {
		ty: "4",
		p: "f",
		c1: "2",
		c2: "2",
		r: "1",
		f: "0",
		crossx: "15",
		crossy: "20"
	},
	"2d643ac548c40e58c99d0fe433ba4ba0": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	cbb0746192540a13b4c7775c7ce2021f: {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	cc18e3b37a507c4217eb6cb1de8c8538: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"162f9c953f0657689cc74ab20b40280f": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"59b5793bece1c80f77b55d60fb39cb94": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"95d7c321dce8f57623a9c5b4947bb375": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		rightswitch: "1"
	},
	"44f862bca77d68b56b32534eda5c198d": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"5c4f752371a523f15e9980fea73b874d": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"1af475ff6429a160752b592f0f92b287": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"3bb9c8d9adc912dd7f8471c97445cd8d": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	c3903ab01a51222a52197dbfe6538ecf: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"682338364243b023ecc9d24f0abfc9a7": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"208ef955fa90a29815eb097bce89bace": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	d12e665347f354048b9d13092f7868c9: {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"8d64763db3100aadc552db5e6868506a": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"32a37244a9c6cc928dcdf02b45365aa8": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	acf63758ecf3f3dd03e9d654ae6b69b7: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"427cb05d0a1abb068998e2760d77f4fb": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"3799d72f78dda2ee87b0ef8bf7b91186": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"05fb699db9eef564e2fe45c568746dbc": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"70937c3184f0be33d06f7f4382ca54de": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	d7dc17379aa25e5ae3c14b9e780c6f6d: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	b1a9f196ce5f47ca8caf8fa7bc4ca46c: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	e1f0a708fbc107001fc49ce48151fefa: {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		leftswitch: "0",
		rightswitch: "1"
	},
	"34483432b92f565f4ced82a141119164": {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		xm: "f",
		leftswitch: "0",
		rightswitch: "1"
	},
	ad35a98040a2facb10ecb120bf83bcc3: {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		leftswitch: "0",
		rightswitch: "1"
	},
	"707e98991390a4e8874508e5ed4edeef": {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		xm: "f",
		leftswitch: "0",
		rightswitch: "1"
	},
	ec81468e31fde04b67b5b99b7da8edb1: {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		xm: "f",
		leftswitch: "0",
		rightswitch: "1"
	},
	"87484e54ab8e45aac978dcc3efd924e5": {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "t",
		xm: "f",
		leftswitch: "0",
		rightswitch: "1"
	},
	"1926b9b322ac0f8f36e119b524aa48bd": {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "t",
		xm: "f",
		leftswitch: "0",
		rightswitch: "1"
	},
	"3e4b11a99271fd807b5c6db411dc6643": {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "f",
		xm: "f",
		leftswitch: "0",
		rightswitch: "1"
	},
	"8385daccee02ccda081eed45eba1479d": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"9ea73fd07e43f61209876d33e6f6dc04": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"90fa275f9f2a65b341796e11b2f551af": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"299d31c8e181fdd011df2014451bdf0f": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		leftswitch: "0",
		rightswitch: "1",
		hs: "t"
	},
	"3209039148e0b7a2b1927bd05bae4685": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		leftswitch: "0",
		rightswitch: "1"
	},
	"32e937e7796db3a01e9bcf5fe93929b0": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		leftswitch: "0",
		rightswitch: "1"
	},
	a60e4b608505d1fb201703b266f754a7: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		dualanalog: "t",
		hs: "t"
	},
	dbb493bdc4e98436dbbfd4f2e4413397: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"54829fb744d4cd7a794ccd2580df7c3d": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	f2047b149e72be8f97e9671314748ec4: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"42fa4bd854a2813b19099da524461a64": {
		ty: "7",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	f5150c0fc1948832211e57852abb0c6e: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		xm: "t",
		hs: "t"
	},
	a8458c510fdd71a1f9cc4c0b243b177a: {
		ty: "7",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"67ee0011090a6ada38f3eef8a3020fb4": {
		ty: "1",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"13f11c4e8c019ee326b571d059accea4": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t"
	},
	"608fa599f06f935e05d445ff236f6d7a": {
		ty: "2",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		sb: "t"
	},
	a65f79ad4a0bbdecd59d5f7eb3623fd7: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"3d38281ed8a8d8c7cd457a18c92c8604": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"55ffe535897c368be7a80d582f6a68cb": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	a51e5df28a0fe8c52e9d28fb5f8e44a6: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	b4be9c25ea078608310f0ddc409e7cc1: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"78b1061d651ef806becac1dd3fda29a0": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"6010a398070dfacb4c0173d75d73c50a": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"9fa7743a016c9b7015ee1d386326f88e": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	af1c8f89f0aef0d9e2e15901d6e0539a: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"2d2fe4da9f1bae102fa8ca2d8830a626": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"100551363027dc5f093d049a5fd00933": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"40bd21c9698c6b8e71b703f860c11359": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	cf3c5a32205506af3c09e6e0c82cfa09: {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		hs: "t"
	},
	c956d5ce7417cc2dab61a9afd8f372d0: {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		hs: "t"
	},
	df700753d8ba9353a7045868778eef6d: {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "t"
	},
	"098b209aac126f2c2edbc982df09cd1b": {
		ty: "6",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"4565867aa6e5cc710a7edaf6d434b3af": {
		ty: "6",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	fab1290f9a4c4f2b4d831c8a57f969f5: {
		ty: "1",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	a9f29004412621f20ad9f5c51cc11486: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	fa4aec407b90e9360b9cfeb41839b09a: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"6287727ab36391a62f728bbdee88675c": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"84c4b4ed75f41417ac7cbceac71e3856": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"2fb85cab6e0f0582e3057bf1ac33c74a": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	e7d89669a7f92ec2cc99d9663a28671c: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		xm: "f",
		hs: "t"
	},
	"6053233cb59c0b4ca633623fd76c4576": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	ee09789d61a693e387ccdc9a2f025b43: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"3d12489c553cb1a90c8ebd6534383fa1": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"1e21bf1d9d7b3c0cebaac576964c9eb2": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"46dbc5108151e963b120cdaedd7d6d4c": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"25ce1f5dfc909bcb46086e414d6a0f30": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"61809684eefd6cbb2963574ffb0a3fab": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		dualanalog: "t"
	},
	bf070f04c8fc7ec721b9506b63b48470: {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"4a811d87d1730a334a21e7bda9fe535a": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"05c21a88fd736d59d28b1d95e79840b6": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	dde5703c488c4ad5268c2696704f1c68: {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	f4216cb77cd6db15225968f315c9793f: {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	e54edc299e72d22d0ba05d16f3393e8c: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	bde3abe40d302d8c4c65c9690c05dbc4: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	e274e7285bb8f97d4d9acddc8497ed9e: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"5fb805f2b69820a9b196f5fed2a23c99": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"114e215b8cfc8698bc0286a79e1cb9b2": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "0",
		r: "0",
		f: "0"
	},
	eb3c1443f4a25806de4657e106d504e8: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	c3f6201d6a9388e860328c963a3301cc: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	dc0bf52475030c05671dd187e9a99f08: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"4a702b995fca8591e2d14268cb123447": {
		ty: "3",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		hs: "f"
	},
	"9ff38ea62004201d870caa8bd9463525": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"3a15fe7bead3d9b90f3fb13d63e1ee42": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"675c5b79238eaa641f2e3fe9c5e22589": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"89f90b661d1b79e956b10bb6a9771f78": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	d8dbb5c4d7d02e6b0627df8f657a13b4: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"27c133965dfd80b3acb1ed598817aea0": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	cf007563fe94cacf5ea5295dc93ce9ef: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	cad1e733986bce1ee4c9da73de1dcff1: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	db768297985178cec034c12a41d6f1a7: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"889fc7e7ba5c807be44e85ba7a6bd26e": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	bc56f803d65658f92c17e6c2b271a507: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"2a17dc5a61be342dd00af719cc335852": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"99055c3e627bbc17fc81cbe0b3ae176c": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	a69347c8a681b8e94f79d8d848998007: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"79202cb7d2bc150ffca0c96a4d8b42cf": {
		ty: "1",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"04edf4f3c6b186147c1117359c8f5076": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1",
		hs: "t"
	},
	"8338eca612eedf6ddec57d54942863e7": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"575c18f77a4215332bf56d0080a234b8": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"72ec68627bb7d879ae35a71d7679f71e": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1",
		hs: "t"
	},
	"60982f430b762343d53e48f70acfa6d0": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"180121ecb4aabc7daa945b355e15c254": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"4fb119f6db26380abba03e4ce3ca04c8": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"0b7635d0f39ff97d1e841888e1b23b7b": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"368c3bfa91cf2bb8413967eb0c392c6c": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"5013b69cb05b21a1194ce48517df7bfc": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"6f80cac59023a69afa26182eabbdfbad": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	b1685dcbaf1b578cb1b6643666d813e4: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"4748a62d5c628fefd28df5de5567edec": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"1d7d65997d7cd0858e9bee71ded272aa": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"791e55db03903988280388573a2fcdc1": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1",
		hs: "t"
	},
	d0bf3b841ad4bbd356e9588874749a13: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		xm: "f"
	},
	"1482beef7dbdb122f6bb4b03640888f2": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "t",
		xm: "f"
	},
	e84976a3529915ac91b964fab03aedb2: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "f",
		xm: "t",
		hs: "t"
	},
	"08055591f95a54a34dd90d90ae5dec24": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "f",
		xm: "t",
		hs: "t"
	},
	"9fac7d0433dc3d936efce5c713488b08": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "f",
		xm: "t",
		hs: "t"
	},
	f3f4482b3551667a52d9b657e15cd2bf: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "f",
		xm: "t",
		hs: "t"
	},
	"044657294450c869c45e7ef61f4870de": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "f",
		xm: "t",
		hs: "t"
	},
	d00e6962a2f9869b16cb46c8eb6126fc: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "t",
		xm: "t",
		hs: "t"
	},
	c0fcce51fa95f4e1d69e1ca6aa2ce5a8: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "t",
		xm: "t",
		hs: "t"
	},
	"1e52e73d5862a7247ba0f93eff5b0370": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "t",
		xm: "t",
		hs: "t"
	},
	bef783d15a103b51db03a866d7a0b273: {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "t",
		xm: "t",
		hs: "t"
	},
	"61c5f654b340379f69ada4bc4cc2d5d0": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "t",
		xm: "t",
		hs: "t"
	},
	"6335d94cf614f38a5cd85c4219eb24f1": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "t",
		xm: "t",
		hs: "t"
	},
	"39dc7f6f39f9b3e341a5ffea76e71fb1": {
		ty: "1",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "1",
		p4: "f",
		xm: "t",
		hs: "t"
	},
	"8cb66c6ed5b379181b1420d8e4758834": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		dualanalog: "t"
	},
	c1ac9987a9483e200c338ccbd2ee94b5: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		dualanalog: "t"
	},
	b5c9f0bf5b5763a923b7f370376b1849: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	b55e4d255173e5b2c2e620f3186a1ecc: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"26897ab47b8c5d3b57d3cc235d7635d8": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"2b1f78aaa2b8de5dae3ee4b93ab678f4": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	a3a4dbd27c80eff9bef51f73cd26f1d5: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"43a0059ff1b5bf76e0c7023fde7c33a5": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	a8e752d108efceff504ae4edc4766b75: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"04c985ebbd0bea4c557207e69b8cbd8f": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	bc1f56d7cc14f15ddfcba5e21e19937b: {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		leftswitch: "0",
		rightswitch: "1"
	},
	"8e0c5fc77b27422a39d86ac2e57dc73d": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	f9fa5107ed213e709858d8876359309e: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"2370f7ce1b91fc775bce3e72454f908a": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t"
	},
	b4f137e85588ce42d302102ba7215437: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t"
	},
	e1b01dd7e842d2b682ef48f689d5a4eb: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"43525a0405184875c2ecfd0196886a34": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		xm: "f",
		hs: "t"
	},
	"803743fe18600f292456539906464421": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		xm: "f",
		hs: "t"
	},
	"106b409c6f4c219b1a3b3d099ead3b2b": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		xm: "f"
	},
	"03daa19b7aae2d27e61f2a4dbe3b9b79": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"03935b9a1f2561bada58fcd5d9fd27de": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		dualanalog: "t"
	},
	d27ed8f883af9b4ee3b5570f30e9ff71: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		dualanalog: "t"
	},
	"01c7bc3cd8375e353c8aa837fe1262ec": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	a3a85e507d6f718972b1464ce1aaf8a4: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		xm: "f",
		hs: "t"
	},
	"31b20a4710e691300bb4aa62cf02284c": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		xm: "f",
		hs: "t"
	},
	"32f1a1b5a7e3b4493c3b7b637aeea7d8": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"6e27f73bd4a49b647bcd58bc5f8b739d": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"0070751edb8bbf4dd4a685f58b5b72c5": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"9bd70c06d3386f76f8162881699a777a": {
		ty: "3",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		hs: "f"
	},
	"95c8a795e30640c9ec82609872c80517": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		rightswitch: "1"
	},
	"1c8139c584e1cf5c6afdd2f3455a2446": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	ca1c27b53fcfb9fed83bc9e92920707c: {
		ty: "4",
		p: "f",
		c1: "0",
		c2: "0",
		r: "0",
		f: "0"
	},
	"771cb4609347657f63e6f0eb26036e35": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	a84c1b2300fbfbf21b1c02387f613dad: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0"
	},
	"6adf79558a3d7f5beca1bb8d34337417": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"783d09ad9542b0bb28aa4cc6ffcf8aa6": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"0f4bd5800359a62a5874b93dc92a47f1": {
		ty: "2",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0"
	},
	"02508e6df5e173b4063a7e6e63295817": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		xm: "f",
		hs: "t"
	},
	"81cee326b99d6831de10a566e338bd25": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		hs: "t"
	},
	"1c9b0bb028e63f83a2d1c1def675acc9": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		xm: "f"
	},
	f4ad1a1d732c2c8cdbd21dabaf38a46c: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	f41f651417c234104d37296477fa29eb: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"7ab539bb0e99e1e5a1c89230bde64610": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"88b9de0eba37ba516590fa8b860155f0": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"61aa4a074ad08c524fbee88d15e369ea": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"3632fcc732a33591b91f0eea2c01e599": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	d0b87d349d6d5e40920cc4ff95253339: {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"9cb3848416e39ebf642357dbee3e5970": {
		ty: "3",
		p: "f",
		c1: "1",
		c2: "0",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	b1ec7bd809ab3deb746c5a5eb2efaecb: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"43f8e9cec3d9991017709f48a7aa22f6": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	f85d506f5933427c8de664be0c5510a3: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	f83849cf3f5ac95856e8f93ee90d5a8d: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f",
		rightswitch: "1"
	},
	c62632545c91823f72f6f14b19766804: {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"40913dcf24a623c1dc2495a1c4931b48": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"8b49549763f4f0e42a23942b8df6b248": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"7db031f1c4dc957719812fe68ee42531": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"5837c4ac8b481fb98381adfd2fe87969": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"05b04e9822a75ceeeaa2eb106ffe768e": {
		ty: "4",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"727b6d447e21af42b3767f9c2cff6012": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	c3107d3e3e17d67e3a11d47a5946a4f3: {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"8caa29a8d9214ca02697b3357102309a": {
		ty: "2",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	b3143adbbb7d7d189e918e5b29d55a72: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	e547492ebd342e57c28bb235546da299: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"89b8b3df46733e0c4d57aeb9bb245e6f": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	eea04359df6770d66b0d97c2cea1932f: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"7cdfbe37634e7dcd4dc67db7edbcd3ba": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"1ae0b27d47f19d59652168fad3966375": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"35433868dfe383ae21fd77507e5a478d": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "t",
		xm: "f",
		hs: "f"
	},
	"59f1c1e7f6653a4e66ea898ce6eab50f": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	c2b42639718d005a6d0aefa0809f77db: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "1",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "f"
	},
	"80ffad3edb50f0970e780a727a4524dd": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	d9a110d889c4d42089c61fade25af220: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	"79df20ee86a989e669158bcb9d113e8a": {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	f982c7dbf74c9c049cf7f875a46ed818: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	ff8d8283553af5d5dbdaddb5781b4896: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "f",
		hs: "t"
	},
	a466a699324d11e1a2594cc89a9f18e1: {
		ty: "0",
		p: "f",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "t",
		hs: "f",
		leftswitch: "0"
	},
	"0c097bc8c786af182935081ac5cd631f": {
		ty: "0",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "t",
		hs: "t"
	},
	a662862f20362fc5eb5c651065cbd51c: {
		ty: "3",
		p: "t",
		c1: "1",
		c2: "1",
		r: "0",
		f: "0",
		p4: "f",
		xm: "t",
		hs: "f",
		dualanalog: "t"
	}
}, dp = /* @__PURE__ */ t({ Load: () => hp }), fp = up, pp = !1, mp = !0;
function hp(e) {
	if (pp = !1, mp) {
		var t = fp[e];
		if (t) {
			pp = !0, console.log(t);
			var n = t.t;
			n !== void 0 && fs(n);
			var r = t.ty;
			r !== void 0 && gs(parseInt(r));
			var i = t.p;
			i !== void 0 && _s(i == "t");
			var a = t.c1;
			a !== void 0 && ys(parseInt(a));
			var o = t.c2;
			o !== void 0 && bs(parseInt(o));
			var s = t.r;
			s !== void 0 && Cs(parseInt(s));
			var c = t.xm;
			c !== void 0 && Ts(c == "t");
			var l = t.crossx;
			l !== void 0 && Ds(parseInt(l));
			var ee = t.crossy;
			ee !== void 0 && Os(parseInt(ee));
			var te = t.dualanalog;
			te !== void 0 && js(te == "t");
			var ne = t.p4;
			if (ne !== void 0) {
				var re = ne == "t";
				vs(re), re && _s(!0);
			}
			var ie = t.leftswitch;
			ie !== void 0 && Ms(parseInt(ie));
			var ae = t.rightswitch;
			ae !== void 0 && Ns(parseInt(ae));
			var oe = t.sb;
			oe !== void 0 && Ps(oe == "t");
			var se = t.hs;
			se !== void 0 && Fs(se == "t");
		}
		return pp;
	}
}
//#endregion
export { ed as Audio, ja as Cartridge, dp as Database, Jn as Events, zl as Maria, gi as Memory, ef as ProSystem, yd as Region, Eu as Sound };
