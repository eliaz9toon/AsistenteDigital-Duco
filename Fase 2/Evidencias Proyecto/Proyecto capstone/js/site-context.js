/**
 * Extractor universal de contexto del sitio Duoc UC.
 * Funciona en CUALQUIER HTML del sitio sin selectores fijos.
 * Escanea el DOM automáticamente para extraer: navegación, contenido, enlaces, contactos, formularios.
 */

class UniversalContextExtractor {
  constructor() {
    this.ignoreTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CANVAS']);
    this.ignoreClasses = /skip-?link|sr-?only|hidden|cookie|banner|popup|modal|ad-?wrapper|analytics|tealium|gtm/i;
    this.extracted = new Set();
  }

  normalize(str) {
    return String(str || '')
      .replace(/[\n\r\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  isHidden(el) {
    if (!el || el.nodeType !== 1) return true;
    const style = window.getComputedStyle(el);
    return style.display === 'none' || style.visibility === 'hidden' || el.getAttribute('aria-hidden') === 'true';
  }

  isVisibleLink(el) {
    if (el.tagName !== 'A' || !el.textContent.trim()) return false;
    if (this.isHidden(el)) return false;
    const href = el.getAttribute('href') || '';
    if (href.startsWith('javascript') || href === '#' || href === 'javascript:void(0)') return false;
    return true;
  }

  extractNavFromContainers() {
    const navs = [];
    const candidates = [
      ...document.querySelectorAll('nav'),
      ...document.querySelectorAll('ul.navbar-nav, ul.nav-menu, ul.main-nav, [role="navigation"] ul'),
      ...document.querySelectorAll('ul > li > ul'),
      ...document.querySelectorAll('header nav ul, footer nav ul'),
      ...document.querySelectorAll('[class*="menu"], [class*="nav"]')
    ].filter(el => el.children.length > 0);

    const seen = new Set();

    for (const container of candidates) {
      if (this.ignoreClasses.test(container.className || '')) continue;
      if (seen.has(container)) continue;
      seen.add(container);

      const sectionLabel = this.getSectionLabel(container);
      const links = [];

      this.walkLinks(container, (link) => {
        if (!this.isVisibleLink(link)) return;
        const parentItem = this.getClosestNavItem(link);
        if (parentItem && this.isHidden(parentItem)) return;

        const text = this.normalize(link.textContent);
        const href = (link.getAttribute('href') || '').replace(/^https?:\/\/[^/]+/, '');

        if (text && text.length > 2 && text.length < 100 && !this.extracted.has(text + href)) {
          this.extracted.add(text + href);
          links.push({ text, href, subItems: [] });
        }
      });

      if (links.length >= 2) {
        navs.push({ label: sectionLabel, links });
      }
    }

    return this.deduplicateNavGroups(navs);
  }

  deduplicateNavGroups(groups) {
    const seen = new Set();
    return groups.filter(group => {
      const key = group.links.map(l => l.text).join('|').toLowerCase();
      if (seen.has(key) || key.length < 10) return false;
      seen.add(key);
      return true;
    });
  }

  getSectionLabel(container) {
    const ariaLabel = container.getAttribute('aria-label');
    if (ariaLabel) return this.normalize(ariaLabel);

    const parent = container.closest('[class*="header"], [class*="footer"], [class*="main"]');
    if (parent) {
      const cls = parent.className || '';
      if (/header/i.test(cls)) return 'Navegación principal';
      if (/footer/i.test(cls)) return 'Pie de página';
    }

    const classList = container.className || '';
    if (/main|primary/i.test(classList)) return 'Navegación principal';
    if (/secondary|mega|dropdown/i.test(classList)) return 'Menú';
    if (/footer/i.test(classList)) return 'Pie de página';
    if (/sidebar|aside/i.test(classList)) return 'Barra lateral';

    return 'Navegación';
  }

  getClosestNavItem(el) {
    let current = el;
    while (current && current !== document.body) {
      if (current.tagName === 'LI' || current.hasAttribute('data-dropdown')) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  walkLinks(container, callback) {
    const links = container.querySelectorAll('a[href]');
    for (const link of links) {
      callback(link);
    }

    const dropdowns = container.querySelectorAll('[class*="dropdown-menu"], [class*="submenu"], [class*="megamenu"]');
    for (const dropdown of dropdowns) {
      if (this.ignoreClasses.test(dropdown.className || '')) continue;
      const subLinks = dropdown.querySelectorAll('a[href]');
      for (const link of subLinks) {
        callback(link);
      }
    }
  }

  extractContentHeadings() {
    const headings = [];
    const mainContent = this.findMainContent();

    const scope = mainContent || document.body;
    const hElements = scope.querySelectorAll('h1, h2, h3');

    for (const h of hElements) {
      if (this.isHidden(h)) continue;
      const text = this.normalize(h.textContent);
      if (text && text.length > 3 && text.length < 200) {
        headings.push({
          level: parseInt(h.tagName.charAt(1)),
          text
        });
      }
    }

    return headings;
  }

  findMainContent() {
    const selectors = [
      'main',
      '[role="main"]',
      '#main-content',
      '#content',
      'main.uwaw',
      'article',
      '.main-content',
      '.page-content',
      '.content-area',
      '[class*="content"]'
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.children.length > 2) return el;
      } catch { /* skip invalid selectors */ }
    }

    return null;
  }

  extractContactInfo() {
    const phones = [];
    const emails = [];
    const addresses = [];

    const allText = document.body.innerText || '';

    const phoneRegex = /(?:\+56|0056|\d{2})[\s.\-]?\d[\s.\-\d]{7,}\d/g;
    const matches = allText.match(phoneRegex);
    if (matches) {
      for (const phone of matches) {
        const cleaned = phone.replace(/\s+/g, ' ').trim();
        if (cleaned.length >= 8 && !phones.includes(cleaned)) {
          phones.push(cleaned);
        }
      }
    }

    const linkEls = document.querySelectorAll('a[href^="mailto:"]');
    for (const link of linkEls) {
      const email = link.getAttribute('href').replace('mailto:', '').split('?')[0];
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    }

    const footer = document.querySelector('footer, [class*="footer"], [id*="footer"]');
    if (footer) {
      const footerText = this.normalize(footer.textContent);
      const addrRegex = /(?:Av\.?|Calle|Piso|Torre|Santiago|Providencia|Las Condes|Ñuñoa|Maipú|Puente Alto|San Bernardo|Alameda)[\w\s.,#\-\d]{5,60}/gi;
      const addrMatches = footerText.match(addrRegex);
      if (addrMatches) {
        for (const addr of addrMatches) {
          const cleaned = this.normalize(addr);
          if (cleaned.length > 10 && !addresses.includes(cleaned)) {
            addresses.push(cleaned);
          }
        }
      }
    }

    return { phones: phones.slice(0, 10), emails: emails.slice(0, 5), addresses: addresses.slice(0, 5) };
  }

  extractForms() {
    const forms = [];
    const formEls = document.querySelectorAll('form');

    for (const form of formEls) {
      if (this.isHidden(form)) continue;

      const formInfo = {
        action: form.getAttribute('action') || '',
        method: form.getAttribute('method') || 'get',
        fields: []
      };

      const inputs = form.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        if (input.type === 'hidden' || input.type === 'submit' || this.isHidden(input)) continue;
        const label = this.getInputLabel(input);
        const type = input.tagName.toLowerCase() + (input.type ? ` type="${input.type}"` : '');
        formInfo.fields.push({ label, type });
      }

      if (formInfo.fields.length > 0) {
        forms.push(formInfo);
      }
    }

    return forms;
  }

  getInputLabel(input) {
    const id = input.getAttribute('id');
    if (id) {
      const labelEl = document.querySelector(`label[for="${id}"]`);
      if (labelEl) return this.normalize(labelEl.textContent);
    }

    const name = input.getAttribute('name');
    const placeholder = input.getAttribute('placeholder');
    const ariaLabel = input.getAttribute('aria-label');

    return this.normalize(placeholder || ariaLabel || name || '');
  }

  extractPageMetadata() {
    const meta = {
      title: this.normalize(document.title),
      description: '',
      url: window.location.href,
      path: window.location.pathname
    };

    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      meta.description = this.normalize(descMeta.getAttribute('content'));
    }

    return meta;
  }

  extractAll() {
    const navGroups = this.extractNavFromContainers();
    const headings = this.extractContentHeadings();
    const contact = this.extractContactInfo();
    const forms = this.extractForms();
    const pageMeta = this.extractPageMetadata();

    const context = {
      page: pageMeta,
      navigation: navGroups,
      headings,
      contact,
      forms
    };

    return context;
  }
}

function formatContextForAI(context) {
  const lines = [
    `PAGINA ACTUAL: "${context.page.title}" (${context.page.path})`,
  ];

  if (context.page.description) {
    lines.push(`Descripción: ${context.page.description}`);
  }

  if (context.navigation.length > 0) {
    lines.push('');
    lines.push('MENUS Y NAVEGACION DISPONIBLE:');
    for (const group of context.navigation) {
      lines.push(`  [${group.label}]`);
      for (const link of group.links) {
        const arrow = link.subItems.length > 0 ? '▸ ' : '- ';
        lines.push(`    ${arrow}${link.text}${link.href ? ` (${link.href})` : ''}`);
        for (const sub of link.subItems) {
          lines.push(`      → ${sub.text}${sub.href ? ` (${sub.href})` : ''}`);
        }
      }
    }
  }

  if (context.headings.length > 0) {
    lines.push('');
    lines.push('SECCIONES DE ESTA PAGINA:');
    for (const h of context.headings) {
      const indent = '  '.repeat(h.level - 1);
      lines.push(`${indent}# ${h.text}`);
    }
  }

  if (context.contact.phones.length > 0) {
    lines.push('');
    lines.push('TELEFONOS:');
    lines.push(...context.contact.phones.map(p => `- ${p}`));
  }

  if (context.contact.emails.length > 0) {
    lines.push('');
    lines.push('EMAILS:');
    lines.push(...context.contact.emails.map(e => `- ${e}`));
  }

  if (context.contact.addresses.length > 0) {
    lines.push('');
    lines.push('DIRECCIONES:');
    lines.push(...context.contact.addresses.map(a => `- ${a}`));
  }

  if (context.forms.length > 0) {
    lines.push('');
    lines.push('FORMULARIOS:');
    for (const form of context.forms) {
      lines.push(`  Formulario (${form.method} ${form.action || 'sin acción'}):`);
      for (const field of form.fields) {
        lines.push(`    - ${field.label || field.type}`);
      }
    }
  }

  return lines.join('\n');
}

window.ducoSiteContext = new UniversalContextExtractor().extractAll();
window.ducoSiteContextFormatted = formatContextForAI(window.ducoSiteContext);
window.formatContextForAI = formatContextForAI;

console.log('[Duco] Contexto del sitio extraído:', window.ducoSiteContext);
console.log('[Duco] Contexto formateado:', window.ducoSiteContextFormatted);
