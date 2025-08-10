/* esm.sh - regenerator-runtime@0.13.11 */
var X = Object.create;
var H = Object.defineProperty;
var Z = Object.getOwnPropertyDescriptor;
var x = Object.getOwnPropertyNames;
var tt = Object.getPrototypeOf, rt = Object.prototype.hasOwnProperty;
var et = (a, u) => () => (u || a((u = { exports: {} }).exports, u), u.exports);
var nt = (a, u, l, d) => {
  if (u && typeof u == "object" || typeof u == "function") {
    for (let f of x(u)) {
      !rt.call(a, f) && f !== l && H(a, f, {
        get: () => u[f],
        enumerable: !(d = Z(u, f)) || d.enumerable,
      });
    }
  }
  return a;
};
var ot = (
  a,
  u,
  l,
) => (l = a != null ? X(tt(a)) : {},
  nt(
    u || !a || !a.__esModule
      ? H(l, "default", { value: a, enumerable: !0 })
      : l,
    a,
  ));
var J = et((at, q) => {
  var Y = function (a) {
    "use strict";
    var u = Object.prototype,
      l = u.hasOwnProperty,
      d = Object.defineProperty || function (r, t, e) {
        r[t] = e.value;
      },
      f,
      _ = typeof Symbol == "function" ? Symbol : {},
      b = _.iterator || "@@iterator",
      K = _.asyncIterator || "@@asyncIterator",
      j = _.toStringTag || "@@toStringTag";
    function y(r, t, e) {
      return Object.defineProperty(r, t, {
        value: e,
        enumerable: !0,
        configurable: !0,
        writable: !0,
      }),
        r[t];
    }
    try {
      y({}, "");
    } catch {
      y = function (t, e, o) {
        return t[e] = o;
      };
    }
    function D(r, t, e, o) {
      var n = t && t.prototype instanceof T ? t : T,
        i = Object.create(n.prototype),
        h = new C(o || []);
      return d(i, "_invoke", { value: U(r, e, h) }), i;
    }
    a.wrap = D;
    function N(r, t, e) {
      try {
        return { type: "normal", arg: r.call(t, e) };
      } catch (o) {
        return { type: "throw", arg: o };
      }
    }
    var W = "suspendedStart",
      Q = "suspendedYield",
      $ = "executing",
      S = "completed",
      p = {};
    function T() {}
    function E() {}
    function g() {}
    var P = {};
    y(P, b, function () {
      return this;
    });
    var I = Object.getPrototypeOf, G = I && I(I(M([])));
    G && G !== u && l.call(G, b) && (P = G);
    var w = g.prototype = T.prototype = Object.create(P);
    E.prototype = g,
      d(w, "constructor", { value: g, configurable: !0 }),
      d(g, "constructor", { value: E, configurable: !0 }),
      E.displayName = y(g, j, "GeneratorFunction");
    function z(r) {
      ["next", "throw", "return"].forEach(function (t) {
        y(r, t, function (e) {
          return this._invoke(t, e);
        });
      });
    }
    a.isGeneratorFunction = function (r) {
      var t = typeof r == "function" && r.constructor;
      return t
        ? t === E || (t.displayName || t.name) === "GeneratorFunction"
        : !1;
    },
      a.mark = function (r) {
        return Object.setPrototypeOf
          ? Object.setPrototypeOf(r, g)
          : (r.__proto__ = g, y(r, j, "GeneratorFunction")),
          r.prototype = Object.create(w),
          r;
      },
      a.awrap = function (r) {
        return { __await: r };
      };
    function O(r, t) {
      function e(i, h, c, v) {
        var s = N(r[i], r, h);
        if (s.type === "throw") v(s.arg);
        else {
          var R = s.arg, L = R.value;
          return L && typeof L == "object" && l.call(L, "__await")
            ? t.resolve(L.__await).then(function (m) {
              e("next", m, c, v);
            }, function (m) {
              e("throw", m, c, v);
            })
            : t.resolve(L).then(function (m) {
              R.value = m, c(R);
            }, function (m) {
              return e("throw", m, c, v);
            });
        }
      }
      var o;
      function n(i, h) {
        function c() {
          return new t(function (v, s) {
            e(i, h, v, s);
          });
        }
        return o = o ? o.then(c, c) : c();
      }
      d(this, "_invoke", { value: n });
    }
    z(O.prototype),
      y(O.prototype, K, function () {
        return this;
      }),
      a.AsyncIterator = O,
      a.async = function (r, t, e, o, n) {
        n === void 0 && (n = Promise);
        var i = new O(D(r, t, e, o), n);
        return a.isGeneratorFunction(t) ? i : i.next().then(function (h) {
          return h.done ? h.value : i.next();
        });
      };
    function U(r, t, e) {
      var o = W;
      return function (i, h) {
        if (o === $) throw new Error("Generator is already running");
        if (o === S) {
          if (i === "throw") throw h;
          return F();
        }
        for (e.method = i, e.arg = h;;) {
          var c = e.delegate;
          if (c) {
            var v = B(c, e);
            if (v) {
              if (v === p) continue;
              return v;
            }
          }
          if (e.method === "next") e.sent = e._sent = e.arg;
          else if (e.method === "throw") {
            if (o === W) throw o = S, e.arg;
            e.dispatchException(e.arg);
          } else e.method === "return" && e.abrupt("return", e.arg);
          o = $;
          var s = N(r, t, e);
          if (s.type === "normal") {
            if (o = e.done ? S : Q, s.arg === p) continue;
            return { value: s.arg, done: e.done };
          } else {s.type === "throw" &&
              (o = S, e.method = "throw", e.arg = s.arg);}
        }
      };
    }
    function B(r, t) {
      var e = t.method, o = r.iterator[e];
      if (o === f) {
        return t.delegate = null,
          e === "throw" && r.iterator.return &&
            (t.method = "return", t.arg = f, B(r, t), t.method === "throw") ||
          e !== "return" &&
            (t.method = "throw",
              t.arg = new TypeError(
                "The iterator does not provide a '" + e + "' method",
              )),
          p;
      }
      var n = N(o, r.iterator, t.arg);
      if (n.type === "throw") {
        return t.method = "throw", t.arg = n.arg, t.delegate = null, p;
      }
      var i = n.arg;
      if (!i) {
        return t.method = "throw",
          t.arg = new TypeError("iterator result is not an object"),
          t.delegate = null,
          p;
      }
      if (i.done) {
        t[r.resultName] = i.value,
          t.next = r.nextLoc,
          t.method !== "return" && (t.method = "next", t.arg = f);
      } else return i;
      return t.delegate = null, p;
    }
    z(w),
      y(w, j, "Generator"),
      y(w, b, function () {
        return this;
      }),
      y(w, "toString", function () {
        return "[object Generator]";
      });
    function V(r) {
      var t = { tryLoc: r[0] };
      1 in r && (t.catchLoc = r[1]),
        2 in r && (t.finallyLoc = r[2], t.afterLoc = r[3]),
        this.tryEntries.push(t);
    }
    function A(r) {
      var t = r.completion || {};
      t.type = "normal", delete t.arg, r.completion = t;
    }
    function C(r) {
      this.tryEntries = [{ tryLoc: "root" }],
        r.forEach(V, this),
        this.reset(!0);
    }
    a.keys = function (r) {
      var t = Object(r), e = [];
      for (var o in t) e.push(o);
      return e.reverse(), function n() {
        for (; e.length;) {
          var i = e.pop();
          if (i in t) return n.value = i, n.done = !1, n;
        }
        return n.done = !0, n;
      };
    };
    function M(r) {
      if (r) {
        var t = r[b];
        if (t) return t.call(r);
        if (typeof r.next == "function") return r;
        if (!isNaN(r.length)) {
          var e = -1,
            o = function n() {
              for (; ++e < r.length;) {
                if (l.call(r, e)) return n.value = r[e], n.done = !1, n;
              }
              return n.value = f, n.done = !0, n;
            };
          return o.next = o;
        }
      }
      return { next: F };
    }
    a.values = M;
    function F() {
      return { value: f, done: !0 };
    }
    return C.prototype = {
      constructor: C,
      reset: function (r) {
        if (
          this.prev = 0,
            this.next = 0,
            this.sent = this._sent = f,
            this.done = !1,
            this.delegate = null,
            this.method = "next",
            this.arg = f,
            this.tryEntries.forEach(A),
            !r
        ) {
          for (var t in this) {
            t.charAt(0) === "t" && l.call(this, t) && !isNaN(+t.slice(1)) &&
              (this[t] = f);
          }
        }
      },
      stop: function () {
        this.done = !0;
        var r = this.tryEntries[0], t = r.completion;
        if (t.type === "throw") throw t.arg;
        return this.rval;
      },
      dispatchException: function (r) {
        if (this.done) throw r;
        var t = this;
        function e(v, s) {
          return i.type = "throw",
            i.arg = r,
            t.next = v,
            s && (t.method = "next", t.arg = f),
            !!s;
        }
        for (var o = this.tryEntries.length - 1; o >= 0; --o) {
          var n = this.tryEntries[o], i = n.completion;
          if (n.tryLoc === "root") return e("end");
          if (n.tryLoc <= this.prev) {
            var h = l.call(n, "catchLoc"), c = l.call(n, "finallyLoc");
            if (h && c) {
              if (this.prev < n.catchLoc) return e(n.catchLoc, !0);
              if (this.prev < n.finallyLoc) return e(n.finallyLoc);
            } else if (h) {
              if (this.prev < n.catchLoc) return e(n.catchLoc, !0);
            } else if (c) {
              if (this.prev < n.finallyLoc) return e(n.finallyLoc);
            } else throw new Error("try statement without catch or finally");
          }
        }
      },
      abrupt: function (r, t) {
        for (var e = this.tryEntries.length - 1; e >= 0; --e) {
          var o = this.tryEntries[e];
          if (
            o.tryLoc <= this.prev && l.call(o, "finallyLoc") &&
            this.prev < o.finallyLoc
          ) {
            var n = o;
            break;
          }
        }
        n && (r === "break" || r === "continue") && n.tryLoc <= t &&
          t <= n.finallyLoc && (n = null);
        var i = n ? n.completion : {};
        return i.type = r,
          i.arg = t,
          n
            ? (this.method = "next", this.next = n.finallyLoc, p)
            : this.complete(i);
      },
      complete: function (r, t) {
        if (r.type === "throw") throw r.arg;
        return r.type === "break" || r.type === "continue"
          ? this.next = r.arg
          : r.type === "return"
          ? (this.rval = this.arg = r.arg,
            this.method = "return",
            this.next = "end")
          : r.type === "normal" && t && (this.next = t),
          p;
      },
      finish: function (r) {
        for (var t = this.tryEntries.length - 1; t >= 0; --t) {
          var e = this.tryEntries[t];
          if (e.finallyLoc === r) {
            return this.complete(e.completion, e.afterLoc), A(e), p;
          }
        }
      },
      catch: function (r) {
        for (var t = this.tryEntries.length - 1; t >= 0; --t) {
          var e = this.tryEntries[t];
          if (e.tryLoc === r) {
            var o = e.completion;
            if (o.type === "throw") {
              var n = o.arg;
              A(e);
            }
            return n;
          }
        }
        throw new Error("illegal catch attempt");
      },
      delegateYield: function (r, t, e) {
        return this.delegate = { iterator: M(r), resultName: t, nextLoc: e },
          this.method === "next" && (this.arg = f),
          p;
      },
    },
      a;
  }(typeof q == "object" ? q.exports : {});
  try {
    regeneratorRuntime = Y;
  } catch {
    typeof globalThis == "object"
      ? globalThis.regeneratorRuntime = Y
      : Function("r", "regeneratorRuntime = r")(Y);
  }
});
var k = ot(J()),
  {
    wrap: ut,
    isGeneratorFunction: ft,
    mark: ht,
    awrap: ct,
    AsyncIterator: st,
    async: lt,
    keys: vt,
    values: pt,
  } = k,
  yt = k.default ?? k;
export {
  ct as awrap,
  ft as isGeneratorFunction,
  ht as mark,
  lt as async,
  pt as values,
  st as AsyncIterator,
  ut as wrap,
  vt as keys,
  yt as default,
};
//# sourceMappingURL=regenerator-runtime.mjs.map
