// Browser tests for Collapsible component

const nextTick = () => new Promise(r => setTimeout(r));

export const beforeEach = async () => {
  document.body.innerHTML = '';
  try { localStorage.removeItem('ktf_settings'); } catch {}
};

export default {
  'Collapsible toggles content visibility': async ({ pass, fail, log }) => {
    try {
      await import('/gui/components/Collapsible.js');
      const el = document.createElement('ktf-collapsible');
      el.appendChild(document.createElement('div')).textContent = 'Content';
      document.body.appendChild(el);
      await nextTick();
      const btn = el.shadowRoot.querySelector('button.title');
      const openedBefore = el.hasAttribute('opened') || el.opened;
      const hasSlotBefore = !!el.shadowRoot.querySelector('div.bt');
    log(`Before toggle — opened:${openedBefore} slot:${hasSlotBefore}`);
      btn.click();
      await nextTick();
      const openedAfter = el.opened === true;
      const hasSlotAfter = !!el.shadowRoot.querySelector('div.bt');
    log(`After toggle — opened:${openedAfter} slot:${hasSlotAfter}`);
    if (!openedBefore && !hasSlotBefore && openedAfter && hasSlotAfter) pass('Collapsible opened and revealed slotted content');
    else fail('Collapsible did not toggle as expected');
    } catch (e) { fail(e.stack || String(e)); }
  },

  'Collapsible respects opened attribute and can close': async ({ pass, fail, log }) => {
    try {
      await import('/gui/components/Collapsible.js');
      const el = document.createElement('ktf-collapsible');
      el.setAttribute('opened', '');
      el.appendChild(document.createElement('div')).textContent = 'Content';
      document.body.appendChild(el);
      await nextTick();
      const btn = el.shadowRoot.querySelector('button.title');
      const initiallyOpen = el.opened === true;
    log(`Initially open:${initiallyOpen}`);
      btn.click();
      await nextTick();
      const afterClose = el.opened === false;
    if (initiallyOpen && afterClose) pass('Opened attribute respected and component can close'); else fail('opened attribute not respected or cannot close');
    } catch (e) { fail(e.stack || String(e)); }
  }
};
