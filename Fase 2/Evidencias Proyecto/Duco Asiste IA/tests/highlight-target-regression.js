const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Reproduce la estructura real: el enlace está DENTRO del encabezado.
class Element {
  constructor(tag, text = '', children = []) {
    this.tag = tag;
    this.tagName = tag.toUpperCase();
    this.ownText = text;
    this.children = children;
    children.forEach(child => child.parent = this);
  }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); }
  matches() { return this.tag === 'a' || this.tag === 'button'; }
  querySelectorAll() {
    return this.children.flatMap(child => [...(child.matches() ? [child] : []), ...child.querySelectorAll()]);
  }
  cloneNode() { return new Element(this.tag, this.ownText, this.children.map(child => child.cloneNode())); }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  closest() { return null; }
  getBoundingClientRect() { return { width: 300, height: 40 }; }
}

const title = 'Carreras Técnicas y Profesionales';
const button = new Element('a', 'VER TODAS LAS CARRERAS');
const heading = new Element('h1', title + ' ', [button]);
const elements = [heading, button];
const window = { addEventListener() {} };
const sandbox = vm.createContext({
  window, console, setTimeout, clearTimeout,
  document: { querySelectorAll: () => elements },
  getComputedStyle: () => ({ visibility: 'visible', display: 'block' })
});
vm.runInContext(fs.readFileSync('js/duco-assistant.js', 'utf8'), sandbox);
const assistant = Object.create(vm.runInContext('DucoAssistant.prototype', sandbox));

assert.equal(assistant.getElementContentText(heading), title);
assert.equal(assistant.getElementContentText(button), 'VER TODAS LAS CARRERAS');
assert.equal(assistant.describeHighlightTarget([title]), title);
assert.equal(assistant.findTextElementByTerms([title]), heading);
assert.equal(assistant.findTextElementByTerms(['VER TODAS LAS CARRERAS']), button);
assert.equal(assistant.findTextElementByTerms(['un objetivo inexistente']), null);
assert.deepEqual(Array.from(assistant.extractHighlightTargets(title)), [title]);
const corrected = assistant.canonicalizeHighlightTargets([
  { type: 'highlightTerms', terms: ['Carreras Técnicas y Profesionals'] }
]);
assert.deepEqual(Array.from(corrected[0].terms), [title]);
const selected = assistant.consolidateHighlightActions(
  [{ type: 'highlightTerms', terms: ['VER TODAS LAS CARRERAS'] }],
  assistant.extractHighlightTargets("Resaltando '" + title + "' nuevamente."),
  'inténtalo nuevamente'
);
assert.deepEqual(Array.from(selected[0].terms), [title]);

const siteSource = fs.readFileSync('js/site-context.js', 'utf8').split('window.ducoSiteContext =')[0];
vm.runInContext(siteSource, sandbox);
const extractor = Object.create(vm.runInContext('UniversalContextExtractor.prototype', sandbox));
extractor.findMainContent = () => ({ querySelectorAll: () => [heading] });
extractor.isHidden = () => false;
assert.equal(extractor.extractContentHeadings()[0].text, title);
assert.equal(heading.textContent.includes(button.textContent), true, 'El DOM original conserva el botón');

(async () => {
  let painted;
  window.ducoHighlighter = { highlightByTerms: terms => { painted = Array.from(terms); return 1; } };
  assistant.findButtonOrLinkByTerms = () => null;
  const outcome = await assistant.executeFlowAction({
    type: 'highlightTerms', terms: [title], closeTransientUi: false
  });
  assert.equal(outcome.success, true);
  assert.deepEqual(painted, [title], 'Solo se envía al resaltador la frase solicitada');
  let finishScroll;
  painted = undefined;
  window.ducoHighlighter = {
    guideToElement: () => new Promise(resolve => { finishScroll = resolve; }),
    highlightByTerms: (terms, options) => {
      painted = Array.from(terms);
      assert.equal(options.autoGuide, false, 'No repetir el scroll al pintar');
      assert.equal(options.endAt, undefined, 'No reutilizar un plazo ya vencido');
      assert.equal(options.duration, 4500);
      return 1;
    }
  };
  const pending = assistant.executeFlowAction({
    type: 'highlightTerms', terms: [title], closeTransientUi: false,
    duration: 4500, endAt: 1
  });
  assert.equal(painted, undefined, 'No pintar mientras el destino aún está desplazándose');
  finishScroll();
  assert.equal((await pending).success, true);
  assert.deepEqual(painted, [title], 'Pintar después de terminar el desplazamiento');
  const ordered = assistant.reorderAndAdjustActionsForQuery([
    { type: 'highlightTerms', terms: [title] },
    { type: 'scroll', terms: [title] },
    { type: 'dropdown', terms: [title] },
    { type: 'clearHighlights' }
  ], 'abre el menú y resáltalo');
  assert.deepEqual(Array.from(ordered, action => action.type), ['clearHighlights', 'dropdown', 'scroll', 'highlightTerms']);
  assert.equal(ordered[3].closeTransientUi, false, 'Conservar el menú abierto para el resaltado');
  // Una referencia ya resuelta no puede cambiar por la prosa generada ni por
  // las comillas usadas para rechazar el objetivo incorrecto.
  window.chatHandler = {getActionOutcomes:()=>[{type:'highlightTerms',target:['VER TODAS LAS CARRERAS']}]};
  assistant.requestAiResponse = async () => ({
    reply:"Resaltando 'VER TODAS LAS CARRERAS'.",
    actions:[{type:'highlightTerms',terms:[title]}],
    intent:{reference:'resolved_action',action:'highlight'}
  });
  assistant.isLocalKnowledgeApi = () => false;
  assistant.sleep = async () => {};
  assistant.hideTypingIndicator = () => {};
  assistant.addActionButtons = () => {};
  let resolvedExecuted = false;
  assistant.runAssistantFlow = async (steps, context) => {
    const highlight = steps.find(step=>step.action?.type==='highlightTerms');
    assert.deepEqual(Array.from(highlight.action.terms),[title]);
    assert.equal(context.quotedTerms.length,0);
    resolvedExecuted = true;
    return [{success:true}];
  };
  await assistant.processUserInput('No me refería a "VER TODAS LAS CARRERAS", sino al anterior');
  assert(resolvedExecuted);
  console.log('OK: título y botón anidado permanecen separados en contexto, selección, etiqueta y resaltado.');
  console.log('OK: desplazamiento antes del resaltado y limpieza antes de pintar.');
})().catch(error => { console.error(error); process.exitCode = 1; });
