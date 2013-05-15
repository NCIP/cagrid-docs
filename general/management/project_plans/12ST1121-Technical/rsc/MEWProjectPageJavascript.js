/*  Prototype JavaScript framework, version 1.6.0_rc1
 *  (c) 2005-2007 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {
  Version: '1.6.0_rc1',

  Browser: {
    IE:     !!(window.attachEvent && !window.opera),
    Opera:  !!window.opera,
    WebKit: navigator.userAgent.indexOf('AppleWebKit/') > -1,
    Gecko:  navigator.userAgent.indexOf('Gecko') > -1 && navigator.userAgent.indexOf('KHTML') == -1,
    MobileSafari: !!navigator.userAgent.match(/Apple.*Mobile.*Safari/)
  },

  BrowserFeatures: {
    XPath: !!document.evaluate,
    ElementExtensions: !!window.HTMLElement,
    SpecificElementExtensions:
      document.createElement('div').__proto__ !==
       document.createElement('form').__proto__
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },
  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;

if (Prototype.Browser.WebKit)
  Prototype.BrowserFeatures.XPath = false;

/* Based on Alex Arnell's inheritance implementation. */
var Class = {
  create: function() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      var subclass = function() { };
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0; i < properties.length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;

    return klass;
  }
};

Class.Methods = {
  addMethods: function(source) {
    var ancestor = this.superclass && this.superclass.prototype;

    for (var property in source) {
      var value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames().first() == "$super") {
        var method = value, value = Object.extend((function(m) {
          return function() { return ancestor[m].apply(this, arguments) };
        })(property).wrap(method), {
          valueOf:  function() { return method },
          toString: function() { return method.toString() }
        });
      }
      this.prototype[property] = value;
    }

    return this;
  }
};

var Abstract = { };

Object.extend = function(destination, source) {
  for (var property in source)
    destination[property] = source[property];
  return destination;
};

Object.extend(Object, {
  inspect: function(object) {
    try {
      if (object === undefined) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : object.toString();
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  },

  toJSON: function(object) {
    var type = typeof object;
    switch (type) {
      case 'undefined':
      case 'function':
      case 'unknown': return;
      case 'boolean': return object.toString();
    }

    if (object === null) return 'null';
    if (object.toJSON) return object.toJSON();
    if (Object.isElement(object)) return;

    var results = [];
    for (var property in object) {
      var value = Object.toJSON(object[property]);
      if (value !== undefined)
        results.push(property.toJSON() + ': ' + value);
    }

    return '{' + results.join(', ') + '}';
  },

  toQueryString: function(object) {
    return $H(object).toQueryString();
  },

  toHTML: function(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  },

  keys: function(object) {
    var keys = [];
    for (var property in object)
      keys.push(property);
    return keys;
  },

  values: function(object) {
    var values = [];
    for (var property in object)
      values.push(object[property]);
    return values;
  },

  clone: function(object) {
    return Object.extend({ }, object);
  },

  isElement: function(object) {
    return object && object.nodeType == 1;
  },

  isArray: function(object) {
    return object && object.constructor === Array;
  },

  isHash: function(object) {
    return object instanceof Hash;
  },

  isFunction: function(object) {
    return typeof object == "function";
  },

  isString: function(object) {
    return typeof object == "string";
  },

  isNumber: function(object) {
    return typeof object == "number";
  },

  isUndefined: function(object) {
    return typeof object == "undefined";
  }
});

Object.extend(Function.prototype, {
  argumentNames: function() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\((.*?)\)/)[1].split(",").invoke("strip");
    return names.length == 1 && !names[0] ? [] : names;
  },

  bind: function() {
    if (arguments.length < 2 && arguments[0] === undefined) return this;
    var __method = this, args = $A(arguments), object = args.shift();
    return function() {
      return __method.apply(object, args.concat($A(arguments)));
    }
  },

  bindAsEventListener: function() {
    var __method = this, args = $A(arguments), object = args.shift();
    return function(event) {
      return __method.apply(object, [event || window.event].concat(args));
    }
  },

  curry: function() {
    if (!arguments.length) return this;
    var __method = this, args = $A(arguments);
    return function() {
      return __method.apply(this, args.concat($A(arguments)));
    }
  },

  delay: function() {
    var __method = this, args = $A(arguments), timeout = args.shift() * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  },

  wrap: function(wrapper) {
    var __method = this;
    return function() {
      return wrapper.apply(this, [__method.bind(this)].concat($A(arguments)));
    }
  },

  methodize: function() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      return __method.apply(null, [this].concat($A(arguments)));
    };
  }
});

Function.prototype.defer = Function.prototype.delay.curry(0.01);

//Date.prototype.toJSON = function() {
//  return '"' + this.getUTCFullYear() + '-' +
//    (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
//    this.getUTCDate().toPaddedString(2) + 'T' +
//    this.getUTCHours().toPaddedString(2) + ':' +
//    this.getUTCMinutes().toPaddedString(2) + ':' +
//    this.getUTCSeconds().toPaddedString(2) + 'Z"';
//};

var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};

/*--------------------------------------------------------------------------*/

var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
      } finally {
        this.currentlyExecuting = false;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, {
  gsub: function(pattern, replacement) {
    var result = '', source = this, match;
    replacement = arguments.callee.prepareReplacement(replacement);

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  },

  sub: function(pattern, replacement, count) {
    replacement = this.gsub.prepareReplacement(replacement);
    count = count === undefined ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  },

  scan: function(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  },

  truncate: function(length, truncation) {
    length = length || 30;
    truncation = truncation === undefined ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  },

  strip: function() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  },

  stripTags: function() {
    return this.replace(/<\/?[^>]+>/gi, '');
  },

  stripScripts: function() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  },

  extractScripts: function() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img');
    var matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  },

  evalScripts: function() {
    return this.extractScripts().map(function(script) { return eval(script) });
  },

  escapeHTML: function() {
    var self = arguments.callee;
    self.text.data = this;
    return self.div.innerHTML;
  },

  unescapeHTML: function() {
    var div = new Element('div');
    div.innerHTML = this.stripTags();
    return div.childNodes[0] ? (div.childNodes.length > 1 ?
      $A(div.childNodes).inject('', function(memo, node) { return memo+node.nodeValue }) :
      div.childNodes[0].nodeValue) : '';
  },

  toQueryParams: function(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift());
        var value = pair.length > 1 ? pair.join('=') : pair[0];
        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  },

  toArray: function() {
    return this.split('');
  },

  succ: function() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  },

  times: function(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  },

  camelize: function() {
    var parts = this.split('-'), len = parts.length;
    if (len == 1) return parts[0];

    var camelized = this.charAt(0) == '-'
      ? parts[0].charAt(0).toUpperCase() + parts[0].substring(1)
      : parts[0];

    for (var i = 1; i < len; i++)
      camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);

    return camelized;
  },

  capitalize: function() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  },

  underscore: function() {
    return this.gsub(/::/, '/').gsub(/([A-Z]+)([A-Z][a-z])/,'#{1}_#{2}').gsub(/([a-z\d])([A-Z])/,'#{1}_#{2}').gsub(/-/,'_').toLowerCase();
  },

  dasherize: function() {
    return this.gsub(/_/,'-');
  },

  inspect: function(useDoubleQuotes) {
    var escapedString = this.gsub(/[\x00-\x1f\\]/, function(match) {
      var character = String.specialChar[match[0]];
      return character ? character : '\\u00' + match[0].charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  },

  toJSON: function() {
    return this.inspect(true);
  },

  unfilterJSON: function(filter) {
    return this.sub(filter || Prototype.JSONFilter, '#{1}');
  },

  isJSON: function() {
    var str = this.replace(/\\./g, '@').replace(/"[^"\\\n\r]*"/g, '');
    return (/^[,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]*$/).test(str);
  },

  evalJSON: function(sanitize) {
    var json = this.unfilterJSON();
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
//	console.log("Fehler: %s",json);
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  },

  include: function(pattern) {
    return this.indexOf(pattern) > -1;
  },

  startsWith: function(pattern) {
    return this.indexOf(pattern) === 0;
  },

  endsWith: function(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.lastIndexOf(pattern) === d;
  },

  empty: function() {
    return this == '';
  },

  blank: function() {
    return /^\s*$/.test(this);
  },

  interpolate: function(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }
});

if (Prototype.Browser.WebKit || Prototype.Browser.IE) Object.extend(String.prototype, {
  escapeHTML: function() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  unescapeHTML: function() {
    return this.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  }
});

String.prototype.gsub.prepareReplacement = function(replacement) {
  if (Object.isFunction(replacement)) return replacement;
  var template = new Template(replacement);
  return function(match) { return template.evaluate(match) };
};

String.prototype.parseQuery = String.prototype.toQueryParams;

Object.extend(String.prototype.escapeHTML, {
  div:  document.createElement('div'),
  text: document.createTextNode('')
});

with (String.prototype.escapeHTML) div.appendChild(text);

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return '';

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3];
      var pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/, match = pattern.exec(expr);
      if (match == null) return '';

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].gsub('\\\\]', ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    }.bind(this));
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = {
  each: function(iterator, context) {
    var index = 0;
    iterator = iterator.bind(context);
    try {
      this._each(function(value) {
        iterator(value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  },

  eachSlice: function(number, iterator, context) {
    iterator = iterator ? iterator.bind(context) : Prototype.K;
    var index = -number, slices = [], array = this.toArray();
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  },

  all: function(iterator, context) {
    iterator = iterator ? iterator.bind(context) : Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator(value, index);
      if (!result) throw $break;
    });
    return result;
  },

  any: function(iterator, context) {
    iterator = iterator ? iterator.bind(context) : Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator(value, index))
        throw $break;
    });
    return result;
  },

  collect: function(iterator, context) {
    iterator = iterator ? iterator.bind(context) : Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator(value, index));
    });
    return results;
  },

  detect: function(iterator, context) {
    iterator = iterator.bind(context);
    var result;
    this.each(function(value, index) {
      if (iterator(value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  },

  findAll: function(iterator, context) {
    iterator = iterator.bind(context);
    var results = [];
    this.each(function(value, index) {
      if (iterator(value, index))
        results.push(value);
    });
    return results;
  },

  grep: function(filter, iterator, context) {
    iterator = iterator ? iterator.bind(context) : Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(filter);

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator(value, index));
    });
    return results;
  },

  include: function(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  },

  inGroupsOf: function(number, fillWith) {
    fillWith = fillWith === undefined ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  },

  inject: function(memo, iterator, context) {
    iterator = iterator.bind(context);
    this.each(function(value, index) {
      memo = iterator(memo, value, index);
    });
    return memo;
  },

  invoke: function(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  },

  max: function(iterator, context) {
    iterator = iterator ? iterator.bind(context) : Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator(value, index);
      if (result == undefined || value >= result)
        result = value;
    });
    return result;
  },

  min: function(iterator, context) {
    iterator = iterator ? iterator.bind(context) : Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator(value, index);
      if (result == undefined || value < result)
        result = value;
    });
    return result;
  },

  partition: function(iterator, context) {
    iterator = iterator ? iterator.bind(context) : Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator(value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  },

  pluck: function(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  },

  reject: function(iterator, context) {
    iterator = iterator.bind(context);
    var results = [];
    this.each(function(value, index) {
      if (!iterator(value, index))
        results.push(value);
    });
    return results;
  },

  sortBy: function(iterator, context) {
    iterator = iterator.bind(context);
    return this.map(function(value, index) {
      return {value: value, criteria: iterator(value, index)};
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  },

  toArray: function() {
    return this.map();
  },

  zip: function() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  },

  size: function() {
    return this.toArray().length;
  },

  inspect: function() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }
};

Object.extend(Enumerable, {
  map:     Enumerable.collect,
  find:    Enumerable.detect,
  select:  Enumerable.findAll,
  filter:  Enumerable.findAll,
  member:  Enumerable.include,
  entries: Enumerable.toArray,
  every:   Enumerable.all,
  some:    Enumerable.any
});
function $A(iterable) {
  if (!iterable) return [];
  if (iterable.toArray) return iterable.toArray();
  var length = iterable.length, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}

if (Prototype.Browser.WebKit) {
  function $A(iterable) {
    if (!iterable) return [];
    if (!(Object.isFunction(iterable) && iterable == '[object NodeList]') &&
        iterable.toArray) return iterable.toArray();
    var length = iterable.length, results = new Array(length);
    while (length--) results[length] = iterable[length];
    return results;
  }
}

Array.from = $A;

Object.extend(Array.prototype, Enumerable);

if (!Array.prototype._reverse) Array.prototype._reverse = Array.prototype.reverse;

Object.extend(Array.prototype, {
  _each: function(iterator) {
    for (var i = 0, length = this.length; i < length; i++)
      iterator(this[i]);
  },

  clear: function() {
    this.length = 0;
    return this;
  },

  first: function() {
    return this[0];
  },

  last: function() {
    return this[this.length - 1];
  },

  compact: function() {
    return this.select(function(value) {
      return value != null;
    });
  },

  flatten: function() {
    return this.inject([], function(array, value) {
      return array.concat(Object.isArray(value) ?
        value.flatten() : [value]);
    });
  },

  without: function() {
    var values = $A(arguments);
    return this.select(function(value) {
      return !values.include(value);
    });
  },

  reverse: function(inline) {
    return (inline !== false ? this : this.toArray())._reverse();
  },

  reduce: function() {
    return this.length > 1 ? this : this[0];
  },

  uniq: function(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  },

  intersect: function(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  },

  clone: function() {
    return [].concat(this);
  },

  size: function() {
    return this.length;
  },

  inspect: function() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  },

  toJSON: function() {
    var results = [];
    this.each(function(object) {
      var value = Object.toJSON(object);
      if (value !== undefined) results.push(value);
    });
    return '[' + results.join(', ') + ']';
  }
});

// use native browser JS 1.6 implementation if available
if (Object.isFunction(Array.prototype.forEach))
  Array.prototype._each = Array.prototype.forEach;

if (!Array.prototype.indexOf) Array.prototype.indexOf = function(item, i) {
  i || (i = 0);
  var length = this.length;
  if (i < 0) i = length + i;
  for (; i < length; i++)
    if (this[i] === item) return i;
  return -1;
};

if (!Array.prototype.lastIndexOf) Array.prototype.lastIndexOf = function(item, i) {
  i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
  var n = this.slice(0, i).reverse().indexOf(item);
  return (n < 0) ? n : i - n - 1;
};

Array.prototype.toArray = Array.prototype.clone;

function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

if (Prototype.Browser.Opera){
  Array.prototype.concat = function() {
    var array = [];
    for (var i = 0, length = this.length; i < length; i++) array.push(this[i]);
    for (var i = 0, length = arguments.length; i < length; i++) {
      if (Object.isArray(arguments[i])) {
        for (var j = 0, arrayLength = arguments[i].length; j < arrayLength; j++)
          array.push(arguments[i][j]);
      } else {
        array.push(arguments[i]);
      }
    }
    return array;
  };
}
Object.extend(Number.prototype, {
  toColorPart: function() {
    return this.toPaddedString(2, 16);
  },

  succ: function() {
    return this + 1;
  },

  times: function(iterator) {
    $R(0, this, true).each(iterator);
    return this;
  },

  toPaddedString: function(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  },

  toJSON: function() {
    return isFinite(this) ? this.toString() : 'null';
  }
});

$w('abs round ceil floor').each(function(method){
  Number.prototype[method] = Math[method].methodize();
});
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {
  if (function() {
    var i = 0, Test = function(value) { this.key = value };
    Test.prototype.key = 'foo';
    for (var property in new Test('bar')) i++;
    return i > 1;
  }()) {
    function each(iterator) {
      var cache = [];
      for (var key in this._object) {
        var value = this._object[key];
        if (cache.include(key)) continue;
        cache.push(key);
        var pair = [key, value];
        pair.key = key;
        pair.value = value;
        iterator(pair);
      }
    }
  } else {
    function each(iterator) {
      for (var key in this._object) {
        var value = this._object[key], pair = [key, value];
        pair.key = key;
        pair.value = value;
        iterator(pair);
      }
    }
  }

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  return {
    initialize: function(object) {
      this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
    },

    _each: each,

    set: function(key, value) {
      return this._object[key] = value;
    },

    get: function(key) {
      return this._object[key];
    },

    unset: function(key) {
      var value = this._object[key];
      delete this._object[key];
      return value;
    },

    toObject: function() {
      return Object.clone(this._object);
    },

    keys: function() {
      return this.pluck('key');
    },

    values: function() {
      return this.pluck('value');
    },

    index: function(value) {
      var match = this.detect(function(pair) {
        return pair.value === value;
      });
      return match && match.key;
    },

    merge: function(object) {
      return this.clone().update(object);
    },

    update: function(object) {
      return new Hash(object).inject(this, function(result, pair) {
        result.set(pair.key, pair.value);
        return result;
      });
    },

    toQueryString: function() {
      return this.map(function(pair) {
        var key = encodeURIComponent(pair.key), values = pair.value;

        if (values && typeof values == 'object') {
          if (Object.isArray(values))
            return values.map(toQueryPair.curry(key)).join('&');
        }
        return toQueryPair(key, values);
      }).join('&');
    },

    inspect: function() {
      return '#<Hash:{' + this.map(function(pair) {
        return pair.map(Object.inspect).join(': ');
      }).join(', ') + '}>';
    },

    toJSON: function() {
      return Object.toJSON(this.toObject());
    },

    clone: function() {
      return new Hash(this);
    }
  }
})());

Hash.from = $H;
var ObjectRange = Class.create(Enumerable, {
  initialize: function(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  },

  _each: function(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  },

  include: function(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }
});

var $R = function(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
};

var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});

Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();
    if (Object.isString(this.options.parameters))
      this.options.parameters = this.options.parameters.toQueryParams();
  }
});

Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.clone(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      // simulate other verbs over post
      params['_method'] = this.method;
      this.method = 'post';
    }

    this.parameters = params;

    if (params = Object.toQueryString(params)) {
      // when GET, append parameters to URL
      if (this.method == 'get')
        this.url += (this.url.include('?') ? '&' : '?') + params;
      else if (/Konqueror|Safari|KHTML/.test(navigator.userAgent))
        params += '&_=';
    }

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    // user-defined headers
    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300);
  },

  getStatus: function() {
    try {
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
//		console.log("exception: %s\nresponseText: %s", e, response.responseText);
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      // avoid memory leak in MSIE: clean up
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name);
    } catch (e) { return null }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];

Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if(readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = xml === undefined ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,
  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    try {
      return json ? json.evalJSON(this.request.options.sanitizeJSON) : null;
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    try {
      if (options.evalJSON == 'force' || (options.evalJSON &&
          (this.getHeader('Content-type') || '').include('application/json')))
        return this.transport.responseText.evalJSON(options.sanitizeJSON);
      return null;
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = options || { };
    var onComplete = options.onComplete;
    options.onComplete = (function(response, param) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, param);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }

    if (this.success()) {
      if (this.onComplete) this.onComplete.bind(this).defer();
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});
function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!window.Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  // DOM level 2 ECMAScript Language Binding
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}

(function() {
  var element = this.Element;
  this.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;
    if (Prototype.Browser.IE && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }
    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));
    return Element.writeAttribute(cache[tagName].cloneNode(false), attributes);
  };
  Object.extend(this.Element, element || { });
}).call(window);

Element.cache = { };

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    $(element).style.display = 'none';
    return element;
  },

  show: function(element) {
    $(element).style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) return element.update().insert(content);
    content = Object.toHTML(content);
    element.innerHTML = content.stripScripts();
    content.evalScripts.bind(content).defer();
    return element;
  },

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, t, range;

    for (position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      t = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        t.insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      range = element.ownerDocument.createRange();
      t.initializeRange(element, range);
      t.insert(element, range.createContextualFragment(content.stripScripts()));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(), attribute = pair.last();
      var value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property) {
    element = $(element);
    var elements = [];
    while (element = element[property])
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
    return elements;
  },

  ancestors: function(element) {
    return $(element).recursivelyCollect('parentNode');
  },

  descendants: function(element) {
    return $A($(element).getElementsByTagName('*')).each(Element.extend);
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    if (!(element = $(element).firstChild)) return [];
    while (element && element.nodeType != 1) element = element.nextSibling;
    if (element) return [element].concat($(element).nextSiblings());
    return [];
  },

  previousSiblings: function(element) {
    return $(element).recursivelyCollect('previousSibling');
  },

  nextSiblings: function(element) {
    return $(element).recursivelyCollect('nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return element.previousSiblings().reverse().concat(element.nextSiblings());
  },

  match: function(element, selector) {
    if (Object.isString(selector))
      selector = new Selector(selector);
    return selector.match($(element));
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = element.ancestors();
    return expression ? Selector.findElement(ancestors, expression, index) :
      ancestors[index || 0];
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return element.firstDescendant();
    var descendants = element.descendants();
    return expression ? Selector.findElement(descendants, expression, index) :
      descendants[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(Selector.handlers.previousElementSibling(element));
    var previousSiblings = element.previousSiblings();
    return expression ? Selector.findElement(previousSiblings, expression, index) :
      previousSiblings[index || 0];
  },

  next: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(Selector.handlers.nextElementSibling(element));
    var nextSiblings = element.nextSiblings();
    return expression ? Selector.findElement(nextSiblings, expression, index) :
      nextSiblings[index || 0];
  },

  select: function() {
    var args = $A(arguments), element = $(args.shift());
    return Selector.findChildElements(element, args);
  },

  adjacent: function() {
    var args = $A(arguments), element = $(args.shift());
    return Selector.findChildElements(element.parentNode, args).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = element.readAttribute('id'), self = arguments.callee;
    if (id) return id;
    do { id = 'anonymous_element_' + self.counter++ } while ($(id));
    element.writeAttribute('id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = value === undefined ? true : value;

    for (var attr in attributes) {
      var name = t.names[attr] || attr, value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return $(element).getDimensions().height;
  },

  getWidth: function(element) {
    return $(element).getDimensions().width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      elementClassName.match(new RegExp("(^|\\s)" + className + "(\\s|$)"))));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!element.hasClassName(className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return element[element.hasClassName(className) ?
      'removeClassName' : 'addClassName'](className);
  },

  // removes whitespace-only text node children
  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);
    while (element = element.parentNode)
      if (element == ancestor) return true;
    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = element.cumulativeOffset();
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value) {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (elementStyle.styleFloat === undefined ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  getDimensions: function(element) {
    element = $(element);
    var display = $(element).getStyle('display');
    if (display != 'none' && display != null) // Safari bug
      return {width: element.offsetWidth, height: element.offsetHeight};

    // All *Width and *Height properties give 0 on elements with display none,
    // so enable the element temporarily
    var els = element.style;
    var originalVisibility = els.visibility;
    var originalPosition = els.position;
    var originalDisplay = els.display;
    els.visibility = 'hidden';
    els.position = 'absolute';
    els.display = 'block';
    var originalWidth = element.clientWidth;
    var originalHeight = element.clientHeight;
    els.display = originalDisplay;
    els.position = originalPosition;
    els.visibility = originalVisibility;
    return {width: originalWidth, height: originalHeight};
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      // Opera returns the offset relative to the positioning context, when an
      // element is position relative but top and left have not been defined
      if (window.opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  cumulativeOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  positionedOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (element.tagName == 'BODY') break;
        var p = Element.getStyle(element, 'position');
        if (p == 'relative' || p == 'absolute') break;
      }
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  absolutize: function(element) {
    element = $(element);
    if (element.getStyle('position') == 'absolute') return;
    // Position.prepare(); // To be done manually by Scripty when it needs it.

    var offsets = element.positionedOffset();
    var top     = offsets[1];
    var left    = offsets[0];
    var width   = element.clientWidth;
    var height  = element.clientHeight;

    element._originalLeft   = left - parseFloat(element.style.left  || 0);
    element._originalTop    = top  - parseFloat(element.style.top || 0);
    element._originalWidth  = element.style.width;
    element._originalHeight = element.style.height;

    element.style.position = 'absolute';
    element.style.top    = top + 'px';
    element.style.left   = left + 'px';
    element.style.width  = width + 'px';
    element.style.height = height + 'px';
    return element;
  },

  relativize: function(element) {
    element = $(element);
    if (element.getStyle('position') == 'relative') return;
    // Position.prepare(); // To be done manually by Scripty when it needs it.

    element.style.position = 'relative';
    var top  = parseFloat(element.style.top  || 0) - (element._originalTop || 0);
    var left = parseFloat(element.style.left || 0) - (element._originalLeft || 0);

    element.style.top    = top + 'px';
    element.style.left   = left + 'px';
    element.style.height = element._originalHeight;
    element.style.width  = element._originalWidth;
    return element;
  },

  cumulativeScrollOffset: function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return Element._returnOffset(valueL, valueT);
  },

  getOffsetParent: function(element) {
    if (element.offsetParent) return $(element.offsetParent);
    if (element == document.body) return $(element);

    while ((element = element.parentNode) && element != document.body)
      if (Element.getStyle(element, 'position') != 'static')
        return $(element);

    return $(document.body);
  },

  viewportOffset: function(forElement) {
    var valueT = 0, valueL = 0;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;

      // Safari fix
      if (element.offsetParent == document.body &&
        Element.getStyle(element, 'position') == 'absolute') break;

    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (!Prototype.Browser.Opera || element.tagName == 'BODY') {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);

    return Element._returnOffset(valueL, valueT);
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    // find page position of source
    source = $(source);
    var p = source.viewportOffset();

    // find coordinate system to use
    element = $(element);
    var delta = [0, 0];
    var parent = null;
    // delta [0,0] will do fine with position: fixed elements,
    // position:absolute needs offsetParent deltas
    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = element.getOffsetParent();
      delta = parent.viewportOffset();
    }

    // correct by body offsets (fixes Safari)
    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    // set position
    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Element.Methods.identify.counter = 1;

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,
  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};


if (!document.createRange || Prototype.Browser.Opera) {
  Element.Methods.insert = function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = { bottom: insertions };

    var t = Element._insertionTranslations, content, position, pos, tagName;

    for (position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      pos      = t[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        pos.insert(element, content);
        continue;
      }

      content = Object.toHTML(content);
      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      if (t.tags[tagName]) {
        var fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
        if (position == 'top' || position == 'after') fragments.reverse();
        fragments.each(pos.insert.curry(element));
      }
      else element.insertAdjacentHTML(pos.adjacency, content.stripScripts());

      content.evalScripts.bind(content).defer();
    }

    return element;
  };
}

if (Prototype.Browser.Opera) {
  Element.Methods._getStyle = Element.Methods.getStyle;
  Element.Methods.getStyle = function(element, style) {
    switch(style) {
      case 'left':
      case 'top':
      case 'right':
      case 'bottom':
        if (Element._getStyle(element, 'position') == 'static') return null;
      default: return Element._getStyle(element, style);
    }
  };
  Element.Methods._readAttribute = Element.Methods.readAttribute;
  Element.Methods.readAttribute = function(element, attribute) {
    if (attribute == 'title') return element.title;
    return Element._readAttribute(element, attribute);
  };
}

else if (Prototype.Browser.IE) {
  $w('positionedOffset getOffsetParent viewportOffset').each(function(method) {
    Element.Methods[method] = Element.Methods[method].wrap(
      function(proceed, element) {
        element = $(element);
        var position = element.getStyle('position');
        if (position != 'static') return proceed(element);
        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );
  });

  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    if (!element.currentStyle.hasLayout) element.style.zoom = 1;
    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = {
    read: {
      names: {
        'class': 'className',
        'for':   'htmlFor'
      },
      values: {
        _getAttr: function(element, attribute) {
          return element.getAttribute(attribute, 2);
        },
        _getAttrNode: function(element, attribute) {
          var node = element.getAttributeNode(attribute);
          return node ? node.value : "";
        },
        _getEv: function(element, attribute) {
          var attribute = element.getAttribute(attribute);
          return attribute ? attribute.toString().slice(23, -2) : null;
        },
        _flag: function(element, attribute) {
          return $(element).hasAttribute(attribute) ? attribute : null;
        },
        style: function(element) {
          return element.style.cssText.toLowerCase();
        },
        title: function(element) {
          return element.title;
        }
      }
    }
  };

  Element._attributeTranslations.write = {
    names: Object.clone(Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr,
      src:         v._getAttr,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);
}

else if (Prototype.Browser.Gecko) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if(element.tagName == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };

  // Safari returns margins on body which is incorrect if the child is absolutely
  // positioned.  For performance reasons, redefine Position.cumulativeOffset for
  // KHTML/WebKit only.
  Element.Methods.cumulativeOffset = function(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == document.body)
        if (Element.getStyle(element, 'position') == 'absolute') break;

      element = element.offsetParent;
    } while (element);

    return Element._returnOffset(valueL, valueT);
  };
}

if (Prototype.Browser.IE || Prototype.Browser.Opera) {
  // IE and Opera are missing .innerHTML support for TABLE-related and SELECT elements
  Element.Methods.update = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) return element.update().insert(content);

    content = Object.toHTML(content);
    var tagName = element.tagName.toUpperCase();

    if (tagName in Element._insertionTranslations.tags) {
      $A(element.childNodes).each(function(node) { element.removeChild(node) });
      Element._getContentFromAnonymousElement(tagName, content.stripScripts())
        .each(function(node) { element.appendChild(node) });
    }
    else element.innerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

if (document.createElement('div').outerHTML) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next();
      var fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html) {
  var div = new Element('div'), t = Element._insertionTranslations.tags[tagName];
  div.innerHTML = t[0] + html + t[1];
  t[2].times(function() { div = div.firstChild });
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: {
    adjacency: 'beforeBegin',
    insert: function(element, node) {
      element.parentNode.insertBefore(node, element);
    },
    initializeRange: function(element, range) {
      range.setStartBefore(element);
    }
  },
  top: {
    adjacency: 'afterBegin',
    insert: function(element, node) {
      element.insertBefore(node, element.firstChild);
    },
    initializeRange: function(element, range) {
      range.selectNodeContents(element);
      range.collapse(true);
    }
  },
  bottom: {
    adjacency: 'beforeEnd',
    insert: function(element, node) {
      element.appendChild(node);
    }
  },
  after: {
    adjacency: 'afterEnd',
    insert: function(element, node) {
      element.parentNode.insertBefore(node, element.nextSibling);
    },
    initializeRange: function(element, range) {
      range.setStartAfter(element);
    }
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  this.bottom.initializeRange = this.top.initializeRange;
  Object.extend(this.tags, {
    THEAD: this.tags.TBODY,
    TFOOT: this.tags.TBODY,
    TH:    this.tags.TD
  });
}).call(Element._insertionTranslations);

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return node && node.specified;
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

if (!Prototype.BrowserFeatures.ElementExtensions &&
    document.createElement('div').__proto__) {
  window.HTMLElement = { };
  window.HTMLElement.prototype = document.createElement('div').__proto__;
  Prototype.BrowserFeatures.ElementExtensions = true;
}

Element.extend = (function() {
  if (Prototype.BrowserFeatures.SpecificElementExtensions)
    return Prototype.K;

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || element._extendedByPrototype ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
      tagName = element.tagName, property, value;

    // extend methods for specific tags
    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    for (property in methods) {
      value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      // extend methods for all tags (Safari doesn't need this)
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

Element.hasAttribute = function(element, attribute) {
  if (element.hasAttribute) return element.hasAttribute(attribute);
  return Element.Methods.Simulated.hasAttribute(element, attribute);
};

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    window[klass] = { };
    window[klass].prototype = document.createElement(tagName).__proto__;
    return window[klass];
  }

  if (F.ElementExtensions) {
    copy(Element.Methods, HTMLElement.prototype);
    copy(Element.Methods.Simulated, HTMLElement.prototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};

document.viewport = {
  getDimensions: function() {
    var dimensions = { };
    $w('width height').each(function(d) {
      var D = d.capitalize();
      dimensions[d] = self['inner' + D] ||
       (document.documentElement['client' + D] || document.body['client' + D]);
    });
    return dimensions;
  },

  getWidth: function() {
    return this.getDimensions().width;
  },

  getHeight: function() {
    return this.getDimensions().height;
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop);
  }
};
/* Portions of the Selector class are derived from Jack Slocum’s DomQuery,
 * part of YUI-Ext version 0.40, distributed under the terms of an MIT-style
 * license.  Please see http://www.yui-ext.com/ for more information. */

var Selector = Class.create({
  initialize: function(expression) {
    this.expression = expression.strip();
    this.compileMatcher();
  },

  compileMatcher: function() {
    // Selectors with namespaced attributes can't use the XPath version
    if (Prototype.BrowserFeatures.XPath && !(/(\[[\w-]*?:|:checked)/).test(this.expression))
      return this.compileXPathMatcher();

    var e = this.expression, ps = Selector.patterns, h = Selector.handlers,
        c = Selector.criteria, le, p, m;

    if (Selector._cache[e]) {
      this.matcher = Selector._cache[e];
      return;
    }

    this.matcher = ["this.matcher = function(root) {",
                    "var r = root, h = Selector.handlers, c = false, n;"];

    while (e && le != e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        p = ps[i];
        if (m = e.match(p)) {
          this.matcher.push(Object.isFunction(c[i]) ? c[i](m) :
    	      new Template(c[i]).evaluate(m));
          e = e.replace(m[0], '');
          break;
        }
      }
    }

    this.matcher.push("return h.unique(n);\n}");
    eval(this.matcher.join('\n'));
    Selector._cache[this.expression] = this.matcher;
  },

  compileXPathMatcher: function() {
    var e = this.expression, ps = Selector.patterns,
        x = Selector.xpath, le, m;

    if (Selector._cache[e]) {
      this.xpath = Selector._cache[e]; return;
    }

    this.matcher = ['.//*'];
    while (e && le != e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        if (m = e.match(ps[i])) {
          this.matcher.push(Object.isFunction(x[i]) ? x[i](m) :
            new Template(x[i]).evaluate(m));
          e = e.replace(m[0], '');
          break;
        }
      }
    }

    this.xpath = this.matcher.join('');
    Selector._cache[this.expression] = this.xpath;
  },

  findElements: function(root) {
    root = root || document;
    if (this.xpath) return document._getElementsByXPath(this.xpath, root);
    return this.matcher(root);
  },

  match: function(element) {
    this.tokens = [];

    var e = this.expression, ps = Selector.patterns, as = Selector.assertions;
    var le, p, m;

    while (e && le !== e && (/\S/).test(e)) {
      le = e;
      for (var i in ps) {
        p = ps[i];
        if (m = e.match(p)) {
          // use the Selector.assertions methods unless the selector
          // is too complex.
          if (as[i]) {
            this.tokens.push([i, Object.clone(m)]);
            e = e.replace(m[0], '');
          } else {
            // reluctantly do a document-wide search
            // and look for a match in the array
            return this.findElements(document).include(element);
          }
        }
      }
    }

    var match = true, name, matches;
    for (var i = 0, token; token = this.tokens[i]; i++) {
      name = token[0], matches = token[1];
      if (!Selector.assertions[name](element, matches)) {
        match = false; break;
      }
    }

    return match;
  },

  toString: function() {
    return this.expression;
  },

  inspect: function() {
    return "#<Selector:" + this.expression.inspect() + ">";
  }
});

Object.extend(Selector, {
  _cache: { },

  xpath: {
    descendant:   "//*",
    child:        "/*",
    adjacent:     "/following-sibling::*[1]",
    laterSibling: '/following-sibling::*',
    tagName:      function(m) {
      if (m[1] == '*') return '';
      return "[local-name()='" + m[1].toLowerCase() +
             "' or local-name()='" + m[1].toUpperCase() + "']";
    },
    className:    "[contains(concat(' ', @class, ' '), ' #{1} ')]",
    id:           "[@id='#{1}']",
    attrPresence: "[@#{1}]",
    attr: function(m) {
      m[3] = m[5] || m[6];
      return new Template(Selector.xpath.operators[m[2]]).evaluate(m);
    },
    pseudo: function(m) {
      var h = Selector.xpath.pseudos[m[1]];
      if (!h) return '';
      if (Object.isFunction(h)) return h(m);
      return new Template(Selector.xpath.pseudos[m[1]]).evaluate(m);
    },
    operators: {
      '=':  "[@#{1}='#{3}']",
      '!=': "[@#{1}!='#{3}']",
      '^=': "[starts-with(@#{1}, '#{3}')]",
      '$=': "[substring(@#{1}, (string-length(@#{1}) - string-length('#{3}') + 1))='#{3}']",
      '*=': "[contains(@#{1}, '#{3}')]",
      '~=': "[contains(concat(' ', @#{1}, ' '), ' #{3} ')]",
      '|=': "[contains(concat('-', @#{1}, '-'), '-#{3}-')]"
    },
    pseudos: {
      'first-child': '[not(preceding-sibling::*)]',
      'last-child':  '[not(following-sibling::*)]',
      'only-child':  '[not(preceding-sibling::* or following-sibling::*)]',
      'empty':       "[count(*) = 0 and (count(text()) = 0 or translate(text(), ' \t\r\n', '') = '')]",
      'checked':     "[@checked]",
      'disabled':    "[@disabled]",
      'enabled':     "[not(@disabled)]",
      'not': function(m) {
        var e = m[6], p = Selector.patterns,
            x = Selector.xpath, le, m, v;

        var exclusion = [];
        while (e && le != e && (/\S/).test(e)) {
          le = e;
          for (var i in p) {
            if (m = e.match(p[i])) {
              v = Object.isFunction(x[i]) ? x[i](m) : new Template(x[i]).evaluate(m);
              exclusion.push("(" + v.substring(1, v.length - 1) + ")");
              e = e.replace(m[0], '');
              break;
            }
          }
        }
        return "[not(" + exclusion.join(" and ") + ")]";
      },
      'nth-child':      function(m) {
        return Selector.xpath.pseudos.nth("(count(./preceding-sibling::*) + 1) ", m);
      },
      'nth-last-child': function(m) {
        return Selector.xpath.pseudos.nth("(count(./following-sibling::*) + 1) ", m);
      },
      'nth-of-type':    function(m) {
        return Selector.xpath.pseudos.nth("position() ", m);
      },
      'nth-last-of-type': function(m) {
        return Selector.xpath.pseudos.nth("(last() + 1 - position()) ", m);
      },
      'first-of-type':  function(m) {
        m[6] = "1"; return Selector.xpath.pseudos['nth-of-type'](m);
      },
      'last-of-type':   function(m) {
        m[6] = "1"; return Selector.xpath.pseudos['nth-last-of-type'](m);
      },
      'only-of-type':   function(m) {
        var p = Selector.xpath.pseudos; return p['first-of-type'](m) + p['last-of-type'](m);
      },
      nth: function(fragment, m) {
        var mm, formula = m[6], predicate;
        if (formula == 'even') formula = '2n+0';
        if (formula == 'odd')  formula = '2n+1';
        if (mm = formula.match(/^(\d+)$/)) // digit only
          return '[' + fragment + "= " + mm[1] + ']';
        if (mm = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) { // an+b
          if (mm[1] == "-") mm[1] = -1;
          var a = mm[1] ? Number(mm[1]) : 1;
          var b = mm[2] ? Number(mm[2]) : 0;
          predicate = "[((#{fragment} - #{b}) mod #{a} = 0) and " +
          "((#{fragment} - #{b}) div #{a} >= 0)]";
          return new Template(predicate).evaluate({
            fragment: fragment, a: a, b: b });
        }
      }
    }
  },

  criteria: {
    tagName:      'n = h.tagName(n, r, "#{1}", c);   c = false;',
    className:    'n = h.className(n, r, "#{1}", c); c = false;',
    id:           'n = h.id(n, r, "#{1}", c);        c = false;',
    attrPresence: 'n = h.attrPresence(n, r, "#{1}"); c = false;',
    attr: function(m) {
      m[3] = (m[5] || m[6]);
      return new Template('n = h.attr(n, r, "#{1}", "#{3}", "#{2}"); c = false;').evaluate(m);
    },
    pseudo: function(m) {
      if (m[6]) m[6] = m[6].replace(/"/g, '\\"');
      return new Template('n = h.pseudo(n, "#{1}", "#{6}", r, c); c = false;').evaluate(m);
    },
    descendant:   'c = "descendant";',
    child:        'c = "child";',
    adjacent:     'c = "adjacent";',
    laterSibling: 'c = "laterSibling";'
  },

  patterns: {
    // combinators must be listed first
    // (and descendant needs to be last combinator)
    laterSibling: /^\s*~\s*/,
    child:        /^\s*>\s*/,
    adjacent:     /^\s*\+\s*/,
    descendant:   /^\s/,

    // selectors follow
    tagName:      /^\s*(\*|[\w\-]+)(\b|$)?/,
    id:           /^#([\w\-\*]+)(\b|$)/,
    className:    /^\.([\w\-\*]+)(\b|$)/,
    pseudo:       /^:((first|last|nth|nth-last|only)(-child|-of-type)|empty|checked|(en|dis)abled|not)(\((.*?)\))?(\b|$|(?=\s)|(?=:))/,
    attrPresence: /^\[([\w]+)\]/,
    attr:         /\[((?:[\w-]*:)?[\w-]+)\s*(?:([!^$*~|]?=)\s*((['"])([^\4]*?)\4|([^'"][^\]]*?)))?\]/
  },

  // for Selector.match and Element#match
  assertions: {
    tagName: function(element, matches) {
      return matches[1].toUpperCase() == element.tagName.toUpperCase();
    },

    className: function(element, matches) {
      return Element.hasClassName(element, matches[1]);
    },

    id: function(element, matches) {
      return element.id === matches[1];
    },

    attrPresence: function(element, matches) {
      return Element.hasAttribute(element, matches[1]);
    },

    attr: function(element, matches) {
      var nodeValue = Element.readAttribute(element, matches[1]);
      return Selector.operators[matches[2]](nodeValue, matches[3]);
    }
  },

  handlers: {
    // UTILITY FUNCTIONS
    // joins two collections
    concat: function(a, b) {
      for (var i = 0, node; node = b[i]; i++)
        a.push(node);
      return a;
    },

    // marks an array of nodes for counting
    mark: function(nodes) {
      for (var i = 0, node; node = nodes[i]; i++)
        node._counted = true;
      return nodes;
    },

    unmark: function(nodes) {
      for (var i = 0, node; node = nodes[i]; i++)
        node._counted = undefined;
      return nodes;
    },

    // mark each child node with its position (for nth calls)
    // "ofType" flag indicates whether we're indexing for nth-of-type
    // rather than nth-child
    index: function(parentNode, reverse, ofType) {
      parentNode._counted = true;
      if (reverse) {
        for (var nodes = parentNode.childNodes, i = nodes.length - 1, j = 1; i >= 0; i--) {
          var node = nodes[i];
          if (node.nodeType == 1 && (!ofType || node._counted)) node.nodeIndex = j++;
        }
      } else {
        for (var i = 0, j = 1, nodes = parentNode.childNodes; node = nodes[i]; i++)
          if (node.nodeType == 1 && (!ofType || node._counted)) node.nodeIndex = j++;
      }
    },

    // filters out duplicates and extends all nodes
    unique: function(nodes) {
      if (nodes.length == 0) return nodes;
      var results = [], n;
      for (var i = 0, l = nodes.length; i < l; i++)
        if (!(n = nodes[i])._counted) {
          n._counted = true;
          results.push(Element.extend(n));
        }
      return Selector.handlers.unmark(results);
    },

    // COMBINATOR FUNCTIONS
    descendant: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        h.concat(results, node.getElementsByTagName('*'));
      return results;
    },

    child: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        for (var j = 0, children = [], child; child = node.childNodes[j]; j++)
          if (child.nodeType == 1 && child.tagName != '!') results.push(child);
      }
      return results;
    },

    adjacent: function(nodes) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        var next = this.nextElementSibling(node);
        if (next) results.push(next);
      }
      return results;
    },

    laterSibling: function(nodes) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        h.concat(results, Element.nextSiblings(node));
      return results;
    },

    nextElementSibling: function(node) {
      while (node = node.nextSibling)
	      if (node.nodeType == 1) return node;
      return null;
    },

    previousElementSibling: function(node) {
      while (node = node.previousSibling)
        if (node.nodeType == 1) return node;
      return null;
    },

    // TOKEN FUNCTIONS
    tagName: function(nodes, root, tagName, combinator) {
      tagName = tagName.toUpperCase();
      var results = [], h = Selector.handlers;
      if (nodes) {
        if (combinator) {
          // fastlane for ordinary descendant combinators
          if (combinator == "descendant") {
            for (var i = 0, node; node = nodes[i]; i++)
              h.concat(results, node.getElementsByTagName(tagName));
            return results;
          } else nodes = this[combinator](nodes);
          if (tagName == "*") return nodes;
        }
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName.toUpperCase() == tagName) results.push(node);
        return results;
      } else return root.getElementsByTagName(tagName);
    },

    id: function(nodes, root, id, combinator) {
      var targetNode = $(id), h = Selector.handlers;
      if (!targetNode) return [];
      if (!nodes && root == document) return [targetNode];
      if (nodes) {
        if (combinator) {
          if (combinator == 'child') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (targetNode.parentNode == node) return [targetNode];
          } else if (combinator == 'descendant') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (Element.descendantOf(targetNode, node)) return [targetNode];
          } else if (combinator == 'adjacent') {
            for (var i = 0, node; node = nodes[i]; i++)
              if (Selector.handlers.previousElementSibling(targetNode) == node)
                return [targetNode];
          } else nodes = h[combinator](nodes);
        }
        for (var i = 0, node; node = nodes[i]; i++)
          if (node == targetNode) return [targetNode];
        return [];
      }
      return (targetNode && Element.descendantOf(targetNode, root)) ? [targetNode] : [];
    },

    className: function(nodes, root, className, combinator) {
      if (nodes && combinator) nodes = this[combinator](nodes);
      return Selector.handlers.byClassName(nodes, root, className);
    },

    byClassName: function(nodes, root, className) {
      if (!nodes) nodes = Selector.handlers.descendant([root]);
      var needle = ' ' + className + ' ';
      for (var i = 0, results = [], node, nodeClassName; node = nodes[i]; i++) {
        nodeClassName = node.className;
        if (nodeClassName.length == 0) continue;
        if (nodeClassName == className || (' ' + nodeClassName + ' ').include(needle))
          results.push(node);
      }
      return results;
    },

    attrPresence: function(nodes, root, attr) {
      var results = [];
      for (var i = 0, node; node = nodes[i]; i++)
        if (Element.hasAttribute(node, attr)) results.push(node);
      return results;
    },

    attr: function(nodes, root, attr, value, operator) {
      if (!nodes) nodes = root.getElementsByTagName("*");
      var handler = Selector.operators[operator], results = [];
      for (var i = 0, node; node = nodes[i]; i++) {
        var nodeValue = Element.readAttribute(node, attr);
        if (nodeValue === null) continue;
        if (handler(nodeValue, value)) results.push(node);
      }
      return results;
    },

    pseudo: function(nodes, name, value, root, combinator) {
      if (nodes && combinator) nodes = this[combinator](nodes);
      if (!nodes) nodes = root.getElementsByTagName("*");
      return Selector.pseudos[name](nodes, value, root);
    }
  },

  pseudos: {
    'first-child': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (Selector.handlers.previousElementSibling(node)) continue;
          results.push(node);
      }
      return results;
    },
    'last-child': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        if (Selector.handlers.nextElementSibling(node)) continue;
          results.push(node);
      }
      return results;
    },
    'only-child': function(nodes, value, root) {
      var h = Selector.handlers;
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!h.previousElementSibling(node) && !h.nextElementSibling(node))
          results.push(node);
      return results;
    },
    'nth-child':        function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root);
    },
    'nth-last-child':   function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, true);
    },
    'nth-of-type':      function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, false, true);
    },
    'nth-last-of-type': function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, formula, root, true, true);
    },
    'first-of-type':    function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, "1", root, false, true);
    },
    'last-of-type':     function(nodes, formula, root) {
      return Selector.pseudos.nth(nodes, "1", root, true, true);
    },
    'only-of-type':     function(nodes, formula, root) {
      var p = Selector.pseudos;
      return p['last-of-type'](p['first-of-type'](nodes, formula, root), formula, root);
    },

    // handles the an+b logic
    getIndices: function(a, b, total) {
      if (a == 0) return b > 0 ? [b] : [];
      return $R(1, total).inject([], function(memo, i) {
        if (0 == (i - b) % a && (i - b) / a >= 0) memo.push(i);
        return memo;
      });
    },

    // handles nth(-last)-child, nth(-last)-of-type, and (first|last)-of-type
    nth: function(nodes, formula, root, reverse, ofType) {
      if (nodes.length == 0) return [];
      if (formula == 'even') formula = '2n+0';
      if (formula == 'odd')  formula = '2n+1';
      var h = Selector.handlers, results = [], indexed = [], m;
      h.mark(nodes);
      for (var i = 0, node; node = nodes[i]; i++) {
        if (!node.parentNode._counted) {
          h.index(node.parentNode, reverse, ofType);
          indexed.push(node.parentNode);
        }
      }
      if (formula.match(/^\d+$/)) { // just a number
        formula = Number(formula);
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.nodeIndex == formula) results.push(node);
      } else if (m = formula.match(/^(-?\d*)?n(([+-])(\d+))?/)) { // an+b
        if (m[1] == "-") m[1] = -1;
        var a = m[1] ? Number(m[1]) : 1;
        var b = m[2] ? Number(m[2]) : 0;
        var indices = Selector.pseudos.getIndices(a, b, nodes.length);
        for (var i = 0, node, l = indices.length; node = nodes[i]; i++) {
          for (var j = 0; j < l; j++)
            if (node.nodeIndex == indices[j]) results.push(node);
        }
      }
      h.unmark(nodes);
      h.unmark(indexed);
      return results;
    },

    'empty': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++) {
        // IE treats comments as element nodes
        if (node.tagName == '!' || (node.firstChild && !node.innerHTML.match(/^\s*$/))) continue;
        results.push(node);
      }
      return results;
    },

    'not': function(nodes, selector, root) {
      var h = Selector.handlers, selectorType, m;
      var exclusions = new Selector(selector).findElements(root);
      h.mark(exclusions);
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!node._counted) results.push(node);
      h.unmark(exclusions);
      return results;
    },

    'enabled': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (!node.disabled) results.push(node);
      return results;
    },

    'disabled': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (node.disabled) results.push(node);
      return results;
    },

    'checked': function(nodes, value, root) {
      for (var i = 0, results = [], node; node = nodes[i]; i++)
        if (node.checked) results.push(node);
      return results;
    }
  },

  operators: {
    '=':  function(nv, v) { return nv == v; },
    '!=': function(nv, v) { return nv != v; },
    '^=': function(nv, v) { return nv.startsWith(v); },
    '$=': function(nv, v) { return nv.endsWith(v); },
    '*=': function(nv, v) { return nv.include(v); },
    '~=': function(nv, v) { return (' ' + nv + ' ').include(' ' + v + ' '); },
    '|=': function(nv, v) { return ('-' + nv.toUpperCase() + '-').include('-' + v.toUpperCase() + '-'); }
  },

  matchElements: function(elements, expression) {
    var matches = new Selector(expression).findElements(), h = Selector.handlers;
    h.mark(matches);
    for (var i = 0, results = [], element; element = elements[i]; i++)
      if (element._counted) results.push(element);
    h.unmark(matches);
    return results;
  },

  findElement: function(elements, expression, index) {
    if (Object.isNumber(expression)) {
      index = expression; expression = false;
    }
    return Selector.matchElements(elements, expression || '*')[index || 0];
  },

  findChildElements: function(element, expressions) {
    var exprs = expressions.join(','), expressions = [];
    exprs.scan(/(([\w#:.~>+()\s-]+|\*|\[.*?\])+)\s*(,|$)/, function(m) {
      expressions.push(m[1].strip());
    });
    var results = [], h = Selector.handlers;
    for (var i = 0, l = expressions.length, selector; i < l; i++) {
      selector = new Selector(expressions[i].strip());
      h.concat(results, selector.findElements(element));
    }
    return (l > 1) ? h.unique(results) : results;
  }
});

function $$() {
  return Selector.findChildElements(document, $A(arguments));
}
var Form = {
  reset: function(form) {
    $(form).reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (options.hash === undefined) options.hash = true;
    var key, value, submitted = false, submit = options.submit;

    var data = elements.inject({ }, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          if (key in result) {
            // a key is already present; construct an array of values
            if (!Object.isArray(result[key])) result[key] = [result[key]];
            result[key].push(value);
          }
          else result[key] = value;
        }
      }
      return result;
    });

    return options.hash ? data : Object.toQueryString(data);
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    return $A($(form).getElementsByTagName('*')).inject([],
      function(elements, child) {
        if (Form.Element.Serializers[child.tagName.toLowerCase()])
          elements.push(Element.extend(child));
        return elements;
      }
    );
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return ['input', 'select', 'textarea'].include(element.tagName.toLowerCase());
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    form.findFirstElement().activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/

Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {
  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !['button', 'reset', 'submit'].include(element.type)))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.blur();
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;
var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = {
  input: function(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return Form.Element.Serializers.inputSelector(element, value);
      default:
        return Form.Element.Serializers.textarea(element, value);
    }
  },

  inputSelector: function(element, value) {
    if (value === undefined) return element.checked ? element.value : null;
    else element.checked = !!value;
  },

  textarea: function(element, value) {
    if (value === undefined) return element.value;
    else element.value = value;
  },

  select: function(element, index) {
    if (index === undefined)
      return this[element.type == 'select-one' ?
        'selectOne' : 'selectMany'](element);
    else {
      var opt, value, single = !Object.isArray(index);
      for (var i = 0, length = element.length; i < length; i++) {
        opt = element.options[i];
        value = this.optionValue(opt);
        if (single) {
          if (value == index) {
            opt.selected = true;
            return;
          }
        }
        else opt.selected = index.include(value);
      }
    }
  },

  selectOne: function(element) {
    var index = element.selectedIndex;
    return index >= 0 ? this.optionValue(element.options[index]) : null;
  },

  selectMany: function(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(this.optionValue(opt));
    }
    return values;
  },

  optionValue: function(opt) {
    // extend element because hasAttribute may not be native
    return Element.extend(opt).hasAttribute('value') ? opt.value : opt.text;
  }
};

/*--------------------------------------------------------------------------*/

Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
if (!window.Event) var Event = { };

Object.extend(Event, {
  KEY_BACKSPACE: 8,
  KEY_TAB:       9,
  KEY_RETURN:   13,
  KEY_ESC:      27,
  KEY_LEFT:     37,
  KEY_UP:       38,
  KEY_RIGHT:    39,
  KEY_DOWN:     40,
  KEY_DELETE:   46,
  KEY_HOME:     36,
  KEY_END:      35,
  KEY_PAGEUP:   33,
  KEY_PAGEDOWN: 34,
  KEY_INSERT:   45,

  cache: { },

  relatedTarget: function(event) {
    var element;
    switch(event.type) {
      case 'mouseover': element = event.fromElement; break;
      case 'mouseout':  element = event.toElement;   break;
      default: return null;
    }
    return Element.extend(element);
  }
});

Event.Methods = (function() {
  if (Prototype.Browser.IE) {
    function isButton(event, code) {
      return event.button == ({ 0: 1, 1: 4, 2: 2 })[code];
    }

  } else if (Prototype.Browser.WebKit) {
    function isButton(event, code) {
      switch (code) {
        case 0: return event.which == 1 && !event.metaKey;
        case 1: return event.which == 1 && event.metaKey;
        default: return false;
      }
    }

  } else {
    function isButton(event, code) {
      return event.which ? (event.which === code + 1) : (event.button === code);
    }
  }

  return {
    isLeftClick:   function(event) { return isButton(event, 0) },
    isMiddleClick: function(event) { return isButton(event, 1) },
    isRightClick:  function(event) { return isButton(event, 2) },

    element: function(event) {
      var node = Event.extend(event).target;
      return Element.extend(node.nodeType == Node.TEXT_NODE ? node.parentNode : node);
    },

    findElement: function(event, expression) {
      var element = Event.element(event);
      return element.match(expression) ? element : element.up(expression);
    },

    pointer: function(event) {
      return {
        x: event.pageX || (event.clientX +
          (document.documentElement.scrollLeft || document.body.scrollLeft)),
        y: event.pageY || (event.clientY +
          (document.documentElement.scrollTop || document.body.scrollTop))
      };
    },

    pointerX: function(event) { return Event.pointer(event).x },
    pointerY: function(event) { return Event.pointer(event).y },

    stop: function(event) {
      Event.extend(event);
      event.preventDefault();
      event.stopPropagation();
    }
  };
})();

Event.extend = (function() {
  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (Prototype.Browser.IE) {
    Object.extend(methods, {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return "[object Event]" }
    });

    return function(event) {
      if (!event) return false;
      if (event._extendedByPrototype) return event;

      event._extendedByPrototype = Prototype.emptyFunction;
      var pointer = Event.pointer(event);
      Object.extend(event, {
        target: event.srcElement,
        relatedTarget: Event.relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });
      return Object.extend(event, methods);
    };

  } else {
    Event.prototype = Event.prototype || document.createEvent("HTMLEvents").__proto__;
    Object.extend(Event.prototype, methods);
    return Prototype.K;
  }
})();

Object.extend(Event, (function() {
  var cache = Event.cache;

  function getEventID(element) {
    if (element._eventID) return element._eventID;
    arguments.callee.id = arguments.callee.id || 1;
    return element._eventID = ++arguments.callee.id;
  }

  function getDOMEventName(eventName) {
    if (eventName && eventName.match(/:/)) return "dataavailable";
    return eventName;
  }

  function getCacheForID(id) {
    return cache[id] = cache[id] || { };
  }

  function getWrappersForEventName(id, eventName) {
    var c = getCacheForID(id);
    return c[eventName] = c[eventName] || [];
  }

  function createWrapper(element, eventName, handler) {
    var id = getEventID(element);
    var c = getWrappersForEventName(id, eventName);
    if (c.pluck("handler").include(handler)) return false;

    var wrapper = function(event) {
      if (event.eventName && event.eventName != eventName)
        return false;

      Event.extend(event);
      handler.call(element, event)
    };

    wrapper.handler = handler;
    c.push(wrapper);
    return wrapper;
  }

  function findWrapper(id, eventName, handler) {
    var c = getWrappersForEventName(id, eventName);
    return c.find(function(wrapper) { return wrapper.handler == handler });
  }

  function destroyWrapper(id, eventName, handler) {
    var c = getCacheForID(id);
    if (!c[eventName]) return false;
    c[eventName] = c[eventName].without(findWrapper(id, eventName, handler));
  }

  function destroyCache() {
    for (var id in cache)
      for (var eventName in cache[id])
        cache[id][eventName] = null;
  }

  if (window.attachEvent) {
    window.attachEvent("onunload", destroyCache);
  }

  return {
    observe: function(element, eventName, handler) {
      element = $(element);
      var name = getDOMEventName(eventName);

      var wrapper = createWrapper(element, eventName, handler);
      if (!wrapper) return element;

      if (element.addEventListener) {
        element.addEventListener(name, wrapper, false);
      } else {
        element.attachEvent("on" + name, wrapper);
      }

      return element;
    },

    stopObserving: function(element, eventName, handler) {
      element = $(element);
      var id = getEventID(element), name = getDOMEventName(eventName);

      if (!handler && eventName) {
        getWrappersForEventName(id, eventName).each(function(wrapper) {
          element.stopObserving(eventName, wrapper.handler);
        });
        return element;

      } else if (!eventName) {
        Object.keys(getCacheForID(id)).each(function(eventName) {
          element.stopObserving(eventName);
        });
        return element;
      }

      var wrapper = findWrapper(id, eventName, handler);
      if (!wrapper) return element;

      if (element.removeEventListener) {
        element.removeEventListener(name, wrapper, false);
      } else {
        element.detachEvent("on" + name, wrapper);
      }

      destroyWrapper(id, eventName, handler);

      return element;
    },

    fire: function(element, eventName, memo) {
      element = $(element);
      if (element == document && document.createEvent && !element.dispatchEvent)
        element = document.documentElement;

      if (document.createEvent) {
        var event = document.createEvent("HTMLEvents");
        event.initEvent("dataavailable", true, true);
      } else {
        var event = document.createEventObject();
        event.eventType = "ondataavailable";
      }

      event.eventName = eventName;
      event.memo = memo || { };

      if (document.createEvent) {
        element.dispatchEvent(event);
      } else {
        element.fireEvent(event.eventType, event);
      }

      return event;
    }
  };
})());

Object.extend(Event, Event.Methods);

Element.addMethods({
  fire:          Event.fire,
  observe:       Event.observe,
  stopObserving: Event.stopObserving
});

Object.extend(document, {
  fire:          Element.Methods.fire.methodize(),
  observe:       Element.Methods.observe.methodize(),
  stopObserving: Element.Methods.stopObserving.methodize()
});

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards and John Resig. */

  var timer, fired = false;

  function fireContentLoadedEvent() {
    if (fired) return;
    if (timer) window.clearInterval(timer);
    document.fire("dom:loaded");
    fired = true;
  }

  if (document.addEventListener) {
    if (Prototype.Browser.WebKit) {
      timer = window.setInterval(function() {
        if (/loaded|complete/.test(document.readyState))
          fireContentLoadedEvent();
      }, 0);

      Event.observe(window, "load", fireContentLoadedEvent);

    } else {
      document.addEventListener("DOMContentLoaded",
        fireContentLoadedEvent, false);
    }

  } else {
    document.write("<script id=__onDOMContentLoaded defer src=//:><\/script>");
    $("__onDOMContentLoaded").onreadystatechange = function() {
      if (this.readyState == "complete") {
        this.onreadystatechange = null;
        fireContentLoadedEvent();
      }
    };
  }
})();
/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

// This should be moved to script.aculo.us; notice the deprecated methods
// further below, that map to the newer Element methods.
var Position = {
  // set to true if needed, warning: firefox performance problems
  // NOT neeeded for page scrolling, only if draggable contained in
  // scrollable elements
  includeScrollOffsets: false,

  // must be called before calling withinIncludingScrolloffset, every time the
  // page is scrolled
  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  // caches x/y coordinate pair to use with overlap
  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  // within must be called directly before
  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },

  // Deprecation layer -- use newer Element methods now (1.5.2).

  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

Element.addMethods();// Copyright 2008 ProjectWizards GmbH. All rights reserved.

var WRLSnapshotURIKey						= "uri";

var WRLCleartextToManyRelationshipType		= "many";
var WRLCleartextToOneRelationshipType		= "one";
var WRLCleartextDateAttributeType			= "date";
var WRLCleartextInteger16AttributeType		= "integer16";
var WRLCleartextInteger32AttributeType		= "integer32";
var WRLCleartextInteger64AttributeType		= "integer64";
var WRLCleartextDecimalAttributeType		= "decimal";
var WRLCleartextDoubleAttributeType			= "double";
var WRLCleartextFloatAttributeType			= "float";
var WRLCleartextUndefinedAttributeType		= "undefined";
var WRLCleartextNullifyDeleteRule			= "nullify";
var WRLCleartextCascadeDeleteRule			= "cascade";

var WRLEntityClassNameKey					= "className";
var WRLEntityJSClassNameKey					= "jsClassName";
var WRLObserverKey							= "observer";
var WRLContextKey							= "context";
var WRLEntityKey							= "entity";
var WRLAjaxContextChangedByServerNotification	= "ManagedObjectContextChangedByServer";
var WRLSynchronizeErrorKey					= "error";
var NSLocalizedDescriptionKey				= "NSLocalizedDescriptionKey";
var NSLocalizedRecoverySuggestionErrorKey	= "NSLocalizedRecoverySuggestionErrorKey";

var WRLSynchronizeChangedKey				= "changed";
var WRLSynchronizeDeletedKey				= "deleted";
var WRLSynchronizeAddedKey					= "added";

var WRLJSONNullString						= "null";
var WRLJSONTrueString						= "true";
var WRLJSONValidatedString					= "validated";

var WRLEntityFormValueKey					= "entity";
var WRLPredicateFormValueKey				= "predicate";
var WRLURIsFormValueKey						= "objectURIs";
var WRLRelationshipFormValueKey				= "relationshipKey";
var WRLRecoveryOptionFormValueKey			= "recoveryOption";
var WRLKeyFormValueKey						= "key";
var WRLValueFormValueKey					= "value";
var WRLActionNameFormValueKey				= "action";
var WRLLocalizedRecoveryOptions				= "localizedRecoveryOptions";

var WRLFetchObjectsWithURIsActionName 		= "fetchObjectsWithURIs";
var WRLFetchModelActionName 				= "fetchModel";
var WRLForgetObjectsActionName 				= "forgetObjects";
var WRLValidateActionName 					= "validate";
var WRLRecoverFromValidationErrorActionName	= "recoverFromValidationError";
var WRLSaveActionName 						= "save";
var WRLUndoActionName 						= "undo";
var WRLRedoActionName 						= "redo";
var WRLFetchDirectActionName	   			= "fetch";
var WRLSynchronizeDirectActionName 			= "synchronize";

var Base = function() {
	if (arguments.length) {
		if (this == window) {
			Base.prototype.extend.call(arguments[0], arguments.callee.prototype);
		} else {
			this.extend(arguments[0]);
		}
	}
};
Base.version = "1.0.2";
Base.prototype = {
extend: function(source, value) {
	var extend = Base.prototype.extend;
	if (arguments.length == 2) {
		var ancestor = this[source];
		if ((ancestor instanceof Function) && (value instanceof Function) &&
			ancestor.valueOf() != value.valueOf() && /\bbase\b/.test(value)) {
			var method = value;
			value = function() {
				var previous = this.base;
				this.base = ancestor;
				var returnValue = method.apply(this, arguments);
				this.base = previous;
				return returnValue;
			};
			value.valueOf = function() {
				return method;
			};
			value.toString = function() {
				return String(method);
			};
		}
		return this[source] = value;
	} else if (source) {
		var _prototype = {toSource: null};
		var _protected = ["toString", "valueOf"];
		if (Base._prototyping) _protected[2] = "constructor";
		for (var i = 0; (name = _protected[i]); i++) {
			if (source[name] != _prototype[name]) {
				extend.call(this, name, source[name]);
			}
		}
		for (var name in source) {
			if (!_prototype[name]) {
				extend.call(this, name, source[name]);
			}
		}
	}
	return this;
},
base: function() {
}
};

Base.extend = function(_instance, _static) {
	var extend = Base.prototype.extend;
	if (!_instance) _instance = {};
	Base._prototyping = true;
	var _prototype = new this;
	extend.call(_prototype, _instance);
	var constructor = _prototype.constructor;
	_prototype.constructor = this;
	delete Base._prototyping;
	var klass = function() {
		if (!Base._prototyping) constructor.apply(this, arguments);
		this.constructor = klass;
	};
	klass.prototype = _prototype;
	klass.extend = this.extend;
	klass.implement = this.implement;
	klass.toString = function() {
		return String(constructor);
	};
	extend.call(klass, _static);
	var object = constructor ? klass : _prototype;
	if (object.init instanceof Function) object.init();
	return object;
};

Base.implement = function(_interface) {
	if (_interface instanceof Function) _interface = _interface.prototype;
	this.prototype.extend(_interface);
};

var WRLFetchRequest = Base.extend({
	constructor: function(entityName, predicate)
	{
		this.base();
		this.entityName = entityName;
		this.predicate = predicate;
	}

});


var WRLObject = Base.extend({
	constructor: function()
	{
	},

	willChangeValueForKey: function(key)
	{	
	},

	didChangeValueForKey: function(key)
	{
		if(this.observedKeys)
		{
			var keyObservers = this.observedKeys[key];
			if(keyObservers && keyObservers.length)
			{
				var value = this.valueForKey(key);
				for(var i=0; i<keyObservers.length; i++)
				{
					var info = keyObservers[i];
					info.observer.observerValueForKeyOfObject.call(info.observer, value, key, this, info.context);
				}
			}
		}
	},

	valueForKey: function(key)
	{
		var value = this[key];
		if(typeof value == "function")	
			value = value.call(this);
		return value;
	},

	valueForKeyPath: function(keyPath)
	{
		var index = keyPath.indexOf(".");
		if(index == -1)
			return this.valueForKey(keyPath);
		else
		{
			var firstKey = keyPath.substring(0, index);
			var value = this.valueForKey(firstKey);
			return value ? value.valueForKeyPath(keyPath.substring(index+1)) : null;
		}
	},

	setValueForKey: function(value, key)
	{
		this.willChangeValueForKey(key);
		this[key] = value;
		this.didChangeValueForKey(key);
	},

	setValueForKeyPath: function(value, keyPath)
	{
		this.willChangeValueForKey(key);
		var index = keyPath.indexOf(".");
		if(index == -1)
			this.setValueForKey(value, keyPath);
		else
		{
			var firstKey = keyPath.substring(0, index);
			var value = this.valueForKey(firstKey);
			if(value)
				value.setValueForKeyPath(value, keyPath.substring(index+1));
		}
		this.didChangeValueForKey(key);
	},

	addObserverForKey: function(observer, key, context)
	{
		if(!this.observedKeys)
			this.observedKeys = {};
		var keyObservers = this.observedKeys[key];
		if(!keyObservers)
		{
			keyObservers = [];
			this.observedKeys[key] = keyObservers;
		}
		var info = new WRLObject();
		info.setValueForKey(observer, WRLObserverKey);
		info.setValueForKey(context, WRLContextKey);
		if(keyObservers.valueForKey(WRLObserverKey).indexOf(observer) == -1)
			keyObservers.push(info);
	},

	removeObserverForKey: function(observer, key)
	{
		if(this.observedKeys)
		{
			var keyObservers = this.observedKeys[key];
			for(var i=0; i<keyObservers.length; i++)
			{
				var info = keyObservers[i];
				if(info.observer == observer)
				{
					this.observedKeys[key] = keyObservers.without(info);
					break;
				}
			}
		}
	},


	addObserverForKeyPath: function(observer, keyPath, context)
	{
		var index = keyPath.indexOf(".");
		if(index == -1)
			this.addObserverForKey(observer, keyPath, context);
		else
		{
			var firstKey = keyPath.substring(0, index);
			var value = this.valueForKey(firstKey);
			if(value)
				value.addObserverForKey(observer, keyPath.substring(index+1), context);
		}
	},

	removeObserverForKeyPath: function(observer, keyPath)
	{
		var index = keyPath.indexOf(".");
		if(index == -1)
			this.removeObserverForKey(observer, keyPath);
		else
		{
			var firstKey = keyPath.substring(0, index);
			var value = this.valueForKey(firstKey);
			if(value)
				value.removeObserverForKey(observer, keyPath.substring(index+1));
		}
	}


});

Array.prototype.valueForKey = function(key)
{
	var result = new Array();
	for(var i=0; i<this.length; i++)
		result[i] = this[i].valueForKey(key);
	return result;
}

Array.prototype.valueForKeyPath = function(key)
{
	var result = new Array();
	for(var i=0; i<this.length; i++)
		result[i] = this[i].valueForKeyPath(key);
	return result;
}


var WRLManagedObject = WRLObject.extend({
	constructor: function(context, objectID, properties)
	{
		this.base();
		this.objectID = objectID;
		this.createEmptyProperties();
		this.context = context;
		this.isFault = !properties;
		this.setProperties(properties);
		this.changedPropertiesAndTheirSnapshotValues = {};
		this.modificationDate = new Date();
	},

	storeID: function()
	{
		if(this.objectID && this.objectID.uri)
			return this.objectID.uri.split("/")[0];
		return null;
	},

	sortValueForKey: function(key)
	{
		return this.valueForKey(key);
	},

	createEmptyProperties: function()
	{
		var propertiesDict = this.objectID.entity.properties;
		this.properties = {};
		for(key in propertiesDict)
		{
			var description = propertiesDict[key];
			var type = description.type;
			if(type == WRLCleartextToManyRelationshipType)
				this.properties[key] = [];
		}
	},

	descriptionForProperty: function(property)
	{
		return this.objectID.entity.properties[property];
	},

	className: function()
	{
		if(this.objectID && this.objectID.entity && this.objectID.entity.className)
			return this.objectID.entity.className;
		return "WRLManagedObject";
	},

	entityName: function()
	{
		if(this.objectID && this.objectID.entity && this.objectID.entity.name)
			return this.objectID.entity.name;
		return "";
	},

	willAccessValueForKey: function(key)
	{
		if(this.isFault) {
			this.context.fetchObjectWithURI(this.objectID.uri);
		}
	},

	didChangeValueForKey: function(key)
	{
		this.base(key);
		this.modificationDate = new Date();
		this.context.modificationDate = this.modificationDate;
	},

	valueForKey: function(key)
	{
		this.willAccessValueForKey(key);
		var value = this[key];
		if(typeof value == "function")
			value = value.call(this);
		else if(!value)
			value = this.properties[key];
		if(value instanceof Array && value.length>0 && value[0].isFault) {
			value = this.context.fetchRelationshipInObject(key, this);				//ak warum wurde der Rückgabewert nicht dem value zugewiesen?
		}
		return value;
	},

	isAddedObject: function() {
		return this.context.isAddedObject(this);
	},

	removeObjectFromRelationship: function(object, relationName)
	{
		var description = this.descriptionForProperty(relationName);
		if(description.type == WRLCleartextToManyRelationshipType)
		{
			var collection = this.valueForKey(relationName);
			var newCollection = collection.without(object);
			this.setValueForKey(newCollection, relationName, true);
		}
		else
			this.setValueForKey(null, relationName, true);	
	},

	addObjectToRelationship: function(object, relationName)
	{
		var description = this.descriptionForProperty(relationName);
		if(description.type == WRLCleartextToManyRelationshipType)
		{
			var collection = this.valueForKey(relationName);
			if(collection.indexOf(object) == -1)
			{
				var newCollection = collection.clone();
				newCollection.push(object);
				this.setValueForKey(newCollection, relationName, true);
			}
		}
		else
			this.setValueForKey(object, relationName, true);		
	},

	setValueForKey: function(value, key, dontResolveInverse)
	{
		this.willChangeValueForKey(key);
		if(!this.changedPropertiesAndTheirSnapshotValues[key])
		{
			this.changedPropertiesAndTheirSnapshotValues[key] = this.valueForKey(key);
			if(!this.isAddedObject())
				this.context.addChangedObject(this);
		}
		var description = this.descriptionForProperty(key);
		if(!dontResolveInverse && description && (description.type == WRLCleartextToOneRelationshipType || description.type == WRLCleartextToManyRelationshipType))
		{
			var inverseKey = description.inverse;
			if(inverseKey)
			{	
				if(description.type == WRLCleartextToManyRelationshipType)
				{
					var unchangedObjects = []; 
					var relatedObjects = this.valueForKey(key);
					if(relatedObjects)
					{
						for(var i=0; i<relatedObjects.length; i++)
						{
							var relatedObject = relatedObjects[i];
							if(value.indexOf(relatedObject) == -1)
								relatedObject.removeObjectFromRelationship(this, inverseKey);
							else
								unchangedObjects.push(relatedObject);
						}
					}
					if(value)
					{
						for(var k=0; k<value.length; k++)
						{
							var relatedObject = value[k];
							if(unchangedObjects.indexOf(relatedObject) == -1)
								relatedObject.addObjectToRelationship(this, inverseKey);
						}
					}
				}
				else	// to one relationship
				{
					var relatedObject = this.valueForKey(key);
					if(relatedObject)
						relatedObject.removeObjectFromRelationship(this, inverseKey);
					if(value)
						value.addObjectToRelationship(this, inverseKey)
				}
			}
		}
		var setter = "set-"+key;
		setter = setter.camelize();
		var property = this[setter];
		if(typeof property == "function")
			property.call(this, value);
		else if(!property)
			this.properties[key] = value;
		this.didChangeValueForKey(key);
	},

	createValueForPropertyFromJSON: function(key, value)
	{
		var model = this.context.objectModel();
		var entity = this.objectID.entity;
		var type = entity.properties[key].type;
		if(type == WRLCleartextToOneRelationshipType)
			value = value ? this.context.registeredObjectWithURIString(value, true) : null;			
		else if(type == WRLCleartextToManyRelationshipType){
			if(value && value.length){
				var newValue = [];
				for(var i=0; i<value.length; i++)
					newValue.push(this.context.registeredObjectWithURIString(value[i], true));
				value = newValue;
			}
		}
		else if(type == WRLCleartextDateAttributeType){
			var milliseconds = 1000*value;
			value = value ? new Date(milliseconds) : null;
		}else if(type == WRLCleartextInteger16AttributeType || type == WRLCleartextInteger32AttributeType || type == WRLCleartextInteger64AttributeType || type == WRLCleartextDoubleAttributeType || type == WRLCleartextFloatAttributeType || type == WRLCleartextDecimalAttributeType)
			value = new Number(value);
		else if(type == WRLCleartextUndefinedAttributeType){
			var prop = entity.properties[key];
			var customClass = prop[WRLEntityClassNameKey];
			if(!customClass)
				customClass = prop[WRLEntityJSClassNameKey];
			value = (customClass && value) ? new window[customClass](value) : null;
		}
		return value;
	},

	setProperties: function(properties, useSetValueForKey, alwaysOverwrite)
	{
		if(properties)
			this.isFault = false;
		var model = this.context.objectModel();
		var entity = this.objectID.entity;
		for(var key in properties){
			var value = properties[key];		
			var type = entity.properties[key].type;
			if(type == WRLCleartextToOneRelationshipType){
				value = value ? this.context.registeredObjectWithURIString(value, true) : null;			
			}else if(type == WRLCleartextToManyRelationshipType){
				if(value && value.length){
					var newValue = [];
					for(var i=0; i<value.length; i++)
						newValue.push(this.context.registeredObjectWithURIString(value[i], true));
					value = newValue;
				}
			}
			else if(type == WRLCleartextDateAttributeType){
				var milliseconds = 1000*value;
				value = value ? new Date(milliseconds) : null;
			}else if(type == WRLCleartextInteger16AttributeType || type == WRLCleartextInteger32AttributeType || type == WRLCleartextInteger64AttributeType || type == WRLCleartextDoubleAttributeType || type == WRLCleartextFloatAttributeType || type == WRLCleartextDecimalAttributeType)
				value = new Number(value);
			else if(type == WRLCleartextUndefinedAttributeType){
				var prop = entity.properties[key];
				var customClass = prop[WRLEntityClassNameKey];
				if(!customClass)
					customClass = prop[WRLEntityJSClassNameKey];
				if(customClass && value){
					if(window[customClass])
						value = new window[customClass](value);
					else{
	//					console.log("missing javascript class: '%s'", customClass);
					}
				}else
					value = null;
			}
			if(alwaysOverwrite || this.valueForKey(key) != value){
				if(useSetValueForKey)
					this.setValueForKey(value, key);
				else
				{
					this.willChangeValueForKey(key);
					this.properties[key] = value;
					this.didChangeValueForKey(key);
				}
			}
		}
	},

	changedProperties: function()
	{
		var result = null;
		for(var key in this.changedPropertiesAndTheirSnapshotValues)
		{
			var description = this.descriptionForProperty(key);
			var type = description.type;
			var value = this.valueForKey(key);
			if(type == WRLCleartextToManyRelationshipType || type == WRLCleartextToOneRelationshipType)
				value = this.valueForKeyPath(key+".objectID.uri");
			if(!result)
				result = {};
			result[key] = value;
		}
		return result;
	},

	clearChangedProperties: function()
	{
		this.changedPropertiesAndTheirSnapshotValues = {};
	},

	validateValueForKey: function(value, key) 
	{
		var result;
		var opt = {};
		var propertyDescription = this.objectID.entity.properties[key];
		if(value)
		{
			if(propertyDescription.type == WRLCleartextToOneRelationshipType)
				value = value.objectID.uri;
			else if(propertyDescription.type == WRLCleartextToManyRelationshipType)
			{
				var newValue = [];
				for(var i=0; i<value.length; i++) 
				{
					newValue.push(value[i].objectID.uri);
				}
				value = newValue;
			}
		}
		var jsonValue = Object.toJSON(value);
		opt.parameters = {action:WRLValidateActionName, key:key, value:jsonValue};
		opt.parameters[WRLSnapshotURIKey] = this.objectID.uri;
		opt.asynchronous = false;
		var request = new Ajax.Request(this.context.requestURL, opt);
		try 
		{
			result = eval("("+request.transport.responseText+")");
			if(result.value)
				result.value = this.createValueForPropertyFromJSON(key, result.value);
		} catch (e) 
		{
			result = {validated:false, value:null, error:("The object could not be validated because of an connection error: "+e)};
		}
		result.key = key;
		return result;
	},

	validateValueForKeyPath: function(value, keyPath)
	{
		var index = keyPath.indexOf(".");
		if(index == -1)
			return this.validateValueForKey(value, keyPath);
		else
		{
			var firstKey = keyPath.substring(0, index);
			var value = this.valueForKey(firstKey);
			return value ? value.validateValueForKeyPath(value, keyPath.substring(index+1)) : {validated:false, error:'A value could not be validated because of an invalid key.'};
		}
	},
		
	recoverFromValidationError: function(recoveryOption, info)
	{
		var opt = {};
		opt.parameters = {action:WRLRecoverFromValidationErrorActionName, recoveryOption:recoveryOption};
		opt.asynchronous = false;
		var request = new Ajax.Request(this.context.requestURL, opt);		
		var syncResult = this.context.synchronize();
		NotificationCenter.defaultNotificationCenter().sendMessage(WRLAjaxContextChangedByServerNotification, {context:this.context, result:syncResult});
	},

	uri: function() {
		return this.objectID.uri;
	},
    
    dispose: function()
    {
        this.isInvalid = true;
    }

});


// WRLAjaxContext

var ajaxContexts = {};

var WRLAjaxContext = WRLObject.extend({
	constructor: function(serverContextID, requestURL)
	{
		this.base();		
		this.serverContextID = serverContextID;
		this.requestURL = requestURL;
		this.registeredObjects = {};
		this.deletedObjectsURIs = [];
		this.changedObjects = [];
		this.addedObjects = {};
		this.model = null;
		this.uniqueIDCounter = 0;
		this.fetchRelationships = true;
		ajaxContexts[serverContextID] = this;

		this.firstPartOfUniqueID = "";
		var unwanted = ["/", "."];
		var array = this.requestURL.toArray();
		for(var i=0; i<array.length; i++)
		{
			var char = array[i];
			if(unwanted.indexOf(char) == -1)
				this.firstPartOfUniqueID += char;
		}
	},

	entityWithName: function(entityName)
	{
		return this.model[entityName];
	},

	addChangedObject: function(object)
	{
		if(this.changedObjects.indexOf(object) == -1)
			this.changedObjects.push(object);
	},

	propertiesOfEntityInModel: function(entity, model)
	{
		var properties = {};
		if(entity)
		{
			var props = entity.properties;
			if(props)
				for(var propertyName in props)
					properties[propertyName] = props[propertyName];
			if(entity.superentity)
			{
				var superProps = this.propertiesOfEntityInModel(model[entity.superentity], model);
				for(var propertyName in superProps)
					properties[propertyName] = superProps[propertyName];		
			}
		}
		return properties;
	},

	parseModelFromJSONString: function(jsonString)
	{
		try
		{
			var model = eval("("+jsonString+")");
		}
		catch(e)
		{
	//		console.log("error: %s JSON: %s", e, jsonString);
		}
		
		for(var entityName in model)
		{
			var entity = model[entityName];
			entity.properties = this.propertiesOfEntityInModel(entity, model);
			entity.name = entityName;
		}
		return model;
	},

	setObjectModelString: function(value)
	{
		this.model = this.parseModelFromJSONString(value);
	},

	fetchModel: function()
	{
		var opt = {};
		opt.parameters = WRLActionNameFormValueKey+"="+WRLFetchModelActionName;
		opt.asynchronous = false;
		var request = new Ajax.Request(this.requestURL, opt);
		this.model = this.parseModelFromJSONString(request.transport.responseText);
	},

	objectModel: function()
	{
		if(!this.model)
			this.fetchModel();
		return this.model;
	},

	registeredObjectsWithEntity: function(entity, keyPath, value)
	{	
		var result = [];
		for(var key in this.registeredObjects)
		{
			var object = this.registeredObjects[key]; 
			if(object.objectID.entity.name == entity)
			{
				if(!keyPath || !value || object.valueForKeyPath(keyPath) == value)
					result.push(object);
			}
		}
		return result;	
	},

	registeredObjectWithURIString: function(objectURIString, createIfNone)
	{
		var object = this.registeredObjects[objectURIString];
		if(!object && createIfNone)
		{
			var idWithoutPK = objectURIString.substring(0, objectURIString.lastIndexOf("/"));
			var entityName = idWithoutPK.substring(idWithoutPK.lastIndexOf("/")+1);
			var model = this.objectModel();
			var entity = model[entityName];	
			var objectID = new WRLObject();
			objectID[WRLSnapshotURIKey] = objectURIString;
			objectID[WRLEntityKey] = entity;
			var className = entity.className && window[entity.className] ? entity.className : "WRLManagedObject";
			var object = new window[className](this, objectID, null);
			this.registeredObjects[objectURIString] = object;
		}
		return object;
	},

	executeFetchRequest: function(request, onSuccess)
	{	
		var opt = {};
		opt.parameters = WRLActionNameFormValueKey+"="+WRLFetchDirectActionName+"&"+WRLEntityFormValueKey+"=" + request.entityName;
		if(request.predicate)
			opt.parameters += "&"+WRLPredicateFormValueKey+"=" + request.predicate;
		if(onSuccess)
		{
			opt.context = this;
			opt.onSuccess = function(transport)
			{
				if(onSuccess)
				{
					var objects = transport.request.options.context.parsedObjectsFromJSONString(transport.responseText);
					onSuccess(objects);
				}
			}
			new Ajax.Request(this.requestURL, opt);
		}
		else
		{
			opt.asynchronous = false;
			var request = new Ajax.Request(this.requestURL, opt);
			return this.parsedObjectsFromJSONString(request.transport.responseText);
		}
	},

	fetchRelationshipInObject: function(relationship, object)
	{
		if(this.fetchRelationships) {
			var opt = {};
			opt.parameters = WRLActionNameFormValueKey+"="+WRLFetchDirectActionName+"&"+WRLSnapshotURIKey+"=" + object.objectID.uri + "&"+WRLRelationshipFormValueKey+"=" + relationship;
			opt.asynchronous = false;
			var request = new Ajax.Request(this.requestURL, opt);
			if(request.transport.responseText && request.transport.responseText.length && request.success())
				return this.parsedObjectsFromJSONString(request.transport.responseText);
			else 
				return null;
		}
	},

	fetchObjectWithURI: function(uri)
	{
		var objects = this.fetchObjectsWithURIs([uri]);
		return objects.length ? objects[0] : null;
	},

	fetchObjectsWithURIs: function(uris)
	{
		var result = [];
		var opt = {};
		opt.parameters = {action:WRLFetchObjectsWithURIsActionName, objectURIs:uris};
		opt.asynchronous = false;
		var request = new Ajax.Request(this.requestURL, opt);
		try {
			var objects = eval("("+request.transport.responseText+")");			
			for(var uri in objects) {
				var properties = objects[uri];
				delete properties.uri;
				var object = this.registeredObjectWithURIString(uri, true);
				if(object){
					object.setProperties(properties, false, true);
					result.push(object);
				}
			}
		}catch (e) {}
		return result;
	},

	insertNewObjectForEntityForName: function(entityName, storeID) // TODO: store ID mit übergeben (z.B. vom Projekt holen in MEWeb) -> storeID/entityName/ct12398712837
	{
		var object = null;
		var entity = this.objectModel()[entityName];	
		if(entity)
		{
			var uri = storeID+"/"+entityName+"/ct"+this.firstPartOfUniqueID + "-" + this.uniqueIDCounter++;
			var objectID = new WRLObject();
			objectID[WRLSnapshotURIKey] = uri;
			objectID[WRLEntityKey] = entity;
			var className = entity.className ? entity.className : "WRLManagedObject";
			object = new window[className](this, objectID, null);
			object.isFault = false;
			this.registeredObjects[uri] = object;
			this.addedObjects[uri] = entityName;
		}
		return object;
	},

	forgetObjects: function(objects)
	{
		this.registerChangedObjects = false;
		if(objects)
		{
			var objectURIs = [];
			for(var i=0; i<objects.length; i++)
			{
				var object = objects[i];
				var uri = object.objectID.uri;
                object.dispose();
				delete this.registeredObjects[uri];
				objectURIs.push(uri);
			}
			if(objectURIs.length)
			{
				var opt = {};
				opt.parameters = WRLActionNameFormValueKey+"="+WRLForgetObjectsActionName+"&"+WRLURIsFormValueKey+"="+objectURIs.toJSON();
				opt.asynchronous = false;
				new Ajax.Request(this.requestURL, opt);
			}
		}
	},

	deleteObject: function(object)
	{
		this.registerChangedObjects = true;
		this.deleteObjectWithURI(object.objectID.uri);
	},

	deleteObjects: function(objects)
	{
		if(objects)
			for(var i=0; i<objects.length; i++)
				this.deleteObject(objects[i]);
	},

	deleteObjectWithURI: function(URI)
	{
		var object = this.registeredObjects[URI];
		if(object)
		{
			var propertiesDescriptions = object.objectID.entity.properties;
			for(var propertyName in propertiesDescriptions)
			{
				var propertyDescription = propertiesDescriptions[propertyName];
				if(propertyDescription.type == WRLCleartextToManyRelationshipType)			
				{
					var inverseKey = propertyDescription.inverse;
					var deleteRule = propertyDescription.deleteRule;
					var collection = object.valueForKey(propertyName);
					if(collection)
					{
						for(var k=0; k<collection.length; k++)
						{
							var inverseObject = collection[k];
							if(deleteRule == WRLCleartextNullifyDeleteRule)
								inverseObject.removeObjectFromRelationship(object, inverseKey);
							else if(deleteRule == WRLCleartextCascadeDeleteRule)
								this.deleteObjectWithURI(inverseObject.objectID.uri);
						}
					}
				}
				else if(propertyDescription.type == WRLCleartextToOneRelationshipType)
				{
					var inverseKey = propertyDescription.inverse;
					var deleteRule = propertyDescription.deleteRule;
					var destinationObject = object.valueForKey(propertyName);
					if(destinationObject && deleteRule == WRLCleartextNullifyDeleteRule)					
					{
						if(destinationObject.objectID.entity.properties[inverseKey].type == WRLCleartextToManyRelationshipType)
						{
							var collection = destinationObject.valueForKey(inverseKey);
							destinationObject.setValueForKey(collection.without(object), inverseKey);
						}
						else
							destinationObject.setValueForKey(null, inverseKey);
					}	
					else if(deleteRule == WRLCleartextCascadeDeleteRule)
						this.deleteObjectWithURI(destinationObject.objectID.uri);
				}
			}
			delete this.registeredObjects[URI];
			if(this.addedObjects[URI])
				delete this.addedObjects[URI];
			if(this.registerChangedObjects)
				this.deletedObjectsURIs.push(URI);
				
			// remove the object from the list of changed objects
			if(this.changedObjects.indexOf(object) != -1)
				this.changedObjects = this.changedObjects.without(object);
		}
	},

	deleteObjectsWithURIs: function(URIs)
	{
		for(var i=0; i<URIs.length; i++)
			this.deleteObjectWithURI(URIs[i]);
	},

	refetchAllObjects: function() 
	{
		this.synchronize();
		var allObjects = Object.values(this.registeredObjects);
		var allURIs = Object.keys(this.registeredObjects);
		this.forgetObjects(allObjects);
		this.fetchModel();
		this.fetchObjectsWithURIs(allURIs);
	},

	handleSynchronizeResponse: function(response)
	{
		this.registerChangedObjects = false;
		if(response.updated)
			this.parsedObjectsFromResponse(response.updated);
		if(response.deleted)
			this.deleteObjectsWithURIs(response.deleted);
	},

	jsonStringFromObjects: function(objects)
	{
		var result = null;
		for(var i=0; i<objects.length; i++)
		{
			var object = objects[i];
			var changedProperties = object.changedProperties();
			if(!result)
				result = {};
			result[object.objectID.uri] = Object.clone(changedProperties);
			object.clearChangedProperties();
		}
		return result ? Object.toJSON(result) : null;
	},

	flushManipulatedObjectCaches: function()
	{
		this.deletedObjectsURIs = [];
		this.changedObjects = [];
		this.addedObjects = {};	
	},

	getAddedObjects: function()
	{
		var objects = [];
		for(var uri in this.addedObjects)
		{
			var object = this.registeredObjects[uri];
			if(object)
				objects.push(object);
		}
		return objects;
	},

	synchronize: function(onSuccess)
	{	
		var opt = {};

		opt.parameters = {};
		opt.parameters[WRLActionNameFormValueKey] = WRLSynchronizeDirectActionName;

		if(Object.keys(this.addedObjects).length)
			opt.parameters[WRLSynchronizeAddedKey] = this.jsonStringFromObjects(this.getAddedObjects());
		if(this.deletedObjectsURIs.length)
			opt.parameters[WRLSynchronizeDeletedKey] = this.deletedObjectsURIs.toJSON();
		var changed = this.jsonStringFromObjects(this.changedObjects);
		if(changed)
			opt.parameters[WRLSynchronizeChangedKey] = changed;

		opt.context = this;
		this.flushManipulatedObjectCaches();
		if(onSuccess)
		{
			opt.onSuccess = function(transport)
			{
				var result = eval("("+transport.responseText+")");
				this.context.handleSynchronizeResponse(result);
				onSuccess(result);
			}
			new Ajax.Request(this.requestURL, opt);
		}
		else
		{
			opt.asynchronous = false;
			var request = new Ajax.Request(this.requestURL, opt);
			try{
				var result = request.transport.responseText.evalJSON();
				this.handleSynchronizeResponse(result);
				return result;
			}catch(e){}
			return null;
		}
	},

	synchronizeAndSave: function(save, onSuccess)
	{
		this.synchronize(onSuccess);
		if(save)
			this.save();
	},

	parsedObjectsFromJSONString: function(jsonString)
	{
		var result = this.parsedObjectsFromResponse(jsonString.evalJSON());
		return result;
	},


	setInitialObjectsFromJSONString: function(jsonString)
	{
		this.fetchRelationships	= false;
		this.parsedObjectsFromJSONString(jsonString);
		this.fetchRelationships = true;
	},

	exchangeURI: function(oldURI, newURI)
	{
		var object = this.registeredObjects[oldURI];
		if(object)
		{
			object.objectID.uri = newURI;
			delete this.registeredObjects[oldURI];
			this.registeredObjects[newURI] = object;
		}
	},

	parsedObjectsFromResponse: function(responseObjects)
	{
		var objects = [];
		for(var i=0; i<responseObjects.length; i++)
		{
			var responseObject = responseObjects[i];
			var oldURI = responseObject.oldURI;		
			if(oldURI)
			{
				this.exchangeURI(oldURI, responseObject.uri);
				delete responseObject.oldURI;
			}
		}
		for(var i=0; i<responseObjects.length; i++)
		{
			var responseObject = responseObjects[i];
			var uri = responseObject.uri;
			delete responseObject.uri;
			var object = this.registeredObjectWithURIString(uri, true);
			if(object && responseObject.isDeleted)
				delete this.registeredObjects[uri];
			else if(object)
			{	
				object.setProperties(responseObject);
				objects.push(object);
			}
		}
		return objects;
	},
	
	save: function() {
		var error = null;
		var request = new Ajax.Request(this.requestURL, {parameters:{action:WRLSaveActionName}, asynchronous:false});
		try{
			var result = eval("("+request.transport.responseText+")");
			error = result[WRLSynchronizeErrorKey];
		}catch(e){
			return "The save operation couldn't be completed, because of a wrong responseText.";
		}		 
		return error;
	},

	undo: function() {
		new Ajax.Request(this.requestURL, {parameters:{action:WRLUndoActionName}, asynchronous:false});
		this.synchronize();
	},
	
	redo: function() {
		new Ajax.Request(this.requestURL, {parameters:{action:WRLRedoActionName}, asynchronous:false});
		this.synchronize();
	},
	
	isAddedObject: function(object) {
		return this.addedObjects[object.uri()];
	}
});


function synchronizeWithServerContext(serverContextID)
{
	var context = ajaxContexts[serverContextID];
	if(context)
	{
		var result = context.synchronize();
		NotificationCenter.defaultNotificationCenter().sendMessage(WRLAjaxContextChangedByServerNotification, {context:context, result:result});
	}
}

Date.prototype.toJSON = function() 
{
  return '"' + (this.getTime()/1000) + '"';
};


var NotificationCenter = Base.extend({
	constructor: function()
	{
		this.dict = {};
	},
	
	addObserverForMessage: function(observer, msg, method)
	{
		var observerDescription = {observer:observer, method:method};
		var observerList = this.dict[msg];
		if(!observerList)
			this.dict[msg] = [observerDescription];
		else
			observerList.push(observerDescription);
	},

	removeObserverForMessage: function(observer, msg)
	{
		var observerList = this.dict[msg];
		if(!observerList)
			return;
		var newList = [];
		for(var i=0; i<this.dict.length;i++)
		{
			var observerDescription = this.dict[i];
			if(observerDescription.observer != observer)
				newList.push(observerDescription);
		}
		this.dict[msg] = newList;
	},

	sendMessage: function(msg, context)
	{
		var observerList = this.dict[msg];
		if(!observerList)
			return;
		for(var i=0; i<observerList.length;i++)
		{
			var observerDescription = observerList[i];
			var observer = observerDescription.observer;
			var method = observerDescription.method;
			observer[method].call(observer, msg, context);
		}
	}

},{ // Class interface

	_defaultNotificationCenter: null,

	defaultNotificationCenter: function()
	{
		if(!NotificationCenter._defaultNotificationCenter)
			NotificationCenter._defaultNotificationCenter = new NotificationCenter();
		return NotificationCenter._defaultNotificationCenter;
	}

});
//(c) 2006 Valerio Proietti (http://mad4milk.net). MIT-style license.
//moo.fx.js - depends on prototype.js OR prototype.lite.js
//version 2.0

var Fx = fx = {};

Fx.Base = function(){};
Fx.Base.prototype = {

	setOptions: function(options){
		this.options = Object.extend({
			onStart: function(){},
			onComplete: function(){},
			transition: Fx.Transitions.sineInOut,
			duration: 500,
			unit: 'px',
			wait: true,
			fps: 50
		}, options || {});
	},

	step: function(){
		var time = new Date().getTime();
		if (time < this.time + this.options.duration){
			this.cTime = time - this.time;
			this.setNow();
		} else {
			setTimeout(this.options.onComplete.bind(this, this.element), 10);
			this.clearTimer();
			this.now = this.to;
		}
		this.increase();
	},

	setNow: function(){
		this.now = this.compute(this.from, this.to);
	},

	compute: function(from, to){
		var change = to - from;
		return this.options.transition(this.cTime, from, change, this.options.duration);
	},

	clearTimer: function(){
		clearInterval(this.timer);
		this.timer = null;
		return this;
	},

	_start: function(from, to){
		if (!this.options.wait) this.clearTimer();
		if (this.timer) return;
		setTimeout(this.options.onStart.bind(this, this.element), 10);
		this.from = from;
		this.to = to;
		this.time = new Date().getTime();
		this.timer = setInterval(this.step.bind(this), Math.round(1000/this.options.fps));
		return this;
	},

	custom: function(from, to){
		return this._start(from, to);
	},

	set: function(to){
		this.now = to;
		this.increase();
		return this;
	},

	hide: function(){
		return this.set(0);
	},

	setStyle: function(e, p, v){
		if (p == 'opacity'){
			if (v == 0 && e.style.visibility != "hidden") e.style.visibility = "hidden";
			else if (e.style.visibility != "visible") e.style.visibility = "visible";
			if (window.ActiveXObject) e.style.filter = "alpha(opacity=" + v*100 + ")";
			e.style.opacity = v;
		} else e.style[p] = v+this.options.unit;
	}

};

Fx.Style = Class.create();
Fx.Style.prototype = Object.extend(new Fx.Base(), {

	initialize: function(el, property, options){
		this.element = $(el);
		this.setOptions(options);
		this.property = property.camelize();
	},

	increase: function(){
		this.setStyle(this.element, this.property, this.now);
	}

});

Fx.Styles = Class.create();
Fx.Styles.prototype = Object.extend(new Fx.Base(), {

	initialize: function(el, options){
		this.element = $(el);
		this.setOptions(options);
		this.now = {};
	},

	setNow: function(){
		for (p in this.from) this.now[p] = this.compute(this.from[p], this.to[p]);
	},

	custom: function(obj){
		if (this.timer && this.options.wait) return;
		var from = {};
		var to = {};
		for (p in obj){
			from[p] = obj[p][0];
			to[p] = obj[p][1];
		}
		return this._start(from, to);
	},

	increase: function(){
		for (var p in this.now) this.setStyle(this.element, p, this.now[p]);
	}

});

//Transitions (c) 2003 Robert Penner (http://www.robertpenner.com/easing/), BSD License.

Fx.Transitions = {
	linear: function(t, b, c, d) { return c*t/d + b; },
	sineInOut: function(t, b, c, d) { return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b; }
};//by Valerio Proietti (http://mad4milk.net). MIT-style license.
//moo.fx.pack.js - depends on prototype.js or prototype.lite.js + moo.fx.js
//version 2.0

Fx.Scroll = Class.create();
Fx.Scroll.prototype = Object.extend(new Fx.Base(), {

	initialize: function(el, options) {
		this.element = $(el);
		this.setOptions(options);
		this.element.style.overflow = 'hidden';
	},
	
	down: function(){
		return this.custom(this.element.scrollTop, this.element.scrollHeight-this.element.offsetHeight);
	},
	
	up: function(){
		return this.custom(this.element.scrollTop, 0);
	},

	increase: function(){
		this.element.scrollTop = this.now;
	}

});

//fx.Color, originally by Tom Jensen (http://neuemusic.com) MIT-style LICENSE.

Fx.Color = Class.create();
Fx.Color.prototype = Object.extend(new Fx.Base(), {
	
	initialize: function(el, property, options){
		this.element = $(el);
		this.setOptions(options);
		this.property = property.camelize();
		this.now = [];
	},

	custom: function(from, to){
		return this._start(from.hexToRgb(true), to.hexToRgb(true));
	},

	setNow: function(){
		[0,1,2].each(function(i){
			this.now[i] = Math.round(this.compute(this.from[i], this.to[i]));
		}.bind(this));
	},

	increase: function(){
		this.element.style[this.property] = "rgb("+this.now[0]+","+this.now[1]+","+this.now[2]+")";
	}

});

Object.extend(String.prototype, {

	rgbToHex: function(array){
		var rgb = this.match(new RegExp('([\\d]{1,3})', 'g'));
		if (rgb[3] == 0) return 'transparent';
		var hex = [];
		for (var i = 0; i < 3; i++){
			var bit = (rgb[i]-0).toString(16);
			hex.push(bit.length == 1 ? '0'+bit : bit);
		}
		var hexText = '#'+hex.join('');
		if (array) return hex;
		else return hexText;
	},

	hexToRgb: function(array){
		var hex = this.match(new RegExp('^[#]{0,1}([\\w]{1,2})([\\w]{1,2})([\\w]{1,2})$'));
		var rgb = [];
		for (var i = 1; i < hex.length; i++){
			if (hex[i].length == 1) hex[i] += hex[i];
			rgb.push(parseInt(hex[i], 16));
		}
		var rgbText = 'rgb('+rgb.join(',')+')';
		if (array) return rgb;
		else return rgbText;
	}	

});//by Valerio Proietti (http://mad4milk.net). MIT-style license.
//moo.fx.utils.js - depends on prototype.js OR prototype.lite.js + moo.fx.js
//version 2.0

Fx.Height = Class.create();
Fx.Height.prototype = Object.extend(new Fx.Base(), {

	initialize: function(el, options){
		this.element = $(el);
		this.setOptions(options);
		this.element.style.overflow = 'hidden';
	},

	toggle: function(){
		if (this.element.offsetHeight > 0) return this.custom(this.element.offsetHeight, 0);
		else return this.custom(0, this.element.scrollHeight);
	},

	show: function(){
		return this.set(this.element.scrollHeight);
	},

	increase: function(){
		this.setStyle(this.element, 'height', this.now);
	}

});

Fx.Width = Class.create();
Fx.Width.prototype = Object.extend(new Fx.Base(), {

	initialize: function(el, options){
		this.element = $(el);
		this.setOptions(options);
		this.element.style.overflow = 'hidden';
		this.iniWidth = this.element.offsetWidth;
	},

	toggle: function(){
		if (this.element.offsetWidth > 0) return this.custom(this.element.offsetWidth, 0);
		else return this.custom(0, this.iniWidth);
	},

	show: function(){
		return this.set(this.iniWidth);
	},

	increase: function(){
		this.setStyle(this.element, 'width', this.now);
	}

});

Fx.Opacity = Class.create();
Fx.Opacity.prototype = Object.extend(new Fx.Base(), {

	initialize: function(el, options){
		this.element = $(el);
		this.setOptions(options);
		this.now = 1;
	},

	toggle: function(){
		if (this.now > 0) return this.custom(1, 0);
		else return this.custom(0, 1);
	},

	show: function(){
		return this.set(1);
	},
	
	increase: function(){
		this.setStyle(this.element, 'opacity', this.now);
	}

});//moo.fx.transitions.js - depends on prototype.js or prototype.lite.js + moo.fx.js
//Author: Robert Penner, <http://www.robertpenner.com/easing/>, modified to be used with mootools.
//License: Easing Equations v1.5, (c) 2003 Robert Penner, all rights reserved. Open Source BSD License.

Fx.Transitions = {

	linear: function(t, b, c, d){
		return c*t/d + b;
	},

	quadIn: function(t, b, c, d){
		return c*(t/=d)*t + b;
	},

	quadOut: function(t, b, c, d){
		return -c *(t/=d)*(t-2) + b;
	},

	quadInOut: function(t, b, c, d){
		if ((t/=d/2) < 1) return c/2*t*t + b;
		return -c/2 * ((--t)*(t-2) - 1) + b;
	},

	cubicIn: function(t, b, c, d){
		return c*(t/=d)*t*t + b;
	},

	cubicOut: function(t, b, c, d){
		return c*((t=t/d-1)*t*t + 1) + b;
	},

	cubicInOut: function(t, b, c, d){
		if ((t/=d/2) < 1) return c/2*t*t*t + b;
		return c/2*((t-=2)*t*t + 2) + b;
	},

	quartIn: function(t, b, c, d){
		return c*(t/=d)*t*t*t + b;
	},

	quartOut: function(t, b, c, d){
		return -c * ((t=t/d-1)*t*t*t - 1) + b;
	},

	quartInOut: function(t, b, c, d){
		if ((t/=d/2) < 1) return c/2*t*t*t*t + b;
		return -c/2 * ((t-=2)*t*t*t - 2) + b;
	},

	quintIn: function(t, b, c, d){
		return c*(t/=d)*t*t*t*t + b;
	},

	quintOut: function(t, b, c, d){
		return c*((t=t/d-1)*t*t*t*t + 1) + b;
	},

	quintInOut: function(t, b, c, d){
		if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
		return c/2*((t-=2)*t*t*t*t + 2) + b;
	},

	sineIn: function(t, b, c, d){
		return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
	},

	sineOut: function(t, b, c, d){
		return c * Math.sin(t/d * (Math.PI/2)) + b;
	},

	sineInOut: function(t, b, c, d){
		return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
	},

	expoIn: function(t, b, c, d){
		return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
	},

	expoOut: function(t, b, c, d){
		return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
	},

	expoInOut: function(t, b, c, d){
		if (t==0) return b;
		if (t==d) return b+c;
		if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
		return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
	},

	circIn: function(t, b, c, d){
		return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;
	},

	circOut: function(t, b, c, d){
		return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
	},

	circInOut: function(t, b, c, d){
		if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
		return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
	},

	elasticIn: function(t, b, c, d, a, p){
		if (t==0) return b; if ((t/=d)==1) return b+c; if (!p) p=d*.3; if (!a) a = 1;
		if (a < Math.abs(c)){ a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin(c/a);
		return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
	},

	elasticOut: function(t, b, c, d, a, p){
		if (t==0) return b; if ((t/=d)==1) return b+c; if (!p) p=d*.3; if (!a) a = 1;
		if (a < Math.abs(c)){ a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin(c/a);
		return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
	},

	elasticInOut: function(t, b, c, d, a, p){
		if (t==0) return b; if ((t/=d/2)==2) return b+c; if (!p) p=d*(.3*1.5); if (!a) a = 1;
		if (a < Math.abs(c)){ a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin(c/a);
		if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
		return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;
	},

	backIn: function(t, b, c, d, s){
		if (!s) s = 1.70158;
		return c*(t/=d)*t*((s+1)*t - s) + b;
	},

	backOut: function(t, b, c, d, s){
		if (!s) s = 1.70158;
		return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
	},

	backInOut: function(t, b, c, d, s){
		if (!s) s = 1.70158;
		if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
		return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
	},

	bounceIn: function(t, b, c, d){
		return c - Fx.Transitions.bounceOut (d-t, 0, c, d) + b;
	},

	bounceOut: function(t, b, c, d){
		if ((t/=d) < (1/2.75)){
			return c*(7.5625*t*t) + b;
		} else if (t < (2/2.75)){
			return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
		} else if (t < (2.5/2.75)){
			return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
		} else {
			return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
		}
	},

	bounceInOut: function(t, b, c, d){
		if (t < d/2) return Fx.Transitions.bounceIn(t*2, 0, c, d) * .5 + b;
		return Fx.Transitions.bounceOut(t*2-d, 0, c, d) * .5 + c*.5 + b;
	}

};// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("PWUtils.js");

/*
 *	PWUtils namespace
 *  
 *  ProjectWizards Utility Functions
 */

/*
Copyright (c) 2006 Dan Webb

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, 
and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial 
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED 
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL 
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
IN THE SOFTWARE.
*/
DomBuilder = {
  IE_TRANSLATIONS : {
    'class' : 'className',
    'for' : 'htmlFor'
  },
  ieAttrSet : function(a, i, el) {
    var trans;
    if (trans = this.IE_TRANSLATIONS[i]) el[trans] = a[i];
    else if (i == 'style') el.style.cssText = a[i];
    else if (i.match(/^on/)) el[i] = new Function(a[i]);
    else el.setAttribute(i, a[i]);
  },
	apply : function(o) { 
	  o = o || {};
		var els = ("p|div|span|strong|em|img|table|tr|td|th|thead|tbody|tfoot|pre|code|" + 
					   "h1|h2|h3|h4|h5|h6|ul|ol|li|form|input|textarea|legend|fieldset|" + 
					   "select|option|blockquote|cite|br|hr|dd|dl|dt|address|a|button|abbr|acronym|" +
					   "script|link|style|bdo|ins|del|object|param|col|colgroup|optgroup|caption|" + 
					   "label|dfn|kbd|samp|var").split("|");
    var el, i=0;
		while (el = els[i++]) o[el.toUpperCase()] = DomBuilder.tagFunc(el);
		return o;
	},
	tagFunc : function(tag) {
	  return function() {
	    var a = arguments, at, ch; a.slice = [].slice; if (a.length>0) { 
	    if (a[0].nodeName || typeof a[0] == "string") ch = a; 
	    else { at = a[0]; ch = a.slice(1); } }
	    return DomBuilder.elem(tag, at, ch);
	  }
  },
	elem : function(e, a, c) {
		a = a || {}; c = c || [];
		var isIE = Prototype.Browser.IE;
        var doc = document;
        if(a.document) {
            doc = a.document;
            delete a.document;
        }
		var el = doc.createElement((isIE && a.name)?"<" + e + " name=" + a.name + ">":e);
		for (var i in a) {
		  if (typeof a[i] != 'function') {
		    if (isIE) this.ieAttrSet(a, i, el);
		    else el.setAttribute(i, a[i]);
		  }
	  }
		for (var i=0; i<c.length; i++) {
			if (typeof c[i] == 'string') 
                c[i] = doc.createTextNode(c[i]);
            try {
                el.appendChild(c[i]);
            } catch(e){
//                console.log("error: %s", e);
            }
		} 
		return el;
	}
}

DomBuilder.apply(window);

var PWUtils;
if(!PWUtils) PWUtils = {
        
    addVMLGraphicToElement: function(elem)
    {
		var vml = document.createElement("v:group");
		vml.style.position = "absolute";
		vml.style.width = "500px";
		vml.style.height = "500px";
		vml.setAttribute("coordsize", "500 500");  
		vml.setAttribute("coordorigin", "0 0");
        vml.style.zIndex = "1000000";
    
		var bar = document.createElement("v:roundrect");
		bar.style.position = "absolute";
		bar.style.width = "100px";
		bar.style.height = "100px";
		bar.setAttribute("fill", "true");
		bar.setAttribute("fillcolor", "red");	
		bar.setAttribute("strokeweight", "2");	
        bar.style.zIndex = "1000000";
        
		vml.appendChild(bar);
		elem.appendChild(vml);
    },


	//	The observing methods should be used like this:
	//
	//		cell.f1 = this.clickedInColumnHead.bindAsEventListener(this);
	//		observe(cell, 'mousedown', cell.f1);
	//		stopObserving(cell, 'mousedown', cell.f1);
	//		

	stopObserving: function(element, name, handler) {
		if (element.removeEventListener) {
			element.removeEventListener(name, handler, false);
		} else {
			element.detachEvent("on" + name, handler);
		}
	},

	observe: function(element, name, handler, register, useCapture) {
		if(register) {
			if(!PWUtils.eventHandlerCache)
				PWUtils.eventHandlerCache = [];
			PWUtils.eventHandlerCache.push({element:element, eventName:name, handler:handler});
		}
		if (element.addEventListener) {
			element.addEventListener(name, handler, useCapture);
		} else {
			var result = element.attachEvent("on" + name, handler);
		}
	},
	
	disconnectEventListeners: function() {
		if(PWUtils.eventHandlerCache) {
			for(var i=0; i<PWUtils.eventHandlerCache.length; i++) {
				var info = PWUtils.eventHandlerCache[i];
				PWUtils.stopObserving(info.element, info.eventName, info.handler);
			}
		}
	},
	
	makeButton: function(button){
		var rows = button.getElementsByTagName("tr");
		if(rows && rows.length){
			button.segments = [];
			for(var i=0; i<rows[0].childNodes.length; i++){
				var segment = rows[0].childNodes[i];
				segment.origClassName = segment.className;
				button.segments.push(segment);
			}
			button._onMouseDown = function(event){
				for(var i=0; i<button.segments.length; i++){
					var segment = button.segments[i];
					segment.className = segment.origClassName+"Clicked";
				}
				eval(button.getAttribute("onClick"));
			}
			button._onMouseUp = function(event){
				for(var i=0; i<button.segments.length; i++){
					var segment = button.segments[i];
					segment.className = segment.origClassName;
				}
			}
			button._onMouseOut = function(event){
				button._onMouseUp(event);
			}
			PWUtils.observe(button, "mouseout", function(){button._onMouseOut();}, true);
			PWUtils.observe(button, "mousedown", function(){button._onMouseDown();}, true);
			PWUtils.observe(button, "mouseup", function(){button._onMouseUp();}, true);
		}
		return button;
	},
	
	makeMultiStateButton: function(button, firePeriodically){
		if(!button)
			return;
		button.enabled = true;
		if(!button.origClassName)
			button.origClassName = button.className;
		button.setEnabled = function(enable){
			if(!enable && !button.origOnClickMethod)
				button.origOnClickMethod = button.getAttribute("onClick");
			if(enable && !button.enabled){
				button.setAttribute("onClick", button.origOnClickMethod, 1);
				button.enabled = true;
				button.className = button.origClassName;
			}else if(!enable && button.enabled){
				button.setAttribute("onClick", null);
				button.enabled = false;
				button.className = button.origClassName + "Disabled";
			}
		}
		button._stopTimer = function(){
			if(button.timer)
				window.clearInterval(button.timer);		
		}
		button._onMouseDown = function(event){
			button.className = button.origClassName+"Clicked";
			if(firePeriodically){
				button._stopTimer();
				button.timer = window.setInterval(function(){
					eval(button.getAttribute("onClick"));
				}, 200);
			}
		}
		button._onMouseUp = function(event){
			button.className = button.origClassName + (button.enabled ? "" : "Disabled");
			button._stopTimer();
		}
		button._onMouseOut = function(event){
			button.className = button.origClassName + (button.enabled ? "" : "Disabled");
			button._stopTimer();
		}
		PWUtils.observe(button, "mouseout", function(){button._onMouseOut();}, true);
		PWUtils.observe(button, "mousedown", function(){button._onMouseDown();}, true);
		PWUtils.observe(button, "mouseup", function(){button._onMouseUp();}, true);
		return button;
	},
		
	getY: function(element){
		var y = 0;
		for(var e=element; e; e = e.offsetParent)
			y += e.offsetTop;
		for(e = element.parentNode; e && e!=document.body; e = e.parentNode)
			if(e.scrollTop) 
				y -= e.scrollTop;
		return y;
	},

	getX: function(element){
		var x = 0;
		for(var e=element; e; e = e.offsetParent)
			x += e.offsetLeft;
		for(e = element.parentNode; e && e!=document.body; e = e.parentNode)
			if(e.scrollLeft) 
				x -= e.scrollLeft;
		return x;
	},
	
	
	getLocalX: function(x, element){
		return x - this.getX(element);
	},

	getLocalY: function(y, element){
		return y - this.getY(element);
	},
	
	/*
	 *	dispatchMouseDownEvent 
	 *  Decides if the event is a click- or a drag-event and calls appropriate handler functions.
	 */
	
	dispatchMouseDownEvent: function(event, obj, clickHandler, dragHandler, startDragHandler, endDragHandler, biggerDragDetectionArea){		
		event = event || window.event;
		var origX = event.clientX;
		var origY = event.clientY;
		var srcElement = event.srcElement;
		var moved = false;
		if(document.addEventListener){
			PWUtils.observe(document, "mouseup", handleMouseUp);
			PWUtils.observe(document, "mousemove", handleMouseMove);
		}else if(document.attachEvent){
			srcElement.setCapture();
			PWUtils.observe(srcElement, "mouseup", handleMouseUp);
			PWUtils.observe(srcElement, "losecapture", handleMouseUp);
			PWUtils.observe(srcElement, "mousemove", handleMouseMove);
		}

		function handleMouseUp(event){
			if(document.removeEventListener){			
				PWUtils.stopObserving(document, "mouseup", handleMouseUp);
				PWUtils.stopObserving(document, "mousemove", handleMouseMove);
			}else if(document.detachEvent)	{
				PWUtils.stopObserving(srcElement, "mouseup", handleMouseUp);
				PWUtils.stopObserving(srcElement, "losecapture", handleMouseUp);
				PWUtils.stopObserving(srcElement, "mousemove", handleMouseMove);
				srcElement.releaseCapture();			
			}
			if(moved && endDragHandler)
				endDragHandler.call(obj, event);
			else if(clickHandler)
				clickHandler.call(obj, event);
		}

		function handleMouseMove(event){
			var newX = event.clientX;
			var newY = event.clientY;
			if(!moved) {
				if(!biggerDragDetectionArea || (newX>origX+1 || newX<origX-1 || newY>origY+1 || newY<origY-1)) {
					// I don't know a portable way to capture the initial event.
					// Instead I pass the X/Y values directly.
					if(startDragHandler)
						startDragHandler.call(obj, event, origX, origY);
					moved = true;
				}
			}
			if(dragHandler)
				dragHandler.call(obj, event);
		}
	},
			
	effectiveStyle: function(e){
		return e.currentStyle ? e.currentStyle : window.getComputedStyle(e, null);
	},

	scrollbarWidth: function(){ 
		return Prototype.Browser.IE ? 17 : 15;
	},

	drawTopAndBottomLine: function(place, topColor, bottomColor){
		var topBar = DIV({style:"position:absolute; left:0px; top:0px; width:100%; height:1px; z-index:-1; background-color:"+topColor+";"});
		place.appendChild(topBar);
		var bottomBar = DIV({style:"position:absolute; left:0px; bottom:0px; width:100%; height:1px; z-index:-1; background-color:"+bottomColor+";"});
		place.appendChild(bottomBar);
	},

	drawLeftAndRightLine: function(place, leftColor, rightColor){
		var leftBar = DIV({style:"position:absolute; left:0px; top:0px; bottom:0px; width:1px; background-color:"+leftColor+";"});
		place.appendChild(leftBar);		
		var rightBar = DIV({style:"position:absolute; right:0px; top:0px; bottom:0px; width:1px; background-color:"+rightColor+";"});
		place.appendChild(rightBar);		
	},

	drawHeaderGradient: function(place, imageURL){
		var gradientContainer = DIV({style:"position:absolute; left:0px; top:0px; bottom:0px; right:0px; z-index:-1;"});
		var img = IMG({style:"position:absolute; left:0px; top:0px; width:100%; height:100%; z-index:-1;"});
		img.src = imageURL;
		gradientContainer.appendChild(img);
		place.appendChild(gradientContainer);
		this.drawTopAndBottomLine(gradientContainer, "#ffffff", "#aaaaaa");
		return gradientContainer;
	},
		
	childWithClassInNode: function(className, node){
		var result = null;
		var childs = node.childNodes;
		for(var i=0; i<childs.length; i++){
			if(childs[i].className == className){
				result = childs[i];
				break;
			}
		}
		return result;
	},
	
	notificationCenter: NotificationCenter.defaultNotificationCenter(),
	
	setSelectionEnabled: function(element, enable){
		var changed = true;
		if(element.selectionState)
			changed = element.selectionState.enable != enable;
		element.selectionState = {enable:enable};
		if(changed){
			if(enable){
				element.style.cursor = element.origCursor;
				element.onselectstart = element.origOnSelectStart;
				element.unselectable = "off";
				element.style.MozUserSelect = "";
				element.style.KhtmlUserSelect = "";
			}else{
				if(!element.origOnSelectStart){
					element.origOnSelectStart = element.onselectstart;
					element.origCursor = element.style.cursor;
				}
				element.onselectstart = function() {
					return false;
				};
				element.unselectable = "on";
				element.style.MozUserSelect = "none";
				element.style.KhtmlUserSelect = "none";
				element.style.cursor = "default";
			}		
		}
	},
	
	dragDropPasteboard: [],
	
	dropObservers: [],
	
	// Drop Observers must implement this functions:
	//		validateDrop(pos, pasteboard) return true if the drop will be accepted
	//		acceptDrop(pos, pasteboard)
	
	addDropObserver: function(observer){	   
		if(this.dropObservers.indexOf(observer) == -1)
			this.dropObservers.push(observer);	
	},
	
	removeDropObserver: function(observer){
		if(this.dropObservers.indexOf(observer) != -1)
			this.dropObservers = this.dropObservers.without(observer);
	},
	
	notifyDropObserversOnMouseMove: function(event){
		for(var i=0; i<this.dropObservers.length; i++){
			this.dropObservers[i].validateDrop({x:event.clientX, y:event.clientY}, this.dragDropPasteboard);
		}
	},

	notifyDropObserversOnMouseUp: function(event){
		for(var i=0; i<this.dropObservers.length; i++){
			if(this.dropObservers[i].validateDrop({x:event.clientX, y:event.clientY}, this.dragDropPasteboard))
				this.dropObservers[i].acceptDrop({x:event.clientX, y:event.clientY}, this.dragDropPasteboard)
		}	
	},
	
	// A shield is an Element that captures all mouse clicks behind an element with a greater z-index.
	// The method clickedInShield is called on the delegate if a user clicks into the shield.
	//
	
	activateShield: function(delegate, zIndex){
		if(!PWUtils.shield){
			PWUtils.shield = DIV({'class':'PWUtilsShield'});
			$$('body')[0].appendChild(PWUtils.shield);
		}
		PWUtils.shieldDelegate = delegate;		
		PWUtils.shield.style.zIndex = zIndex;
		PWUtils.shield.style.display = 'block';
		PWUtils.observe(PWUtils.shield, "click", PWUtils.clickedInShield);
	},
	
	deactivateShield: function(){
		PWUtils.shield.style.display = 'none';
		PWUtils.stopObserving(PWUtils.shield, "click", PWUtils.clickedInShield);		
	},
	
	clickedInShield: function(event){
		PWUtils.shieldDelegate.clickedInShield.call(PWUtils.shieldDelegate, event, PWUtils.shield);
	}
	
}

/* Function stringWithFormat(format_string,arguments...)
 * Javascript emulation of the C printf function (modifiers and argument types 
 *    "p" and "n" are not supported due to language restrictions)
 *
 * Copyright 2003 K&L Productions. All rights reserved
 * http://www.klproductions.com 
 *
 * Terms of use: This function can be used free of charge IF this header is not
 *               modified and remains with the function code.
 * 
 * Legal: Use this code at your own risk. K&L Productions assumes NO resposibility
 *        for anything.
 ********************************************************************************/
function stringWithFormat(fstring){ 
	var pad = function(str,ch,len)
	  { var ps='';
		for(var i=0; i<Math.abs(len); i++) ps+=ch;
		return len>0?str+ps:ps+str;
	  }
	var processFlags = function(flags,width,rs,arg)
	  { var pn = function(flags,arg,rs)
		  { if(arg>=0)
			  { if(flags.indexOf(' ')>=0) rs = ' ' + rs;
				else if(flags.indexOf('+')>=0) rs = '+' + rs;
			  }
			else
				rs = '-' + rs;
			return rs;
		  }
		var iWidth = parseInt(width,10);
		if(width.charAt(0) == '0')
		  { var ec=0;
			if(flags.indexOf(' ')>=0 || flags.indexOf('+')>=0) ec++;
			if(rs.length<(iWidth-ec)) rs = pad(rs,'0',rs.length-(iWidth-ec));
			return pn(flags,arg,rs);
		  }
		rs = pn(flags,arg,rs);
		if(rs.length<iWidth)
		  { if(flags.indexOf('-')<0) rs = pad(rs,' ',rs.length-iWidth);
			else rs = pad(rs,' ',iWidth - rs.length);
		  }    
		return rs;
	  }
	var converters = new Array();
	converters['c'] = function(flags,width,precision,arg)
	  { if(typeof(arg) == 'number') return String.fromCharCode(arg);
		if(typeof(arg) == 'string') return arg.charAt(0);
		return '';
	  }
	converters['d'] = function(flags,width,precision,arg)
	  { return converters['i'](flags,width,precision,arg); 
	  }
	converters['u'] = function(flags,width,precision,arg)
	  { return converters['i'](flags,width,precision,Math.abs(arg)); 
	  }
	converters['i'] =  function(flags,width,precision,arg)
	  { var iPrecision=parseInt(precision);
		var rs = ((Math.abs(arg)).toString().split('.'))[0];
		if(rs.length<iPrecision) rs=pad(rs,' ',iPrecision - rs.length);
		return processFlags(flags,width,rs,arg); 
	  }
	converters['E'] = function(flags,width,precision,arg) 
	  { return (converters['e'](flags,width,precision,arg)).toUpperCase();
	  }
	converters['e'] =  function(flags,width,precision,arg)
	  { iPrecision = parseInt(precision);
		if(isNaN(iPrecision)) iPrecision = 6;
		rs = (Math.abs(arg)).toExponential(iPrecision);
		if(rs.indexOf('.')<0 && flags.indexOf('#')>=0) rs = rs.replace(/^(.*)(e.*)$/,'$1.$2');
		return processFlags(flags,width,rs,arg);        
	  }
	converters['f'] = function(flags,width,precision,arg)
	  { iPrecision = parseInt(precision);
		if(isNaN(iPrecision)) iPrecision = 6;
		rs = (Math.abs(arg)).toFixed(iPrecision);
		if(rs.indexOf('.')<0 && flags.indexOf('#')>=0) rs = rs + '.';
		var a = rs.toArray();
		if(a.indexOf('.') != -1){
			var oCount = 0;
			if(!precision) {
				for(var i=a.length-1; i>0; i--){	// PWMod: remove trailing zeros
					var char = a[i];
					if(char != "0" && char != ".")
						break;
					oCount++;
					if(char == ".")
						break;
				}
			}
			rs = rs.substring(0, rs.length-oCount);
		}
		return processFlags(flags,width,rs,arg);
	  }
	converters['G'] = function(flags,width,precision,arg)
	  { return (converters['g'](flags,width,precision,arg)).toUpperCase();
	  }
	converters['g'] = function(flags,width,precision,arg)
	  { iPrecision = parseInt(precision);
		absArg = Math.abs(arg);
		rse = absArg.toExponential();
		rsf = absArg.toFixed(6);
		if(!isNaN(iPrecision))
		  { rsep = absArg.toExponential(iPrecision);
			rse = rsep.length < rse.length ? rsep : rse;
			rsfp = absArg.toFixed(iPrecision);
			rsf = rsfp.length < rsf.length ? rsfp : rsf;
		  }
		if(rse.indexOf('.')<0 && flags.indexOf('#')>=0) rse = rse.replace(/^(.*)(e.*)$/,'$1.$2');
		if(rsf.indexOf('.')<0 && flags.indexOf('#')>=0) rsf = rsf + '.';
		rs = rse.length<rsf.length ? rse : rsf;
		return processFlags(flags,width,rs,arg);        
	  }  
	converters['o'] = function(flags,width,precision,arg)
	  { var iPrecision=parseInt(precision);
		var rs = Math.round(Math.abs(arg)).toString(8);
		if(rs.length<iPrecision) rs=pad(rs,' ',iPrecision - rs.length);
		if(flags.indexOf('#')>=0) rs='0'+rs;
		return processFlags(flags,width,rs,arg); 
	  }
	converters['X'] = function(flags,width,precision,arg)
	  { return (converters['x'](flags,width,precision,arg)).toUpperCase();
	  }
	converters['x'] = function(flags,width,precision,arg)
	  { var iPrecision=parseInt(precision);
		arg = Math.abs(arg);
		var rs = Math.round(arg).toString(16);
		if(rs.length<iPrecision) rs=pad(rs,' ',iPrecision - rs.length);
		if(flags.indexOf('#')>=0) rs='0x'+rs;
		return processFlags(flags,width,rs,arg); 
	  }
	converters['s'] = function(flags,width,precision,arg)
	  { var iPrecision=parseInt(precision);
		var rs = arg;
		if(rs.length > iPrecision) rs = rs.substring(0,iPrecision);
		return processFlags(flags,width,rs,0);
	  }
	farr = fstring.split('%');
	retstr = farr[0];
	fpRE = /^([-+ #]*)(\d*)\.?(\d*)([cdieEfFgGosuxX])(.*)$/;
	for(var i=1; i<farr.length; i++)
	  { fps=fpRE.exec(farr[i]);
		if(!fps) continue;
		if(arguments[i]!=null) retstr+=converters[fps[4]](fps[1],fps[2],fps[3],arguments[i]);
		retstr += fps[5];
	  }
	return retstr;
}

/*	Date Extensions:
 *
 * 
 *
 */   

Date.prototype.timeIntervalSinceDate = function(aDate)
{
	return (this.getTime()-aDate.getTime())/1000;	
}

Date.prototype.wholeDaysSinceDate = function(date)
{
	if(!date)
		return 0;
	return (this.getTime() - date.getTime())/(24.0*3600.0*1000.0);
}

Date.prototype.getCalendarWeekUTC = function(environment)
{
	var year = this.getUTCFullYear() + 1;	
	var startOfFirstWeek = Date.startOfCalendarWeekInYear(1, year, true, environment);
	while(startOfFirstWeek.getTime() > this.getTime()){
		startOfFirstWeek = Date.startOfCalendarWeekInYear(1, --year, true, environment);
	}
	
	var days = this.wholeDaysSinceDate(startOfFirstWeek);
	return Math.floor(1+days/7);	
}

Date.startOfCalendarWeekInYear = function(week, year, utc, environment)
{
	var day = environment.firstDayOfWeek;
	var anchorDayInJanuary = day == 2 ? 4 : 1;		
	var date = utc ? new Date(Date.UTC(year, 0, anchorDayInJanuary)) : new Date(year, 0, anchorDayInJanuary);
	var result = date.getTime();
	var weekday;
	while(1){
		date = new Date(result);
		weekday = (utc ? date.getUTCDay() : date.getDay())+1;
		if(weekday!=day)
			result -= 86400000;
		else
			break;
	}
	result += ((week-1)*604800)*1000;
	return new Date(result);
}


Date.prototype.isEqual = function(date){
	if(!date)
		return false;
	return (this.getTime() == date.getTime());
}
	
Date.prototype.nextDay = function(utc){
	return Date.add("d", 1, this, utc);
}

/*
 * Instance method that you can call on Date objects
 * var dt = new Date(); 
 * dt.add('d', 5); 
 * return dt;
 * ========================
 */
Date.prototype.add = function(interv, incr, utc) {
    var ndt = Date.add(interv, incr, this, utc);
    this.setTime(ndt.getTime());
}

/*
 * Static method that requires a Date object passed in
 * ========================
 */
Date.add = function(interv, incr, dt, utc) {
    /*
    yyyy - Year
    q - Quarter
    m - Month
    y - Day of year
    d - Day
    w - Weekday
    ww - Week of year
    h - Hour
    n - Minute
    s - Second
    */
        
    var retDate = new Date(dt);    
    switch(interv) {
        case 'yyyy':
            if(utc)
				retDate.setUTCFullYear(dt.getUTCFullYear() + incr);
			else
				retDate.setFullYear(dt.getFullYear() + incr);
//			retDate.setFullYear((utc ? dt.getUTCFullYear() : dt.getFullYear()) + incr);
            break;
        case 'q':
            //var currQ = parseInt(mon/3)+1;
            //var incrYear = (incr > 0) ? parseInt(incr/4)+1 : parseInt(incr/4);
            
            // Naive implementation of quarters as just adding three months
            incr*=3;
            
            break;
        case 'm': 
	       var yea=utc ? dt.getUTCFullYear() : dt.getFullYear();
		   var mon=utc ? dt.getUTCMonth() : dt.getMonth();
            if (incr < 0){
                while (incr < 0){
                    incr++;
                    mon--;
                    if(mon < 0){
                        mon=11;
                        yea--;
                    }
                }                   
            }
            else {
                while(incr > 0){
                    incr--;
                    mon++;
                    if (mon > 11){
                        mon=0;
                        yea++;
                    }
                }
            } 
            if(utc){
				retDate.setUTCMonth(mon);
				retDate.setUTCFullYear(yea);			
				if (retDate.getUTCMonth() != mon)
					retDate.setUTCDate(0) 
			}else{
				retDate.setMonth(mon);
				retDate.setFullYear(yea);
				if (retDate.getMonth() != mon)
					retDate.setDate(0) 
			}

            break;
        case 'd':
        case 'y':
			if(utc)
				retDate.setUTCDate(dt.getUTCDate() + incr);
			else
				retDate.setDate(dt.getDate() + incr);
            break;
        case 'h':
            retDate = dt.getTime();
            retDate = retDate + (incr*3600000);
            retDate = new Date(retDate);
            break;
        case 'n':
            retDate = dt.getTime();
            retDate = retDate + (incr*60000);
            retDate = new Date(retDate);
            break;
        case 's':
            retDate = dt.getTime();
            retDate = retDate + (incr*1000);
            retDate = new Date(retDate);
            break;
        case 'w':
            var weekSpan = parseInt(incr/5); // Number of weeks spanned
            // If less than one week, check for intervening weekend
            if (weekSpan == 0) {
				if(utc){
					if ((dt.getUTCDay() + incr) > 4)
						retDate.setUTCDate(dt.getUTCDate() + incr + 2);
					else
						retDate.setUTCDate(dt.getUTCDate() + incr);
				}else{
					if ((dt.getDay() + incr) > 4)
						retDate.setDate(dt.getDate() + incr + 2);
					else
						retDate.setDate(dt.getDate() + incr);				
				}
            }
            // Otherwise add along with intervening weekend days
            else {
				if(utc)
					retDate.setUTCDate(dt.getUTCDate() + incr + (2*weekSpan));
				else
					retDate.setDate(dt.getDate() + incr + (2*weekSpan));
            }
            break;
        case 'ww':
			if(utc)
				retDate.setUTCDate(dt.getUTCDate() + (incr*7));
			else
				retDate.setDate(dt.getDate() + (incr*7));
            break;
        default:
            // Do nothing
            break;
        
    } 
    return retDate;
}

/*
 * Instance method that you can call on Date objects
 * var dt = new Date('10/31/2112'); 
 * var diff = dt.diff('d', new Date('12/31/2112')); 
 * return diff;
 * ========================
 */
Date.prototype.diff = function(interv, dt2, utc) {
    return Date.diff(interv, this, dt2, utc);
}

/*
 * Static method that requires a Date object passed in
 * ========================
 */
Date.diff = function(interv, dt1, dt2, utc) {

    /*
    yyyy - Year
    q - Quarter
    m - Month
    y - Day of year
    d - Day
    w - Weekday
    ww - Week of year
    h - Hour
    n - Minute
    s - Second
    */
    
    // Convert Unix timestamp to Date obj if need be
    var dtParam1 = (typeof dt1 == 'number') ? new Date(dt1) : dt1;
    // Convert Unix timestamp to Date obj if need be
    var dtParam2 = (typeof dt2 == 'number') ? new Date(dt2) : dt2; 
    var intervFlag = interv.toLowerCase();
    // Year, month
    var yeaDiff;
    var monDiff;
	if(utc){
		yeaDiff = dtParam2.getUTCFullYear() - dtParam1.getUTCFullYear();
		monDiff = (dtParam2.getUTCMonth() - dtParam1.getUTCMonth()) + (yeaDiff * 12);
	}else{
		yeaDiff = dtParam2.getFullYear() - dtParam1.getFullYear();
		monDiff = (dtParam2.getMonth() - dtParam1.getMonth()) + (yeaDiff * 12);	
	}
    // All others -- build incrementally
    var msDiff = dtParam2.getTime() - dtParam1.getTime(); // Millisecs
    var secDiff = msDiff/1000;
    var minDiff = secDiff/60;
    var houDiff = minDiff/60;
    var dayDiff = houDiff/24;
    // Counts number of seven-day intervals, not calendar weeks
    var weeDiff = dayDiff/7; 
    var ret = 0;
    
    switch(intervFlag) {
        case 'yyyy':
            ret = yeaDiff;
            break;
        case 'q':
            var mA = utc ? dtParam1.getUTCMonth() : dtParam1.getMonth();
            var mB = utc ? dtParam2.getUTCMonth() : dtParam2.getMonth();
            // Figure out which quarter the months are in
            var qA = parseInt(mA / 3) + 1;
            var qB = parseInt(mB / 3) + 1;
            // Add quarters for any year difference between the dates
            qB += (yeaDiff * 4);
            ret = qB - qA;
            break;
        case 'm':
            ret = monDiff;
            break;            
        case 'd':
        case 'y':
            // Daylight savings time switchover
            // Value will be over or under by an hour
            ret = dayDiff;
            break;
        case 'h':
            ret = houDiff;
            break;
        case 'n':
            ret = minDiff;
            break;
        case 's':
            ret = secDiff;
            break;
        case 'w':
            ret = dayDiff;
            break;
        case 'ww':
            ret = weeDiff;
            break;
        default:
            // Do nothing
            break;
        
    } 
    ret = Math.round(ret);
    return ret; // Return an integer
}

// ---------------------------------------------------------------------------------
// Augmented methods for the JavaScript Number(), Array(), String() and Date() objects
// ---------------------------------------------------------------------------------

// Clamp a number to a range
Number.prototype.clamp = function(min,max)
{
	var c = this;
	if(c < min)
		c = min;
	if(c > max)
		c = max;
	return c;
}

// Get characters from the right end of a string
String.prototype.right = function(n)
{
	if(n < this.length)
		return this.slice(this.length-n);
	else
		return this;
}


// ---------------------------------------------------------------------------------
// RGB colour object
// ---------------------------------------------------------------------------------

// Construct an RGB colour object from a '#rrggbb', '#rgb' or 'rgb(n,n,n)' string or from separate r,g,b values
function RGB(r,g,b)
{
	this.r = 0;
	this.g = 0;
	this.b = 0;
	if(typeof r == "string"){
		if(r.substr(0,1) == "#"){
			if(r.length == 7){
				this.r = parseInt(r.substr(1,2),16)/255;
				this.g = parseInt(r.substr(3,2),16)/255;
				this.b = parseInt(r.substr(5,2),16)/255;
			}else{
				this.r = parseInt(r.substr(1,1),16)/15;
				this.g = parseInt(r.substr(2,1),16)/15;
				this.b = parseInt(r.substr(3,1),16)/15;
			}
		}else{
			var rgbPattern = /rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/ ;
			var c = r.match(rgbPattern);
			if(c){
				this.r = parseInt(c[1],10)/255;
				this.g = parseInt(c[2],10)/255;
				this.b = parseInt(c[3],10)/255;
			}
		}
	}else{
		this.r = r;
		this.g = g;
		this.b = b;
	}
	return this;
}

// Mixes this colour with another in a specified proportion
// c = other colour to mix
// f = 0..1 where 0 is this colour and 1 is the new colour
// Returns an RGB object
RGB.prototype.mix = function(c,f)
{
	return new RGB(this.r + (c.r-this.r) * f,this.g + (c.g-this.g) * f,this.b + (c.b-this.b) * f);
}

// Return an rgb colour as a #rrggbb format hex string
RGB.prototype.toString = function()
{
	var r = this.r.clamp(0,1);
	var g = this.g.clamp(0,1);
	var b = this.b.clamp(0,1);
	return("#" + ("0" + Math.floor(r * 255).toString(16)).right(2) +
				 ("0" + Math.floor(g * 255).toString(16)).right(2) +
				 ("0" + Math.floor(b * 255).toString(16)).right(2));
}
 	

/*********************************************** GUI Elements **********************************************/

var PopUpButton = Base.extend({
	constructor: function(height, align, imageURL, imageWidth, imageHeight, delegate, valueList, fontSize){
		this.delegate = delegate;
		this.height = height;
		this.fontSize = fontSize;
		this.valueList = valueList;		
		this.align = align;
		var imgOffsetTop = Prototype.Browser.WebKit ? (-3) : (-1);
		var imgOffsetRight = Prototype.Browser.WebKit ? 1 : 0;
		this.HTMLElement = DIV(	{style:"position:absolute; top:4px; overflow:visible; height:"+height+"px; width:"+height+"px;"},
								this.image = IMG({src:imageURL, width:imageWidth, height:imageHeight, style:"position:absolute; right:"+((height-imageWidth)/2+imgOffsetRight)+"px; top:"+((height-imageHeight)/2+imgOffsetTop)+"px;"}));
		if(align == "left")
			this.HTMLElement.style.left = "0px";
		else 
			this.HTMLElement.style.right = "0px";					
		PWUtils.observe(this.HTMLElement, "click", this.handleClick.bindAsEventListener(this), true);
		this.HTMLElement.controller = this; 
	},
	
	createMenu: function(valueList){
		PWUtils.activateShield(this, 0);
		var selectedValue = this.selectedValue();
		this.menuItems = [];
		var parent = this.HTMLElement.parentNode;
		var body = document.getElementsByTagName("body")[0];
		var x = PWUtils.getX(this.HTMLElement.parentNode);
		var y = PWUtils.getY(this.HTMLElement.parentNode);

		var oldMenu = this.menu;
		if(this.menu)
			this.menu.removeChild(this.menu.childNodes[0]);
		else
			this.menu = DIV({style:"position:absolute; z-index:1; border:1px solid #aaa; background-color:#fff;"});
		var offsetX = 3; 
		var offsetY = 3;		
		if(Prototype.Browser.WebKit){
			offsetX = 1;
			offsetY = 1;
		}else if(Prototype.Browser.IE){
			offsetX = -2; 
			offsetY = -1;
		}
		this.menu.style.top = y+offsetY+parent.offsetHeight+"px";
		this.menu.style.left = x+offsetX+"px";
		this.menu.style.width = this.HTMLElement.parentNode.offsetWidth-1+"px";	
		var tableBody;
		this.table = TABLE({style:"width:100%; border-spacing:0px;"},
							tableBody = TBODY({style:"font-size:"+this.fontSize+";"}));		
		PWUtils.observe(this.table, "click", this.handleClick.bindAsEventListener(this), true);
		if(!valueList)
			valueList = this.valueList; 
		for(var i=0; i<valueList.length; i++){
			var td;
			var selected = selectedValue && selectedValue == valueList[i];
			var color = selected ? "#3d80df" : "#ffffff";
			var tr = TR( td = TD({style:"background-color:"+color+"; cursor:default; line-height:110%;"}));
			td.selected = selected;
			td.onmouseover = function() {this.style.backgroundColor = "#3d80df"; this.selected = true;};
			td.onmouseout = function() {this.style.backgroundColor = "#ffffff"; this.selected = false;};
			td.appendChild(document.createTextNode(valueList[i]));
			this.menuItems.push(td);			
			tableBody.appendChild(tr);
		}
		this.menu.appendChild(this.table);
		if(!oldMenu)
			body.appendChild(this.menu);	
	},
	
	hideMenu: function(){
		if(this.menu) {
			PWUtils.deactivateShield();
			this.menu.style.visibility = "hidden";
		}
	},
	
	showMenu: function(valueList){
		this.createMenu(valueList);
        var top        = PWUtils.getY(this.menu);
        var bottom     = top + this.menu.getHeight();
        var maxHeight  = document.viewport.getHeight();
        var diff       = maxHeight - bottom;
        if(diff < 0)
            this.menu.style.top = "" + (top + diff) + "px";
		this.menu.style.visibility = "visible";	
	},
	
	menuIsVisible: function(){
		return this.menu && this.menu.style.visibility == "visible";
	},
	
	handleClick: function(event, row){
		var event = event || window.event;
		if(!this.menu || this.menu.style.visibility == "hidden"){
			this.showMenu(this.valueList);
		}else{
			var target = event.srcElement ? event.srcElement : event.target;
			this.hideMenu();						
			if(target.tagName == "TD"){
				var value = target.innerHTML;
				if(this.delegate){
					if(value != this._value){
						this._value = value;
						this.delegate.popUpButtonValueChanged(this, this._value);
					}
					this.delegate.popUpButtonMenuClosed(this);
				}
			}
		}
		Event.stop(event);
	},
	
	clickedInShield: function() {
		this.hideMenu();
	},

	value: function(){
		return this._value;
	},
	
	selectPreviousMenuItem: function(){
		var found = false;
		for(var i=0; i<this.menuItems.length; i++){
			var td = this.menuItems[i];
			if(td.selected){
				this.menuItems[i].selected = false;
				td.style.backgroundColor = "#ffffff";
				if(i!=0){
					this.menuItems[i-1].style.backgroundColor = "#3d80df";
					this.menuItems[i-1].selected = true;
					found = true;
					break;
				}
			}
		}
		if(!found){
			this.menuItems[this.menuItems.length-1].style.backgroundColor = "#3d80df";
			this.menuItems[this.menuItems.length-1].selected = true;		
		}		
	},
	
	selectNextMenuItem: function(){
		var found = false;
		for(var i=0; i<this.menuItems.length; i++){
			var td = this.menuItems[i];
			if(td.selected){
				if(i!=this.menuItems.length-1){
					this.menuItems[i].selected = false;
					td.style.backgroundColor = "#ffffff";
					this.menuItems[i+1].style.backgroundColor = "#3d80df";
					this.menuItems[i+1].selected = true;
					found = true;
					break;
				}
			}
		}
		if(!found){
			this.menuItems[0].style.backgroundColor = "#3d80df";
			this.menuItems[0].selected = true;		
		}
	},
	
	selectedMenuItem: function(){
		if(this.menuItems) {
			for(var i=0; i<this.menuItems.length; i++){
				var td = this.menuItems[i];
				if(td.selected)
					return td;
			}
		}
		return null;
	},
	
	selectedValue: function(){
		var item = this.selectedMenuItem();
		return item ? item.innerHTML: null;
	}
	
	
});

var ComboBox = Base.extend({
	constructor: function(height, fontSize, arrowImageURL, imageWidth, imageHeight, value, valueList, width, name, autocomplete, delegate, openMenu){
		this.autocomplete = autocomplete;
		this.delegate = delegate;
		this.fontSize = fontSize;
		this.value = value;
		this.valueList = valueList;
		this.width = width;
		if(Prototype.Browser.WebKit)
			height-=3;
		this.HTMLElement = DIV({'class':'combobox', value:value, name:name, style:"height:"+(height+6)+"px; position:relative;"},
								this.textInput=INPUT({name:name, type:'text', value:value, style:"position:absolute; left:0px; top:-1px; margin:0px; height:"+height+"px; font-size:"+fontSize+"px"}));
		if(!this.width)
			this.textInput.style.right = height+"px";
		else
			this.textInput.style.width = this.width-height+"px";
		this.HTMLElement.controller = this;
		this.popUpButton = new PopUpButton(height, "right", arrowImageURL, imageWidth, imageHeight, this, valueList, this.fontSize);
		this.HTMLElement.appendChild(this.popUpButton.HTMLElement);
		if(this.autocomplete){
			PWUtils.observe(this.textInput, "keyup", this.onKeyUp.bindAsEventListener(this), true);
			PWUtils.observe(this.textInput, "keydown", this.onKeyDown.bindAsEventListener(this), true);
		}
		if(openMenu && this.popUpButton.valueList && this.popUpButton.valueList.length) {
			var button = this.popUpButton;
			var showMenu = function(){
				button.showMenu(button.valueList);
			}
			showMenu.delay(0.1);
		}
	},

	popUpButtonValueChanged: function(popUp, value){
		this.value = value;
		this.textInput.value = this.value;
		this.HTMLElement.value = this.value;
	},
	
	popUpButtonMenuClosed: function(popUp){
		if(this.delegate && this.delegate.comboBoxMenuClosed)
			this.delegate.comboBoxMenuClosed(this);
	},

	functionKeys: [112,113,114,115,116,117,118,119,120,121,122,123],

	onKeyUp: function(event){
		var keyCode = event.keyCode;
		var matchingValues = [];			
		if( keyCode == 8 || keyCode == 46 || (!this.functionKeys[keyCode] && keyCode != 13) ){	// 8 = backspace, 46 = delete
			var searchText = this.textInput.value.toUpperCase();
			if(searchText.length){
				for(var i=0; i<this.valueList.length; i++){
					var value = this.valueList[i];
					if(value.toUpperCase().indexOf(searchText) == 0){
						matchingValues.push(value);
					}
				}
			}
			if(matchingValues.length){
				this.popUpButton.showMenu(matchingValues);	
			}else{
				this.popUpButton.hideMenu();		
			}
		}
		return false;
	},
	
	onKeyDown: function(event){
		if(this.autocomplete && this.popUpButton.menuIsVisible()){
			var keyCode = event.keyCode;			
			if(keyCode == 38){	// up
				this.popUpButton.selectPreviousMenuItem();
			}else if( keyCode == 40){  // Down
				this.popUpButton.selectNextMenuItem();
			}else if( keyCode == 13){	// enter
				var value = this.popUpButton.selectedValue();
				if(value)
					this.textInput.value = value;
				this.popUpButton.hideMenu();
			}
		}
	}
});

var DatePicker = Base.extend({
	constructor: function(height, fontSize, calendarImageURL, value, width, name, formatter, displayTime){
		this.fontSize = fontSize;
		this.value = value;
		this.width = width;
		this.formatter = formatter;
		this.displayTime = displayTime;		
		if(Prototype.Browser.WebKit)
			height-=3;
		this.HTMLElement = DIV({'class':'datePicker', name:name, value:value, style:"position:relative; height:"+(height+6)+"px;"},
								this.image=IMG({width:14, height:14, src:calendarImageURL, style:"position:absolute; left:0px; top:"+((height+6-14)*0.5)+"px;"}),
								this.textInput=INPUT({name:name, type:'text', value:this.formatter.stringForObjectValue(value), style:"position:absolute; top:0px; margin:0px; width:"+(this.width-height)+"px; left:"+height+"px; height:"+height+"px; font-size:"+fontSize+"px;"}));
		PWUtils.observe(this.image, "click", this.handleClick.bindAsEventListener(this), true);
		this.HTMLElement.controller = this;
	},
		
	handleClick: function(event, row){
		PWUtils.notificationCenter.addObserverForMessage(this, "click", "handleNotification");
		var event = event || window.event;
		var target = event.srcElement ? event.srcElement : event.target;
		var date = this.formatter.objectValueForString(this.textInput.value);
		if(!date)
			date = new Date();
		displayCalendar(date, true, this, this.textInput, this.formatter.format(), target, this.displayTime);
		Event.stop(event);
	},
	
	datePickerDidClose: function(date){
		this.textInput.value = this.formatter.stringForObjectValue(date);
		PWUtils.notificationCenter.sendMessage("datePickerDidClose", this.textInput);
	},
	
	handleNotification: function(msg, context){
		if(msg = "click"){
			var event = context || window.event;
			var target = event.srcElement ? event.srcElement : event.target;
			if(!elementBelongsToCalendar(target)){
				closeCalendar();
				PWUtils.notificationCenter.removeObserverForMessage(this, "click");
				Event.stop(context);
			}
		}
	}

});


// ........................................
// EVENT EXTENSIONS
// 
Object.extend(Event,{
  // get the character code for key pressed events.
  getCharCode: function(e) {
    return (e.keyCode) ? e.keyCode : ((e.which)?e.which:0) ; 
  },
  
  // get the pressed char as a string.
  getCharString: function(e) {
    return String.fromCharCode(Event.getCharCode(e)) ;
  },
  
  ALT_KEY: '_ALT',
  CTRL_KEY: '_CTRL',
  SHIFT_KEY: '_SHIFT'
  
});

var SegmentButton = Base.extend({
	constructor: function(segmentDescription, selectedSegmentIndex) {
		this.base();
		this.segmentDescription = segmentDescription;
		this.selectedSegmentIndex = selectedSegmentIndex;
		this.allCells = [];
		this.reactOnMouseOut = false;
		this.tempSelectedSegmentIndex = -1;
		for(var i=0; i<segmentDescription.length; i++){
			var segment = segmentDescription[i].segment;
			var method = segmentDescription[i].method;
			if(segment instanceof Array){	// button segments
				for(var x=0; x<segment.length; x++){
					var buttonPart = segment[x];
					buttonPart.origClassName = buttonPart.className;
					buttonPart.onmousedown = this.mouseDown.bindAsEventListener(this); 
					buttonPart.onmouseup = this.mouseUp.bindAsEventListener(this);
					buttonPart.onmouseout = this.mouseOut.bindAsEventListener(this);
					buttonPart.onmouseover = this.mouseOver.bindAsEventListener(this);
					buttonPart.segmentIndex = i;
					this.allCells.push(buttonPart);
				}
			}else{	// splitter segment
				segment.origClassName = segment.className;
				this.allCells.push(segment);
			}
		}
		if(this.selectedSegmentIndex != null)
			this.selectSegmentAtIndex(selectedSegmentIndex);
		this.mouseIsUp = false;
		var me = this;
		var MouseUpDetector = Base.extend({
			constructor: function(){
				PWUtils.observe($("body"), "mouseup", this.mouseUp.bindAsEventListener(this));
			},
			mouseUp: function(event){
				me.mouseIsUp = true;
			}
		});
		this.mouseUpDetector = new MouseUpDetector();	
		
	},
	
	cellFromEvent: function(event){
		var event = event || window.event;
		var cell = event.srcElement ? event.srcElement : event.target;
		while(cell.tagName != "TD")
			cell = cell.parentNode;
		return cell;			
	},

	cellsForSegmentIndex: function(index){
		var cells = [];
		var segment = this.segmentDescription[index];
		for(var i=0; i<segment.segment.length; i++)
			cells.push(segment.segment[i]);
		if(index != 0){
			var prevSegment = this.segmentDescription[index-1];
			if(typeof(prevSegment.segment) != "array")
				cells.push(prevSegment.segment);
		}
		var nextSegment = this.segmentDescription[index+1];
		if(nextSegment && typeof(nextSegment.segment) != "array")
			cells.push(nextSegment.segment);
		return cells;
	},
	
	relatedCells: function(cell){
		return this.cellsForSegmentIndex(cell.segmentIndex);
	},
	
	markCells: function(cells, mark){
		for(var i=0; i<cells.length; i++)
			cells[i].className = cells[i].origClassName + (mark ? mark : "");
	},
	
	selectSegmentAtIndex: function(index){
		this.segmentDescription[index].method.call();
		this.markCells(this.cellsForSegmentIndex(index), "Selected");
		this.selectedSegmentIndex = index;
	},
	
	activateSegmentAtIndex: function(index) {
		this.markCells(this.allCells);
		this.selectSegmentAtIndex(index);
	},

	mouseDown: function(event){
		var cell = this.cellFromEvent(event);
		this.markCells(this.relatedCells(cell), cell.segmentIndex == this.selectedSegmentIndex ? "SelectedPressed" :  "Pressed");
		this.tempSelectedSegmentIndex = cell.segmentIndex;
		this.mouseIsUp = false;
		this.reactOnMouseOut = true;
	},
	
	mouseUp: function(event){
		var cell = this.cellFromEvent(event);
		this.markCells(this.allCells);
		this.selectSegmentAtIndex(cell.segmentIndex);
		this.tempSelectedSegmentIndex = -1;
		this.reactOnMouseOut = false;
	},

	mouseOut: function(event){
		if(this.reactOnMouseOut){
			this.markCells(this.relatedCells(this.cellFromEvent(event)));
			this.selectSegmentAtIndex(this.selectedSegmentIndex);
		}
	},

	mouseOver: function(event){
		if(this.tempSelectedSegmentIndex != -1 && this.mouseIsUp)
			this.tempSelectedSegmentIndex = -1;
		var cell = this.cellFromEvent(event);
		if(this.tempSelectedSegmentIndex == cell.segmentIndex)
			this.markCells(this.relatedCells(cell), cell.segmentIndex == this.selectedSegmentIndex ? "SelectedPressed" :  "Pressed");
	}
	
});

function pointIsInElement(x, y, elem)
{
	var offset = Element.viewportOffset(elem);
	var right = offset.left+elem.getWidth();
	if(x<offset.left || x>right)
		return false;
	var bottom = offset.top+elem.getHeight();
	if(y<offset.top || y>bottom)
		return false;
	return true;
}

/* ************************************ Popup-Menu: **************************************** */

var popUpIsVisible = false;

function removePopUpMenuEventHandlerFromElement(element) {
	PWUtils.stopObserving(element, 'click', element._mouseUp);
	PWUtils.stopObserving(element, 'mousedown', element._mouseDown);
	PWUtils.stopObserving(element, 'mouseup', element._mouseUp);	
	PWUtils.setSelectionEnabled(element, true);
}

function makePopUpMenuForElement(element, value, options, selectionDidChangeMethod, shouldOpenMenuMethod, onClickMethod, optionsMethod, context) {
	var mouseX;
	var mouseY;
	var timer = 0;
	var date = 0;
	var table = null;
	var wantsToClose = false;
	
	PWUtils.setSelectionEnabled(element, false);
	if(options.pullDown && !options.delay)
		options.delay = 0.1;

	function shouldOpenMenu(event) {
		if(popUpIsVisible)
			return false;
		if(shouldOpenMenuMethod) {
			if((context && !shouldOpenMenuMethod.call(context, event)) || (!context && !shouldOpenMenuMethod(event)))
				return false;
		}
		return true;
	}
	
	function fetchPositionFromEvent(event) {
		mouseX = Event.pointerX(event);
		mouseY = Event.pointerY(event);	
	}

	element._mouseDown = function(event) {
		if(popUpIsVisible) {
			closeMenu();
			wantsToClose = true;
			return;
		}

		fetchPositionFromEvent(event);
		timer = showMenu.delay(options.delay, event);
		date = new Date();
	}

	element._mouseUp = function(event) {
		if(wantsToClose) {
			wantsToClose = false;
			return;
		}
		if(timer)
			window.clearTimeout(timer);
		fetchPositionFromEvent(event);
		if(!popUpIsVisible && (!options.delay || ((table && pointIsInElement(mouseX, mouseY, table)) || pointIsInElement(mouseX, mouseY, element)))) {
			if(onClickMethod){
				if(context)
					onClickMethod.call(context, element);
				else
					onClickMethod(element);
			}else 
				showMenu(event);
		}
	}

	function fetchOptions() {
		var result = options;
		if(optionsMethod) {
			result = context ? optionsMethod.call(context) : optionsMethod();
        }
		return result;
	}

	if(!options.pullDown)
		PWUtils.observe(element, 'click', element._mouseUp, false);
	else {
		PWUtils.observe(element, 'mousedown', element._mouseDown, false);
		PWUtils.observe(element, 'mouseup', element._mouseUp, false);
	}
	
	function closeMenu(newValue, changeValue) {
		PWUtils.stopObserving($$('body')[0], 'mousemove', handleMouseMove);
		if(options.removeAfterFirstClick) {
			if(!options.pullDown)
				PWUtils.stopObserving(element, 'click', element._mouseUp);
			else{
				PWUtils.stopObserving(element, 'mousedown', element._mouseDown);
				PWUtils.stopObserving(element, 'mouseup', element._mouseUp);				
			}
		}
		if(changeValue && selectionDidChangeMethod) {
			if(context)
				selectionDidChangeMethod.call(context, element, newValue);
			else
				selectionDidChangeMethod(element, newValue);
		}
		table.parentNode.removeChild(table);
		popUpIsVisible = false;
	}
	
	function handleMouseMove(event) {
		event = event || window.event;
		var x = Event.pointerX(event);
		var y = Event.pointerY(event)
		if(!pointIsInElement(x, y, table) && !pointIsInElement(x, y, element))
			closeMenu(value, false);				
	}
	
	function showMenu(event) {
		if(!shouldOpenMenu(event))
			return;	
		
		options = fetchOptions();
		if(!options.order)
			options.order = Object.keys(options.enums);
		if(options.pullDown && !options.delay)
			options.delay = 0.1;
		options.offsetTop = options.offsetTop || 0;
		options.offsetLeft = options.offsetLeft || 0;

		table = document.createElement('table');
		table.className='popUpMenu';
		if(options.minWidth)
			table.width = options.minWidth+"px";
		var tableBody = document.createElement('tbody');
		table.appendChild(tableBody);
		if(Prototype.Browser.IE)
			table.style.borderCollapse="collapse";
					
		function firstMenuItemClass() {
			return options.pullDown ? " firstMenuItemPullDown" : " firstMenuItem";
		}

		var hasGroups = false;
		var index = 0;
		var selectedIndex = 0;
		for(var i=0; i<options.order.length; i++){
			var key = options.order[i];            
			var title = options.enums[key];
			var isSeparatorItem = title.startsWith('//separator');
			var isGroupItem = title.startsWith('//') && !isSeparatorItem;
			if(isGroupItem && title.length > 2)
				title = title.substr(2);
			if(isGroupItem)
				hasGroups = true;
			if(key == value)
				selectedIndex = index;
			index++;
			var td;
			var tr = TR( td = TD() );
			td.originalClassName = "popUpMenuItem"
			td.className = "popUpMenuItem"
			if(i==0) {
				td.className += firstMenuItemClass();
				td.first = true;
			}
			if(i==options.order.length-1) {
				td.className += " lastMenuItem";
				td.last = true;			
			}
			if(!isGroupItem && !isSeparatorItem) {
				td.onmouseover = function(event) {							
					event = event || window.event;
					this.className = "popUpMenuItemSelected";
					if(this.first)
						this.className += firstMenuItemClass();
					if(this.last)
						this.className += " lastMenuItem";
				};
				td.onmouseout = function(event) {
					event = event || window.event;
					this.className = "popUpMenuItem";
					if(this.first)
						this.className += firstMenuItemClass();
					if(this.last)
						this.className += " lastMenuItem";
				};
			}
			
			function action(event) {
				event = event || window.event;
				var elem = Event.element(event);
				while(elem && elem.tagName != 'TD')
					elem = elem.parentNode;
				var newValue = elem.menuValue;
				closeMenu(newValue, true);
				Event.stop(event);			
			}

			if(options.pullDown)
				td.onmouseup = action;
			else
				td.onclick = action;
			
			var content = SPAN();
			if(options.images) {
				var image = options.images[key];
				var img;
				if(image) {
					content.appendChild(img = IMG({src:image}));
					if(options.imageClass)
						img.className = options.imageClass;
				}
			}
			if(!options.showOnlyImages) {
				if(isGroupItem)
					content.style.color = "#999";
				else if(hasGroups) 
					content.style.paddingLeft = "12px";
				if(!isSeparatorItem)
					content.appendChild(document.createTextNode(title))
			}
			if(isSeparatorItem)
				content.appendChild(DIV({'class':'separator'}))
			td.appendChild(content);
			td.menuValue = key;
			tableBody.appendChild(tr);						
		}
		$$("body")[0].appendChild(table);
		table = $(table);
		var rowHeight = table.getHeight()/index;
		var width = table.getWidth();
		if(options.pullDown) {
			table.style.top = PWUtils.getY(element)+element.offsetHeight+options.offsetTop+"px";
			table.style.left = PWUtils.getX(element)+options.offsetLeft+"px";		
		}else{
			table.style.top = mouseY-rowHeight/2-rowHeight*selectedIndex +"px";
			table.style.left = mouseX-width/2+ "px"; 
		}
		table.style.visibility = "visible";
		PWUtils.observe($$('body')[0], 'mousemove', handleMouseMove, false);
		popUpIsVisible = true;
	};
}

/* ************************************ Alerts: **************************************** */

var gModalWindow = null;

var ModalAlert = Base.extend({
    constructor: function(text, subtext, image, onclick, options) {
		this.base();
		this.onclick = onclick;
		this.options = options || {};
		this.options.buttons = (options && options.buttons) || ['OK'];
		this.shakeOffset = 0;
		this.windowResizedActionEventListener = this.center.bindAsEventListener(this);	
		this.shield = $(DIV({'class':'alertShield'}));
		var titleAlignment = this.options.titleAlignment ? this.options.titleAlignment : 'left';
		this.alertContainer =	$(DIV({'class':'alertContainer'}, 
									TABLE({'class':'alertTable'}, 
										TBODY({}, 
											  TR({}, TD({'id':'alertImageContainer'}), TD({'id':'alertTextContainer', style:'text-align:'+titleAlignment+';'}, SPAN({'id':'alertText'}), P({}, SPAN({'id':'alertSubtext'})))),
											TR({}, TD({'id':'alertButtonContainer', colSpan:(image ? 2 : 1)}))
										)
									)
								));
		$$('body')[0].insert(this.shield);
		$$('body')[0].insert(this.alertContainer);
		if(!image)
			$('alertImageContainer').remove();
		else
			$('alertImageContainer').insert(IMG({'id':'alertIcon', src:image}));
		var me = this;
		for(var i=0; i<this.options.buttons.length; i++){
			var label = this.options.buttons[i];
			var button 
			if(Prototype.Browser.IE) {	// I don't get the other button rendered correctly in IE so I use standard buttons
				button= $(BUTTON({'class':'IEAlertButton', type:'button'}));
				button.appendChild(document.createTextNode(label));
			}else{
				var blue = i==0 ? '_blue' : '';
				button= $(TABLE({'class':'Button'}, TR({}, TD({'class':'segment1'+blue, style:'padding-left:0px;'}), TD({'class':'segment2'+blue}), TD({'class':'segment4'+blue}))));
				button.select('.segment2'+blue)[0].appendChild(document.createTextNode(label));
			}
			button.isFirstButton = i==0;
			button.onclick = function(event) {
				event = event || window.event;
				var element = Event.element(event);
				while(!element.value)
					element = element.parentNode;
				var isValid = true;
				if(me.options.onValidate && element.isFirstButton) {
					isValid = me.options.onValidate(this);				
				}
				if(isValid) {
					if(onclick)
						me.onclick(element.value);
					me.hide();
				}else
					me.shake();
			};
			button.value = label;
			$('alertButtonContainer').insert(button);
			PWUtils.setSelectionEnabled(button, false);
		}
		if(text)
			$('alertText').appendChild(document.createTextNode(text));
		if(subtext) {
			if(typeof subtext == 'string')
				$('alertSubtext').appendChild(document.createTextNode(subtext));
			else {
				this.customElement = subtext;
				$('alertSubtext').appendChild(subtext);	
				this.inputs = $('alertSubtext').select('INPUT');
				if(this.inputs && this.inputs.length) {
					var me = this;
					window.setTimeout(function(){
						me.selectNextInput(); 
					}, 10);
				}
			}
		}
		this.alertWidth = this.alertContainer.getWidth(); 
		this.alertHeight = this.alertContainer.getHeight(); 
		this.alertContainer.style.top = -this.alertHeight+"px";
		this.alertContainer.style.visibility = "visible";
		this.center();
		this.show();
	},
	
	selectNextInput: function() {
		if(this.inputs) {
			var newFocusedInput = this.inputs[0];
			for(var i=0; i<this.inputs.length; i++) {
				var input = this.inputs[i];
				if(input.isFocused) {
					input.isFocused = false;
					if(i+1<this.inputs.length)
						newFocusedInput = this.inputs[i+1];
				}
			}
			if(newFocusedInput.focus) {
				newFocusedInput.focus();
				if(newFocusedInput.select)
					newFocusedInput.select();
			}					
			newFocusedInput.isFocused = true;			
		}
	},

	hide: function() {
		var me = this;
		PWUtils.stopObserving(window, "resize", this.windowResizedActionEventListener);		
		new Fx.Style(this.alertContainer, 'top', {duration:200, onComplete:function(){Element.remove(me.alertContainer);}})._start(0, -this.alertHeight);
		if(Prototype.Browser.WebKit){
			Element.remove(me.shield); 
			delete gModalWindow; 
			gModalWindow = null;	
		}else
			new Fx.Style(this.shield, 'opacity', {duration:200, onComplete:function(){ Element.remove(me.shield); delete gModalWindow; gModalWindow = null;}})._start(0.2, 0);		
	},

	center: function() {
		this.alertContainer.style.left = (((Prototype.Browser.IE ? document.documentElement.clientWidth : window.innerWidth)-this.alertWidth)/2)+this.shakeOffset+"px";
	},

	shake: function() {
		var shakeTimer;
		var shakes = 8;
		var me = this;
		var shakerMethod = function() {
			me.shakeOffset = ((shakes--)%2==0) ? 20 : 0;
			me.center();
			if(!shakes)
				window.clearInterval(shakeTimer);
		}
		shakeTimer = window.setInterval(shakerMethod, 50);
	},

	show: function() {
		PWUtils.observe(window, "resize", this.windowResizedActionEventListener, true);
		if(!Prototype.Browser.WebKit)
			new Fx.Style(this.shield, 'opacity', {duration:200})._start(0, 0.2);
		new Fx.Style(this.alertContainer, 'top', {duration:200})._start(-this.alertHeight, -10);
	},

	handleKeyboardEvent: function(event, keys) {
		var key = keys.length ? keys[0] : null;
		if(key) {
			var button = 0;
			if(key == "esc" && this.options.buttons.length > 1)
				button = 1;
			if(key == "esc" || key == "enter"){
				var isValid = true;
				if(this.options.onValidate && key == "enter")
					isValid = this.options.onValidate(this);
				if(isValid || key == "esc") {
					if(this.onclick)
						this.onclick(this.options.buttons[button], this);
					this.hide();
				}else
					this.shake();
			}
			if(key == "tab")
				this.selectNextInput();
		}
	}
});

var disableAlert = false;

function runAlert(text, subtext, image, onclick, options) {
	if(disableAlert)
		return;
	if(!gModalWindow)
		gModalWindow = new ModalAlert(text, subtext, image, onclick, options);
}

function runLoginDialog(title, onValidate, context, environment, username, pwd, possibleUsernames) {
	var user		= environment.localizedString("Name:");
	var password	= environment.localizedString("Password:");
	var ok			= environment.localizedString("OK");
	var cancel		= environment.localizedString("Cancel");
	var buttons		= [ok, cancel];
	var userInput;
	var passwordInput;
	var form;
	pwd = pwd || '';
	username = username || '';

	if(possibleUsernames && possibleUsernames.length){
		if(Prototype.Browser.IE){
			form = FORM({style:'overflow:hidden;'}, 
								SPAN({}, user), SPAN({}, userInput = SELECT({name:'username', style:'width:97%;'})),
								SPAN({}, password), SPAN({}, passwordInput = INPUT({type:'password', style:'width:97%;', value:pwd}))
							);
		}else{				
			form = FORM({style:'overflow:hidden;'}, 
								TABLE({style:'width:300px;'},
									TR({}, TD({style:'text-align:right;'}, SPAN({}, user)), TD({style:'overflow:hidden; width:218px;'}, userInput = SELECT({name:'username', style:'width:97%;'}))), 
									TR({}, TD({style:'text-align:right;'}, SPAN({}, password)), TD({style:'overflow:hidden; width:218px;'}, passwordInput = INPUT({type:'password', style:'width:97%;', value:pwd}))) 
								)
							);	
		}		
		for(var i=0; i<possibleUsernames.length; i++) {
			var aUsername = possibleUsernames[i];
			var option = OPTION({value:i, label:aUsername}, aUsername);
			userInput.appendChild(option);
		}
	}else{
		if(Prototype.Browser.IE){
			form = FORM({style:'overflow:hidden;'}, 
							SPAN({}, user), SPAN({}, userInput = INPUT({type:'text', style:'width:97%;', value:username})),
							SPAN({}, password), SPAN({}, passwordInput = INPUT({type:'password', style:'width:97%;', value:pwd}))
						);
		}else{							
			form = FORM({style:'overflow:hidden;'}, 
								TABLE({style:'width:300px;'},
									TR({}, TD({style:'text-align:right;'}, SPAN({}, user)), TD({style:'overflow:hidden; width:218px;'}, userInput = INPUT({type:'text', style:'width:97%;', value:username}))), 
									TR({}, TD({style:'text-align:right;'}, SPAN({}, password)), TD({style:'overflow:hidden; width:218px;'}, passwordInput = INPUT({type:'password', style:'width:97%;', value:pwd}))) 
								)
							);
		}
	}

	var validate = function(alert){
		var isValid = true;
		if(onValidate) {
			var theUsername = userInput.value;
			if(possibleUsernames && possibleUsernames.length)
				theUsername = possibleUsernames[userInput.value];
			isValid = onValidate(theUsername, passwordInput.value, context);
		}
		return isValid;
	}
	
	runAlert(title, form, environment.images.Hut, null, {buttons:buttons, onValidate:validate});		
}

function modalWindow(){
	return gModalWindow;
}

function showAboutBox(html, subtitle, copyright) {
	var pos = 120;
	var timer = null;
	var credits;
	var shield = $(DIV({'class':'alertShield', style:'cursor:default;'}));
	aboutBox =	$( DIV({'id':'aboutBox'}, 
				   SPAN({'class':'title'}, 'Merlin Web'),
				   SPAN({'class':'subtitle'}, subtitle),
				   DIV({'id':'creditsContainer'}, credits = DIV({'id':'creditsText'})),
				   DIV({'class':'topFade'}),
				   DIV({'class':'bottomFade'}),
				   SPAN({'class':'copyright'}, copyright) ));
	credits = $(credits);
	credits.innerHTML = html;

	function center() {
		aboutBox.style.left=(((Prototype.Browser.IE ? document.documentElement.clientWidth : window.innerWidth)-620)/2)+"px";
	}
	center();

	$$('body')[0].insert(shield);
	$$('body')[0].insert(aboutBox);		

	function scroll() {
	  	pos -=1;
	  	if (pos < 0-credits.getHeight()+130) 
			pos=120;
	  	credits.style.top=pos+"px";
	  	timer = window.setTimeout(scroll,30);
	}
	scroll();
	new Fx.Style(shield, 'opacity', {duration:1000})._start(0.0, 0.2);
	if(Prototype.Browser.IE)
		aboutBox.style.visibility = 'visible';
	else
		new Fx.Style(aboutBox, 'opacity', {duration:1000})._start(0.0, 1.0);		
	shield.onclick = aboutBox.onclick = function(event) {
		if(Prototype.Browser.IE)
			Element.remove(aboutBox);
		else
			new Fx.Style(aboutBox, 'opacity', {duration:500, onComplete:function(){ Element.remove(aboutBox);}})._start(1.0, 0.0);
		new Fx.Style(shield, 'opacity', {duration:500, onComplete:function(){ Element.remove(shield); }})._start(0.2, 0);		
		PWUtils.stopObserving(window, "resize", center);
		window.clearTimeout(timer);
	}
	PWUtils.observe(window, "resize", center, true);
}


/* ************************************ Tooltips: **************************************** */

var gTooltip = null;

var Tooltip = Base.extend({
	constructor: function(element, message, options) {
		this.base();
		Tooltip.detach(element);
		this.options = options || {};
		this.options.delay = typeof this.options.delay != 'undefined' || 300;
		this.fadeInOutTime = 300;
		this.element = element;
		this.message = message;
		this.mouseMoveEventListener = this.mouseMove.bindAsEventListener(this);
		this.mouseOutEventListener = this.mouseOut.bindAsEventListener(this);
		this.mouseDownEventListener = this.mouseDown.bindAsEventListener(this);
		PWUtils.observe(this.element, "mousemove", this.mouseMoveEventListener);
		PWUtils.observe(this.element, "mouseout", this.mouseOutEventListener);		
		PWUtils.observe(this.element, "mousedown", this.mouseDownEventListener);		
	},
		
	detach: function() {
		this.hide();
        PWUtils.stopObserving(this.element, 'mousemove', this.mouseMoveEventListener);
        PWUtils.stopObserving(this.element, 'mouseout', this.mouseOutEventListener);
	},

	show: function(pos){
		if(!gTooltip) {
			gTooltip = $(SPAN({'class':'tooltip'}));	
			gTooltip.style.visibility = 'hidden';
			$$('body')[0].appendChild(gTooltip);
		}
		if(gTooltip.activeTooltip && gTooltip.activeTooltip != this)
			gTooltip.activeTooltip.hide();
		if(gTooltip.activeTooltip && gTooltip.activeTooltip != this || !gTooltip.activeTooltip)
			gTooltip.innerHTML = this.message;			
		gTooltip.activeTooltip = this;		
		pos.x += 10;
		pos.y += 20;
		if(!this.width) {
			gTooltip.style.left = "0px";
			this.width = gTooltip.getWidth();
		}
		var rightEdge = pos.x+this.width;
		var bodyWidth = $$('body')[0].getWidth();
		var xOffset = bodyWidth-rightEdge;
		if(xOffset < 0)
			pos.x += (xOffset-20);
		gTooltip.style.left = pos.x + "px";
		gTooltip.style.top = pos.y + "px";
		if(!this.isVisible) {
			new Fx.Style(gTooltip, 'opacity', {duration:this.fadeInOutTime})._start(0, 0.9);
			this.isVisible = true;
		}
	},
	
	hide: function(){
		if(gTooltip && gTooltip.activeTooltip.isVisible) {
			new Fx.Style(gTooltip, 'opacity', {duration:this.fadeInOutTime})._start(0.9, 0);		
			gTooltip.activeTooltip.isVisible = false;
		}
	},
	
	mouseMove: function(event) {
		event = event || window.event;
		if(!this.mouseDownInElement){ 
			var pos = {x:Event.pointerX(event), y:Event.pointerY(event)};
			if(!this.isVisible){
				if(this.timer)
					window.clearTimeout(this.timer);
				var me = this;
				var method = function() { 
					me.show(pos); 
				}
				this.timer = method.delay(this.options.delay/1000);
			}else
				this.show(pos);
		}
	},

	stopTimer: function() {
		if(this.timer){
			window.clearTimeout(this.timer);
			this.timer = null;
		}	
	},

	mouseOut: function(event) {
		this.stopTimer();
		this.mouseDownInElement = false;
		this.hide();
	},

	mouseDown: function(event) {
		this.stopTimer();		
		this.mouseDownInElement = true;
		this.hide();
	}	
},{	
	attach: function(element, message, options){
		return element ? new Tooltip(element, message, options) : null;
	},
	
	detach: function(element){
		if(element && element.tooltip)
			element.tooltip.detach();
	}
});

/* ************************************ Tooltips: **************************************** */

function addBehaviorToMainMenu(menu){
	if(Prototype.Browser.IE)
		return;
	
	menu = $(menu);
	var showMenus = false;
	var activeItemInLevel = [];
	var items = menu.select('li');

	function cleanup () {
		PWUtils.stopObserving($$('body')[0], 'click', cleanup);
		items.each(function(item) {
			item.setAttribute('lang','');	// IE7 attribute selectors are not recognized if artificial attributes are used 
		});									// Therefore I use the 'lang' attribute.
		showMenus = false;
		menu.setAttribute('lang', '');				
		activeItemInLevel = [];		
	}

	items.each(function(item){
		item.level = 0;
		var iterItem = item;
		while(iterItem != menu) {
			if(iterItem.tagName != "UL")
				item.level++;
			iterItem=iterItem.parentNode;
		}
		if(item.level == 1){
			item.onclick = function(event) {
				showMenus = !showMenus;
				menu.setAttribute('lang', showMenus ? 'opened' : '');				
				if(showMenus){
					activeItemInLevel[item.level] = item;				
					item.setAttribute('lang', 'opened');
					PWUtils.observe($$('body')[0], 'click', cleanup);
				}else
					cleanup();
				Event.stop(event || window.event);
			};
		}		
		item.onmouseover = function(event){			
			var lastItemInThisLevel = activeItemInLevel[item.level];
			if(lastItemInThisLevel && (item != lastItemInThisLevel)) {
				items.each(function(item){
					item.setAttribute('lang', '');
				});
			}
			activeItemInLevel[item.level] = item;
			item.setAttribute('lang', 'opened');
		}
	});
}
//console.log("Date.js");

// ========================================================================
// SproutCore
// copyright 2006-2007 Sprout Systems, Inc.
// ========================================================================

// Extensions to the Date object. Comes from JavaScript Toolbox at:
// http://www.mattkruse.com/javascript/date/source.html

// ------------------------------------------------------------------
// These functions use the same 'format' strings as the 
// java.text.SimpleDateFormat class, with minor exceptions.
// The format string consists of the following abbreviations:
// 
// Field        | Full Form          | Short Form
// -------------+--------------------+-----------------------
// Year         | yyyy (4 digits)    | yy (2 digits), y (2 or 4 digits)
// Month        | MMM (name or abbr.)| MM (2 digits), M (1 or 2 digits)
//              | NNN (abbr.)        |
// Day of Month | dd (2 digits)      | d (1 or 2 digits)
// Day of Week  | EE (name)          | E (abbr)
// Hour (1-12)  | hh (2 digits)      | h (1 or 2 digits)
// Hour (0-23)  | HH (2 digits)      | H (1 or 2 digits)
// Hour (0-11)  | KK (2 digits)      | K (1 or 2 digits)
// Hour (1-24)  | kk (2 digits)      | k (1 or 2 digits)
// Minute       | mm (2 digits)      | m (1 or 2 digits)
// Second       | ss (2 digits)      | s (1 or 2 digits)
// AM/PM        | a                  |
//
// NOTE THE DIFFERENCE BETWEEN MM and mm! Month=MM, not mm!
// Examples:
//  "MMM d, y" matches: January 01, 2000
//                      Dec 1, 1900
//                      Nov 20, 00
//  "M/d/yy"   matches: 01/20/00
//                      9/2/00
//  "MMM dd, yyyy hh:mm:ssa" matches: "January 01, 2000 12:30:45AM"
// ------------------------------------------------------------------

Date.MONTH_NAMES=new Array('January','February','March','April','May','June','July','August','September','October','November','December','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec');
Date.DAY_NAMES=new Array('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sun','Mon','Tue','Wed','Thu','Fri','Sat');



function LZ(x) {return(x<0||x>9?"":"0")+x}

Object.extend(Date,{
  
  // ------------------------------------------------------------------
  // isDate ( date_string, format_string )
  // Returns true if date string matches format of format string and
  // is a valid date. Else returns false.
  // It is recommended that you trim whitespace around the value before
  // passing it to this function, as whitespace is NOT ignored!
  // ------------------------------------------------------------------
  isDate: function(val,format) {
  	var date = Date.getDateFromFormat(val,format);
  	if (date==0) { return false; }
  	return true;
	},

  // -------------------------------------------------------------------
  // compareDates(date1,date1format,date2,date2format)
  //   Compare two date strings to see which is greater.
  //   Returns:
  //   1 if date1 is greater than date2
  //   0 if date2 is greater than date1 of if they are the same
  //  -1 if either of the dates is in an invalid format
  // -------------------------------------------------------------------
  compareDates: function(date1,dateformat1,date2,dateformat2) {
  	var d1= Date.getDateFromFormat(date1,dateformat1);
  	var d2= Date.getDateFromFormat(date2,dateformat2);
  	if (d1==0 || d2==0) {
  		return -1;
  		}
  	else if (d1 > d2) {
  		return 1;
  		}
  	return 0;
	},
	
  // ------------------------------------------------------------------
  // getDateFromFormat( date_string , format_string )
  //
  // This function takes a date string and a format string. It matches
  // If the date string matches the format string, it returns the 
  // getTime() of the date. If it does not match, it returns 0.
  // ------------------------------------------------------------------
  getDateFromFormat: function(val,format, utc) {
  	val=val+"";
  	format=format+"";
  	var i_val=0;
  	var i_format=0;
  	var c="";
  	var token="";
  	var token2="";
  	var x,y;
  	var now=new Date();
  	var year=utc ? now.getUTCFullYear() : now.getFullYear();
  	var month=(utc ? now.getUTCMonth() : now.getMonth())+1;
  	var date=1;
  	var hh=utc ? now.getUTCHours() : now.getHours();
  	var mm=utc ? now.getUTCMinutes() : now.getMinutes();
  	var ss=utc ? now.getUTCSeconds() : now.getSeconds();
  	var ampm="";

  	while (i_format < format.length) {
  		// Get next token from format string
  		c=format.charAt(i_format);
  		token="";
  		while ((format.charAt(i_format)==c) && (i_format < format.length)) {
  			token += format.charAt(i_format++);
  			}
  		// Extract contents of value based on format token
  		if (token=="yyyy" || token=="yy" || token=="y") {
  			if (token=="yyyy") { x=4;y=4; }
  			if (token=="yy")   { x=2;y=2; }
  			if (token=="y")    { x=2;y=4; }
  			year=Date._getInt(val,i_val,x,y);
  			if (year==null) { 
				return 0; 
			}
  			i_val += year.length;
  			if (year.length==2) {
  				if (year > 70) { year=1900+(year-0); }
  				else { year=2000+(year-0); }
  				}
  			}
  		else if (token=="MMM"||token=="NNN"){
  			month=0;
  			for (var i=0; i<Date.MONTH_NAMES.length; i++) {
  				var month_name=Date.MONTH_NAMES[i];
  				if (val.substring(i_val,i_val+month_name.length).toLowerCase()==month_name.toLowerCase()) {
  					if (token=="MMM"||(token=="NNN"&&i>11)) {
  						month=i+1;
  						if (month>12) { month -= 12; }
  						i_val += month_name.length;
  						break;
  						}
  					}
  				}
				if ((month < 1)||(month>12)){
					return 0;
				}
  			}
  		else if (token=="EE"||token=="E"){
  			for (var i=0; i<Date.DAY_NAMES.length; i++) {
  				var day_name=Date.DAY_NAMES[i];
  				if (val.substring(i_val,i_val+day_name.length).toLowerCase()==day_name.toLowerCase()) {
  					i_val += day_name.length;
  					break;
  					}
  				}
  			}
  		else if (token=="MM"||token=="M") {
  			month=Date._getInt(val,i_val,token.length,2);
  			if(month==null||(month<1)||(month>12)){
				return 0;
			}
  			i_val+=month.length;}
  		else if (token=="dd"||token=="d") {
  			date=Date._getInt(val,i_val,token.length,2);
  			if(date==null||(date<1)||(date>31)){
				return 0;
			}
  			i_val+=date.length;}
  		else if (token=="hh"||token=="h") {
  			hh=Date._getInt(val,i_val,token.length,2);
  			if(hh==null||(hh<1)||(hh>12)){
				return 0;
			}
  			i_val+=hh.length;}
  		else if (token=="HH"||token=="H") {
  			hh=Date._getInt(val,i_val,token.length,2);
  			if(hh==null||(hh<0)||(hh>23)){
				return 0;
			}
  			i_val+=hh.length;}
  		else if (token=="KK"||token=="K") {
  			hh=Date._getInt(val,i_val,token.length,2);
  			if(hh==null||(hh<0)||(hh>11)){
				return 0;
			}
  			i_val+=hh.length;}
  		else if (token=="kk"||token=="k") {
  			hh=Date._getInt(val,i_val,token.length,2);
  			if(hh==null||(hh<1)||(hh>24)){
				return 0;
			}
  			i_val+=hh.length;hh--;}
  		else if (token=="mm"||token=="m") {
  			mm=Date._getInt(val,i_val,token.length,2);
  			if(mm==null||(mm<0)||(mm>59)){
				return 0;
			}
  			i_val+=mm.length;}
  		else if (token=="ss"||token=="s") {
  			ss=Date._getInt(val,i_val,token.length,2);
  			if(ss==null||(ss<0)||(ss>59)){
				return 0;
			}
  			i_val+=ss.length;}
  		else if (token=="a") {
  			if (val.substring(i_val,i_val+2).toLowerCase()==Date.meridian.AM.toLowerCase()) {ampm=Date.meridian.AM;}
  			else if (val.substring(i_val,i_val+2).toLowerCase()==Date.meridian.PM.toLowerCase()) {ampm=Date.meridian.PM;}
  			else {
				return 0;
			}
  			i_val+=2;}
  		else {
  			if (val.substring(i_val,i_val+token.length)!=token) {
				return 0;
			}
  			else {i_val+=token.length;}
  			}
  		}
//  	// If there are any trailing characters left in the value, it doesn't match
//  	if (i_val != val.length) { 
//		return 0; 
//	}
  	// Is date valid for month?
  	if (month==2) {
  		// Check for leap year
  		if ( ( (year%4==0)&&(year%100 != 0) ) || (year%400==0) ) { // leap year
				if (date > 29){ 
					return 0; 
				}
  			}
  		else { if (date > 28) { 
			return 0; 
		} }
  		}
  	if ((month==4)||(month==6)||(month==9)||(month==11)) {
  		if (date > 30) { 
			return 0; 
		}
  		}
  	// Correct hours value
  	if (hh<12 && ampm==Date.meridian.PM) { hh=hh-0+12; }
  	else if (hh>11 && ampm==Date.meridian.PM) { hh-=12; }
  	var newdate= utc ? new Date(Date.UTC(year,month-1,date,hh,mm,ss)) : new Date(year,month-1,date,hh,mm,ss);
  	return newdate.getTime();
  },

  // ------------------------------------------------------------------
  // parseDate( date_string [, prefer_euro_format] )
  //
  // This function takes a date string and tries to match it to a
  // number of possible date formats to get the value. It will try to
  // match against the following international formats, in this order:
  // y-M-d   MMM d, y   MMM d,y   y-MMM-d   d-MMM-y  MMM d
  // M/d/y   M-d-y      M.d.y     MMM-d     M/d      M-d
  // d/M/y   d-M-y      d.M.y     d-MMM     d/M      d-M
  // 
  // Also understands: 
  // 
  // yesterday, today, tomorrow, now
  //
  // A second argument may be passed to instruct the method to search
  // for formats like d/M/y (european format) before M/d/y (American).
  // Returns a Date object or null if no patterns match.
  // ------------------------------------------------------------------
  parseDate: function(val) {
  	var preferEuro=(arguments.length==2)?arguments[1]:false;
  	generalFormats=new Array('E NNN dd HH:mm:ss UTC yyyy','y-M-d','y-M-d','MMM d, y','MMM d,y','y-MMM-d','d-MMM-y','MMM d','d MMM y','d.MMM.y','y MMM d','y.MMM.d');
  	monthFirst=new Array('M/d/y','M-d-y','M.d.y','MMM-d','M/d','M-d');
  	dateFirst =new Array('d/M/y','d-M-y','d.M.y','d-MMM','d/M','d-M');
  	var checkList=new Array('generalFormats',preferEuro?'dateFirst':'monthFirst',preferEuro?'monthFirst':'dateFirst');
  	var d=null;
  	
  	// first look for natural language
  	d = 0 ; var now = new Date().getTime() ;
  	switch(val.toLowerCase()) {
  	  case 'yesterday'.loc():
  	    d = now - (24*60*60*1000) ;
  	    break ;
  	  case 'today'.loc():
  	  case 'now'.loc():
  	    d = now ;
  	    break ;
  	  case 'tomorrow'.loc():
  	    d = now + (24*60*60*1000) ;
  	    break;
  	}
  	if (d>0) return new Date(d) ;
  	
  	for (var i=0; i<checkList.length; i++) {
  		var l=window[checkList[i]];
  		for (var j=0; j<l.length; j++) {
  			d=Date.getDateFromFormat(val,l[j]);
  			if (d==0) d = Date.getDateFromFormat(val,l[j] + ' H:m:s') ;
  			if (d==0) d = Date.getDateFromFormat(val,l[j] + ' h:m:s a') ;
  			if (d!=0) return new Date(d); 
  		}
  	}
  	return null;
  },
  
  // ------------------------------------------------------------------
  // Utility functions for parsing in getDateFromFormat()
  // ------------------------------------------------------------------
  _isInteger: function(val) {
  	var digits="1234567890";
  	for (var i=0; i < val.length; i++) {
  		if (digits.indexOf(val.charAt(i))==-1) { return false; }
  	}
  	return true;
  },
  
  _getInt: function(str,i,minlength,maxlength) {
  	for (var x=maxlength; x>=minlength; x--) {
  		var token=str.substring(i,i+x);
  		if (token.length < minlength) { return null; }
  		if (Date._isInteger(token)) { return token; }
  	}
  	return null;
  }

}) ;

Object.extend(Date.prototype, {
  
  // ------------------------------------------------------------------
  // formatDate (date_object, format, naturalLanguage)
  // Returns a date in the output format specified.
  // The format string uses the same abbreviations as in getDateFromFormat()
  // 
  // ------------------------------------------------------------------
  format: function(format, utc) {
  	format=format+"";
    var date = this ;
  	var result="";
  	var i_format=0;
  	var c="";
  	var token="";
  	var y= (utc ? date.getUTCFullYear() : date.getFullYear())+"";
  	var M= (utc ? date.getUTCMonth() : date.getMonth())+1;
  	var d= utc ? date.getUTCDate() : date.getDate();
  	var E= utc ? date.getUTCDay() : date.getDay();
  	var H= utc ? date.getUTCHours() : date.getHours();
  	var m= utc ? date.getUTCMinutes() : date.getMinutes();
  	var s= utc ? date.getUTCSeconds() : date.getSeconds();
  	var yyyy,yy,MMM,MM,dd,hh,h,mm,ss,ampm,HH,H,KK,K,kk,k;
  	// Convert real date parts into formatted versions
  	var value=new Object();
  	if (y.length < 4) {y=""+(y-0+1900);}
  	value["y"]=""+y;
  	value["yyyy"]=y;
  	value["yy"]=y.substring(2,4);
  	value["M"]=M;
  	value["MM"]=LZ(M);
  	value["MMM"]=Date.MONTH_NAMES[M-1];
  	value["NNN"]=Date.MONTH_NAMES[M+11];
  	value["d"]=d;
  	value["dd"]=LZ(d);
  	value["E"]=Date.DAY_NAMES[E+7];
  	value["EE"]=Date.DAY_NAMES[E];
  	value["H"]=H;
  	value["HH"]=LZ(H);
  	if (H==0){value["h"]=12;}
  	else if (H>12){value["h"]=H-12;}
  	else {value["h"]=H;}
  	value["hh"]=LZ(value["h"]);
  	if (H>11){value["K"]=H-12;} else {value["K"]=H;}
  	value["k"]=H+1;
  	value["KK"]=LZ(value["K"]);
  	value["kk"]=LZ(value["k"]);
  	if (H > 11) { value["a"]=Date.meridian.PM; }
  	else { value["a"]=Date.meridian.AM; }
  	value["m"]=m;
  	value["mm"]=LZ(m);
  	value["s"]=s;
  	value["ss"]=LZ(s);
  	while (i_format < format.length) {
  		c=format.charAt(i_format);
  		token="";
  		while ((format.charAt(i_format)==c) && (i_format < format.length)) {
  			token += format.charAt(i_format++);
  			}
  		if (value[token] != null) { result=result + value[token]; }
  		else { result=result + token; }
  		}
  	return result;
  },
  
  utcFormat: function() { return (new Date(this.getTime() + (this.getTimezoneOffset() * 60 * 1000))).format('E NNN dd HH:mm:ss UTC yyyy'); }

}) ;

// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("Environment");

var Environment  = WRLObject.extend({
	constructor: function(json, resourcesURL, isBeingExportedForQuicklook) {
		this.base();
		this.images = {};
		this.resourcesURL = resourcesURL;
		var json = eval("("+json+")");
		for(key in json)
			this[key] = json[key];
			
		if(!this.localizedStrings)
			this.localizedStrings = {};
		Date.meridian = this.date.meridian;
		Date.MONTH_NAMES=this.date.monthNames;
		Date.DAY_NAMES=this.date.dayNames;
		this.format.systemTimeFormatFixedHours = this.format.systemTimeFormatUses12Hours ?  "hh:00 a" : "HH:00";
		this.format.systemOnlyHourNumberTimeFormat = this.format.systemTimeFormatUses12Hours ?  "hh" : "HH";
		this.format.systemOnlyHourTimeFormat = this.format.systemTimeFormatUses12Hours ?  "hh a" : "HH";
		this.format.systemShortDateFormatWithWeekday = 'E, '+this.format.systemShortDateFormat;
		this.format.systemDateFormat = 'EE, dd. MMM yyyy';
		this.format.systemDateFormatWithoutWeekday = 'dd. MMM yyyy';
		this.format.systemShortDateFormatWithoutYear = 'dd.MM.'; 
		this.format.systemDateFormatWithoutYearAndWeekday = 'dd. MMM';			
											
		// Datepicker settings
		if(!isBeingExportedForQuicklook && window['setLanguageCode'])
			setLanguageCode(this.language);

	},
	
	localizedString: function(aString) {
		var result = this.localizedStrings[aString];
		if(!result)
			result = aString
		return result;
	},
	
	updateInfoIcons: function(){
		this.infoIconURLs = [];
		this.infoIconURLs.push(this.images.InfoConflicts);
		this.infoIconURLs.push(this.images.InfoWarnings);
		this.infoIconURLs.push(this.images.InfoConstraints);
		this.infoIconURLs.push(this.images.InfoASAP);
		this.infoIconURLs.push(this.images.InfoALAP);
		this.infoIconURLs.push(this.images.InfoElements);
		this.infoIconURLs.push(this.images.InfoDescription);	
		this.infoIconURLs.push(this.images.InfoCalendar);	
	}
	
});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("Style.js");

var  Style = Base.extend({
	constructor: function(dictionary, environment)
	{
		if(dictionary)
			for (var property in dictionary) 
				this[property] = dictionary[property];	
		if(this.contentType == "FlagStatus")
			this.contentFormatter = new FlagStatusFormatter(environment);
		else if(this.contentType == "Date")
			this.contentFormatter = new DateFormatter(environment.format.dateAndTimeFormat.date, environment.format.dateAndTimeFormat.time, true, environment);
		else if(this.contentType == "Percent")
			this.contentFormatter = new PercentFormatter();
		else if(this.contentType == "Currency")
			this.contentFormatter = new CurrencyFormatter(environment);
		else if(this.contentType == "Boolean")
			this.contentFormatter = new BooleanFormatter(environment);
		else if(this.contentType == "Duration")
			this.contentFormatter = new DurationFormatter(environment);
		else
			this.contentFormatter = new Formatter();
	},
	
	log: function()
	{
		
		console.log("----------------------------------------------------");
		console.log("fontFamily           : "+this.fontFamily);
		console.log("fontSize             : "+this.fontSize);
		console.log("fontWeight           : "+this.fontWeight);
		console.log("fontStyle            : "+this.fontStyle);
		console.log("fontStretch          : "+this.fontStretch);
		console.log("contentKey           : "+this.contentKey);
		console.log("contentKeyTitle      : "+this.contentKeyTitle);
		console.log("contentValueWithTimes: "+this.contentValueWithTimes);
		console.log("color                : "+this.color);
		console.log("backgroundColor      : "+this.backgroundColor);
		console.log("borderStyle          : "+this.borderStyle);
		console.log("hasShadow            : "+this.hasShadow);
		console.log("hasGradient          : "+this.hasGradient);
		console.log("height               : "+this.height);

		
	}, 
	
	mergeWithStyle: function(style)
	{
		if(style.fontFamily)
			this.fontFamily = style.fontFamily;
		if(style.fontSize)
			this.fontSize = style.fontSize;
		if(style.fontWeight)
			this.fontWeight = style.fontWeight;
		if(style.fontStyle)
			this.fontStyle = style.fontStyle;
		if(style.fontStretch)
			this.fontStretch = style.fontStretch;
		if(style.contentKey){
			if(style.contentKey == "-"){
				this.contentKey = null;
				this.contentType = null;
				this.contentFormatter = null;
			}else{
				this.contentKey = style.contentKey;
				this.contentType = style.contentType;
				this.contentFormatter = style.contentFormatter;
			}
		}
		if(style.contentKeyTitle)
		{
			if(style.contentKeyTitle == "-")
				this.contentKeyTitle = null;
			else
				this.contentKeyTitle = style.contentKeyTitle;
		}
		if(style.contentValueWithTimes)
			this.contentValueWithTimes = style.contentValueWithTimes;
		if(style.color)
			this.color = style.color;
		if(style.backgroundColor)
			this.backgroundColor = style.backgroundColor;
		if(style.borderStyle)
			this.borderStyle = style.borderStyle;
		if(style.hasShadow)
			this.hasShadow = style.hasShadow;
		if(style.hasGradient)
			this.hasGradient = style.hasGradient;
		if(style.height)
			this.height = style.height;
	}
});

var  StyleList = Base.extend({
	constructor: function(dictionary, environment)
	{
		this.cachedStyles = [];
		this.targets = [];
		for (var target in dictionary){
			var flatStyles = dictionary[target];
			var styles = {};
			for (var condition in flatStyles){
				styles[condition] = new Style(flatStyles[condition], environment);			
			}
			this.targets[target] = styles;
		}
	},
	
	flattenedStyleForTarget: function(target, conditionMask)
	{
		var key = conditionMask + 1234*target;
		var result = this.cachedStyles[key];				
		if(!result){
			result = new Style();
			for(var condition=0; condition<=29; condition++){
				if((conditionMask & (1<<condition))>0){
					var style = this.targets[target][condition];
					if(style)
						result.mergeWithStyle(style);
				}
			}
			this.cachedStyles[key] = result;
		}
		return result;
	}
}, 
// Klassenmethoden:
{
	activityViewStyleTargets: {
		MEStyleTargetRow: 0,
		MEStyleTargetOutline: 1,
		MEStyleTargetBar: 2,
		MEStyleTargetLabelLeft: 3,
		MEStyleTargetLabelMiddle: 4,
		MEStyleTargetLabelRight: 5
	},
	
	styleConditions: {
		MEActivityStyleConditionGeneral: 0,
		MEActivityStyleConditionGreenFlag: 1,
		MEActivityStyleConditionYellowFlag: 2,
		MEActivityStyleConditionRedFlag: 3,
		MEActivityStyleConditionLevel1: 4,
		MEActivityStyleConditionLevel2: 5,
		MEActivityStyleConditionLevel3: 6,
		MEActivityStyleConditionLevel4: 7,
		MEActivityStyleConditionLevel5: 8,
		MEActivityStyleConditionLevel6: 9,
		MEActivityStyleConditionLevel7: 10,
		MEActivityStyleConditionLevel8: 11,
		MEActivityStyleConditionActivity: 12,
		MEActivityStyleConditionActivityWithAssignments: 13,
		MEActivityStyleConditionGroup: 14,
		MEActivityStyleConditionProject: 15,
		MEActivityStyleConditionAssignment: 16,
		MEActivityStyleConditionMilestone: 17,
		MEActivityStyleConditionVeryLowPriority: 18,
		MEActivityStyleConditionLowPriority: 19,
		MEActivityStyleConditionNormalPriority: 20,
		MEActivityStyleConditionHighPriority: 21,
		MEActivityStyleConditionVeryHighPriority: 22,
		MEActivityStyleConditionCritical: 23,
		MEActivityStyleConditionWarning: 24,
		MEActivityStyleConditionConflict: 25,
		MEActivityStyleConditionCollapsed: 26,
		MEActivityStyleConditionExpanded: 27,
		MEActivityStyleConditionFiltered: 28,
		MEActivityStyleConditionChanged: 29
	}
});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("ManagedObjects.js");

/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEManagedObjectContext
 *
 */

var MEManagedObjectContext = WRLAjaxContext.extend({
	constructor: function(serverContextID, requestURL) {
		this.base(serverContextID, requestURL);		
	},
	
	rootProject: function(){
		var rootProject = null;
		var objects = Object.values(this.registeredObjects);
		for(var i=0; i<objects.length; i++) {
			var object = objects[i];
			if(object.className() == "MEProject" && !object.valueForKey("linkedParentActivity")) {
				rootProject = object;
				break;
			}
		}		
		return rootProject;
	}
	
});




/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEActivity
 *
 */

var eDurationUnit;
if(!eDurationUnit) eDurationUnit = {    
	MESeconds: 0,  
	MEMinutes: 1,  
	MEHours: 2,
	MEDays: 3,
	MEWeeks: 4,
	MECalendarWeeks: 5,
	MEMonths: 6,
	MEQuarterYears: 7,
	MEYears: 8,
	MENoUnit: 19,
	MEFraction: 20,
	MEMaterialUnit: 21,
	MESpecialCompareUnit: 22
}

var MEStart = false;
var MEEnd = true;

var MEItem = WRLManagedObject.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	},
	
	sortValueForKey: function(key){	
		var value = this.valueForKey(key);
		if(value && value.sortValue){
			if(this.descriptionForProperty(key).className == "MEDuration")
				value = value.sortValue(this.valueForKeyPath("project.manDayHours"), this.valueForKeyPath("project.manWeekHours"));
			else
				value = value.sortValue();
		}else if(typeof value == 'string'){
			if(key == 'wbsCode') {
				value = this.valueForKeyPath("flatOrder");
			}else
				value = value.toLowerCase();
		}
		return value;
	}
});

var MEActivity = MEItem.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	},
	
	hasAssignments: function(){
		var subActivities = this.valueForKey("linkedSubActivities");
		if(subActivities) {
			for(var i=0; i<subActivities.length; i++){
				if(subActivities[i].className() == "MEAssignment")
					return true;
			}
		}
		return false;
	},
	
	isLeaf: function(){
		var subActivities = this.valueForKey("linkedSubActivities");
		return !(subActivities && subActivities.length);
	},
	
	isGroup: function(){
		return !this.isLeaf();
	},
	
	linkedSubActivities: function(){
		return this.valueForKey("subActivities");
	},

	linkedParentActivity: function(){
		var parent = this.valueForKey("parentActivity");
		var link = parent ? parent.valueForKey("projectLink") : null;
		return link ? link : parent;
	},
	
//	isMilestone: function(){
//		var start = this.valueForKey("expectedStartDate");
//		var end = this.valueForKey("expectedEndDate");
//		return (start && end && start.getTime() == end.getTime());
//	},
		
	project: function(){
		if(!this._project){
			var activity = this;
			while(activity.valueForKey("linkedParentActivity"))
				activity = activity.valueForKey("linkedParentActivity");
			this._project = activity;
		}
		return this._project;
	},
	
	utilizationTitle: function(){
		return this.valueForKey("title");
	},

	isAncestorOf: function(activity){
		if(!activity)
			return false;
		var parent = activity.valueForKey("linkedParentActivity");
		return (parent == this) ? true : this.isAncestorOf(parent);
	},
	
	styleConditionMask: function() {
		var result = this.properties.styleConditionMask;
		if(!this.isLeaf()) {
			if(this.valueForKey('isCollapsed')) {
				result |= (1<<StyleList.styleConditions.MEActivityStyleConditionCollapsed);
				result &= ~(1<<StyleList.styleConditions.MEActivityStyleConditionExpanded);
			}else{
				result &= ~(1<<StyleList.styleConditions.MEActivityStyleConditionCollapsed);
				result |= (1<<StyleList.styleConditions.MEActivityStyleConditionExpanded);
				result &= ~(1<<StyleList.styleConditions.MEActivityStyleConditionCritical);
			}
		}
		return result;	
	},
	
	maximumLevelInConflictsForKey: function(key) {
		return 0;	// TODO: MEConflicts mit übertragen 
	},

	subActivityWithTitle: function(title) {
		var subActivities = this.linkedSubActivities();		
		for(var i=0; i<subActivities.length; i++) {
			var activity = subActivities[i];
			if(activity.valueForKey("title") == title)
				return activity;
		}
		return null;
	},

	subActivityWithTitlePath: function(titlePath) {
		var index = titlePath.indexOf(".");
		if(index == -1)
			return this.subActivityWithTitle(titlePath);
		else{
			var firstTitle = titlePath.substring(0, index);
			var activity = this.subActivityWithTitle(firstTitle);
			return activity ? activity.subActivityWithTitlePath(titlePath.substring(index+1)) : null;
		}
	}
	
});


var InfoIconsIndices = WRLObject.extend({
	constructor: function(json){
		this.base();
		this.indices = json;
	}
});

/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEActivityRelationship
 *
 */

var relID = 0;

var MEActivityRelationship = WRLManagedObject.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
		this.ID = relID;
		relID++;
	}
	
},{	// Class interface
	MEFinishToStartRelationship: 0,			
	MEStartToStartRelationship: 1,
	MEFinishToFinishRelationship: 2,
	MEStartToFinishRelationship: 3,
	MENoRelationship: -1

/*
	isRelationshipOfKindPossibleBetweenActivityAndActivity: function(kind, previous, next){
		if(previous == next || !previous || !next)
			return false;
		if(previous.valueForKey("project") != next.valueForKey("project"))
			return false;
		if(!previous.valueForKey("mayBeManagedByCurrentUser")] || !next.valueForKey("mayBeManagedByCurrentUser"))
			return false;
		if((kind == MEActivityRelationship.MEFinishToFinishRelationship || kind == MEActivityRelationship.MEStartToFinishRelationship) && next.isGroup())
			return false;
			
		var project = previous.valueForKey("project");
		
		if(kind == MEActivityRelationship.MEFinishToStartRelationship)
			return !project.hasPathFromSideOfActivityToSideOfActivity(MEStart, next, MEEnd, previous);
		else if(kind == MEActivityRelationship.MEStartToStartRelationship)
			return !project.hasPathFromSideOfActivityToSideOfActivity(MEStart, next, MEStart, previous) && !project.hasPathFromSideOfActivityToSideOfActivity(MEStart, next, MEEnd, previous);
		else if(kind==MEActivityRelationship.MEFinishToFinishRelationship)
			return !project.hasPathFromSideOfActivityToSideOfActivity(MEEnd, next, MEEnd, previous) && !project.hasPathFromSideOfActivityToSideOfActivity(MEStart, next, MEEnd, previous);
		else if(kind==MEActivityRelationship.MEStartToFinishRelationship)
			return !project.hasPathFromSideOfActivityToSideOfActivity(MEEnd, next, MEStart, previous) && !project.hasPathFromSideOfActivityToSideOfActivity(MEStart, next, MEStart, previous) && !project.hasPathFromSideOfActivityToSideOfActivity(MEEnd, next, MEEnd, previous);
		return false;
	},
		
	isRelationshipOfKindPossibleAndNotDispensibleBetweenActivityAndActivity: function(kind, previous, next){
		return MEActivityRelationship.isRelationshipOfKindPossibleBetweenActivityAndActivity(kind, previous, next)
			&& !MEActivityRelationship.isRelationshipOfKindDispensableBetweenActivityAndActivity(kind, previous, next);
	},
				
	canChainActivitiesUsingRelationshipKind: function(activities, kind) {
		var count = activities.length;
		for(var index=0; index<count-1; index++)
		{
			var prev = activities[index];
			var next = activities[index+1];
			if( MEActivityRelationship.isRelationshipOfKindPossibleAndNotDispensibleBetweenActivityAndActivity(kind, prev, next))
				return true;
		}
		return false;
	}
*/
														
});

/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEAssignment
 *
 */

var print = true;

var MEAssignment = MEActivity.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	},
	
	utilizationTitle: function(){
		return this.valueForKeyPath("linkedParentActivity.title");
	}	
	
});

/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEProject
 *
 */

var MEProject = MEActivity.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	},
	
	sortedRoles: function(){
		var result = [];
		var roles = this.valueForKey("roles");
		if(roles){
			roles = roles.clone();
			for(var i=0; i<roles.length; i++){
				var role = roles[i];
				result[parseInt(role.valueForKey("displayOrder"))] = role;
			}
		}
		return result;
	},
	
	hasPathFromSideOfActivityToSideOfActivity: function(startSide, startActivity, endSide, endActivity) {
		
	},
	
	resourceWithTitle: function(title)
	{
		var resources = this.valueForKey('resources');
		for(var i=0; i<resources.length; i++) {
			var resource = resources[i];
			if(resource.valueForKey('title') == title)
				return resource;
		}
		return null;
	}	
	
},{
	rootProjectInManagedObjectContext: function(moc){
		if(moc){
			for(var key in moc.registeredObjects){
				var object = moc.registeredObjects[key]; 
				if(object.className() == "MEProject" && !object.valueForKey("linkedParentActivity")) {
					return object;
				}
			}
		}
		return nil;
	}
});

/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEProjectLink
 *
 */

var MEProjectLink = MEActivity.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	},
	
	linkedSubActivities: function(){
		var target = this.valueForKey("targetProject");
		return target ? target.valueForKey("subActivities") : [];
	}
},{
	CouldNotAccessProject: 15002,
	ProjectLinkCouldNotFindTargetProject: 15000
});


/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEResource
 *
 */

var MEResource = MEItem.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	},
	
	projectTitle: function(){
		return this.valueForKeyPath("project.title");
	},
	
	validateValueForKey: function(value, key) {
		if(key == "role" && typeof value == "string")
			return true;
		return this.base(value, key);
	}
	
},{
	MEResourceType: {	MEPersonResource:0,			
						MEMaterialResource:1,		
						MECompanyResource:2,
						MEEquipmentResource:3	}
});


/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEResourceGroup
 *
 */

var MEResourceGroup = MEItem.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	}

/*	,
	resources: function(){
		return this.valueForKey("resources");
	}
*/	
	
});


/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEMasterResource
 *
 */

var MEMasterResource = MEItem.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
		this.properties.isCollapsed = true;
	},

	isLeaf: function(){
		var assignments = this.valueForKey("assignments");
		return !(assignments && assignments.length);
	},

	utilizationTitle: function(){
		return this.valueForKey("title");
	},
	
	sortValueForKey: function(key){	
		var result;
		if(!this.valueForKey('resources').length && key == "utilizationTitle") {
			result = "----";
		} else {
			result = this.base(key);
		}
		return result;
	},

	// Methods to make this object compatible with the gantt view.
	linkedSubActivities: function(){
		return this.valueForKey("resources");
	},
	
	isMilestone: function(){
		return false;
	},
	
	flagStatus: function(){
		return this.valueForKey("automaticFlagStatus");
	},

	givenFlagStatus: function(){
		return this.valueForKey("automaticFlagStatus");
	}	
	
});

/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MERole
 *
 */

var MERole = MEItem.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	}
	
});


/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	AllProjectsItem
 *
 */

var AllProjectsItem = WRLObject.extend({
	constructor: function(moc, environment){
		this.base();
		this.environment = environment;
		this.objectID = {uri:'AllProjectsItem'};
		this.title = this.environment.localizedString("All Projects");
		this.moc = moc;
	},
	
	resourceGroups: function(){
		return [];
	},
	
	title: function(){
		return title;
	},
	
	sortValueForKey: function(key){	
		return '----';
	},
	
	className: function(){
		return "AllProjectsItem";
	},	
	
	resources: function(){
		var resources = [];
		for(var key in this.moc.registeredObjects){
			var object = this.moc.registeredObjects[key]; 
			if(object.className() == "MEProject"){
				var r = object.valueForKey("resources");
				r.each(function(item){
					if(resources.indexOf(item) == -1)
						resources.push(item);
				});
			}
		}
		return resources;				
	}		
});


/*  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *	
 *	MEWorkspace
 *
 */

var MEWorkspace = MEItem.extend({
	constructor: function(context, objectID, properties){
		this.base(context, objectID, properties);
	}
	
},{

	filteredWorkspacesForSingleViewSinglePart: function(workspaces, singleView, singlePart) {
		var result = [];
		if(workspaces.length) {		
			workspaces.each(function(workspace){
				var view = workspace.valueForKey("singleSettingView");
				var part = workspace.valueForKey("singleSettingPart");
				if(((!singleView && !singlePart) && (!view || !part)) || (singleView == view && singlePart == part))
					result.push(workspace);
			
			});			
		}
		return result;
	}

});

// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("MEBudget.js");

var MEBudget = WRLObject.extend({
	constructor: function(json)
	{
		this.base();
		this.amount = json.a == null || typeof(json.a) == "undefined" ? null : json.a;
		this.isFractional = json.f == null || typeof(json.f) == "undefined" ? null : json.f;
	},
	
	className: "MEBudget",
	
	sortValue: function() {
		return this.amount;
	},

    toJSON: function() {
        return '{"a":' + this.amount + ', "f":' + this.isFractional+'}';
    }
			
},{

	budgetWithAmountIsFractional: function(amount, isFractional) {
		return new MEBudget({a:amount, f:isFractional});
	}
	
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("MEDuration.js");

var MEDuration = WRLObject.extend({
	constructor: function(json){
		this.base();
		this.amount = json.a == null || typeof(json.a) == "undefined" ? null : json.a;
		this.unit = json.u == null || typeof(json.u) == "undefined" ? null : json.u;
		this.isFloating = json.f == null || typeof(json.f) == "undefined" ? null : json.f;
		this.relativeError = json.e == null || typeof(json.e) == "undefined" ? null : json.e;
		this.updateSeconds();		
	},
	
	className: "MEDuration",
	
	updateSeconds: function(manDayHours, manWeekHours){
		var Unit = MEDuration.DurationUnit;
		if(this.isFloating || !manDayHours || !manWeekHours){ 
			switch(this.unit) {
				case Unit.MESeconds:
					this.seconds = this.amount; break;
				case Unit.MEMinutes:
					this.seconds = this.amount * 60.0; break;
				case Unit.MEHours:
					this.seconds = this.amount * 3600.0; break;
				default:
				case Unit.MEDays:
					this.seconds = this.amount * 3600.0 * 24.0; break;
				case Unit.MECalendarWeeks:
				case Unit.MEWeeks:
					this.seconds = this.amount * 3600.0 * 24.0 * 7.0; break;
				case Unit.MEMonths:
					this.seconds = this.amount * 3600.0 * 24.0 * 28.0; break;
				case Unit.MEYears:
					this.seconds = this.amount * 3600.0 * 24.0 * 28.0 * 12.0; break;
				case Unit.MEFraction:
				case Unit.MEMaterialUnit:
					this.seconds = 0; break;
			}
		}else{
			switch(this.unit) {
				case Unit.MESeconds:
					this.seconds = this.amount; break;
				case Unit.MEMinutes:
					this.seconds = this.amount * 60.0; break;
				case Unit.MEHours:
					this.seconds = this.amount * 3600.0; break;
				default:
				case Unit.MEDays:
					this.seconds = this.amount * 3600.0 * manDayHours; break;
				case Unit.MECalendarWeeks:
				case Unit.MEWeeks:
					this.seconds = this.amount * 3600.0 * manWeekHours; break;
				case Unit.MEMonths:
					this.seconds = this.amount * 3600.0 * manWeekHours * 4.0; break;
				case Unit.MEYears:
					this.seconds = this.amount * 3600.0 * manWeekHours * 52; break;
				case Unit.MEFraction:
				case Unit.MEMaterialUnit:
					this.seconds = 0; break;
			}
		}		
	},
	
	sortValue: function() {
		return this.seconds;
	},

    toJSON: function() {
        return '{"a":' + this.amount + ', "u":' + this.unit + ', "f":' + this.isFloating +', "e":' + this.relativeError + '}';
    }
	
},{	// Class interface:
    formatter: function(environment) {
        return new DurationFormatter(environment);
    },
	
	sharedFormatter: function(environment) {
		if(!MEDuration._sharedFormatter)
			MEDuration._sharedFormatter = MEDuration.formatter(environment);
		return MEDuration._sharedFormatter;
	},
	
	DurationUnit: {	MESeconds:0, 
					MEMinutes:1, 
					MEHours:2, 
					MEDays:3, 
					MEWeeks:4, 
					MECalendarWeeks:5, 
					MEMonths:6, 
					MEQuarterYears:7, 
					MEYears:8, 
					MENoUnit:19, 
					MEFraction:20, 
					MEMaterialUnit:21, 
					MESpecialCompareUnit:22},
	
	durationWithAmountUnitIsFloatingRelativeError: function(amount, unit, floating, relativeError) {
		return new MEDuration({ a:amount, u:unit, f:floating, e:relativeError });
	}	
	
});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("MEUtilisation.js");

var MEUtilisation = WRLObject.extend({
	constructor: function(json){
		this.base();
		this.amount = json.a == null || typeof(json.a) == "undefined" ? null : json.a;
		this.denominatorUnit = json.d == null || typeof(json.d) == "undefined" ? null : json.d;
	},

	className: "MEUtilisation",

	sortValue: function() {
		return this.amount;
	},

    toJSON: function() {
        return '{"a":' + this.amount + ', "d":' + this.denominatorUnit+'}';
    }
			
},{	
	utilisationWithAmountDenominatorUnit: function(amount, unit) {
		return new MEUtilisation({a:amount, d:unit});
	}
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("MERate.js");

var MERate = WRLObject.extend({
	constructor: function(json)
	{
		this.base();
		this.amount = json.a == null || typeof(json.a) == "undefined" ? null : json.a;
		this.denominatorUnit = json.d == null || typeof(json.d) == "undefined" ? null : json.d;
		this.denominatorUnitIsFloating = json.f == null || typeof(json.f) == "undefined" ? null : json.f;
	},

	className: "MERate",
		
    toJSON: function() {
        return '{"a":' + this.amount + ', "d":' + this.denominatorUnit + ', "f":' + this.denominatorUnitIsFloating + '}';
    }
},{ // Class methods
	  RateWithAmountUnitUnitIsFloating: function(amount, unit, unitIsFloating){
			var dict = {a:amount, d:unit};
			if(unitIsFloating)
				dict.f = true;
			return new MERate(dict);
	  }
});//console.log("Datepicker.js");

/************************************************************************************************************
JS Calendar
Copyright (C) September 2006  DTHMLGoodies.com, Alf Magne Kalleland

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA

Dhtmlgoodies.com., hereby disclaims all copyright interest in this script
written by Alf Magne Kalleland.

Alf Magne Kalleland, 2006
Owner of DHTMLgoodies.com

************************************************************************************************************/

/* Update log:
(C) www.dhtmlgoodies.com, September 2005

Version 1.2, November 8th - 2005 - Added <iframe> background in IE
Version 1.3, November 12th - 2005 - Fixed top bar position in Opera 7
Version 1.4, December 28th - 2005 - Support for Spanish and Portuguese
Version 1.5, January  18th - 2006 - Fixed problem with next-previous buttons after a month has been selected from dropdown
Version 1.6, February 22nd - 2006 - Added variable which holds the path to images.
									Format todays date at the bottom by use of the todayStringFormat variable
									Pick todays date by clicking on todays date at the bottom of the calendar
Version 2.0	 May, 25th - 2006	  - Added support for time(hour and minutes) and changing year and hour when holding mouse over + and - options. (i.e. instead of click)
Version 2.1	 July, 2nd - 2006	  - Added support for more date formats(example: d.m.yyyy, i.e. one letter day and month).

// Modifications by Gregg Buntin
Version 2.1.1 8/9/2007  gfb   - Add switch to turn off Year Span Selection
                                This allows me to only have this year & next year in the drop down
                                     
Version 2.1.2 8/30/2007 gfb  - Add switch to start week on Sunday
                               Add switch to turn off week number display
                               Fix bug when using on an HTTPS page

*/
var turnOffYearSpan = false;     // true = Only show This Year and Next, false = show +/- 5 years
var weekStartsOnSunday = false;  // true = Start the week on Sunday, false = start the week on Monday
var showWeekNumber = true;  // true = show week number,  false = do not show week number

var languageCode = 'en';	// Possible values: 	en,ge,no,nl,es,pt-br,fr
							// en = english, de = german, no = norwegian,nl = dutch, es = spanish, pt-br = portuguese, fr = french, da = danish, hu = hungarian(Use UTF-8 doctype for hungarian)

var calendar_display_time = true;

// Format of current day at the bottom of the calendar
// [todayString] = the value of todayString
// [dayString] = day of week (examle: mon, tue, wed...)
// [UCFdayString] = day of week (examle: Mon, Tue, Wed...) ( First letter in uppercase)
// [day] = Day of month, 1..31
// [monthString] = Name of current month
// [year] = Current year
var todayStringFormat = '[todayString] [UCFdayString]. [day]. [monthString] [year]';

var speedOfSelectBoxSliding = 200;	// Milliseconds between changing year and hour when holding mouse over "-" and "+" - lower value = faster
var intervalSelectBox_minutes = 5;	// Minute select box - interval between each option (5 = default)

var calendar_offsetTop = 2;		// Offset - calendar placement - You probably have to modify this value if you're not using a strict doctype
var calendar_offsetLeft = 2;	// Offset - calendar placement - You probably have to modify this value if you're not using a strict doctype
var calendarDiv = false;

var MSIE = false;
var Opera = false;
if(navigator.userAgent.indexOf('MSIE')>=0 && navigator.userAgent.indexOf('Opera')<0)MSIE=true;
if(navigator.userAgent.indexOf('Opera')>=0)Opera=true;

var monthArray;
var monthArrayShort;
var dayArray;
var weekString;
var todayString;

function setLanguageCode(code)
{
	switch(code){
		case "en":	/* English */
			monthArray = ['January','February','March','April','May','June','July','August','September','October','November','December'];
			monthArrayShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
			dayArray = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
			weekString = 'Week';
			todayString = '';
			break;
		case "de":	/* German */
			monthArray = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
			monthArrayShort = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
			dayArray = ['Mon','Die','Mit','Don','Fre','Sam','Son'];
			weekString = 'Woche';
			todayString = 'Heute';
			break;
		case "no":	/* Norwegian */
			monthArray = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];
			monthArrayShort = ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];
			dayArray = ['Man','Tir','Ons','Tor','Fre','L&oslash;r','S&oslash;n'];
			weekString = 'Uke';
			todayString = 'Dagen i dag er';
			break;
		case "nl":	/* Dutch */
			monthArray = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
			monthArrayShort = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
			dayArray = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
			weekString = 'Week';
			todayString = 'Vandaag';
			break;
		case "es": /* Spanish */
			monthArray = ['Enero','Febrero','Marzo','April','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
			monthArrayShort =['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
			dayArray = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];
			weekString = 'Semana';
			todayString = 'Hoy es';
			break;
		case "pt-br":  /* Brazilian portuguese (pt-br) */
			monthArray = ['Janeiro','Fevereiro','Mar&ccedil;o','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
			monthArrayShort = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
			dayArray = ['Seg','Ter','Qua','Qui','Sex','S&aacute;b','Dom'];
			weekString = 'Sem.';
			todayString = 'Hoje &eacute;';
			break;
		case "fr":      /* French */
			monthArray = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
			monthArrayShort = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
			dayArray = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
			weekString = 'Sem';
			todayString = "Aujourd'hui";
			break;
		case "da": /*Danish*/
			monthArray = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
			monthArrayShort = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
			dayArray = ['man','tirs','ons','tors','fre','l&oslash;r','s&oslash;n'];
			weekString = 'Uge';
			todayString = 'I dag er den';
			break;
		case "hu":	/* Hungarian  - Remember to use UTF-8 encoding, i.e. the <meta> tag */
			monthArray = ['JanuÃ¡r','FebruÃ¡r','MÃ¡rcius','Ã?prilis','MÃ¡jus','JÃºnius','JÃºlius','Augusztus','Szeptember','OktÃ³ber','November','December'];
			monthArrayShort = ['Jan','Feb','MÃ¡rc','Ã?pr','MÃ¡j','JÃºn','JÃºl','Aug','Szep','Okt','Nov','Dec'];
			dayArray = ['HÃ©','Ke','Sze','Cs','PÃ©','Szo','Vas'];
			weekString = 'HÃ©t';
			todayString = 'Mai nap';
			break;
		case "it":	/* Italian*/
			monthArray = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
			monthArrayShort = ['Gen','Feb','Mar','Apr','Mag','Giu','Lugl','Ago','Set','Ott','Nov','Dic'];
			dayArray = ['Lun',';Mar','Mer','Gio','Ven','Sab','Dom'];
			weekString = 'Settimana';
			todayString = 'Oggi &egrave; il';
			break;
		case "sv":	/* Swedish */
			monthArray = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
			monthArrayShort = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
			dayArray = ['M&aring;n','Tis','Ons','Tor','Fre','L&ouml;r','S&ouml;n'];
			weekString = 'Vecka';
			todayString = 'Idag &auml;r det den';
			break;
	}
}

setLanguageCode(languageCode);

if (weekStartsOnSunday) {
   var tempDayName = dayArray[6];
   for(var theIx = 6; theIx > 0; theIx--) {
      dayArray[theIx] = dayArray[theIx-1];
   }
   dayArray[0] = tempDayName;
}



var daysInMonthArray = [31,28,31,30,31,30,31,31,30,31,30,31];
var currentMonth;
var currentYear;
var currentHour;
var currentMinute;
var calendarContentDiv;
var returnDateTo;
var returnFormat;
var activeSelectBoxMonth;
var activeSelectBoxYear;
var activeSelectBoxHour;
var activeSelectBoxMinute;

var iframeObj = false;
//// fix for EI frame problem on time dropdowns 09/30/2006
var iframeObj2 =false;
function EIS_FIX_EI1(where2fixit)
{

		if(!iframeObj2)return;
		iframeObj2.style.display = 'block';
		iframeObj2.style.height =document.getElementById(where2fixit).offsetHeight+1;
		iframeObj2.style.width=document.getElementById(where2fixit).offsetWidth;
		iframeObj2.style.left=getleftPos(document.getElementById(where2fixit))+1-calendar_offsetLeft;
		iframeObj2.style.top=getTopPos(document.getElementById(where2fixit))-document.getElementById(where2fixit).offsetHeight-calendar_offsetTop;
}

function EIS_Hide_Frame()
{		if(iframeObj2)iframeObj2.style.display = 'none';}
//// fix for EI frame problem on time dropdowns 09/30/2006
var returnDateToYear;
var returnDateToMonth;
var returnDateToDay;
var returnDateToHour;
var returnDateToMinute;

var inputYear;
var inputMonth;
var inputDay;
var inputHour;
var inputMinute;
var calendarDisplayTime = false;

var selectBoxHighlightColor = '#D60808'; // Highlight color of select boxes
var selectBoxRolloverBgColor = '#E2EBED'; // Background color on drop down lists(rollover)

var selectBoxMovementInProgress = false;
var activeSelectBox = false;

function cancelCalendarEvent()
{
	return false;
}
function isLeapYear(inputYear)
{
	if(inputYear%400==0||(inputYear%4==0&&inputYear%100!=0)) return true;
	return false;

}
var activeSelectBoxMonth = false;
var activeSelectBoxDirection = false;

function highlightMonthYear()
{
	if(activeSelectBoxMonth)activeSelectBoxMonth.className='';
	activeSelectBox = this;


	if(this.className=='monthYearActive'){
		this.className='';
	}else{
		this.className = 'monthYearActive';
		activeSelectBoxMonth = this;
	}

	if(this.innerHTML.indexOf('-')>=0 || this.innerHTML.indexOf('+')>=0){
		if(this.className=='monthYearActive')
			selectBoxMovementInProgress = true;
		else
			selectBoxMovementInProgress = false;
		if(this.innerHTML.indexOf('-')>=0)activeSelectBoxDirection = -1; else activeSelectBoxDirection = 1;

	}else selectBoxMovementInProgress = false;

}

function showMonthDropDown()
{
	if(document.getElementById('monthDropDown').style.display=='block'){
		document.getElementById('monthDropDown').style.display='none';
		//// fix for EI frame problem on time dropdowns 09/30/2006
				EIS_Hide_Frame();
	}else{
		document.getElementById('monthDropDown').style.display='block';
		document.getElementById('yearDropDown').style.display='none';
		document.getElementById('hourDropDown').style.display='none';
		document.getElementById('minuteDropDown').style.display='none';
			if (MSIE)
		{ EIS_FIX_EI1('monthDropDown')}
		//// fix for EI frame problem on time dropdowns 09/30/2006

	}
}

function showYearDropDown()
{
	if(document.getElementById('yearDropDown').style.display=='block'){
		document.getElementById('yearDropDown').style.display='none';
		//// fix for EI frame problem on time dropdowns 09/30/2006
				EIS_Hide_Frame();
	}else{
		document.getElementById('yearDropDown').style.display='block';
		document.getElementById('monthDropDown').style.display='none';
		document.getElementById('hourDropDown').style.display='none';
		document.getElementById('minuteDropDown').style.display='none';
			if (MSIE)
		{ EIS_FIX_EI1('yearDropDown')}
		//// fix for EI frame problem on time dropdowns 09/30/2006

	}

}
function showHourDropDown()
{
	if(document.getElementById('hourDropDown').style.display=='block'){
		document.getElementById('hourDropDown').style.display='none';
		//// fix for EI frame problem on time dropdowns 09/30/2006
				EIS_Hide_Frame();
	}else{
		document.getElementById('hourDropDown').style.display='block';
		document.getElementById('monthDropDown').style.display='none';
		document.getElementById('yearDropDown').style.display='none';
		document.getElementById('minuteDropDown').style.display='none';
				if (MSIE)
		{ EIS_FIX_EI1('hourDropDown')}
		//// fix for EI frame problem on time dropdowns 09/30/2006
	}

}
function showMinuteDropDown()
{
	if(document.getElementById('minuteDropDown').style.display=='block'){
		document.getElementById('minuteDropDown').style.display='none';
		//// fix for EI frame problem on time dropdowns 09/30/2006
				EIS_Hide_Frame();
	}else{
		document.getElementById('minuteDropDown').style.display='block';
		document.getElementById('monthDropDown').style.display='none';
		document.getElementById('yearDropDown').style.display='none';
		document.getElementById('hourDropDown').style.display='none';
				if (MSIE)
		{ EIS_FIX_EI1('minuteDropDown')}
		//// fix for EI frame problem on time dropdowns 09/30/2006
	}

}

function selectMonth()
{
	document.getElementById('calendar_month_txt').innerHTML = this.innerHTML
	currentMonth = this.id.replace(/[^\d]/g,'');

	document.getElementById('monthDropDown').style.display='none';
	//// fix for EI frame problem on time dropdowns 09/30/2006
				EIS_Hide_Frame();
	for(var no=0;no<monthArray.length;no++){
		document.getElementById('monthDiv_'+no).style.color='';
	}
	this.style.color = selectBoxHighlightColor;
	activeSelectBoxMonth = this;
	writeCalendarContent();

}

function selectHour()
{
	document.getElementById('calendar_hour_txt').innerHTML = this.innerHTML
	currentHour = this.innerHTML.replace(/[^\d]/g,'');
	document.getElementById('hourDropDown').style.display='none';
	//// fix for EI frame problem on time dropdowns 09/30/2006
				EIS_Hide_Frame();
	if(activeSelectBoxHour){
		activeSelectBoxHour.style.color='';
	}
	activeSelectBoxHour=this;
	this.style.color = selectBoxHighlightColor;
}

function selectMinute()
{
	document.getElementById('calendar_minute_txt').innerHTML = this.innerHTML
	currentMinute = this.innerHTML.replace(/[^\d]/g,'');
	document.getElementById('minuteDropDown').style.display='none';
	//// fix for EI frame problem on time dropdowns 09/30/2006
				EIS_Hide_Frame();
	if(activeSelectBoxMinute){
		activeSelectBoxMinute.style.color='';
	}
	activeSelectBoxMinute=this;
	this.style.color = selectBoxHighlightColor;
}


function selectYear()
{
	document.getElementById('calendar_year_txt').innerHTML = this.innerHTML
	currentYear = this.innerHTML.replace(/[^\d]/g,'');
	document.getElementById('yearDropDown').style.display='none';
	//// fix for EI frame problem on time dropdowns 09/30/2006
				EIS_Hide_Frame();
	if(activeSelectBoxYear){
		activeSelectBoxYear.style.color='';
	}
	activeSelectBoxYear=this;
	this.style.color = selectBoxHighlightColor;
	writeCalendarContent();

}

function switchMonth()
{
	if(this.src.indexOf('left')>=0){
		currentMonth=currentMonth-1;;
		if(currentMonth<0){
			currentMonth=11;
			currentYear=currentYear-1;
		}
	}else{
		currentMonth=currentMonth+1;;
		if(currentMonth>11){
			currentMonth=0;
			currentYear=currentYear/1+1;
		}
	}

	writeCalendarContent();


}

function createMonthDiv(){
	var div = document.createElement('DIV');
	div.className='monthYearPicker';
	div.id = 'monthPicker';

	for(var no=0;no<monthArray.length;no++){
		var subDiv = document.createElement('DIV');
		subDiv.innerHTML = monthArray[no];
		subDiv.onmouseover = highlightMonthYear;
		subDiv.onmouseout = highlightMonthYear;
		subDiv.onclick = selectMonth;
		subDiv.id = 'monthDiv_' + no;
		subDiv.style.width = '56px';
		subDiv.onselectstart = cancelCalendarEvent;
		div.appendChild(subDiv);
		if(currentMonth && currentMonth==no){
			subDiv.style.color = selectBoxHighlightColor;
			activeSelectBoxMonth = subDiv;
		}

	}
	return div;

}

function changeSelectBoxYear(e,inputObj)
{
	if(!inputObj)inputObj =this;
	var yearItems = inputObj.parentNode.getElementsByTagName('DIV');
	if(inputObj.innerHTML.indexOf('-')>=0){
		var startYear = yearItems[1].innerHTML/1 -1;
		if(activeSelectBoxYear){
			activeSelectBoxYear.style.color='';
		}
	}else{
		var startYear = yearItems[1].innerHTML/1 +1;
		if(activeSelectBoxYear){
			activeSelectBoxYear.style.color='';

		}
	}

	for(var no=1;no<yearItems.length-1;no++){
		yearItems[no].innerHTML = startYear+no-1;
		yearItems[no].id = 'yearDiv' + (startYear/1+no/1-1);

	}
	if(activeSelectBoxYear){
		activeSelectBoxYear.style.color='';
		if(document.getElementById('yearDiv'+currentYear)){
			activeSelectBoxYear = document.getElementById('yearDiv'+currentYear);
			activeSelectBoxYear.style.color=selectBoxHighlightColor;;
		}
	}
}
function changeSelectBoxHour(e,inputObj)
{
	if(!inputObj)inputObj = this;

	var hourItems = inputObj.parentNode.getElementsByTagName('DIV');
	if(inputObj.innerHTML.indexOf('-')>=0){
		var startHour = hourItems[1].innerHTML/1 -1;
		if(startHour<0)startHour=0;
		if(activeSelectBoxHour){
			activeSelectBoxHour.style.color='';
		}
	}else{
		var startHour = hourItems[1].innerHTML/1 +1;
		if(startHour>14)startHour = 14;
		if(activeSelectBoxHour){
			activeSelectBoxHour.style.color='';

		}
	}
	var prefix = '';
	for(var no=1;no<hourItems.length-1;no++){
		if((startHour/1 + no/1) < 11)prefix = '0'; else prefix = '';
		hourItems[no].innerHTML = prefix + (startHour+no-1);

		hourItems[no].id = 'hourDiv' + (startHour/1+no/1-1);

	}
	if(activeSelectBoxHour){
		activeSelectBoxHour.style.color='';
		if(document.getElementById('hourDiv'+currentHour)){
			activeSelectBoxHour = document.getElementById('hourDiv'+currentHour);
			activeSelectBoxHour.style.color=selectBoxHighlightColor;;
		}
	}
}

function updateYearDiv()
{
    var yearSpan = 5;
    if (turnOffYearSpan) {
       yearSpan = 0;
    }
	var div = document.getElementById('yearDropDown');
	var yearItems = div.getElementsByTagName('DIV');
	for(var no=1;no<yearItems.length-1;no++){
		yearItems[no].innerHTML = currentYear/1 -yearSpan + no;
		if(currentYear==(currentYear/1 -yearSpan + no)){
			yearItems[no].style.color = selectBoxHighlightColor;
			activeSelectBoxYear = yearItems[no];
		}else{
			yearItems[no].style.color = '';
		}
	}
}

function updateMonthDiv()
{
	for(no=0;no<12;no++){
		document.getElementById('monthDiv_' + no).style.color = '';
	}
	document.getElementById('monthDiv_' + currentMonth).style.color = selectBoxHighlightColor;
	activeSelectBoxMonth = 	document.getElementById('monthDiv_' + currentMonth);
}


function updateHourDiv()
{
	var div = document.getElementById('hourDropDown');
	var hourItems = div.getElementsByTagName('DIV');

	var addHours = 0;
	if((currentHour/1 -6 + 1)<0){
		addHours = 	(currentHour/1 -6 + 1)*-1;
	}
	for(var no=1;no<hourItems.length-1;no++){
		var prefix='';
		if((currentHour/1 -6 + no + addHours) < 10)prefix='0';
		hourItems[no].innerHTML = prefix +  (currentHour/1 -6 + no + addHours);
		if(currentHour==(currentHour/1 -6 + no)){
			hourItems[no].style.color = selectBoxHighlightColor;
			activeSelectBoxHour = hourItems[no];
		}else{
			hourItems[no].style.color = '';
		}
	}
}

function updateMinuteDiv()
{
	for(no=0;no<60;no+=intervalSelectBox_minutes){
		var prefix = '';
		if(no<10)prefix = '0';

		document.getElementById('minuteDiv_' + prefix + no).style.color = '';
	}
	if(document.getElementById('minuteDiv_' + currentMinute)){
		document.getElementById('minuteDiv_' + currentMinute).style.color = selectBoxHighlightColor;
		activeSelectBoxMinute = document.getElementById('minuteDiv_' + currentMinute);
	}
}



function createYearDiv()
{

	if(!document.getElementById('yearDropDown')){
		var div = document.createElement('DIV');
		div.className='monthYearPicker';
	}else{
		var div = document.getElementById('yearDropDown');
		var subDivs = div.getElementsByTagName('DIV');
		for(var no=0;no<subDivs.length;no++){
			subDivs[no].parentNode.removeChild(subDivs[no]);
		}
	}


	var d = new Date();
	if(currentYear){
		d.setFullYear(currentYear);
	}

	var startYear = d.getFullYear()/1 - 5;

    var yearSpan = 10;
	if (! turnOffYearSpan) {
    	var subDiv = document.createElement('DIV');
    	subDiv.innerHTML = '&nbsp;&nbsp;- ';
    	subDiv.onclick = changeSelectBoxYear;
    	subDiv.onmouseover = highlightMonthYear;
    	subDiv.onmouseout = function(){ selectBoxMovementInProgress = false;};
    	subDiv.onselectstart = cancelCalendarEvent;
    	div.appendChild(subDiv);
    } else {
       startYear = d.getFullYear()/1 - 0;
       yearSpan = 2;
    }

	for(var no=startYear;no<(startYear+yearSpan);no++){
		var subDiv = document.createElement('DIV');
		subDiv.innerHTML = no;
		subDiv.onmouseover = highlightMonthYear;
		subDiv.onmouseout = highlightMonthYear;
		subDiv.onclick = selectYear;
		subDiv.id = 'yearDiv' + no;
		subDiv.onselectstart = cancelCalendarEvent;
		div.appendChild(subDiv);
		if(currentYear && currentYear==no){
			subDiv.style.color = selectBoxHighlightColor;
			activeSelectBoxYear = subDiv;
		}
	}
	if (! turnOffYearSpan) {
    	var subDiv = document.createElement('DIV');
    	subDiv.innerHTML = '&nbsp;&nbsp;+ ';
    	subDiv.onclick = changeSelectBoxYear;
    	subDiv.onmouseover = highlightMonthYear;
    	subDiv.onmouseout = function(){ selectBoxMovementInProgress = false;};
    	subDiv.onselectstart = cancelCalendarEvent;
    	div.appendChild(subDiv);
	}
	return div;
}

/* This function creates the hour div at the bottom bar */

function slideCalendarSelectBox()
{
	if(selectBoxMovementInProgress){
		if(activeSelectBox.parentNode.id=='hourDropDown'){
			changeSelectBoxHour(false,activeSelectBox);
		}
		if(activeSelectBox.parentNode.id=='yearDropDown'){
			changeSelectBoxYear(false,activeSelectBox);
		}

	}
	setTimeout('slideCalendarSelectBox()',speedOfSelectBoxSliding);

}

function createHourDiv()
{
	if(!document.getElementById('hourDropDown')){
		var div = document.createElement('DIV');
		div.className='monthYearPicker';
	}else{
		var div = document.getElementById('hourDropDown');
		var subDivs = div.getElementsByTagName('DIV');
		for(var no=0;no<subDivs.length;no++){
			subDivs[no].parentNode.removeChild(subDivs[no]);
		}
	}

	if(!currentHour)currentHour=0;
	var startHour = currentHour/1;
	if(startHour>14)startHour=14;

	var subDiv = document.createElement('DIV');
	subDiv.innerHTML = '&nbsp;&nbsp;- ';
	subDiv.onclick = changeSelectBoxHour;
	subDiv.onmouseover = highlightMonthYear;
	subDiv.onmouseout = function(){ selectBoxMovementInProgress = false;};
	subDiv.onselectstart = cancelCalendarEvent;
	div.appendChild(subDiv);

	for(var no=startHour;no<startHour+10;no++){
		var prefix = '';
		if(no/1<10)prefix='0';
		var subDiv = document.createElement('DIV');
		subDiv.innerHTML = prefix + no;
		subDiv.onmouseover = highlightMonthYear;
		subDiv.onmouseout = highlightMonthYear;
		subDiv.onclick = selectHour;
		subDiv.id = 'hourDiv' + no;
		subDiv.onselectstart = cancelCalendarEvent;
		div.appendChild(subDiv);
		if(currentYear && currentYear==no){
			subDiv.style.color = selectBoxHighlightColor;
			activeSelectBoxYear = subDiv;
		}
	}
	var subDiv = document.createElement('DIV');
	subDiv.innerHTML = '&nbsp;&nbsp;+ ';
	subDiv.onclick = changeSelectBoxHour;
	subDiv.onmouseover = highlightMonthYear;
	subDiv.onmouseout = function(){ selectBoxMovementInProgress = false;};
	subDiv.onselectstart = cancelCalendarEvent;
	div.appendChild(subDiv);

	return div;
}
/* This function creates the minute div at the bottom bar */

function createMinuteDiv()
{
	if(!document.getElementById('minuteDropDown')){
		var div = document.createElement('DIV');
		div.className='monthYearPicker';
	}else{
		var div = document.getElementById('minuteDropDown');
		var subDivs = div.getElementsByTagName('DIV');
		for(var no=0;no<subDivs.length;no++){
			subDivs[no].parentNode.removeChild(subDivs[no]);
		}
	}
	var startMinute = 0;
	var prefix = '';
	for(var no=startMinute;no<60;no+=intervalSelectBox_minutes){

		if(no<10)prefix='0'; else prefix = '';
		var subDiv = document.createElement('DIV');
		subDiv.innerHTML = prefix + no;
		subDiv.onmouseover = highlightMonthYear;
		subDiv.onmouseout = highlightMonthYear;
		subDiv.onclick = selectMinute;
		subDiv.id = 'minuteDiv_' + prefix +  no;
		subDiv.onselectstart = cancelCalendarEvent;
		div.appendChild(subDiv);
		if(currentYear && currentYear==no){
			subDiv.style.color = selectBoxHighlightColor;
			activeSelectBoxYear = subDiv;
		}
	}
	return div;
}

function highlightSelect()
{

	if(this.className=='selectBoxTime'){
		this.className = 'selectBoxTimeOver';
		this.getElementsByTagName('IMG')[0].src = environment.images.down_time_over;
	}else if(this.className=='selectBoxTimeOver'){
		this.className = 'selectBoxTime';
		this.getElementsByTagName('IMG')[0].src = environment.images.down_time;
	}

	if(this.className=='selectBox'){
		this.className = 'selectBoxOver';
		this.getElementsByTagName('IMG')[0].src = environment.images.down_over;
	}else if(this.className=='selectBoxOver'){
		this.className = 'selectBox';
		this.getElementsByTagName('IMG')[0].src = environment.images.down;
	}

	if(this.parentNode.className=='arrow'){
		this.parentNode.className = 'arrowOver';
	}else if(this.parentNode.className=='arrowOver'){
		this.parentNode.className = 'arrow';
	}

}

function highlightArrow()
{
	if(this.src.indexOf('over')>=0){
		if(this.src.indexOf('left')>=0)this.src = environment.images.left;
		if(this.src.indexOf('right')>=0)this.src = environment.images.right;
	}else{
		if(this.src.indexOf('left')>=0)this.src = environment.images.left_over;
		if(this.src.indexOf('right')>=0)this.src = environment.images.right_over;
	}
}

function highlightClose()
{
	if(this.src.indexOf('over')>=0){
		this.src = environment.images.close;
	}else{
		this.src = environment.images.close_over;
	}

}

function closeCalendar(){

	document.getElementById('yearDropDown').style.display='none';
	document.getElementById('monthDropDown').style.display='none';
	document.getElementById('hourDropDown').style.display='none';
	document.getElementById('minuteDropDown').style.display='none';

	calendarDiv.style.display='none';
	if(iframeObj){
		iframeObj.style.display='none';
		 //// //// fix for EI frame problem on time dropdowns 09/30/2006
			EIS_Hide_Frame();}
	if(activeSelectBoxMonth)activeSelectBoxMonth.className='';
	if(activeSelectBoxYear)activeSelectBoxYear.className='';


}

function writeTopBar()
{

	var topBar = document.createElement('DIV');
	topBar.className = 'topBar';
	topBar.id = 'topBar';
	calendarDiv.appendChild(topBar);

	// Left arrow
	var leftDiv = document.createElement('DIV');
	leftDiv.className = 'arrow';
	leftDiv.style.marginRight = '1px';
	var img = document.createElement('IMG');
	img.src = environment.images.left;
	img.onmouseover = highlightSelect;
	img.onclick = switchMonth;
	img.onmouseout = highlightSelect;
	leftDiv.appendChild(img);
	topBar.appendChild(leftDiv);
	if(Opera)leftDiv.style.width = '16px';

	// Right arrow
	var rightDiv = document.createElement('DIV');
	rightDiv.className = 'arrow';
	rightDiv.style.marginRight = '1px';
	var img = document.createElement('IMG');
	img.src = environment.images.right;
	img.onclick = switchMonth;
	img.onmouseover = highlightSelect;
	img.onmouseout = highlightSelect;
	rightDiv.appendChild(img);
	if(Opera)rightDiv.style.width = '16px';
	topBar.appendChild(rightDiv);


	// Month selector
	var monthDiv = document.createElement('DIV');
	monthDiv.id = 'monthSelect';
	monthDiv.onmouseover = highlightSelect;
	monthDiv.onmouseout = highlightSelect;
	monthDiv.onclick = showMonthDropDown;
	var span = document.createElement('SPAN');
	span.innerHTML = monthArray[currentMonth];
	span.id = 'calendar_month_txt';
	monthDiv.appendChild(span);

	var img = document.createElement('IMG');
	img.src = environment.images.down;
	img.style.position = 'absolute';
	img.style.right = '0px';
	monthDiv.appendChild(img);
	monthDiv.className = 'selectBox';
	if(Opera){
		img.style.cssText = 'float:right;position:relative';
		img.style.position = 'relative';
		img.style.styleFloat = 'right';
	}
	topBar.appendChild(monthDiv);

	var monthPicker = createMonthDiv();
	monthPicker.style.left = '37px';
	monthPicker.style.top = monthDiv.offsetTop + monthDiv.offsetHeight + 1 + 'px';
	monthPicker.style.width ='60px';
	monthPicker.id = 'monthDropDown';

	calendarDiv.appendChild(monthPicker);

	// Year selector
	var yearDiv = document.createElement('DIV');
	yearDiv.onmouseover = highlightSelect;
	yearDiv.onmouseout = highlightSelect;
	yearDiv.onclick = showYearDropDown;
	var span = document.createElement('SPAN');
	span.innerHTML = currentYear;
	span.id = 'calendar_year_txt';
	yearDiv.appendChild(span);
	topBar.appendChild(yearDiv);

	var img = document.createElement('IMG');
	img.src = environment.images.down;
	yearDiv.appendChild(img);
	yearDiv.className = 'selectBox';

	if(Opera){
		yearDiv.style.width = '50px';
		img.style.cssText = 'float:right';
		img.style.position = 'relative';
		img.style.styleFloat = 'right';
	}

	var yearPicker = createYearDiv();
	yearPicker.style.left = '113px';
	yearPicker.style.top = monthDiv.offsetTop + monthDiv.offsetHeight + 1 + 'px';
	yearPicker.style.width = '35px';
	yearPicker.id = 'yearDropDown';
	calendarDiv.appendChild(yearPicker);

/*
	var img = document.createElement('IMG');
	img.src = pathToImages + 'close.png';
	img.style.styleFloat = 'right';
	img.onmouseover = highlightClose;
	img.onmouseout = highlightClose;
	img.onclick = closeCalendar;
	topBar.appendChild(img);
	if(!document.all){
		img.style.position = 'absolute';
		img.style.right = '2px';
	}
*/


}

function writeCalendarContent()
{
	var calendarContentDivExists = true;
	if(!calendarContentDiv){
		calendarContentDiv = document.createElement('DIV');
		calendarDiv.appendChild(calendarContentDiv);
		calendarContentDivExists = false;
	}
	currentMonth = currentMonth/1;
	var d = new Date();

	d.setFullYear(currentYear);
	d.setDate(1);
	d.setMonth(currentMonth);

	var dayStartOfMonth = d.getDay();
	if (! weekStartsOnSunday) {
      if(dayStartOfMonth==0)dayStartOfMonth=7;
      dayStartOfMonth--;
   }

	document.getElementById('calendar_year_txt').innerHTML = currentYear;
	document.getElementById('calendar_month_txt').innerHTML = monthArray[currentMonth];
	document.getElementById('calendar_hour_txt').innerHTML = currentHour;
	document.getElementById('calendar_minute_txt').innerHTML = currentMinute;

	var existingTable = calendarContentDiv.getElementsByTagName('TABLE');
	if(existingTable.length>0){
		calendarContentDiv.removeChild(existingTable[0]);
	}

	var calTable = document.createElement('TABLE');
	calTable.width = '100%';
	calTable.cellSpacing = '0';
	calendarContentDiv.appendChild(calTable);




	var calTBody = document.createElement('TBODY');
	calTable.appendChild(calTBody);
	var row = calTBody.insertRow(-1);
	row.className = 'calendar_week_row';
   if (showWeekNumber) {
      var cell = row.insertCell(-1);
	   cell.innerHTML = weekString;
	   cell.className = 'calendar_week_column';
	   cell.style.backgroundColor = selectBoxRolloverBgColor;
	}

	for(var no=0;no<dayArray.length;no++){
		var cell = row.insertCell(-1);
		cell.innerHTML = dayArray[no];
	}

	var row = calTBody.insertRow(-1);

   if (showWeekNumber) {
	   var cell = row.insertCell(-1);
	   cell.className = 'calendar_week_column';
	   cell.style.backgroundColor = selectBoxRolloverBgColor;
	   var week = getWeek(currentYear,currentMonth,1);
	   cell.innerHTML = week;		// Week
	}
	for(var no=0;no<dayStartOfMonth;no++){
		var cell = row.insertCell(-1);
		cell.innerHTML = '&nbsp;';
	}

	var colCounter = dayStartOfMonth;
	var daysInMonth = daysInMonthArray[currentMonth];
	if(daysInMonth==28){
		if(isLeapYear(currentYear))daysInMonth=29;
	}

	for(var no=1;no<=daysInMonth;no++){
		d.setDate(no-1);
		if(colCounter>0 && colCounter%7==0){
			var row = calTBody.insertRow(-1);
         if (showWeekNumber) {
            var cell = row.insertCell(-1);
            cell.className = 'calendar_week_column';
            var week = getWeek(currentYear,currentMonth,no);
            cell.innerHTML = week;		// Week
            cell.style.backgroundColor = selectBoxRolloverBgColor;
         }
		}
		var cell = row.insertCell(-1);
		if(currentYear==inputYear && currentMonth == inputMonth && no==inputDay){
			cell.className='activeDay';
		}
		cell.innerHTML = no;
		cell.onclick = pickDate;
		colCounter++;
	}


	if(!document.all){
		if(calendarContentDiv.offsetHeight)
			document.getElementById('topBar').style.top = calendarContentDiv.offsetHeight + document.getElementById('timeBar').offsetHeight + document.getElementById('topBar').offsetHeight -1 + 'px';
		else{
			document.getElementById('topBar').style.top = '';
			document.getElementById('topBar').style.bottom = '0px';
		}

	}

	if(iframeObj){
		if(!calendarContentDivExists)setTimeout('resizeIframe()',350);else setTimeout('resizeIframe()',10);
	}




}

function resizeIframe()
{
	iframeObj.style.width = calendarDiv.offsetWidth + 'px';
	iframeObj.style.height = calendarDiv.offsetHeight + 'px' ;


}

function pickTodaysDate()
{
	var d = new Date();
	currentMonth = d.getMonth();
	currentYear = d.getFullYear();
	pickDate(false,d.getDate());

}

function pickDate(e,inputDay)
{
	var day;
	if(!inputDay && this)
		day = this.innerHTML; 
	else 
		day = inputDay;
	if(day/1<10)
		day = '0' + day;

	closeCalendar();
	var date = datePickerUTC ? new Date(Date.UTC(currentYear, currentMonth, day, currentHour, currentMinute)) : new Date(currentYear, currentMonth, day, currentHour, currentMinute);
	datePickerDelegate.datePickerDidClose(date);
}

// This function is from http://www.codeproject.com/csharp/gregorianwknum.asp
// Only changed the month add
function getWeek(year,month,day){
   if (! weekStartsOnSunday) {
	   day = (day/1);
	} else {
	   day = (day/1)+1;
	}
	year = year /1;
    month = month/1 + 1; //use 1-12
    var a = Math.floor((14-(month))/12);
    var y = year+4800-a;
    var m = (month)+(12*a)-3;
    var jd = day + Math.floor(((153*m)+2)/5) +
                 (365*y) + Math.floor(y/4) - Math.floor(y/100) +
                 Math.floor(y/400) - 32045;      // (gregorian calendar)
    var d4 = (jd+31741-(jd%7))%146097%36524%1461;
    var L = Math.floor(d4/1460);
    var d1 = ((d4-L)%365)+L;
    NumberOfWeek = Math.floor(d1/7) + 1;
    return NumberOfWeek;
}

function writeTimeBar()
{
	var timeBar = document.createElement('DIV');
	timeBar.id = 'timeBar';
	timeBar.className = 'timeBar';

	var subDiv = document.createElement('DIV');
	subDiv.innerHTML = 'Time:';
	//timeBar.appendChild(subDiv);

	// Year selector
	var hourDiv = document.createElement('DIV');
	hourDiv.onmouseover = highlightSelect;
	hourDiv.onmouseout = highlightSelect;
	hourDiv.onclick = showHourDropDown;
	hourDiv.style.width = '30px';
	var span = document.createElement('SPAN');
	span.innerHTML = currentHour;
	span.id = 'calendar_hour_txt';
	hourDiv.appendChild(span);
	timeBar.appendChild(hourDiv);

	var img = document.createElement('IMG');
	img.src = environment.images.down_time;
	hourDiv.appendChild(img);
	hourDiv.className = 'selectBoxTime';

	if(Opera){
		hourDiv.style.width = '30px';
		img.style.cssText = 'float:right';
		img.style.position = 'relative';
		img.style.styleFloat = 'right';
	}

	var hourPicker = createHourDiv();
	hourPicker.style.left = '130px';
	//hourPicker.style.top = monthDiv.offsetTop + monthDiv.offsetHeight + 1 + 'px';
	hourPicker.style.width = '35px';
	hourPicker.id = 'hourDropDown';
	calendarDiv.appendChild(hourPicker);

	// Add Minute picker

	// Year selector
	var minuteDiv = document.createElement('DIV');
	minuteDiv.onmouseover = highlightSelect;
	minuteDiv.onmouseout = highlightSelect;
	minuteDiv.onclick = showMinuteDropDown;
	minuteDiv.style.width = '30px';
	var span = document.createElement('SPAN');
	span.innerHTML = currentMinute;

	span.id = 'calendar_minute_txt';
	minuteDiv.appendChild(span);
	timeBar.appendChild(minuteDiv);

	var img = document.createElement('IMG');
	img.src = environment.images.down_time;
	minuteDiv.appendChild(img);
	minuteDiv.className = 'selectBoxTime';

	if(Opera){
		minuteDiv.style.width = '30px';
		img.style.cssText = 'float:right';
		img.style.position = 'relative';
		img.style.styleFloat = 'right';
	}

	var minutePicker = createMinuteDiv();
	minutePicker.style.left = '167px';
	//minutePicker.style.top = monthDiv.offsetTop + monthDiv.offsetHeight + 1 + 'px';
	minutePicker.style.width = '35px';
	minutePicker.id = 'minuteDropDown';
	calendarDiv.appendChild(minutePicker);
	return timeBar;

}

function elementBelongsToCalendar(element)
{
	var insideCalendar = false;
	for(var e=element; e; e = e.parentNode){
		if(e == calendarDiv){
			insideCalendar = true;
			break;
		}
	}
	return insideCalendar;
}

function datePickerIsVisible()
{
	return calendarDiv.style && calendarDiv.style.display != "none";
}

function writeBottomBar()
{
	var d = new Date();
	var bottomBar = document.createElement('DIV');

	bottomBar.id = 'bottomBar';

	bottomBar.style.cursor = 'pointer';
	bottomBar.className = 'todaysDate';
	// var todayStringFormat = '[todayString] [dayString] [day] [monthString] [year]';	;;

	var subDiv = document.createElement('DIV');
	subDiv.onclick = pickTodaysDate;
	subDiv.id = 'todaysDateString';
	subDiv.style.width = (calendarDiv.offsetWidth - 95) + 'px';
	var day = d.getDay();
	if (! weekStartsOnSunday) {
      if(day==0)day = 7;
      day--;
   }

	var bottomString = todayStringFormat;
	bottomString = bottomString.replace('[monthString]',monthArrayShort[d.getMonth()]);
	bottomString = bottomString.replace('[day]',d.getDate());
	bottomString = bottomString.replace('[year]',d.getFullYear());
	bottomString = bottomString.replace('[dayString]',dayArray[day].toLowerCase());
	bottomString = bottomString.replace('[UCFdayString]',dayArray[day]);
	bottomString = bottomString.replace('[todayString]',todayString);

	subDiv.innerHTML = todayString + ': ' + d.getDate() + '. ' + monthArrayShort[d.getMonth()] + ', ' +  d.getFullYear() ;
	subDiv.innerHTML = bottomString ;
	bottomBar.appendChild(subDiv);

	var timeDiv = writeTimeBar();
	bottomBar.appendChild(timeDiv);

	calendarDiv.appendChild(bottomBar);



}
function getTopPos(inputObj)
{

  var returnValue = inputObj.offsetTop + inputObj.offsetHeight;
  while((inputObj = inputObj.offsetParent) != null)returnValue += inputObj.offsetTop;
  return returnValue + calendar_offsetTop;
}

function getleftPos(inputObj)
{
  var returnValue = inputObj.offsetLeft;
  while((inputObj = inputObj.offsetParent) != null)returnValue += inputObj.offsetLeft;
  return returnValue + calendar_offsetLeft;
}

function positionCalendar(inputObj)
{
	calendarDiv.style.left = PWUtils.getX(inputObj) + 'px';
	calendarDiv.style.top = PWUtils.getY(inputObj) + Element.getHeight(inputObj) + 7 + 'px';
	if(iframeObj){
		iframeObj.style.left = calendarDiv.style.left;
		iframeObj.style.top =  calendarDiv.style.top;
		//// fix for EI frame problem on time dropdowns 09/30/2006
		iframeObj2.style.left = calendarDiv.style.left;
		iframeObj2.style.top =  calendarDiv.style.top;
	}

}

function initCalendar()
{
	if(MSIE){
		iframeObj = document.createElement('IFRAME');
		iframeObj.style.filter = 'alpha(opacity=0)';
		iframeObj.style.position = 'absolute';
		iframeObj.border='0px';
		iframeObj.style.border = '0px';
		iframeObj.style.backgroundColor = '#FF0000';
		//// fix for EI frame problem on time dropdowns 09/30/2006
		iframeObj2 = document.createElement('IFRAME');
		iframeObj2.style.position = 'absolute';
		iframeObj2.border='0px';
		iframeObj2.style.border = '0px';
		iframeObj2.style.height = '1px';
		iframeObj2.style.width = '1px';
		//// fix for EI frame problem on time dropdowns 09/30/2006
		// Added fixed for HTTPS
		iframeObj2.src = 'blank.html';
		iframeObj.src = 'blank.html';
		document.body.appendChild(iframeObj2);  // gfb move this down AFTER the .src is set
		document.body.appendChild(iframeObj);
	}

	calendarDiv = document.createElement('DIV');
	calendarDiv.id = 'calendarDiv';
	calendarDiv.style.zIndex = 1000;
	slideCalendarSelectBox();

	document.body.appendChild(calendarDiv);
	writeBottomBar();
	writeTopBar();



	if(!currentYear){
		var d = new Date();
		currentMonth = d.getMonth();
		currentYear = d.getFullYear();
	}
	writeCalendarContent();



}

function setTimeProperties()
{
	if(!calendarDisplayTime){
		document.getElementById('timeBar').style.display='none';
		document.getElementById('timeBar').style.visibility='hidden';
		document.getElementById('todaysDateString').style.width = '100%';


	}else{
		document.getElementById('timeBar').style.display='block';
		document.getElementById('timeBar').style.visibility='visible';
		document.getElementById('hourDropDown').style.top = document.getElementById('calendar_minute_txt').parentNode.offsetHeight + calendarContentDiv.offsetHeight + document.getElementById('topBar').offsetHeight + 'px';
		document.getElementById('minuteDropDown').style.top = document.getElementById('calendar_minute_txt').parentNode.offsetHeight + calendarContentDiv.offsetHeight + document.getElementById('topBar').offsetHeight + 'px';
		document.getElementById('minuteDropDown').style.right = '50px';
		document.getElementById('hourDropDown').style.right = '50px';
		document.getElementById('todaysDateString').style.width = '115px';
	}
}

function calendarSortItems(a,b)
{
	return a/1 - b/1;
}

function calendarDisplaysTime()
{
	return calendarDisplayTime;
}

function displayCalendar(date, utc, delegate, inputField, format, buttonObj, displayTime, timeInput)
{
	calendarDisplayTime=displayTime; 
	datePickerUTC = utc;
	datePickerDelegate = delegate;
	currentMonth = utc ? date.getUTCMonth() : date.getMonth();
	currentYear = utc ? date.getUTCFullYear() : date.getFullYear();
	currentHour = utc ? date.getUTCHours() : date.getHours();
	currentMinute = utc ? date.getUTCMinutes() : date.getMinutes();
	tmpDay = utc ? date.getUTCDate() : date.getDate();
			
	inputYear = currentYear;
	inputMonth = currentMonth;
	inputDay = tmpDay/1;


	if(!calendarDiv){
		initCalendar();
	}else{
		if(calendarDiv.style.display=='block'){
			closeCalendar();
			return false;
		}
		writeCalendarContent();
	}
	returnFormat = format;
	returnDateTo = inputField;
	positionCalendar(buttonObj);
	calendarDiv.style.visibility = 'visible';
	calendarDiv.style.display = 'block';
	if(iframeObj){
		iframeObj.style.display = '';
		iframeObj.style.height = '140px';
		iframeObj.style.width = '195px';
				iframeObj2.style.display = '';
		iframeObj2.style.height = '140px';
		iframeObj2.style.width = '195px';
	}
	setTimeProperties();
	updateYearDiv();
	updateMonthDiv();
	updateMinuteDiv();
	updateHourDiv();
}

function displayCalendarSelectBox(yearInput,monthInput,dayInput,hourInput,minuteInput,buttonObj)
{
	if(!hourInput)calendarDisplayTime=false; else calendarDisplayTime = true;

	currentMonth = monthInput.options[monthInput.selectedIndex].value/1-1;
	currentYear = yearInput.options[yearInput.selectedIndex].value;
	if(hourInput){
		currentHour = hourInput.options[hourInput.selectedIndex].value;
		inputHour = currentHour/1;
	}
	if(minuteInput){
		currentMinute = minuteInput.options[minuteInput.selectedIndex].value;
		inputMinute = currentMinute/1;
	}

	inputYear = yearInput.options[yearInput.selectedIndex].value;
	inputMonth = monthInput.options[monthInput.selectedIndex].value/1 - 1;
	inputDay = dayInput.options[dayInput.selectedIndex].value/1;

	if(!calendarDiv){
		initCalendar();
	}else{
		writeCalendarContent();
	}
	returnDateToYear = yearInput;
	returnDateToMonth = monthInput;
	returnDateToDay = dayInput;
	returnDateToHour = hourInput;
	returnDateToMinute = minuteInput;
	returnFormat = false;
	returnDateTo = false;
	positionCalendar(buttonObj);
	calendarDiv.style.visibility = 'visible';
	calendarDiv.style.display = 'block';
	if(iframeObj){
		iframeObj.style.display = '';
		iframeObj.style.height = calendarDiv.offsetHeight + 'px';
		iframeObj.style.width = calendarDiv.offsetWidth + 'px';
		//// fix for EI frame problem on time dropdowns 09/30/2006
		iframeObj2.style.display = '';
		iframeObj2.style.height = calendarDiv.offsetHeight + 'px';
		iframeObj2.style.width = calendarDiv.offsetWidth + 'px'
	}
	setTimeProperties();
	updateYearDiv();
	updateMonthDiv();
	updateHourDiv();
	updateMinuteDiv();
}
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("OutlineView");

function mouseWheelDeltaFromEvent(event)
{
	var y = 0;
	var deltaY = event.wheelDeltaY;
	if(deltaY == undefined)
		deltaY = event.wheelDelta;
	if(deltaY) { // IE/Opera.
		y = deltaY / 3;
		if (window.opera)
			y = -y;
	}else if (event.detail) { // Mozilla case. 
		y = -event.detail*8; // In Mozilla, sign of delta is different than in IE.
	}
	var x = 0;	
	if(event.wheelDeltaX) {	
		x = event.wheelDeltaX / 3;
		if (window.opera)
			x = -x;		
	}
	return {x:x, y:y};
}

var OutlineView = Base.extend({
	constructor: function (outlineDiv, controller, indentationPerLevel, dependendView, enableInteraction, environment, showPrintView, delegate){	
		this.showPrintView				= showPrintView;
		this.padding					= 3;
		this.environment				= environment;
		this.outline					= outlineDiv;
		this.controller					= controller;
		this.indentationPerLevel		= indentationPerLevel;
		this.dependendView				= dependendView;
		this.enableInteraction			= enableInteraction;
		if(this.showPrintView)
			this.enableInteraction		= false;
		this.resizeAreaWidth 			= 10;
		this.minColumnWidth				= 30;
		this.editedColumns				= null;
		this.blockSize					= 20;
		this.outlineColumnPadding		= 9;
		this.delegate					= delegate;
		this.showsHeader				= true;
		this.alternateRows				= true;
		this.isFocused					= true;
		this.singleSelection			= false;
		this.enableDrags				= true;
	},

	
	setEnableDrags: function(flag) {
		this.enableDrags = flag;
	},
	
	setSingleSelection: function(flag){
		this.singleSelection = flag;
		this.controller.setSingleSelection(flag);
	},
	
	setIsFocused: function(focused){
		this.isFocused = focused;
		this.refresh();
	},

	setAlternateRows: function(flag){
		this.alternateRows = flag;
	},

	setDelegate: function(delegate)	{	
		this.delegate = delegate;	// Wird benachrichtigt, wenn sich die Outline-View √§ndert.
	},

	setColumnsAndOutlineColumnKey: function(columns, outlineColumnKey) {	
		if(!columns)
			return;
		this.tableColumns = columns;	
		var count = columns.length;
		for(var i=0; i<count; i++)
		{
			var column = columns[i];
			column.setTableView(this);
			if(column.key == outlineColumnKey)
				this.outlineColumn = column;		
		}
		this.createTables();
		this.updateTableHead();
		this.updateTableBody();
		this.containerSizeChanged();
	},

	setDependendView: function(dependentView) {
		this.dependendView = dependentView;	
	},

	setShowsHeader: function(flag){
		this.showsHeader = flag;
	},

	setHeaderHeight: function(height) {
		this.headerHeight = height;
		if(this.contentContainer)
			this.contentContainer.style.top = height + "px";
		if(this.headerContainer)
			this.headerContainer.style.height = height + "px";	
		else
			this.invalidHeaderHeight = true;
		if(this.header)
			this.header.height = height;
		if(this.cellGradient)
			this.cellGradient.style.height = this.headerContainer.style.height;
	},

	setScrollTop: function(scrollTop) {
		this.blockScrollHandler = true;
		if(this.contentContainer.scrollTop != scrollTop)
		{
			this.contentContainer.scrollTop = scrollTop;	
			this.drawVisibleRows();
		}		
	},

	doscroll: function(event) {	
		if(this.blockScrollHandler){
			this.drawVisibleRows();
			this.blockScrollHandler = false;
			return;
		}			
		event = event || window.event;
		if(this.headerContainer && this.headerContainer.scrollLeft!=this.contentContainer.scrollLeft)
			this.headerContainer.scrollLeft=this.contentContainer.scrollLeft
		if(this.dependendView)
			this.dependendView.setScrollTop(this.contentContainer.scrollTop);
		Event.stop(event);
		this.drawVisibleRows();
	},

	domousewheel: function(event) {	
		this.blockScrollHandler = true;
		event = event || window.event;
		var delta = mouseWheelDeltaFromEvent(event);
		this.contentContainer.scrollTop -= delta.y;
		this.contentContainer.scrollLeft -= delta.x;
		if(this.dependendView)
			this.dependendView.setScrollTop(this.contentContainer.scrollTop);
		Event.stop(event);
	},

	tableWidth: function() {
		var width = 0;
		for(var colIndex=0; colIndex<this.tableColumns.length; colIndex++)
			width += this.tableColumns[colIndex].width;	
		return width;
	},

	createTables: function() {			
		if(this.contentContainer || !this.tableColumns)
			return;
		var width = this.tableWidth();
		
		if(this.showsHeader) {     
			// Header
			this.headerContainer = $(window.document.createElement("div"));
			this.headerContainer.className = "headerContainer";
			if(!this.showPrintView)
				this.gradientContainer = PWUtils.drawHeaderGradient(this.headerContainer, this.environment.images.grayGradient);		

			this.header = $(window.document.createElement("div"));
			this.header.className = "header"
			this.headerContainer.appendChild(this.header);
			this.outline.appendChild(this.headerContainer);
			
			this.headerContainer.style.overflow = "hidden";
			this.headerContainer.style.top = "0px";
			this.headerContainer.style.left = "0px";
			this.headerContainer.style.position = "absolute";

			// Platzhalter zum Draggen von Spalten

			this.dragableTableHeader = $(window.document.createElement("div"));
			this.dragableTableHeader.className = "dragableTableHeader";
			this.dragableTableHeader.style.overflow = "hidden";
			this.dragableTableHeader.style.top = "0px";
			this.dragableTableHeader.style.left = "0px";
			this.dragableTableHeader.style.width = "100px";
			this.dragableTableHeader.style.height = (this.headerHeight ? this.headerHeight : 1) + "px";	
			this.dragableTableHeader.style.visibility = "hidden";	
			this.dragableTableHeader.style.position = "absolute";
			this.dragableTableHeader.style.filter = "alpha(opacity=75)";	// opacity fuer den IE
			this.headerContainer.appendChild(this.dragableTableHeader);
		}
		
		// Table
		this.contentContainer = $(window.document.createElement("div"));
		this.contentContainer.className = "contentContainer";
		this.outline.appendChild(this.contentContainer);		
		this.contentContainer.style.overflowX = this.showPrintView ? "hidden" : "scroll";
		this.contentContainer.style.overflowY = "hidden";
		this.contentContainer.style.top = (this.shwHeader ? (this.headerHeight ? this.headerHeight : 1) + 2 : 0) + "px";
		this.contentContainer.style.left = "0px";
		this.contentContainer.style.right = "0px";
		this.contentContainer.style.bottom = "0px";
		this.contentContainer.style.position = "absolute";

		// Platzhalter für den Einfügemarker beim Sortieren von Spalten
		
		this.columnSortMarker = $(window.document.createElement("div"));
		this.columnSortMarker.className = "columnSortMarker";
		this.columnSortMarker.style.overflow = "hidden";
		this.columnSortMarker.style.top = "0px";
		this.columnSortMarker.style.left = "0px";
		this.columnSortMarker.style.visibility = "hidden";	
		this.columnSortMarker.style.position = "absolute";

		this.contentContainer.appendChild(this.columnSortMarker);

		// Event Handler verknüpfen
		if(this.enableInteraction){
			this.doScrollEventListener = this.doscroll.bindAsEventListener(this);
			PWUtils.observe(this.contentContainer, 'scroll', this.doScrollEventListener, true);
		}
		var overflowY;
		if(this.contentContainer.currentStyle)
			overflowY = this.contentContainer.currentStyle.overflowY;
		else if(window.getComputedStyle)
			overflowY = window.getComputedStyle(this.contentContainer, null).overflowY;

		if(overflowY == "hidden" && this.enableInteraction)	{
			this.domousewheelEventListener = this.domousewheel.bindAsEventListener(this);
			PWUtils.observe(this.contentContainer, 'mousewheel', this.domousewheelEventListener, true);
			PWUtils.observe(this.contentContainer, 'DOMMouseScroll', this.domousewheelEventListener, true);

			this.doDoubleClickInEmptyAreaEventListener = this.doDoubleClickInEmptyArea.bindAsEventListener(this);
			PWUtils.observe(this.contentContainer, 'dblclick', this.doDoubleClickInEmptyAreaEventListener, true);

		}
		if(this.headerContainer)
			PWUtils.setSelectionEnabled(this.headerContainer, false);
		PWUtils.setSelectionEnabled(this.contentContainer, false);
	},


	doDoubleClickInEmptyArea: function(event){
		if(this.showPrintView)
			return;

		var event = event || window.event;
		var target = event.srcElement ? event.srcElement : event.target;
		Event.extend(event);
		if(this.delegate && this.delegate.outlineDoubleClickInEmptyArea)
			this.delegate.outlineDoubleClickInEmptyArea(this, event);
	},

	setXScrollBarType: function(type){
		this.contentContainer.style.overflowX = type;		
	},

	setYScrollBarType: function(type){
		this.contentContainer.style.overflowY = type;			
	},

	setEnableScrollBars: function(flag)	{
		this.contentContainer.style.overflowX= flag ? "scroll" : "hidden";	
	},

	updateTableHead: function()	{		
		if(this.blockRefresh || !this.showsHeader)
			return;

        if(this.headerCells) {
            for(var i=0; i<this.headerCells.length; i++) {
                var cell = this.headerCells[i];
                PWUtils.stopObserving(cell, 'mousedown', this.clickedInColumnHeadEventListener);
                PWUtils.stopObserving(cell, 'mousemove', this.handleMouseMoveInTableHeadEventListener);
            }
        }

		if(this.invalidHeaderHeight)
			this.setHeaderHeight(this.headerHeight);				
		var newHeader = $(window.document.createElement("div"));
		newHeader.className = "header"
		this.headerCells = [];
		var left = 0	
		var lastCell = null;
		if(!this.clickedInColumnHeadEventListener)
			this.clickedInColumnHeadEventListener = this.clickedInColumnHead.bindAsEventListener(this);
		if(!this.handleMouseMoveInTableHeadEventListener)
			this.handleMouseMoveInTableHeadEventListener = this.handleMouseMoveInTableHead.bindAsEventListener(this);			
		var height		= this.headerHeight ? this.headerHeight : 1;
		var colIndex;
		for(colIndex=0; colIndex<this.tableColumns.length; colIndex++) {
			var border		= 1;
			var column 		= this.tableColumns[colIndex];
			var style = "left:"+left+"px; width:"+(column.width-this.padding)+"px; height:"+(height-(this.showPrintView ? 1 : 0)) + "px; text-align:"+column.headerAlign+"; padding-left:"+this.padding+"px;";
			style += "border-bottom: 1px solid #aaaaaa;"
			var textContainer;
			var imageContainer;
			var cell;
			var comparison = column.doSortDescriptorsEqualPrototype(this.controller.sortDescriptors);
			if(comparison!=0) {
				if(column.headerAlign == "right"){
					cell = DIV( {'class':'headerCell', style:style}, 
						imageContainer = DIV({style:"position:absolute; top:0px; bottom:0px; left:0px; width:18px;"}),
						textContainer = DIV({style:"overflow:hidden; position:absolute; bottom:0px; top:0px; left:11px; right:0px; text-align:"+column.headerAlign+"; padding-right:"+this.padding+"px;"})
					);
				}else{
					cell = DIV( {'class':'headerCell', style:style},
						textContainer = DIV({style:"overflow:hidden; position:absolute; bottom:0px; top:0px; left:0px; right:11px; text-align:"+column.headerAlign+"; padding-left:"+this.padding+"px;"}),
						imageContainer = DIV({style:"position:absolute; top:0px; bottom:0px; right:0px; width:18px;"})
					);				
				}
			}else{
				cell = DIV( {'class':'headerCell', style:style},
					textContainer = DIV({style:"position:absolute; top:0px; bottom:0px; right:3px; left: 3px; overflow:hidden;"})
				);
				//textContainer = cell;
			}
			cell.outline	= this;
			cell.column 	= column;
			cell.colIndex   = colIndex;			
			if(Prototype.Browser.IE)	// Der Click-Handler wird sonst nicht aufgerufen
				cell.style.backgroundImage = "url('"+this.environment.images.Transparent+"')";
			this.headerCells[colIndex]=cell;
			if(!this.showPrintView && comparison!=0) {
				this.addSortIndicatorForColumnToCell(column, imageContainer, comparison == 1 ? true : false );		// Image
				if(!this.showPrintView){
					var gradient = PWUtils.drawHeaderGradient(cell, this.environment.images.blueGradient);
					gradient.className = "gradient";
					gradient.style.left = "1px";
					cell.gradient = gradient;
					this.cellGradient = gradient;
				}
			}
			var cellWrapper = $(window.document.createElement("span"));
			cellWrapper.appendChild(window.document.createTextNode(column.title));											// Text
			if(column.title.length > 2 && column.title[1] == " ")
				cellWrapper.style.whiteSpace = "nowrap";
			textContainer.appendChild(cellWrapper);
			if(this.enableInteraction) {
				PWUtils.observe(cell, 'mousedown', this.clickedInColumnHeadEventListener);
				PWUtils.observe(cell, 'mousemove', this.handleMouseMoveInTableHeadEventListener);
			}
			newHeader.appendChild(cell);
			left += column.width;
			if(lastCell)
				lastCell.nextCell = cell;
			lastCell = cell;
		}	
		if(this.enableInteraction && this.headerCells.length) {	// This cell is only there to allow dragging from the right side of the last cell.
			var style = "left:"+left+"px; width:"+7+"px; height:"+(height-(this.showPrintView ? 1 : 0)) + "px;";
			style += "border-bottom: 1px solid #aaaaaa; border-right:0px;";
			var dragCell = DIV( {'class':'headerCell', style:style});
			dragCell.outline = this;
			dragCell.colIndex = colIndex;
			this.headerCells[colIndex]=dragCell;	
			PWUtils.observe(dragCell, 'mousedown', this.clickedInColumnHeadEventListener);
			PWUtils.observe(dragCell, 'mousemove', this.handleMouseMoveInTableHeadEventListener);
			if(lastCell)
				lastCell.nextCell = dragCell;
			newHeader.appendChild(dragCell);
		}
		if(this.header)
			this.headerContainer.replaceChild(newHeader, this.header);
		else
			this.headerContainer.appendChild(newHeader);
		this.header = newHeader;
	},


	drawCellContent: function(cell, row) {
		var cellContent = cell.column.cellContentForObject(row.object, cell, window.document, cell.isEdited);				
		cell.style.overflowY = "hidden";
		if(cellContent)	{
			if(this.delegate && this.delegate.outlineDidCreateCellInRow)
				this.delegate.outlineDidCreateCellInRow(this, cell, row);
			cell.appendChild(cellContent);
		}	
	},

	drawCellContentForRow: function(row) {
		var cell;
		var length = row.cachedCells.length;
		for(var i=0; i<length; i++)	{	
			cell = row.cachedCells[i];
			this.drawCellContent(cell, row);
		}

		for(var i=0; i<length; i++)	{	
			row.cachedCells.pop();
		}		
		delete row.cachedCells;
		row.cachedCells = null;
		row.hasContent = true;
	},


	refreshGradientContainer: function() {		
		if(this.gradientContainer)
			this.gradientContainer.style.width = Math.max(parseInt(this.header.style.width), this.headerContainer.offsetWidth) + "px";	
	},


	calculateRowPositionsFromObjects: function(objects)	{
		result = [];
		var top = 0;
		var object;
		var row = {object:null};
		var height;
		for(var rowIndex=0; rowIndex<objects.length; rowIndex++) {
			row.object = objects[rowIndex];
			height = this.delegate && this.delegate.outlineHeightForRow ? this.delegate.outlineHeightForRow(this, row) : 20;
			result.push({top:top, height:height, visible:false});
			top+=height;
		}
		return result;
	},	

	groupedRowPositions: function(rowPositions) {
		var currentBlock = null;
		var rowBlocks = [];
		var rowPos = null;
		var ri;
		for(ri=0; ri<rowPositions.length; ri++)	{
			rowPos = rowPositions[ri];
			if(!(ri % this.blockSize)) {
				if(currentBlock) {
					currentBlock.endIndex = ri-1;
					currentBlock.bottom = rowPos.top+rowPos.height;
					rowBlocks.push(currentBlock);
				}
				currentBlock = {startIndex:ri, top:rowPos.top, visible:false};
			}
		}
		if(rowPos){
			currentBlock.endIndex = ri-1;
			currentBlock.bottom = rowPos.top+rowPos.height;
			rowBlocks.push(currentBlock);
		}
		return rowBlocks;
	},

	ruleStyleForColumn: function(column, left) {
		return ".col_"+column.key+" { position: absolute; overflow: hidden; white-space: nowrap; border-right:1px solid gray; top: 0px; bottom: 0px; width:"+(column.width-this.padding)+"px; left: "+left+"px; }"; 
	},

    drawRowAtIndex: function(index) {
		if(!this.content)
			return;
		if(!this.mouseDownInRowEventListener)
			this.mouseDownInRowEventListener = this.mouseDownInRow.bindAsEventListener(this);			
		var extraSpace = Prototype.Browser.WebKit ? 0 : 1;
        var object = this.objects[index];
		var isRowSelected = this.controller.selectedObjects.indexOf(object)!=-1;		
        var rowPos = this.rowPositions[index];        
		var rowDiv = $(window.document.createElement("div"));
		var odd = this.alternateRows ? index % 2 : false;
		rowDiv.isOdd = odd;
		rowDiv.rowIndex = index;
		rowDiv.cachedOffsetTop = rowPos.top;
		rowDiv.heightInPixel = rowPos.height;
        rowDiv.style.top = rowPos.top+"px";
        rowDiv.style.height = rowPos.height+"px";
		rowDiv.originalClassName = odd ?  "oddRow" : "evenRow";
		rowDiv.originalBackgroundColor = odd ? "#efefef" : "#ffffff" ;
        rowDiv.className = isRowSelected ? "selected" : rowDiv.originalClassName;
		rowDiv.style.backgroundColor = isRowSelected ? (this.isFocused ? "#3d80df" : "#D4D4D4") : rowDiv.originalBackgroundColor;
		rowDiv.object = object;
        var left = 0;
        var width;
        var paddingLeft;
		var cellContent;
		var column;
		var editMode;
		var children = object.valueForKey(this.controller.childrenKey);	
		var setFocus = true;
		for(var colIndex=0; colIndex<this.tableColumns.length; colIndex++) {
			column = this.tableColumns[colIndex];
			var key = column.key;
			editMode = this.editedColumns!=null && this.editedColumns.indexOf(column)!=-1 && isRowSelected;
			width = column.width;
            var colDiv = $(window.document.createElement("div"));
            colDiv.className = "column";
			if(column == this.outlineColumn) {
				paddingLeft = (object.level*this.indentationPerLevel) + this.outlineColumnPadding;
				var shouldShowDisclosureButton = false;
				if(this.delegate && this.delegate.outlineShouldShowDisclosureButtonForObject)
					shouldShowDisclosureButton = this.delegate.outlineShouldShowDisclosureButtonForObject(object);
				if( shouldShowDisclosureButton || (children && children.length && !object.valueForKey(this.controller.isLeafKey))) {
					this.addDisclosureButtonForRowToCell(rowDiv, colDiv, rowPos.height, editMode);
				}
			}
			else
				paddingLeft = this.padding;
			colDiv.style.width = width-paddingLeft-5 + "px";								
            colDiv.style.left = left+"px";	//live resize off
            colDiv.style.paddingLeft = paddingLeft + "px";
			colDiv.style.lineHeight = rowPos.height + "px";
			colDiv.column = column;

			cellContent = column.cellContentForObject(object, colDiv, window.document, editMode, rowPos.height);
			if(cellContent)	{
				if(editMode && setFocus){
				    var inputs = cellContent.tagName == 'INPUT' ? [cellContent] : cellContent.getElementsByTagName('input');
					if(inputs.length != undefined && inputs.length){
						var input = inputs[0];
						window.setTimeout(function(){
							if(input.focus){
								input.focus();
								if(input.select)
									input.select();
							}
						}, 10);
					}
					setFocus = false;
				}
				if(this.delegate && this.delegate.outlineDidCreateCellInRow)
					this.delegate.outlineDidCreateCellInRow(this, colDiv, rowDiv, editMode, isRowSelected);                

				colDiv.appendChild(cellContent);    //huhu

//				colDiv.appendChild(document.createTextNode("hallo"));
			}	
            left += width;//+extraSpace; 
            rowDiv.appendChild(colDiv);
		}
		rowDiv.originalColor = "#000000";
		if(this.delegate && this.delegate.outlineDidCreateRow)
			this.delegate.outlineDidCreateRow(this, rowDiv);
		if(isRowSelected)
			rowDiv.style.color = this.isFocused ? "#ffffff" : "#000000";			
        rowPos.visible = true;		
		PWUtils.observe(rowDiv, 'mousedown', this.mouseDownInRowEventListener);
		return rowDiv;
    },

    drawBlock: function(block) {
		if(!this.content)
			return;
		var row;
		var rows = this.blockDidCreateRowsNotification ? this.drawnRows : [];
		block.rows = [];
        for(var k=block.startIndex; k<=block.endIndex; k++){
            row = this.drawRowAtIndex(k);
			this.content.appendChild(row);
			this._rows[k] = row;
			rows.push(row);
			block.rows.push(row);
		}
        block.visible = true;
		if(!this.blockDidCreateRowsNotification && this.delegate && this.delegate.outlineDidCreateRows)
			this.delegate.outlineDidCreateRows(this, rows);
    },
	
	blockContainsSelectedRows: function(block) {
        for(var i=block.startIndex; i<=block.endIndex; i++){
			if(this.controller.selectedObjects.indexOf(this.objects[i])!=-1)
				return true;
		}
		return false;
	},

	drawVisibleRows: function()	{
		if(!this.content)
			return;

		var diff = 2;
        var scrollTop = this.contentContainer.scrollTop;
        var newVisibleTop = scrollTop - diff;
        var newVisibleBottom = this.contentContainer.offsetHeight + scrollTop + diff;
        if((!this.visibleTop || this.visibleTop != newVisibleTop) || (!this.visibleBottom || this.visibleBottom != newVisibleBottom)){
            this.visibleTop = newVisibleTop;
            this.visibleBottom = newVisibleBottom - PWUtils.scrollbarWidth();   
            var block;
            for(var i=0; i<this.rowBlocks.length; i++){
                block = this.rowBlocks[i];
                if( (block.top >= this.visibleTop && block.top <= this.visibleBottom) || 
                    (block.bottom >= this.visibleTop && block.bottom <= this.visibleBottom) || 
					(block.top <= this.visibleTop && block.bottom >= this.visibleBottom)  ||
					this.blockContainsSelectedRows(block)){
					if(!block.visible)
						this.drawBlock(block);
					else if(!this.blockDidCreateRowsNotification && this.delegate && this.delegate.outlineRowsBecameVisible)
						this.delegate.outlineRowsBecameVisible(this, block.rows);						
                }
            }
        }        
	},

	removeEventListenersFromRow: function(row) {
		if(this.mouseDownInRowEventListener) {
			PWUtils.stopObserving(row, 'mousedown', this.mouseDownInRowEventListener);
			if(row.clickEventListeners) {
				for(var k=0; k<row.clickEventListeners.length; k++) {
					var info = row.clickEventListeners[k];
					PWUtils.stopObserving(info.listener, 'click', info.method);
				}
			}
		}

		// Remove event listeners managed by table columns:
		row.childElements().each(function(element){
			if(element.column) {
				var childs = element.childElements();
				if(childs.length)
					element.column.removeEventHandlersFromElement(childs[0]);
			}
		});

	},

	removeEventListenersFromRows: function(rows) {
		if(rows && this.mouseDownInRowEventListener) {
			for(var i=0; i<rows.length; i++) {
				var row = rows[i];
				if(row)
					this.removeEventListenersFromRow(row);
			}
		}
	},

	updateTableBody: function(doNotNotifyDelegate) {   
		if(this.blockRefresh)
			return;	
		this.objects 	= this.controller.getFlatObjects();			
		var oldTable	= this.content;
		var newTable	= $(window.document.createElement("div"));
		newTable.className	= "outlineTable"
		var tableWidth	= Math.max(this.tableWidth(), this.contentContainer.offsetWidth);
		if(this.header)
			this.header.style.width = tableWidth + "px";		
		newTable.style.width = tableWidth+"px"
		this.rowPositions = this.calculateRowPositionsFromObjects(this.objects);
		this.rowBlocks = this.groupedRowPositions(this.rowPositions);
		var lastRowPosition = this.rowPositions.length ? this.rowPositions[this.rowPositions.length-1] : null;
		var tableHeight = lastRowPosition ? lastRowPosition.top+lastRowPosition.height : 0;
		newTable.style.height = tableHeight+"px"
		this.removeEventListenersFromRows(this._rows);
		this._rows = [];
		if(this.enableInteraction){
			if(!this.handleDoubleClickInRowEventListener)
				this.handleDoubleClickInRowEventListener = this.handleDoubleClickInRow.bindAsEventListener(this);
			if(!this.mouseMoveEventListener)
				this.mouseMoveEventListener = this.mouseMove.bindAsEventListener(this);
			if(oldTable) {
				PWUtils.stopObserving(oldTable, "dblclick", this.handleDoubleClickInRowEventListener);
				PWUtils.stopObserving(oldTable, "mousemove", this.mouseMoveEventListener);			
			}
			PWUtils.observe(newTable, "dblclick", this.handleDoubleClickInRowEventListener);
			PWUtils.observe(newTable, "mousemove", this.mouseMoveEventListener);
		}
		this.refreshGradientContainer();
		if(oldTable) {
			this.contentContainer.replaceChild(newTable, oldTable);
		}else
			this.contentContainer.appendChild(newTable);					
		this.content = newTable;		
		this.visibleTop = null;
		this.visibleBottom = null;		
		this.blockDidCreateRowsNotification	= true;
		this.drawnRows = [];
		this.drawVisibleRows();		
		this.blockDidCreateRowsNotification	= false;
		if(this.delegate && this.delegate.outlineChanged && !doNotNotifyDelegate)
			this.delegate.outlineChanged(this, this.drawnRows);
	},

	height: function() {
		if(!this.content)
			return 0;
		var heigt;
		if(this.content.currentStyle) // IE
			height = this.content.offsetHeight;
		else if(window.getComputedStyle)
			height = window.getComputedStyle(this.content, null).height;
		return parseInt(height);
	},

	fullHeight: function() {
		return this.content.offsetHeight + /*this.header.offsetHeight +*/ this.headerHeight;
	},

	width: function() {
		return parseInt(this.content.style.width);
	},

	addSortIndicatorForColumnToCell: function(column, cell, ascending) {
		var image = ascending ? this.environment.images.SortIndicatorUp : this.environment.images.SortIndicatorDown;
		var button = IMG({	width:9, height:7, src:image, 
							style:"position:absolute; top:50%; left:1px; margin-top:-3px; margin-left:4px; margin-right:4px;"});
		button.column 	= column;
		button.outline 	= this;
		cell.appendChild(button);
	},

	addDisclosureButtonForRowToCell: function(row, cell, height, editMode) {
		if(!this.showPrintView){
			var button = $(window.document.createElement("img"));
			if(Prototype.Browser.IE && editMode && height) {
				button.style.position = "relative";
				button.style.top = (height-5)/2+"px";
			}
			button.row		= row;
			button.object 	= row.object;
			button.outline 	= this;
			button.width = 9;
			button.height = 8;
			button.style.position="relative";
			button.style.left="-9px";
			button.style.marginRight="-9px";
			var rightImage = this.environment.images.DisclosureRight;
			var downImage =  this.environment.images.DisclosureDown;
			if(this.enableInteraction) {
				if(!this.toggleCollapseEventListener)
					this.toggleCollapseEventListener = this.toggleCollapse.bindAsEventListener(this);
				PWUtils.observe(button, "click", this.toggleCollapseEventListener);
				if(!row.clickEventListeners)
					row.clickEventListeners = [];
				row.clickEventListeners.push({listener:button, method:this.toggleCollapseEventListener});
			}
			cell.appendChild(button);
			if(this.delegate && this.delegate.outlineViewDidCreateDisclosureButtonForRow)
				this.delegate.outlineViewDidCreateDisclosureButtonForRow(this, button, row);
			if(!button.src)
				button.src = row.object.valueForKey(this.controller.isCollapsedKey) ? rightImage : downImage;
		}
	},

	hasHorizontalScrollbar: function() {
		return (this.content.offsetWidth > this.contentContainer.offsetWidth);
	},

	hasVerticalScrollbar: function() {
		return (this.content.offsetHeight > this.contentContainer.offsetHeight) && this.contentContainer.style.overflowY != "hidden";
	},

	addHeaderFillView: function() {
		if(this.headerContainer && !this.headerFillView) {
			this.headerContainer.style.right = PWUtils.scrollbarWidth()+"px";		
			this.headerFillView = $(window.document.createElement("div"));
			this.headerFillView.className = "headerFillView";
			this.headerFillView.style.position = "absolute";
			this.headerFillView.style.top = "0px";
			this.headerFillView.style.right = "0px";
			this.headerFillView.style.height = this.headerContainer.offsetHeight+"px";
			this.headerFillView.style.width = PWUtils.scrollbarWidth()+"px";			
			if(!this.showPrintView)
				PWUtils.drawHeaderGradient(this.headerFillView,  this.environment.images.grayGradient);			
			this.outline.appendChild(this.headerFillView);
		}
	},

	removeHeaderFillView: function() {
		if(this.headerFillView)	{
			this.outline.removeChild(this.headerFillView);
			this.headerFillView = null;
			this.headerContainer.style.right = "0px";	
		}
	},

	containerSizeChanged: function() {
		if(this.blockRefresh)
			return;
		if(this.contentContainer.style.overflowY == "auto" && this.content.offsetHeight > (this.contentContainer.offsetHeight - PWUtils.scrollbarWidth()))
			this.addHeaderFillView();
		else
			this.removeHeaderFillView();	
		this.content.style.width = Math.max(this.tableWidth(), this.contentContainer.offsetWidth) + "px";
		this.refreshGradientContainer();
		this.visibleWidth = this.contentContainer.parentNode.offsetWidth;
	},

	toggleCollapse: function(event) {
		var event = event || window.event;
		var button = event.srcElement ? event.srcElement : event.target;
		this.inCollapseAction = true;
		var object = button.object;		
		var isCollapsed = object.valueForKey(this.controller.isCollapsedKey);
		var expand = true;
		if(isCollapsed && this.delegate && this.delegate.outlineShouldExpandObject)
			expand = this.delegate.outlineShouldExpandObject(object);
			
		if(expand) {
			var selectedRows = this.selectedRows();
			object.setValueForKey(!isCollapsed, this.controller.isCollapsedKey);	
			this.controller.flatObjects = null;
			this.updateTableBody();
			if(!isCollapsed)	// rows that are selected and are not visible after this operation will be deselected
				this.selectRows(this.selectedRows()); // selectedRows returns the visible selected rows only!
		}
		
		Event.stop(event);
		this.inCollapseAction = false;
	},
	
	rowsByExpandingSelectionToRow: function(row) {
		var rows = this.selectedRows();
		if(rows.indexOf(row)==-1) {
			var lastRow = rows.last();
			if(lastRow)	{
				var startRowIndex = lastRow.rowIndex; 
				var endRowIndex = row.rowIndex;
				if(startRowIndex > endRowIndex)	{
					endRowIndex = lastRow.rowIndex;
					startRowIndex = row.rowIndex;
				}
				while(++startRowIndex < endRowIndex)
					rows.push(this.rowAtIndex(startRowIndex));
				rows.push(row);
			}
		}
		return rows;
	},	
				
	mouseMove: function(event){
		var event = event || window.event;
		this.clientX = event.clientX;
		this.clientY = event.clientY;
	},
	
	parentWithObjectProperty: function(element) {
		if(element.object)
			return element;
		var parent = null;
			while(element && !element.object)
				element = element.parentNode;
		return parent;
	}, 

	rowFromEvent: function(event){
		var row = null;
		var event = event || window.event;
		var target = event.srcElement ? event.srcElement : event.target;
		if(target.tagName != "INPUT"){
			while(target && (!target.object || target.tagName != "DIV"))
				target = target.parentNode;
			row = target;
		}
		return row;
	},
	
	handleClickInRow: function(event, row) {	// The additional row parameter is needed if a click in the gantt happens which is delegated to this method.
		if(this.showPrintView)
			return;
		if(row && !row.object)
			row = this.parentWithObjectProperty(row);
		row = row || this.rowFromEvent(event);
		if(!row)
			return;	// this click is not for us
		var rows = this.selectedRows();
		var selectedRow = rows && rows.length ? rows[0] : null;
		if(this.editedColumns && ((this.columnFromEvent(event) != this.editedColumns[0]) || (row != selectedRow))){
			this.endEditing();
			row = this.selectedRows()[0];
		}
		if(row && row.object){
			if(this.delegate && this.delegate.outlineViewShouldHandleClickInRow && !this.delegate.outlineViewShouldHandleClickInRow(this, row))
				return;		
			if(event.altKey || event.metaKey){
				if(rows.indexOf(row)!=-1) {
					rows = rows.without(row);
				}else {
					rows.push(row);
				}
			}else if(event.shiftKey && !this.singleSelection)
				rows = this.rowsByExpandingSelectionToRow(row);
			else
				rows = [row];
			this.selectRows(rows);
		}		
	},

	expandSelectionToRow: function(row){
		this.selectRows(this.rowsByExpandingSelectionToRow(row));
	},

	handleDoubleClickInRow: function(event, row){
		var event = event || window.event;
		var target = event.srcElement ? event.srcElement : event.target;
		if(!row || !row.object){
			while(!target.object)
				target = target.parentNode;
			row = target;
		}
		var column = this.columnFromEvent(event);
		if(column && row && !column.editOnSingleClick)
			this.startEditingInRowAtColumn(row, column);		
		Event.stop(event);
	},

	rows: function() {
		return this._rows;
	},

	rowIsVisible: function(row, expansionPixels) {
		var top = row.cachedOffsetTop;
		if(!expansionPixels)
			return (top >= this.visibleTop && top <= this.visibleBottom);
		else
			return (top >= this.visibleTop-expansionPixels && top <= this.visibleBottom+expansionPixels);
	},
	
	visibleRows: function()	{
		var result = [];
		var visibleTop = this.visibleTop;
		var visibleBottom = this.visibleBottom;
		for(var i=0; i<this._rows.length; i++){
			var row = this._rows[i];
			if(row){
				var top = row.offsetTop;
				var bottom = top+row.offsetTop;
				if(!((top<visibleTop && bottom<visibleTop)&&(top>visibleBottom && bottom>visibleBottom))){
					result.push(row);
				}
			}
		}
//		var block;
//		for(var i=0; i<this.rowBlocks.length; i++) {
//			block = this.rowBlocks[i];
//			if( block.rows && block.rows.length && ((block.top >= this.visibleTop && block.top < this.visibleBottom) || 
//				(block.bottom >= this.visibleTop && block.bottom < this.visibleBottom))) {
//				for(var k=0; k<block.rows.length; k++)
//					result.push(block.rows[k]);
//			}			
//		}
		return result;
	},
	
	rowAtIndex: function(index) {
		return index>=0 && index<this._rows.length ? this._rows[index] : null;
	},
	
	isSingleRowSelected: function(row) {
		var selection = this.selectedRows();
		return selection.length==1 && selection[0]==row;
	},
	
	selectRows: function(rowsToSelect)	{
		var allRows = this._rows;
		for(var i=0; i<allRows.length; i++){
			var row = allRows[i];
			if(row && rowsToSelect.indexOf(row) == -1){
				row.className = row.originalClassName;
				row.style.backgroundColor = row.originalBackgroundColor;
				row.style.color = row.originalColor;
				row.childElements().each(function(cell){
					if(cell.originalColor)
						cell.style.color = cell.originalColor;
				});
			}
		}
		var objects = [];
		for(var i=0; i<rowsToSelect.length; i++){
			var row = rowsToSelect[i];
			objects.push(row.object);
			row.className = "selected";
			row.style.backgroundColor = "#3d80df";
			row.style.color = "#ffffff";
			row.childElements().each(function(cell){
				if(cell.originalColor && !cell.keepOriginalColorInSelection)
					cell.style.color = "#ffffff";
			});
		}
		this.controller.setSelectedObjects(objects);
		if(this.delegate && this.delegate.outlineDidChangeSelection)
			this.delegate.outlineDidChangeSelection(this);
	},
	
	selectedRows: function() {
		var selectedRows = [];
		var selectedObjects = this.controller.selectedObjects;
		var flatObjects = this.controller.getFlatObjects();
		for(var i=0; i<selectedObjects.length; i++)	{
			var rowIndex = flatObjects.indexOf(selectedObjects[i]);
			if(rowIndex!=-1)
				selectedRows.push(this.rowAtIndex(rowIndex));
		}
		return selectedRows;
	},
		
	scrollToRow: function(row, scrollUp) {
		var top = row.cachedOffsetTop;
		if(!scrollUp)
			top -= this.visibleBottom-this.visibleTop-parseInt(row.style.height); 
		this.contentContainer.scrollTop = top;	
		if(this.dependendView)
			this.dependendView.setScrollTop(this.contentContainer.scrollTop);
	},

	blockForRowAtIndex: function(index)	{
		return this.rowBlocks[Math.floor(index / this.blockSize)];
	},
	
	selectNextRow: function(expand, wrap) {
		var flatObjects = this.controller.getFlatObjects();
		var selectedRows = this.selectedRows();
		var selectedRow;
		if(selectedRows.length == 0){
			var block = this.blockForRowAtIndex(0);
			if(block && !block.visible)
				this.drawBlock(block);
			selectedRow = this.rowAtIndex(0);
		}else{
			var oldIndex = selectedRows[selectedRows.length-1].rowIndex;
			var newIndex = oldIndex + 1;
			if(newIndex > flatObjects.length-1)
				newIndex = wrap ? 0 : flatObjects.length-1;				
			if(newIndex == oldIndex)
				return;
			var block = this.blockForRowAtIndex(newIndex);
			if(block && !block.visible)
				this.drawBlock(block);
			selectedRow = this.rowAtIndex(newIndex);
			if(!selectedRow){
				this.drawRowAtIndex(newIndex);	
				selectedRow = this.rowAtIndex(newIndex);
			}	
		}
		if(selectedRow) {
			if(!this.rowIsVisible(selectedRow, -parseInt(selectedRow.style.height)))
				this.scrollToRow(selectedRow, false);
			if(expand)
				this.expandSelectionToRow(selectedRow);
			else
				this.selectRows([selectedRow]);
			return true;
		}
		return false;
	},

	selectPreviousRow: function(expand)	{
		var flatObjects = this.controller.getFlatObjects();
		var selectedRows = this.selectedRows();
		var selectedRow;
		if(selectedRows.length == 0) {
			var block = this.blockForRowAtIndex(flatObjects.length-1);
			if(block && !block.visible)
				this.drawBlock(block);
			selectedRow = this.rowAtIndex(flatObjects.length-1);
		}else{
			var oldIndex = selectedRows[0].rowIndex;
			var newIndex = oldIndex - 1;
			var block = this.blockForRowAtIndex(newIndex);
			if(block && !block.visible)
				this.drawBlock(block);
			if(newIndex < 0)
				newIndex = 0;
			if(newIndex == oldIndex)
				return;
			selectedRow = this.rowAtIndex(newIndex);
		}
		if(!this.rowIsVisible(selectedRow, -parseInt(selectedRow.style.height)))
			this.scrollToRow(selectedRow, true);		
		if(expand)
			this.expandSelectionToRow(selectedRow);
		else
			this.selectRows([selectedRow]);
	},
		
	setRowsCollapsed: function(rows, collapsed) {
		var object;
		var update = false;
		for(var i=0; i<rows.length; i++) {
			object = rows[i].object;
			var children = object.valueForKey(this.controller.childrenKey);			
			if(children && children.length)	{
				var state = object.valueForKey(this.controller.isCollapsedKey);
				if(state != collapsed) {
					object.setValueForKey(!state, this.controller.isCollapsedKey);
					update = true;
				}
			}
		}
		if(update) {
			this.controller.flatObjects = null;
			this.updateTableBody();		
			this.selectRows(this.selectedRows());
		}			
	},	
		
	setSelectedRowsCollapsed: function(collapsed) {
		this.setRowsCollapsed(this.selectedRows(), collapsed);
	},
				
	replaceRowWithRow: function(oldRow, newRow) {
		if(oldRow.parentNode){
			newRow.style.color = oldRow.style.color;
			this.removeEventListenersFromRow(oldRow);
			oldRow.parentNode.replaceChild(newRow, oldRow);
			var index = this._rows.indexOf(oldRow);
			if(index != -1)
				this._rows[index] = newRow;
		}
	},

	setBlockRefresh: function(flag)	{
		this.blockRefresh = flag;
	},

	refresh: function()	{
		if(!this.headerContainer)
			this.createTables();
		this.updateTableHead();
		this.updateTableBody();	
		this.containerSizeChanged();
	},

	// ************************************************************************************************************
	// *****
	// *****										table column dragging and sorting
	// *****

	handleColumnHeaderClick: function(event) {
		this.clickStartX = event.clientX;
		var headCell = Event.element(event);
		while(headCell.className != "headerCell")
			headCell = headCell.parentNode;
		var descs 		= this.controller.sortDescriptors;
		var comp  		= headCell.column.doSortDescriptorsEqualPrototype(descs);
		this.controller.setSortDescriptors(comp == 1? headCell.column.reversedPrototypeSortDescriptors() : headCell.column.prototypeSortDescriptors);
		this.updateTableHead();
		this.updateTableBody();
	},

	autoscrollX: function()	{
		this.headerContainer.scrollLeft += this.autoscrollDelta;
		this.contentContainer.scrollLeft = this.headerContainer.scrollLeft;		
		this.updateDraggedColumnHeader();
		this.updateColumnSortMarkerPosition(this.lastClientX-this.autoscrollDelta);
	},

	startAutoscrollX: function(delta) {
		this.stopAutoscrollX();
		this.autoscrollDelta = Math.floor(delta/3);
		var me = this;
		this.autoscrollXTimer = window.setInterval(function(){me.autoscrollX();}, 0);
	},

	stopAutoscrollX: function()	{
		if(this.autoscrollXTimer){
			window.clearInterval(this.autoscrollXTimer);
			this.autoscrollXTimer = null;
		}
	},

	updateColumnSortMarkerPosition: function(mouseX) {
		var newX;
		var count = this.headerCells.length;
		for(var i=0; i<count; i++){
			var column = this.headerCells[i];
			var colLeft = column.offsetLeft;
			var colRight = colLeft + parseInt(column.style.width);
			var colCenter = (colLeft+colRight)/2;
			if(mouseX>=colLeft && mouseX<=colCenter){
				newX = colLeft;
				this.newColumnIndex = i;
				break;
			}
			else if(mouseX>colCenter && mouseX<=colRight){
				if(i==count-1)
					newX = colRight;
				else
					newX = this.headerCells[i+1].offsetLeft;
				this.newColumnIndex = i+1;
				break;
			}
		}
		if(!isNaN(newX)){
			this.columnSortMarker.style.left = newX+"px";
		}
	},

	updateDraggedColumnHeader: function() {
		var newLeft = this.lastClientX - this.deltaX;
		var minX = this.headerCells[0].offsetLeft;
		var lastColumn = this.headerCells[this.headerCells.length-1];
		var maxX = lastColumn.offsetLeft + parseInt(lastColumn.style.width) - this.draggedWith;
		if(newLeft < minX)
			newLeft = minX;
		if(newLeft > maxX)
			newLeft = maxX;
		var oldLeft = this.dragableTableHeader.offsetLeft;
		if(oldLeft != newLeft){
			this.dragableTableHeader.style.left = newLeft + "px";
			return true;
		}
		return false;
	},

	handleColumnHeaderDrag: function(event)	{
		if(this.isResizeDrag){
			var newX = PWUtils.getLocalX(event.clientX, this.resizeTarget);		
			var diffX = newX - this.deltaX;
			var newWidth = this.resizeTargetOldWidth+diffX;
			var	minLimitReached = false;
			if(newWidth < this.minColumnWidth){
				minLimitReached = true;
				newWidth = this.minColumnWidth;
			}	
			var realDiff = newWidth-this.resizeTargetOldWidth;
			var tableWidth = this.tableWidthForResize+realDiff;
			this.resizeTarget.style.width = newWidth-this.padding + "px";
			var w = newWidth;
			var oldWidth = this.resizeTarget.column.width;
			this.resizeTarget.column.width = w;
			var cell;
			var oldLeft;
			for(var i=this.resizeTargetIndex+1;  i<this.headerCells.length; i++){
				cell = this.headerCells[i];
				oldLeft = cell.offsetLeft;
				var left = (oldLeft + (w-oldWidth)) + "px";
				cell.style.left = left;
			}
		}else{
			this.lastClientX = PWUtils.getLocalX(event.clientX, this.header);
			var newLeft = this.lastClientX - this.deltaX;
			this.updateDraggedColumnHeader();
			this.updateColumnSortMarkerPosition(this.lastClientX);
			// Scroll if appropriate:
			var diffL = newLeft - this.headerContainer.scrollLeft;
			var diffR = (this.headerContainer.scrollLeft+this.outline.offsetWidth) - (newLeft+this.draggedWith);
			var stop = true;
			if(diffL < 0){	// nach links scrollen
				if(this.contentContainer.scrollLeft != 0){
					this.startAutoscrollX(diffL);
					stop = false;
				}
			}
			else if(diffR < 0){ // nach rechts scrollen
				var maxScrollLeft = (this.content.offsetWidth-this.contentContainer.offsetWidth);
				if(maxScrollLeft > 0 && this.contentContainer.scrollLeft <= maxScrollLeft){
					this.startAutoscrollX(-diffR);
					stop = false;
				}
			}
			if(stop)
				this.stopAutoscrollX();
		}
		Event.stop(event);
	},


	handleStartColumnHeaderDrag: function(event, startX, startY) {
		var target = Event.element(event);
		while(!target.outline)	// Die passende Cell hat eine Column
			target = target.parentNode;
		startX += this.headerContainer.scrollLeft-PWUtils.getX(this.headerContainer);
		this.deltaX = startX - target.offsetLeft;	
		var isInLeftResizingArea = this.deltaX < this.resizeAreaWidth;
		var isInRightResizingArea = this.deltaX > target.offsetWidth-this.resizeAreaWidth;
		if((isInLeftResizingArea && target.colIndex != 0) || isInRightResizingArea){
			this.isResizeDrag = true;
			if(isInLeftResizingArea){
				this.resizeTargetIndex = target.colIndex-1;
				this.resizeTarget = this.headerCells[this.resizeTargetIndex];
				this.deltaX = this.resizeTarget.offsetWidth+this.deltaX;			
			}else{
				this.resizeTargetIndex = target.colIndex;
				this.resizeTarget = target;
			}
			this.resizeTargetOldWidth = this.resizeTarget.offsetWidth; 
			this.tableWidthForResize = parseInt(this.header.style.width);
		}else{
			this.isResizeDrag = false;
			this.oldColumnIndex = this.tableColumns.indexOf(target.column);
			Position.clone(target, this.dragableTableHeader);
			this.dragableTableHeader.style.width = target.offsetWidth - 5 + "px";
			this.dragableTableHeader.style.top = "0px";
			this.dragableTableHeader.style.height = this.headerHeight+"px";
			this.draggedWith = this.dragableTableHeader.offsetWidth;
			this.dragableTableHeader.style.visibility = "visible";
			this.columnSortMarker.style.visibility = "visible";
			if(this.content.currentStyle)
				this.columnSortMarker.style.height = this.content.offsetHeight + "px";
			else
				this.columnSortMarker.style.height = this.content.style.height;
			this.updateColumnSortMarkerPosition(startX);
			this.dragableTableHeader.innerHTML = target.innerHTML;
			if(target.gradient)
				PWUtils.childWithClassInNode("gradient", this.dragableTableHeader).style.left = "0px";
			else
				PWUtils.drawHeaderGradient(this.dragableTableHeader,  this.environment.images.grayGradient);
			PWUtils.drawLeftAndRightLine(this.dragableTableHeader,"#bbbbbb", "#bbbbbb");
			this.dragableTableHeader.style.textAlign = target.column.headerAlign;			
		}
		Event.stop(event);
	},

	handleEndColumnHeaderDrag: function(event) {
		if(this.isResizeDrag){
			this.updateTableHead();
			this.updateTableBody(true);
			this.containerSizeChanged();
		}else{
			this.stopAutoscrollX();
			this.dragableTableHeader.style.visibility = "hidden";
			this.columnSortMarker.style.visibility = "hidden";
			if(this.oldColumnIndex != this.newColumnIndex && this.oldColumnIndex+1 != this.newColumnIndex){
				var column = this.tableColumns[this.oldColumnIndex];
				this.tableColumns.splice(this.oldColumnIndex, 1);
				if(this.newColumnIndex > this.oldColumnIndex)
					this.newColumnIndex--;
				this.tableColumns.splice(this.newColumnIndex, 0, column);
				this.updateTableHead();
				this.updateTableBody(true);
			}
		}
		Event.stop(event);
	},

	handleMouseMoveInTableHead: function(event) {
		if(this.isEditing())
			return;
		var cell = Event.element(event);			
		var x =  PWUtils.getLocalX(event.clientX, cell);		
		var width = cell.offsetWidth;
		var isInLeftResizingArea = x<this.resizeAreaWidth;
		var isInRightResizingArea = x>(width-this.resizeAreaWidth);
		if(isInLeftResizingArea || isInRightResizingArea){
			if(!(cell.colIndex == 0 && isInLeftResizingArea))
				cell.style.cursor = "col-resize";
		}
		else
			cell.style.cursor = "default";
	},

	clickedInColumnHead: function(event) {
		if(this.isEditing())
			return;
		var me = this;
		PWUtils.dispatchMouseDownEvent(event, me, this.handleColumnHeaderClick, this.handleColumnHeaderDrag, this.handleStartColumnHeaderDrag, this.handleEndColumnHeaderDrag);
		Event.stop(event);
	},
	
	// ************************************************************************************************************
	// *****
	// *****										Editing
	// *****
	
	columnFromHorizontalPosition: function(x){
		var start = 0;
		for(var i=0; i<this.tableColumns.length; i++){
			var column = this.tableColumns[i];
			var end = start+column.width;
			if(x>=start && x<end)
				return column;
			start = end;
		}
		return null;
	},

	columnFromEvent: function(event){
		return this.columnFromHorizontalPosition(PWUtils.getLocalX(event.clientX, this.content));
	},


	// 1
	startEditingInRowAtColumn: function(row, column){
		if(column.isEditable() && (!this.delegate || !this.delegate.outlineShouldEditObjectProperty || this.delegate.outlineShouldEditObjectProperty(this, row.object, column.key))){
			this.editColumnInRow(column, row);
			return true;
		}
		return false;
	},

	// 2
	editColumnInRow: function(column, row){
		if(!this.editedColumns || !this.isSingleRowSelected(row)){	
			PWUtils.setSelectionEnabled(this.contentContainer, true);
			this.selectRows([row]);
//			this.scrollToRow(row, true);
			this.editedColumns = [column];
			var newRow = this.drawRowAtIndex(row.rowIndex);
			this.replaceRowWithRow(row, newRow);
			PWUtils.notificationCenter.addObserverForMessage(this, "datePickerDidClose", "datePickerDidClose");
		}
	},
	
	// 3
	endEditing: function()
	{
		if(this.editedColumns){
			var selectedRows = this.selectedRows();
			if(selectedRows.length==1){
				this.editedRow = selectedRows[0];
				var infos = this.editedValuesInRow(this.editedRow);
				var key;
				var info;
				var editedKey = this.editedColumns[0].keyForEditing();
				for(key in infos){	
					if(key == editedKey) {
						info = infos[key];
						break;
					}
				}
				if(this.delegate && this.delegate.outlineValidateValueForKeyOfObject)
					this.delegate.outlineValidateValueForKeyOfObject(this, info.objectValue, info.stringValue, key, this.editedRow.object, this.delegateDidValidateProperty);
				else {
					var validationInfo = this.editedRow.object.validateValueForKey(info.objectValue, key);
					this.delegateDidValidateProperty(validationInfo);
				}
			}
			this.editedColumns = null;
		}
	},
	
	// 4
	delegateDidValidateProperty: function(validationInfo)
	{		
		if(validationInfo.validated){
			this.editedRow.object.setValueForKey(validationInfo.value, validationInfo.key);
			this.editedRow.object.context.synchronize();
			PWUtils.setSelectionEnabled(this.contentContainer, false);
			this.editedColumns = null;
			var row = this.drawRowAtIndex(this.editedRow.rowIndex);
			this.replaceRowWithRow(this.editedRow, row);
			this.editedRow = null;
			this.refresh();
			if(this.delegate){
				if(this.delegate.outlineDidChangeSelection)
					this.delegate.outlineDidChangeSelection(this);
				if(this.delegate.outlineDidFinishEditing)
					this.delegate.outlineDidFinishEditing(this);
			}
			PWUtils.notificationCenter.removeObserverForMessage(this, "datePickerDidClose");
		}else {
			if(this.delegate && this.delegate.outlineEditedValueDidNotValidate)
				this.delegate.outlineEditedValueDidNotValidate(this, validationInfo, this.editedRow.object);
			else {
				var me = this;
				buttons = validationInfo.localizedRecoveryOptions;
				if(!buttons)
					buttons = [this.environment.localizedString('OK')];
				if(validationInfo.NSLocalizedDescriptionKey)
					runAlert(	validationInfo.NSLocalizedDescriptionKey, 
								validationInfo.NSLocalizedRecoverySuggestionErrorKey, 
								this.environment.images.MerlinWarning, 
								function(button){me.didEndValidationAlert(button, validationInfo)}, 
								{buttons:buttons});
			}
		}
	},

	didEndValidationAlert: function(button, validationInfo) {
		if(validationInfo.localizedRecoveryOptions)
			this.editedRow.object.recoverFromValidationError(button, validationInfo);
	},

	editNextProperty: function(){
		if(this.editedColumns){
			var columnIndex = this.tableColumns.indexOf(this.editedColumns[0]);
			columnIndex += (columnIndex > this.tableColumns.length-1) ? 0 : 1;
			var column = null;
			var endRowIndex = this.selectedRows()[0].rowIndex-1;
			if(endRowIndex < 0)	// if no column can be found try to search through the whole project till the previous row is reached
				endRowIndex = this.controller.getFlatObjects().length-1;
			do{
				var row = this.selectedRows()[0];
				column = this.searchEditableColumnInRowBeginningWithColumnAtIndex(row, columnIndex);
				if(!column){
					this.endEditing();
					this.selectNextRow(false, true);
					columnIndex = 0;				
				}
			}while(!column && row.rowIndex != endRowIndex);
			if(column){
				this.endEditing();
				row = this._rows[row.rowIndex];	// fetch the row again because in endEditing the original row has been replaced
				this.startEditingInRowAtColumn(row, column);				
			}else{
				//console.log("no column");
			}
		}
	},
		
	editSelectedRow: function(){
		if(this.editedColumns){
			this.endEditing();
			return;
		}
		var selectedRows = this.selectedRows();
		if(selectedRows.length) {
			this.editObject(selectedRows[0].object);
		}
	},
	
	editRow: function(row) 
	{
		if(!this.editedColumns || !this.isSingleRowSelected(row)){
			var column = this.firstEditableColumnInRow(row);
			if(column)
				this.editColumnInRow(column, row);
		}
	},
	
	firstEditableColumnInRow: function(row){
		return this.searchEditableColumnInRowBeginningWithColumnAtIndex(row, 0);
	},
	
	searchEditableColumnInRowBeginningWithColumnAtIndex: function(row, index){
		var object = row.object;
		for(var i=index; i<this.tableColumns.length; i++){
			var column = this.tableColumns[i];
			if(column.isEditableWithKeyboard){ 
				if(!this.delegate || !this.delegate.outlineShouldEditObjectProperty || this.delegate.outlineShouldEditObjectProperty(this, object, column.key)){
					return column;
				}
			}
		}
		return null;	
	},
	
	isEditing: function(){
		return this.editedColumns;
	},

	datePickerDidClose: function(msg, context){
		this.endEditing();
	},
	
	editObject: function(object) {
		var flatObjects = this.controller.getFlatObjects();
		for(var i=0; i<flatObjects.length; i++){
			if(flatObjects[i] == object){
				this.editRow(this.rowAtIndex(i));
				break;
			}
		}	
	},	
	
	columnForInput: function(input) {
		var column = null;

		var node = input;
		do{
			if(node.column){
				column = node.column;
				break;
			}
		}while(node = node.parentNode);
		return column;
	},
		
	editedValuesInRow: function(row) {
		var values = {};
		var inputs = $A(row.getElementsByTagName("INPUT"));
		var selections = $A(row.getElementsByTagName("SELECT"));
		var customInputFields = Element.select(row, ".customInputField");
		inputs = inputs.concat(selections);
		inputs = inputs.concat(customInputFields);
		for(var i=0; i<inputs.length; i++){
			var input = inputs[i];
			if(!input.disabled){
				var info = {};
				if(input.type && input.type == "checkbox")
					info.stringValue = input.checked ? "1" : "0";
				else
					info.stringValue = input.value;
				var column = this.columnForInput(input);
				info.objectValue = info.stringValue;
				if(column.formatter()) {
					info.objectValue = column.formatter().objectValueForString(info.stringValue);
				}
				values[input.name] = info;					
			}
		}
		return values;
	},
	
	// ************************************************************************************************************
	// *****
	// *****										Drag and Drop
	// *****
		
	mouseDownInRow: function(event) {
		var me = this;
		if(this.enableDrags)
			PWUtils.dispatchMouseDownEvent(event, me, this.handleClickInRow, this.rowDrag, this.startRowDrag, this.endRowDrag, true);
		else
			this.handleClickInRow(event);
		if(!this.isEditing())
			Event.stop(event);
	},
	
	hideImagesInNode: function(node){
		if(node.tagName == 'IMG'){
			node.style.opacity = 0.0;
			node.style.filter = 'alpha(opacity=0)';
		}else{
			for(var i=0; i<node.childNodes.length; i++){ 
				this.hideImagesInNode(node.childNodes[i]);
			}
		}
	},

	dragRepresenationFromRow: function(row){
		var outlineColumnIndex = -1;
		var childs = $A(row.childNodes);
		for(var i=0; i<childs.length; i++){						// Test if an outline column exists
			var child = childs[i];
			if(child.column.isOutlineColumn()){
				outlineColumnIndex = i;
				break;
			}
		};
		var clone = row.cloneNode(row);		
		childs = $A(clone.childNodes);
		if(outlineColumnIndex > -1) {							// If there is an outline column, remove other columns
			for(var i=0; i<childs.length; i++){
				var child = childs[i];
				if(i != outlineColumnIndex){
					clone.removeChild(child);
				}else											// Don't display images
					this.hideImagesInNode(clone);
			};
		}
		return clone;
	},

	startRowDrag: function(event, x, y) {
		if(this.isEditing())
			return;
		row = row || this.rowFromEvent(event);
		if(row && row.object){
			var rows = this.selectedRows();
			if(rows.indexOf(row) == -1)
				rows = [row];			
			if(!this.delegate || !this.delegate.outlineShouldDragRows || this.delegate.outlineShouldDragRows(this, rows)){
				this.dragContainer = DIV( {'class':'dragContainer'} );			
				var top, bottom, width, height;
				var topRow;
				for(var i=0; i<rows.length; i++){
					var row = rows[i];
					var rowTop = parseInt(row.style.top);
					var rowBottom = parseInt(row.style.height)+rowTop;
					if(width == undefined || row.offsetWidth > width)
						width = row.offsetWidth;
					if(top == undefined || rowTop < top){
						top = rowTop;
						topRow = row;
					}
					if(bottom == undefined || rowBottom > bottom)
						bottom = rowBottom;						
				}
				height = bottom-top;
				this.dragContainer.style.width = width+'px';
				this.dragContainer.style.height = height+'px';
				origRows = [];
				for(var i=0; i<rows.length; i++){
					var row = rows[i];
					origRows.push(row);
					var clone = this.dragRepresenationFromRow(row);
					var origTop = parseInt(row.style.top);
					clone.style.top = (rows.length == 1 ? 0 : (origTop-top)) + 'px';
					clone.style.className = row.originalClassName;
					clone.style.backgroundColor = "transparent";
					clone.style.color = row.originalColor;
					this.dragContainer.appendChild(clone);
				}
				this.dragContainer.origX = PWUtils.getX(topRow);
				this.dragContainer.origY = PWUtils.getY(topRow);
				this.dragContainer.style.left = (this.dragContainer.origX+1) + 'px';	
				this.dragContainer.style.top = (this.dragContainer.origY+1) + 'px';
				this.dragContainer.origMouseX = x; //event.clientX;
				this.dragContainer.origMouseY = y; //event.clientY;
				window.document.getElementsByTagName("body").item(0).appendChild(this.dragContainer);
				if(!this.delegate || !this.delegate.pasteboardContentFromRows)
					PWUtils.dragDropPasteboard = [{type:'outlineRows', data:origRows}];
				else
					PWUtils.dragDropPasteboard = this.delegate.pasteboardContentFromRows(this, origRows);
			}
		}
	},
			
	rowDrag: function(event) {
		if(this.dragContainer){
			this.dragContainer.style.left = (this.dragContainer.origX+1-(this.dragContainer.origMouseX-event.clientX)) + 'px';	// Todo: evaluate why the offset of one is neccesarry. 
			this.dragContainer.style.top = (this.dragContainer.origY+1-(this.dragContainer.origMouseY-event.clientY)) + 'px';	// Maybe the PWUtils.getX/Y() methods gives wrong values (it is browser dependent).
			PWUtils.notifyDropObserversOnMouseMove(event);
		}
	},

	endRowDrag: function(event) {
		if(this.dragContainer){
			PWUtils.notifyDropObserversOnMouseUp(event);
			window.document.getElementsByTagName("body").item(0).removeChild(this.dragContainer);
			this.dragContainer = null;
			PWUtils.dragDropPasteboard = [];
			this.stopAutoscrollY();
		}
	},

	setEnableDrops: function(enable){
		if(enable)
			PWUtils.addDropObserver(this);
		else
			PWUtils.removeDropObserver(this);
	},
		
	dragLocationFromGlobalMousePosition: function(pos){
		var sensitiveDistance = 4;
		var location = {};
		var isInOutline = Position.within(this.contentContainer, pos.x, pos.y);
		if(!isInOutline)
			return {row:OutlineView.MOUSE_IS_NOT_IN_OUTLINE};	
		var visibleRows = this.visibleRows();
		var row = null;
		for(var i=0; i<visibleRows.length; i++){
			var arow = visibleRows[i];
			var rowTop = PWUtils.getY(arow);
			var rowBottom = rowTop + parseInt(arow.style.height);
			if(pos.y>=rowTop && pos.y<=rowBottom){
				if(pos.y<=rowTop+sensitiveDistance)
					location.area = "top";
				else if(pos.y>=rowBottom-sensitiveDistance)
					location.area = "bottom";
				else
					location.area = "middle";
				row = arow;
				location.top = parseInt(row.style.top);
				location.bottom = location.top + parseInt(row.style.height);
				break;
			}
		}
		location.row = row ? row : OutlineView.MOUSE_IS_NOT_IN_ROW;	
		return location;
	},
	
	validateDrop: function(pos, pasteboard){
		if(this.delegate && this.delegate.outlineValidateDrop){
			var location = this.dragLocationFromGlobalMousePosition(pos);
			if(location.row != OutlineView.MOUSE_IS_NOT_IN_OUTLINE){ 	// autoscrolling
				this.autoscrollSensitivityDistance = 35;
				var top = this.contentContainer.cumulativeOffset().top;
				var bottom = top+this.contentContainer.getHeight();
				var delta;
				if(bottom-pos.y < this.autoscrollSensitivityDistance){
					delta = this.autoscrollSensitivityDistance - (bottom - pos.y);
					this.startAutoscrollY(delta, pos);
				}else if(pos.y-top < this.autoscrollSensitivityDistance){
					delta = this.autoscrollSensitivityDistance - (pos.y - top);
					this.startAutoscrollY(-delta, pos);
				}else
					this.stopAutoscrollY();
			}
			var result = this.delegate.outlineValidateDrop(this, location, pasteboard); 
			if(result.accept)
				this.highlightLocation(location, result.area);
			else
				this.clearHighlightedRow();
			return result.accept;
		}
		return false;
	},

	acceptDrop: function(pos, pasteboard){
		if(this.delegate && this.delegate.outlineAcceptDrop){
			var location = this.dragLocationFromGlobalMousePosition(pos);
			this.clearHighlightedRow();
			this.delegate.outlineAcceptDrop(this, location, pasteboard);
		}
	},
	
	clearHighlightedRow:function(){
		if(this.contentContainer.marker){
			this.contentContainer.removeChild(this.contentContainer.marker);
			delete this.contentContainer.marker;
			this.contentContainer.marker = null;
			this.highlightedRow = null;
		}
		if(this.insertionMarker){
			this.contentContainer.removeChild(this.insertionMarker);
			delete this.insertionMarker;
			this.insertionMarker = null;
		}
		if(this.highlightedRow && this.highlightedRow.marker){
			if($A(this.highlightedRow.childNodes).indexOf(this.highlightedRow.marker) != -1)
				this.highlightedRow.removeChild(this.highlightedRow.marker);
			for(var key in this.highlightedRow.beforeHighlightStyle){
				this.highlightedRow.style[key] = this.highlightedRow.beforeHighlightStyle[key];
			}
			this.highlightedRow.marker = null;
			this.highlightedRow = null;
		}
	},
	
	highlightLocation: function(location, area){
		area = area || location.area;
		if(area == 'middle')
			this.highlightRow(location.row);
		else {
			this.clearHighlightedRow();
			this.insertionMarker = DIV({'class':'highlightedRowInsertionMarker'});
			var y = area == 'top' ? location.top : location.bottom;
			this.insertionMarker.style.top = y + "px";
			this.insertionMarker.style.width = PWUtils.effectiveStyle(location.row).width;
			this.contentContainer.appendChild(this.insertionMarker);
		}
	},
	
	highlightRow: function(row){
		if(this.highlightedRow != row){
			this.clearHighlightedRow();
			this.highlightedRow = row;
			if(row != OutlineView.MOUSE_IS_NOT_IN_OUTLINE){
				var marker = $(DIV({'class':'highlightedRowMarker'}));
				if(row == OutlineView.MOUSE_IS_NOT_IN_ROW){
					if(this.content.offsetHeight < this.contentContainer.offsetHeight){
						this.contentContainer.marker = marker;
						this.contentContainer.appendChild(marker);
						if(this.contentContainer.style.overflowX != "hidden")
							marker.style.bottom = PWUtils.scrollbarWidth() + "px";
						if(this.contentContainer.style.overflowY != "hidden")
							marker.style.right = PWUtils.scrollbarWidth() + "px";
					}
				}else{
					row.appendChild(marker);
					row.marker = marker;
					marker.style.width = (this.contentContainer.parentNode.offsetWidth-5)+"px";					
					marker.style.left = this.contentContainer.scrollLeft + "px";
					row.beforeHighlightStyle = {};
					var styles = {backgroundColor:'#C6D6F2'};
					for(var key in styles){
						row.beforeHighlightStyle[key] = row.style[key];
						row.style[key] = styles[key]
					}
				}
			}
		}
	},
	
	autoscrollY: function()	{
		var oldTop = this.contentContainer.scrollTop;
		var newTop = this.contentContainer.scrollTop + this.autoscrollDelta;
		this.setScrollTop(newTop);
		if(this.dependendView)
			this.dependendView.setScrollTop(this.contentContainer.scrollTop);
		if(oldTop == this.contentContainer.scrollTop){
			this.stopAutoscrollY();
		}else
			this.clearHighlightedRow();
	},

	startAutoscrollY: function(delta, pos) {
		if(delta){
			this.mousePos = pos;
			this.autoscrollDelta = Math.floor(delta/2);
			this.stopAutoscrollY();
			var me = this;
			this.autoscrollYTimer = window.setInterval(function(){me.autoscrollY();}, 0);
		}
	},

	stopAutoscrollY: function()	{
		if(this.autoscrollYTimer){
			window.clearInterval(this.autoscrollYTimer);
			this.autoscrollYTimer = null;
		}
	}


},{
	MOUSE_IS_NOT_IN_OUTLINE: -2,
	MOUSE_IS_NOT_IN_ROW: -1
});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("OutlineController.js");

var OutlineController = Base.extend( {
    constructor: function(environment, delegate) {
        this.environment = environment;
        this.rootObjects = [];
        this.selectedObjects = [];
        this.sortFunction = null;
        this.sortDescriptors = null;
        this.flatObjects = null;
        this.childrenKey = "children";
        this.isCollapsedKey = "isCollapsed";
        this.isLeafKey = "isLeaf";
        this.objectsForID = [];
        this.preserveSelection = true;
        this.delegate = delegate;
		this.singleSelection = false;
    },
    
	setSingleSelection: function(flag) {
		this.singleSelection = flag;
	},
	
    setChildrenKey: function(key) {
        this.childrenKey = key;
        this.flatObjects = null;
        this.objectsForID = [];
    },
    
    setIsCollapsedKey: function(key) {
        this.isCollapsedKey = key;
        this.flatObjects = null;
        this.objectsForID = [];
    },
    
    setRootObjects: function(objects) {
        var ids = this.preserveSelection ? this.selectedObjectIDs(): null;        
        this.rootObjects = objects;
        this.flatObjects = null;
        this.objectsForID = [];
        if (this.preserveSelection)
            this.setSelectedObjectIDs(ids);
    },
    
    setSelectedObjects: function(objects) {
        if(this.singleSelection && objects.length > 1)
			return;
        this.selectedObjects = objects;
		if(this.singleSelection && objects && objects.length)
			this.selectedObjects = [objects[0]];
		this.selectedObjects.sort(this.sortFunction);
		if (this.delegate && this.delegate.selectionChanged)
			this.delegate.selectionChanged(this, this.selectedObjects);
    },
    
    selectedObjectIDs: function() {
        var ids = [];
        for (var i = 0; i < this.selectedObjects.length; i ++ )
            ids.push(this.selectedObjects[i].objectID.uri);
        return ids;
    },
    
    setSelectedObjectIDs: function(ids) {
		if(this.singleSelection && this.selectedObjects && this.selectedObjects.length)
			return;
        this.getFlatObjects();
        this.selectedObjects = [];
        for (var i = 0; i < ids.length; i ++ ) {
            var object = this.objectsForID[ids[i]];
            if (object) {
                this.selectedObjects.push(object);
				if(this.singleSelection)
					break;
			}
        }
        this.selectedObjects.sort(this.sortFunction);
        if (this.delegate && this.delegate.selectionChanged)
            this.delegate.selectionChanged(this, this.selectedObjects);
    },
    
    setSortDescriptors: function(descriptors) {
        this.sortDescriptors = descriptors;
        this.flatObjects = null;		
        this.sortFunction = function(a, b) {
            if (descriptors) {
                var descriptor;
                for (var i = 0; i < descriptors.length; i ++ ) {
                    descriptor = descriptors[i];
                    var val1 = a.sortValueForKey(descriptor.key);
                    var val2 = b.sortValueForKey(descriptor.key);
                    if (val1 < val2)
                        return descriptor.ascending ? -1: 1;
                    else if (val1 > val2)
                        return descriptor.ascending ? 1: -1;
                }
            }
            return 0;
        }		
        this.selectedObjects.sort(this.sortFunction);
    },
    
    objectForPersistentID: function(persistentID) {
        return this.objectsForID(persistentID);
    },
    
    getFlatObjects: function() {
        this.flatObjects = [];
        this.objectsForID = [];
        this.appendFlatObjects(this.rootObjects, 0);
		return this.flatObjects;
    },
    
	getAllObjects: function() {
		var me = this;
        allObjects = [];
		function appendObjects(objects, level) {
			if(me.sortFunction){
				try{
					objects.sort(me.sortFunction); 	
				}catch(e){}
			}
			for (var i = 0; i < objects.length; i ++ ) {
				var object = objects[i];
				object.level = level;
				allObjects.push(object);
				if (!object.valueForKey(me.isLeafKey)) {
					var children = object.valueForKey(me.childrenKey);
					if (children)
						appendObjects(children, level + 1);
				}
			}
		}
		appendObjects(this.rootObjects, 0);
        return allObjects;		
	},


    appendFlatObjects: function(objects, level) {
		if(objects){
			if(this.sortFunction){
				try{
					objects.sort(this.sortFunction); 	
				}catch(e){
					// Der IE bricht ab wenn ich der methode sort() eine Sortierfunktion übergebe (Nur im Druckfenster).
				}
			}
			for (var i = 0; i < objects.length; i ++ ) {
				var object = objects[i];
				object.level = level;
				this.flatObjects.push(object);
				this.objectsForID[object.objectID.uri] = object;
				
				if ( ! object.valueForKey(this.isCollapsedKey) && !object.valueForKey(this.isLeafKey)) {
					var children = object.valueForKey(this.childrenKey);
					if (children)
						this.appendFlatObjects(children, level + 1);
				}
			}
		}
    },
    
    
    //	Indenting and Outdenting
    //
    //
    flatIndexOfObject: function(object) {
        for (var i = 0; i < this.flatObjects.length; i ++ )
            if (this.flatObjects[i] == object)
            return i;
        return - 1;
    },
    
    levelForObjectAtFlatIndex: function(index) {
        var object = this.flatObjects[index];
        return object ? object.level: -1;
    },
    
    isObjectAtFlatIndexSelected: function(index) {
        var object = this.flatObjects[index];
        var selObj;
        for (var i = 0; i < this.selectedObjects.length; i ++ )
            if (this.selectedObjects[i] == object)
            return true;
        return false;
    },
    
    firstUnselectedObjectAboveOnSameLevel: function(item) {
        var result = null;
        var row = this.flatIndexOfObject(item);
        var level = item.level;
        while (row >= 0) {
            var iterLevel = this.levelForObjectAtFlatIndex(row);
            if (iterLevel < level)
                break;
            else if (iterLevel == level && !this.isObjectAtFlatIndexSelected(row)) {
                result = this.flatObjects[row];
                break;
            } else row -- ;
        }
        return result;
    },
    
    parentIndexForIndex: function(index) {
        var startLevel = this.levelForObjectAtFlatIndex(index);
        while ( -- index >= 0) {
            var level = this.levelForObjectAtFlatIndex(index);
            if (level < startLevel)
                return index;
        }
        return - 1;
    },
    
    objectAtIndex: function(index) {
        if (index == -1)
            return null;
        var objects = !this.flatObjects || this.flatObjects.length == 0 ? this.getFlatObjects(): this.flatObjects;
        return objects[index];
    },
    
    isParentForObjectAtIndexSelected: function(index) {
        var parentIndex = this.parentIndexForIndex(index);
        var parentItem = this.objectAtIndex(parentIndex);
        return parentIndex !=- 1 && this.selectedObjects.indexOf(parentItem) !=- 1;
    },
    
    isObjectIndentable: function(object) {
        var index = this.flatIndexOfObject(object);
        return( ! this.isParentForObjectAtIndexSelected(index) && this.firstUnselectedObjectAboveOnSameLevel(object));
    },
    
    minOutdentLevel: function() {
        if (this.delegate && this.delegate.minOutdentLevel)
            return this.delegate.minOutdentLevel();
        else return 0;
    },
    
    isObjectOutdentable: function(object) {
        var index = this.flatIndexOfObject(object);
        return ! this.isParentForObjectAtIndexSelected(index) && this.levelForObjectAtFlatIndex(index) > this.minOutdentLevel();
    },
    
    firstSelectedObject: function() {
        return this.selectedObjects && this.selectedObjects.length ? this.selectedObjects[0]: null;
    },
    
    indentationParentObjectForObject: function(object) {
        var result = null;
        var firstUn = this.firstUnselectedObjectAboveOnSameLevel(object);
        if (firstUn)
            result = firstUn;
        else {
            var firstSel = this.firstSelectedObject();
            if (firstSel && firstSel != object)
                result = firstSel;
        }
        return result;
    },
	
	setDelegate: function(delegate){
		this.delegate = delegate;
	}
    
    
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("TableColumns.js");
// ************************* TableColumn ***********************
var inputHeight = "14px";
var fontSize = "11px";

var TableColumn = Base.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
		this.className = "TableColumn";
        this.title = aTitle;
        this.shortTitle = aShortTitle;
        this.key = aKey;
        this.width = aWidth;
        this.prototypeSortDescriptors = [ {
            key: aKey,
            ascending: true
        }];
        this.editable = editable;
        this.align = align.startsWith("l") ? "left": (align.startsWith("c") ? "center": "right");
        this.headerAlign = headerAlign.startsWith("l") ? "left": (headerAlign.startsWith("c") ? "center": "right");
		this.isEditableWithKeyboard = true;
		this.disableReversedSortDescriptors = false;
		this._formatter = null;
//		this.URLPattern = /https?:\/\/([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?/ig;	

		this.URLPattern = /[\w]+:\/\/([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?/ig;	
    },
    
	removeEventHandlersFromElement: function(element) {
		
	},
	
	formatter: function() {
		return this._formatter;
	},
	
	isEditable: function() {
		return this.editable;
	},
	
	clone: function(){
		
		return new TableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},
	
    keyForEditing: function() {
        return this.editingKey ? this.editingKey: this.key;
    },
    
    setTableView: function(tableView) {
        this.tableView = tableView;
    },
	
	isOutlineColumn: function() {
		return this.tableView && this.tableView.outlineColumn == this;
	},
    
    // doSortDescriptorsEqualPrototype: 
    //  1 -> Descriptors sind gleich den prototypeSortDescriptors
    // -1 -> Descriptors sind gleich den umgekehrten prototypeSortDescriptors
    //  0 -> Descriptors sind weder gleich prototypeSortDescriptors noch gleich den umgekehrten prototypeSortDescriptors
    doSortDescriptorsEqualPrototype: function(descriptors) {
        var result = 0;
        if (descriptors && descriptors.length == this.prototypeSortDescriptors.length) {
            var direction = 0;
            for (var i = 0; i < descriptors.length; i ++ ) {
                if (descriptors[i].key != this.prototypeSortDescriptors[i].key)
                    break;
                if (descriptors[i].ascending == this.prototypeSortDescriptors[i].ascending) {
                    if (direction == 0)
                        direction = 1;
                    else if (direction ==- 1)
                        break;
                } else {
                    if (direction == 0)
                        direction = -1;
                    else if (direction == 1)
                        break;
                }
            }
            result = direction;
        }
        return result;
    },
    
    reversedPrototypeSortDescriptors: function() {
		if(this.disableReversedSortDescriptors)
			return this.prototypeSortDescriptors;
        var result = [];
        for (var i = 0; i < this.prototypeSortDescriptors.length; i ++ ) {
            var desc = this.prototypeSortDescriptors[i];
            result.push( {
                key: desc.key,
                ascending :! desc.ascending
            });
        }
        return result;
    },
    
    wrapperWithContent: function(content, cellHeight, doc) {
        return content;

        // Ist das folgende noch nötig für den IE?
        var wrapper = $(doc.createElement("span"));
        wrapper.style.overflow = "hidden";
	    if (cellHeight)
            wrapper.style.lineHeight = cellHeight + "px";
        wrapper.appendChild(content);
        return wrapper;
    },

	markupByReplacingURLsWithLinks: function(text, doc){
		var span = SPAN({document:doc});
		var start = 0;
		var regexpResult;
		while((regexpResult = this.URLPattern.exec(text)) != null){
			span.appendChild(doc.createTextNode(text.slice(start, regexpResult.index)));
			span.appendChild(A({document:doc, href:regexpResult[0], target:"_blank"}, regexpResult[0]));
			start = this.URLPattern.lastIndex;
		}
		var replaced = start != 0;
		if(replaced){
			if(start < text.length)
				span.appendChild(doc.createTextNode(text.slice(start, text.length)));			
		}
		return {markup:span, replaced:replaced};		
	},
    
    contentWidthFromCell: function(cell) {
        var width = this.width - 7;
        if (cell.style.paddingLeft)
            width -= parseInt(cell.style.paddingLeft) + 2;
        if (cell.style.marginLeft)
            width -= parseInt(cell.style.marginLeft);
        if (cell.childNodes[0] && cell.childNodes[0].width)
            width -= cell.childNodes[0].width;
        return width;
    },

	cellContentForValue: function(value, cell, doc, edit, cellHeight) {
        if (typeof value == "undefined" || value == null)
            value = "";
		value = value.toString();
        if (edit) {
            var textField = $(doc.createElement("input"));
            textField.type = "text";
            textField.style.width = (this.contentWidthFromCell(cell)-(Prototype.Browser.IE ? 18 : 0)) + "px";
            textField.style.height = inputHeight;
            textField.style.fontSize = fontSize;
            textField.value = value;
            textField.style.textAlign = this.align;
            textField.name = this.key;
            if (Prototype.Browser.IE && cellHeight) {
                textField.style.position = "absolute";
                textField.style.top = (cellHeight - parseInt(inputHeight) - 3) / 2 + "px";
            }
			return textField;            
        }else{
			if(value != "" && value.include("\n")) {
				value = value.gsub("\n"," ");
			}
			var result = this.markupByReplacingURLsWithLinks(value, doc);
			var node = result.replaced ? result.markup : doc.createTextNode(value);
			return this.wrapperWithContent(node, cellHeight, doc);
		}        	
	},
    
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
        var value = object.valueForKey(this.key);
		return this.cellContentForValue(value, cell, doc, edit, cellHeight);
    }
	

}, {
	dontShowEditHints: false
});


// ************************* NumberTableColumn *********************** 
var NumberTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "NumberTableColumn";
   		this.isEditableWithKeyboard = true;
	},

	clone: function(){
		return new NumberTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},
    
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
        var value = object.valueForKey(this.key);
		if(!parseInt(value))
			value = null;
		return this.cellContentForValue(value, cell, doc, edit, cellHeight);
    }
    
});


// ************************* FlagStatusTableColumn *********************** 

var flagStatusImages = null;
var flagStatusTitles = null;
var flagStatusMenuOrder = null;

var FlagStatusTableColumn = TableColumn.extend( {
    constructor: function(aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base("flagStatus", aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "FlagStatusTableColumn";
        this.editingKey = "givenFlagStatus";
		this.isEditableWithKeyboard = false;
		this.editOnSingleClick = true;
    },

	clone: function(){
		return new FlagStatusTableColumn(this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},

    FlagStatus: {
        NoFlag: 0,
        GreenFlag: 1,
        YellowFlag: 2,
        RedFlag: 3,
        AutomaticFlag: 4
    },
    
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
		var images = this.tableView.environment.images;
		if(!flagStatusImages) {
			flagStatusImages = {};
			flagStatusImages[0] = images["FlagSpacerSmall"];
			flagStatusImages[1] = images["FlagGreenSmall"];
			flagStatusImages[2] = images["FlagYellowSmall"];
			flagStatusImages[3] = images["FlagRedSmall"];
			flagStatusImages[4] = images["FlagSpacerSmall"];
		}
		if(!flagStatusTitles) {
			flagStatusTitles = {};
			flagStatusTitles[0] = environment.localizedString("None");
			flagStatusTitles[1] = ""; //environment.localizedString("Green");
			flagStatusTitles[2] = ""; //environment.localizedString("Yellow");
			flagStatusTitles[3] = ""; //environment.localizedString("Red");
			flagStatusTitles[4] = environment.localizedString("Auto");
		}
		if(!flagStatusMenuOrder) {
			flagStatusMenuOrder = [4, 0, 1, 2 , 3];
		}
		var flagStatus = object.valueForKey(this.editingKey);
		if(flagStatus == undefined)
			flagStatus = object.valueForKey(this.key);
		if(flagStatus == this.FlagStatus.AutomaticFlag) {
			flagStatusImages[4] = flagStatusImages[object.valueForKey(this.key)];
		}
		var image = flagStatusImages[flagStatus];
		if(!image)
			image = images["FlagSpacerSmall"];

		if(object.className() == "MEMasterResource") {
			return IMG({document:doc, style:"position:absolute; left:2px; top:"+((cellHeight-16)/2-1)+"px;", src:image});
		}else{
			this.element = DIV({document:doc, style:"overflow:hidden; height:"+cellHeight+"px;"});
			this.element.className = "customInputField";
			this.element.name = this.editingKey;
			this.element.value = flagStatus;
			this.element.appendChild(IMG({document:doc, style:"position:absolute; left:2px; top:"+((cellHeight-16)/2)+"px;", src:image}));
			if(!TableColumn.dontShowEditHints)
				this.element.appendChild(IMG({document:doc, 'class':"popUpButtonImage", style:"position:absolute; right:2px; top:"+((cellHeight-8)/2)+"px;", src:this.tableView.environment.images.WhiteArrowDown}));
			makePopUpMenuForElement(this.element, flagStatus, {enums:flagStatusTitles, images:flagStatusImages, imageClass:"flagMenuImage", order:flagStatusMenuOrder, showOnlyImages:false}, this.valueChanged, this.shouldOpenMenu, null, null, this);
		}
		return this.element;
    },
	
	valueChanged: function(element, value){
		this.element.value = value;
		this.tableView.endEditing();
	},
	
	shouldOpenMenu: function(event) {
		var row = null;
		var event = event || window.event;
		var target = event.srcElement ? event.srcElement : event.target;
		while(target && (!target.object || target.tagName != "DIV"))
			target = target.parentNode;
		row = target;
		return this.tableView.startEditingInRowAtColumn(row, this);
	},
	
	removeEventHandlersFromElement: function(element) {

	}
			
});


// ************************* InfoIconsTableColumn *********************** 
var InfoIconsTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, false, align, headerAlign);
		this.className = "InfoIconsTableColumn";
		this.isEditableWithKeyboard = false;
    },
    
	clone: function(){
		return new InfoIconsTableColumn(this.key, this.title, this.shortTitle, this.width, this.align, this.headerAlign);
	},
	
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
        var indexList = object.valueForKey(this.key);
        if (!indexList)
            return doc.createTextNode("");
			
		indexList = indexList.indices;
        var count = indexList.length;
        if (!count)
            return doc.createTextNode("");
        
        var container = doc.createElement("div");
        for (var i = 0; i < count; i ++ ) {
            var icon = doc.createElement("img");
            icon.style.paddingRight = "2px";
            icon.width = 11;
            icon.height = 11;
            icon.src = this.tableView.environment.infoIconURLs[indexList[i]];
            container.appendChild(icon);
            if (cellHeight) {
                icon.vspace = (cellHeight - 11) / 2;
                container.style.lineHeight = cellHeight + "px";
            }
            
        }
        return container;
    }
});


// ************************* FlatOrderTableColumn *********************** 
var FlatOrderTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "FlatOrderTableColumn";
   		this.isEditableWithKeyboard = false;
	},

	clone: function(){
		return new FlatOrderTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},
    
    reversedPrototypeSortDescriptors: function() {
        return this.prototypeSortDescriptors;
    }
    
});


// ************************* ComboBoxTableColumn *********************** 
var ComboBoxTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "ComboBoxTableColumn";
		this.isEditableWithKeyboard = true;		
    },

	clone: function(){
		return new ComboBoxTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},
    
	stringValueForObject: function(object, cell, doc, edit, cellHeight) {
		return "";
	},
	
	menuContent: function(object) {
		return [];
	},

    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
        var value = this.stringValueForObject(object, cell, doc, edit, cellHeight);
        var imageURL = this.tableView.environment.images.WhiteArrowDown;
        if (!edit) {
			var span = SPAN({document:doc, 'class':"customInputField", style:"height:"+cellHeight+"px; margin-right:17px; overflow:hidden;"}, 
				value, 
				element = DIV({document:doc, 'class':"popUpButtonImageBackground", style:"background-color:#3d80df; position:absolute; width:17px; height:"+cellHeight+"px; top:0px; right:0px;"})
			);
			if(!TableColumn.dontShowEditHints) {
				var image = IMG({document:doc, 'class':"popUpButtonImage", style:"position:absolute; right:3px; top:"+((cellHeight-8)/2)+"px;", src:imageURL});			
				var me = this;
				image.onclick=function(event){
					var row = null;
					var event = event || window.event;
					var target = event.srcElement ? event.srcElement : event.target;
					while(target && (!target.object || target.tagName != "DIV"))
						target = target.parentNode;
					row = target;
					me.openMenu = true;
					me.tableView.startEditingInRowAtColumn(row, me);
				}
				element.appendChild(image);
			}
			return span;
        }
        else 
        {
            var comboBox = new ComboBox(Prototype.Browser.WebKit ? 17: 14, parseInt(fontSize), imageURL, 9, 8, value, this.menuContent(object), this.contentWidthFromCell(cell), this.key, true, this, this.openMenu);
            var html = comboBox.HTMLElement;
            if (cellHeight) {
                var diff = Prototype.Browser.IE ? 3: 6;
                html.style.top = (cellHeight - parseInt(inputHeight) - diff) / 2 + "px";
            }
			this.openMenu = false;
            return html;
        }
    },
	
	comboBoxMenuClosed: function(comboBox){
		this.tableView.endEditing();
	}
});


// ************************* PercentTableColumn *********************** 
var PercentTableColumn = ComboBoxTableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "PercentTableColumn";	
    },

	clone: function(){
		return new PercentTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},

    setTableView: function(tableView) {
        this.base(tableView);
        this._formatter = new PercentFormatter(tableView.environment);
    },

	stringValueForObject: function(object, cell, doc, edit, cellHeight) {
		var value = object.valueForKey(this.key);
		if(typeof value == 'undefined')
			value = "";
		else
			value = Math.round(value * 100) + "%";
		return value;
	},
	
	menuContent: function(object) {
		return ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];
	}
  
});

// ************************* UtilisationTableColumn *********************** 
var UtilisationTableColumn = ComboBoxTableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "UtilisationTableColumn";
    },

	clone: function(){
		return new UtilisationTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},

    setTableView: function(tableView) {
        this.base(tableView);
        this._formatter = new UtilisationFormatter(tableView.environment);
    },
    
	stringValueForObject: function(object, cell, doc, edit, cellHeight) {
        var value = object.valueForKey(this.key);
		value = this._formatter.stringForObjectValue(value);
		return value;
	},
	
	menuContent: function(object) {
		return ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];
	}
});



// ************************* CurrencyTableColumn *********************** 
var CurrencyTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "CurrencyTableColumn";
		this.isEditableWithKeyboard = true;	
    },

	clone: function(){
		return new CurrencyTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},

    setTableView: function(tableView) {
        this.base(tableView);
        this._formatter = new CurrencyFormatter(tableView.environment);
    },
    
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
        var value = object.valueForKey(this.key);
		var isNegative = value < 0;
        if (!value)
            value = "";
		else{
			value = this._formatter.stringForObjectValue(value);
		}
			
        if (edit) {
            var textField = $(doc.createElement("input"));
            textField.type = "text";
            textField.style.width = this.contentWidthFromCell(cell) + "px";
            textField.style.height = inputHeight;
            textField.style.textAlign = this.align;
            textField.style.fontSize = fontSize;
            textField.value = value;
            textField.name = this.key;
            if (Prototype.Browser.IE && cellHeight) {
                textField.style.position = "absolute";
                textField.style.top = (cellHeight - parseInt(inputHeight) - 3) / 2 + "px";
            }
            return textField;
        }
		cell.style.textAlign = this.align;
		var options = {document:doc};
		if(isNegative)
			options.style = "color:#ff0000;";
		return SPAN(options, doc.createTextNode(value));
    }
});

// ************************* BudgetTableColumn *********************** 

var BudgetTableColumn = CurrencyTableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "BudgetTableColumn";
    },
	
	clone: function(){
		return new BudgetTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},

    setTableView: function(tableView) {
        this.base(tableView);
        this._formatter = new BudgetFormatter(tableView.environment);
    }
});

// ************************* RateTableColumn *********************** 
var RateTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "RateTableColumn";
		this.isEditableWithKeyboard = true;		
    },
 
 	clone: function(){
		return new RateTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},

    setTableView: function(tableView) {
        this.tableView  = tableView;
	    this._formatter = new RateFormatter(this.tableView.environment);
    },
   
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
		var value = "";
        var rate = object.valueForKey(this.key);
        if (rate){
		    value = this._formatter.stringForObjectValue(rate);
//			var unit = rate.denominatorUnit == MEDuration.DurationUnit.MEMaterialUnit ? object.valueForKey("materialUnit") : this._formatter.descriptionForUnitPluralFloating(rate.denominatorUnit, false, rate.denominatorUnitIsFloating);
//			if (this.tableView.environment.currencySymbolBeforeAmount)
//				value = this.tableView.environment.currencySymbol+" "+rate.amount+"/"+unit;
//			else 
//				value = rate.amount + " " + this.tableView.environment.currencySymbol+"/"+unit;
			if (edit) {
				var textField = $(doc.createElement("input"));
				textField.type = "text";
				textField.style.width = this.contentWidthFromCell(cell) + "px";
				textField.style.height = inputHeight;
				textField.style.textAlign = this.align;
				textField.style.fontSize = fontSize;
				textField.value = value;
				textField.name = this.key;
				if (Prototype.Browser.IE && cellHeight) {
					textField.style.position = "absolute";
					textField.style.top = (cellHeight - parseInt(inputHeight) - 3) / 2 + "px";
				}
				return textField;
			}
		}
		cell.style.textAlign = this.align;
        return this.wrapperWithContent(doc.createTextNode(value), cellHeight, doc);
    }
});

// ************************* BooleanTableColumn *********************** 
var BooleanTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "BooleanTableColumn";
		this.isEditableWithKeyboard = false;
		this.editOnSingleClick = true;
    },

 	clone: function(){
		return new BooleanTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},
    
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
        var checked = this.useClickValue ? this.clickValue : object.valueForKey(this.key);
		if(!TableColumn.dontShowEditHints || checked) {
	        var value = object.valueForKey(this.key) ? this.tableView.environment.localizedTrueString: this.tableView.environment.localizedFalseString;
	        var checkbox = $(doc.createElement("input"));
	        checkbox.type = "checkbox";
	        checkbox.value = value;
	        checkbox.name = this.key;
			if(TableColumn.dontShowEditHints)
	        	checkbox.disabled = !edit;
	        if (checked) {
	            checkbox.checked = "checked";
	            checkbox.defaultChecked = true;
	            // IE7
            
	        }
	        if (Prototype.Browser.IE && cellHeight) {
	            checkbox.style.position = "absolute";
	            checkbox.style.top = (cellHeight - parseInt(inputHeight) - 3) / 2 + "px";
	        }
			if(!this.clickEventListener)
				this.clickEventListener = this.click.bindAsEventListener(this);
			PWUtils.observe(checkbox, 'click', this.clickEventListener, true);
	        return checkbox;
		}else
			return  doc.createTextNode("");
    },
	
	click: function(event) {
		var row = null;
		var event = event || window.event;
		var target = event.srcElement ? event.srcElement : event.target;
		var checkbox = target;
		while(target && (!target.object || target.tagName != "DIV"))
			target = target.parentNode;
		row = target;
		this.useClickValue = true;
		this.clickValue = checkbox.checked;
		if(!this.tableView.startEditingInRowAtColumn(row, this)) {
            checkbox.checked = this.clickValue ? null : "checked";
            checkbox.defaultChecked = this.clickValue ? false : null;
		}			
		this.useClickValue = false;
		this.tableView.endEditing();
//		PWUtils.stopObserving(checkbox, 'click', this.clickEventListener);
	}
	
});

var dateTableColumnID = 0;

// ************************* DateTableColumn *********************** 
var DateTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign, displayTime) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "DateTableColumn";
		this.isEditableWithKeyboard = true;		
		this.ID = dateTableColumnID;
		this.displayTime = displayTime;
		dateTableColumnID++;
    },

 	clone: function(){
		return new DateTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign, this.displayTime);
	},
    
    setTableView: function(tableView) {
        this.base(tableView);
        this._formatter = new DateFormatter(tableView.environment.format.dateAndTimeFormat.date, this.displayTime ? tableView.environment.format.dateAndTimeFormat.time : null, true, tableView.environment);
    },
    
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
		var environment = this.tableView.environment;
        var value = object.valueForKey(this.key);
        if ( !value && !edit)
			return this.wrapperWithContent(doc.createTextNode(""), cellHeight, doc);
        if (edit) {
            var imageURL = this.tableView.environment.images.Calendar;
			var datePicker = new DatePicker(Prototype.Browser.WebKit ? 17: 14, parseInt(fontSize), imageURL, value, this.contentWidthFromCell(cell), this.key, this._formatter, this.displayTime);
            var html = datePicker.HTMLElement;
            if (cellHeight) {
                var diff = Prototype.Browser.IE ? 3: 6;
                html.style.top = (cellHeight - parseInt(inputHeight) - diff) / 2 + "px";
            }
            return html;
        }else{ 
            return SPAN({document:doc, style:"white-space:normal;"}, doc.createTextNode(this._formatter.stringForObjectValue(value))); //huhu
//            return SPAN({style:"white-space:normal;"}, doc.createTextNode("huhu")); //huhu
		}
    }
});


// ************************* DurationTableColumn *********************** 
var DurationTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "DurationTableColumn";
		this.isEditableWithKeyboard = true;
    },

 	clone: function(){
		return new DurationTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},
    
    setTableView: function(tableView) {
        this.base(tableView);
        this._formatter = new DurationFormatter(tableView.environment);
    },
    
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
		var cellWidth = this.contentWidthFromCell(cell);
		this._formatter.setPreferedWidth(cellWidth);
        var value = object.valueForKey(this.key);
        if ( ! value)
            value = "";
        if (edit) {
            var textField = $(doc.createElement("input"));
            textField.type = "text";
            textField.style.width = cellWidth + "px";
            textField.style.height = inputHeight;
            textField.style.fontSize = fontSize;            
            textField.value = this._formatter.stringForObjectValue(value);
            textField.name = this.key;
            if (Prototype.Browser.IE && cellHeight) {
                textField.style.position = "absolute";
                textField.style.top = (cellHeight - parseInt(inputHeight) - 3) / 2 + "px";
            }
            return textField;            
        } else 
			return this.wrapperWithContent(doc.createTextNode(this._formatter.stringForObjectValue(value)), cellHeight, doc);
    }
});

// ************************* ResourcesTableColumn *********************** 

var ResourcesTableColumn = ComboBoxTableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "ResourcesTableColumn";
    },

 	clone: function(){
		return new ResourcesTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},

	stringValueForObject: function(object, cell, doc, edit, cellHeight) {
		if(this.className == "ResourcesTableColumn" && object.className() == "MEAssignment")
			return doc.createTextNode("");

        var value = object.valueForKey(this.key);
        if (typeof value == "undefined" || value == null)
            value = "";        
		else if(typeof value != "string")
			value = value.valueForKey("title");
		return value;
	},
	
	menuContent: function(object) {
		var value = this.stringValueForObject(object);
		var rootProjects = this.tableView.delegate.rootObjectsInManagedObjectContext(this.tableView.delegate.moc);
		var visibleResources = rootProjects.valueForKeyPath("resources.title")[0];
		if(visibleResources.length) {
			visibleResources = visibleResources.without(value);
			if(visibleResources.length)
				visibleResources = visibleResources.sort();
		}
		return visibleResources;
	}
});

// ************************* ActivityTitleTableColumn *********************** 
var ActivityTitleTableColumn = ResourcesTableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "ActivityTitleTableColumn";
   		this.isEditableWithKeyboard = true;
	},

	clone: function(){
		return new ActivityTitleTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},
    
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
		if(object.className() == "MEAssignment")
			return this.base(object, cell, doc, edit, cellHeight);
		else {
	        var value = object.valueForKey(this.key);
			return this.cellContentForValue(value, cell, doc, edit, cellHeight);
		}
    }
});

// ************************* SingleSelectionTableColumn *********************** 

var SingleSelectionTableColumn = TableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign, enums) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "SingleSelectionTableColumn";
		this.isEditableWithKeyboard = true;
		this.enums = enums;
		this.editOnSingleClick = true;
    },
	
 	clone: function(){
		return new SingleSelectionTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign, this.enums);
	},
	
    cellContentForObject: function(object, cell, doc, edit, cellHeight) {
        var value = object.valueForKeyPath(this.key);
		var displayValue = this.enums[value];
		this.element = DIV({document:doc, style:"overflow:hidden;"});
		this.element.className = "customInputField";
		this.element.name = this.key;
		this.element.appendChild(doc.createTextNode(displayValue));
		if(!TableColumn.dontShowEditHints)
			this.element.appendChild(IMG({document:doc, 'class':"popUpButtonImage", style:"position:absolute; right:2px; top:"+((cellHeight-6)/2)+"px;", src:this.tableView.environment.images.WhiteArrowDown}));		
		var order = Object.keys(this.enums).sortBy(function(s) { return parseInt(s); });
		order.reverse();
		makePopUpMenuForElement(this.element, value, {enums:this.enums, order:order, removeAfterFirstClick:true}, this.valueChanged, this.shouldOpenMenu, null, null, this);
		return this.element;
    },

	valueChanged: function(element, value){
		this.element.value = value;
		this.tableView.endEditing();
	},
	
	shouldOpenMenu: function(event) {
		var row = null;
		var event = event || window.event;
		var target = event.srcElement ? event.srcElement : event.target;
		while(target && (!target.object || target.tagName != "DIV"))
			target = target.parentNode;
		row = target;
		return this.tableView.startEditingInRowAtColumn(row, this);
	}
});


// ************************* RoleTableColumn *********************** 

var RoleTableColumn = ComboBoxTableColumn.extend( {
    constructor: function(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign) {
        this.base(aKey, aTitle, aShortTitle, aWidth, editable, align, headerAlign);
		this.className = "RoleTableColumn";
    },

 	clone: function(){
		return new RoleTableColumn(this.key, this.title, this.shortTitle, this.width, this.editable, this.align, this.headerAlign);
	},

	stringValueForObject: function(object, cell, doc, edit, cellHeight) {
        var role = object.valueForKey(this.key);
		var value = "";
		if(role){
			value = role.valueForKey("title");
            if(value == undefined)
                value = "";
        }
		return value;
	},
	
	menuContent: function(object) {
		var project = object.valueForKey("project");
		this.project = project;
		var roles = project.sortedRoles();
		var roleNames = [];
		roles.each(function(role){
			roleNames.push(role.valueForKeyPath("title"));
		});
		return roleNames;
	},

	formatter: function() {
		if(!this._formatter)
			this._formatter = new RoleFormatter(this.project);
		return this._formatter;
	}
});



// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("SplitView.js");

var SplitView = Base.extend({
	constructor: function(container, splitterPosition, sensitiveWidth, splitterWidth, minWidth, maxWidth, collapsible){	
		this.enableInteraction = true;
		this.container	= container;
		this.sensitiveWidth = parseInt(sensitiveWidth);
		this.splitterWidth = splitterWidth;
		this.maxWidth = maxWidth;
		this.minWidth = minWidth;
		this.collapsible = collapsible;
		if(maxWidth && splitterPosition > maxWidth)
			splitterPosition = maxWidth;
		if(minWidth && splitterPosition < minWidth){
			splitterPosition = collapsible ? 0 : minWidth;			
		}
		this.splitterPosition = splitterPosition;
		this.firstDiv	= null;
		this.secondDiv	= null;
		var children	= this.container.childNodes;
		var childCount	= children.length;
		for(var i=0; i<childCount; i++){
			if(String(children[i].tagName).toLowerCase() == "div"){
				if(!this.firstDiv)
					this.firstDiv = children[i];
				else if(!this.secondDiv)
					this.secondDiv = children[i];
			}
		}
		this.splitterOffset = sensitiveWidth/2;
		this.splitter = $(document.createElement("div"));
		this.splitter.className = "splitter"
		this.splitter.style.top = "0px";
		this.splitter.style.left = (this.splitterPosition-this.splitterOffset) + "px";
		this.splitter.style.width = this.sensitiveWidth + "px";
		this.splitter.style.bottom = "0px";
		this.splitter.style.position = "absolute";
		if(Prototype.Browser.IE){
			this.splitter.style.backgroundColor = "white";	// IE Fix - sonst wird nicht der richtige Cursor angezeigt
			this.splitter.style.opacity = ".01"; 
			this.splitter.style.filter = "alpha(opacity='01')";
		}else
			this.splitter.style.backgroundColor = "transparent";
		this.splitter.style.cursor = "col-resize";			
		this.container.removeChild(this.firstDiv);
		this.container.removeChild(this.secondDiv);
		this.container.appendChild(this.firstDiv);
		this.container.appendChild(this.secondDiv);
		this.container.appendChild(this.splitter);

		this.mouseDownActionEventListener = this.mouseDownAction.bindAsEventListener(this);
		this.windowResizedActionEventListener = this.windowResizedAction.bindAsEventListener(this);
		PWUtils.observe(this.splitter, "mousedown", this.mouseDownActionEventListener, true);
		PWUtils.observe(window, "resize", this.windowResizedActionEventListener, true);

		this.updateContent();
	},

	updateContent: function() {
		var splitterLeft = parseInt(this.splitter.style.left);
		var s = this.splitterWidth/2;
		var left = splitterLeft+this.splitterOffset;
		this.firstDiv.style.width = Math.max((left-s), 0)+"px";
		this.secondDiv.style.left = s+left+"px";
	},

	setDelegate: function(delegate) {
		this.delegate = delegate;
	},

	handleDrag: function(event) {
		var newLeft = event.clientX - this.deltaX;
		if(this.collapsible && (newLeft < -this.splitterOffset+(this.minDragWidth/2)))
			newLeft = -this.splitterWidth-1;
		else if(newLeft < -this.splitterOffset+this.minDragWidth)
			newLeft = -this.splitterOffset+this.minDragWidth;
		if(newLeft > this.maxDragWidth+this.splitterOffset+1)
			newLeft = this.maxDragWidth+this.splitterOffset+1;
		this.splitter.style.left = newLeft + "px";
		this.updateContent();
		Event.stop(event);
		if(this.delegate && this.delegate.moveSplitterAction)
			this.delegate.moveSplitterAction(this);
	},

	handleStartDrag: function(event, startX, startY) {
		this.container.style.cursor = "col-resize";
		this.startX	= startX;
		this.origX	= this.splitter.offsetLeft;
		this.deltaX	= this.startX - this.origX;
		this.maxDragWidth = (this.maxWidth ? this.maxWidth : this.container.offsetWidth) - this.sensitiveWidth;
		this.minDragWidth = this.minWidth ? this.minWidth : 0;
		if(this.delegate && this.delegate.willMoveSplitterAction)
			this.delegate.willMoveSplitterAction(this);
		Event.stop(event);
	},

	handleEndDrag: function(event) {
		this.container.style.cursor = "default";
		if(parseInt(this.splitter.style.left) > (this.maxDragWidth - 20 + this.sensitiveWidth + this.splitterOffset + 1)){
			this.splitter.style.left = (this.maxDragWidth+this.splitterOffset+1) + "px";
			this.updateContent();
		}	
		this.ratio = parseInt(this.splitter.style.left) / this.maxDragWidth;
		if(this.delegate && this.delegate.splitterChangedAction)
			this.delegate.splitterChangedAction(this);
		Event.stop(event);
	},

	mouseDownAction: function(event) {
		if(!this.enableInteraction)
			return;
		PWUtils.dispatchMouseDownEvent(event, this, null, this.handleDrag, this.handleStartDrag, this.handleEndDrag);
		Event.stop(event);
	},

	isVisible: function(){
		var node = this.container;
		do{
			if(node.style && node.style.display == "none")
				return false;
		}while(node = node.parentNode);
		return true;
	},

	windowResizedAction: function(event) {
		if(!this.isVisible() || !this.enableInteraction)
			return;	
		if(parseInt(this.splitter.style.left) > 0){
			var maxWidth = (this.maxWidth ? this.maxWidth : this.container.offsetWidth) - this.sensitiveWidth;
			if(!this.ratio)
				this.ratio = parseInt(this.splitter.style.left) / maxWidth;
			this.splitter.style.left = Math.ceil(this.ratio * maxWidth) + "px";			
			this.updateContent();
			if(this.delegate && this.delegate.splitterChangedAction)
				this.delegate.splitterChangedAction(this);
		}
	},
	
	setSplitterPosition: function(pos){
		this.splitterPosition = pos;
		this.splitter.style.left = this.splitterPosition+"px";
		this.updateContent();
	},
	
	setEnableInteraction: function(enable){
		this.enableInteraction = enable;
	},

	isFirstViewVisible: function(){
		return parseInt(this.splitter.style.left) > 0;
	},

	showFirstView: function() {
		this.splitter.style.left = this.lastSplitterLeft ? this.lastSplitterLeft : (this.splitterPosition-this.splitterOffset) + "px";	
		this.updateContent();
		if(this.delegate && this.delegate.splitterChangedAction)
			this.delegate.splitterChangedAction(this);		
	},

	hideFirstView: function() {
		this.lastSplitterLeft = this.splitter.style.left;
		this.splitter.style.left = (-this.splitterWidth-1) + "px";	
		this.updateContent();	
		if(this.delegate && this.delegate.splitterChangedAction)
			this.delegate.splitterChangedAction(this);		
	},
	
	toogleFirstView: function() {
		if(parseInt(this.splitter.style.left) < 0)
			this.showFirstView();
		else
			this.hideFirstView();
	},
	
	position: function() {
 		return parseInt(this.splitter.style.left);
	}

});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("Formatter.js");

var Formatter = Base.extend({
	constructor: function()
	{},

	stringForObjectValue: function(object){
		return object ? object.toString() : "";
	},
	
	objectValueForString: function(string){
		return string;
	},
	
	setPreferedWidth: function(width){
		
	}
});

// ************************* RoleFormatter *********************** 

var RoleFormatter = Formatter.extend({
	constructor: function(project){
		this.base();
		this.project = project;
	},

	stringForObjectValue: function(role){
		return role.valueForKey('title');
	},
	
	objectValueForString: function(string){
		var objectValue = null;
		if(string) {
			var roles = this.project.valueForKey('roles');
			if(roles) {
				var role = null;
				for(var i=0; i<roles.length; i++) {
					role = roles[i];
					if(role.valueForKey('title') == string) {
						objectValue = role;
						break;
					}
				}
				if(!objectValue && string.length) {
					// create a new role with the given name:
					objectValue = this.project.context.insertNewObjectForEntityForName('Role', this.project.storeID());
					objectValue.setValueForKey(this.project, 'project');
					objectValue.setValueForKey(string, 'title');
					this.project.context.synchronize();
				}
			}
		}
		return objectValue;
	}
});



// ************************* DateFormatter *********************** 

var DateFormatter = Formatter.extend({
	constructor: function(datePattern, timePattern, utcTimezone, environment){
		this.base();
		this.datePattern = datePattern;
		this.timePattern = timePattern;
		this.environment = environment;
		this.utcTimezone = utcTimezone;
	},

	setPreferedWidth: function(width){
		if(!width)
			this.useShortDescriptions = null;
		this.useShortDescriptions = width < 90;		
	},

	stringForObjectValue: function(date){
		if(date){
			var string = date.format(this.format(), true);
			string = string.strip();
			return string;
		}
		return "";
	},
	
	objectValueForString: function(string){
		if(!string.endsWith(' '))
			string+=" ";
		var date = null;
		var time = Date.getDateFromFormat(string, this.format(), true);
		if(!time && this.datePattern)
			time = Date.getDateFromFormat(string, this.datePattern + " ", true); 
		if(time)
			date = new Date(time);
		return date;
	},
	
	format: function(){
		var timePattern = this.useShortDescriptions ? null : this.timePattern;
		return "" + (this.datePattern ? this.datePattern + " " : "") + (timePattern ? timePattern : "");
	}

});

// ************************* FlagStatusFormatter *********************** 

var FlagStatusFormatter = Formatter.extend({
	constructor: function(environment){
		this.base();
		this.environment = environment;
	},

	stringForObjectValue: function(flagStatus){
		return this.environment.format.flagStatusTable[flagStatus];
	}			
});

// ************************* PercentFormatter *********************** 

var PercentFormatter = Formatter.extend({
	constructor: function(){
		this.base();
		this.percentSymbol = "%"
	},

	stringForObjectValue: function(value){
		return value*100 + " "+this.percentSymbol;
	},	

	objectValueForString: function(string) {
		var value = parseFloat(string);
		if(!isNaN(value))
			return value/100.0;
		return 0.0;
	}
});
 
function formattedNumberString(numberString, environment){
	var array = numberString.toArray().reverse();
	var newArray = [];
	var countPos = false;
	var pos = 0;
	array.each(function(char, index){
		if(char != '.')
			newArray.push(char);
		else{
			newArray.push(environment.decimalSeparator);
			countPos = true;
		}
		if(countPos){
			if(pos!= 0 && pos%3 == 0 && index<array.length-2)
				newArray.push(environment.thousandSeparator);
			pos++;
		}
	});
	newArray.reverse();
	var string = "";
	newArray.each(function(char){
		string+=char;
	});
	return string;
}

function numberStringFromFormattedString(formattedString, environment) {
	var result = "";
	formattedString.toArray().each(function(char){
		if(char == environment.decimalSeparator)
			result += ".";
		else if(char != environment.thousandSeparator)
			result += char;
	});
	return result;
}
 
// ************************* CurrencyFormatter *********************** 

var CurrencyFormatter = Formatter.extend({
	constructor: function(environment){
		this.base();
		this.environment = environment;
	},

	stringForObjectValue: function(value, allowZeroValues){
		if(!allowZeroValues && value == 0)
			return ""; 
		var string = value == 0 ? "0" : formattedNumberString(stringWithFormat("%.2f", value), this.environment);
		if(this.environment.currencySymbolBeforeAmount)
			return this.environment.currencySymbol+" "+string; 
		return string+" "+this.environment.currencySymbol; 
	},	
										 
	objectValueForString: function(string) {
		if(!string || !string.length)
			return 0.0;
		var currencySymbol = environment.currencySymbol.strip(); 
		var array = string.toArray();
		var newString = "";
		array.each(function(char){
			if(char != currencySymbol && char != this.environment.thousandSeparator) {
				if(char == this.environment.decimalSeparator)
					newString+='.';
				else
					newString+=char;
			}
		});
		var value = parseFloat(newString);
		if(isNaN(value))
			value = 0.0;
		return value;
	}


});

// ************************* BudgetFormatter *********************** 

var BudgetFormatter = Formatter.extend({
	constructor: function(environment){
		this.base();
		this.environment = environment;
		this.currencyFormatter = new CurrencyFormatter(environment);
		this.percentFormatter = new PercentFormatter(environment);
	},

	stringForObjectValue: function(value){
		if(value.isFractional == undefined)
			return "";
		else if(value.isFractional)
			return this.percentFormatter.stringForObjectValue(value.amount);
		else
			return this.currencyFormatter.stringForObjectValue(value.amount);			
	},	

	objectValueForString: function(string) {
		var result;
		var amount = 0.0;
		if(string==null || string.length==0)
			result = null;
		else if(string.indexOf(this.percentFormatter.percentSymbol) != -1)
		{
			amount = this.percentFormatter.objectValueForString(string);
			if(amount != null)
				result = MEBudget.budgetWithAmountIsFractional(amount, true);
		}
		else
		{
			amount = this.currencyFormatter.objectValueForString(string);
			if(amount != null)
				result = MEBudget.budgetWithAmountIsFractional(amount, false);
		}
		return result;
	}
});



// ************************* BooleanFormatter *********************** 

var BooleanFormatter = Formatter.extend({
	constructor: function(environment){
		this.environment = environment;
		this.base();
	},

	stringForObjectValue: function(value){
		if(value)
			return this.environment.localizedTrueString; 
		return this.environment.localizedFalseString; 
	},
	
	objectValueForString: function(string) {
		if(string == this.environment.localizedTrueString)
			return true;
		else if(string == this.environment.localizedFalseString)
			return false;
		return parseInt(string) ? true : false;
	}

});

// ************************* DurationFormatter *********************** 

var DurationFormatter = Formatter.extend( {
    constructor: function(environment) {
        this.base();
		this.useShortDescriptions = false;
		this.materialUnit = null;
		this.allowsFloating = true;
		this.environment = environment;
		var pattern = "[+]*([-0-9"+environment.decimalSeparator+environment.thousandSeparator+"]*)\\s*([^?\\ ]*)\\s*\\??\\s*";
		this.amountRegex = new RegExp(pattern);
    },
    
	setPreferedWidth: function(width)
	{
		this.useShortDescriptions = width < 55;
	},
	
	allowsNoUnit: function() {
		return true;
	},
	
    stringForObjectValue: function(duration) {
        if(duration){
			var amount = duration.amount;
			var unit = duration.unit;
			var result;
            
			if(unit==MEDuration.DurationUnit.MEFraction){
				amount *= 100.0;
				result = formattedNumberString(amount.toString(), this.environment);
			}else{
				var places;
				if(!this.useShortDescriptions && Math.abs(amount % 0.1) > 0.001)
					places = 2;
				else if(Math.abs(amount % 1.0) > 0.01)
					places = 1;
				else
					places = 0;			
				result = stringWithFormat("%1."+places+"f", amount);			
				if(result.endsWith(".00"))
					result = result.substring(0, result.length-3);
				result = formattedNumberString(result, this.environment);
			}
			if(this.materialUnit && unit== MEMaterialUnit)
				result += " " + materialUnit;
			else{
				var floating = duration.isFloating;
				var plural = !(Math.abs(amount-1.0)<0.00001 || Math.abs(amount+1.0)<0.00001);
				var unitDescription;
				if(this.useShortDescriptions){
					unitDescription = this.shortDescriptionForUnitPluralFloating(unit, plural, floating);
				}else{
					result += " ";
					unitDescription = this.descriptionForUnitPluralFloating(unit, plural, floating);
				}
				result += unitDescription;
				if(duration.relativeError)
					result += this.useShortDescriptions ? "?" : " ?";
			}
			
			return result;
		}
        return "";
    },
    
	objectValueForString: function(string) {
		var result = null;
		if(string && string.length > 0)
		{
			string = numberStringFromFormattedString(string, this.environment);
			var match = this.amountRegex.exec(string);
			if(match) 
			{
				var amountString = match[1]; 
				var unitString = match[2]; 					
				var amountNumber = parseFloat(amountString);
				var amount = amountNumber || 0.0;
				var relativeError = string.search(/\?/) == -1 ? 0 : 1;
				var durUnit = {};
				if(this.materialUnit && unitString == materialUnit)
				{
					durUnit.unit = eDurationUnit.MEMaterialUnit;
					durUnit.isFloating = false;
				}
				else
					durUnit = this.unitForString(unitString);
				
				if(durUnit.unit == eDurationUnit.MEFraction)
					amount /= 100.0;
				
				var floating = durUnit.isFloating;
				
				if(durUnit.unit == eDurationUnit.MENoUnit && !this.allowsNoUnit())
					durUnit.unit = eDurationUnit.MEDays;
					
				result = MEDuration.durationWithAmountUnitIsFloatingRelativeError(amount, durUnit.unit, floating, relativeError);
			}
		}
		return result;
	},

	shortDescriptionForUnitPluralFloating: function(unit, plural, floating){
		var Unit = MEDuration.DurationUnit;
		if(floating){
			switch(unit){
				default:
				case Unit.MENoUnit:
					return "";
				case Unit.MEDays:
					return plural ? this.environment.localizedString("edays3") : this.environment.localizedString("eday3");
				case Unit.MECalendarWeeks:
				case Unit.MEWeeks:
					return plural ? this.environment.localizedString("eweeks3") : this.environment.localizedString("eweek3");
				case Unit.MEMonths:
					return plural ? this.environment.localizedString("emonths3") : this.environment.localizedString("emonth3");
				case Unit.MEYears:
					return plural ? this.environment.localizedString("eyears3") : this.environment.localizedString("eyear3");
				case Unit.MESeconds:
					return plural ? this.environment.localizedString("eseconds3") : this.environment.localizedString("esecond3");
				case Unit.MEMinutes:
					return plural ? this.environment.localizedString("eminutes3") : this.environment.localizedString("eminute3");
				case Unit.MEHours:
					return plural ? this.environment.localizedString("ehours3") : this.environment.localizedString("ehour3");
				case Unit.MEFraction:
					return "%";
			}
		}else{
			switch(unit) {
				default:
				case Unit.MENoUnit:
					return "";
				case Unit.MEDays:
					return plural ? this.environment.localizedString("days3") : this.environment.localizedString("day3");
				case Unit.MECalendarWeeks:
				case Unit.MEWeeks:
					return plural ? this.environment.localizedString("weeks3") : this.environment.localizedString("week3");
				case Unit.MEMonths:
					return plural ? this.environment.localizedString("months3") : this.environment.localizedString("month3");
				case Unit.MEYears:
					return plural ? this.environment.localizedString("years3") : this.environment.localizedString("year3");
				case Unit.MESeconds:
					return plural ? this.environment.localizedString("seconds3") : this.environment.localizedString("second3");
				case Unit.MEMinutes:
					return plural ? this.environment.localizedString("minutes3") : this.environment.localizedString("minute3");
				case Unit.MEHours:
					return plural ? this.environment.localizedString("hours3") : this.environment.localizedString("hour3");
				case Unit.MEFraction:
					return "%";
				case Unit.MEMaterialUnit:
					return plural ? this.environment.localizedString("materialUnits3") : this.environment.localizedString("materialUnit3");
			}
		}
	},
	
	descriptionForUnitPluralFloating: function(unit, plural, floating){
		var Unit = MEDuration.DurationUnit;
		if(floating){
			switch(unit){
				default:
				case Unit.MENoUnit:
					return "";
				case Unit.MEDays:
					return plural ? this.environment.localizedString("edays") : this.environment.localizedString("eday");
				case Unit.MECalendarWeeks:
				case Unit.MEWeeks:
					return plural ? this.environment.localizedString("eweeks") : this.environment.localizedString("eweek");
				case Unit.MEMonths:
					return plural ? this.environment.localizedString("emonths") : this.environment.localizedString("emonth");
				case Unit.MEYears:
					return plural ? this.environment.localizedString("eyears") : this.environment.localizedString("eyear");
				case Unit.MESeconds:
					return plural ? this.environment.localizedString("eseconds") : this.environment.localizedString("esecond");
				case Unit.MEMinutes:
					return plural ? this.environment.localizedString("eminutes") : this.environment.localizedString("eminute");
				case Unit.MEHours:
					return plural ? this.environment.localizedString("ehours") : this.environment.localizedString("ehour");
				case Unit.MEFraction:
					return "%";
			}
		}else{
			switch(unit) {
				default:
				case Unit.MENoUnit:
					return "";
				case Unit.MEDays:
					return plural ? this.environment.localizedString("days") : this.environment.localizedString("day");
				case Unit.MECalendarWeeks:
				case Unit.MEWeeks:
					return plural ? this.environment.localizedString("weeks") : this.environment.localizedString("week");
				case Unit.MEMonths:
					return plural ? this.environment.localizedString("months") : this.environment.localizedString("month");
				case Unit.MEYears:
					return plural ? this.environment.localizedString("years") : this.environment.localizedString("year");
				case Unit.MESeconds:
					return plural ? this.environment.localizedString("seconds") : this.environment.localizedString("second");
				case Unit.MEMinutes:
					return plural ? this.environment.localizedString("minutes") : this.environment.localizedString("minute");
				case Unit.MEHours:
					return plural ? this.environment.localizedString("hours") : this.environment.localizedString("hour");
				case Unit.MEFraction:
					return "%";
				case Unit.MEMaterialUnit:
					return plural ? this.environment.localizedString("materialUnits") : this.environment.localizedString("materialUnit");
			}
		}
	},

	unitForString: function(str){
		var results = [];
		str = str.toLowerCase();
		var matchResult;
		if(str.length) {
			matchResult = this.stringMatchesUnit(str, "hours");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEHours, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "days");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEDays, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "weeks");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEWeeks, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "years");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEYears, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "minutes");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEMinutes, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "months");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEMonths, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "seconds");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MESeconds, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "%");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEFraction, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "fraction");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEFraction, isFloating:false}});
			matchResult = this.stringMatchesUnit(str, "edays");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEDays, isFloating:true}});
			matchResult = this.stringMatchesUnit(str, "eweeks");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEWeeks, isFloating:true}});
			matchResult = this.stringMatchesUnit(str, "eminutes");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEMinutes, isFloating:true}});
			matchResult = this.stringMatchesUnit(str, "emonths");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEMonths, isFloating:true}});
			matchResult = this.stringMatchesUnit(str, "eyears");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEYears, isFloating:true}});
			matchResult = this.stringMatchesUnit(str, "ehours");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEHours, isFloating:true}});
			matchResult = this.stringMatchesUnit(str, "eseconds");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MESeconds, isFloating:true}});
			matchResult = this.stringMatchesUnit(str, "material unit");
			if(matchResult)
				results.push({diff:matchResult.diff, result:{unit:eDurationUnit.MEMaterialUnit, isFloating:false}});
		}
		if(results.length){
			var optimalUnit = null;
			for(var i=0; i<results.length; i++) {
				var result = results[i]
				if(!optimalUnit || result.diff < optimalUnit.diff)
					optimalUnit = result;
			}
			return optimalUnit.result;
		}
		return {unit:eDurationUnit.MENoUnit, isFloating:false};
	},

		
	stringMatchesUnit: function(string, key){
		var result = null;
		for(var alternative=1; alternative<4; alternative++){
			var keyPlusNum = alternative>1 ? key+alternative : key;
			var localizedString = this.environment.localizedString(keyPlusNum);
			if(localizedString && localizedString.toLowerCase().startsWith(string)){
				var diff = Math.abs(localizedString.length-string.length); 
				if(!result || diff < result.diff)
					result = {diff:diff};
			}
		}
		return result;
	}
	

});


// ************************* UtilisationFormatter *********************** 

var UtilisationFormatter = Formatter.extend({
	constructor: function(environment){
		this.environment = environment;
		this.base();
		this.validateAmountOnly = false;
		this.durationFormatter = new DurationFormatter(environment);
		this.materialUnit = null;
		this.decimalPlaces = 2;
		var pattern = "([0-9"+environment.decimalSeparator+environment.thousandSeparator+"]*)(.*)";
		this.regex = new RegExp(pattern);		
	},

	stringForObjectValue: function(value){
		var result = "";
		if(value){
			var amount = value.amount;
			if(value.denominatorUnit == eDurationUnit.MEFraction)
				amount *= 100.0;
			var amountPart = stringWithFormat("%."+this.decimalPlaces+"f%s", amount, value.denominatorUnit == eDurationUnit.MEFraction ? "%" : "");
			if(this.validateAmountOnly)
				return amountPart;			
			result += amountPart;
			if(value.denominatorUnit != eDurationUnit.MEFraction){
				var denom = this.durationFormatter.descriptionForUnitPluralFloating(value.denominatorUnit, false, false);
				if(this.materialUnit)
					result += materialUnit;
				result += "/";
				if(denom)
					result += denom;
			}
		}
		return result;		
	},

	objectValueForString: function(string) {
		var result = null;
		if(!string || string.length==0)
			result = null;
		else if(this.validateAmountOnly){	
			var value = parseFloat(string);
			if(isNaN(value))
				value = 0.0;
			var unit = eDurationUnit.MESpecialCompareUnit;
			if(string.search(/\%/) != -1){
				unit = eDurationUnit.MEFraction;
				value /= 100.0;
			}
			result = MEUtilisation.utilisationWithAmountDenominatorUnit(value, unit);
		}else{ 
			var numerator = null;
			var denominator = null;
			var location = string.indexOf("/");
			if(location != -1){
				numerator = string.substring(0, location);
				denominator = string.substring(location+1);
			}
			else
				numerator = string;
			
			var match = this.regex.exec(numerator);
			if(match) {
				var numeratorAmountString = match[1]; 
				var numeratorAmount = parseFloat(numeratorAmountString); 					
				if(isNaN(numeratorAmount))
					numeratorAmount = 0.0;
				if(numeratorAmount<0.0)
					numeratorAmount *= -1.0;
				
				var unit = {};
				if(string.indexOf("%") != -1){
					unit.isFloating = false;
					unit.unit = eDurationUnit.MEFraction;
				}else if(!denominator){
					unit.isFloating = false;
					unit.unit = eDurationUnit.MENoUnit;
				}else
					unit = this.durationFormatter.unitForString(denominator);
							
				if(unit.unit==eDurationUnit.MEFraction)
					numeratorAmount /= 100.0;
				result = numeratorAmount ? MEUtilisation.utilisationWithAmountDenominatorUnit(numeratorAmount, unit.unit) : null;
			}
		}
		return result;
	}

});


// ************************* RateFormatter *********************** 

var RateFormatter = Formatter.extend({
	constructor: function(environment){
		this.currencyFormatter = new CurrencyFormatter(environment);
		this.durationFormatter = new DurationFormatter(environment); 
		this.environment = environment;
		this.materialUnit = null;
		this.base();
	},

	stringForObjectValue: function(value){
		var currencyPart = this.currencyFormatter.stringForObjectValue(value.amount, true);
		var result = currencyPart;
		var denominator = value.denominatorUnit == MEDuration.DurationUnit.MEMaterialUnit ? this.materialUnit : this.durationFormatter.descriptionForUnitPluralFloating(value.denominatorUnit, false, value.denominatorUnitIsFloating);
		if(denominator)
			result += "/" + denominator;
		return result;		
	},

	objectValueForString: function(string) {
		var result = null;
		if(string && string.length > 0)
		{
			var numerator   = null;
			var denominator = null;
			var parts = string.split("/");
			if(parts.length >= 1)
				numerator = parts[0];
			if(parts.length >= 2)
				denominator = parts[1];				
			
			var amount = this.currencyFormatter.objectValueForString(numerator);
			var Units = MEDuration.DurationUnit;
			var unit  = {};
			if(this.materialUnit)
			{
				unit.isFloating = NO;
				unit.unit = Units.MEMaterialUnit;
			}
			else if(!denominator)
			{
				unit.isFloating = NO;
				unit.unit = Units.MENoUnit;
			}
			else
				unit = MEDuration.sharedFormatter(this.environment).unitForString(denominator);
			result = MERate.RateWithAmountUnitUnitIsFloating(amount, unit.unit, unit.isFloating);
		}
		return result;
	}

});






























// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("ActivitiesView.js");

var ActivitiesView = Base.extend({
	constructor: function(outlineController, domNode, columns, styleList, ganttRuler, viewOptions, environment, controlsContainer, managedObjectContext, showPrintView, delegate, isBeingExportedForQuicklook){
		var me = this;

		this.delegate = delegate;
		this.moc = managedObjectContext;
		this.isBeingExportedForQuicklook = isBeingExportedForQuicklook;

		(function() {me.registerClickInBody()}).delay(1);

		var node;
		this.showPrintView = showPrintView;
		if(controlsContainer){
			this.hasControls = true;
			for(var i=0; i<controlsContainer.childNodes.length;i++){
				node = controlsContainer.childNodes[i];
				if(node.childNodes.length){
					node = node.childNodes[0];
					if(node.className == "addActivityButton"){
						this.addActivityButton = node; PWUtils.makeMultiStateButton(node);
					}else if(node.className == "chainActivitiesButton"){
						this.chainActivitiesButton = node; PWUtils.makeMultiStateButton(node);
					}else if(node.className == "deleteButton"){
						this.deleteButton = node; PWUtils.makeMultiStateButton(node);
					}else if(node.className == "indentButton"){
						this.indentButton = node; PWUtils.makeMultiStateButton(node);
					}else if(node.className == "outdentButton"){
						this.outdentButton = node; PWUtils.makeMultiStateButton(node);
					}else if(node.className == "saveButton"){
						this.saveButton = node; PWUtils.makeMultiStateButton(node);
					}else if(node.className == "undoButton"){
						this.undoButton = node; PWUtils.makeMultiStateButton(node);
					}else if(node.className == "redoButton"){
						this.redoButton = node; PWUtils.makeMultiStateButton(node);
					}else if(node.className == "zoomInButton"){
						this.zoomInButton = node; PWUtils.makeMultiStateButton(node, true);
					}else if(node.className == "zoomOutButton"){
						this.zoomOutButton = node; PWUtils.makeMultiStateButton(node, true);
					}else if(node.className == "columnsButton"){
						this.columnsButton = node; PWUtils.makeMultiStateButton(node);
					}
				}
			}
		}
		this.environment = environment;
		this.outlineController = outlineController;					
		// Vorgangsansicht anlegen:
		/*
		 <div name="activities">
		 <div name="splitview">
		 <div class="outline"></div>			
		 <div class="gantt"></div>		
		 </div>
		 </div>
		 */
		this.activitiesContainer = $(document.createElement("div"));
		this.activitiesContainer.className = "activities";
		this.splitViewContainer = $(document.createElement("div"));
		this.splitViewContainer.className = "splitview";
		this.outlineContainer = $(document.createElement("div"));
		this.outlineContainer.className = "outline";
		this.ganttContainer = $(document.createElement("div"));
		this.ganttContainer.className = "gantt";
		this.activitiesContainer.appendChild(this.splitViewContainer);
		this.splitViewContainer.appendChild(this.outlineContainer);
		this.splitViewContainer.appendChild(this.ganttContainer);
		domNode.appendChild(this.activitiesContainer);
		this.setGanttRuler(ganttRuler);		
		this.splitView = this.showPrintView ? new SplitView(this.splitViewContainer, 400, 0, 0) : new SplitView(this.splitViewContainer, 400, 9, 1);
		this.splitView.setEnableInteraction(!this.showPrintView);
		this.splitView.setDelegate(this);
		this.outlineView = new OutlineView(this.outlineContainer, this.outlineController, 20, null, !showPrintView, environment, showPrintView);
		if(this.isBeingExportedForQuicklook)
			this.outlineView.setEnableDrags(false);
		this.outlineView.setDelegate(this);		
		this.outlineView.setBlockRefresh(true);
		this.setColumns(columns);		
		this.setRootActivities(this.rootObjectsInManagedObjectContext(this.moc), true);
		this.ganttScrollView = new GanttScrollView(this.ganttContainer, this.outlineView, !this.showPrintView, this.ganttRuler, this.environment, delegate);			
		this.freshGanttScrollView = true;
		this.setStyleList(new StyleList(styleList, environment));
		this.setViewOptions(viewOptions);
		this.outlineView.setBlockRefresh(false);
		if(this.ganttScrollView)
			this.ganttScrollView.setBlockRefresh(false);
		this.outlineView.refresh();						
		this.outlineView.setXScrollBarType(this.showPrintView ? "hidden" : "scroll");
		this.ganttScrollView.setEnableScrollBars(!this.showPrintView);
		this.updateControlsEnabledStatus();
	},

	registerClickInBody: function() {
		PWUtils.observe($$('body')[0], "click", this.handleClick.bindAsEventListener(this), false, true);
	},

	setIsVisible: function(flag){
		this.outlineView.setEnableDrops(flag);	
	},

	displayGraphs: function(){
		return false;
	},			
						
	rootObjectsInManagedObjectContext: function(aMoc){
		var result = [];
		if(aMoc){
			for(var key in aMoc.registeredObjects){
				var object = aMoc.registeredObjects[key]; 
				if(object.className() == "MEProject" && !object.valueForKey("linkedParentActivity") && !object.valueForKey("projectLink")) {
					result.push(object);
				}
			}
		}
		return result;
	},	
		
	setDelegate: function(delegate){	
		this.delegate = delegate;
	},

	setColumns: function(columns){
		this.columns = columns;
		this.outlineView.setColumnsAndOutlineColumnKey(columns, "title");
	},
	
	setStyleList: function(styleList){
		this.styleList = styleList;
		if(this.ganttScrollView)
			this.ganttScrollView.setStyleList(styleList);
	},
	
	setGanttRuler: function(ruler){
		this.ganttRuler = ruler;
	},
	
	setViewOptions: function(viewOptions){
		this.viewOptions = viewOptions;		
		if(this.ganttScrollView)
			this.ganttScrollView.setViewOptions(viewOptions);
	},
	
	setRootActivities: function(activities, update){
		this.outlineController.setRootObjects(activities);
		this.ganttRuler.setLimitingActivities(activities);
		if(update)
			this.outlineView.updateTableBody();
	},
	
	splitterChangedAction: function(splitter){
		this.delegate.splitterPosition = splitter.position();
		if(splitter.secondDiv.offsetWidth == 0)	// ganttWidth
			this.outlineView.contentContainer.style.overflowY = "auto";
		else
			this.outlineView.contentContainer.style.overflowY = "hidden";
		this.containerSizeChanged();	
	},

	moveSplitterAction: function(splitter){
		this.containerSizeChanged();
	},
	
	containerSizeChanged: function(){
		this.outlineView.containerSizeChanged();
		if(this.ganttScrollView)
			this.ganttScrollView.containerSizeChanged();	
	},
	
	willMoveSplitterAction: function(splitter){
		this.outlineView.contentContainer.style.overflowY = "hidden";
		this.outlineView.headerContainer.style.right = "0px";
	},

	outlineChanged: function(outline, rows){		
		if(this.ganttScrollView){
			this.ganttScrollView.outlineViewChanged(rows);
			this.freshGanttScrollView = false;
		}
	},

	outlineHeightForRow: function(outline, row){
		var activity = row.object;
		var array = [];
		var h1 = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetRow, activity.valueForKey("styleConditionMask")).height;
		if(h1)
			array.push(h1);
		var h2 = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetOutline, activity.valueForKey("styleConditionMask")).fontSize;
		if(h2)
			array.push(h2);
		var h3 = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetBar, activity.valueForKey("styleConditionMask")).height;
		if(h3)
			array.push(h3+h3*0.2);
		var h4 = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetLabelLeft, activity.valueForKey("styleConditionMask")).fontSize;
		if(h4)
			array.push(h4+h4*0.5);
		var h5 = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetLabelMiddle, activity.valueForKey("styleConditionMask")).fontSize;
		if(h5)
			array.push(h5+h5*0.5);
		var h6 = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetLabelRight, activity.valueForKey("styleConditionMask")).fontSize;
		if(h6)
			array.push(h6+h6*0.5);
		var max = null;
		var value;
		for(var i=0; i<array.length; i++){
			value = array[i];
			if(!max || value>max)
				max = value;
		}
		var overlap = false;
		if(	this.viewOptions.displayMode != 3  
			&& activity.valueForKey("plannedStartDate") 
			&& activity.valueForKey("plannedEndDate") 
			&& (!activity.valueForKey("plannedStartDate").isEqual(activity.valueForKey("expectedStartDate")) || !activity.valueForKey("plannedEndDate").isEqual(activity.valueForKey("expectedEndDate")))){
			var x = this.ganttRuler.dateToPos(activity.valueForKey("expectedStartDate"));
			var width = this.ganttRuler.dateToPos(activity.valueForKey("expectedEndDate"))-x;	
			plannedX = this.ganttRuler.dateToPos(activity.valueForKey("plannedStartDate"));
			plannedWidth = this.ganttRuler.dateToPos(activity.valueForKey("plannedEndDate"))-plannedX;
			var end1 = x+width+2;
			var end2 = plannedX+plannedWidth+2;
			overlap = (end1>=plannedX && end1<=end2) || (x>=plannedX && x<=end2);
		}
		max = Math.floor(max);
		if(overlap && max < 16)
			max+=2;
		return max+3;
	},

	outlineDoubleClickInEmptyArea: function(outline, event) {
		if(this.delegate && this.delegate.outlineDoubleClickInEmptyArea)
			this.delegate.outlineDoubleClickInEmptyArea(outline, event);
	},
	
	outlineDidCreateRows: function(outline, rows){
		this.ganttScrollView.outlineDidCreateRows(outline, rows);
	},
	
	outlineRowsBecameVisible: function(outline, rows){
		this.ganttScrollView.outlineRowsBecameVisible(outline, rows);
	},

	outlineDidCreateCellInRow: function(outline, cell, row, editMode, isSelected){
		var activity = row.object;
		if(activity.className() == "MEAssignment" && cell.column == outline.outlineColumn){
			var image = $(document.createElement("img"));
			if(Prototype.Browser.IE && editMode){
				var height = parseInt(cell.style.lineHeight);
				image.style.top = (height-11)/2+"px";
			}
			image.style.position = "relative";
			image.width = 8;
			image.height = 10;
			image.style.left="-8px";
			image.style.marginRight="-8px";
			image.src = this.environment.images.AssignmentArrow;
			cell.appendChild(image);
		}
		var mask = activity.valueForKey("styleConditionMask");
		if(activity.valueForKey('hasConflicts'))
		{
			var maxLevel = [activity.maximumLevelInConflictsForKey(cell.column.key)];
			if(maxLevel>=100)
				mask |= 1<<StyleList.styleConditions.MEActivityStyleConditionConflict;
			else if(maxLevel>=50)
				mask |= 1<<StyleList.styleConditions.MEActivityStyleConditionWarning;
			cell.keepOriginalColorInSelection = maxLevel > 0;
		}
		var style = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetOutline, mask);			
		if(style.fontSize) 
			cell.style.fontSize = style.fontSize+"px";
		if(style.fontWeight)
			cell.style.fontWeight = style.fontWeight;
		if(style.fontStyle)
			cell.style.fontStyle = style.fontStyle;
		if(style.fontStretch)
			cell.style.fontStretch = style.fontStretch;
		if(style.fontFamily)
			cell.style.fontFamily = style.fontFamily;
		if(style.color){		
			cell.style.color = style.color;
			cell.originalColor = style.color;
		}else
			cell.originalColor = "#000000";

		if(activity.className() == "MEProjectLink" && !activity.valueForKey("targetProject")) {
			var gray = "#707070";
			cell.style.color = gray;
			cell.originalColor = gray;
		}

		if(isSelected && !cell.keepOriginalColorInSelection)
			cell.style.color = "#ffffff";
	},
	
	outlineDidChangeSelection: function()
	{
		var objects = this.outlineView.controller.selectedObjects;
		this.parentIDs = [];
		for(var i=0; i<objects.length; i++){
			var parent = this.outlineController.indentationParentObjectForObject(objects[i]);
			this.parentIDs.push(parent ? parent.objectID.uri : "0");
		}
		if(this.ganttScrollView)
			this.ganttScrollView.refreshSelection(objects);
	},
	
	outlineViewDidCreateDisclosureButtonForRow: function(outline, button, row){
		if(row.object.hasAssignments()){
			button.src = row.object.valueForKey("isCollapsed") ? this.environment.images.AssignmentDisclosureRight : this.environment.images.AssignmentDisclosureDown;
		}
	},
	
	outlineShouldShowDisclosureButtonForObject: function(object) {
		return object.className() == "MEProjectLink";
	},

	outlineShouldExpandObject: function(object) {
		var expand = true;
		if(object.className() == "MEProjectLink") {
			if(!object.valueForKey("targetProject"))
					expand = this.delegate && this.delegate.loadProjectLink ? this.delegate.loadProjectLink(object) : false;
		}
		return expand;
	},

	handleClick: function(event){
		var event = event || window.event;	// Damit Comboboxen ihr Popup-Fenster schliessen, wenn in die Umgebung geklickt wird
		PWUtils.notificationCenter.sendMessage("click", event);
	},

	zoomIn: function(){
		this.ganttScrollView.zoomIn();
//		this.ganttScrollView.refreshSelection(this.outlineController.selectedObjects);
	},

	zoomOut: function(){
		this.ganttScrollView.zoomOut();	
//		this.ganttScrollView.refreshSelection(this.outlineController.selectedObjects);
	},
	
	endEditing: function(){
		this.outlineView.endEditing();
	},

	canIndentActivity: function(){
		var selectedObjects = this.outlineController.selectedObjects;
		var object;
		if(selectedObjects && selectedObjects.length){
			for(var i=0; i<selectedObjects.length; i++){
				object = selectedObjects[i];
				if(object.className() != "MEAssignment" && this.outlineController.isObjectIndentable(object))
					return true;
			}
		}
		return false;
	},

	canOutdentActivity: function(){
		var selectedObjects = this.outlineController.selectedObjects;
		var object;
		if(selectedObjects && selectedObjects.length){
			for(var i=0; i<selectedObjects.length; i++){
				object = selectedObjects[i];
				if(object.className() != "MEAssignment" && this.outlineController.isObjectOutdentable(object))
					return true;
			}
		}
		return false;
	},

	setActivitiesCollapsed: function(activities, collapsed, noRefresh) {
		var update = false;
		for(var i=0; i<activities.length; i++) {
			var activity = activities[i];

            //ak Quick test if project links can be loaded automatically.
            //			if(activity.className() == "MEProjectLink")
            //				this.delegate.loadProjectLink(activity);

			var children = activity.valueForKey(this.outlineController.childrenKey);			
			if(children && children.length)	{
				var state = activity.valueForKey(this.outlineController.isCollapsedKey);
				if(state != collapsed) {
					activity.setValueForKey(collapsed, this.outlineController.isCollapsedKey);
					update = true;
				}
			}
		}
		if(update && !noRefresh)
			this.refresh();	
	},

	collapseAll: function() {
		var activities = this.outlineController.getAllObjects().reject(function(object){
			return object.className() == "MEProject";
		}, this);
		this.setActivitiesCollapsed(activities, true);
	},

	expandAll: function() {
		var activities = this.outlineController.getAllObjects().reject(function(object){
			return object.hasAssignments && object.hasAssignments();
		}, this);
		this.setActivitiesCollapsed(activities, false);
	},
	
	hideAllAssignments: function() {
		var activities = this.outlineController.getAllObjects().findAll(function(object){
			return object.hasAssignments && object.hasAssignments();
		}, this);
		this.setActivitiesCollapsed(activities, true);		
	},

	showAllAssignments: function() {
		var activities = this.outlineController.getAllObjects().findAll(function(object){
			return object.hasAssignments && object.hasAssignments();
		}, this);
		this.setActivitiesCollapsed(activities, false);			
	},
	
	showOutlineLevel: function(level) {
		var update = false;
		var activities = this.outlineController.getAllObjects().reject(function(activity){
			return activity.hasAssignments && activity.hasAssignments();
		}, this);
		var result = activities.partition(function(activity){
			return activity.level <= level-1;
		}, this)
		if(result[0].length) {
			update = true;
			this.setActivitiesCollapsed(result[0], false, true);
		}
		if(result[1].length) {
			update = true;
			this.setActivitiesCollapsed(result[1], true, true);
		}
		if(update) {
			this.moc.synchronize();
			this.refresh();
		}
	},
	
	minOutdentLevel: function(){
		return 1;
	},

	canAddActivity: function(){
		return true; //this.outlineController.selectedObjects.length > 0;
	},
	
	canAddAssignment: function(){
		if(this.outlineController.selectedObjects.length != 1)
			return false;
		if(this.outlineController.selectedObjects.length == 1 && this.outlineController.selectedObjects[0].className() == "MEProject")
			return false;
		var subActivities = this.outlineController.selectedObjects[0].valueForKey("linkedSubActivities");	
		if(subActivities && subActivities.length && subActivities[0].className() != "MEAssignment")
			return false;
		return true;
	},
	
	canDeleteActivity: function(){
		if(this.outlineController.selectedObjects.length == 1 && this.outlineController.selectedObjects[0].className() == "MEProject")
			return false;
		else
			return this.outlineController.selectedObjects.length > 0 && this.outlineController.flatObjects.length > 1;
	},	
	
	canChainActivities: function() {
		return this.outlineController.selectedObjects.length > 1;
	},
	
	updateControlsEnabledStatus: function(){
		if(this.hasControls && this.chainActivitiesButton){
			this.chainActivitiesButton.setEnabled( this.canChainActivities() );
			this.addActivityButton.setEnabled( this.canAddActivity() );
			this.indentButton.setEnabled( this.canIndentActivity() );
			this.outdentButton.setEnabled( this.canOutdentActivity() );
		}
	},
	
	selectionChanged: function(outline, selectedObjects){
		this.updateControlsEnabledStatus();
	},

	synchronizeWithServer: function(){
		var me = this;
		onSuccess = function(result){
			me.outlineView.refresh();
		}
		this.moc.synchronize(onSuccess);
	},
	
	refresh: function(refreshSelection){
		this.outlineView.refresh();
		if(refreshSelection)
			this.outlineDidChangeSelection(this);
		this.updateControlsEnabledStatus();
	},
	
	refreshRuler: function() {
		this.ganttScrollView.ganttRulerView.refreshRuler();
		this.ganttScrollView.containerSizeChanged();		
	},
	
	outlineShouldEditObjectProperty: function(outline, object, key){
		return this.delegate.shouldEditObjectProperty(object, key);
	},
	
//	outlineValidateValueForKeyOfObject: function(outline, objectValue, stringValue, key, object, validationDidEndHandler) {
//		
//	},
//
//	outlineValidatePropertyOfObject: function(outline, property, object, validationDidEndHandler){
//		this.validationDidEndHandler = validationDidEndHandler;
//		this.delegate.validatePropertyOfObject(this, property, object, this.delegateDidValidateProperty);
//	},
	
	delegateDidValidateProperty: function(result){
		result = eval("("+result+")");
		if(result.validated){
			var object = this.moc.registeredObjectWithURIString(result.objectID);
			if(object){ 
				var value = object.createValueForPropertyFromJSON(result.propertyName, result.value);
				object.setValueForKey(value, result.propertyName);				
				this.moc.synchronize();
				this.validationDidEndHandler.call(this.outlineView, result);
			}
		}
	},
	
	outlineViewShouldHandleClickInRow: function(outlineView, row){
		if(window["datePickerIsVisible"]  && datePickerIsVisible()){
			closeCalendar();
			return false;
		}
		return true;
	},
	
	setVisibleOutlineWidth: function(width){
		this.splitView.setSplitterPosition(width);
	},

	// ************************************************************************************************************
	// *****
	// *****										Drag and Drop
	// *****
	
	outlineShouldDragRows: function(outline, rows){
		if(this.delegate.outlineShouldDragRows)
			return this.delegate.outlineShouldDragRows(outline, rows);
		return false;
	},
	
	outlineValidateDrop: function(outline, location, pasteboard){		
		if(this.delegate.outlineValidateDrop)
			return this.delegate.outlineValidateDrop(outline, location, pasteboard);
		return false;
	},

	outlineAcceptDrop: function(outline, location, pasteboard){
		if(this.delegate.outlineAcceptDrop)
			this.delegate.outlineAcceptDrop(outline, location, pasteboard);
	}

});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("GanttRulerRow.js");

var GanttRulerRow = Base.extend({
	constructor: function (ruler, environment)
	{
		this.environment = environment;
		this.ruler = ruler;
		this.lastStyleForUnit = {};
		this.style = 0;
		this.unit = eDurationUnit.MEDay;
	},

	setStyle: function(style)
	{
		this.style = style;	
	},

	setUnit: function(unit)
	{
		var changed = this.unit!=unit;
		this.unit = unit;
		this.ruler.setPrimaryUnit(this.ruler.primaryRow().unit);
		if(changed){
			var lastStyle = this.lastStyleForUnit[unit];
			if(lastStyle)
				this.setStyle(lastStyle);
			else
				this.setStyle(this.defaultStyle());
		}
		var nextRow = this.nextRow();
		if(nextRow && (nextRow.unit < unit)){
			nextRow.setUnit(this.oneUnitBiggerThanUnit(unit));	
			nextRow.setStyle(this.defaultStyle());
		}	
		if(this.isPrimary() && changed){
			this.ruler.updatePixelsPerDay();
		}
		this.ruler.updateModificationDate();	
	},

	defaultStyle: function()
	{
		var style = 0;
		var order = this.order();
		var numRows = this.ruler.rows.length;
		var unit = this.unit;
		var isFirst = order==0;
		var isLast = order==numRows-1;
		if(unit == eDurationUnit.MEYears){
			style = 0;		
		}else if(unit == eDurationUnit.MEQuarterYears){
			if(!isLast)
				style = 0;
			else
				style = 1;
		}else if(unit == eDurationUnit.MEMonths){
			if(isFirst && !isLast)
				style = 0;
			else if(isLast)
				style = 4;
			else 
				style = 2;
		}	else if(unit == eDurationUnit.MECalendarWeeks){
			if(isLast)
				style = 5;
			else
				style = 2;
		}else if(unit == eDurationUnit.MEDays){
			if(!isFirst)
				style = 5;
			else
				style = 0;
		}else if(unit == eDurationUnit.MEHours){
			if(isLast)
				style = 3;
			else
				style = 0;
		}else if(unit == eDurationUnit.MEMinutes)
			style = 0;
		return style;		
	},

	order: function()
	{
		return this.ruler.rows.indexOf(this);
	},


	isPrimary: function()
	{
		return this.order()==0;
	},

	reverseOrder: function()
	{
		var rows = this.ruler.rows;
		return rows.length-rows.indexOf(self)-1;
	},

	setRuler: function(ruler)
	{
		this.ruler = ruler;
	},

	numberOfStyles: function()
	{
		switch(this.unit){
			case eDurationUnit.MEMinutes:
				return 8;
			case eDurationUnit.MEHours:
				return this.environment.format.systemTimeFormatUses12Hours ? 14 : 13;
			case eDurationUnit.MEDays:
				return 15;
			case eDurationUnit.MECalendarWeeks:
				return 17;
			case eDurationUnit.MEMonths:
				return 11;
			case eDurationUnit.MEQuarterYears:
				return 8;
			case eDurationUnit.MEYears:
			default:
				return 7;
		}
	},

	rowCode: function()
	{
		return this.ruler ? this.unit*1000 + this.style : 0;
	},

	possibleStylesNamesUsingLocale: function(locale)
	{
		var names = [];
		var projectStart = this.ruler.project.valueForKey('plannedStartDate');
		if(!projectStart)
			projectStart = new Date();
		var numStyles = this.numberOfStyles();
		var unit = this.unit;
		for(var style = 0; style<numStyles; style++){
			var description = this.descriptionForUnitStyleAtDateWithLocaleForMenu(unit, style, projectStart, locale, true);
			if(description)
				names.push(description);
		}
		return names;
	},

	mayRemove: function()
	{
		return this.ruler.mayRemoveARow();
	},

	mayAddBehind: function()
	{
		return this.ruler.mayAddARow();
	},

	maySwitchToUnit: function(unit)
	{
		var result = true;
		var previousRow = this.previousRow();
		if(previousRow)
			result = previousRow.unit <= unit;
		return result;
	},

	previousRow: function()
	{
		return this.order()>0 ? this.ruler.rows[order-1] : null;
	},

	nextRow: function()
	{
		var order = this.order();
		var rows = this.ruler.rows;
		return order<rows.length-1 ? rows[order+1] : null;
	},

	newRowBehind: function()
	{
		var unit = this.unit;
		var newUnit = eDurationUnit.MECalendarWeeks;
		if(unit == eDurationUnit.MEMinutes)
			newUnit = eDurationUnit.MEHours;
		else if(unit == eDurationUnit.MEHours)
			newUnit = eDurationUnit.MEDays;
		else if(unit == eDurationUnit.MEDays)
			newUnit = eDurationUnit.MECalendarWeeks;
		else if(unit == eDurationUnit.MECalendarWeeks)
			newUnit = eDurationUnit.MEMonths;
		else if(unit == eDurationUnit.MEMonths)
			newUnit = eDurationUnit.MEQuarterYears;
		else if(unit == eDurationUnit.MEQuarterYears)
			newUnit = eDurationUnit.MEYears;
		return this.ruler.addRowWithUnitStyleWithOrder(newUnit,0,this.order()+1);
	},

	keyForRelativeUnit: function(unit)
	{
		switch(unit){
			case eDurationUnit.MEMinutes:
				return "Minute";
			case eDurationUnit.MEHours:
				return "Hour";
			default:
			case eDurationUnit.MEDays:
				return "Day";
			case eDurationUnit.MECalendarWeeks:
				return "Week";
			case eDurationUnit.MEMonths:
				return "Month";
			case eDurationUnit.MEQuarterYears:
				return "QuarterYear";
			case eDurationUnit.MEYears:
				return "Year";
		}
	},

	descriptionAtDateWithLocale: function(date,locale)
	{
		return this.descriptionForUnitStyleAtDateWithLocaleForMenu(this.unit, this.style, date, locale, false);
	},

	startOfUnitContainingDateClipAtDate: function(date, clipDate)
	{
		return this.ruler.startOfUnitContainingDateClipAtDateExtendIfTooThin(this.unit, date, clipDate, true);
	},

	endOfUnitWithStartDateClipAtDate: function(date, clipDate)
	{
		return this.ruler.endOfUnitWithStartDateClipAtDateExtendIfTooThin(this.unit, date, clipDate, true);
	},

	dictionaryRepresentation: function()
	{
		var dict = {};
		dict["unit"] = this.unit;
		dict["style"] = this.style;	
		return dict;
	},

	descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu: function(unit,shortness,date,fromEnd,locale,forMenu)
	{
		var unitStartEndDate = null;
		var projectUnitStartEndDate = null;
		if(fromEnd){
			var projectEndDate = this.ruler.project.valueForKey('plannedEndDate');
			if(!projectEndDate)
				projectEndDate = new Date();
			projectUnitStartEndDate = this.ruler.endOfUnitContainingDateClipAtDateExtendIfTooThin(unit, projectEndDate, null, true);
			unitStartEndDate = this.ruler.endOfUnitWithStartDateClipAtDateExtendIfTooThin(unit, date, null, true);
		}else{
			var projectStartDate = this.ruler.project.valueForKey('plannedStartDate');
			if(!projectStartDate)
				projectStartDate = new Date();
			projectUnitStartEndDate = this.ruler.startOfUnitContainingDateClipAtDateExtendIfTooThin(unit, projectStartDate ? projectStartDate : date, null, true);
			unitStartEndDate = this.ruler.startOfUnitContainingDateClipAtDateExtendIfTooThin(unit, date, null, true);
		}
		var format;
		if(shortness==2)
			format = "%d";
		else{
			var unitKey = this.keyForRelativeUnit(unit);
			if(shortness==1){
				var key = unitKey + "Short";
				format = this.environment.localizedString(key) + "%d";
			}
			else
				format = this.environment.localizedString(unitKey) + " %d";
		}
		if(forMenu)
			format += " " + this.environment.localizedString(fromEnd ? "(From End)" : "(From Start)");
		var diff;
		switch(unit){
			case eDurationUnit.MEMinutes:
				diff = unitStartEndDate.timeIntervalSinceDate(projectUnitStartEndDate)/60; break;
			case eDurationUnit.MEHours:
				diff = unitStartEndDate.timeIntervalSinceDate(projectUnitStartEndDate)/3600; break;
			default:
			case eDurationUnit.MEDays:
				diff = unitStartEndDate.timeIntervalSinceDate(projectUnitStartEndDate)/(3600*24); break;
			case eDurationUnit.MECalendarWeeks:
				diff = unitStartEndDate.timeIntervalSinceDate(projectUnitStartEndDate)/(3600*24*7); break;
			case eDurationUnit.MEMonths:
				diff = Date.diff("m", projectUnitStartEndDate, unitStartEndDate, true); break;
			case eDurationUnit.MEQuarterYears:
				diff = Date.diff("m", projectUnitStartEndDate, unitStartEndDate, true)/3; break;
			case eDurationUnit.MEYears:
				diff = Date.diff("m", projectUnitStartEndDate, unitStartEndDate, true)/12; break;
		}

		if(fromEnd)
			diff = -diff;
		if(diff>=0)
			diff++;
		var result = stringWithFormat(format, diff);
		return result;
	},

	descriptionForUnitStyleAtDateWithLocaleForMenu: function(unit, style, date, locale, forMenu)
	{
		var result = null;
		if(unit==eDurationUnit.MEMinutes){
			if(style==0)
				return date.format("m", true);
			else if(style==1)
				result = ""+date.getUTCMinutes();
			else if(style==2 || style==3 || style==4)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-2, date, false, locale, forMenu);
			else if(style==5 || style==6 || style==7)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-5, date, true, locale, forMenu);
		}else if(unit==eDurationUnit.MEHours){
			if(style==0)
				result = date.format(this.environment.format.systemOnlyHourNumberTimeFormat, true);
			else if(style==1)
				result = date.format(this.environment.format.systemOnlyHourTimeFormat, true);
			else if(style==1)
				result = date.format(this.environment.format.systemTimeFormatFixedHours, true);
			else if(style==2)
				result = date.format(this.environment.format.systemShortDateFormat+" "+this.environment.format.systemOnlyHourTimeFormat, true);
			else if(style==3)
				result = date.format(this.environment.format.systemShortDateFormat+" "+this.environment.format.systemTimeFormatFixedHours, true);
			else if(style==4)
				result = date.format(this.environment.format.systemShortDateFormatWithWeekday+" "+this.environment.format.systemTimeFormatFixedHours, true);			
			else if(style==5)
				result = date.format(this.environment.format.systemDateFormatWithoutWeekday+" "+this.environment.format.systemTimeFormatFixedHours, true);			
			else if(style==6)
				result = date.format(this.environment.format.systemDateFormat+" "+this.environment.format.systemTimeFormatFixedHours, true);			
			else if(style==7 || style==8 || style==9)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-7, date, false, locale, forMenu);
			else if(style==10 || style==11 || style==12)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-10, date, true, locale, forMenu);		
		}else if(unit==eDurationUnit.MEDays){
			switch(style){
				default:
				case 0:
					result = date.format("d", true); break;
				case 1:
					result = date.format("E", true); break;			
				case 2:
					result = date.format("d (E)", true); break;			
				case 3:
					result = date.format(this.environment.format.systemShortDateFormatWithoutYear, true); break;			
				case 4:
					result = date.format(this.environment.format.systemShortDateFormat, true); break;			
				case 5:
					result = date.format(this.environment.format.systemShortDateFormatWithWeekday, true); break;			
				case 6:
					result = date.format(this.environment.format.systemDateFormatWithoutYearAndWeekday, true); break;			
				case 7:
					result = date.format(this.environment.format.systemDateFormatWithoutWeekday, true); break;			
				case 8:
					result = date.format(this.environment.format.systemDateFormat, true); break;			
				case 9:
				case 10:
				case 11:
					result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-9, date, false, locale, forMenu); break;
				case 12:
				case 13:
				case 14:
					result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-12, date, true, locale, forMenu); break;
			}
		}else if(unit==eDurationUnit.MECalendarWeeks){
			var week = date.getCalendarWeekUTC(this.environment);
			var weekStart = Date.startOfCalendarWeekInYear(week, date.getUTCFullYear(), true, this.environment);
			var dateRepresentingWeek = new Date(weekStart.getTime());
			dateRepresentingWeek.add("d", 3, true);	//ak false vor dem true entfernt
			var cwString = this.environment.calendarWeekString;		
			if(style==0)
				result = "" + cwString +" "+ week;
			else if(style==1)
				result = cwString + " " + week + " " + date.getUTCFullYear();
			else if(style==2)
				result = cwString + " " + week + ", " + weekStart.format(this.environment.format.systemShortDateFormatWithoutYear, true);
			else if(style==3)
				result = cwString + " " + week + ", " + weekStart.format(this.environment.format.systemShortDateFormat, true);
			else if(style==4)
				result = cwString + " " + week + ", " + weekStart.format(this.environment.format.systemDateFormatWithoutYearAndWeekday, true);
			else if(style==5)
				result = cwString + " " + week + ", " + dateRepresentingWeek.format("MMM yyyy", true);
			else if(style==6)
				result = cwString + " " + week + ", " + weekStart.format(this.environment.format.systemDateFormatWithoutWeekday, true);
			else if(style==7)
				result = weekStart.format(this.environment.format.systemShortDateFormatWithoutYear, true);
			else if(style==8)
				result = weekStart.format(this.environment.format.systemShortDateFormat, true);
			else if(style==9)
				result = weekStart.format(this.environment.format.systemDateFormatWithoutYearAndWeekday, true);
			else if(style==10)
				result = weekStart.format(this.environment.format.systemDateFormatWithoutWeekday, true);
			else if(style==11 || style==12 || style==13)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-11, date, false, locale, forMenu);
			else if(style==14 || style==15 || style==16)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-14, date, true, locale, forMenu);
			else if(style==17)
				result = "" + cwString +" "+ week + ", " + weekStart.format("dd");
			else if(style==18)
				result = "" + weekStart.format("dd");	
		}else if(unit==eDurationUnit.MEMonths){
			if(style==0)
				result = date.format("MM", true);
			else if(style==1)
				result = date.format("MM/yyyy", true);
			else if(style==2)
				result = date.format("MMM", true);
			else if(style==3)
				result = date.format("MMM yy", true);
			else if(style==4)
				result = date.format("MMM yyyy", true);
			else if(style==5 || style==6 || style==7)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-5, date, false, locale, forMenu);
			else if(style==8 || style==9 || style==10)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-8, date, true, locale, forMenu);
		}else if(unit==eDurationUnit.MEQuarterYears){
			var quarter = Math.floor((date.getUTCMonth()+3)/3);
			var quarterKey = "Q"+quarter;
			if(style==0)
				result = this.environment.localizedString(quarterKey);			
			else if(style==1)
				result = this.environment.localizedString(quarterKey) + " / " + date.getUTCFullYear();
			else if(style==2 || style==3 || style==4)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-2, date, false, locale, forMenu);
			else if(style==5 || style==6 || style==7)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-5, date, true, locale, forMenu);
		}else if(unit==eDurationUnit.MEYears){
			if(style==0)
				result = ""+date.getUTCFullYear();
			else if(style==1 || style==2 || style==3)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-1, date, false, locale, forMenu);
			else if(style==4 || style==5 || style==6)
				result = this.descriptionForRelativeUnitShortnessAtDateFromEndWithLocaleForMenu(unit, style-4, date, true, locale, forMenu);
		}
		return result;
	},
	
	unitStartDatesBetweenStartDateAndEndDate: function(start, end)
	{		
		result = [];
		if(start && end){
			var startDate = new Date(Math.max(start.getTime(), this.ruler.startDate.getTime()));
			var endDate = new Date(Math.min(end.getTime(), this.ruler.endDate.getTime()));			
			var unitStart = this.startOfUnitContainingDateClipAtDate(startDate, this.ruler.startDate);
			while(unitStart.getTime() < endDate.getTime()){
				result.push(unitStart);
				unitStart = this.endOfUnitWithStartDateClipAtDate(unitStart, this.ruler.endDate);
			}	
		}
		return result;
	}
	
	

},
	// Class Interface:
{
	rowFromDictionary: function(dict)
	{
		var row = new GanttRulerRow();
		row.setUnit(dict["unit"]);
		row.setStyle(dict["style"]);
		return row;
	},

	oneUnitBiggerThanUnit: function(unit)
	{
		if(unit == eDurationUnit.MEMinutes)
			return eDurationUnit.MEHours;
		else if(unit == eDurationUnit.MEHours)
			return eDurationUnit.MEDays;
		else if(unit == eDurationUnit.MEDays)
			return eDurationUnit.MECalendarWeeks;
		else if(unit == eDurationUnit.MECalendarWeeks)
			return eDurationUnit.MEMonths;
		else if(unit == eDurationUnit.MEMonths)
			return eDurationUnit.MEQuarterYears;
		else
			return eDurationUnit.MEYears;
	},

	oneUnitSmallerThanUnit: function(unit)
	{
		if(unit == eDurationUnit.MEYears)
			return eDurationUnit.MEQuarterYears;
		else if(unit == eDurationUnit.MEQuarterYears)
			return eDurationUnit.MEMonths;
		else if(unit == eDurationUnit.MEMonths)
			return eDurationUnit.MECalendarWeeks;
		else
			return eDurationUnit.MEDays;
	},

	oneUnitSmallerThanUnitIncludingTimes: function(unit)
	{
		if(unit == eDurationUnit.MEYears)
			return eDurationUnit.MEQuarterYears;
		else if(unit == eDurationUnit.MEQuarterYears)
			return eDurationUnit.MEMonths;
		else if(unit == eDurationUnit.MEMonths)
			return eDurationUnit.MECalendarWeeks;
		else if(unit == eDurationUnit.MECalendarWeeks)
			return eDurationUnit.MEDays;
		else if(unit == eDurationUnit.MEDays)
			return eDurationUnit.MEHours;
		else if(unit == eDurationUnit.MEHours)
			return eDurationUnit.MEMinutes;
		else
			return eDurationUnit.MESeconds;
	}
	

});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("GanttRuler.js");

var eGanttRulerMode;
if(!eGanttRulerMode) eGanttRulerMode = {
	PlannedAndExpected: 0,
	OnlyPlanned: 1,
	OnlyExpected: 2
}

var GanttRuler = Base.extend({
	constructor: function(rulerDescription, environment, project) {
		this.project = project;
		this.environment = environment;
		this.zoom_factor = 1.25;
		this.defaultStartTime = 8.0;	
		this.defaultEndTime = 17.0;
		this.pixelsPerDay;
		this.rows = [];
		this.startDate = null;
		this.startDateAT;
		this.endDate;	
		this.adjustedStartDate;
		this.adjustedEndDate;
		this.adjustOnlyByExpanding;
		this.ganttRuleMode = eGanttRulerMode.OnlyPlanned;
		this.primaryUnit = eDurationUnit.MEDays;
		this.oldPrimary = this.primaryUnit;
		this.ganttMargin = 0;
		this.limitingActivities = [];
		this.mode = eGanttRulerMode.OnlyExpected;
		if(rulerDescription != null)
			this.createRowsFromDescription(rulerDescription);
		else
			this.createStandardRows();
	},
	
	clone: function(){
		var ruler = new GanttRuler(this.rulerDescription(), this.environment);
	    ruler.project = this.project;						 
		return ruler;
	},
	
	setLimitingActivities: function(activities) {
		this.limitingActivities = activities;
		this.updateStartDate();
		this.updateEndDate();
	},
	
	adjustFromDateToDateOnlyByExpanding: function(start, end, byExpanding) {
		this.adjustOnlyByExpanding = byExpanding;
		if(!this.startDate.isEqual(this._startDateWithAdjustment(start)) || !this.endDate.isEqual(this._endDateWithAdjustment(end))){
			this.adjustedStartDate = new Date(start.getTime());
			this.adjustedEndDate   = new Date(end.getTime());
			this.updateStartDate();
			this.updateEndDate();
			return true;
		}
		return false;
	},

	createStandardRows: function() {
		var description = [{unit:eDurationUnit.MEDays, style:0}, {unit:eDurationUnit.MECalendarWeeks, style:5}];
		this.createRowsFromDescription( { rows: description, pixelsPerDay: 30 });
	},

	createRowsFromDescription: function(description) {
		this.rows = [];
		var rowDescription = description["rows"];
		for(var i=0; i<rowDescription.length; i++){
			this.addRowWithUnitStyle(rowDescription[i]["unit"], rowDescription[i]["style"]);
		}
		this.updatePixelsPerDay();
		this.setPixelsPerDay(description["pixelsPerDay"]);
	},

	rulerDescription: function() {
		var result = {};
		result.rows = [];
		for(var i=0; i<this.rows.length; i++){
			result.rows[i]={unit:this.rows[i].unit, style:this.rows[i].style};
		}			
		result.pixelsPerDay = this.pixelsPerDay;
		return result;	
	},

	addRowWithUnitStyle: function(unit, style) {
		return this.addRowWithUnitStyleWithOrder(unit, style, this.rows.length);
	},

	addRowWithUnitStyleWithOrder: function(unit, style, order) {
		var row = new GanttRulerRow(this, this.environment);
		this.rows.splice(order, 0, row);
		row.setUnit(unit);
		row.setStyle(style);
		this.setPrimaryUnit(this.primaryRow().unit);
		this.updateModificationDate();
		return row;
	},

	rows: function() {
		return this.rows;
	},

	setPrimaryUnit: function(value)	{
		this.setPrimaryUnitAdjustOtherUnits(value, false);
	},

	setPrimaryUnitAdjustOtherUnits: function(unit, adjust) {
		var numRows = this.rows.length;
		if(adjust){
			this.oldPrimary = this.primaryUnit;
			if(unit < this.oldPrimary){
				for(var rowIndex=1; rowIndex<numRows; rowIndex++){
					var row = this.rows[rowIndex];
					row.setUnit(GanttRulerRow.oneUnitSmallerThanUnitIncludingTimes(row.unit));
				}
			}else if(unit > this.oldPrimary){
				for(var rowIndex=1; rowIndex<numRows; rowIndex++){
					var row = this.rows[rowIndex];
					row.setUnit(GanttRulerRow.oneUnitBiggerThanUnit(row.unit));
				}
			}
		}
		if(numRows){
			var row = this.rows[0];
			if(row.unit!=unit)
				row.setUnit(unit);
		}
		this.primaryUnit = unit;
		this.updateStartDate();
		this.updateEndDate();
	},

	setEndDate: function(value)	{
		var changed = (!value && this.endDate) || (!this.endDate && value) || (value && !value.isEqual(this.endDate));
		this.endDate = value;
		if(changed)
			this.updateModificationDate();
	},

	setStartDate: function(value) {
		var changed = (!value && this.startDate) || (!this.startDate && value) || (value && !value.isEqual(this.startDate));
		this.startDate = new Date(value.getTime());
		if(changed)
			this.updateModificationDate();
	},

	setStartDateAT: function(value)	{
		this.startDateAT = value;
	},

	updateModificationDate: function() {
		this.modificationDate = new Date();
	},

	maxDateWithNameInActivities: function(name, activities)	{
		var maxDate = null;
		if(activities){
			for(var i=0; i<activities.length; i++){
				var date = activities[i].valueForKey(name);
				if(date){
					date = new Date(date.getTime());
					if(!maxDate || date.getTime()>maxDate.getTime())
						maxDate = date;
				}
			}
		}
		if(!maxDate)
			maxDate = new Date();
		return maxDate;
	},

	_endDateWithAdjustment: function(adjustment) {
		var result = null;
		if(this.givenEndDate)
			result = new Date(this.givenEndDate.getTime());
		else{
			if(this.mode == eGanttRulerMode.OnlyPlanned)
				result = this.maxDateWithNameInActivities("plannedEndDate", this.limitingActivities);
			else if(this.mode == eGanttRulerMode.OnlyExpected)
				result = this.maxDateWithNameInActivities("expectedEndDate", this.limitingActivities);
			else{
				var maxPlanned = this.maxDateWithNameInActivities("plannedEndDate", this.limitingActivities);
				var maxExpected = this.maxDateWithNameInActivities("expectedEndDate", this.limitingActivities);
				result = maxPlanned.getTime()>maxExpected.getTime() ? maxPlanned : maxExpected;
			}
		}
		
		if(!result)
			result = new Date();
		if(adjustment && (!this.adjustOnlyByExpanding || (result.getTime() < adjustment.getTime())))
			result = adjustment;	
		var primaryRow = this.primaryRow();
		if(primaryRow){
			var start = primaryRow.startOfUnitContainingDateClipAtDate(result, null);
			result = primaryRow.endOfUnitWithStartDateClipAtDate(start, null);
		}
		return result;
	},

	_endDate: function() {
		return this._endDateWithAdjustment(this.adjustedEndDate);
	},


	updateEndDate: function() {
		this.setEndDate(this._endDate());
	},

	minDateWithNameInActivities: function(name, activities)	{
		var minDate = null;
		if(activities){
			for(var i=0; i<activities.length; i++){
				var date = activities[i].valueForKey(name);
				if(date){
					date = new Date(date.getTime());
					if(!minDate || date.getTime()<minDate.getTime())
						minDate = date;
				}
			}
		}
		if(!minDate)
			minDate = new Date();
		return minDate;
	},

	_startDateWithAdjustment: function(adjustment) {
		var result = null;
		if(this.givenStartDate)
			result = new Date(this.givenStartDate.getTime());
		else{
			if(this.mode == eGanttRulerMode.OnlyPlanned)
				result = this.minDateWithNameInActivities("plannedStartDate", this.limitingActivities);
			else if(this.mode == eGanttRulerMode.OnlyExpected)
				result = this.minDateWithNameInActivities("expectedStartDate", this.limitingActivities);
			else{
				var minPlanned = this.minDateWithNameInActivities("plannedStartDate", this.limitingActivities);
				var minExpected = this.minDateWithNameInActivities("expectedStartDate", this.limitingActivities);
				result = minPlanned.getTime()>minExpected.getTime() ? minPlanned : minExpected;
			}
		}
		if(!result)
			result = new Date();
		if(adjustment && (!this.adjustOnlyByExpanding || (result.getTime() > adjustment.getTime())))
			result = adjustment;	
		var primaryRow = this.primaryRow();
		if(primaryRow)
			result = primaryRow.startOfUnitContainingDateClipAtDate(result, null);
		return result;
	},


	_startDate: function() {
		return this._startDateWithAdjustment(this.adjustedStartDate);
	},

	updateStartDate: function()	{
		var newDate = this._startDate();
		this.setStartDate(newDate);
		this.setStartDateAT(newDate.getTime()/1000);
	},

	primaryRow: function() {
		return this.rows.length ? this.rows[0] : null;
	},

	primaryUnitForPixelsPerDay: function(pixels) {
		var unit = this.primaryUnit;
		var newUnit = unit;
		if(unit==eDurationUnit.MEMinutes){
			if(pixels<1600.0)
				newUnit = eDurationUnit.MEHours;
		}else if(unit==eDurationUnit.MEHours){
			if(pixels<100.0)
				newUnit = eDurationUnit.MEDays;
			else if(pixels>=1600.0)
				newUnit = eDurationUnit.MEMinutes;
		}else if(unit==eDurationUnit.MEDays){
			if(pixels<16.0)
				newUnit = eDurationUnit.MECalendarWeeks;
			else if(pixels>=100.0)
				newUnit = eDurationUnit.MEHours;
		}else if(unit==eDurationUnit.MECalendarWeeks){
			if(pixels<5.0)
				newUnit = eDurationUnit.MEMonths;
			else if(pixels>=16.0)
				newUnit = eDurationUnit.MEDays;
		}else if(unit==eDurationUnit.MEMonths){
			if(pixels<0.8)
				newUnit = eDurationUnit.MEQuarterYears;
			else if(pixels>=5.0)
				newUnit = eDurationUnit.MECalendarWeeks;
		}else if(unit==eDurationUnit.MEQuarterYears){
			if(pixels<30.0/(3.0*28.0))
				newUnit = eDurationUnit.MEYears;
			else if(pixels>=0.8)
				newUnit = eDurationUnit.MEMonths;
		}else if(unit==eDurationUnit.MEYears){
			if(pixels>=30.0/(3.0*28.0))
				newUnit = eDurationUnit.MEQuarterYears;
		}
		return newUnit;
	},

	setPixelsPerDay: function(pixels) {
		this.setPrimaryUnitAdjustOtherUnits(this.primaryUnitForPixelsPerDay(pixels), true);
		this.pixelsPerDay = pixels;
	},
	
	updatePixelsPerDay: function() {
		var pixels = GanttRuler.defaultPixelsPerDayForUnit(this.primaryUnit);
		this.setPixelsPerDay(pixels);
	},

	setGanttMargin: function(margin) {
		this.ganttMargin = margin;
	},

	dateToPosRoundClipWorkTime: function(date, round, clip)	{
		var diffSeconds = date ? (date.getTime()/1000.0) - this.startDateAT : this.startDateAT;
		var diffDays = Math.floor(diffSeconds/(3600.0*24.0));
		diffSeconds -= diffDays*3600.0*24.0;
		var dateHour = diffSeconds/3600.0;
		var defaultEndHour = this.defaultEndTime;
		var defaultStartHour = this.defaultStartTime;
		var defaultDayGrossHours = defaultEndHour - defaultStartHour;
		var negative = diffDays<0.0 || diffSeconds<0.0;
		var afterWorkEnd = negative ? clip && 24.0+dateHour >= defaultEndHour : clip && dateHour >= defaultEndHour;
		var beforeWorkStart = negative ? clip && 24.0+dateHour <= defaultStartHour : clip && dateHour <= defaultStartHour;

		if(afterWorkEnd && !negative)
			diffDays ++;
		else if(beforeWorkStart && negative)
			diffDays --;
		var pos = this.ganttMargin + diffDays*this.pixelsPerDay;
		if(!afterWorkEnd && !beforeWorkStart) {
			var dayHours = clip ? defaultDayGrossHours : 24.0;
			var pixelsPerHour = this.pixelsPerDay / dayHours;
			var hours;		
			if(clip)
				hours = negative ? dateHour - defaultEndHour : dateHour - defaultStartHour;
			else
				hours = negative ? 24.0 - dateHour :  dateHour;
			pos += pixelsPerHour * hours;
		}
		if(round)
			pos = Math.floor(pos);		
		return pos;
	},

	dateToPos: function(date) {
		if(!date)
			return 0;
		return this.dateToPosRoundClipWorkTime(date, true, this.primaryUnit!=eDurationUnit.MEHours && this.primaryUnit!=eDurationUnit.MEMinutes);
	},

	dateToPosRound: function(date, round) {
		return this.dateToPosRoundClipWorkTime(date, round, this.primaryUnit!=eDurationUnit.MEHours && this.primaryUnit!=eDurationUnit.MEMinutes);
	},

	posToDatePreferEndDateClipWorkTime: function(pos, preferEndDate,clip) {
		var defaultEndHour = this.defaultEndTime;
		var defaultStartHour = this.defaultStartTime;
		var defaultDayGrossHours = defaultEndHour - defaultStartHour;
		var defaultStartSeconds = defaultStartHour * 3600.0;
		var defaultEndSeconds = defaultEndHour * 3600.0;
		pos -= this.ganttMargin;
		var days = Math.floor(pos/this.pixelsPerDay);
		if(clip && this.primaryUnit==eDurationUnit.MEHours)
			clip = false;
		var dayHours = clip ? defaultDayGrossHours : 24.0;
		var pixelsPerSecond = this.pixelsPerDay / dayHours / 3600.0;
		var seconds = (pos-days*this.pixelsPerDay) / pixelsPerSecond;
		if(clip){
			if(seconds>0)
				seconds += defaultStartSeconds;
			else if(seconds<0){
				days--;
				seconds += defaultEndSeconds;
			}else if(preferEndDate){
				seconds = defaultEndSeconds;
				days--;
			}else
				seconds = defaultStartSeconds;
		}
		if(this.primaryUnit!=eDurationUnit.MEMinutes){
			var minuteModulo = seconds % 60;
			if(minuteModulo){
				if(minuteModulo>30)
					seconds += 60-minuteModulo;
				else 
					seconds -= minuteModulo;
			}
		}
		return new Date((this.startDateAT + 3600.0*24.0*days + seconds)*1000.0);
	},

	posToDate: function(pos) {
		return this.posToDatePreferEndDateClipWorkTime(pos, false, this.primaryUnit!=eDurationUnit.MEHours && this.primaryUnit!=eDurationUnit.MEMinutes);
	},

	posToDatePreferEndDate: function(pos, preferEndDate) {
		return this.posToDatePreferEndDateClipWorkTime(pos, preferEndDate, this.primaryUnit!=eDurationUnit.MEHours && this.primaryUnit!=eDurationUnit.MEMinutes);
	},

	startOfUnitContainingDateClipAtDateExtendIfTooThin: function(unit, aDate, clipDate, extend) {
		var date = new Date(aDate.getTime());
		var start = null;
		date.setUTCSeconds(0,0);
		if(unit==eDurationUnit.MEMinutes){
			var minute = date.getUTCMinutes();
			if(extend){
				var widthOfUnit = this.pixelsPerDay/(24.0*60.0);
				var minWidth = 18.0;
				var numUnits = widthOfUnit<minWidth ? Math.ceil(minWidth / widthOfUnit) : 1;
				if(numUnits>10)
					numUnits = 15;
				else if(numUnits>5)
					numUnits = 10;
				else if(numUnits>1)
					numUnits = 5;
				else
					numUnits = 1;
				minute = Math.floor(minute / numUnits) * numUnits;
			}
			date.setUTCMinutes(minute);
			start = date;
		}else if(unit==eDurationUnit.MEHours){
			var hour = Math.floor(date.getUTCHours());
			if(extend){
				var widthOfUnit = this.pixelsPerDay/24.0;
				var minWidth = 18.0;
				var numUnits = widthOfUnit<minWidth ? Math.ceil(minWidth / widthOfUnit) : 1;
				if(numUnits>4)
					numUnits = 4;
				hour = Math.floor(hour / numUnits) * numUnits;
			}
			date.setUTCHours(hour);
			date.setUTCMinutes(0);
			start = date;
		}else if(unit==eDurationUnit.MEDays){
			date.setUTCHours(0);
			date.setUTCMinutes(0);
			start = date;
		}else if(unit==eDurationUnit.MECalendarWeeks){
			var year = date.getUTCFullYear();
			var cw = date.getCalendarWeekUTC(this.environment);
			if(cw == 1 && date.getUTCMonth() == 11)
				year++;
			else if(cw >= 50 && date.getUTCMonth() == 0)
				year--;
			start = Date.startOfCalendarWeekInYear(cw, year, true, this.environment);
		}
		else if(unit==eDurationUnit.MEMonths){
			date.setUTCDate(1);	//ak utc
			date.setUTCHours(0);
			date.setUTCMinutes(0);
			start = date;
		}else if(unit==eDurationUnit.MEQuarterYears){
			var date2 = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()));
			var quarterStartMonth = Math.floor(date2.getUTCMonth()/3)*3;
			date2.setUTCMonth(quarterStartMonth);	//ak utc
			date2.setUTCDate(1);	//ak utc
			date2.setUTCHours(0);
			date2.setUTCMinutes(0);
			start = date2;
		}else if(unit==eDurationUnit.MEYears){
			date.setUTCMonth(0);	//ak utc
			date.setUTCDate(1);		//ak utc
			date.setUTCHours(0);
			date.setUTCMinutes(0);
			start = date;
		}if(clipDate){	
			if(start.getTime() < clipDate.getTime())
				start = clipDate;
		}
		return start;
	},

	endOfUnitWithStartDateClipAtDateExtendIfTooThin: function(unit, date, clipDate, extend) {
		var end = null;	
		if(unit==eDurationUnit.MEMinutes){
			var numMinutes;
			if(extend){
				var widthOfUnit = this.pixelsPerDay/(24.0*60.0);
				var minWidth = 18.0;
				numMinutes = widthOfUnit<minWidth ? Math.ceil(minWidth / widthOfUnit) : 1;
				if(numMinutes>10)
					numMinutes = 15;
				else if(numMinutes>5)
					numMinutes = 10;
				else if(numMinutes>1)
					numMinutes = 5;
				else
					numMinutes = 1;
			}else
				numMinutes = 1;
			end = Date.add("n", numMinutes, date, true);
		}else if(unit==eDurationUnit.MEHours){
			var numHours;
			if(extend){
				var widthOfUnit = this.pixelsPerDay/24.0;
				var minWidth = 18.0;
				numHours = widthOfUnit<minWidth ? Math.ceil(minWidth / widthOfUnit) : 1;
				if(numHours>4)
					numHours = 4;
			}
			else
				numHours = 1;
			end = Date.add("h", numHours, date, true);
			end.setUTCMinutes(0);	//ak
			end.setUTCSeconds(0);
		}else if(unit==eDurationUnit.MEDays){
			end = date.nextDay(true);
			end.setUTCHours(0);		//ak
			end.setUTCMinutes(0);
			end.setUTCSeconds(0);
		}else if(unit==eDurationUnit.MECalendarWeeks){
			var cw = date.getCalendarWeekUTC(this.environment);
			var year = date.getUTCFullYear();
			if(cw == 1 && date.getUTCMonth() == 11)
				year++;
			var weekStart = Date.startOfCalendarWeekInYear(cw, year, true, this.environment);
			end = Date.add("d", 7, weekStart, true);
		}else if(unit==eDurationUnit.MEMonths){
			var monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
			end = Date.add("m", 1, monthStart, true);
		}else if(unit==eDurationUnit.MEQuarterYears){
			var comps = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()));
			var quarterStartMonth =  Math.floor(comps.getUTCMonth()/3)*3;
			comps.setUTCMonth(quarterStartMonth);
			comps.setUTCDate(1);
			end = Date.add("m", 3, comps, true);
		}else if(unit==eDurationUnit.MEYears){
			var comps = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
			comps.setUTCFullYear(comps.getUTCFullYear()+1);
			end = comps;
		}
		if(clipDate){
			if(end.getTime() > clipDate.getTime())
				end = new Date(clipDate.getTime());
		}	
		return end;
	},

	endOfUnitContainingDateClipAtDateExtendIfTooThin: function(unit, date, clipDate, extend) {
		var start = this.startOfUnitContainingDateClipAtDateExtendIfTooThin(unit, date, clipDate, extend);
		if(start.isEqual(date))
			return start;
		return this.endOfUnitWithStartDateClipAtDateExtendIfTooThin(unit, start, clipDate, extend);
	},

	roundPosToUnitWithParts: function(pos, unit, parts)	{
		// Auf den n-ten Teil einer Einheit runden
		var posDate = this.posToDate(pos);
		var extend = this.primaryUnit<=unit;
		var start = this.startOfUnitContainingDateClipAtDateExtendIfTooThin(unit, posDate, null, extend);
		var end = this.endOfUnitWithStartDateClipAtDateExtendIfTooThin(unit, start, null, extend);
		var startPos = this.dateToPosRound(start, false);
		var endPos = this.dateToPosRound(end, false);	
		var deltaPart = (endPos-startPos) / parts;
		var partNum = Math.round((pos - startPos) / deltaPart);
		return startPos + deltaPart * partNum;
	},

	rowsCode: function() {
		var sum = 0;
		for(var i = 0; i<this.rows.length; i++){
			sum += this.rows[i].rowCode();
		}	
		return sum;
	},

	zoomIn: function() {
		var newPixelsPerDay = this.pixelsPerDay*this.zoom_factor;
		this.setPixelsPerDay(newPixelsPerDay);	
	},

	zoomOut: function()	{
		var newPixelsPerDay = this.pixelsPerDay/this.zoom_factor;
		this.setPixelsPerDay(newPixelsPerDay);	
	},

	setGivenStartDate: function(date) {
		this.givenStartDate = new Date(date.getTime());
		this.updateStartDate();
		this.updateEndDate();
	},

	setGivenEndDate: function(date)	{
		this.givenEndDate = new Date(date.getTime());
		this.updateStartDate();
		this.updateEndDate();
	},
	
	numberOfRulerUnits: function(){
		var result = 0;
		var start = this.startDate;
		var endTime = this.endDate.getTime();
		while(start.getTime() <  endTime){
			start =	this.endOfUnitWithStartDateClipAtDateExtendIfTooThin(this.primaryUnit, start, null, true);
			result ++;
		}
		return result;
	}
	
	
}, 
	// Class Interface:
{
	defaultPixelsPerDayForUnit: function(unit) { 		
		var pixels = 30.0;
		if(unit == eDurationUnit.MEMinutes)
			pixels = 1700.0;
		else if(unit == eDurationUnit.MEHours)
			pixels = 160.0;
		else if(unit == eDurationUnit.MEDays)
			pixels = 24.0;
		else if(unit == eDurationUnit.MECalendarWeeks)
			pixels = 6.0;
		else if(unit == eDurationUnit.MEMonths)
			pixels = 2.0;
		else if(unit == eDurationUnit.MEQuarterYears)
			pixels = 1.2*30.0/(3.0*28.0);
		else if(unit == eDurationUnit.MEYears)
			pixels = 30.0/365.0;
		return pixels;
	}
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("GanttRulerView.js");

var GanttRulerView = Base.extend({
	constructor: function(ganttView, container, ruler, environment)
	{
		this.environment = environment;
		this.ganttScrollView = ganttView;
		this.container = container;
		this.ruler = ruler;
		this.rulerRowsHeight = 0;
		this.lastRowsCode = 0;	
		this.refreshRuler();
		this.tableWidth = 0;
        this.lastStatusDateTime = 0;
	},

    projectStatusDateTime: function()
    {
		var project = this.ruler.project;
  	    if(project){
            var statusDate = project.valueForKey('statusDate');
            return statusDate ? statusDate.getTime() : 0;
		}
		return 0;
    },

	refreshRuler: function()
	{	
		this.rulerRowsHeight = this.ruler.rows.length * this.rulerRowHeight();
		var rowsCode = this.ruler.rowsCode();
        
		if(rowsCode && (this.lastRowsCode != rowsCode || this.lastStatusDateTime != this.projectStatusDateTime()) && this.ruler) {			
			this.tableWidth = this.ruler.dateToPos(this.ruler.endDate);
			while(this.container.lastChild)
				this.container.removeChild(this.container.lastChild);			
			this.tables = [];
			var bottom = 0;
			var height = this.rulerRowHeight();
			for(var rowIndex=0; rowIndex<this.ruler.rows.length; rowIndex++){		
				var table = $(document.createElement("div"));
				table.style.position = "absolute";
				table.style.overflowX = "visible";
				table.style.width = "1px";
				table.style.height = height+"px";
				table.style.left = "0px";
				if(rowIndex != 0)
					bottom+=1;
				table.style.bottom = bottom+"px";
				table.rulerRow = this.ruler.rows[rowIndex];
				table.rowIndex = rowIndex;
				table.cells = [];
				bottom+=height;
				this.tables.push(table);
				this.container.appendChild(table);
			}
			this.gradientContainer = this.inPrintWindow ? null : PWUtils.drawHeaderGradient(this.container, this.environment.images.grayGradient);
			this.drawRulerFromStartDateToEndDate(this.ganttScrollView.visibleStartDate, this.ganttScrollView.visibleEndDate);
			this.ganttScrollView.rulerChanged(); // Hot Spot
		}	
	},
	
	drawCell: function(table, left, width, height, text, highlight)
	{
		var cell = $(document.createElement("div"));
		cell.style.position = "absolute";
		cell.style.borderRight = "1px solid #aaaaaa";
		cell.style.borderBottom = "1px solid #aaaaaa";
		cell.style.color = "#000000";
		cell.style.textAlign = "center";
		cell.style.overflow = "hidden";
		cell.style.whiteSpace ="nowrap";
		cell.style.padding= "0px";
		cell.style.margin = "0px";
		cell.style.top = '0px';
		cell.style.left = left +'px';
		cell.style.width = Math.max(width, 0) +'px';
		cell.style.height = (height - (table.rowIndex == 0 ? 1 : 0)) +'px';
        if(highlight)
        {
            var highlightCell = $(document.createElement("div"));
            highlightCell.style.backgroundColor = "#D3DFF5";            
            highlightCell.style.position = "absolute";
            highlightCell.style.top = "0px";
            highlightCell.style.left = "1px";
            highlightCell.style.width = Math.max(width-1, 0) +'px';
            highlightCell.style.height = (height - (table.rowIndex == 0 ? 1 : 0)) +'px';
            cell.appendChild(highlightCell);    
        }
		var text = SPAN({style:'left:3px;top:0px;height:'+height+'px;width:'+(width-6)+'px; overflow:hidden; position:absolute;'}, document.createTextNode(text));		
		cell.appendChild(text);
		table.appendChild(cell);	
	},
	
	drawTableContentFromStartDateToEndDate: function(table, start, end, highlightStatusDate)
	{		
		if(start && end){
			var row = table.rulerRow;
			var startTime = Math.max(start.getTime(), this.ruler.startDate.getTime());
			var endTime = Math.min(end.getTime(), this.ruler.endDate.getTime());
			var startDate = new Date(startTime);
			var endDate = new Date(endTime);	
			var unitStart = row.startOfUnitContainingDateClipAtDate(startDate, this.ruler.startDate);
			var height = this.rulerRowHeight();
			var width;
			var lastStartTime;
            var statusDateTime = this.projectStatusDateTime();
            this.lastStatusDateTime = statusDateTime;
            
			while(unitStart.getTime() < endDate.getTime()){
				var unitEnd = row.endOfUnitWithStartDateClipAtDate(unitStart, this.ruler.endDate);
				var unitStartX = this.ruler.dateToPos(unitStart);
				var unitEndX = this.ruler.dateToPos(unitEnd);
				var text = table.rulerRow.descriptionAtDateWithLocale(unitStart, null);
				width = unitEndX - unitStartX;
				if(width<0)
					width = 0;				
				var key = unitStartX;
				if(!table.cells[key]){
					table.cells[key] = 1;
                    var highlight = highlightStatusDate && statusDateTime && statusDateTime >= unitStart.getTime() && statusDateTime <= unitEnd.getTime()
					this.drawCell(table, unitStartX, width, height, text, highlight);
				}
				unitStart = unitEnd;
				var time = unitStart.getTime();
				if(time == lastStartTime)
					break;
				lastStartTime = time;
			}	
		}
	},
	
	drawRulerFromStartDateToEndDate: function(startDate, endDate)
	{
		this.rulerRowsHeight = this.ruler.rows.length * this.rulerRowHeight();
		for(var i=0; i<this.tables.length; i++)
			this.drawTableContentFromStartDateToEndDate(this.tables[i], startDate, endDate, i==0);
	},

	visibleWidthChanged: function()
	{
		var newStart = this.ganttScrollView.visibleStartDate;
		var newEnd = this.ganttScrollView.visibleEndDate;
		if(!this.visibleStartDate || !this.visibleEndDate || !this.visibleStartDate.isEqual(newStart) || !this.visibleEndDate.isEqual(newEnd)){
			this.drawRulerFromStartDateToEndDate(newStart, newEnd);
			this.visibleStartDate = newStart;
			this.visibleEndDate = newEnd;
		}
	},

	setRuler: function(newRuler)
	{
		ruler = newRuler;
		if(ruler)
			this.refreshRuler();
	},

	rulerRowHeight: function() 
	{
		return 18;
	},

	heightOfAllRows: function()
	{
		return this.rulerRowsHeight;
	},
	
	refreshBackground: function()
	{
		if(this.gradientContainer)
			this.gradientContainer.style.width = Math.max(this.width(), this.container.cachedOffsetWidth) + "px";	
	},

	width: function()
	{
		return this.tableWidth;
	}
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("GanttScrollView.js");

var disableGantt = true;

var GanttScrollView = Base.extend({
	constructor: function(ganttContainer, outlineView, enableInteraction, ruler, environment, delegate){
		this.delegate = delegate;
		this.environment = environment;
		this.ruler = ruler;
		this.gantt = ganttContainer;
		this.outlineView = outlineView;
		this.drawShadows = !this.outlineView.showPrintView;
		this.enableInteraction = enableInteraction;
		this.dependendView = outlineView;
		this.hasFillView = false;	
		this.createGanttAndRulerView();
		var me = this;
		setTimeout(function(){
			me.containerSizeChanged();
		}, 200);
	},
	
	project: function(){
		if(this.outlineView.rows && this.outlineView.rows.length)
			return this.outlineView.rows[0];
		return null;
	},

	setStyleList: function(styleList) {
		this.styleList = styleList;
		if(this.ganttView)
			this.ganttView.setStyleList(styleList);
	},
	
	setViewOptions: function(viewOptions) {
		this.viewOptions = viewOptions;
		if(this.ganttView)
			this.ganttView.setViewOptions(viewOptions);
	},

	hasVerticalScrollbar: function() {
		var ganttHeight = this.ganttView.height();
		var containerHeight = this.ganttContainer.cachedOffsetHeight;	// Hot Spot
		var isOverflowYHidden = this.ganttContainer.style.overflowY != "hidden";
		var result = (ganttHeight > containerHeight) && isOverflowYHidden;
		return result;
	},

	hasHorizontalScrollbar: function() {
		return (this.ganttRulerView.width() > this.ganttContainer.cachedOffsetWidth);
	},

	rulerDescription: function() {
		return this.ruler.rulerDescription();;
	},

	rulerHeight: function()	{
		var result = this.ganttRulerView.heightOfAllRows();
		return result;
	},

	createGanttAndRulerView: function()	{
		// Ruler

		this.rulerContainer = $(document.createElement("div"));
		this.rulerContainer.className = "rulerContainer"
		this.rulerContainer.style.overflow = "hidden";
		this.rulerContainer.style.top = "0px";
		this.rulerContainer.style.left = "0px";
		this.rulerContainer.style.right= "0px";
		this.rulerContainer.style.position = "absolute";
		this.gantt.appendChild(this.rulerContainer);	
		this.ganttRulerView = new GanttRulerView(this, this.rulerContainer, this.ruler, this.environment);
		this.ganttRulerView.inPrintWindow = !this.enableInteraction;
		
		// Gantt
		
		this.ganttContainer = $(document.createElement("div"));
		this.ganttContainer.className = "ganttContainer";
		this.ganttContainer.id = "GanttContainer";
		this.ganttContainer.style.top = this.rulerHeight()+"px";
		this.ganttContainer.style.left = "0px";
		this.ganttContainer.style.right= "0px";
		this.ganttContainer.style.bottom= "0px";
		this.ganttContainer.style.position = "absolute";
		this.ganttContainer.cachedScrollLeft = 0;		

		PWUtils.setSelectionEnabled(this.rulerContainer, false);
		PWUtils.setSelectionEnabled(this.ganttContainer, false);

		this.gantt.appendChild(this.ganttContainer);


		if(1){	// Enable GanttView
			if (navigator.appVersion.match(/\bMSIE\b/)){	// IE
				this.ganttView = new GanttVMLView(this, this.ganttContainer, this.ruler, this.environment, this.drawShadows);
			}else
				this.ganttView = new GanttSVGView(this, this.ganttContainer, this.ruler, this.environment, this.drawShadows);
		}
        
//		this.gantt.appendChild(this.ganttContainer);    //huhu
        
            
                	
		this.setEnableScrollBars(true)
		if(this.enableInteraction) {
			this.doscrollEventListener = this.doscroll.bindAsEventListener(this);
			PWUtils.observe(this.ganttContainer, "scroll", this.doscrollEventListener, true);		
		}
		this.outlineView.setDependendView(this);		
		
		this.outlineView.setHeaderHeight(this.rulerHeight());
		if(this.ganttView)
			this.ganttView.blockRefresh = 1;
		this.containerSizeChanged();	
		this.rulerChanged();
		this.outlineViewChanged();
		if(this.ganttView)
			this.ganttView.blockRefresh = 0;
		
		if(this.enableInteraction) {
			this.domousewheelEventListener = this.domousewheel.bindAsEventListener(this);
			PWUtils.observe(this.ganttContainer, "mousewheel", this.domousewheelEventListener, true);// IE + Safari
			PWUtils.observe(this.ganttContainer, "DOMMouseScroll", this.domousewheelEventListener, true);// FF
		}		
	},

	setEnableScrollBars: function(flag) {
		this.ganttContainer.style.overflowY = flag ? "auto" : "hidden";	
		this.ganttContainer.style.overflowX = flag ? "scroll" : "hidden";
		if(!flag)
			this.removeRulerFillView();
	},

	setDependendView: function(dependentContainer) {
		this.dependendView = dependentContainer;
	},

	setScrollTop: function(scrollTop) {
		if(this.ganttContainer.scrollTop != scrollTop)
			this.ganttContainer.scrollTop = scrollTop;	

	},

	calculateVisibleWidth: function() {
		var hdiff = this.ganttContainer.cachedOffsetWidth;
		var scrollLeft = this.ganttContainer.cachedScrollLeft;		
		this.visibleStartDate = this.ruler.posToDate(scrollLeft-hdiff);
		this.visibleEndDate = this.ruler.posToDate(scrollLeft+hdiff);
		this.ganttRulerView.visibleWidthChanged();			
		if(this.delegate)
			this.delegate.visibleGanttChanged(this.visibleStartDate, this.visibleEndDate);
	},

	visibleRows: function(expansionPixels) {
		return this.outlineView.visibleRows(expansionPixels);
	},
	
	doscroll: function(event) {	
		event = event || window.event;
		this.ganttContainer.cachedScrollLeft = this.ganttContainer.scrollLeft;
		if(this.rulerContainer.scrollLeft!=this.ganttContainer.cachedScrollLeft)
			this.rulerContainer.scrollLeft=this.ganttContainer.cachedScrollLeft;
		if(this.dependendView)
			this.dependendView.setScrollTop(this.ganttContainer.scrollTop);
		Event.stop(event);
		this.calculateVisibleWidth();
	},

	domousewheel: function(event) {	
		var delta = mouseWheelDeltaFromEvent(event);
		this.ganttContainer.scrollTop -= delta.y;
		this.ganttContainer.scrollLeft -= delta.x;
		this.doscroll(event);
		return;
	},

	addRulerFillView: function() {
		if(!this.outlineView.showPrintView) {	
			if(!this.rulerFillView) {
				if(!this.outlineView.showPrintView)
					this.rulerContainer.style.right = PWUtils.scrollbarWidth()+"px";		
				this.rulerFillView = $(document.createElement("div"));
				this.rulerFillView.className = "headerFillView";
				this.rulerFillView.style.position = "absolute";
				this.rulerFillView.style.top = "0px";
				this.rulerFillView.style.right = "0px";
				this.rulerFillView.style.height = parseInt(this.rulerContainer.style.height)+"px";
				this.rulerFillView.style.width = PWUtils.scrollbarWidth()-1+"px";
				if(this.enableInteraction)	
					PWUtils.drawHeaderGradient(this.rulerFillView, this.environment.images.grayGradient);
				this.gantt.appendChild(this.rulerFillView);
			}
		}
	},

	removeRulerFillView: function()	{
		if(!this.outlineView.showPrintView) {	
			if(this.rulerFillView) {
				this.gantt.removeChild(this.rulerFillView);
				this.rulerFillView = null;
				this.rulerContainer.style.right = "0px";	
			}
		}
	},

	zoomIn: function() {
		this.ganttView.initialRows = this.outlineView.visibleRows();
		this.ruler.zoomIn();
		this.ganttRulerView.refreshRuler();
		this.containerSizeChanged();		
	},

	zoomOut: function()	{
		this.ganttView.initialRows = this.outlineView.visibleRows();
		this.ruler.zoomOut();
		this.ganttRulerView.refreshRuler();
		this.containerSizeChanged();
	},

	rulerChanged: function() {
		if(this.ganttRulerView)	{
			this.rulerContainer.style.height = this.rulerHeight()+"px";
			var rulerWidth = this.ganttRulerView.width();
			if(this.ganttView)
				this.ganttView.setWidth(rulerWidth);
			this.calculateVisibleWidth();
			PWUtils.notificationCenter.sendMessage("rulerChanged", this.ruler);
		}
	},

	outlineViewChanged: function(rows) {
		if(this.ganttView) {
			this.ganttView.initialRows = rows;
			var outlineHeight = this.outlineView.height();
			var ganttViewHeight = this.ganttView.height();
			this.ganttView.setHeight(outlineHeight);
			this.calculateVisibleWidth();
		}			
		this.ganttRulerView.refreshBackground();
	},

	outlineRows: function() {
		return this.outlineView.rows();
	},


	refreshRulerFillView: function() {
		if(this.ganttView) {
			var ganttHeight = this.ganttView.height();
			var containerHeight = this.ganttContainer.cachedOffsetHeight - PWUtils.scrollbarWidth();	
			if(ganttHeight > containerHeight)
				this.addRulerFillView();
			else
				this.removeRulerFillView();					
			this.ganttRulerView.refreshBackground();	
		}
	},

	containerSizeChanged: function() {
		this.ganttContainer.cachedOffsetHeight = this.ganttContainer.offsetHeight ? this.ganttContainer.offsetHeight : 1000;
		this.ganttContainer.cachedOffsetWidth = this.ganttContainer.offsetWidth;
		this.rulerContainer.cachedOffsetWidth = this.rulerContainer.offsetWidth;
		this.calculateVisibleWidth();
		if(this.ganttView)
			this.ganttView.rulerWidthChanged(this.ganttRulerView.width());	
		this.refreshRulerFillView();
	},

	fullHeight: function() {
		return this.ganttView.height() + this.ganttRulerView.heightOfAllRows();;
	},

	width: function() {
		return this.ganttRulerView.width();
	},
	
	refreshSelection: function(objects) {
		this.ganttView.refreshSelection(objects);
	},

	setBlockRefresh: function(flag) {
		if(this.ganttView)
			this.ganttView.blockRefresh = flag;
	},

	refresh: function() {
		this.outlineViewChanged();		
	},
	
	handleClickInRowAtPosition: function(event, y) {
		var rows = this.outlineView.rows();
		var row;
		for(var i=0; i<rows.length; i++){
			row = rows[i];
			if(row && y >= row.cachedOffsetTop && y <= row.cachedOffsetTop+row.heightInPixel){
				this.outlineView.handleClickInRow(event, row);	
				break;
			}
		}	
	},
	
	handleClickInRow: function(event, row) {
		this.outlineView.handleClickInRow(event, row);
	},

	outlineDidCreateRows: function(outline, rows) {
		this.ganttView.outlineDidCreateRows(outline, rows);
	},
	
	outlineRowsBecameVisible: function(outline, rows) {
		this.ganttView.outlineRowsBecameVisible(outline, rows);
	}

	
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("GanttView");

var GanttView = Base.extend({
	constructor: function(environment, ganttRuler, scrollView, drawShadows) {
		this.base();
		this.drawShadows = drawShadows;
		this.environment = environment;
		this.verticalLabelOffset = Prototype.Browser.Gecko ? 0 : 1;
		this.ruler = ganttRuler;
		this.scrollView = scrollView;
		this.controller = this.scrollView.delegate;
		this.displayGraphs = (this.controller && this.controller.displayGraphs && this.controller.displayGraphs()) ? true: false;
		this.controllerRespondsToGraphMethods = (this.controller && this.controller.showGraphForObject) ? true : false;
		this.graphContainer = null;
		this.recreateGraph = 0;
		this.connectShapeRects = {};
	},
	
	
	drawGraphBlock: function(graphObject, block, startDate) {
		var left = this.ruler.dateToPos(this.ruler.startOfUnitContainingDateClipAtDateExtendIfTooThin(this.ruler.primaryUnit, startDate, null, true));
		var right = this.ruler.dateToPos(this.ruler.endOfUnitWithStartDateClipAtDateExtendIfTooThin(this.ruler.primaryUnit, startDate, null, true));
		var x = left+1;
		var width = (right-left-1);
		var text = this.controller.graphTextForBlock(graphObject, block, width);
		block.div = DIV({'class':'graphBlock', style:'top:'+(graphObject.top+2)+'px; height:'+(graphObject.height-4)+'px; width:'+width+'px; left:'+x+'px; background-color:gray;'}
						, block.textDiv = DIV({'class':'graphText'}, text));	
		this.controller.willDrawGraphBlock(graphObject, block);
		this.graphContainer.appendChild(block.div);	
	},
	
	adjustGraph: function(){		
		var invisibleObjects = [];
		for(var objectID in this.graphObjects) {
			var graphObject = this.graphObjects[objectID];
			if(graphObject.positionRecorded){
				for(var startDateStr in graphObject.blocks){
					var block = graphObject.blocks[startDateStr];
					var startDate = block.startDate;
					var left = this.ruler.dateToPos(this.ruler.startOfUnitContainingDateClipAtDateExtendIfTooThin(this.ruler.primaryUnit, startDate, null, true));
					var right = this.ruler.dateToPos(this.ruler.endOfUnitWithStartDateClipAtDateExtendIfTooThin(this.ruler.primaryUnit, startDate, null, true));
					var top = (graphObject.top+2) + "px";
					var height = (graphObject.height-4) + "px";
					var width = right-left-2;
					block.div.style.left = (left+1) + "px";
					block.div.style.width =  Math.max(width, 0) + "px";
					if(block.div.style.top != top)
						block.div.style.top = top;
					if(block.div.style.height != height)
						block.div.style.height = height;
					block.textDiv.innerText = this.controller.graphTextForBlock(graphObject, block, width);
				}
			}else
				invisibleObjects.push(objectID);
		}
		for(var i=0; i<invisibleObjects.length; i++){
			var objectID = invisibleObjects[i];
			var graphObject = this.graphObjects[objectID];
			for(var startDateStr in graphObject.blocks){
				var block = graphObject.blocks[startDateStr];
				block.div.parentNode.removeChild(block.div);
			}
			delete this.graphObjects[objectID];
		}
	},
		
	graphValuesReceived: function(response){
		if(this.oldGraphContainer){
			this.container.removeChild(this.oldGraphContainer);
			this.oldGraphContainer = null;
		}			
		for(var objectID in response) {
			var graphObject = this.graphObjects[objectID];
			var responseObject = response[objectID];
			if(responseObject && graphObject) {
				graphObject.min = responseObject.min;
				graphObject.max = responseObject.max;
				graphObject.overThreshold = responseObject.overThreshold;
				graphObject.underThreshold = responseObject.underThreshold;
				if(!graphObject.blocks)
					graphObject.blocks = {};
				var newBlocks = responseObject.blocks;
				for(var startDateStr in newBlocks) {
					startDate = new Date(startDateStr * 1000);
					if(!graphObject.blocks[startDateStr]){
						var block = newBlocks[startDateStr];
						block.startDate = startDate;
						graphObject.blocks[startDateStr] = block;
						this.drawGraphBlock(graphObject, block, startDate);
					}
				}
			}
		}
	},
	
	visibleSections: function(){
		var result = {};
		var vStartDate = this.scrollView.visibleStartDate;
		var vEndDate = this.scrollView.visibleEndDate;
		var vStart = vStartDate.getTime();
		var vEnd = vEndDate.getTime();
		for(var i in this.horizontalSections){
			var section = this.horizontalSections[i];
			if((section.end >= vStart && section.end <= vEnd) || (section.start >= vStart && section.start <= vEnd) || (section.start < vStart && section.end > vEnd)){
				result[i] = section;
			}
		}
		return result;
	},
	
	requestGraphValues: function(){
		var request = null;
		var visibleSections = this.visibleSections();
		var visibleSectionsArray = [];
		var start = null;
		var end = null;
		for(var objectURI in this.graphObjects){
			var graphObject = this.graphObjects[objectURI];
			if(!this.controller.requestGraphValuesForObject(graphObject))
				continue;
			if(!graphObject.sections){
				graphObject.sections = {};
				for(var key in this.horizontalSections){
					var section = this.horizontalSections[key];
					graphObject.sections[key] = {start:section.start, end:section.end};
				}
			}
			var doRequest = false;
			for(var i in visibleSections){
				if(!graphObject.sections[i].requested){
					graphObject.sections[i].requested = true;
					doRequest = true;
				}
				if(!start)
					visibleSectionsArray.push(visibleSections[i]);
			}			
			if(!start){
				start = new Date(visibleSectionsArray[0].start);
				var visibleEnd = visibleSectionsArray[visibleSectionsArray.length-1].end;
				var rulerEnd = this.ruler.endDate.getTime();
				end = new Date(visibleEnd > rulerEnd ? rulerEnd : visibleEnd);
			}
			if(doRequest){
				if(!request){
					request = {};
					request.objectURIs = [];
					request.start = start;
					request.end = end;
					request.rulerStart = this.ruler.startDate;
					request.rulerEnd = this.ruler.endDate;
					request.ruler = this.ruler.rulerDescription();
				}
				request.objectURIs.push(objectURI);
			}
		}	
		if(request){
			this.controller.requestGraphValues(request, this.graphValuesReceived, this);
		}else if(this.oldGraphContainer){
			this.container.removeChild(this.oldGraphContainer);
			this.oldGraphContainer = null;
		}	
	},	
				
	initGraph: function() {
		if(this.displayGraphs){
			var numUnits = this.ruler.numberOfRulerUnits();
			var recreate = (!this.controller.isInLayoutChangingAction() || this.cachedNumberOfRulerUnits != numUnits || !this.graphObjects);
			this.recreateGraph += recreate ? 1 : 0;
			if(this.recreateGraph){
				this.cachedNumberOfRulerUnits = numUnits;	
				var right = this.ruler.posToDate(500);
				var left = this.ruler.posToDate(0);
				var diff = this.ruler.posToDate(500).getTime()-this.ruler.posToDate(0).getTime();
				var start = this.ruler.startDate.getTime();
				var rEnd = this.ruler.endDate.getTime();
				var end;
				this.horizontalSections = {};
				var i = 0;
				while(start < rEnd){
					end = start+diff;
					this.horizontalSections[i]={start:start, end:end};
					start = end;
					i++;
				}
				this.graphObjects = {}; 
			}
			for(var uri in this.graphObjects)
				this.graphObjects[uri].positionRecorded = false;
		}	
	},
																																																
	refreshGantt: function() {
		if(this.blockRefresh)
			return;
		this.minX = null;
		this.maxX = null;	
		this.minDate = null;							
		var offset = 0;
		if(!this.refreshWithoutOffset){
			this.refreshWithoutOffset = true;
			offset = -1000000;
		}else
			this.initGraph();
		var startDate = this.ruler.posToDate(offset);
		var endDate = this.ruler.posToDate(50);							
		this.ruler.adjustFromDateToDateOnlyByExpanding(startDate, endDate, true);		
		this._refreshGanttWithRows(this.initialRows, true);
	},
	
	drawGraphs: function(){
		this.graphTimer = null;
		if(this.recreateGraph){
			this.recreateGraph = 0;
			this.oldGraphContainer = this.graphContainer;
			this.graphContainer = DIV({'class':'graphContainer', style:'bottom:'+PWUtils.scrollbarWidth()+'px;'});
			this.container.appendChild(this.graphContainer);		
		}
		else
			this.adjustGraph();	// adjust the positions of the divs to match the ruler row.
		this.requestGraphValues();	// fetch missing graph values and creates new divs accordingly
	},

	refreshDidFinish: function(){
		if(this.displayGraphs)
			this.drawGraphs();
	},

	refreshWillStart: function(){
		if(this.controller && this.controller.refreshWillStart)
			this.controller.refreshWillStart();
	},

	recreateLabelContainer: function() {
		var old = this.labelContainer;
		this.labelContainer = DIV({'class':'labelContainer', style:'position:absolute; z-index:2; top:0px; right:0px; left:0px; bottom:'+PWUtils.scrollbarWidth()+'px;'});
		if(old)
			this.container.replaceChild(this.labelContainer , old);
		else
			this.container.appendChild(this.labelContainer);
	},

	setViewOptions: function(viewOptions) {
		this.viewOptions = viewOptions;
	},

	setStyleList: function(list) {
		this.styleList = list;
	},
	
	refreshRuler: function() {		
		this.blockRefresh = true;
		this.scrollView.ganttRulerView.refreshRuler();	
		this.blockRefresh = false;
	},

	projectEndDatePlusPixel: function(pixelNum)	{	
		return this.ruler.posToDate(this.ruler.dateToPos(this.endDate) + pixelNum);		
	},

	setWidth: function(width) {
		if(width != 0){
			this.rulerWidthChanged(width);
			this.refreshGantt();
		}
	},

	width: function() {
		return this.rulerWidth;
	},

	handleClickInGantt: function(event)	{
		var y = event.offsetY;
		if(!y)
			y = event.layerY;
		this.scrollView.handleClickInRowAtPosition(event, y);
	},
	
	calculateMinMax: function()	{
		var labels = this.newLabels;
		var label;
		var left;
		var right;
		for(var i=0; i<labels.length; i++){	
			label = labels[i];
			if(label.type == "L"){
				left = label.offsetLeft;
				if(left < this.minX || this.minX == null)
					this.minX = left;				
			}
			else if(label.type == "R"){
				right = parseInt(label.style.left) + label.offsetWidth;
				if(right > this.maxX || this.maxX == null)
					this.maxX = right;		
			}
		} 
	},
	
	minCanvasWidthWithPreferedWidth: function(w) {
		var diff = this.scrollView.hasVerticalScrollbar() ? PWUtils.scrollbarWidth() : 0;
		var containerWidth = this.container.cachedOffsetWidth-diff;
		if(w <= containerWidth)
			w = containerWidth;
		w -= 1;
		return w;		
	},
	
	canScrollVertically: function()	{	
		return (this.height() > this.container.offsetHeight);
	},
	
	refreshSelection: function(objects)	{
		if(!this.whiteSelections)
			this.whiteSelections = [];

		var uris = [];
		for(var i=0; i<objects.length; i++){
			uris.push(objects[i].valueForKey(WRLSnapshotURIKey));
		}
		
		var rows = this.scrollView.outlineRows();	// adjust background color of even rows
		var row;
		var uri;
		for(var i=0; i<rows.length; i++){
			row = rows[i];
			if(row /*&& row.isOdd*/){			
				uri = row.object.valueForKey(WRLSnapshotURIKey);
				var bgObject = this.backgrounds[uri];
				if(bgObject){
					bgObject.style.backgroundColor = row.className == "selected" ? "#D7E3F7": row.style.backgroundColor;
				}
				uris = uris.without(uri);
			}
		}

		for(var i=0; i<uris.length; i++){	// Create selection divs for white rows
			uri = uris[i];
			if(!this.whiteSelections[uri] && this.whiteBackgrounds[uri])
				this.whiteSelections[uri] = this.whiteBackgrounds[uri].call();
		}
	},
	
	outlineDidCreateRows: function(outline, rows)
	{
		if(rows.length)
			this._refreshGanttWithRows(rows, false);
	},


	outlineRowsBecameVisible: function(outline, rows)
	{
		if(rows.length && !this.drawnRows[rows[0].object.valueForKey(WRLSnapshotURIKey)])
			this._refreshGanttWithRows(rows, false);
	},
	
	// ************************************************************************************************************
	// *****
	// *****										High level drawing methods
	// *****	
	
	drawSelection: function(top, height) {
		var bg = $(document.createElement("div"));
		bg.style.position = "absolute";
		bg.className = "selected";
		bg.style.top = top+"px";
		bg.style.height = height + "px";
		this.backgroundContainer.appendChild(bg);	
		this.backgroundContainer.whiteSelectionDivs.push(bg);
		return bg;
	},
	
	drawBackground: function(top, width, height, color, row, group)	{
		var uri = row.object.valueForKey(WRLSnapshotURIKey);
		var isSelected = this.scrollView.outlineView.controller.selectedObjects.indexOf(row.object) != -1;
		var bg = $(document.createElement("div"));
		bg.style.position = "absolute";
		bg.style.top = top+"px";
		bg.style.left = "0px";
		bg.style.right = "0px";
		bg.style.height = height + "px";
		bg.style.backgroundColor = color;	
		bg.top = top;
		bg.bottom = top+height;
		bg.uri = uri;
		this.backgrounds[uri] = bg;
		this.backgroundContainer.appendChild(bg);
	},
	
	drawLabel: function(left, top, text, fontSize, fontWeight, fontStyle, fontStretch, fontFamily, color, type, width, group) {	
		left = Math.floor(left);
		top = Prototype.Browser.IE ? Math.floor(top-2) : Math.floor(top);
		width = Math.floor(width);
		var label = $(document.createElement("div"));
		label.type = type;
		label.style.position = "absolute";
		label.style.padding = "0px";
		label.style.margin = "0px";
		label.style.whiteSpace = "nowrap";
		label.style.overflow = "visible";
		if(fontSize)
			label.style.fontSize = fontSize+"px";
		if(fontWeight)
			label.style.fontWeight = fontWeight;
		if(fontStyle)
			label.style.fontStyle = fontStyle;
		if(fontStretch)
			label.style.fontStretch = fontStretch;
		if(fontFamily)
			label.style.fontFamily = fontFamily;
		if(color)
			label.style.color = color;
		label.style.lineHeight = "160%";
		label.style.top = top+"px";
		label.appendChild(document.createTextNode(text));
		if(type == "M" || type == "R") {
			if(width){	// middle label
				label.style.width = Math.max(width, 0) + "px";
				label.style.overflow = "hidden";
			}
			else	// right label
				this.newLabels.push(label);
			label.style.textAlign = "left";
			label.style.left = left+"px";
			this.labelContainer.appendChild(label);
		}else{	// left label
			label.style.top = "0px";
			label.style.right = "0px";
			label.style.textAlign = "right";
			var labelWrapper = $(document.createElement("div"));
			labelWrapper.style.position = "absolute";
			labelWrapper.style.top = top+"px";
			labelWrapper.style.left = "0px";
			labelWrapper.style.width = Math.max(left, 0)+"px";
			labelWrapper.appendChild(label);			
			this.labelContainer.appendChild(labelWrapper);			
			this.newLabels.push(label);
		}
	},
	
	// **************************************************************************************************
	// *****
	// *****							Calculate positions of activities
	// *****							and invoke appropriate drawing methods
	// *****
	
	barHeightForBarStyleMiddleLableStyle: function(barStyle, middleLabelStyle) {
		var height = middleLabelStyle.lineHeight;
		if(!height)
			height = middleLabelStyle.fontSize+4;
		if(!height || height<12)
			height = 12;
		if(barStyle.height && height<barStyle.height)
			height = barStyle.height;
		return height;
	},

	recordVerticalGraphPosition: function(object, row, ruler, top, height, canvasWidth, group) {
		var color = row.className == "selected" ? "#D7E3F7": row.style.backgroundColor;
		this.drawBackground(top, canvasWidth, height-2, color, row, group);
		if(this.graphObjects){
			var objectURI = object.uri();
			var graphObject = this.graphObjects[objectURI];
			if(!graphObject){
				graphObject = this.graphObjects[objectURI] = {};
				graphObject.object = object;
			}
			graphObject.top = top;
			graphObject.height = height;
			graphObject.positionRecorded = true;
		}
	},
	
	createActivityInRow: function(activity, row, ruler, top, height, canvasWidth, group) {
		var isEmptyProject = activity.className() == "MEProject" && activity.isLeaf();
		if(isEmptyProject) {
			activity = new WRLObject();	
			var startDate = new Date();
			var endDate = ruler.posToDate(this.container.offsetWidth);
			activity.setValueForKey(startDate, "expectedStartDate");
			activity.setValueForKey(startDate, "plannedStartDate");
			activity.setValueForKey(endDate, "expectedEndDate");
			activity.setValueForKey(endDate, "plannedEndDate");
		}

		var x = ruler.dateToPos(activity.valueForKey("expectedStartDate"))-this.leftMargin;
		var width = Math.max(ruler.dateToPos(activity.valueForKey("expectedEndDate"))-x-this.leftMargin, 4);	
		var maxX = x+width+50;	// plus ein bisschen extra Rand
		if(this.maxX < maxX)
			this.maxX = maxX;			
			
		if(this.displayGraphs && this.controllerRespondsToGraphMethods && this.controller.showGraphForObject(activity)){
			this.recordVerticalGraphPosition(activity, row, ruler, top, height, canvasWidth, group);
			var minDate = activity.valueForKey("expectedStartDate");	
			if(!this.minDate || (minDate && this.minDate.getTime() > minDate.getTime()))	{
				this.minDate = minDate;
				this.minX = x-10; // add a left margin
			}
			return;
		}

		var completeWidth = ruler.dateToPos(activity.valueForKey("actualCompleteThroughDate"))-x-this.leftMargin;
		var overlap = false;
		var	plannedX = null;
		var	plannedWidth = null;
		var minDate = activity.valueForKey("expectedStartDate");
		var color = row.className == "selected" ? "#D7E3F7": row.style.backgroundColor;

		if(!minDate)
		{
			this.drawBackground(top, canvasWidth, height-2, color, row, group);
			return;
		}
			
		if(this.viewOptions.displayMode != 3  && (!minDate.isEqual(activity.valueForKey("plannedStartDate")) 
			|| !activity.valueForKey("expectedEndDate").isEqual(activity.valueForKey("plannedEndDate")))) {
			plannedX = ruler.dateToPos(activity.valueForKey("plannedStartDate"))-this.leftMargin;
			plannedWidth = ruler.dateToPos(activity.valueForKey("plannedEndDate"))-plannedX-this.leftMargin;
			var end1 = x+width+2; // +2 wegen dem Rand
			var end2 = plannedX+plannedWidth+2;
			overlap = (end1>=plannedX && end1<=end2) || (x>=plannedX && x<=end2);
			if(minDate.getTime()>activity.valueForKey("plannedStartDate").getTime())
				minDate = activity.valueForKey("plannedStartDate");
		}
		if(!this.minDate || this.minDate.getTime() > minDate.getTime())	{
			this.minDate = minDate;
			this.minX = x-10; // add a left margin
		}
		var children = activity.valueForKey("linkedSubActivities");
		var isGroup = children && children.length;
		var isMilestone = activity.valueForKey("isMilestone");
		var barStyle = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetBar, activity.valueForKey("styleConditionMask"));
		
		var barColor = null;
		if(this.displayGraphs && this.controllerRespondsToGraphMethods)
			barColor = this.controller.barColorForObject(activity, isGroup); 

		var middleLabelStyle = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetLabelMiddle, activity.valueForKey("styleConditionMask"));
		var barHeight = this.barHeightForBarStyleMiddleLableStyle(barStyle, middleLabelStyle);
		var y = top+(height-barHeight)/2;
		
		this.drawBackground(top, canvasWidth, height-2, color, row, group);

		if(isGroup)
			barHeight += 2;
		else if(!isMilestone)
			barHeight -= 1;

		if(!isEmptyProject) {
			if(isGroup)
				this.createGroupInRow(activity, row, x, y, plannedX, plannedWidth, width, completeWidth, barColor ? barColor : barStyle, barHeight, height, top, overlap, group);
			else if(isMilestone)
				this.createMilestoneInRow(activity, row, x, y, plannedX, width, barStyle, barHeight, height, overlap, group);
			else
				this.createBarInRow(activity, row, x, y, plannedX, plannedWidth, width, completeWidth, barStyle, barHeight, height, top, overlap, group);
			if(this.viewOptions.showLabels)
				this.createLabelInRow(activity, row, x, y, plannedX, plannedWidth, width, height, barHeight, overlap, group);				
		}

	},
	
	createGroupInRow: function(activity, row, x, y, plannedX, plannedWidth, width, completeWidth, barStyle, barHeight, height, top, overlap, group) {
		var me = this;
		var isMilestone = activity.valueForKey('isMilestone');
		if(activity.valueForKey("isCollapsed") && !isMilestone){
			this.createBarInRow(activity, row, x, y, plannedX, plannedWidth, width, completeWidth, barStyle, barHeight-3, height, top, overlap, group);
			return;
		}else if(isMilestone){
			this.createMilestoneInRow(activity, row, x, y, plannedX, width, barStyle, barHeight, height, overlap, group);
			return;
		}
		var borderWidth = 0.5;
		x = Math.floor(x)+0.5;
		y = Math.floor(y)+0.5;
		var h = Math.floor(barHeight/3.0);
		var y1 = y;
		var y2 = y;
		if(plannedX){
			// Schatten
			var border = Math.max((height-(2*barHeight+5))*0.5, 1);
			y1 = overlap ? Math.floor(top+height-border-barHeight)+0.5 : y;
			this.drawGroup(Math.floor(plannedX)+0.5, y1, plannedWidth, 0, barHeight, "#AAAAAA", "#555555", borderWidth, false, group);
			y2 = overlap ? Math.floor(top+border)+0.5 : y;
			this.drawGroup(x, y2, width, completeWidth, barHeight, barStyle.backgroundColor, barStyle.color, borderWidth, true, group);
		}else	
			this.drawGroup(x, y, width, completeWidth, barHeight, barStyle.backgroundColor, barStyle.color, borderWidth, true, group);
		width += 2*h;
		x -= h;		
		var yDiff = Math.floor((barHeight-2*h)/2.0);
		y1 += yDiff;
		y2 += yDiff;
		this.connectShapeRects[activity.uri()] = {x:x, y:y2, w:width, h:h};
		if(!plannedX){
			activity.leftLabelRect = this.connectShapeRects[activity.uri()];
			activity.rightLabelRect = this.connectShapeRects[activity.uri()];
		}else{
			plannedX -= h;
			plannedWidth += 2*h;
			if(plannedX < x)
				activity.leftLabelRect = {x:plannedX, y:y1, w:plannedWidth, h:h};
			else
				activity.leftLabelRect = this.connectShapeRects[activity.uri()];
			if(plannedX+plannedWidth > x+width)	
				activity.rightLabelRect = {x:plannedX, y:y1, w:plannedWidth, h:h};
			else
				activity.rightLabelRect = this.connectShapeRects[activity.uri()];
		}	
	},

	createMilestoneInRow: function(activity, row, x, y, plannedX, width, barStyle, barHeight, height, overlap, group) {
		var me = this;	
		var h = barHeight*0.5;
		var borderWidth = barStyle.borderStyle && this.viewOptions.showCriticalPath ? 1.5 : 0.5;
		var offset = barStyle.borderStyle ? 0 : 0.5;
		x = Math.floor(x)+offset;
		y = Math.floor(y)+offset;	
		if(plannedX)
			this.drawMilestone(Math.floor(plannedX)+offset, y, h, "#AAAAAA", "#555555", borderWidth, group);
		this.drawMilestone(x, y, h, barStyle.backgroundColor, barStyle.color, borderWidth, group);
		this.connectShapeRects[activity.uri()] = {x:x-h, y:y, w:barHeight, h:barHeight};																		
		if(!plannedX){
			activity.leftLabelRect = this.connectShapeRects[activity.uri()];
			activity.rightLabelRect = this.connectShapeRects[activity.uri()];
		}else{
			if(plannedX < x)
				activity.leftLabelRect = {x:plannedX-h, y:y, w:barHeight, h:barHeight};
			else
				activity.leftLabelRect = this.connectShapeRects[activity.uri()];
			if(plannedX > x+width)
				activity.rightLabelRect = {x:plannedX-h, y:y, w:barHeight, h:barHeight};
			else
				activity.rightLabelRect = this.connectShapeRects[activity.uri()];
		}	
	},

	createBarInRow: function(activity, row, x, y, plannedX, plannedWidth, width, completeWidth, barStyle, barHeight, height, top, overlap, group) {
		var dashed = activity.className() == 'MEAssignment';
		var me = this;
		var radius = barHeight*0.15;
		var borderWidth = barStyle.borderStyle && this.viewOptions.showCriticalPath ? 1.5 : 0.5;
		var offset = barStyle.borderStyle ? 0 : 0.5;
		x = Math.floor(x)+offset;
		y = Math.floor(y)+offset-1;
		var y1 = y;
		var y2 = y;
		if(plannedX){
			var border = Math.max((height-(2*barHeight+5))*0.5, 1);
			y1 = overlap ? Math.floor(top+height-border-barHeight)+offset-2 : y;
			this.drawBar(Math.floor(plannedX)+offset, y1, plannedWidth, 0, barHeight, radius, "#AAAAAA", "#555555", borderWidth, false, group, dashed);
			y2 = overlap ? Math.floor(top+border)+offset : y;
			this.drawBar(x, y2, width, completeWidth, barHeight, radius, barStyle.backgroundColor, barStyle.color, borderWidth, true, group, dashed);
		}else
			this.drawBar(x, y, width, completeWidth, barHeight, radius, barStyle.backgroundColor, barStyle.color, borderWidth, true, group, dashed);
		this.connectShapeRects[activity.uri()] = {x:x, y:y2, w:width, h:barHeight};	
		if(!plannedX){
			activity.leftLabelRect = this.connectShapeRects[activity.uri()];
			activity.rightLabelRect = this.connectShapeRects[activity.uri()];
		}else{
			if(plannedX < x)
				activity.leftLabelRect = {x:plannedX, y:y1, w:plannedWidth, h:barHeight};
			else
				activity.leftLabelRect = this.connectShapeRects[activity.uri()];
			if(plannedX+plannedWidth > x+width)	
				activity.rightLabelRect = {x:plannedX, y:y1, w:plannedWidth, h:barHeight};
			else
				activity.rightLabelRect = this.connectShapeRects[activity.uri()];
		}
	},
	
	createLabelInRow: function(activity, row, x, y, plannedX, plannedWidth, width, height, barHeight, overlap, group) {
		var me = this;
		var style = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetLabelLeft, activity.valueForKey("styleConditionMask"))
		var isMilestone = activity.valueForKey('isMilestone');
		if(style.contentKey){		
			style.contentFormatter.environment = this.environment;  
			var leftLabel = style.contentFormatter.stringForObjectValue(activity.valueForKey(style.contentKey));
			if(leftLabel.length){
				if(plannedX && plannedX < x){
					x = plannedX;
					width = plannedWidth;
				}
				var rect = activity.leftLabelRect;
				var div = $(document.createElement("div"));
				var fontSize = style.fontSize || 10;
				var top = rect.y+this.verticalLabelOffset+(rect.h-(fontSize*1.5))*0.5 - 1.0;
				var left = x-barHeight-(isMilestone ? 7 : 0);
				this.drawLabel(left, top, leftLabel, fontSize, style.fontWeight, style.fontStyle, style.fontStretch, style.fontFamily, style.color, "L", group);
 			}
		}
		style = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetLabelMiddle, activity.valueForKey("styleConditionMask"))
		var isGroup = activity.isGroup ? activity.isGroup() : false;
		if(style.contentKey && !isMilestone && (!isGroup || (isGroup && activity.valueForKey("isCollapsed")))){		
			style.contentFormatter.setPreferedWidth(width-4);
			style.contentFormatter.environment = this.environment;
			var middleLabel = style.contentFormatter.stringForObjectValue(activity.valueForKey(style.contentKey));
			if(middleLabel.length){
				var rect = this.connectShapeRects[activity.uri()];
				var fontSize = style.fontSize || 10;
				var top = rect.y+this.verticalLabelOffset+(rect.h-(fontSize*1.5))*0.5 - 1.0;
				var left = rect.x+2;
				var width = width-4;
				if(width>4)
					this.drawLabel(left, top, middleLabel, fontSize, style.fontWeight, style.fontStyle, style.fontStretch, style.fontFamily, style.color, "M", width, group);
			}
		}
		style = this.styleList.flattenedStyleForTarget(StyleList.activityViewStyleTargets.MEStyleTargetLabelRight, activity.valueForKey("styleConditionMask"))
		if(style.contentKey){		
			style.contentFormatter.environment = this.environment;
			var rightLabel = style.contentFormatter.stringForObjectValue(activity.valueForKey(style.contentKey));
			if(rightLabel.length){
				var rect = activity.rightLabelRect;
				var fontSize = style.fontSize || 10;				
				var left = rect.x+rect.w+barHeight;
				var top = rect.y+this.verticalLabelOffset+(rect.h-(fontSize*1.5))*0.5 - 1.0;
				this.drawLabel(left, top, rightLabel, fontSize, style.fontWeight, style.fontStyle, style.fontStretch, style.fontFamily, style.color, "R", null, group);
			}
		}	
	},
	
	createRelationships: function(group, rows) {
		var row;
		for(var rowIndex in rows){		// todo: Use an object instead of an array for drawnRows
			row = rows[rowIndex];
			if(row && typeof row != "function"){
				var rels = row.object.valueForKey("nextActivityRelationships");
				if(rels){			
					for(var relIndex=0; relIndex<rels.length; relIndex++){
						var rel = rels[relIndex];
						var nextActivity = rel.valueForKey("nextActivity");
						if(nextActivity && this.drawnRows[nextActivity.valueForKey(WRLSnapshotURIKey)] && !this.drawnRelations[rel.ID]){
							this.drawnRelations[rel.ID] = 1;
							this.drawRelationship(rel, group);			
						}
					}
				}
			}
		}
	}
});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("GanttSVGView.js");

var GanttSVGView = GanttView.extend({
	constructor: function(scrollView, container, ganttRuler, environment, drawShadows){
		this.base(environment, ganttRuler, scrollView, drawShadows);
		this.svgns = "http://www.w3.org/2000/svg";
		this.container = container;
		this.container.style.overflowX = "auto";
		this.shadowColor = "#222222";
		this.shadowOpacity = 0.1;
		this.leftBorderSize = 30;
		this.rightBorderSize = 20;
		this.endDate = new Date();
		this.createGantt();
	},

	createGantt: function()	{
		this.recreateLabelContainer();
		this.canvas = $(document.createElementNS(this.svgns, "svg"));
		this.canvas.cachedWidth = 200;
		this.canvas.setAttributeNS(null, "width", "200px");
		this.canvas.setAttributeNS(null, "height", "200px");	
		this.canvas.setAttributeNS(null, "style", "top:0px, left:0px, position:absolute, overflow:hidden");			
		this.container.appendChild(this.canvas);
		this.topLevelDiv = $(document.createElement("div"));
		this.topLevelDiv.style.position = "absolute";
		this.topLevelDiv.style.top = "0px";
		this.topLevelDiv.style.left = "0px";
		this.topLevelDiv.style.height = this.height() + "px";
		this.topLevelDiv.style.zIndex = 20;
		this.handleClickInGanttEventListener = this.handleClickInGantt.bindAsEventListener(this);
		PWUtils.observe(this.topLevelDiv, "click", this.handleClickInGanttEventListener, true);
		this.container.appendChild(this.topLevelDiv);
	},


	_refreshGanttWithRows: function(rows, refreshAll)	{
		this.refreshWillStart();
		if(refreshAll){
			this.recreateLabelContainer();
			this.drawnRows = [];
			this.drawnRelations = [];
			this.leftMargin = 0;
		}
		this.newLabels = [];		
		var urisOfDrawnRows = [];
		var oldRowContainer = this.rowContainer;
		var oldBackgroundContainer = this.backgroundContainer;
		if(rows && rows.length){
			var canvasWidth = this.scrollView.ganttContainer.cachedOffsetWidth;
			if(refreshAll){
				this.rowContainer = $(document.createElementNS(this.svgns, "g"));
				this.backgroundContainer = $(document.createElement("div"));
				this.backgroundContainer.style.position = "absolute";
				this.backgroundContainer.style.top = "0px";
				this.backgroundContainer.style.left = "0px";
				this.backgroundContainer.style.height = this.height() + "px";
				this.backgroundContainer.style.zIndex = -1;
				this.backgrounds = [];
				this.whiteBackgrounds = [];
				this.backgroundContainer.whiteSelectionDivs = [];
			}else{
				this.backgroundContainer = oldBackgroundContainer;
				this.rowContainer = oldRowContainer;
			}
			var row;
			var height;
			var top = 0;			
			var oldRelationshipContainer = this.relationshipContainer;
			this.relationshipContainer = refreshAll ? $(document.createElementNS(this.svgns, "g")) : oldRelationshipContainer;
			for(var i=0; i<rows.length; i++){
				row = rows[i];				
				var activity = row.object;				
				if(!this.connectShapeRects[activity.uri()])
					this.connectShapeRects[activity.uri()] = {};
				var uri = activity.valueForKey(WRLSnapshotURIKey);
				if(!this.drawnRows[uri]){
					urisOfDrawnRows.push(uri);
					this.drawnRows[uri] = row;
					if(uri == 0)
						this.endDate = activity.valueForKey("expectedEndDate");				
					row.cachedOffsetHeight = row.heightInPixel+2;
					top = row.cachedOffsetTop;
					if(top == 0)
						this.endDate = activity.valueForKey("expectedEndDate");				
					this.createActivityInRow(activity, row, this.ruler, top, row.cachedOffsetHeight, canvasWidth, this.rowContainer);
				}
			}
			if(refreshAll){
				if(oldBackgroundContainer)
					this.container.replaceChild(this.backgroundContainer , oldBackgroundContainer);
				else
					this.container.appendChild(this.backgroundContainer );
				if(oldRowContainer)
					this.canvas.replaceChild(this.rowContainer , oldRowContainer);
				else
					this.canvas.appendChild(this.rowContainer );
				if(oldRelationshipContainer)
					this.canvas.replaceChild(this.relationshipContainer , oldRelationshipContainer);
				else
					this.canvas.appendChild(this.relationshipContainer);
			}
			if(this.viewOptions.showRelationships)
				this.createRelationships(this.relationshipContainer, this.drawnRows);
			this.calculateMinMax();
		}	
		if(urisOfDrawnRows.length)
			this.adjustLeftMargin(this.minX, this.minDate, this.maxX);
		this.refreshDidFinish();
	},

	adjustLeftMargin: function(minX, minDate, maxX)	{
		if(this.oldMinX != minX || this.oldMaxX != maxX || !this.oldMinDate || !this.oldMinDate.isEqual(minDate)){
			var oldActivityMinPos = this.ruler.dateToPos(this.minDate)-this.leftMargin;
			var suggestedStartDate = this.ruler.posToDate(this.minX+this.leftMargin);		
			var suggestedEndDate = this.ruler.posToDate(this.maxX+this.leftMargin);						
			this.ruler.adjustFromDateToDateOnlyByExpanding(suggestedStartDate, suggestedEndDate, true);
			this.leftMargin = this.ruler.dateToPos(this.minDate)-oldActivityMinPos;		
			this.rowContainer.setAttributeNS(null, "transform", "translate("+this.leftMargin+",0)");
			this.relationshipContainer.setAttributeNS(null, "transform", "translate("+this.leftMargin+",0)");
			this.labelContainer.style.left = this.leftMargin + "px";		
			this.oldMinX = minX;
			this.oldMinDate = minDate;
			this.oldMaxX = maxX;
			this.rulerWidthChanged(this.width());
			this.refreshRuler();
		}
		else
			this.rulerWidthChanged(this.rulerWidth);
	},
	
	rulerWidthChanged: function(width)	{
		this.rulerWidth = width;	
		var w = this.minCanvasWidthWithPreferedWidth(width);
		this.labelContainer.style.right = (this.scrollView.hasVerticalScrollbar() ? PWUtils.scrollbarWidth() : 0)+"px";
		this.canvas.cachedWidth = w;
		this.canvas.setAttributeNS(null, "width", w + "px");
		if(this.backgroundContainer)
			this.backgroundContainer.style.width = w + "px";
		this.topLevelDiv.style.width = w + "px";
		this.scrollView.refreshRulerFillView();		
	},

	height: function()	{
		return parseInt(this.canvas.getAttribute("height"));
	},

	setHeight: function(height)	{	
		if(height>=2)
			height-=2;
		this.canvas.setAttributeNS(null, "height", height + "px");
		this.labelContainer.style.height = height + "px";
		this.topLevelDiv.style.height = height + "px";
		this.refreshGantt();
	},

	// ************************************************************************************************************
	// *****
	// *****									Low level drawing methods
	// *****


	drawRightArrowInSVGGroup: function(group, x, y, size)	{
		path= document.createElementNS(this.svgns, "path");
		var d = "M "+x+" "+y+" L "+(x-size)+" "+(y-size/2)+" L "+(x-size)+" "+(y+size/2);
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "stroke", this.strokeColor);	
		group.appendChild(path);
	},

	drawLeftArrowInSVGGroup: function(group, x, y, size)	{
		path= document.createElementNS(this.svgns, "path");
		var d = "M "+x+" "+y+" L "+(x+size)+" "+(y-size/2)+" L "+(x+size)+" "+(y+size/2);
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "stroke", this.strokeColor);	
		group.appendChild(path);
	},

	drawDownArrowInSVGGroup: function(group, x, y, size)	{
		path= document.createElementNS(this.svgns, "path");
		var d = "M "+x+" "+y+" L "+(x-size/2)+" "+(y-size)+" L "+(x+size/2)+" "+(y-size);
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "stroke", this.strokeColor);	
		group.appendChild(path);
	},

	drawUpArrowInSVGGroup: function(group, x, y, size)	{
		path= document.createElementNS(this.svgns, "path");
		var d = "M "+x+" "+y+" L "+(x-size/2)+" "+(y+size)+" L "+(x+size/2)+" "+(y+size);
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "stroke", this.strokeColor);	
		group.appendChild(path);
	},

	drawLineFromRightOfRectToLeftOfRectInSVGGroup: function(svgGroup, startRect, endRect, width, color, zig)	{
		var offset = width <= 1 ? 0.5 : 0;
		var start = {	x: Math.floor(startRect.x+startRect.w)+offset, 
						y: Math.floor(startRect.y+startRect.h*0.5)+offset};
		var end   = {	x: Math.floor(endRect.x)+offset, 
						y: Math.floor(endRect.y+endRect.h*0.5)+offset};	
		var zigDistance = Math.floor(endRect.h*0.5+3);
		var connectThreshold = endRect.h
		path= document.createElementNS(this.svgns, "path");	
		path.setAttributeNS(null, "fill", "none");
		path.setAttributeNS(null, "stroke", color);	
		path.setAttributeNS(null, "stroke-width", width);			
		if(end.x - start.x > connectThreshold){
			var d = "M "+start.x+" "+start.y+" L "+(end.x-zigDistance)+" "+start.y+" L "+(end.x-zigDistance)+" "+end.y+" L "+end.x+" "+end.y;
			path.setAttributeNS(null, "d", d);
			svgGroup.appendChild(path);
			this.drawRightArrowInSVGGroup(svgGroup, end.x+1, end.y, 6);
		}else {	
			var sideEnd;
			if(end.y > start.y)
				sideEnd = {x:endRect.x, y:endRect.y};
			else
				sideEnd = {x:endRect.x, y:endRect.y+endRect.h};	
			sideEnd.x = Math.max(start.x, end.x) + zigDistance;
			if(zig || sideEnd.x>=endRect.x+endRect.w/2.0){				// um die Ecke malen
				var xBuf = zigDistance;
				var zigY = start.y < end.y ? end.y - xBuf : end.y + xBuf;
				var d = "M "+start.x+" "+start.y+" L "+(start.x+xBuf)+" "+start.y+" L "+(start.x+xBuf)+" "+zigY+" L "+(end.x-xBuf)+" "+zigY+" L "+(end.x-xBuf)+" "+end.y+" L "+end.x+" "+end.y;
				path.setAttributeNS(null, "d", d);
				svgGroup.appendChild(path);
				this.drawRightArrowInSVGGroup(svgGroup, end.x+1, end.y, 6);
			}else{
				var d = "M "+start.x+" "+start.y+" L "+sideEnd.x+" "+start.y+" L "+sideEnd.x+" "+sideEnd.y;
				path.setAttributeNS(null, "d", d);
				svgGroup.appendChild(path);
				if(end.y>start.y)
					this.drawDownArrowInSVGGroup(svgGroup, sideEnd.x, sideEnd.y+1, 6);
				else
					this.drawUpArrowInSVGGroup(svgGroup, sideEnd.x, sideEnd.y, 6);
			}
		}
	},

	drawLineFromLeftOfRectToLeftOfRectInSVGGroup: function(svgGroup, startRect, endRect, width, color)	{
		var offset = width <= 1 ? 0.5 : 0;
		var start = {	x:Math.floor(startRect.x)+offset, 
						y:Math.floor(startRect.y+startRect.h*0.5)+offset};
		var end   = {	x:Math.floor(endRect.x)+offset, 
						y:Math.floor(endRect.y+endRect.h*0.5)+1+offset};
		var minX = Math.min(start.x, end.x);
		var zigDistance = Math.floor(endRect.h*0.5+3);		
		path= document.createElementNS(this.svgns, "path");
		var d = "M "+start.x+" "+start.y+" L "+(minX-zigDistance)+" "+start.y+" L "+(minX-zigDistance)+" "+end.y+" L "+end.x+" "+end.y;
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "fill", "none");	
		path.setAttributeNS(null, "stroke", color);	
		path.setAttributeNS(null, "stroke-width", width);	
		svgGroup.appendChild(path);
		this.drawRightArrowInSVGGroup(svgGroup, end.x, end.y, 6);
	},

	drawLineFromRightOfRectToRightOfRectInSVGGroup: function(svgGroup, startRect, endRect, width, color)	{
		var offset = width <= 1 ? 0.5 : 0;
		var start = {	x:Math.floor(startRect.x+startRect.w)+offset, 
						y:Math.floor(startRect.y+startRect.h*0.5)+offset};
		var end   = {	x:Math.floor(endRect.x+endRect.w)+offset, 
						y:Math.floor(endRect.y+endRect.h*0.5)+offset};
		var maxX = Math.max(start.x, end.x);
		var zigDistance = Math.floor(Math.max(endRect.h, startRect.h)/2)+3;
		path = document.createElementNS(this.svgns, "path");
		var d = "M "+start.x+" "+start.y+" L "+(maxX+zigDistance)+" "+start.y+" L "+(maxX+zigDistance)+" "+end.y+" L "+end.x+" "+end.y;
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "fill", "none");	
		path.setAttributeNS(null, "stroke", color);	
		path.setAttributeNS(null, "stroke-width", width);	
		svgGroup.appendChild(path);
		this.drawLeftArrowInSVGGroup(svgGroup, end.x, end.y, 6);
	},

	drawLineFromLeftOfRectToRightOfRectInSVGGroup: function(svgGroup, startRect, endRect, width, color, zig)	{
		var offset = width <= 1 ? 0.5 : 0;
		var start = {	x: Math.floor(startRect.x)+offset, 
						y: Math.floor(startRect.y+startRect.h*0.5)+offset};
		var end   = {	x: Math.floor(endRect.x+endRect.w)+offset, 
						y: Math.floor(endRect.y+endRect.h*0.5)+offset};	
		var zigDistance = Math.floor(endRect.h*0.5+3);
		var connectThreshold = endRect.h;
		path= document.createElementNS(this.svgns, "path");	
		path.setAttributeNS(null, "fill", "none");	
		path.setAttributeNS(null, "stroke", color);	
		path.setAttributeNS(null, "stroke-width", width);		
		if(!zig && Math.abs(start.x - end.x) < connectThreshold){
			if(end.y > start.y)
				end.y = endRect.y;
			else
				end = endRect.y+endRect.h+1;		
			end.x = Math.min(start.x, end.x) - zigDistance;
			var d = "M "+start.x+" "+start.y+" L "+end.x+" "+start.y+" L "+end.x+" "+end.y;
			path.setAttributeNS(null, "d", d);
			svgGroup.appendChild(path);
			if(end.y>start.y)
				this.drawDownArrowInSVGGroup(svgGroup, end.x, end.y, 6);
			else
				this.drawUpArrowInSVGGroup(svgGroup, end.x, end.y, 6);
		}else if(start.x - end.x < connectThreshold){
			var xBuf = zigDistance;
			var zigY = start.y < end.y ? end.y - xBuf : end.y + xBuf;
			var d = "M "+start.x+" "+start.y+" L "+(start.x-xBuf)+" "+start.y+" L "+(start.x-xBuf)+" "+zigY+" L "+(end.x+xBuf)+" "+zigY+" L "+(end.x+xBuf)+" "+end.y+" L "+end.x+" "+end.y;
			path.setAttributeNS(null, "d", d);
			svgGroup.appendChild(path);
			this.drawLeftArrowInSVGGroup(svgGroup, end.x, end.y, 6);
		}else{
			var d = "M "+start.x+" "+start.y+" L "+(end.x+zigDistance)+" "+start.y+" L "+(end.x+zigDistance)+" "+end.y+" L "+end.x+" "+end.y;
			path.setAttributeNS(null, "d", d);
			svgGroup.appendChild(path);
			this.drawLeftArrowInSVGGroup(svgGroup, end.x, end.y, 6);
		}	
	},

	drawRelationship: function(relation, svgGroup) 	{
		var prevRect = this.connectShapeRects[relation.valueForKey("previousActivity").uri()];
		var nextRect = this.connectShapeRects[relation.valueForKey("nextActivity").uri()];
		var kind = relation.valueForKey("kind");
		var prevX = (kind == MEActivityRelationship.MEStartToStartRelationship || kind == MEActivityRelationship.MEStartToFinishRelationship) ? prevRect.x : prevRect.x+prevRect.w;
		var nextX = (kind == MEActivityRelationship.MEStartToStartRelationship || kind == MEActivityRelationship.MEFinishToStartRelationship) ? nextRect.x : nextRect.x+nextRect.w;
		var prevY = prevRect.y + prevRect.h/2;
		var nextY = nextRect.y + nextRect.h/2;
		var allowZig = relation.valueForKeyPath("nextActivity.isMilestone");
		var color = "black";
		var width = relation.valueForKey("isCritical") && this.viewOptions.showCriticalPath ? 1.5 : 0.5;
		

		if(kind == MEActivityRelationship.MEFinishToStartRelationship)
			this.drawLineFromRightOfRectToLeftOfRectInSVGGroup(svgGroup, prevRect, nextRect, width, color, allowZig);
		else if(kind == MEActivityRelationship.MEStartToStartRelationship)
			this.drawLineFromLeftOfRectToLeftOfRectInSVGGroup(svgGroup, prevRect, nextRect, width, color);
		else if(kind == MEActivityRelationship.MEFinishToFinishRelationship)
			this.drawLineFromRightOfRectToRightOfRectInSVGGroup(svgGroup, prevRect, nextRect, width, color);
		else if(kind == MEActivityRelationship.MEStartToFinishRelationship)
			this.drawLineFromLeftOfRectToRightOfRectInSVGGroup(svgGroup, prevRect, nextRect, width, color, allowZig);
	},
		

	// ************************************************************************************************************
	// *****
	// *****										Hig level drawing methods
	// *****


	drawGroup: function(x, y, width, completeWidth, height, fillColor, strokeColor, strokeWidth, shadow, group)	{
		var h = Math.floor(height/3.0);
		y = y + Math.floor((height-2*h)/2.0);
		if(shadow && this.drawShadows){
			var xs = x + 1;
			var ys = y + 2;
			var g = document.createElementNS(this.svgns, "rect");
			g.setAttributeNS(null, "x", xs-h);
			g.setAttributeNS(null, "y", ys);
			g.setAttributeNS(null, "width", width+h*2);
			g.setAttributeNS(null, "height", h);
			g.setAttributeNS(null, "fill", this.shadowColor);	
			g.setAttributeNS(null, "fill-opacity", this.shadowOpacity);	
			group.appendChild(g);	
			var path= document.createElementNS(this.svgns, "path");
			var d = "M "+(xs-h)+" "+(ys+h)+" l "+h+" "+h+" l "+h+" -"+h;
			path.setAttributeNS(null, "d", d);
			path.setAttributeNS(null, "fill", this.shadowColor);	
			path.setAttributeNS(null, "fill-opacity", this.shadowOpacity);	
			group.appendChild(path);						
			path= document.createElementNS(this.svgns, "path");
			d = "M "+(xs-h+width)+" "+(ys+h)+" l "+h+" "+h+" l "+h+" -"+h;		
			path.setAttributeNS(null, "d", d);
			path.setAttributeNS(null, "fill", this.shadowColor);	
			path.setAttributeNS(null, "fill-opacity", this.shadowOpacity);	
			group.appendChild(path);								
		}
		var g = document.createElementNS(this.svgns, "rect");
		g.setAttributeNS(null, "x", x-h);
		g.setAttributeNS(null, "y", y);
		g.setAttributeNS(null, "width", width+h*2);
		g.setAttributeNS(null, "height", h);
		g.setAttributeNS(null, "fill", fillColor);	
		g.setAttributeNS(null, "stroke", strokeColor);	
		g.setAttributeNS(null, "stroke-width",  strokeWidth);	
		group.appendChild(g);				
		if(completeWidth>0){
			var g = document.createElementNS(this.svgns, "rect");
			g.setAttributeNS(null, "x", x-h);
			g.setAttributeNS(null, "y", y);
			g.setAttributeNS(null, "width", completeWidth+h * (completeWidth >= width ? 2 : 1));
			g.setAttributeNS(null, "height", h);
			g.setAttributeNS(null, "fill", strokeColor);	
			group.appendChild(g);						
		}
		var path= document.createElementNS(this.svgns, "path");
		var d = "M "+(x-h-0.5)+" "+(y+h)+" l "+h+" "+h+" l "+h+" -"+h;
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "fill", strokeColor);	
		group.appendChild(path);						
		path= document.createElementNS(this.svgns, "path");
		d = "M "+(x-h+width+1-0.5)+" "+(y+h)+" l "+h+" "+h+" l "+h+" -"+h;
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "fill", strokeColor);	
		group.appendChild(path);		
	},

	drawMilestone: function(x, y, h, fillColor, strokeColor, strokeWidth, group)	{
		if(this.drawShadows) {
			var path= document.createElementNS(this.svgns, "path");
			var d = "M "+(x-h+2)+" "+(y+h+2)+" l "+h+" "+h+" l "+h+" -"+h+" l -"+h+" -"+h+" l -"+h+" "+h;
			path.setAttributeNS(null, "d", d);
			path.setAttributeNS(null, "fill", this.shadowColor);	
			path.setAttributeNS(null, "fill-opacity", this.shadowOpacity);	
			group.appendChild(path);						
		}
		var path= document.createElementNS(this.svgns, "path");
		var d = "M "+(x-h)+" "+(y+h)+" l "+h+" "+h+" l "+h+" -"+h+" l -"+h+" -"+h+" l -"+h+" "+h;
		path.setAttributeNS(null, "d", d);
		path.setAttributeNS(null, "fill", fillColor);	
		path.setAttributeNS(null, "stroke", strokeColor);	
		path.setAttributeNS(null, "stroke-width",  strokeWidth);	
		group.appendChild(path);	
	},
	
	drawBar: function(x, y, width, completeWidth, height, radius, fillColor, strokeColor, strokeWidth, shadow, group, dashed)	{
		if(shadow && this.drawShadows){
			var shadow = document.createElementNS(this.svgns, "rect");
			shadow.setAttributeNS(null, "x", x);
			shadow.setAttributeNS(null, "y", y);
			shadow.setAttributeNS(null, "width", width+2);
			shadow.setAttributeNS(null, "height", height+2);
			shadow.setAttributeNS(null, "rx", radius+2);
			shadow.setAttributeNS(null, "ry", radius)+2;
			shadow.setAttributeNS(null, "fill", this.shadowColor);	
			shadow.setAttributeNS(null, "fill-opacity", this.shadowOpacity);	
			group.appendChild(shadow);
		}
		var bar = document.createElementNS(this.svgns, "rect");
		bar.setAttributeNS(null, "x", x);
		bar.setAttributeNS(null, "y", y);
		bar.setAttributeNS(null, "width", width);
		bar.setAttributeNS(null, "height", height);
		bar.setAttributeNS(null, "rx", radius);
		bar.setAttributeNS(null, "ry", radius);
		bar.setAttributeNS(null, "fill", fillColor);	
		bar.setAttributeNS(null, "stroke", strokeColor);	
		bar.setAttributeNS(null, "stroke-width", strokeWidth);	
		if(dashed)
			bar.setAttributeNS(null, "stroke-dasharray", "2,2");
		group.appendChild(bar);
		if(completeWidth>0){
			var bar = document.createElementNS(this.svgns, "rect");
			bar.setAttributeNS(null, "x", x);
			bar.setAttributeNS(null, "y", y);
			bar.setAttributeNS(null, "width", completeWidth);
			bar.setAttributeNS(null, "height", height);
			bar.setAttributeNS(null, "fill", strokeColor);	
			group.appendChild(bar);
		}
	}
	
	
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("GanttVMLView.js");

var GanttVMLView = GanttView.extend({
	constructor: function(scrollView, container, ganttRuler, environment, drawShadows)
	{    
		this.base(environment, ganttRuler, scrollView, drawShadows);
		this.container = container;
		this.container.style.overflowX = "auto";
		this.rulerWidth = 0;
		this.outlineHeight= 0;	
		this.leftBorderSize = 20;
		this.rightBorderSize = 20;
		this.endDate = new Date();
		this.topLevelDiv = $(document.createElement("div"));
		this.topLevelDiv.style.position = "absolute";
		this.topLevelDiv.style.top = "0px";
		this.topLevelDiv.style.left = "0px";
		this.topLevelDiv.style.height = "10px";
		this.topLevelDiv.style.width = "10px";
		this.topLevelDiv.style.zIndex = 20;		
		this.handleClickInGanttEventListener = this.handleClickInGantt.bindAsEventListener(this);
		PWUtils.observe(this.topLevelDiv, "click", this.handleClickInGanttEventListener, true);
		this.container.appendChild(this.topLevelDiv);
	},

	_refreshGanttWithRows: function(rows, refreshAll)
	{
		this.refreshWillStart();	
		var oldLabelContainer = this.labelContainer;
		if(refreshAll){
			this.recreateLabelContainer();
			this.labelContainer.style.height = "1px";
			this.labelContainer.style.overflow = "hidden";
			this.drawnRows = [];
			this.drawnRelations = [];
			this.leftMargin = 0;	
			this.backgrounds = [];
			this.whiteBackgrounds = [];					
		}
		this.newLabels = [];
		var urisOfDrawnRows = [];
		var oldRowContainer = this.rowContainer;
		var oldRelationshipContainer = this.relationshipContainer;
		var oldBackgroundContainer = this.backgroundContainer;
		if(rows && rows.length){
			var canvasWidth = this.scrollView.ganttContainer.cachedOffsetWidth;
			if(refreshAll){
                var topStyle = !document.documentMode || document.documentMode<8 ? "-1px" : "-2px";
				var w = this.minCanvasWidthWithPreferedWidth(this.rulerWidth);
				var h = this.outlineHeight;
				this.rowContainer = $(document.createElement("v:group"));
				this.rowContainer.style.position = "absolute";
				this.rowContainer.style.top = topStyle;
				this.rowContainer.style.left = "0px";
				this.rowContainer.style.width = Math.max(w, 0)+"px";
				this.rowContainer.style.height = h+"px";
                this.rowContainer.setAttribute("coordsize", (w+" "+h));	 
				this.rowContainer.setAttribute("coordorigin", "0 0");	 
				this.relationshipContainer = $(document.createElement("v:group"));
				this.relationshipContainer.style.position = "absolute";
				this.relationshipContainer.style.top = topStyle;
				this.relationshipContainer.style.left = "0px";
				this.relationshipContainer.style.width = Math.max(w, 0)+"px";
				this.relationshipContainer.style.height = h+"px";					
				this.relationshipContainer.style.zIndex = "3";
				this.relationshipContainer.setAttribute("coordsize", (w+" "+h));	 
				this.relationshipContainer.setAttribute("coordorigin", "0 0");
				this.backgroundContainer = $(document.createElement("div"));
				this.backgroundContainer.style.position = "absolute";
				this.backgroundContainer.style.top = "0px";
				this.backgroundContainer.style.left = "0px";
				this.backgroundContainer.style.height = this.height() + "px";
				this.backgroundContainer.style.zIndex = -1;
				this.backgroundContainer.whiteSelectionDivs = [];				
			}else{
				this.rowContainer = oldRowContainer;
				this.relationshipContainer = oldRelationshipContainer;
				this.backgroundContainer = oldBackgroundContainer;
			}

			var row;
			var activity;
			var top;
			for(var i=0; i<rows.length; i++){
				row = rows[i];				
				activity = row.object;
				if(!this.connectShapeRects[activity.uri()])
					this.connectShapeRects[activity.uri()] = {};
				var uri = activity.valueForKey(WRLSnapshotURIKey);
				if(!this.drawnRows[uri]){
					urisOfDrawnRows.push(uri);
					this.drawnRows[uri] = row;
					row.cachedOffsetHeight = row.heightInPixel+2;
					top = row.cachedOffsetTop;
					if(uri == 0)
						this.endDate = activity.valueForKey("expectedEndDate");				
					this.createActivityInRow(activity, row, this.ruler, top, row.cachedOffsetHeight, canvasWidth, this.rowContainer);				
				}
			}
			this.calculateMinMax();
			if(urisOfDrawnRows.length)
				this.adjustLeftMargin(this.minX, this.minDate, this.maxX);			
			if(this.viewOptions.showRelationships){
				this.createRelationships(this.relationshipContainer, this.drawnRows);
			}			

			if(refreshAll){
				if(oldBackgroundContainer)
					this.container.replaceChild(this.backgroundContainer , oldBackgroundContainer);
				else
					this.container.appendChild(this.backgroundContainer );

				if(oldRowContainer)
					this.container.replaceChild(this.rowContainer , oldRowContainer);
				else
					this.container.appendChild(this.rowContainer );
				if(oldRelationshipContainer)
					this.container.replaceChild(this.relationshipContainer , oldRelationshipContainer);
				else
					this.container.appendChild(this.relationshipContainer);
				this.labelContainer.style.height = null;	
				this.labelContainer.style.overflow = "visible";

			}

		}
		this.refreshDidFinish();	
	},
	
	adjustLeftMargin: function(minX, minDate, maxX)
	{
		if(this.oldMinX != minX || this.oldMaxX != maxX || !this.oldMinDate.isEqual(minDate)){
			var oldActivityMinPos = this.ruler.dateToPos(this.minDate)-this.leftMargin;		
			var suggestedStartDate = this.ruler.posToDate(this.minX+this.leftMargin);		
			var suggestedEndDate = this.ruler.posToDate(this.maxX+this.leftMargin);						
			this.ruler.adjustFromDateToDateOnlyByExpanding(suggestedStartDate, suggestedEndDate, true);
			this.leftMargin = this.ruler.dateToPos(this.minDate)-oldActivityMinPos;		
			this.rowContainer.style.left = this.leftMargin+"px";
			this.relationshipContainer.style.left = this.leftMargin+"px";
			this.labelContainer.style.left = this.leftMargin + "px";		
			this.oldMinX = minX;
			this.oldMinDate = minDate;
			this.oldMaxX = maxX;				
			this.rulerWidthChanged(this.width());
		}
		this.refreshRuler();
	},

	rulerWidthChanged: function(width)
	{
		this.rulerWidth = width;	
		var w = this.minCanvasWidthWithPreferedWidth(width);
		this.cachedWidth = w;
		if(this.labelContainer)
			this.labelContainer.style.right = (this.scrollView.hasVerticalScrollbar() ? PWUtils.scrollbarWidth() : 0)+"px";
		if(this.backgroundContainer)
			this.backgroundContainer.style.width = Math.max(w, 0) + "px";
		this.topLevelDiv.style.width = Math.max(w, 0) + "px";
		this.scrollView.refreshRulerFillView();	
	},

	height: function()
	{
		return this.outlineHeight;
	},

	setHeight: function(height)
	{
		this.outlineHeight = height;
		this.topLevelDiv.style.height = height + "px";
		this.refreshGantt();
	},	

			
	// ************************************************************************************************************
	// *****
	// *****									Low level drawing methods
	// *****	

	drawRelationship: function(relation, group) 
	{
		var r1 = this.connectShapeRects[relation.valueForKey("previousActivity").uri()];
		var r2 = this.connectShapeRects[relation.valueForKey("nextActivity").uri()];
		var prevRect = {x:Math.floor(r1.x), y:Math.floor(r1.y), w:Math.floor(r1.w), h:Math.floor(r1.h)};
		var nextRect = {x:Math.floor(r2.x), y:Math.floor(r2.y), w:Math.floor(r2.w), h:Math.floor(r2.h)};
		var allowZig = relation.valueForKeyPath("nextActivity.isMilestone");
		var color = "black";
		var width = relation.valueForKey("isCritical") && this.viewOptions.showCriticalPath ? 2 : 1;
		var kind = relation.valueForKey("kind");
		
		if(kind == MEActivityRelationship.MEFinishToStartRelationship)
			this.drawLineFromRightOfRectToLeftOfRectInVMLGroup(group, prevRect, nextRect, width, color, allowZig);
		else if(kind == MEActivityRelationship.MEStartToStartRelationship)
			this.drawLineFromLeftOfRectToLeftOfRectInVMLGroup(group, prevRect, nextRect, width, color);
		else if(kind == MEActivityRelationship.MEFinishToFinishRelationship)
			this.drawLineFromRightOfRectToRightOfRectInVMLGroup(group, prevRect, nextRect, width, color);
		else if(kind == MEActivityRelationship.MEStartToFinishRelationship)
			this.drawLineFromLeftOfRectToRightOfRectInVMLGroup(group, prevRect, nextRect, width, color, allowZig);
	},

	drawShapeWithPathInVMLGroup: function(path, group, fillColor, strokeColor, shadow, strokeWidth)
	{
		var bar = document.createElement("v:shape");
		bar.style.position = "absolute";
		bar.style.top = "0px";
		bar.style.left = "0px";
		bar.style.width = group.style.width;
		bar.style.height = group.style.height;
		bar.setAttribute("fill", "true");	
		bar.setAttribute("fillcolor", fillColor);	
		bar.setAttribute("strokecolor", strokeColor);	
		bar.setAttribute("strokeweight", strokeWidth + "px");	
		bar.setAttribute("path", path);	
		var s = document.createElement('v:shadow'); 
		s.setAttribute("on", "t");	 
		s.setAttribute("type", "double");	 
		s.setAttribute("opacity", "0.3");	 
		s.setAttribute("offset", shadow ? "1px,1px" : "0px,0px");
		s.setAttribute("color", "#333333");	 
		s.setAttribute("color2", "#aaaaaa");
		s.setAttribute("offset2", shadow ? "3px,3px" : "0px,0px");
		bar.appendChild(s);
		group.appendChild(bar);	
	},
	 
	drawRightArrowInVMLGroup: function(group, x, y, size)
	{
		var path = "m "+x+" "+y+" l "+(x-size)+" "+(y-size/2)+" l "+(x-size)+" "+(y+size/2)+" l "+x+" "+y;
		GanttVMLView.drawPathInVMLGroup(path, group, this.fillColor, this.strokeColor, false, true, 1);
	},

	drawLeftArrowInVMLGroup: function(group, x, y, size)
	{
		var path = "m "+x+" "+y+" l "+(x+size)+" "+(y-size/2)+" l "+(x+size)+" "+(y+size/2)+" l "+x+" "+y;
		GanttVMLView.drawPathInVMLGroup(path, group, this.fillColor, this.strokeColor, false, true, 1);
	},

	drawDownArrowInVMLGroup: function(group, x, y, size)
	{
		var path = "m "+x+" "+y+" l "+(x-size/2)+" "+(y-size)+" l "+(x+size/2)+" "+(y-size)+" l "+x+" "+y;
		GanttVMLView.drawPathInVMLGroup(path, group, this.fillColor, this.strokeColor, false, true, 1);
	},

	drawUpArrowInVMLGroup: function(group, x, y, size)
	{
		var path = "m "+x+" "+y+" l "+(x-size/2)+" "+(y+size)+" l "+(x+size/2)+" "+(y+size);+" l "+x+" "+y;
		GanttVMLView.drawPathInVMLGroup(path, group, this.fillColor, this.strokeColor, false, true, 1);
	},

	drawLineFromRightOfRectToLeftOfRectInVMLGroup: function(vmlGroup, startRect, endRect, width, color, zig)
	{
		var start = {	x: Math.floor(startRect.x+startRect.w), 
						y: Math.floor(startRect.y+startRect.h*0.5)};
		var end   = {	x: Math.floor(endRect.x), 
						y: Math.floor(endRect.y+endRect.h*0.5)};

		var zigDistance = Math.floor(endRect.h/2 + 3);
		var connectThreshold = endRect.h
		if(end.x - start.x > connectThreshold){
			var d = "m "+start.x+" "+start.y+" l "+(end.x-zigDistance)+" "+start.y+" l "+(end.x-zigDistance)+" "+end.y+" l "+end.x+" "+end.y;
			GanttVMLView.drawPathInVMLGroup(d, vmlGroup, color, color, false, false, width);
			this.drawRightArrowInVMLGroup(vmlGroup, end.x, end.y, 6);
		}else{	
			var sideEnd;
			if(end.y > start.y)
				sideEnd = {x:endRect.x, y:endRect.y};
			else
				sideEnd = {x:endRect.x, y:endRect.y+endRect.h};	
			sideEnd.x = Math.max(start.x, end.x) + zigDistance;
			if(zig || sideEnd.x>=endRect.x+endRect.w/2.0){				// um die Ecke malen
				var xBuf = zigDistance;
				var zigY = start.y < end.y ? end.y - xBuf : end.y + xBuf;
				var d = "m "+start.x+" "+start.y+" l "+(start.x+xBuf)+" "+start.y+" l "+(start.x+xBuf)+" "+zigY+" l "+(end.x-xBuf)+" "+zigY+" l "+(end.x-xBuf)+" "+end.y+" l "+end.x+" "+end.y;
				GanttVMLView.drawPathInVMLGroup(d, vmlGroup, color, color, false, false, width);
				this.drawRightArrowInVMLGroup(vmlGroup, end.x, end.y, 6);
			}else{
				var d = "m "+start.x+" "+start.y+" l "+sideEnd.x+" "+start.y+" l "+sideEnd.x+" "+sideEnd.y;
				GanttVMLView.drawPathInVMLGroup(d, vmlGroup, color, color, false, false, width);
				if(end.y>start.y)
					this.drawDownArrowInVMLGroup(vmlGroup, sideEnd.x, sideEnd.y, 6);
				else
					this.drawUpArrowInVMLGroup(vmlGroup, sideEnd.x, sideEnd.y, 6);
			}
		}
	},

	drawLineFromLeftOfRectToLeftOfRectInVMLGroup: function(vmlGroup, startRect, endRect, width, color)
	{
		var start = {	x:Math.floor(startRect.x), 
						y:Math.floor(startRect.y+startRect.h/2)+1};
		var end   = {	x:Math.floor(endRect.x), 
						y:Math.floor(endRect.y+endRect.h/2)+1};
		var minX = Math.min(start.x, end.x);
		var zigDistance = Math.floor((endRect.h/2)+3);			
		var d = "m "+start.x+" "+start.y+" l "+(minX-zigDistance)+" "+start.y+" l "+(minX-zigDistance)+" "+end.y+" l "+end.x+" "+end.y;
		GanttVMLView.drawPathInVMLGroup(d, vmlGroup, color, color, false, false, width);
		this.drawRightArrowInVMLGroup(vmlGroup, end.x, end.y, 6);
	},

	drawLineFromRightOfRectToRightOfRectInVMLGroup: function(vmlGroup, startRect, endRect, width, color)
	{
		var start = {	x:Math.floor(startRect.x+startRect.w), 
						y:Math.floor(startRect.y+startRect.h/2)+1};
		var end   = {	x:Math.floor(endRect.x+endRect.w), 
						y:Math.floor(endRect.y+endRect.h/2)+1};
		var maxX = Math.max(start.x, end.x);
		var zigDistance = Math.floor(Math.max(endRect.h, startRect.h)/2)+3;
		var d = "m "+start.x+" "+start.y+" l "+(maxX+zigDistance)+" "+start.y+" l "+(maxX+zigDistance)+" "+end.y+" l "+end.x+" "+end.y;
		GanttVMLView.drawPathInVMLGroup(d, vmlGroup, color, color, false, false, width);
		this.drawLeftArrowInVMLGroup(vmlGroup, end.x, end.y, 6);
	},

	drawLineFromLeftOfRectToRightOfRectInVMLGroup: function(vmlGroup, startRect, endRect, width, color, zig)
	{	
		var start = {	x: Math.floor(startRect.x)+1, 
						y: Math.floor(startRect.y+startRect.h/2)+1};
		var end   = {	x: Math.floor(endRect.x+endRect.w), 
						y: Math.floor(endRect.y+endRect.h/2)+1};	
		var zigDistance = Math.floor(endRect.h/2 + 3);
		var connectThreshold = endRect.h;
		if(!zig && Math.abs(start.x - end.x) < connectThreshold){
			if(end.y > start.y)
				end.y = endRect.y;
			else
				end = endRect.y+endRect.h+1;		
			end.x = Math.min(start.x, end.x) - zigDistance;
			var d = "m "+start.x+" "+start.y+" l "+end.x+" "+start.y+" l "+end.x+" "+end.y;
			GanttVMLView.drawPathInVMLGroup(d, vmlGroup, color, color, false, false, width);
			if(end.y>start.y)
				this.drawDownArrowInVMLGroup(vmlGroup, end.x, end.y, 6);
			else
				this.drawUpArrowInVMLGroup(vmlGroup, end.x, end.y, 6);			
		}else if(start.x - end.x < connectThreshold){
			var xBuf = zigDistance;
			var zigY = start.y < end.y ? end.y - xBuf : end.y + xBuf;
			var d = "m "+start.x+" "+start.y+" l "+(start.x-xBuf)+" "+start.y+" l "+(start.x-xBuf)+" "+zigY+" l "+(end.x+xBuf)+" "+zigY+" l "+(end.x+xBuf)+" "+end.y+" l "+end.x+" "+end.y;
			GanttVMLView.drawPathInVMLGroup(d, vmlGroup, color, color, false, false, width);
			this.drawLeftArrowInVMLGroup(vmlGroup, end.x, end.y, 6);
		}else{
			var d = "m "+start.x+" "+start.y+" l "+(end.x+zigDistance)+" "+start.y+" l "+(end.x+zigDistance)+" "+end.y+" l "+end.x+" "+end.y;
			GanttVMLView.drawPathInVMLGroup(d, vmlGroup, color, color, false, false, width);
			this.drawLeftArrowInVMLGroup(vmlGroup, end.x, end.y, 6);
		}	
	},
	
	
	// ************************************************************************************************************
	// *****
	// *****										High level drawing methods
	// *****


	drawGroupTriangleInVMLGroup: function(x, y, width, h, color, shadow, group)
	{
		var path = "m "+(x-h)+" "+(y+h)+" r "+h+" "+h+" r "+h+" -"+h;
		this.drawShapeWithPathInVMLGroup(path, group,  color, color, shadow, 1);
		path = "m "+(x+width-h)+" "+(y+h)+" r "+h+" "+h+" r "+h+" -"+h;
		this.drawShapeWithPathInVMLGroup(path, group, color, color, shadow, 1);		
	},
	
	drawGroup: function(x, y, width, completeWidth, height, fillColor, strokeColor, strokeWidth, shadow, group)
	{
		var h = Math.floor(height/3.0);
		var x = Math.floor(x);
		var y = Math.floor(y);
		y += Math.floor((height-2*h)/2.0);		
		var width = Math.floor(width);
		var strokeWidth = Math.floor(strokeWidth);
		this.drawBar(x-h, y, width+2*h, completeWidth, h, 0, fillColor, strokeColor, strokeWidth, shadow, group);
		this.drawGroupTriangleInVMLGroup(x, y, width, h, strokeColor, shadow, group);
	},

	drawMilestone: function(x, y, h, backgroundColor, color, borderWidth, group)
	{
		x = Math.floor(x);
		y = Math.floor(y);
		h = Math.floor(h);
		borderWidth = Math.floor(borderWidth);
		var path = "m "+(x-h)+" "+(y+h)+" r "+h+" "+h+" r "+h+" -"+h+" r -"+h+" -"+h+" r -"+h+" "+h;
		this.drawShapeWithPathInVMLGroup(path, group, backgroundColor, color, true, borderWidth);			
	},
	
	drawBar: function(x, y, width, completeWidth, height, radius, fillColor, strokeColor, strokeWidth, shadow, group, dashed)
	{
		x = Math.floor(x);
		y = Math.floor(y);
		width = Math.floor(width);
		height = Math.floor(height);
		strokeWidth = Math.floor(strokeWidth);
		var bar = document.createElement("v:roundrect");
		bar.style.position = "absolute";
		bar.style.top = y+"px";
		bar.style.left = x+"px";
		bar.style.width = Math.max(width, 0)+"px";
		bar.style.height = height+"px";
		bar.setAttribute("fill", "true");
		bar.setAttribute("fillcolor", fillColor);	
		bar.setAttribute("strokecolor", strokeColor);	
		bar.setAttribute("strokeweight", strokeWidth + "px");	
		if(radius)
			bar.setAttribute("arcsize", 0.12);
		var s = document.createElement('v:shadow'); 
		s.setAttribute("on", "t");	 
		s.setAttribute("type", "double");	 
		s.setAttribute("opacity", "0.3");	 
		s.setAttribute("offset", shadow ? "1px,1px" : "0px,0px");
		s.setAttribute("color", "#333333");	 
		s.setAttribute("color2", "#aaaaaa");
		s.setAttribute("offset2", shadow ? "3px,3px" : "0px,0px");
		bar.appendChild(s);
		group.appendChild(bar);
	}
	
},

	// ************************************************************************************************************
	// *****
	// *****										Class Interface
	// *****

{
	drawPathInVMLGroup: function(path, group, fillColor, strokeColor, shadow, fill, strokeWeight)
	{
		var shape = document.createElement("v:shape");
		shape.style.position = "absolute";
		shape.style.top = "0px";
		shape.style.left = "0px";
		shape.style.width = group.style.width;
		shape.style.height = group.style.height;					
		shape.setAttribute("strokecolor", strokeColor);	
		shape.setAttribute("strokeweight", strokeWeight);	
		shape.setAttribute("fillcolor", fillColor);
		shape.setAttribute("path", path);
		if(!fill){
			var f = document.createElement('v:fill'); 
			f.setAttribute("on", "f");
			shape.appendChild(f);
		}
		var s = document.createElement('v:shadow'); 
		s.setAttribute("on", "t");	 
		s.setAttribute("type", "double");	 
		s.setAttribute("opacity", "0.3");	 
		s.setAttribute("offset", shadow ? "1px,1px" : "0px,0px");
		s.setAttribute("color", "#333333");	 
		s.setAttribute("color2", "#aaaaaa");
		s.setAttribute("offset2", shadow ? "3px,3px" : "0px,0px");
		shape.appendChild(s);
		group.appendChild(shape);	
	}
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("ActivitiesViewController");

var ViewController  = WRLObject.extend({
	constructor: function(context){
		this.base();
		this.moc = context;
	},
	
	rootProject: function() {
		if(!this._rootProject || this._rootProject.isInvalid) {
			var objects = Object.values(this.moc.registeredObjects);
			for(var i=0; i<objects.length; i++) {
				var object = objects[i];
				if(object.className() == "MEProject" && !object.valueForKey("linkedParentActivity")) {
                    this._rootProject = object;
					break;
				}
			}
		}
		return this._rootProject;
	},
	
	workspaceViewName: function() {
		return "";
	},
	
	getMenuContentForPart: function(part) {
		var rootProject = this.rootProject();
		var result = {enums:{}, order:[], pullDown:true, offsetLeft:-20, minWidth:100};
		var separatorIndex = 0;
		function appendContentForWorkspaces(result, workspaces){
			if(workspaces.length) {
				if (result.order.length) {
					var separatorKey = "//separator-"+(separatorIndex++);
					result.order.push(separatorKey);
					result.enums[separatorKey] = separatorKey;
				}
				workspaces.each(function(workspace){
					var uri = workspace.uri();
					var title = workspace.valueForKey("title")				
					result.order.push(uri);
					result.enums[uri] = title;
				});
			}		
		}
        
		appendContentForWorkspaces(result, MEWorkspace.filteredWorkspacesForSingleViewSinglePart(rootProject.valueForKey("bundledWorkspaces"), this.workspaceViewName(), part));
		appendContentForWorkspaces(result, MEWorkspace.filteredWorkspacesForSingleViewSinglePart(rootProject.valueForKey("globalWorkspaces"), this.workspaceViewName(), part));
		appendContentForWorkspaces(result, MEWorkspace.filteredWorkspacesForSingleViewSinglePart(rootProject.valueForKey("sortedWorkspaces"), this.workspaceViewName(), part));

		return result;
	},

	workspaceSelected: function(element, newValue) {
		if(!newValue.startsWith("separator-")) {
			var workspace = this.moc.registeredObjectWithURIString(newValue);
			if(workspace)
				this.applyWorkspaceMethod({workspaceURI:workspace.uri()});
		}
	},
	
	columnSetMenuContent: function() {
		return this.getMenuContentForPart("columnConfiguration");
	},

	styleSetMenuContent: function() {
		return this.getMenuContentForPart("styleList");
	},
	
    updateColumnSetButton: function() {
		if(this.columnSetButton){
			makePopUpMenuForElement(this.columnSetButton.parentNode, 0, this.columnSetMenuContent(), this.workspaceSelected, null, null, this.columnSetMenuContent, this);	    
        }
    },
    
	setColumnSetSelectionButtons: function(columnSetButton, applyWorkspaceMethod) {
		this.columnSetButton = columnSetButton;
		this.applyWorkspaceMethod = applyWorkspaceMethod;
        this.updateColumnSetButton();
	}
		
});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("ActivitiesViewController");

var	didRunQuicklookFix = false;

var ActivitiesViewController  = ViewController.extend({

	constructor: function(container, moc, controls, environment, styleList, viewOptions, columns, initialSortDescriptors, actionMethods, ruler, printPageURL, showPrintView, splitViewState, isBeingExportedForQuicklook){

		this.base(moc);
		this.initialSortDescriptors = initialSortDescriptors;
		this.splitViewState = parseFloat(eval('('+splitViewState+')'));
		this.showPrintView = showPrintView;
		this.className = "ActivitiesViewController";
		this.container = container;
		this.moc = moc;
		this.controls = controls;
		this.environment = environment;
		this.styleList = styleList;
		this.viewOptions = viewOptions;
		this.columns = columns;
		this.ruler = ruler;
		this.printPageURL = printPageURL;
		this.actionMethods = actionMethods;
		this.isBeingExportedForQuicklook = isBeingExportedForQuicklook;
		if(this.isVisible())	
			this.createSubviews();
		PWUtils.notificationCenter.addObserverForMessage(this, "rulerChanged", "handleRulerChangedNotification");
		if(this.isBeingExportedForQuicklook) {
			this.windowResizedActionEventListener = this.quicklookSplitterFix.bindAsEventListener(this);
			PWUtils.observe(window, "resize", this.windowResizedActionEventListener, true);
		}
	},

	createSubviews: function(){
		if(!this.outlineController){
			this.outlineController = new OutlineController(this.environment);
			this.outlineController.setChildrenKey("linkedSubActivities");
			this.outlineController.setSortDescriptors(this.initialSortDescriptors);				
			this.activitiesView = new ActivitiesView(this.outlineController, this.container, this.columns, this.styleList, this.ruler, this.viewOptions, this.environment, this.controls, this.moc, this.showPrintView, this, this.isBeingExportedForQuicklook);			
			this.setSplitViewState(this.splitViewState);
			if(this.splitterPosition)
				this.activitiesView.splitView.setSplitterPosition(this.splitterPosition);
			this.outlineController.setDelegate(this.activitiesView);
			//if(Prototype.Browser.IE)
				this.activitiesView.refresh();
			NotificationCenter.defaultNotificationCenter().addObserverForMessage(this, WRLAjaxContextChangedByServerNotification, "managedObjectContextChangedByServer");	
		}
	},

	managedObjectContextChangedByServer: function(msg, userInfo){
//                    console.log("Context changed");
		if(userInfo.context == this.moc){
			if(userInfo.result && (userInfo.result.deleted.length || userInfo.result.updated.length)) {
                this.activitiesView.refreshRuler();	
				this.activitiesView.refresh();
			}
		}
	},

	freezeSortOrder: function() {
		this.actionMethods.freezeSortOrder({sortDescriptors:Object.toJSON(this.outlineController.sortDescriptors)});
		this.moc.synchronize();			
		this.outlineController.setSortDescriptors([{key:'flatOrder', ascending: true}]);					
		this.refresh();
	},

	_addObject: function(method, position, targetActivities) {
		if(targetActivities.length) {
			if(this.isEditing())
				this.activitiesView.endEditing();
			var selectedActivitiesIDs = [];
			for (var i = 0; i < targetActivities.length; i ++ )
				selectedActivitiesIDs.push(targetActivities[i].objectID.uri);
			var opt = {selectedActivitiesIDs:selectedActivitiesIDs};
			if(position)
				opt.position=position;
			var objectID = method(opt);
			this.moc.synchronize();	
			var object = this.moc.registeredObjectWithURIString(objectID);
			if(object){
				this.outlineController.setSelectedObjectIDs([objectID]);
				this.activitiesView.refresh();
				var me = this;
				(function() { 
					me.activitiesView.outlineView.editSelectedRow(); 
				}).delay(0);
			}
		}
	},

	addObject: function(method, position){
		var selectedObjects = this.outlineController.selectedObjects;
		if(!selectedObjects || selectedObjects.length == 0) {
			var flatObjects = this.outlineController.getFlatObjects();
			selectedObjects = flatObjects.length ? [flatObjects[flatObjects.length-1]] : [];
		}
		this._addObject(method, position, selectedObjects);
	},

	addActivity: function(position){
		this.addObject(this.actionMethods.addActivity, position);
	},

	addMilestone: function(){
		this.addObject(this.actionMethods.addMilestone);
	},

	addAssignment: function(){
		this.addObject(this.actionMethods.addAssignment);
	},

	canAddActivity: function(){
		return this.activitiesView.canAddActivity();
	},
	
	canAddAssignment: function(){
		return this.activitiesView.canAddAssignment();	
	},

	canAddSubActivity: function(){
		return true;
	},
	
	canAddSuccessorActivity: function(){
		return true;
	},

	canAddPredecessorActivity: function(){
		return true;
	},

	canAddAuntActivity: function(){
		return true;
	},
		
	canChainActivities: function(){
		selectedObjects = this.selectedObjects();
		return selectedObjects && selectedObjects.length;
	},
	
	canDisconnectActivities: function(){
		selectedObjects = this.selectedObjects();
		return selectedObjects && selectedObjects.length;
	},
			
	deleteSelectedObjects: function(){
		var selectedActivitiesIDs = this.outlineController.selectedObjectIDs();
		if(selectedActivitiesIDs.length){
			this.actionMethods.deleteActivities({selectedActivitiesIDs:selectedActivitiesIDs});
			this.moc.synchronize();	
			this.outlineController.setSelectedObjects([]);
			this.activitiesView.refresh(true);
		}
	},

	canDeleteSelection: function() {
		return this.outlineController.selectedObjectIDs().length ? true : false;
	},
	
	selectAll: function() {
		var flatObjects = this.outlineController.getFlatObjects();
		if(flatObjects.length) {
			this.outlineController.setSelectedObjects(flatObjects);	
			this.refresh();
		}
	},

	indentOutdent: function(method){
		var parentIDs = this.activitiesView.parentIDs;
		var selectedActivitiesIDs = this.outlineController.selectedObjectIDs();
		if(selectedActivitiesIDs.length){
			this.activitiesView.endEditing();
			method({selectedActivitiesIDs:selectedActivitiesIDs, parentIDs:parentIDs});
			this.moc.synchronize();	
			this.activitiesView.refresh(true);
		}	
	},

	indentSelection: function(){
		this.indentOutdent(this.actionMethods.indentSelection);
	},

	outdentSelection: function(){
		this.indentOutdent(this.actionMethods.outdentSelection);
	},
	
	synchronizeManagedObjectContext: function(){
		this.moc.synchronize();
		this.activitiesView.refresh(true);		
	},
	
	refresh: function(){	
		this.activitiesView.refresh();		
	},
	
	zoomIn: function(){
		this.isInZoomAction = true;
		this.activitiesView.zoomIn();
		this.isInZoomAction = false;
	},
	
	zoomOut: function(){
		this.isInZoomAction = true;
		this.activitiesView.zoomOut();
		this.isInZoomAction = false;
	},

	selectedObjects: function(){
		return this.outlineController.selectedObjects;
	},
	
	shouldEditObjectProperty: function(object, key){
		if(object.className()=="MEAssignment" && key == "assignedResourcesString")
			return false;
		var result = this.actionMethods.shouldEditObjectProperty({objectID:object.objectID.uri, key:key});
		return eval(result);
	},
	
	validatePropertyOfObject: function(outline, property, object, validationDidEndHandler){
		this.validationDidEndHandler = validationDidEndHandler;	
		var propertyName;
		var value;
		for(propertyName in property){
			value = property[propertyName];
			break;
		}
		var result = this.actionMethods.validatePropertyOfObject({propertyName:propertyName, value:value, objectID:object.objectID.uri});
		validationDidEndHandler.call(outline, result);
	},
	
	closeDatePicker: function() {
		if(window["datePickerIsVisible"] && datePickerIsVisible()){
			closeCalendar();
			return true;
		}	
	},

	insertNewline: function(sender, evt){
		if(!this.closeDatePicker())
			this.activitiesView.outlineView.editSelectedRow();
		return true;
	},
	
	insertTab: function(sender, evt){
		if(!this.closeDatePicker())
			this.activitiesView.outlineView.editNextProperty();		
		return true;
	},
			
	moveLeft: function(sender, evt) {
		this.activitiesView.outlineView.setSelectedRowsCollapsed(true);
		return true;
	},

	moveRight: function(sender, evt) {
		this.activitiesView.outlineView.setSelectedRowsCollapsed(false);
		return true;
	},

	moveUp: function(sender, evt) {
		this.activitiesView.outlineView.selectPreviousRow(false);
		return true;
	},

	moveDown: function(sender, evt) {
		this.activitiesView.outlineView.selectNextRow(false);
		return true;
	},
	
	moveUpAndModifySelection: function(sender, evt){
		this.activitiesView.outlineView.selectPreviousRow(true);
		return true;
	},
  
	moveDownAndModifySelection: function(sender, evt){
		this.activitiesView.outlineView.selectNextRow(true);	
		return true;
	},
	
	clonedColumns: function(){
		var result = [];
		for(var i=0; i<this.columns.length; i++){
			result.push(this.columns[i].clone());
		}
		return result;
	},

	print: function(){
		var info = {};
		info.environment = this.environment;
		info.outlineSize = {	 width:this.activitiesView.outlineView.tableWidth(), 
								height:this.activitiesView.outlineView.fullHeight()};
		info.ganttSize	 = {	 width:this.activitiesView.ganttScrollView.width(), 
								height:this.activitiesView.ganttScrollView.fullHeight()};	
		info.ruler = this.activitiesView.ganttRuler.clone();
		info.columns = this.clonedColumns();
		info.styleList = this.styleList;
		info.viewOptions = this.viewOptions;
		info.moc = this.moc;		
		info.actionMethods = this.actionMethods;
		window.info = info;
		this.printWindow = window.open(Prototype.Browser.WebKit ? this.printPageURL : '', '','height=600, width=800, resizable=1, scrollbars=1');
		if(window.focus) 
			this.printWindow.focus();				
		if(!Prototype.Browser.WebKit){	
			this.printWindow.location = this.printPageURL;
		}

		/*	This variables are used in the utilization view

			info.moc	
			info.environment
			info.styleList
			info.viewOptions
			info.columns
			info.ruler
		*/
	},
	
	isVisible: function(){
		var style = PWUtils.effectiveStyle(this.container);
		return style.display != "none";
	},
	
	setIsVisible: function(flag){
		var wasVisible = this.isVisible();
		this.container.style.display = flag ? "block" : "none";
		if(flag && !wasVisible){	//disableContent
			this.createSubviews();
			this.activitiesView.splitView.windowResizedAction();
			if(this.refreshRuler){
				this.refreshRuler = false;
				this.activitiesView.refreshRuler();
			}
			if(!this.lastModificationDate || this.moc.modificationDate.getTime() != this.lastModificationDate.getTime())
				this.refresh();
		}else if(!flag && wasVisible)
			this.lastModificationDate = new Date(this.moc.modificationDate.getTime());
		if(this.activitiesView)
			this.activitiesView.setIsVisible(flag);
	},
	
	visibleGanttChanged: function(startDate, endDate) {
	
	},
	
	handleRulerChangedNotification: function(msg, ruler){
		if(ruler != this.ruler){
			if(this.ruler.pixelsPerDay != ruler.pixelsPerDay){
				this.ruler.setPixelsPerDay(ruler.pixelsPerDay);
				if(!this.isVisible())
					this.refreshRuler = true;
			}
		}
	},
	
	chainActivities: function(kind) {
		var activities = this.selectedObjects();
		if(activities.length) {
			var activityIDs = activities.collect(function(activity){
				return activity.uri();
			});
			this.actionMethods.chainActivities({activityIDs:activityIDs, kind:kind});
			this.moc.synchronize();
			this.refresh();
		}
	},
	
	chainFinishStart: function() {
		this.chainActivities(MEActivityRelationship.MEFinishToStartRelationship);
	},
	
	chainFinishFinish: function() {
		this.chainActivities(MEActivityRelationship.MEFinishToFinishRelationship);
	},
	
	chainStartFinish: function() {
		this.chainActivities(MEActivityRelationship.MEStartToFinishRelationship);
	},
	
	chainStartStart: function() {
		this.chainActivities(MEActivityRelationship.MEStartToStartRelationship);
	},
	
	disconnectActivities: function() {
		var activities = this.selectedObjects();
		if(activities.length) {
			var activityIDs = activities.collect(function(activity){
				return activity.uri();
			});
			this.actionMethods.disconnectActivities({activityIDs:activityIDs});
			this.moc.synchronize();
			this.refresh();
		}
	},
	
	// ************************************************************************************************************
	// *****
	// *****										Drag and Drop
	// *****

	canDragBetweenItems: function(pasteboard) {
		var result = false;
		if(this.outlineController.sortDescriptors && this.outlineController.sortDescriptors.length){
			var sortDescriptor = this.outlineController.sortDescriptors[0];
			if(sortDescriptor.key == 'flatOrder' || sortDescriptor.key == 'wbs') {
				result = true;
				var onlyAssignments = true;
				var rows = pasteboard[0].data;
				for(var i=0; i<rows.length; i++){
					var row = rows[i];
					if(row.object.className() != "MEAssignment"){
						onlyAssignments = false;
						break;
					}
				};
				if(onlyAssignments)
					result = false;				
			}
		}
		return result;
	},

	canDropOnTarget: function(target, pasteboard, area){
		var result = false;
		var rows = pasteboard[0].data;
		if(!(rows.length == 1 && target == rows[0].object)) {
			for(var i=0; i<rows.length; i++){
				var row = rows[i];
				if(!row.object.isAncestorOf(target)){
					result = true;
					break;
				}
			};
			if(target.isGroup() && area == "bottom"){
				result = this.canDropOnTarget(target.valueForKey("linkedSubActivities")[0], pasteboard, "middle");
			}
		}
		return result;
	},

	dropAreaFromLocation: function(location, pasteboard) {
		return this.canDragBetweenItems(pasteboard) ? (location.row == OutlineView.MOUSE_IS_NOT_IN_ROW ? 'middle' : location.area) : 'middle';
	},
	
	outlineShouldDragRows: function(outline, rows){
		return true;
	},
		
	outlineValidateDrop: function(outline, location, pasteboard){		
		if(location.row && location.row.object && location.row != OutlineView.MOUSE_IS_NOT_IN_OUTLINE){
			if(this.canDropOnTarget(location.row.object, pasteboard, location.area))
				return {accept:true, area:this.dropAreaFromLocation(location, pasteboard)};
		}
		return {accept:false};
	},

	outlineAcceptDrop: function(outline, location, pasteboard){
		if(location.row && location.row != OutlineView.MOUSE_IS_NOT_IN_OUTLINE && pasteboard.length){
			var objectIDs = [];
			var rows = pasteboard[0].data;
			rows.each(function(row){
				if(row.object)
					objectIDs.push(row.object.uri());
			});
			if(objectIDs.length){				
				var targetActivityID = location.row.object && location.row.object.uri ? location.row.object.uri() : "no_activity";
				this.actionMethods.acceptDrop({objectIDs:objectIDs, targetActivityID:targetActivityID, area:this.dropAreaFromLocation(location, pasteboard)});
				this.moc.synchronize();	
				this.activitiesView.refresh(true);
			}
		}
	},

	outlineDoubleClickInEmptyArea: function(outline, event) {
		var flatObjects = this.outlineController.getFlatObjects();
		var targetActivities = flatObjects.length ? [flatObjects[flatObjects.length-1]] : [];		
		this._addObject(this.actionMethods.addActivity, null, targetActivities);
		Event.stop(event);
	},

	canIndentActivity: function(){
		return this.activitiesView.canIndentActivity();
	},

	canOutdentActivity: function(){
		return this.activitiesView.canOutdentActivity();	
	},

	collapseAll: function() {
		this.activitiesView.collapseAll();
	},

	expandAll: function() {
		this.activitiesView.expandAll();
	},
	
	hideAllAssignments: function() {
		this.activitiesView.hideAllAssignments();
	},

	showAllAssignments: function() {
		this.activitiesView.showAllAssignments();
	},
	
	showOutlineLevel: function(level) {
		this.activitiesView.showOutlineLevel(level);
	},

	selectedObjectsThatCanBeTransformedIntoMilestones: function() {
		return this.selectedObjects().reject(function(object){
				return object.className() == "MEAssignment" || (!object.hasAssignments() && object.isGroup()) || object.valueForKey('isMilestone');
		}, this);
	},
	
	canTransformSelectedActivitiesIntoMilestones: function() {
		return this.selectedObjectsThatCanBeTransformedIntoMilestones().length;
	},
	
	transformSelectedActivitiesIntoMilestones: function() {
		var activities = this.selectedObjectsThatCanBeTransformedIntoMilestones();
		if(activities.length) {
			var activityIDs = activities.collect(function(activity){
				return activity.uri();
			});
			this.actionMethods.transformActivitiesIntoMilestones({activityIDs:activityIDs});
			this.moc.synchronize();
			this.refresh();
		}
	},
	
	selectedObjectsThatHaveActualValues: function() {
		return this.selectedObjects();	// TODO
	},

	canClearActualValues: function() {
		var selectedObjects = this.selectedObjectsThatHaveActualValues();
		return selectedObjects && selectedObjects.length;
	},
	
	clearActualValues: function() {
		var selectedObjects = this.selectedObjectsThatHaveActualValues();
		if(selectedObjects && selectedObjects.length) {
			var activityIDs = selectedObjects.collect(function(activity){
				return activity.uri();
			});
			this.actionMethods.clearActualValues({activityIDs:activityIDs});
			this.moc.synchronize();
			this.refresh();	
		}
	},

	isEditing: function() {
		return this.activitiesView.outlineView.isEditing();
	},
	
	testAddActivity: function() {	// Test
		var flatObjects = this.outlineController.getFlatObjects();
		var opt = flatObjects.length ? {selectedActivitiesIDs:[flatObjects[flatObjects.length-1].objectID.uri]} : null;
		var objectID = this.actionMethods.addActivity(opt);
		this.moc.synchronize();			
		return this.moc.registeredObjectWithURIString(objectID);
	},

	mainViewWidth: function() {
		if(this.isVisible())
			return this.container.offsetWidth;
		else {	
			var mainViews = $$(".mainView");
			for(var i=0; i<mainViews.length; i++) {
				var mainView = mainViews[i];
				if(mainView.offsetWidth)
					return mainView.offsetWidth;
			}
		}
	},

	splitterPositionFromRatio: function(ratio) {
		if(ratio == 0.0)
			return -4;
		if(ratio>1.0)
			ratio=1.0;
		var pos = (this.mainViewWidth() - 7) * ratio;
		pos = pos >= 0 ? pos : 0;	
		return pos;
	},
	
	columnsFromWorkspaceData: function(workspaceData) {
		return eval(workspaceData.columns);
	},
	
	_applyWorkspace: function(workspaceData) {
		this.styleList = eval('('+workspaceData.styleList+')');
		this.columns = this.columnsFromWorkspaceData(workspaceData);
		this.viewOptions = eval('('+workspaceData.viewOptions+')');
		if(workspaceData.splitViewState)
			this.setSplitViewState(workspaceData.splitViewState);

		if(this.activitiesView) {
			this.activitiesView.setRootActivities(this.activitiesView.rootObjectsInManagedObjectContext(this.moc), false);
			this.activitiesView.setStyleList(new StyleList(this.styleList, this.environment));
			this.activitiesView.setColumns(this.columns);
			this.activitiesView.setViewOptions(this.viewOptions);
			this.activitiesView.splitView.setSplitterPosition(this.splitterPosition);
			this.refresh();
			this.activitiesView.containerSizeChanged();
		}	
	},
	
	fetchWorkspace: function() {
		var wd = this.actionMethods.getWorkspaceData({});
		var workspaceData = eval('('+wd+')');
		this._applyWorkspace(workspaceData);
	},
	
	_setSplitViewState: function(splitViewState) {
		this.splitViewState = splitViewState;
		this.splitterPosition = this.splitterPositionFromRatio(splitViewState);
		if(this.activitiesView)
			this.activitiesView.splitView.setSplitterPosition(this.splitterPosition);	
	},
	
	setSplitViewState: function(splitViewState) {
		this._setSplitViewState(splitViewState);
		this.quicklookSplitViewState = splitViewState;
	},

	quicklookSplitterFix: function(event) {
		if(!didRunQuicklookFix) {
			didRunQuicklookFix = true;
			this._setSplitViewState(this.quicklookSplitViewState);
		}
	},
	
	workspaceViewName: function() {
		return "activitiesViewController";
	},	

	loadProjectLink: function(projectLink) {
		var result = this.actionMethods.loadProjectLink({objectID:projectLink.objectID.uri});		
		result = eval("("+result+")");
		if(!result.loaded) {
			if(result.error == MEProjectLink.CouldNotAccessProject) {
				var me  = this;
				var onValidate = function(username, password, context) {
					result = me.actionMethods.loadProjectLink({objectID:projectLink.objectID.uri, username:username, password:password});		
					result = eval("("+result+")");
					return result.loaded;
				} 
				var title = stringWithFormat(this.environment.localizedString("Login to project '%@'"), projectLink.valueForKey('title'));
				runLoginDialog(title, onValidate, null, this.environment);		
			}else if(result.error == MEProjectLink.ProjectLinkCouldNotFindTargetProject) {
				runAlert(this.environment.localizedString("ProjectLinkCouldNotFindTargetProject"), null, this.environment.images.MerlinWarning);
			}
		}
		return result.loaded;
	},

	// ************************************************************************************************************
	// *****
	// *****										Test methods
	// *****
	
	selectActivities: function(activities) {
		this.outlineController.setSelectedObjects(activities);
		this.activitiesView.outlineDidChangeSelection();
		this.refresh();
		var rows = this.activitiesView.outlineView.selectedRows();
		this.activitiesView.outlineView.scrollToRow(rows[activities.length-1]);
	}
	
});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("UtilizationView");

var UtilizationView = ActivitiesView.extend({
	constructor: function(outlineController, domNode, columns, styleList, ganttRuler, viewOptions, environment, controlsContainer, managedObjectContext, showPrintView, delegate){
		this.base(outlineController, domNode, columns, styleList, ganttRuler, viewOptions, environment, controlsContainer, managedObjectContext, showPrintView, delegate);
		this.outlineView.outlineColumnPadding = 13;
	},

	rootObjectsInManagedObjectContext: function(moc){
		var result = [];
		if(moc){
			for(var key in moc.registeredObjects){
				var object = moc.registeredObjects[key]; 
				if(object.className() == "MEProject" && !object.valueForKey("linkedParentActivity") && !object.valueForKey("projectLink")) {
					result = object.valueForKey("masterResources");
					break;
				}
			}
		}
		return result;
	},
	
	outlineShouldDragRows: function(outline, rows){
		return false;
	},
	
	outlineViewDidCreateDisclosureButtonForRow: function(outline, button, row){
	
	},
	
	outlineHeightForRow: function(outline, row){
		var height = this.base(outline, row);
		if(!height)
			height = 24;
		return height;
	},

	outlineDidCreateCellInRow: function(outline, cell, row, editMode){
		if(cell.column == outline.outlineColumn){
			if(row.object.className() == "MEAssignment" || row.object.className() == "MEActivity"){
				this.base(outline, cell, row, editMode);
				cell.style.paddingLeft = (parseInt(cell.style.paddingLeft)+9)+'px';
				cell.style.width = (parseInt(cell.style.width)-9)+'px';
			}else if(row.object.className() == "MEMasterResource"){
				var imagePath = row.object.valueForKey('resources').length ? this.environment.images.Resource : this.environment.images.Activity;
//				var style = "vertical-align:middle; margin-left:"+(3+(row.object.isLeaf() ? 9 : 0))+"px; margin-right:2px;";
				var style = "vertical-align:middle; margin-left:"+ 3 +"px; margin-right:2px;";
				var image = IMG({width:15, height:14, src:imagePath, style:style});
				cell.appendChild(image);
				cell.style.fontWeight='bold';
			}
		}
	},
	
	setColumns: function(columns){
		this.columns = columns;
		this.outlineView.setColumnsAndOutlineColumnKey(columns, "utilizationTitle");
	},
	
	outlineHeightForRow: function(outline, row){
		var height = this.base(outline, row);
		return Math.max(height, 18);
	},
	
	displayGraphs: function(){
		return true;
	},
	
	refresh: function(refreshSelection){
		this.setRootActivities(this.rootObjectsInManagedObjectContext(this.moc), true);
		this.base(refreshSelection);	
	}
				
	
});// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("UtilizationViewController");

var	MECumulationParameterUtilisation = 0;
var	MECumulationParameterWorkingUnits = 1;
var	MECumulationParameterPossibleWorkingUnits = 2;
var	MECumulationParameterWorkingUnitsOverPossibleWorkingUnits = 3;
var	MECumulationParameterBracket = 4;
var	MECumulationParameterActualWorkingUnits = 5;
var	MECumulationParameterRemainingWorkingUnits = 6;

var UtilizationViewController = ActivitiesViewController.extend({
	constructor: function(container, moc, controls, environment, styleList, viewOptions, columns, initialSortDescriptors, actionMethods, ruler, printPageURL, showPrintView, splitViewState, isBeingExportedForQuicklook){
		this.replaceKeyForTitleColumnInColumns(columns);
		this.base(container, moc, controls, environment, styleList, viewOptions, columns, initialSortDescriptors, actionMethods, ruler, printPageURL, showPrintView, splitViewState);
		this.className = "UtilizationViewController";
		this.displayBrackets = false;
		this.isBeingExportedForQuicklook = isBeingExportedForQuicklook;
		if(this.isBeingExportedForQuicklook)
			PWUtils.notificationCenter.removeObserverForMessage(this, "rulerChanged");	
	},
		
	createSubviews: function(){
		if(!this.outlineController){
			this.outlineController = new OutlineController(this.environment);
			this.outlineController.setChildrenKey("assignments");
			this.outlineController.setSortDescriptors(this.initialSortDescriptors);
			this.outlineController.setDelegate(this.activitiesView);
			this.activitiesView = new UtilizationView(this.outlineController, this.container, this.columns, this.styleList, this.ruler, this.viewOptions, this.environment, this.controls, this.moc, this.showPrintView, this);
			this.setSplitViewState(this.splitViewState);
			if(this.splitterPosition)
				this.activitiesView.splitView.setSplitterPosition(this.splitterPosition);
			NotificationCenter.defaultNotificationCenter().addObserverForMessage(this, WRLAjaxContextChangedByServerNotification, "managedObjectContextChangedByServer");	
		}
	},
	
	replaceKeyForTitleColumnInColumns: function(columns){
		for(var i=0; i<columns.length; i++){
			var column = columns[i];
			if(column.key == "title"){
				column.key="utilizationTitle";
				column.prototypeSortDescriptors = [ {key: "utilizationTitle", ascending: true}];
				column.editable = false;
				column.disableReversedSortDescriptors = true;
				break;
			}
		}
	},

	visibleGanttChanged: function(startDate, endDate) {
		if(this.activitiesView){
			this.activitiesView.ganttScrollView.ganttView.requestGraphValues();
		}
	},

	// Methods for graphs:

	displayGraphs: function(){
		return true;
	},

	showGraphForObject: function(object){
		var result = false;
		if(object.className() == "MEMasterResource"){
			return !(this.viewOptions.cumulationParameter == MECumulationParameterBracket && object.valueForKey("resources").length);
		}
		return result;
	},

	graphValuesReceived: function(result){
		this.graphValuesReceivedMethod.call(this.graphValuesReceivedObject, eval("("+result.responseText+")"));
	},
	
	requestGraphValues: function(request, method, sender){
		this.graphValuesReceivedMethod = method;		
		this.graphValuesReceivedObject = sender;
		this.actionMethods.graphValuesForRequest({request:Object.toJSON(request)});
	},
	
	isInLayoutChangingAction: function() {
		return (this.activitiesView && this.activitiesView.outlineView && this.activitiesView.outlineView.inCollapseAction) || this.isInZoomAction;
	},
	
	graphTextForBlock: function(graphObject, block, width) {
		var result = block.string;
		if(this.viewOptions.cumulationParameter == MECumulationParameterUtilisation){			
			if(width < 19 && result.length > 2)
				result = result.substr(0, 2);
			else if (width < 28 && result.length > 3)
				result = result.substr(0, 3);
			return result;		
		}
		return result;
	},
	
	willDrawGraphBlock: function(graphObject, block) {
		var color = "#ffd14f"; // Gelb
		if(block.value > graphObject.overThreshold)
			color = "#f16767"; // Rot
		else if(block.value >= graphObject.underThreshold)
			color = "#80be67"; // Grün
		block.div.style.backgroundColor = color;
	},
	
	requestGraphValuesForObject: function(graphObject) {
		var resources = graphObject.object.valueForKey("resources");
		return resources && resources.length;
	},
	
	barColorForObject: function(object, isGroup){
		if(object.className() == "MEMasterResource")
			return {color:"#1457CF" , backgroundColor:"#98B2F3"};
		return null;
	},

	columnsFromWorkspaceData: function(workspaceData) {
		var columns = eval('('+workspaceData.columns+')');
		this.replaceKeyForTitleColumnInColumns(columns);
		return columns;
	},
	
	outlineDoubleClickInEmptyArea: function(outline, event) {

	},

	workspaceViewName: function() {
		return "utilisationViewController";
	}
	
	
	
});
// Copyright 2008 ProjectWizards GmbH. All rights reserved.

//console.log("ResourcesViewController");

var ResourcesViewController = ViewController.extend({
	constructor: function(container, moc, environment, styleList, columns, initialSortDescriptors, actionMethods, addResourceButton, addResourceGroupButton, printPageURL, splitViewState, isBeingExportedForQuicklook){
		this.base(moc);
		this.initialSortDescriptors = initialSortDescriptors;
		this.printPageURL = printPageURL;
		this.addResourceButton = PWUtils.makeMultiStateButton(addResourceButton);
		this.addResourceGroupButton = PWUtils.makeMultiStateButton(addResourceGroupButton);
		this.actionMethods = actionMethods;
		this.container = container;
		this.moc = moc;
		this.environment = environment;
		this.styleList = styleList;
		this.columns = columns;
		this.splitView = new SplitView(this.container, 200, 9, 6, 110, 300, true);
		var groupsContainer = DIV({'class':'recourcesGroupsContainer'});
		var resourcesContainer = DIV({'class':'recourcesContainer'});
		this.splitView.firstDiv.appendChild(groupsContainer);
		this.splitView.secondDiv.appendChild(resourcesContainer);
		this.splitView.setDelegate(this);

		// Resources
		this.resourcesOutlineController = new OutlineController(environment);
		this.resourcesOutlineController.setSortDescriptors(this.initialSortDescriptors);
		this.resourcesOutlineView = new OutlineView(resourcesContainer, this.resourcesOutlineController, 20, null, true, environment, false, this);
		this.isBeingExportedForQuicklook = isBeingExportedForQuicklook;
		if(this.isBeingExportedForQuicklook)
			this.resourcesOutlineView.setEnableDrags(false);
		this.resourcesOutlineView.setColumnsAndOutlineColumnKey(columns, 'title');
		this.resourcesOutlineView.setHeaderHeight(36);
		this.resourcesOutlineView.setYScrollBarType("auto");
		
		// Resource Groups
		this.groupsOutlineController = new OutlineController(environment);
		this.groupsOutlineController.setSortDescriptors([{key:'title', ascending: true}]);
		this.groupsOutlineController.setChildrenKey('resourceGroups');
		this.groupsOutlineView = new OutlineView(groupsContainer, this.groupsOutlineController, 20, null, true, environment, false, this);
		if(this.isBeingExportedForQuicklook)
			this.groupsOutlineView.setEnableDrags(false);
		this.groupsOutlineView.setSingleSelection(true);
		this.groupsOutlineView.setShowsHeader(false);
		this.groupsOutlineView.setAlternateRows(false);
		this.groupsOutlineView.setColumnsAndOutlineColumnKey([new TableColumn('title', 'Title', '', 230, 1, 'l', 'l')], 'title');

		this.groupsOutlineView.setYScrollBarType("auto");
		this.groupsOutlineView.setXScrollBarType("hidden");


//		this.groupsOutlineView.setEnableScrollBars(false);
		this.groupsOutlineView.outlineColumnPadding = 5;
		this.setProjects(this.projectsInManagedObjectContext());
		this.groupsOutlineView.refresh();
		this.groupsOutlineView.selectNextRow();
		this.updateControlsEnabledStatus();
		NotificationCenter.defaultNotificationCenter().addObserverForMessage(this, WRLAjaxContextChangedByServerNotification, "managedObjectContextChangedByServer");	

		this.setSplitViewState(splitViewState);
	},
	
	updateTooltip: function(){
		Tooltip.attach(this.groupsButton, this.splitView.isFirstViewVisible() ? this.hideGroupsText : this.showGroupsText);
	},

	setGroupButtonShowHideText: function(button, showText, hideText){
		this.groupsButton = button;
		this.showGroupsText = showText;
		this.hideGroupsText = hideText;
		this.updateTooltip();	
	},

	canAddResourceGroups: function(){
		return this.groupsOutlineController.selectedObjects.length == 1;
	},

	canAddResources: function(){
		return this.groupsOutlineController.selectedObjects.length == 1;		
	},

	updateControlsEnabledStatus: function(){
		if(this.addResourceButton)
			this.addResourceButton.setEnabled( this.canAddResources() );
		if(this.addResourceGroupButton)
			this.addResourceGroupButton.setEnabled( this.canAddResourceGroups() );
	},

	managedObjectContextChangedByServer: function(msg, userInfo){
		if(userInfo.context == this.moc){
			if(userInfo.result && (userInfo.result.deleted.length || userInfo.result.updated.length)) {
				this.refresh();
			}
		}
	},

	selectAll: function() {
		if(this.focusedOutlineView) {
			var flatObjects = this.focusedOutlineView.controller.getFlatObjects();
			if(flatObjects.length) {
				this.focusedOutlineView.controller.setSelectedObjects(flatObjects);	
				this.refresh();
			}
		}
	},

	refresh: function() {
		this.setProjects(this.projectsInManagedObjectContext());

        if(this.didSelectFirstGroupItem != true && this.groupsOutlineView.rows().length > 1){
            this.didSelectFirstGroupItem = true;
            this.groupsOutlineView.selectRows([this.groupsOutlineView.rowAtIndex(0)]);
        }

		this.setResources(this.visibleResources());
		this.updateControlsEnabledStatus();		
	},

	projectsInManagedObjectContext: function() {
		var result = [];
		for(var key in this.moc.registeredObjects){
			var object = this.moc.registeredObjects[key]; 
			if(object.className() == "MEProject")
				result.push(object);
		}
		if(result.length > 1)
			result.push(new AllProjectsItem(this.moc, this.environment));
		return result;		
	},

	mainProject: function(){
		var projects = [];
		var projectLinks = [];
		for(var key in this.moc.registeredObjects){
			var object = this.moc.registeredObjects[key]; 
			if(object.className() == "MEProject")
				projects.push(object);
			else if(object.className() == "MEProjectLink")
				projectLinks.push(object);
		}
		projectLinks.each(function(projectLink){
			projects = projects.without(projectLink.valueForKey("targetProject"));
		});
		return projects[0];
	},

	setResources: function(resources) {
		this.resourcesOutlineController.setRootObjects(resources);
		if(this.isVisible())
			this.resourcesOutlineView.refresh();
	},

	setProjects: function(projects) {
		this.groupsOutlineController.setRootObjects(projects);
		if(this.isVisible())
			this.groupsOutlineView.refresh();
	},

	isVisible: function(){
		var style = PWUtils.effectiveStyle(this.container);
		return style.display != "none";
	},

	setIsVisible: function(flag){
		this.groupsOutlineView.setEnableDrops(flag);
		this.container.style.display = flag ? "block" : "none";
		if(flag){
			this.resourcesOutlineView.refresh();
			this.groupsOutlineView.refresh();
		}
	},
	
	addResource: function() {
		if(this.groupsOutlineController.selectedObjects.length){
			var group = this.groupsOutlineController.selectedObjects[0];
			var project;
			if(group.className() != "MEResourceGroup"){
				if(group.className() == "MEProject")
					project = group;
				else 
					group = project = this.mainProject();	// AllProjectsItem
			}else
				project = group.valueForKey("project");
			var request = {project:project.uri()};
			if(project != group)
				request.group = group.uri();
			var objectID = this.actionMethods.addResource(request);
			this.moc.synchronize();	
			var object = this.moc.registeredObjectWithURIString(objectID);
			if(object){
				this.setResources(this.visibleResources());
				this.resourcesOutlineController.setSelectedObjectIDs([objectID]);
				this.focusOutlineView(this.resourcesOutlineView);
				this.resourcesOutlineView.refresh();
				var me = this;
				(function() { me.resourcesOutlineView.editSelectedRow() }).delay(0);
			}
		}
	},
	
	addResourceGroup: function() {
		var selectedObjectIDs = this.groupsOutlineController.selectedObjectIDs();
		if(selectedObjectIDs.length){
			var objectID = this.actionMethods.addResourceGroup({selectedObjectIDs:selectedObjectIDs});
			this.moc.synchronize();	
			var object = this.moc.registeredObjectWithURIString(objectID);
			if(object){
				this.groupsOutlineController.setSelectedObjects([object]);
				this.focusOutlineView(this.groupsOutlineView);
				this.groupsOutlineView.refresh();
				var me = this;
				(function() { me.groupsOutlineView.editSelectedRow() }).delay(0);
			}
		}	
	},
	
	toggleGroupView: function() {
		this.splitView.toogleFirstView();
		this.updateTooltip();
	},

	willMoveSplitterAction: function(splitView) {
	
	},

	moveSplitterAction: function(splitView) {
		this.resourcesOutlineView.containerSizeChanged();	
		this.groupsOutlineView.containerSizeChanged();	
	},
	
	splitterChangedAction: function(splitView) {
		this.resourcesOutlineView.containerSizeChanged();
		this.groupsOutlineView.containerSizeChanged();	
		if(!this.splitView.isFirstViewVisible()){
			var groups = this.groupsOutlineController.getFlatObjects();
			if(groups && groups.length){
				this.groupsOutlineController.setSelectedObjects([groups[0]]);
				this.groupsOutlineView.refresh();
				this.outlineDidChangeSelection(this.groupsOutlineView);
				this.focusOutlineView(this.resourcesOutlineView);
			}
		}
	},

	selectedObjects: function(){
		var result = [];
		if(this.focusedOutlineView)
			result = this.focusedOutlineView.controller.selectedObjects;
		return result;
	},

	// ***************  Delegate Methoden der Outline View *****************

	outlineShouldDragRows: function(outline, rows){
		return outline == this.resourcesOutlineView;
	},

	pasteboardContentFromRows: function(outline, rows){
		var result = [];
		for(var i=0; i<rows.length; i++){
			var object = rows[i].object;
			result.push({data:object, type:object.className()});
		}
		return result; 
	},

	outlineValidateDrop: function(outline, location, pasteboard){		
		if(outline == this.groupsOutlineView){
			if(location.row && location.row != OutlineView.MOUSE_IS_NOT_IN_OUTLINE && location.row != OutlineView.MOUSE_IS_NOT_IN_ROW && location.row.object.className() == "MEResourceGroup")
				return {accept:true, area:'middle'};
		}
		return {accept:false};
	},

	outlineAcceptDrop: function(outline, location, pasteboard){
		if(location.row){
			var group = location.row.object;
			for(var i=0; i<pasteboard.length; i++){
				var objectDescription = pasteboard[i];
				var type = objectDescription.type;
				if(objectDescription.type == "MEResource" || objectDescription.type == "MEMasterResource"){
					var resource = objectDescription.data;
					var groups = resource.valueForKey('groups');
					if(!groups)
						groups = [];
					groups.push(group);
					groups = groups.uniq();
					resource.setValueForKey(groups, 'groups');
				}
			}
			this.moc.synchronize();
		}
	},
	
	outlineHeightForRow: function(outline, row){
		return 20;
	},
	
	outlineDidCreateCellInRow: function(outline, cell, row, editMode){
		if(this.resourcesOutlineView == outline && cell.column == outline.outlineColumn){
			var imagePath = this.environment.images.Resource;
			switch(parseInt(row.object.valueForKey("type"))){
				case MEResource.MEResourceType.MEMaterialResource: 
					var imagePath = this.environment.images.MEMaterialResource;
					break;
				case MEResource.MEResourceType.MECompanyResource: 
					var imagePath = this.environment.images.MECompanyResource;
					break;
				case MEResource.MEResourceType.MEEquipmentResource: 
					var imagePath = this.environment.images.MEEquipmentResource;
					break;
			}
			cell.appendChild(IMG({width:15, height:14, src:imagePath, style:"vertical-align:middle; margin-left:"+3+"px; margin-right:4px;"}));
		}else if(this.groupsOutlineView == outline){
			var imagePath = this.environment.images.ViewGroups;
			var width = 19;
			var height = 14;
			if(row.object.className() == "MEProject" || row.object.className() == "AllProjectsItem"){
				imagePath = this.environment.images.MEProject;
				width =15;
				height = 14;
				cell.style.fontWeight='bold';
				cell.style.marginLeft = "9px";
				cell.style.paddingLeft = "9px";
			}
			var resourceGroups = row.object.valueForKey('resourceGroups')
			var hasChilds = resourceGroups && resourceGroups.length;
			cell.appendChild(IMG({width:width, height:height, src:imagePath, style:"vertical-align:middle; margin-left:"+(3+(!hasChilds ? 9 : 0))+"px; margin-right:4px;"}));
		}
	},

	outlineDidCreateRow: function(outline, row){
		row.originalColor = "#000000";
	},

	outlineDidCreateRows: function(outline, rows){

	},

	outlineRowsBecameVisible: function(outline, rows){

	},

	outlineChanged: function(outline, rows){		

	},

	outlineViewDidCreateDisclosureButtonForRow: function(outline, button, row){

	},

	outlineViewShouldHandleClickInRow: function(outline, row){
		return true;
	},

	focusOutlineView: function(outline){
		if(this.focusedOutlineView != outline){
			this.focusedOutlineView = outline;
			this.resourcesOutlineView.setIsFocused(outline == this.resourcesOutlineView);
			this.groupsOutlineView.setIsFocused(outline == this.groupsOutlineView);
		}
	},

	visibleResources: function(){
		var resourcesToShow = [];
		var objects = this.groupsOutlineController.selectedObjects;
		for(var i=0; i<objects.length; i++){
			var object = objects[i];
			var resources = object.valueForKey("resources");
			for(var k=0; k<resources.length; k++){
				var resource = resources[k];
				if(resourcesToShow.indexOf(resource) == -1)
					resourcesToShow.push(resource);
			}
			if(object.className() == "AllProjectsItem")
				break;
		}
		return resourcesToShow;
	},

	outlineDidChangeSelection: function(outline)
	{
		this.focusOutlineView(outline);
		if(outline == this.groupsOutlineView)
			this.setResources(this.visibleResources());
		this.updateControlsEnabledStatus();		
	},

	outlineShouldEditObjectProperty: function(outline, object, key){
		if(object.className() == "MEProject")
			return false;
		this.editedOutlineView = outline;
		var result = eval(this.actionMethods.shouldEditObjectProperty({objectID:object.objectID.uri, key:key}));
		return result;
	},
	
	outlineValidatePropertyOfObject: function(outline, property, object, validationDidEndHandler){
		var propertyName;
		var value;
		for(propertyName in property){
			value = property[propertyName];
			break;
		}
		var result = this.actionMethods.validatePropertyOfObject({propertyName:propertyName, value:value, objectID:object.objectID.uri});
		result = eval("("+result+")");
		if(result.validated){
			var object = this.moc.registeredObjectWithURIString(result.objectID);
			if(object){ 
				var value = object.createValueForPropertyFromJSON(result.propertyName, result.value);
				object.setValueForKey(value, result.propertyName);
				this.moc.synchronize();
				validationDidEndHandler.call(outline, result);
			}
		}
	},
	
	outlineDidFinishEditing: function(outline){
		this.editedOutlineView = null;
	},
	
	
	// ********************* Key handling *********************
	
	moveUp: function(sender, evt) {
		if(this.focusedOutlineView)
			this.focusedOutlineView.selectPreviousRow(false);
		return true;
	},

	moveDown: function(sender, evt) {
		if(this.focusedOutlineView)
			this.focusedOutlineView.selectNextRow(false);
		return true;
	},

	moveLeft: function(sender, evt) {
		if(this.focusedOutlineView && this.focusedOutlineView == this.groupsOutlineView)
			this.focusedOutlineView.setSelectedRowsCollapsed(true);
		return true;
	},

	moveRight: function(sender, evt) {
		if(this.focusedOutlineView && this.focusedOutlineView == this.groupsOutlineView)
			this.focusedOutlineView.setSelectedRowsCollapsed(false);
		return true;
	},

	closeDatePicker: function() {
		if(window["datePickerIsVisible"] && datePickerIsVisible()){
			closeCalendar();
			return true;
		}	
	},

	insertNewline: function(sender, evt){
		if(this.focusedOutlineView && !this.closeDatePicker())
			this.focusedOutlineView.editSelectedRow();
		return true;
	},
	
	insertTab: function(sender, evt){
		if(this.editedOutlineView  && !this.closeDatePicker())
			this.editedOutlineView.editNextProperty();		
		return true;
	},
	
	deleteBackward: function(sender, evt){
		this.deleteSelectedObjects();	
		return true;
	},	

	deleteForward: function(sender, evt){
		this.deleteSelectedObjects();	
		return true;
	},	

	selectedGroupObject: function(){
		var selectedGroups = this.groupsOutlineController.selectedObjects;
		return selectedGroups && selectedGroups.length ? selectedGroups[0] : null;
	},
	
	deleteSelectedObjects: function(){
		var objects = this.selectedObjects();
		if(objects.length){
			var objectIDs = [];
			var objectsToDelete = [];
			objects.each(function(object){
				if(object.uri && object.className() != "MEProject"){
					objectIDs.push(object.uri());
					objectsToDelete.push(object);
				}
			});
			if(objectIDs.length){
				var selectedGroupObject = this.selectedGroupObject();
				if(this.focusedOutlineView == this.resourcesOutlineView && selectedGroupObject && selectedGroupObject.className() != "MEProject"){
					objectsToDelete.each(function(object){
						object.setValueForKey(object.valueForKey("groups").without(selectedGroupObject), 'groups');
					});
				}else
					this.actionMethods.deleteObjects({objectIDs:objectIDs});
				this.moc.synchronize();	
				this.focusedOutlineView.controller.setSelectedObjects([]);
				this.refresh();

			}
		}
	},
	
	canDeleteSelection: function() {
		return this.selectedObjects().length ? true : false;
	},

	
	print: function(){
		var info = {};
		info.environment = this.environment;
		info.outlineSize = {	 width:this.resourcesOutlineView.tableWidth(), height:this.resourcesOutlineView.fullHeight()};
		info.outlineController = this.resourcesOutlineController;
		info.columns = this.columns;
		info.styleList = this.styleList;
		info.moc = this.moc;		
		info.delegate = this;
		window.info = info;
		this.printWindow = window.open(Prototype.Browser.WebKit ? this.printPageURL : '', '','height=600, width=800, resizable=1, scrollbars=1');
		if(!this.printWindow.info)
			this.printWindow.info = info;
		if(window.focus) 
			this.printWindow.focus();				
		if(!Prototype.Browser.WebKit){	
			this.printWindow.location = this.printPageURL;
		}
	},
	
	isEditing: function() {
		return this.resourcesOutlineView.isEditing() || this.groupsOutlineView.isEditing();
	},

	setSplitViewState: function(splitViewState) {
		var splitterPos = parseFloat(eval('('+splitViewState+')'));
		if(splitterPos <= 0)
			this.splitView.hideFirstView();
		else
			this.splitView.showFirstView();	
	},
	
	fetchWorkspace: function() {
		var workspaceData = eval('('+this.actionMethods.getWorkspaceData({})+')');
		this.styleList = eval('('+workspaceData.styleList+')');
		this.columns = eval('('+workspaceData.columns+')');
		if(workspaceData.splitViewState)
			this.setSplitViewState(workspaceData.splitViewState);
		this.resourcesOutlineView.setColumnsAndOutlineColumnKey(this.columns, 'title');
		var projects = this.projectsInManagedObjectContext();
		this.setProjects(projects);
		if(projects.length)
			this.groupsOutlineController.setSelectedObjects([projects[0]]);
		this.setResources(this.visibleResources());
		this.updateControlsEnabledStatus();		
		this.refresh();
	},
	
	workspaceViewName: function() {
		return "resourcesViewController";
	}
	
});
