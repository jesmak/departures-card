/*! departures-card 1.2.0 | MIT License */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i7 = decorators.length - 1, decorator; i7 >= 0; i7--)
    if (decorator = decorators[i7])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// node_modules/@lit/reactive-element/css-tag.js
var t = globalThis;
var e = t.ShadowRoot && (void 0 === t.ShadyCSS || t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s = /* @__PURE__ */ Symbol();
var o = /* @__PURE__ */ new WeakMap();
var n = class {
  constructor(t6, e6, o6) {
    if (this._$cssResult$ = true, o6 !== s) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t6, this.t = e6;
  }
  get styleSheet() {
    let t6 = this.o;
    const s5 = this.t;
    if (e && void 0 === t6) {
      const e6 = void 0 !== s5 && 1 === s5.length;
      e6 && (t6 = o.get(s5)), void 0 === t6 && ((this.o = t6 = new CSSStyleSheet()).replaceSync(this.cssText), e6 && o.set(s5, t6));
    }
    return t6;
  }
  toString() {
    return this.cssText;
  }
};
var r = (t6) => new n("string" == typeof t6 ? t6 : t6 + "", void 0, s);
var i = (t6, ...e6) => {
  const o6 = 1 === t6.length ? t6[0] : e6.reduce((e7, s5, o7) => e7 + ((t7) => {
    if (true === t7._$cssResult$) return t7.cssText;
    if ("number" == typeof t7) return t7;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t7 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s5) + t6[o7 + 1], t6[0]);
  return new n(o6, t6, s);
};
var S = (s5, o6) => {
  if (e) s5.adoptedStyleSheets = o6.map((t6) => t6 instanceof CSSStyleSheet ? t6 : t6.styleSheet);
  else for (const e6 of o6) {
    const o7 = document.createElement("style"), n5 = t.litNonce;
    void 0 !== n5 && o7.setAttribute("nonce", n5), o7.textContent = e6.cssText, s5.appendChild(o7);
  }
};
var c = e ? (t6) => t6 : (t6) => t6 instanceof CSSStyleSheet ? ((t7) => {
  let e6 = "";
  for (const s5 of t7.cssRules) e6 += s5.cssText;
  return r(e6);
})(t6) : t6;

// node_modules/@lit/reactive-element/reactive-element.js
var { is: i2, defineProperty: e2, getOwnPropertyDescriptor: h, getOwnPropertyNames: r2, getOwnPropertySymbols: o2, getPrototypeOf: n2 } = Object;
var a = globalThis;
var c2 = a.trustedTypes;
var l = c2 ? c2.emptyScript : "";
var p = a.reactiveElementPolyfillSupport;
var d = (t6, s5) => t6;
var u = { toAttribute(t6, s5) {
  switch (s5) {
    case Boolean:
      t6 = t6 ? l : null;
      break;
    case Object:
    case Array:
      t6 = null == t6 ? t6 : JSON.stringify(t6);
  }
  return t6;
}, fromAttribute(t6, s5) {
  let i7 = t6;
  switch (s5) {
    case Boolean:
      i7 = null !== t6;
      break;
    case Number:
      i7 = null === t6 ? null : Number(t6);
      break;
    case Object:
    case Array:
      try {
        i7 = JSON.parse(t6);
      } catch (t7) {
        i7 = null;
      }
  }
  return i7;
} };
var f = (t6, s5) => !i2(t6, s5);
var b = { attribute: true, type: String, converter: u, reflect: false, useDefault: false, hasChanged: f };
Symbol.metadata ?? (Symbol.metadata = /* @__PURE__ */ Symbol("metadata")), a.litPropertyMetadata ?? (a.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
var y = class extends HTMLElement {
  static addInitializer(t6) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t6);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t6, s5 = b) {
    if (s5.state && (s5.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t6) && ((s5 = Object.create(s5)).wrapped = true), this.elementProperties.set(t6, s5), !s5.noAccessor) {
      const i7 = /* @__PURE__ */ Symbol(), h4 = this.getPropertyDescriptor(t6, i7, s5);
      void 0 !== h4 && e2(this.prototype, t6, h4);
    }
  }
  static getPropertyDescriptor(t6, s5, i7) {
    const { get: e6, set: r6 } = h(this.prototype, t6) ?? { get() {
      return this[s5];
    }, set(t7) {
      this[s5] = t7;
    } };
    return { get: e6, set(s6) {
      const h4 = e6?.call(this);
      r6?.call(this, s6), this.requestUpdate(t6, h4, i7);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t6) {
    return this.elementProperties.get(t6) ?? b;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d("elementProperties"))) return;
    const t6 = n2(this);
    t6.finalize(), void 0 !== t6.l && (this.l = [...t6.l]), this.elementProperties = new Map(t6.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d("properties"))) {
      const t7 = this.properties, s5 = [...r2(t7), ...o2(t7)];
      for (const i7 of s5) this.createProperty(i7, t7[i7]);
    }
    const t6 = this[Symbol.metadata];
    if (null !== t6) {
      const s5 = litPropertyMetadata.get(t6);
      if (void 0 !== s5) for (const [t7, i7] of s5) this.elementProperties.set(t7, i7);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t7, s5] of this.elementProperties) {
      const i7 = this._$Eu(t7, s5);
      void 0 !== i7 && this._$Eh.set(i7, t7);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s5) {
    const i7 = [];
    if (Array.isArray(s5)) {
      const e6 = new Set(s5.flat(1 / 0).reverse());
      for (const s6 of e6) i7.unshift(c(s6));
    } else void 0 !== s5 && i7.push(c(s5));
    return i7;
  }
  static _$Eu(t6, s5) {
    const i7 = s5.attribute;
    return false === i7 ? void 0 : "string" == typeof i7 ? i7 : "string" == typeof t6 ? t6.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t6) => this.enableUpdating = t6), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t6) => t6(this));
  }
  addController(t6) {
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t6), void 0 !== this.renderRoot && this.isConnected && t6.hostConnected?.();
  }
  removeController(t6) {
    this._$EO?.delete(t6);
  }
  _$E_() {
    const t6 = /* @__PURE__ */ new Map(), s5 = this.constructor.elementProperties;
    for (const i7 of s5.keys()) this.hasOwnProperty(i7) && (t6.set(i7, this[i7]), delete this[i7]);
    t6.size > 0 && (this._$Ep = t6);
  }
  createRenderRoot() {
    const t6 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S(t6, this.constructor.elementStyles), t6;
  }
  connectedCallback() {
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(true), this._$EO?.forEach((t6) => t6.hostConnected?.());
  }
  enableUpdating(t6) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t6) => t6.hostDisconnected?.());
  }
  attributeChangedCallback(t6, s5, i7) {
    this._$AK(t6, i7);
  }
  _$ET(t6, s5) {
    const i7 = this.constructor.elementProperties.get(t6), e6 = this.constructor._$Eu(t6, i7);
    if (void 0 !== e6 && true === i7.reflect) {
      const h4 = (void 0 !== i7.converter?.toAttribute ? i7.converter : u).toAttribute(s5, i7.type);
      this._$Em = t6, null == h4 ? this.removeAttribute(e6) : this.setAttribute(e6, h4), this._$Em = null;
    }
  }
  _$AK(t6, s5) {
    const i7 = this.constructor, e6 = i7._$Eh.get(t6);
    if (void 0 !== e6 && this._$Em !== e6) {
      const t7 = i7.getPropertyOptions(e6), h4 = "function" == typeof t7.converter ? { fromAttribute: t7.converter } : void 0 !== t7.converter?.fromAttribute ? t7.converter : u;
      this._$Em = e6;
      const r6 = h4.fromAttribute(s5, t7.type);
      this[e6] = r6 ?? this._$Ej?.get(e6) ?? r6, this._$Em = null;
    }
  }
  requestUpdate(t6, s5, i7, e6 = false, h4) {
    if (void 0 !== t6) {
      const r6 = this.constructor;
      if (false === e6 && (h4 = this[t6]), i7 ?? (i7 = r6.getPropertyOptions(t6)), !((i7.hasChanged ?? f)(h4, s5) || i7.useDefault && i7.reflect && h4 === this._$Ej?.get(t6) && !this.hasAttribute(r6._$Eu(t6, i7)))) return;
      this.C(t6, s5, i7);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t6, s5, { useDefault: i7, reflect: e6, wrapped: h4 }, r6) {
    i7 && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t6) && (this._$Ej.set(t6, r6 ?? s5 ?? this[t6]), true !== h4 || void 0 !== r6) || (this._$AL.has(t6) || (this.hasUpdated || i7 || (s5 = void 0), this._$AL.set(t6, s5)), true === e6 && this._$Em !== t6 && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t6));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t7) {
      Promise.reject(t7);
    }
    const t6 = this.scheduleUpdate();
    return null != t6 && await t6, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [t8, s6] of this._$Ep) this[t8] = s6;
        this._$Ep = void 0;
      }
      const t7 = this.constructor.elementProperties;
      if (t7.size > 0) for (const [s6, i7] of t7) {
        const { wrapped: t8 } = i7, e6 = this[s6];
        true !== t8 || this._$AL.has(s6) || void 0 === e6 || this.C(s6, void 0, i7, e6);
      }
    }
    let t6 = false;
    const s5 = this._$AL;
    try {
      t6 = this.shouldUpdate(s5), t6 ? (this.willUpdate(s5), this._$EO?.forEach((t7) => t7.hostUpdate?.()), this.update(s5)) : this._$EM();
    } catch (s6) {
      throw t6 = false, this._$EM(), s6;
    }
    t6 && this._$AE(s5);
  }
  willUpdate(t6) {
  }
  _$AE(t6) {
    this._$EO?.forEach((t7) => t7.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t6)), this.updated(t6);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t6) {
    return true;
  }
  update(t6) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((t7) => this._$ET(t7, this[t7]))), this._$EM();
  }
  updated(t6) {
  }
  firstUpdated(t6) {
  }
};
y.elementStyles = [], y.shadowRootOptions = { mode: "open" }, y[d("elementProperties")] = /* @__PURE__ */ new Map(), y[d("finalized")] = /* @__PURE__ */ new Map(), p?.({ ReactiveElement: y }), (a.reactiveElementVersions ?? (a.reactiveElementVersions = [])).push("2.1.2");

// node_modules/lit-html/lit-html.js
var t2 = globalThis;
var i3 = (t6) => t6;
var s2 = t2.trustedTypes;
var e3 = s2 ? s2.createPolicy("lit-html", { createHTML: (t6) => t6 }) : void 0;
var h2 = "$lit$";
var o3 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n3 = "?" + o3;
var r3 = `<${n3}>`;
var l2 = document;
var c3 = () => l2.createComment("");
var a2 = (t6) => null === t6 || "object" != typeof t6 && "function" != typeof t6;
var u2 = Array.isArray;
var d2 = (t6) => u2(t6) || "function" == typeof t6?.[Symbol.iterator];
var f2 = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p2 = RegExp(`>|${f2}(?:([^\\s"'>=/]+)(${f2}*=${f2}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y2 = /^(?:script|style|textarea|title)$/i;
var x = (t6) => (i7, ...s5) => ({ _$litType$: t6, strings: i7, values: s5 });
var b2 = x(1);
var w = x(2);
var T = x(3);
var E = /* @__PURE__ */ Symbol.for("lit-noChange");
var A = /* @__PURE__ */ Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l2.createTreeWalker(l2, 129);
function V(t6, i7) {
  if (!u2(t6) || !t6.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e3 ? e3.createHTML(i7) : i7;
}
var N = (t6, i7) => {
  const s5 = t6.length - 1, e6 = [];
  let n5, l3 = 2 === i7 ? "<svg>" : 3 === i7 ? "<math>" : "", c5 = v;
  for (let i8 = 0; i8 < s5; i8++) {
    const s6 = t6[i8];
    let a3, u5, d3 = -1, f3 = 0;
    for (; f3 < s6.length && (c5.lastIndex = f3, u5 = c5.exec(s6), null !== u5); ) f3 = c5.lastIndex, c5 === v ? "!--" === u5[1] ? c5 = _ : void 0 !== u5[1] ? c5 = m : void 0 !== u5[2] ? (y2.test(u5[2]) && (n5 = RegExp("</" + u5[2], "g")), c5 = p2) : void 0 !== u5[3] && (c5 = p2) : c5 === p2 ? ">" === u5[0] ? (c5 = n5 ?? v, d3 = -1) : void 0 === u5[1] ? d3 = -2 : (d3 = c5.lastIndex - u5[2].length, a3 = u5[1], c5 = void 0 === u5[3] ? p2 : '"' === u5[3] ? $ : g) : c5 === $ || c5 === g ? c5 = p2 : c5 === _ || c5 === m ? c5 = v : (c5 = p2, n5 = void 0);
    const x2 = c5 === p2 && t6[i8 + 1].startsWith("/>") ? " " : "";
    l3 += c5 === v ? s6 + r3 : d3 >= 0 ? (e6.push(a3), s6.slice(0, d3) + h2 + s6.slice(d3) + o3 + x2) : s6 + o3 + (-2 === d3 ? i8 : x2);
  }
  return [V(t6, l3 + (t6[s5] || "<?>") + (2 === i7 ? "</svg>" : 3 === i7 ? "</math>" : "")), e6];
};
var S2 = class _S {
  constructor({ strings: t6, _$litType$: i7 }, e6) {
    let r6;
    this.parts = [];
    let l3 = 0, a3 = 0;
    const u5 = t6.length - 1, d3 = this.parts, [f3, v3] = N(t6, i7);
    if (this.el = _S.createElement(f3, e6), P.currentNode = this.el.content, 2 === i7 || 3 === i7) {
      const t7 = this.el.content.firstChild;
      t7.replaceWith(...t7.childNodes);
    }
    for (; null !== (r6 = P.nextNode()) && d3.length < u5; ) {
      if (1 === r6.nodeType) {
        if (r6.hasAttributes()) for (const t7 of r6.getAttributeNames()) if (t7.endsWith(h2)) {
          const i8 = v3[a3++], s5 = r6.getAttribute(t7).split(o3), e7 = /([.?@])?(.*)/.exec(i8);
          d3.push({ type: 1, index: l3, name: e7[2], strings: s5, ctor: "." === e7[1] ? I : "?" === e7[1] ? L : "@" === e7[1] ? z : H }), r6.removeAttribute(t7);
        } else t7.startsWith(o3) && (d3.push({ type: 6, index: l3 }), r6.removeAttribute(t7));
        if (y2.test(r6.tagName)) {
          const t7 = r6.textContent.split(o3), i8 = t7.length - 1;
          if (i8 > 0) {
            r6.textContent = s2 ? s2.emptyScript : "";
            for (let s5 = 0; s5 < i8; s5++) r6.append(t7[s5], c3()), P.nextNode(), d3.push({ type: 2, index: ++l3 });
            r6.append(t7[i8], c3());
          }
        }
      } else if (8 === r6.nodeType) if (r6.data === n3) d3.push({ type: 2, index: l3 });
      else {
        let t7 = -1;
        for (; -1 !== (t7 = r6.data.indexOf(o3, t7 + 1)); ) d3.push({ type: 7, index: l3 }), t7 += o3.length - 1;
      }
      l3++;
    }
  }
  static createElement(t6, i7) {
    const s5 = l2.createElement("template");
    return s5.innerHTML = t6, s5;
  }
};
function M(t6, i7, s5 = t6, e6) {
  if (i7 === E) return i7;
  let h4 = void 0 !== e6 ? s5._$Co?.[e6] : s5._$Cl;
  const o6 = a2(i7) ? void 0 : i7._$litDirective$;
  return h4?.constructor !== o6 && (h4?._$AO?.(false), void 0 === o6 ? h4 = void 0 : (h4 = new o6(t6), h4._$AT(t6, s5, e6)), void 0 !== e6 ? (s5._$Co ?? (s5._$Co = []))[e6] = h4 : s5._$Cl = h4), void 0 !== h4 && (i7 = M(t6, h4._$AS(t6, i7.values), h4, e6)), i7;
}
var R = class {
  constructor(t6, i7) {
    this._$AV = [], this._$AN = void 0, this._$AD = t6, this._$AM = i7;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t6) {
    const { el: { content: i7 }, parts: s5 } = this._$AD, e6 = (t6?.creationScope ?? l2).importNode(i7, true);
    P.currentNode = e6;
    let h4 = P.nextNode(), o6 = 0, n5 = 0, r6 = s5[0];
    for (; void 0 !== r6; ) {
      if (o6 === r6.index) {
        let i8;
        2 === r6.type ? i8 = new k(h4, h4.nextSibling, this, t6) : 1 === r6.type ? i8 = new r6.ctor(h4, r6.name, r6.strings, this, t6) : 6 === r6.type && (i8 = new Z(h4, this, t6)), this._$AV.push(i8), r6 = s5[++n5];
      }
      o6 !== r6?.index && (h4 = P.nextNode(), o6++);
    }
    return P.currentNode = l2, e6;
  }
  p(t6) {
    let i7 = 0;
    for (const s5 of this._$AV) void 0 !== s5 && (void 0 !== s5.strings ? (s5._$AI(t6, s5, i7), i7 += s5.strings.length - 2) : s5._$AI(t6[i7])), i7++;
  }
};
var k = class _k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t6, i7, s5, e6) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t6, this._$AB = i7, this._$AM = s5, this.options = e6, this._$Cv = e6?.isConnected ?? true;
  }
  get parentNode() {
    let t6 = this._$AA.parentNode;
    const i7 = this._$AM;
    return void 0 !== i7 && 11 === t6?.nodeType && (t6 = i7.parentNode), t6;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t6, i7 = this) {
    t6 = M(this, t6, i7), a2(t6) ? t6 === A || null == t6 || "" === t6 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t6 !== this._$AH && t6 !== E && this._(t6) : void 0 !== t6._$litType$ ? this.$(t6) : void 0 !== t6.nodeType ? this.T(t6) : d2(t6) ? this.k(t6) : this._(t6);
  }
  O(t6) {
    return this._$AA.parentNode.insertBefore(t6, this._$AB);
  }
  T(t6) {
    this._$AH !== t6 && (this._$AR(), this._$AH = this.O(t6));
  }
  _(t6) {
    this._$AH !== A && a2(this._$AH) ? this._$AA.nextSibling.data = t6 : this.T(l2.createTextNode(t6)), this._$AH = t6;
  }
  $(t6) {
    const { values: i7, _$litType$: s5 } = t6, e6 = "number" == typeof s5 ? this._$AC(t6) : (void 0 === s5.el && (s5.el = S2.createElement(V(s5.h, s5.h[0]), this.options)), s5);
    if (this._$AH?._$AD === e6) this._$AH.p(i7);
    else {
      const t7 = new R(e6, this), s6 = t7.u(this.options);
      t7.p(i7), this.T(s6), this._$AH = t7;
    }
  }
  _$AC(t6) {
    let i7 = C.get(t6.strings);
    return void 0 === i7 && C.set(t6.strings, i7 = new S2(t6)), i7;
  }
  k(t6) {
    u2(this._$AH) || (this._$AH = [], this._$AR());
    const i7 = this._$AH;
    let s5, e6 = 0;
    for (const h4 of t6) e6 === i7.length ? i7.push(s5 = new _k(this.O(c3()), this.O(c3()), this, this.options)) : s5 = i7[e6], s5._$AI(h4), e6++;
    e6 < i7.length && (this._$AR(s5 && s5._$AB.nextSibling, e6), i7.length = e6);
  }
  _$AR(t6 = this._$AA.nextSibling, s5) {
    for (this._$AP?.(false, true, s5); t6 !== this._$AB; ) {
      const s6 = i3(t6).nextSibling;
      i3(t6).remove(), t6 = s6;
    }
  }
  setConnected(t6) {
    void 0 === this._$AM && (this._$Cv = t6, this._$AP?.(t6));
  }
};
var H = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t6, i7, s5, e6, h4) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t6, this.name = i7, this._$AM = e6, this.options = h4, s5.length > 2 || "" !== s5[0] || "" !== s5[1] ? (this._$AH = Array(s5.length - 1).fill(new String()), this.strings = s5) : this._$AH = A;
  }
  _$AI(t6, i7 = this, s5, e6) {
    const h4 = this.strings;
    let o6 = false;
    if (void 0 === h4) t6 = M(this, t6, i7, 0), o6 = !a2(t6) || t6 !== this._$AH && t6 !== E, o6 && (this._$AH = t6);
    else {
      const e7 = t6;
      let n5, r6;
      for (t6 = h4[0], n5 = 0; n5 < h4.length - 1; n5++) r6 = M(this, e7[s5 + n5], i7, n5), r6 === E && (r6 = this._$AH[n5]), o6 || (o6 = !a2(r6) || r6 !== this._$AH[n5]), r6 === A ? t6 = A : t6 !== A && (t6 += (r6 ?? "") + h4[n5 + 1]), this._$AH[n5] = r6;
    }
    o6 && !e6 && this.j(t6);
  }
  j(t6) {
    t6 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t6 ?? "");
  }
};
var I = class extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t6) {
    this.element[this.name] = t6 === A ? void 0 : t6;
  }
};
var L = class extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t6) {
    this.element.toggleAttribute(this.name, !!t6 && t6 !== A);
  }
};
var z = class extends H {
  constructor(t6, i7, s5, e6, h4) {
    super(t6, i7, s5, e6, h4), this.type = 5;
  }
  _$AI(t6, i7 = this) {
    if ((t6 = M(this, t6, i7, 0) ?? A) === E) return;
    const s5 = this._$AH, e6 = t6 === A && s5 !== A || t6.capture !== s5.capture || t6.once !== s5.once || t6.passive !== s5.passive, h4 = t6 !== A && (s5 === A || e6);
    e6 && this.element.removeEventListener(this.name, this, s5), h4 && this.element.addEventListener(this.name, this, t6), this._$AH = t6;
  }
  handleEvent(t6) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t6) : this._$AH.handleEvent(t6);
  }
};
var Z = class {
  constructor(t6, i7, s5) {
    this.element = t6, this.type = 6, this._$AN = void 0, this._$AM = i7, this.options = s5;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t6) {
    M(this, t6);
  }
};
var j = { M: h2, P: o3, A: n3, C: 1, L: N, R, D: d2, V: M, I: k, H, N: L, U: z, B: I, F: Z };
var B = t2.litHtmlPolyfillSupport;
B?.(S2, k), (t2.litHtmlVersions ?? (t2.litHtmlVersions = [])).push("3.3.3");
var D = (t6, i7, s5) => {
  const e6 = s5?.renderBefore ?? i7;
  let h4 = e6._$litPart$;
  if (void 0 === h4) {
    const t7 = s5?.renderBefore ?? null;
    e6._$litPart$ = h4 = new k(i7.insertBefore(c3(), t7), t7, void 0, s5 ?? {});
  }
  return h4._$AI(t6), h4;
};

// node_modules/lit-element/lit-element.js
var s3 = globalThis;
var i4 = class extends y {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var _a;
    const t6 = super.createRenderRoot();
    return (_a = this.renderOptions).renderBefore ?? (_a.renderBefore = t6.firstChild), t6;
  }
  update(t6) {
    const r6 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t6), this._$Do = D(r6, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i4._$litElement$ = true, i4["finalized"] = true, s3.litElementHydrateSupport?.({ LitElement: i4 });
var o4 = s3.litElementPolyfillSupport;
o4?.({ LitElement: i4 });
(s3.litElementVersions ?? (s3.litElementVersions = [])).push("4.2.2");

// node_modules/@lit/reactive-element/decorators/custom-element.js
var t3 = (t6) => (e6, o6) => {
  void 0 !== o6 ? o6.addInitializer(() => {
    customElements.define(t6, e6);
  }) : customElements.define(t6, e6);
};

// node_modules/@lit/reactive-element/decorators/property.js
var o5 = { attribute: true, type: String, converter: u, reflect: false, hasChanged: f };
var r4 = (t6 = o5, e6, r6) => {
  const { kind: n5, metadata: i7 } = r6;
  let s5 = globalThis.litPropertyMetadata.get(i7);
  if (void 0 === s5 && globalThis.litPropertyMetadata.set(i7, s5 = /* @__PURE__ */ new Map()), "setter" === n5 && ((t6 = Object.create(t6)).wrapped = true), s5.set(r6.name, t6), "accessor" === n5) {
    const { name: o6 } = r6;
    return { set(r7) {
      const n6 = e6.get.call(this);
      e6.set.call(this, r7), this.requestUpdate(o6, n6, t6, true, r7);
    }, init(e7) {
      return void 0 !== e7 && this.C(o6, void 0, t6, e7), e7;
    } };
  }
  if ("setter" === n5) {
    const { name: o6 } = r6;
    return function(r7) {
      const n6 = this[o6];
      e6.call(this, r7), this.requestUpdate(o6, n6, t6, true, r7);
    };
  }
  throw Error("Unsupported decorator location: " + n5);
};
function n4(t6) {
  return (e6, o6) => "object" == typeof o6 ? r4(t6, e6, o6) : ((t7, e7, o7) => {
    const r6 = e7.hasOwnProperty(o7);
    return e7.constructor.createProperty(o7, t7), r6 ? Object.getOwnPropertyDescriptor(e7, o7) : void 0;
  })(t6, e6, o6);
}

// node_modules/@lit/reactive-element/decorators/state.js
function r5(r6) {
  return n4({ ...r6, state: true, attribute: false });
}

// node_modules/lit-html/directive.js
var t4 = { ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 };
var e5 = (t6) => (...e6) => ({ _$litDirective$: t6, values: e6 });
var i5 = class {
  constructor(t6) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t6, e6, i7) {
    this._$Ct = t6, this._$AM = e6, this._$Ci = i7;
  }
  _$AS(t6, e6) {
    return this.update(t6, e6);
  }
  update(t6, e6) {
    return this.render(...e6);
  }
};

// node_modules/lit-html/directive-helpers.js
var { I: t5 } = j;
var i6 = (o6) => o6;
var s4 = () => document.createComment("");
var v2 = (o6, n5, e6) => {
  const l3 = o6._$AA.parentNode, d3 = void 0 === n5 ? o6._$AB : n5._$AA;
  if (void 0 === e6) {
    const i7 = l3.insertBefore(s4(), d3), n6 = l3.insertBefore(s4(), d3);
    e6 = new t5(i7, n6, o6, o6.options);
  } else {
    const t6 = e6._$AB.nextSibling, n6 = e6._$AM, c5 = n6 !== o6;
    if (c5) {
      let t7;
      e6._$AQ?.(o6), e6._$AM = o6, void 0 !== e6._$AP && (t7 = o6._$AU) !== n6._$AU && e6._$AP(t7);
    }
    if (t6 !== d3 || c5) {
      let o7 = e6._$AA;
      for (; o7 !== t6; ) {
        const t7 = i6(o7).nextSibling;
        i6(l3).insertBefore(o7, d3), o7 = t7;
      }
    }
  }
  return e6;
};
var u3 = (o6, t6, i7 = o6) => (o6._$AI(t6, i7), o6);
var m2 = {};
var p3 = (o6, t6 = m2) => o6._$AH = t6;
var M2 = (o6) => o6._$AH;
var h3 = (o6) => {
  o6._$AR(), o6._$AA.remove();
};

// node_modules/lit-html/directives/repeat.js
var u4 = (e6, s5, t6) => {
  const r6 = /* @__PURE__ */ new Map();
  for (let l3 = s5; l3 <= t6; l3++) r6.set(e6[l3], l3);
  return r6;
};
var c4 = e5(class extends i5 {
  constructor(e6) {
    if (super(e6), e6.type !== t4.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e6, s5, t6) {
    let r6;
    void 0 === t6 ? t6 = s5 : void 0 !== s5 && (r6 = s5);
    const l3 = [], o6 = [];
    let i7 = 0;
    for (const s6 of e6) l3[i7] = r6 ? r6(s6, i7) : i7, o6[i7] = t6(s6, i7), i7++;
    return { values: o6, keys: l3 };
  }
  render(e6, s5, t6) {
    return this.dt(e6, s5, t6).values;
  }
  update(s5, [t6, r6, c5]) {
    const d3 = M2(s5), { values: p4, keys: a3 } = this.dt(t6, r6, c5);
    if (!Array.isArray(d3)) return this.ut = a3, p4;
    const h4 = this.ut ?? (this.ut = []), v3 = [];
    let m3, y3, x2 = 0, j2 = d3.length - 1, k2 = 0, w2 = p4.length - 1;
    for (; x2 <= j2 && k2 <= w2; ) if (null === d3[x2]) x2++;
    else if (null === d3[j2]) j2--;
    else if (h4[x2] === a3[k2]) v3[k2] = u3(d3[x2], p4[k2]), x2++, k2++;
    else if (h4[j2] === a3[w2]) v3[w2] = u3(d3[j2], p4[w2]), j2--, w2--;
    else if (h4[x2] === a3[w2]) v3[w2] = u3(d3[x2], p4[w2]), v2(s5, v3[w2 + 1], d3[x2]), x2++, w2--;
    else if (h4[j2] === a3[k2]) v3[k2] = u3(d3[j2], p4[k2]), v2(s5, d3[x2], d3[j2]), j2--, k2++;
    else if (void 0 === m3 && (m3 = u4(a3, k2, w2), y3 = u4(h4, x2, j2)), m3.has(h4[x2])) if (m3.has(h4[j2])) {
      const e6 = y3.get(a3[k2]), t7 = void 0 !== e6 ? d3[e6] : null;
      if (null === t7) {
        const e7 = v2(s5, d3[x2]);
        u3(e7, p4[k2]), v3[k2] = e7;
      } else v3[k2] = u3(t7, p4[k2]), v2(s5, d3[x2], t7), d3[e6] = null;
      k2++;
    } else h3(d3[j2]), j2--;
    else h3(d3[x2]), x2++;
    for (; k2 <= w2; ) {
      const e6 = v2(s5, v3[w2 + 1]);
      u3(e6, p4[k2]), v3[k2++] = e6;
    }
    for (; x2 <= j2; ) {
      const e6 = d3[x2++];
      null !== e6 && h3(e6);
    }
    return this.ut = a3, p3(s5, v3), E;
  }
});

// src/const.ts
var CARD_VERSION = "1.2.0";
var DEPARTURES_VERSION = 1;
var DEFAULT_DEPARTURES = 4;
var GONE_AFTER_MS = 6e4;
var ARRIVED_KEPT_MS = 30 * 6e4;
var ARRIVED_ROWS = 2;
var TICK_MS = 15e3;
var MODE_COLORS = {
  bus: "var(--departures-bus-color, #0b6aa2)",
  tram: "var(--departures-tram-color, #00845a)",
  metro: "var(--departures-metro-color, #d9480f)",
  train: "var(--departures-train-color, #1b7a3e)",
  ferry: "var(--departures-ferry-color, #00639a)",
  plane: "var(--departures-plane-color, #6741d9)",
  other: "var(--departures-other-color, #5f6b76)"
};

// src/departures.ts
function sectionsOf(entities) {
  return (entities ?? []).map((entry) => typeof entry === "string" ? { entity: entry } : entry).filter((section) => typeof section?.entity === "string" && section.entity !== "");
}
function stopNotices(value) {
  return Array.isArray(value) ? value.filter((notice) => typeof notice === "string" && notice.trim() !== "") : [];
}
function isDeparturesSensor(entity) {
  return entity?.attributes?.departures_version === DEPARTURES_VERSION && Array.isArray(entity.attributes.departures);
}
function statedDirection(entity) {
  const direction = entity?.attributes?.direction;
  return direction === "departures" || direction === "arrivals" ? direction : void 0;
}
function shownDepartures(entityId, entity, withEntity) {
  const direction = statedDirection(entity) ?? "departures";
  const list = Array.isArray(entity.attributes.departures) ? entity.attributes.departures : [];
  return list.filter(isDeparture).map((departure) => ({
    ...departure,
    direction,
    key: withEntity ? `${entityId}|${departure.id}` : departure.id
  }));
}
function departuresSensors(hass) {
  return Object.keys(hass.states).filter((id) => isDeparturesSensor(hass.states[id])).sort();
}
function visibleDepartures(departures, now, count, showCancelled) {
  const upcoming = departures.filter(
    (departure) => Date.parse(departure.estimated) > now - (departure.direction === "arrivals" ? ARRIVED_KEPT_MS : GONE_AFTER_MS)
  ).filter((departure) => showCancelled || !departure.cancelled).sort((a3, b3) => Date.parse(a3.estimated) - Date.parse(b3.estimated));
  const arrived = upcoming.filter((departure) => departure.arrived && !departure.cancelled);
  const dropped = new Set(arrived.slice(0, Math.max(arrived.length - ARRIVED_ROWS, 0)));
  const kept = upcoming.filter((departure) => !dropped.has(departure));
  const next = kept.find((departure) => !departure.cancelled && !departure.arrived);
  const rest = kept.filter((departure) => departure !== next).slice(0, Math.max(count - (next ? 1 : 0), 0));
  return { next, rest };
}
function isDeparture(value) {
  const departure = value;
  return typeof departure === "object" && departure !== null && typeof departure.line === "string" && !Number.isNaN(Date.parse(departure.estimated)) && !Number.isNaN(Date.parse(departure.scheduled));
}
function minutesUntil(estimated, now) {
  const minutes = Math.floor((Date.parse(estimated) - now) / 6e4);
  return minutes < 60 ? Math.max(minutes, 0) : null;
}
function delayMinutes(departure) {
  if (!departure.realtime) {
    return 0;
  }
  return Math.floor(Date.parse(departure.estimated) / 6e4) - Math.floor(Date.parse(departure.scheduled) / 6e4);
}
function clock(time, language, timeZone) {
  return new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(time));
}
function dayLabel(time, now, language, timeZone) {
  const date = (value) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(value);
  const day = date(new Date(time));
  const daysAway = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${date(now)}T00:00:00Z`)) / 864e5;
  if (daysAway <= 0) {
    return "";
  }
  const options = daysAway < 7 ? { weekday: "short" } : { day: "numeric", month: "numeric" };
  return new Intl.DateTimeFormat(language, { ...options, timeZone }).format(new Date(time));
}
var HEX_COLOR = /^#([0-9a-f]{6})$/i;
function badgeColors(departure) {
  const match = HEX_COLOR.exec(departure.color ?? "");
  if (!match) {
    return { background: MODE_COLORS[departure.mode] ?? MODE_COLORS.other, text: "#ffffff" };
  }
  return { background: `#${match[1]}`, text: isLight(match[1]) ? "#1f1f1f" : "#ffffff" };
}
function isLight(hex) {
  const [r6, g2, b3] = [0, 2, 4].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r6 + 0.7152 * g2 + 0.0722 * b3;
  return 1.05 / (luminance + 0.05) < 4.5;
}

// src/localize/languages/en.json
var en_default = {
  common: {
    name: "Departures",
    description: "The next departures from stops, railway stations and airports",
    invalid_configuration: "Invalid configuration. Add at least one departures sensor.",
    no_entity: "Entity {entity} not found",
    not_departures: "{entity} is not a departures sensor",
    unavailable: "Departures are not available right now",
    no_departures: "No upcoming departures",
    now: "Now",
    min: "min",
    cancelled: "Cancelled",
    track: "Track",
    platform: "Platform",
    gate: "Gate",
    realtime: "Real-time estimate",
    departures: "Departures",
    arrivals: "Arrivals",
    no_arrivals: "No arrivals",
    hall: "Hall",
    landed: "Landed",
    arrived: "Arrived",
    departing: "Departing",
    arriving: "Arriving",
    entity_unavailable: "{entity} isn't available right now"
  },
  editor: {
    title: "Title",
    entities: "Stops",
    entities_helper: "Departures sensors, each shown as a section of its own, or all as one list. Both sides of a street fit in one card.",
    entity: "Departures sensor",
    name: "Name",
    name_helper: "Replaces the stop's own name",
    subtitle: "Subtitle",
    subtitle_helper: "Such as the direction, towards the centre. Not used in one list.",
    departures: "Departures shown",
    departures_helper: "Per stop, or in the whole list when the stops are one list",
    show_cancelled: "Show cancelled departures",
    show_notices: "Show notices",
    show_notices_helper: "Track works and other notices for the whole stop, under its name",
    full_texts: "Show texts in full",
    full_texts_helper: "The subtitle and the notices of later departures wrap instead of being cut short",
    combine: "Show as one list",
    combine_helper: "Every stop's departures and arrivals in one list in time order"
  }
};

// src/localize/languages/fi.json
var fi_default = {
  common: {
    name: "L\xE4hd\xF6t",
    description: "Seuraavat l\xE4hd\xF6t pys\xE4keilt\xE4, rautatieasemilta ja lentoasemilta",
    invalid_configuration: "Virheellinen konfiguraatio. Lis\xE4\xE4 v\xE4hint\xE4\xE4n yksi pys\xE4kkianturi.",
    no_entity: "Entiteetti\xE4 {entity} ei l\xF6ydy",
    not_departures: "{entity} ei ole pys\xE4kkianturi",
    unavailable: "L\xE4ht\xF6tiedot eiv\xE4t ole juuri nyt saatavilla",
    no_departures: "Ei tulevia l\xE4ht\xF6j\xE4",
    now: "Nyt",
    min: "min",
    cancelled: "Peruttu",
    track: "Raide",
    platform: "Laituri",
    gate: "Portti",
    realtime: "Reaaliaikainen arvio",
    departures: "L\xE4htev\xE4t",
    arrivals: "Saapuvat",
    no_arrivals: "Ei saapuvia",
    hall: "Aula",
    landed: "Laskeutunut",
    arrived: "Saapunut",
    departing: "L\xE4htev\xE4",
    arriving: "Saapuva",
    entity_unavailable: "{entity} ei ole juuri nyt saatavilla"
  },
  editor: {
    title: "Otsikko",
    entities: "Pys\xE4kit",
    entities_helper: "Pys\xE4kkianturit, kukin omana osionaan tai kaikki yhten\xE4 listana. Kadun molemmat puolet mahtuvat samaan korttiin.",
    entity: "Pys\xE4kkianturi",
    name: "Nimi",
    name_helper: "Korvaa pys\xE4kin oman nimen",
    subtitle: "Alaotsikko",
    subtitle_helper: "Esimerkiksi suunta, keskustaan p\xE4in. Ei k\xE4yt\xF6ss\xE4 yhten\xE4 listana.",
    departures: "N\xE4ytett\xE4vi\xE4 l\xE4ht\xF6j\xE4",
    departures_helper: "Pys\xE4kki\xE4 kohden, tai koko listassa, kun pys\xE4kit ovat yhten\xE4 listana",
    show_cancelled: "N\xE4yt\xE4 perutut l\xE4hd\xF6t",
    show_notices: "N\xE4yt\xE4 tiedotteet",
    show_notices_helper: "Rataty\xF6t ja muut koko pys\xE4kki\xE4 koskevat tiedotteet sen nimen alla",
    full_texts: "N\xE4yt\xE4 tekstit kokonaan",
    full_texts_helper: "Alaotsikko ja my\xF6hempien l\xE4ht\xF6jen tiedotteet rivitet\xE4\xE4n lyhent\xE4misen sijaan",
    combine: "N\xE4yt\xE4 yhten\xE4 listana",
    combine_helper: "Kaikkien pys\xE4kkien l\xE4hd\xF6t ja saapumiset yhdess\xE4 listassa aikaj\xE4rjestyksess\xE4"
  }
};

// src/localize/localize.ts
var FILES = { "./languages/en.json": en_default, "./languages/fi.json": fi_default };
var LANGUAGES = Object.fromEntries(
  Object.entries(FILES).map(([path, table]) => [path.replace(/^.*\/|\.json$/g, "").toLowerCase(), table])
);
var LANGUAGE_CODES = Object.keys(LANGUAGES).sort();
function translate(language, key) {
  const code = (language ?? "en").split(/[-_]/)[0].toLowerCase();
  return read(LANGUAGES[code], key) ?? read(LANGUAGES.en, key) ?? key;
}
function read(table, key) {
  let value = table;
  for (const part of key.split(".")) {
    if (value === null || typeof value !== "object") {
      return void 0;
    }
    value = value[part];
  }
  return typeof value === "string" ? value : void 0;
}
function browserLanguage() {
  return document.documentElement.lang || navigator.language || "en";
}

// src/editor.ts
var DEFAULTS = {
  departures: DEFAULT_DEPARTURES,
  show_cancelled: true,
  show_notices: true,
  full_texts: false,
  combine: false
};
function stopsSchema(hass, text) {
  return [
    { name: "title", selector: { text: {} } },
    {
      name: "entities",
      required: true,
      selector: {
        object: {
          multiple: true,
          label_field: "entity",
          description_field: "subtitle",
          fields: {
            entity: {
              label: text("editor.entity"),
              required: true,
              selector: { entity: { include_entities: departuresSensors(hass) } }
            },
            name: { label: text("editor.name"), description: text("editor.name_helper"), selector: { text: {} } },
            subtitle: { label: text("editor.subtitle"), description: text("editor.subtitle_helper"), selector: { text: {} } }
          }
        }
      }
    }
  ];
}
var OPTIONS_SCHEMA = [
  {
    type: "grid",
    name: "",
    schema: [
      { name: "departures", selector: { number: { min: 1, max: 20, step: 1, mode: "box" } } },
      { name: "show_cancelled", selector: { boolean: {} } },
      { name: "show_notices", selector: { boolean: {} } },
      { name: "full_texts", selector: { boolean: {} } },
      { name: "combine", selector: { boolean: {} } }
    ]
  }
];
function compactSections(sections) {
  return sectionsOf(sections).map((section) => {
    const entry = { entity: section.entity };
    if (section.name) {
      entry.name = section.name;
    }
    if (section.subtitle) {
      entry.subtitle = section.subtitle;
    }
    return entry.name || entry.subtitle ? entry : entry.entity;
  });
}
var DeparturesCardEditor = class extends i4 {
  constructor() {
    super(...arguments);
    this.config = { type: "custom:departures-card", entities: [] };
  }
  setConfig(config) {
    this.config = { ...config };
  }
  render() {
    if (!this.hass) {
      return A;
    }
    const data = { ...DEFAULTS, ...this.config, entities: sectionsOf(this.config.entities) };
    return b2`
            <ha-form
                .hass=${this.hass}
                .data=${data}
                .schema=${stopsSchema(this.hass, (key) => this.text(key))}
                .computeLabel=${(entry) => this.text(`editor.${entry.name}`)}
                @value-changed=${this.valueChanged}
            ></ha-form>
            <p class="helper">${this.text("editor.entities_helper")}</p>
            <ha-form
                .hass=${this.hass}
                .data=${data}
                .schema=${OPTIONS_SCHEMA}
                .computeLabel=${(entry) => this.text(`editor.${entry.name}`)}
                .computeHelper=${(entry) => this.helper(entry.name)}
                @value-changed=${this.valueChanged}
            ></ha-form>
        `;
  }
  static get styles() {
    return i`
            .helper {
                margin: 8px 0 16px;
                padding: 0 16px;
                font-size: 12px;
                line-height: 1.4;
                color: var(--secondary-text-color);
            }
        `;
  }
  valueChanged(event) {
    const config = { ...event.detail.value };
    config.entities = compactSections(config.entities ?? []);
    if (!config.title) {
      delete config.title;
    }
    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (config[key] === value || config[key] === void 0 || config[key] === null || config[key] === "") {
        delete config[key];
      }
    }
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
  text(key) {
    return translate(this.language(), key);
  }
  helper(name) {
    const key = `editor.${name}_helper`;
    const helper = translate(this.language(), key);
    return helper === key ? void 0 : helper;
  }
  language() {
    return this.hass?.locale?.language ?? this.hass?.language ?? browserLanguage();
  }
};
__decorateClass([
  n4({ attribute: false })
], DeparturesCardEditor.prototype, "hass", 2);
__decorateClass([
  r5()
], DeparturesCardEditor.prototype, "config", 2);
DeparturesCardEditor = __decorateClass([
  t3("departures-card-editor")
], DeparturesCardEditor);

// src/departures-card.ts
console.info(
  `%c  DEPARTURES-CARD 
%c  ${CARD_VERSION}    `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);
var registry = window;
registry.customCards = registry.customCards ?? [];
registry.customCards.push({
  type: "departures-card",
  name: translate(browserLanguage(), "common.name"),
  description: translate(browserLanguage(), "common.description"),
  documentationURL: "https://github.com/jesmak/departures-card",
  preview: true
});
var DeparturesCard = class extends i4 {
  constructor() {
    super(...arguments);
    this.resizes = new ResizeObserver(() => this.alignBadgesSoon());
  }
  static getConfigElement() {
    return document.createElement("departures-card-editor");
  }
  /** Offers the first departures sensor there is when the card is added from the picker. */
  static getStubConfig(hass) {
    return { entities: hass ? departuresSensors(hass).slice(0, 1) : [] };
  }
  setConfig(config) {
    const entities = typeof config?.entities === "string" ? [config.entities] : config?.entities;
    if (!config || !Array.isArray(entities) || sectionsOf(entities).length === 0) {
      throw new Error(translate(browserLanguage(), "common.invalid_configuration"));
    }
    this.config = { ...config, entities };
  }
  /** One list only from two different sensors or more: one sensor given twice has nothing to merge. */
  get combines() {
    return !!this.config?.combine && new Set(sectionsOf(this.config.entities).map((section) => section.entity)).size > 1;
  }
  getCardSize() {
    const sections = this.config && !this.combines ? sectionsOf(this.config.entities).length : 1;
    return 1 + sections * (2 + (this.config?.departures ?? DEFAULT_DEPARTURES));
  }
  /** In a sections view the card takes a whole section by default and is never narrower than half of one. */
  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }
  /** The countdowns run on between the sensor's updates, so the card redraws itself while it is on the page. */
  connectedCallback() {
    super.connectedCallback();
    this.requestUpdate();
    this.ticker = setInterval(() => this.requestUpdate(), TICK_MS);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.ticker);
    this.resizes.disconnect();
    cancelAnimationFrame(this.frame ?? 0);
  }
  updated() {
    if (!this.isConnected) {
      return;
    }
    const card = this.renderRoot.querySelector("ha-card");
    if (card) {
      this.resizes.observe(card);
    }
    this.alignBadgesSoon();
  }
  /**
   * A stop's later departures get badges as wide as its widest, so their destinations line up, as line names such as
   * AY907 and SK9709 differ in width. Measured after every render and every change in the card's size, on the next
   * frame and once however often it is asked. ha-card draws the slot the content sits in only after this card's
   * update, and until then nothing in it has a size. Measured afresh each time, so the badges can also get narrower.
   * A hidden card measures nothing and drops its widths, and measures again when it is shown, as its size changes.
   */
  alignBadgesSoon() {
    cancelAnimationFrame(this.frame ?? 0);
    this.frame = requestAnimationFrame(() => this.alignBadges());
  }
  alignBadges() {
    for (const rows of this.renderRoot.querySelectorAll(".rows")) {
      rows.style.removeProperty("--badge-width");
      const widths = [...rows.querySelectorAll(".badge")].map((badge) => parseFloat(getComputedStyle(badge).width) || 0);
      const widest = Math.ceil(Math.max(0, ...widths));
      if (widest > 0) {
        rows.style.setProperty("--badge-width", `${widest}px`);
      }
    }
  }
  shouldUpdate(changed) {
    const previous = changed.get("hass");
    if (changed.has("config") || !this.config || !changed.has("hass") || !previous) {
      return true;
    }
    return sectionsOf(this.config.entities).some(({ entity }) => previous.states[entity] !== this.hass?.states[entity]);
  }
  render() {
    if (!this.hass || !this.config) {
      return A;
    }
    const sections = sectionsOf(this.config.entities);
    const attributions = [
      ...new Set(sections.map(({ entity }) => this.hass?.states[entity]?.attributes?.attribution).filter((text) => !!text))
    ];
    return b2`
            <ha-card class=${this.config.full_texts ? "full" : ""}>
                ${this.config.title ? b2`<h1 class="card-title">${this.config.title}</h1>` : A}
                <div class="sections">${this.combines ? this.combined(sections) : sections.map((section) => this.section(section))}</div>
                ${attributions.length ? b2`<div class="attribution">${attributions.join(" \xB7 ")}</div>` : A}
            </ha-card>
        `;
  }
  section(section) {
    const entity = this.hass?.states[section.entity];
    const direction = statedDirection(entity);
    const subtitle = section.subtitle || (direction ? this.text(`common.${direction}`) : "");
    const heading = this.heading(this.stopName(section), subtitle, section.entity);
    const problem = this.problem(section.entity, false);
    if (problem || !entity) {
      return b2`<section>${heading}${problem}</section>`;
    }
    return this.list(heading, [entity], shownDepartures(section.entity, entity, false), direction === "arrivals");
  }
  /**
   * Every sensor as one list by time, each once however often it is listed. The heading names the stops it shows once
   * each, and their direction when they all state the same one; the sections' own subtitles belong to sections. A sensor
   * that can't be shown has a line of its own saying which and why. Rows say which way they go only when both
   * directions are in the list.
   */
  combined(sections) {
    const unique = sections.filter((section, index) => sections.findIndex((other) => other.entity === section.entity) === index);
    const problems = unique.map((section) => this.problem(section.entity, true));
    const shown = unique.flatMap((section, index) => {
      const entity = this.hass?.states[section.entity];
      return entity && !problems[index] ? [{ section, entity }] : [];
    });
    const entities = shown.map(({ entity }) => entity);
    const directions = new Set(entities.map((entity) => statedDirection(entity)));
    const [direction] = directions;
    const subtitle = directions.size === 1 && direction ? this.text(`common.${direction}`) : "";
    const names = [...new Set((shown.length ? shown.map(({ section }) => section) : unique).map((section) => this.stopName(section)))];
    const heading = this.heading(names.join(", "), subtitle, (shown[0]?.section ?? unique[0]).entity);
    const departures = shown.flatMap(({ section, entity }) => shownDepartures(section.entity, entity, true));
    const both = new Set(departures.map((departure) => departure.direction)).size > 1;
    if (!shown.length) {
      return b2`<section>${heading}${problems}</section>`;
    }
    return this.list(b2`${heading}${problems}`, entities, departures, directions.size === 1 && direction === "arrivals", both);
  }
  /** A stop's name: the section's own, the sensor's, or its entity id when it has neither. */
  stopName(section) {
    return section.name || this.hass?.states[section.entity]?.attributes?.stop_name || section.entity;
  }
  heading(name, subtitle, entityId) {
    return b2`
            <button class="heading" title="${entityId}" @click=${() => this.moreInfo(entityId)}>
                <span class="name">${name}</span>
                ${subtitle ? b2`<span class="subtitle">${subtitle}</span>` : A}
            </button>
        `;
  }
  /**
   * What is wrong with a sensor the card can't show, or nothing when it can. In one list the heading doesn't name every
   * sensor, so an unavailable one is named in its message, as a missing one always is.
   */
  problem(entityId, named) {
    const entity = this.hass?.states[entityId];
    if (!entity) {
      return b2`<div class="message">${this.text("common.no_entity", { entity: entityId })}</div>`;
    }
    if (entity.state === "unavailable") {
      const message = named ? this.text("common.entity_unavailable", { entity: entityId }) : this.text("common.unavailable");
      return b2`<div class="message">${message}</div>`;
    }
    if (!isDeparturesSensor(entity)) {
      return b2`<div class="message">${this.text("common.not_departures", { entity: entityId })}</div>`;
    }
    return void 0;
  }
  /** A section's notices, its next departure large and the rest as rows. `rowIcons` marks each row's direction. */
  list(heading, entities, departures, arrivals, rowIcons = false) {
    const notices = this.config?.show_notices === false ? [] : [...new Set(entities.flatMap((entity) => stopNotices(entity.attributes.notices)))];
    const { next, rest } = visibleDepartures(
      departures,
      Date.now(),
      this.config?.departures ?? DEFAULT_DEPARTURES,
      this.config?.show_cancelled !== false
    );
    return b2`
            <section>
                ${heading}
                ${notices.map(
      (notice) => b2`<div class="stop-notice"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${notice}</span></div>`
    )}
                ${next ? this.next(next) : A}
                ${rest.length ? b2`<div
                              class="rows ${rest.some((departure) => dayLabel(departure.estimated, Date.now(), this.language(), this.timeZone())) ? "with-days" : ""}"
                          >
                              ${c4(
      rest,
      (departure) => departure.key,
      (departure) => this.row(departure, rowIcons)
    )}
                          </div>` : A}
                ${!next && !rest.length ? b2`<div class="message">${this.text(arrivals ? "common.no_arrivals" : "common.no_departures")}</div>` : A}
            </section>
        `;
  }
  /** The next departure: what, where to, and how soon, with the live time, delay and platform under it. */
  next(departure) {
    const minutes = minutesUntil(departure.estimated, Date.now());
    const delay = delayMinutes(departure);
    const countdown = minutes === null ? this.when(departure.estimated) : minutes < 1 ? this.text("common.now") : b2`${minutes}<span class="unit"> ${this.text("common.min")}</span>`;
    return b2`
            <div class="next">
                ${this.badge(departure, "large")}
                <div class="next-text">
                    <div class="headsign">${this.directionIcon(departure)}${departure.headsign ?? ""}</div>
                    <div class="meta">
                        ${this.live(departure)}
                        ${delay !== 0 ? b2`<span class="struck">${this.when(departure.scheduled)}</span>` : A}
                        ${minutes !== null ? b2`<span>${this.when(departure.estimated)}</span>` : A} ${this.delay(delay)}
                        ${this.platform(departure)}
                    </div>
                    ${departure.notice ? b2`<div class="notice">${departure.notice}</div>` : A}
                </div>
                <div class="countdown">${countdown}</div>
            </div>
        `;
  }
  /**
   * A later departure on one line: its time, line and destination, and whatever is out of the ordinary. One that has
   * come in shows when, dimmed, and says so in its own words, as its source leaves that to the card, with its delay and
   * any other notice.
   */
  row(departure, icon) {
    const cancelled = !!departure.cancelled;
    const arrived = !cancelled && !!departure.arrived;
    const delay = delayMinutes(departure);
    let info;
    if (cancelled) {
      info = b2`<span class="alert" title="${departure.notice ?? ""}"
                >${[this.text("common.cancelled"), departure.notice].filter(Boolean).join(", ")}</span
            >`;
    } else if (arrived) {
      info = b2`${this.delay(delay)}
                <span class="arrived">${this.text(departure.mode === "plane" ? "common.landed" : "common.arrived")}</span>
                ${departure.notice ? b2`<span class="alert" title="${departure.notice}">${departure.notice}</span>` : A}
                ${this.platform(departure)}`;
    } else {
      info = b2`${this.delay(delay)}
            ${departure.notice ? b2`<span class="alert" title="${departure.notice}">${departure.notice}</span>` : A}
            ${this.platform(departure)}`;
    }
    return b2`
            <div class="row ${cancelled ? "cancelled" : ""} ${arrived ? "came-in" : ""}">
                <span class="time ${cancelled ? "struck" : ""}">${this.when(cancelled ? departure.scheduled : departure.estimated)}</span>
                ${this.badge(departure, "small")}
                <span class="headsign">${icon ? this.directionIcon(departure) : A}${departure.headsign ?? ""}</span>
                <span class="info">${info}</span>
            </div>
        `;
  }
  /** A plane's takeoff or landing in front of its destination or origin. Other modes have none yet. */
  directionIcon(departure) {
    if (departure.mode !== "plane") {
      return A;
    }
    const arriving = departure.direction === "arrivals";
    return b2`<ha-icon
            class="direction"
            icon=${arriving ? "mdi:airplane-landing" : "mdi:airplane-takeoff"}
            title=${this.text(arriving ? "common.arriving" : "common.departing")}
        ></ha-icon>`;
  }
  /** A cancelled departure's badge is an outline in the theme's own text colour, which every theme makes readable. */
  badge(departure, size) {
    if (departure.cancelled) {
      return b2`<span class="badge ${size} cancelled"><span class="line">${departure.line}</span></span>`;
    }
    const colors = badgeColors(departure);
    return b2`<span class="badge ${size}" style="background:${colors.background};color:${colors.text}"
            ><span class="line">${departure.line}</span></span
        >`;
  }
  live(departure) {
    return departure.realtime ? b2`<ha-icon class="live" icon="mdi:access-point" title="${this.text("common.realtime")}"></ha-icon>` : A;
  }
  delay(minutes) {
    if (minutes === 0) {
      return A;
    }
    return b2`<span class="${minutes > 0 ? "late" : "early"}"
            >${minutes > 0 ? "+" : "\u2212"}${Math.abs(minutes)} ${this.text("common.min")}</span
        >`;
  }
  /** A train leaves from a track, a plane from a gate and lands into a hall, everything else from a platform. */
  platform(departure) {
    if (!departure.platform) {
      return A;
    }
    const plane = departure.direction === "arrivals" ? "common.hall" : "common.gate";
    const label = this.text(departure.mode === "train" ? "common.track" : departure.mode === "plane" ? plane : "common.platform");
    return b2`<span class="platform">${label} ${departure.platform}</span>`;
  }
  /** A clock time, with its day in front when it isn't today: "ma 06.15". */
  when(time) {
    const day = dayLabel(time, Date.now(), this.language(), this.timeZone());
    return b2`${day ? b2`<span class="day">${day}</span> ` : A}${this.clock(time)}`;
  }
  timeZone() {
    return this.hass?.locale?.time_zone === "server" ? this.hass.config?.time_zone : void 0;
  }
  clock(time) {
    return clock(time, this.language(), this.timeZone());
  }
  moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }
  /** A text in the viewer's language, with `{name}` in it replaced, so a translation can put the value where it reads right. */
  text(key, values = {}) {
    return translate(this.language(), key).replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
  }
  language() {
    return this.hass?.locale?.language ?? this.hass?.language ?? browserLanguage();
  }
  static get styles() {
    return i`
            /* The card is the container its sections measure, so two stops sit side by side by the card's own width. */
            ha-card {
                container-type: inline-size;
                padding: 16px;
                font-variant-numeric: tabular-nums;
            }

            .card-title {
                margin: 0 0 12px;
                font-size: var(--ha-card-header-font-size, 24px);
                font-weight: var(--ha-font-weight-normal, 400);
                line-height: 1.2;
            }

            .sections {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
            }

            section + section {
                border-top: 1px solid var(--divider-color);
                margin-top: 14px;
                padding-top: 14px;
            }

            @container (min-width: 620px) {
                .sections:has(section + section) {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    column-gap: 32px;
                }

                section + section {
                    border-top: none;
                    margin-top: 0;
                    padding-top: 0;
                }

                section:nth-child(2n) {
                    border-left: 1px solid var(--divider-color);
                    margin-left: -16px;
                    padding-left: 16px;
                }

                section:nth-child(n + 3) {
                    border-top: 1px solid var(--divider-color);
                    margin-top: 14px;
                    padding-top: 14px;
                }
            }

            .heading {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                gap: 0 8px;
                min-width: 0;
                max-width: 100%;
                padding: 0;
                border: none;
                background: none;
                color: inherit;
                font: inherit;
                text-align: left;
                cursor: pointer;
            }

            .name {
                font-size: 14px;
                font-weight: var(--ha-font-weight-medium, 500);
                overflow-wrap: anywhere;
            }

            .subtitle,
            .message,
            .meta,
            .attribution,
            .platform {
                color: var(--secondary-text-color);
            }

            /* A secondary text, cut short unless full_texts asks for it whole. */
            .subtitle {
                min-width: 0;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .full .subtitle {
                white-space: normal;
                overflow-wrap: anywhere;
            }

            .message {
                padding: 8px 0 4px;
            }

            .next {
                display: flex;
                align-items: center;
                gap: 14px;
                margin-top: 10px;
            }

            .next-text {
                flex: 1;
                min-width: 0;
            }

            .next .headsign {
                font-size: 20px;
                font-weight: var(--ha-font-weight-medium, 500);
                line-height: 1.3;
            }

            .headsign {
                overflow-wrap: anywhere;
            }

            /* On a narrow card the large departure's destination takes a line of its own, under the badge and countdown. */
            @container (max-width: 399px) {
                .next {
                    flex-wrap: wrap;
                    row-gap: 6px;
                }

                .next-text {
                    order: 3;
                    flex-basis: 100%;
                }

                .countdown {
                    margin-left: auto;
                }
            }

            .meta {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 4px 6px;
                font-size: 13px;
            }

            .countdown {
                flex: none;
                font-size: 32px;
                font-weight: var(--ha-font-weight-bold, 700);
                line-height: 1.1;
                white-space: nowrap;
            }

            .unit {
                font-size: 16px;
                font-weight: var(--ha-font-weight-medium, 500);
            }

            /* A line known by a long name rather than a number wraps inside its badge at its spaces. A word never splits:
               the badge is at least as wide as its longest word, as a flight number cut in two reads as another flight. */
            .badge {
                flex: none;
                box-sizing: border-box;
                min-width: min-content;
                max-width: 40cqw;
                text-align: center;
                font-weight: var(--ha-font-weight-bold, 700);
                overflow-wrap: break-word;
            }

            .badge .line {
                display: inline-block;
                min-width: 24px;
            }

            .badge.large {
                padding: 6px 10px;
                border-radius: 10px;
                font-size: 18px;
            }

            .badge.small {
                padding: 1px 6px;
                border-radius: 8px;
                font-size: 13px;
            }

            .rows .badge.small {
                min-width: var(--badge-width, min-content);
            }

            .rows {
                margin-top: 12px;
                padding-top: 4px;
                border-top: 1px solid var(--divider-color);
            }

            /* A row stays on one line while its destination has room, and moves what doesn't fit to the next. */
            .row {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 2px 10px;
                padding: 5px 0;
                font-size: 14px;
            }

            .time {
                flex: none;
                min-width: 44px;
                font-weight: var(--ha-font-weight-bold, 700);
                white-space: nowrap;
            }

            /* The day in front of a time that isn't today: quieter than the time, but there. */
            .day {
                font-size: 0.75em;
                font-weight: var(--ha-font-weight-medium, 500);
                color: var(--secondary-text-color);
            }

            .rows.with-days .time {
                min-width: 72px;
            }

            /* Below 100 px the destination takes the next line, or a short one such as Pasila would sit squeezed between them. */
            .row .headsign {
                flex: 1 1 100px;
                min-width: 0;
            }

            .info {
                flex: 0 1 auto;
                min-width: 0;
                margin-left: auto;
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-end;
                align-items: center;
                gap: 2px 6px;
                font-size: 12px;
            }

            /* Numbers stay whole: a track cut short is another track. */
            .platform,
            .late,
            .early {
                white-space: nowrap;
            }

            .row.cancelled .headsign,
            .row.cancelled .time,
            .row.came-in .headsign,
            .row.came-in .time {
                color: var(--secondary-text-color);
            }

            /* A cancelled line's badge is a ring in the theme's own text colours, readable on any card, light or dark. */
            .badge.cancelled {
                background: none;
                color: var(--secondary-text-color);
                box-shadow: inset 0 0 0 2px var(--secondary-text-color);
            }

            .row.came-in .badge {
                opacity: 0.55;
            }

            /* One that has come in is good news, not a problem, so not in a notice's red. */
            .arrived {
                color: var(--success-color, #2e7d32);
                font-weight: var(--ha-font-weight-medium, 500);
            }

            /* Takeoff and landing are mirror images, so the icon is a size larger than the text around it. */
            .direction {
                --mdc-icon-size: 17px;
                width: 17px;
                height: 17px;
                display: inline-flex;
                vertical-align: -3px;
                margin-right: 4px;
                color: var(--secondary-text-color);
            }

            .next .direction {
                --mdc-icon-size: 21px;
                width: 21px;
                height: 21px;
            }

            .struck {
                text-decoration: line-through;
            }

            .live {
                --mdc-icon-size: 14px;
                width: 14px;
                height: 14px;
                display: inline-flex;
                color: var(--success-color, #2e7d32);
            }

            .late {
                color: var(--warning-color, #b45309);
                font-weight: var(--ha-font-weight-medium, 500);
            }

            .early {
                color: var(--success-color, #2e7d32);
                font-weight: var(--ha-font-weight-medium, 500);
            }

            .alert,
            .notice {
                color: var(--error-color, #c62828);
                font-weight: var(--ha-font-weight-medium, 500);
            }

            .notice {
                font-size: 13px;
            }

            /* A notice for the whole stop, such as track works, stays readable in full: cut short it says nothing. */
            .stop-notice {
                display: flex;
                align-items: flex-start;
                gap: 6px;
                margin-top: 8px;
                padding: 6px 8px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.35;
                color: var(--primary-text-color);
                background: rgba(var(--rgb-warning-color, 255, 166, 0), 0.12);
            }

            .stop-notice ha-icon {
                --mdc-icon-size: 16px;
                flex: none;
                width: 16px;
                height: 16px;
                margin-top: 1px;
                color: var(--warning-color, #b45309);
            }

            /* A row's notice is a secondary text, cut short unless full_texts asks for it whole. */
            .info .alert {
                min-width: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .full .info .alert {
                white-space: normal;
                overflow-wrap: anywhere;
            }

            .attribution {
                margin-top: 12px;
                font-size: 11px;
                text-align: right;
            }
        `;
  }
};
__decorateClass([
  n4({ attribute: false })
], DeparturesCard.prototype, "hass", 2);
__decorateClass([
  r5()
], DeparturesCard.prototype, "config", 2);
DeparturesCard = __decorateClass([
  t3("departures-card")
], DeparturesCard);
export {
  DeparturesCard
};
