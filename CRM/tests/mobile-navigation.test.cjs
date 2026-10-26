const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
test('People directory navigates only to /people and stays mounted until route commit', () => {
  const routes = [], states = [], effects = [];
  const jsx = (type, props) => ({ type, props });
  const scope = { exports: {}, document: { body: {} }, require(name) {
    if (name === "react-dom") return { createPortal: node => node };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react') return { useState: () => [true, value => states.push(value)], useEffect: fn => effects.push(fn) };
    if (name === 'next/navigation') return { usePathname: () => '/leads', useRouter: () => ({ push: href => routes.push(href) }) };
    if (name === 'next/link') return { default: 'link' };
    return new Proxy({}, { get: (_, key) => String(key) });
  } };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../components/layout/MobileNavigation.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, scope);
  const root = scope.exports.default();
  const nodes = [];
  function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); nodes.push(node); visit(node.props?.children); }
  visit(root);
  const people = nodes.find(node => node.props?.href === '/people');
  assert.ok(people);
  let prevented = false, stopped = false;
  people.props.onClick({ button: 0, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.deepEqual(routes, ['/people']);
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(states.length, 0);
  effects[0]();
  assert.deepEqual(states, [false]);
});
