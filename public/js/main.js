/**
 * SheetFlow Interactive Experience & Utilities
 * Zero external library dependencies, 100% accessible.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initSimulator();
  initFaqAccordion();
  initLegalToc();
  initSupportForm();
});

/* ==========================================================================
   1. Mobile Navigation
   ========================================================================== */
function initMobileNav() {
  const toggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (!toggle || !navMenu) return;

  toggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !navMenu.contains(e.target) && navMenu.classList.contains('open')) {
      navMenu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ==========================================================================
   2. Live Sheet-to-Canvas Simulator
   ========================================================================== */
const SIMULATOR_DATASETS = {
  clinic: {
    name: "Clinic Schedule",
    tagTitle: "APPOINTMENT CARD",
    columns: ["ID", "Nama Pasien", "Jadwal", "Dokter", "Layanan"],
    rows: [
      { id: "#001", "Nama Pasien": "Budi Santoso", "Jadwal": "25 Okt 2026, 09:00", "Dokter": "Dr. Sarah", "Layanan": "Scaling & Polishing" },
      { id: "#002", "Nama Pasien": "Siti Rahma", "Jadwal": "25 Okt 2026, 10:30", "Dokter": "Dr. Dimas", "Layanan": "Dental Checkup" },
      { id: "#003", "Nama Pasien": "Ahmad Fauzi", "Jadwal": "25 Okt 2026, 13:00", "Dokter": "Dr. Sarah", "Layanan": "Teeth Whitening" }
    ],
    template: (row) => `
      <div class="canvas-tag">DENTAL APPOINTMENT</div>
      <div class="canvas-title">Dentisteam Dental Clinic</div>
      <div class="canvas-row">
        <span class="canvas-label">Patient Name:</span>
        <span class="canvas-value">${escapeHtml(row['Nama Pasien'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Date & Time:</span>
        <span class="canvas-value">${escapeHtml(row['Jadwal'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Attending Doctor:</span>
        <span class="canvas-value">${escapeHtml(row['Dokter'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Procedure:</span>
        <span class="canvas-value">${escapeHtml(row['Layanan'])}</span>
      </div>
    `
  },
  conference: {
    name: "Conference Pass",
    tagTitle: "ATTENDEE PASS",
    columns: ["ID", "Attendee Name", "Company", "Role", "Pass Type"],
    rows: [
      { id: "#101", "Attendee Name": "Elena Rostova", "Company": "Nordic Systems", "Role": "Lead Architect", "Pass Type": "VIP All-Access" },
      { id: "#102", "Attendee Name": "Marcus Thorne", "Company": "Apex Labs", "Role": "Product VP", "Pass Type": "Speaker" },
      { id: "#103", "Attendee Name": "Yuki Tanaka", "Company": "Tokyo Dynamics", "Role": "UX Researcher", "Pass Type": "Delegate" }
    ],
    template: (row) => `
      <div class="canvas-tag">${escapeHtml(row['Pass Type'])}</div>
      <div class="canvas-title">Tech Summit 2026</div>
      <div class="canvas-row">
        <span class="canvas-label">Attendee Name:</span>
        <span class="canvas-value">${escapeHtml(row['Attendee Name'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Organization:</span>
        <span class="canvas-value">${escapeHtml(row['Company'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Designation:</span>
        <span class="canvas-value">${escapeHtml(row['Role'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Registration Code:</span>
        <span class="canvas-value">${escapeHtml(row.id)}</span>
      </div>
    `
  },
  certificate: {
    name: "Certificate",
    tagTitle: "AWARD OF HONOR",
    columns: ["ID", "Recipient", "Course Title", "Completion Date", "Grade"],
    rows: [
      { id: "#801", "Recipient": "Devi Anggraini", "Course Title": "Visual Brand Systems", "Completion Date": "October 2026", "Grade": "High Distinction" },
      { id: "#802", "Recipient": "David Miller", "Course Title": "Interface Design Mastery", "Completion Date": "October 2026", "Grade": "Honors" },
      { id: "#803", "Recipient": "Chen Wei", "Course Title": "Typography Architecture", "Completion Date": "October 2026", "Grade": "High Distinction" }
    ],
    template: (row) => `
      <div class="canvas-tag">CERTIFIED RECORD</div>
      <div class="canvas-title">Certificate of Completion</div>
      <div class="canvas-row">
        <span class="canvas-label">Awarded To:</span>
        <span class="canvas-value">${escapeHtml(row['Recipient'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Program:</span>
        <span class="canvas-value">${escapeHtml(row['Course Title'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Issued Date:</span>
        <span class="canvas-value">${escapeHtml(row['Completion Date'])}</span>
      </div>
      <div class="canvas-row">
        <span class="canvas-label">Evaluation Standing:</span>
        <span class="canvas-value">${escapeHtml(row['Grade'])}</span>
      </div>
    `
  }
};

let currentDatasetKey = 'clinic';
let currentRowIndex = 0;

function initSimulator() {
  const container = document.getElementById('sheetflow-simulator');
  if (!container) return;

  renderSimulatorControls();
  renderSimulatorView();
}

function renderSimulatorControls() {
  const chipsContainer = document.getElementById('dataset-chips');
  if (!chipsContainer) return;

  chipsContainer.innerHTML = '';
  Object.keys(SIMULATOR_DATASETS).forEach((key) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip-btn ${key === currentDatasetKey ? 'active' : ''}`;
    btn.textContent = SIMULATOR_DATASETS[key].name;
    btn.addEventListener('click', () => {
      currentDatasetKey = key;
      currentRowIndex = 0;
      renderSimulatorControls();
      renderSimulatorView();
    });
    chipsContainer.appendChild(btn);
  });
}

function renderSimulatorView() {
  const dataset = SIMULATOR_DATASETS[currentDatasetKey];
  const tableHead = document.getElementById('table-head');
  const tableBody = document.getElementById('table-body');
  const rowCounter = document.getElementById('row-counter');
  const canvasPreview = document.getElementById('canvas-preview');
  const prevBtn = document.getElementById('prev-step-btn');
  const nextBtn = document.getElementById('next-step-btn');

  if (!tableHead || !tableBody || !rowCounter || !canvasPreview) return;

  // 1. Render Table Header
  tableHead.innerHTML = `<tr>${dataset.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;

  // 2. Render Table Rows
  tableBody.innerHTML = dataset.rows.map((row, idx) => {
    const isActive = idx === currentRowIndex;
    const cells = dataset.columns.map(col => `<td>${escapeHtml(row[col] || '')}</td>`).join('');
    return `<tr class="${isActive ? 'active-row' : ''}" data-index="${idx}">${cells}</tr>`;
  }).join('');

  // 3. Attach Click to Row
  tableBody.querySelectorAll('tr').forEach((tr) => {
    tr.addEventListener('click', () => {
      currentRowIndex = parseInt(tr.getAttribute('data-index') || '0', 10);
      renderSimulatorView();
    });
  });

  // 4. Update Stepper Status
  rowCounter.textContent = `Row ${currentRowIndex + 1} of ${dataset.rows.length}`;
  if (prevBtn) prevBtn.disabled = currentRowIndex === 0;
  if (nextBtn) nextBtn.disabled = currentRowIndex === dataset.rows.length - 1;

  // 5. Update Stepper Buttons
  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.dataset.bound = 'true';
    prevBtn.addEventListener('click', () => {
      if (currentRowIndex > 0) {
        currentRowIndex--;
        renderSimulatorView();
      }
    });
  }

  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = 'true';
    nextBtn.addEventListener('click', () => {
      const curData = SIMULATOR_DATASETS[currentDatasetKey];
      if (currentRowIndex < curData.rows.length - 1) {
        currentRowIndex++;
        renderSimulatorView();
      }
    });
  }

  // 6. Render Canvas Output
  const activeRow = dataset.rows[currentRowIndex];
  canvasPreview.innerHTML = dataset.template(activeRow);
}

/* ==========================================================================
   3. FAQ Accordion
   ========================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question');
    if (!questionBtn) return;

    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      
      // Close other items
      faqItems.forEach((other) => {
        if (other !== item) other.classList.remove('open');
      });

      item.classList.toggle('open', !isOpen);
      questionBtn.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

/* ==========================================================================
   4. Legal Table of Contents Active Tracker
   ========================================================================== */
function initLegalToc() {
  const sections = document.querySelectorAll('.legal-section');
  const navLinks = document.querySelectorAll('.legal-nav-link');

  if (sections.length === 0 || navLinks.length === 0) return;

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 140;

    sections.forEach((sec) => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = sec.id;
      }
    });

    if (currentId) {
      navLinks.forEach((link) => {
        const href = link.getAttribute('href') || '';
        link.classList.toggle('active', href === `#${currentId}`);
      });
    }
  });
}

/* ==========================================================================
   5. Support Form Validation & Mailto Trigger
   ========================================================================== */
function initSupportForm() {
  const form = document.getElementById('support-contact-form');
  const statusBox = document.getElementById('form-status');

  if (!form || !statusBox) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = (document.getElementById('sender-name') || {}).value?.trim();
    const email = (document.getElementById('sender-email') || {}).value?.trim();
    const topic = (document.getElementById('issue-topic') || {}).value?.trim();
    const message = (document.getElementById('issue-message') || {}).value?.trim();

    if (!name || !email || !message) {
      statusBox.className = 'form-status error';
      statusBox.textContent = 'Please fill out all required fields before submitting.';
      return;
    }

    // Construct mailto link as direct fallback
    const subject = encodeURIComponent(`[SheetFlow Support] ${topic || 'General Inquiry'} from ${name}`);
    const body = encodeURIComponent(`From: ${name} (${email})\nTopic: ${topic}\n\nMessage:\n${message}`);
    const mailtoUrl = `mailto:support.sheetflow@gmail.com?subject=${subject}&body=${body}`;

    statusBox.className = 'form-status success';
    statusBox.innerHTML = `Inquiry prepared. Opening your email client to send to <strong>support.sheetflow@gmail.com</strong>... If your email app does not launch, please send directly to <strong>support.sheetflow@gmail.com</strong>.`;

    setTimeout(() => {
      window.location.href = mailtoUrl;
    }, 800);
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
