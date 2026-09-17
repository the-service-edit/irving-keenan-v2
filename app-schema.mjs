// Single source of truth for the digital rental application.
// Rendered by /public/js/apply.js and validated by the server (validateStep).
// Every field is mapped to its source question in the paper form (docs/04-APPLICATION-FIELD-MAP.md).
// Fields marked `review: true` are kept pending legal/privacy approval (docs/06).

const STATES = ['WA', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'ACT', 'NT', 'Outside Australia'];

const address = (prefix, required = true) => [
  { name: `${prefix}.line1`, label: 'Street address', type: 'text', required, autocomplete: 'address-line1', max: 120 },
  { name: `${prefix}.line2`, label: 'Unit, building (optional)', type: 'text', autocomplete: 'address-line2', max: 120 },
  { name: `${prefix}.suburb`, label: 'Suburb or town', type: 'text', required, autocomplete: 'address-level2', max: 60, half: true },
  { name: `${prefix}.state`, label: 'State', type: 'select', options: STATES, required, autocomplete: 'address-level1', quarter: true },
  { name: `${prefix}.postcode`, label: 'Postcode', type: 'text', required, autocomplete: 'postal-code', pattern: '^[0-9A-Za-z -]{3,10}$', max: 10, quarter: true, inputmode: 'numeric' },
];

const tenancyBlock = (prefix, required) => [
  ...address(`${prefix}.address`, required),
  { name: `${prefix}.agentName`, label: 'Landlord or property manager (name / agency)', type: 'text', required, max: 120 },
  { name: `${prefix}.agentPhone`, label: 'Their phone', type: 'tel', required, max: 20, half: true, pattern: '^[0-9 +()-]{8,20}$' },
  { name: `${prefix}.agentEmail`, label: 'Their email (optional)', type: 'email', max: 120, half: true },
  { name: `${prefix}.rent`, label: 'Rent paid ($)', type: 'money', required, half: true },
  { name: `${prefix}.rentPeriod`, label: 'Per', type: 'select', options: ['week', 'fortnight', 'month'], required, half: true },
  { name: `${prefix}.from`, label: 'Moved in', type: 'month', required, half: true },
  { name: `${prefix}.to`, label: 'Moved out (leave blank if current)', type: 'month', half: true },
  { name: `${prefix}.reason`, label: 'Reason for leaving', type: 'text', max: 200 },
];

export const STEPS = {
  property: {
    title: 'The property', lead: true, co: false, scope: 'application',
    intro: 'Confirm the property and tell us what you’re looking for.',
    fields: [
      { name: 'inspected', label: 'Have you (or someone on your behalf) inspected the property?', type: 'radio', options: [['yes', 'Yes'], ['no', 'Not yet']], required: true,
        help: 'Irving & Keenan requires properties to be viewed before an application is processed.' },
      { name: 'inspectedOn', label: 'Date viewed', type: 'date', when: ['inspected', 'yes'], required: true, half: true },
      { name: 'startDate', label: 'Preferred start date', type: 'date', required: true, half: true, future: true },
      { name: 'termMonths', label: 'Preferred lease length', type: 'select', options: [['6', '6 months'], ['12', '12 months'], ['18', '18 months'], ['24', '24 months'], ['other', 'Other']], required: true, half: true },
      { name: 'termOther', label: 'Preferred length (months)', type: 'number', min: 1, max: 60, when: ['termMonths', 'other'], required: true, half: true },
      { name: 'adults', label: 'Adults (18+) who will live there', type: 'number', min: 1, max: 12, required: true, half: true,
        help: 'Every adult occupant must complete their own application.' },
      { name: 'children', label: 'Children under 18', type: 'number', min: 0, max: 12, required: true, half: true },
      { name: 'applicantType', label: 'Which best describes this application?', type: 'radio', required: true,
        options: [['individual', 'Just me'], ['couple', 'Me and a partner'], ['family', 'Family'], ['group', 'Group of friends / housemates'], ['other', 'Other']] },
      { name: 'bondAssistance', label: 'Will you apply for a bond assistance loan from the Department of Communities?', type: 'radio', options: [['no', 'No'], ['yes', 'Yes']], required: true,
        help: 'If yes, your property manager will explain the extra paperwork needed.' },
      { name: 'specialConditions', label: 'Any special conditions you’d like to request? (optional)', type: 'textarea', max: 1000,
        help: 'The lessor isn’t obliged to accept special conditions.' },
    ],
  },
  details: {
    title: 'Your details', lead: true, co: true, scope: 'applicant',
    intro: 'Your details exactly as they appear on your ID.',
    fields: [
      { name: 'details.firstName', label: 'First name', type: 'text', required: true, autocomplete: 'given-name', max: 60, half: true },
      { name: 'details.lastName', label: 'Last name', type: 'text', required: true, autocomplete: 'family-name', max: 60, half: true },
      { name: 'details.middleNames', label: 'Middle name(s) (optional)', type: 'text', autocomplete: 'additional-name', max: 80, half: true },
      { name: 'details.preferredName', label: 'Preferred name (optional)', type: 'text', max: 60, half: true },
      { name: 'details.email', label: 'Email', type: 'email', required: true, autocomplete: 'email', max: 120, half: true, locked: true },
      { name: 'details.mobile', label: 'Mobile', type: 'tel', required: true, autocomplete: 'tel', max: 20, half: true, pattern: '^[0-9 +()-]{8,20}$' },
      { name: 'details.dob', label: 'Date of birth', type: 'date', required: true, autocomplete: 'bday', half: true, adult: true, review: true,
        help: 'Used only to confirm your identity and, where disclosed, to check tenancy databases.' },
      { heading: 'Current residential address' },
      ...address('details.address'),
      { name: 'details.postalDifferent', label: 'My postal address is different', type: 'checkbox' },
      ...address('details.postal', true).map((f) => ({ ...f, when: ['details.postalDifferent', true] })),
      { heading: 'Emergency contact' },
      { name: 'details.emergency.name', label: 'Name', type: 'text', required: true, max: 120, half: true },
      { name: 'details.emergency.relationship', label: 'Relationship', type: 'text', required: true, max: 60, half: true },
      { name: 'details.emergency.phone', label: 'Phone', type: 'tel', required: true, max: 20, half: true, pattern: '^[0-9 +()-]{8,20}$' },
      { heading: 'A little more' },
      { name: 'details.smoker', label: 'Does anyone in your household smoke?', type: 'radio', options: [['no', 'No'], ['yes', 'Yes']], review: true },
      { name: 'details.vehicles', label: 'Number of vehicles', type: 'number', min: 0, max: 10, half: true, help: 'Helps us confirm parking suits you.' },
    ],
  },
  applicants: {
    title: 'Other applicants', lead: true, co: false, scope: 'invites',
    intro: 'Add every other adult who will live at the property. We’ll email each person a private link to complete their own details and consent.',
    fields: [],
  },
  rental: {
    title: 'Rental history', lead: true, co: true, scope: 'applicant',
    intro: 'Tell us where you live now, and where you lived before if you’ve been there less than two years.',
    fields: [
      { name: 'rental.situation', label: 'Your current living situation', type: 'radio', required: true,
        options: [['renting', 'Renting'], ['owner', 'Own my home'], ['sold', 'Recently sold my home'], ['family', 'Living with family or friends'], ['other', 'Other (e.g. first rental, moving from overseas)']] },
      { heading: 'Current rental', when: ['rental.situation', 'renting'] },
      ...tenancyBlock('rental.current', true).map((f) => ({ ...f, when: ['rental.situation', 'renting'] })),
      { name: 'rental.sellingAgent', label: 'Selling agent name and mobile', type: 'text', required: true, max: 160, when: ['rental.situation', 'sold'],
        help: 'Used as a reference in place of a rental reference.' },
      { name: 'rental.situationNote', label: 'Tell us a little about your situation', type: 'textarea', max: 600, required: true, when: ['rental.situation', ['family', 'other', 'owner']] },
      { name: 'rental.hasPrevious', label: 'Do you have a previous rental you can tell us about?', type: 'radio', options: [['yes', 'Yes'], ['no', 'No']], required: true },
      { heading: 'Previous rental', when: ['rental.hasPrevious', 'yes'] },
      ...tenancyBlock('rental.previous', true).map((f) => ({ ...f, when: ['rental.hasPrevious', 'yes'] })),
    ],
  },
  employment: {
    title: 'Employment & income', lead: true, co: true, scope: 'applicant',
    intro: 'Everyone’s circumstances are different. Choose what fits you best.',
    fields: [
      { name: 'work.status', label: 'What best describes you?', type: 'radio', required: true, options: [
        ['employed', 'Employed (full-time, part-time or casual)'], ['self', 'Self-employed'], ['student', 'Student'],
        ['retired', 'Retired'], ['government', 'Receiving government payments'], ['other', 'Other arrangement']] },
      { name: 'work.employer', label: 'Employer', type: 'text', required: true, max: 120, when: ['work.status', 'employed'], half: true },
      { name: 'work.role', label: 'Your role', type: 'text', required: true, max: 120, when: ['work.status', 'employed'], half: true },
      { name: 'work.basis', label: 'Basis', type: 'select', options: ['Full-time', 'Part-time', 'Casual', 'Contract'], required: true, when: ['work.status', 'employed'], half: true },
      { name: 'work.start', label: 'Started', type: 'month', required: true, when: ['work.status', 'employed'], half: true },
      { name: 'work.contactName', label: 'Contact for employment reference', type: 'text', required: true, max: 120, when: ['work.status', 'employed'], half: true },
      { name: 'work.contactPhone', label: 'Their phone', type: 'tel', required: true, max: 20, when: ['work.status', 'employed'], half: true, pattern: '^[0-9 +()-]{8,20}$' },
      { name: 'work.previousEmployer', label: 'If you’ve been there less than 12 months: previous employer and how long', type: 'text', max: 200, when: ['work.status', 'employed'] },
      { name: 'work.business', label: 'Business name', type: 'text', required: true, max: 120, when: ['work.status', 'self'], half: true },
      { name: 'work.businessSince', label: 'Trading since', type: 'month', required: true, when: ['work.status', 'self'], half: true },
      { name: 'work.accountant', label: 'Accountant name and phone (optional)', type: 'text', max: 160, when: ['work.status', 'self'] },
      { name: 'work.institution', label: 'Where are you studying?', type: 'text', required: true, max: 120, when: ['work.status', 'student'], half: true },
      { name: 'work.course', label: 'Course', type: 'text', max: 120, when: ['work.status', 'student'], half: true },
      { name: 'work.otherNote', label: 'Tell us about your income arrangements', type: 'textarea', required: true, max: 600, when: ['work.status', ['other', 'government', 'retired']] },
      { heading: 'Income' },
      { name: 'work.incomeWeekly', label: 'Your total weekly income after tax ($)', type: 'money', required: true, half: true,
        help: 'Include all regular income. This helps show the rent is affordable for you.' },
      { name: 'work.incomeSources', label: 'Income sources', type: 'checkboxes', required: true, options: [['wages', 'Wages / salary'], ['business', 'Business income'], ['pension', 'Pension or superannuation'], ['centrelink', 'Government payments'], ['support', 'Family support'], ['savings', 'Savings'], ['other', 'Other']] },
    ],
  },
  household: {
    title: 'Occupants & pets', lead: true, co: false, scope: 'application',
    intro: 'Tell us who else will live at the property and about any pets.',
    fields: [
      { name: 'household.otherOccupants', label: 'Anything the property manager should know about the household? (optional)', type: 'textarea', max: 600,
        help: 'You don’t need to name children. Other adults must be added as applicants in the previous step.' },
      { name: 'hasPets', label: 'Would you like to keep any pets at the property?', type: 'radio', options: [['no', 'No'], ['yes', 'Yes']], required: true,
        help: 'Assistance animals aren’t pets and don’t need the lessor’s permission. Pet requests are considered separately using the approved WA pet request process. They aren’t approved automatically by applying.' },
      { name: 'pets', label: 'Pets', type: 'list', when: ['hasPets', 'yes'], min: 1, max: 4, itemLabel: 'Pet', fields: [
        { name: 'type', label: 'Type of animal', type: 'text', required: true, max: 60, half: true },
        { name: 'breed', label: 'Breed or species', type: 'text', max: 60, half: true },
        { name: 'age', label: 'Age', type: 'text', max: 20, quarter: true },
        { name: 'size', label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large'], quarter: true },
        { name: 'registration', label: 'Registration no. (dogs & cats)', type: 'text', max: 40, half: true },
        { name: 'notes', label: 'Temperament, training, inside/outside, containment', type: 'textarea', max: 600 },
      ] },
    ],
  },
  documents: {
    title: 'Supporting documents', lead: true, co: true, scope: 'documents',
    intro: 'Upload clear photos or scans. PDF, JPG, PNG or HEIC, up to 10MB each. Your documents are encrypted and only visible to Irving & Keenan staff handling your application.',
    categories: [
      { id: 'photo_id', label: 'Photo identification', required: true, help: 'Driver’s licence or passport (current). Please cover or blur any number you are not required to show (see the note below).' },
      { id: 'income', label: 'Proof of income', required: true, help: 'For example two recent payslips, a recent bank statement showing income, a Centrelink income statement, or accountant/tax documents if self-employed.' },
      { id: 'rental', label: 'Rental ledger or reference (optional)', required: false, help: 'A current rental ledger helps us process your application faster.' },
      { id: 'bond', label: 'Bond assistance paperwork (if applicable)', required: false },
      { id: 'other', label: 'Anything else that supports your application (optional)', required: false },
    ],
    fields: [],
  },
  references: {
    title: 'References', lead: true, co: true, scope: 'applicant',
    intro: 'We contact your listed landlord, employer and personal referees only to assess this application.',
    fields: [
      { name: 'refs.personal', label: 'Personal referees (not family)', type: 'list', min: 1, max: 2, itemLabel: 'Referee', fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, max: 120, half: true },
        { name: 'relationship', label: 'How do they know you?', type: 'text', required: true, max: 60, half: true },
        { name: 'phone', label: 'Phone', type: 'tel', required: true, max: 20, half: true, pattern: '^[0-9 +()-]{8,20}$' },
      ] },
      { name: 'refs.consent', label: 'I consent to Irving & Keenan contacting the landlords, property managers, employers and referees I have listed, to verify my information and assess this application.', type: 'checkbox', required: true, mustBeTrue: true },
    ],
  },
  review: { title: 'Review', lead: true, co: true, scope: 'review', fields: [] },
  declaration: { title: 'Declarations & submit', lead: true, co: true, scope: 'declaration', fields: [] },
};

export const LEAD_STEPS = Object.keys(STEPS).filter((k) => STEPS[k].lead);
export const CO_STEPS = Object.keys(STEPS).filter((k) => STEPS[k].co);

// Draft declarations, plain-English, versioned, NOT yet approved (see docs/06 §Declarations).
export const DECLARATIONS = [
  { id: 'true', text: 'The information I have given in this application is true, correct and not misleading.' },
  { id: 'notBankrupt', text: 'I am not currently an undischarged bankrupt.', review: true },
  { id: 'notAgreement', text: 'I understand this application is not a Residential Tenancy Agreement and does not give me any right to occupy the property. The lessor may or may not accept my application.' },
  { id: 'condition', text: 'Having inspected the property, I understand that if my application is successful I will take possession in the condition it was in when I inspected it, unless agreed otherwise in writing.', review: true },
  { id: 'privacy', text: 'I have read the Application Privacy Collection Notice, including how my information may be disclosed to the lessor, my referees and tenancy database operators.' },
  { id: 'database', text: 'I have read the Notice of Use of Residential Tenancy Databases (section 82C, Residential Tenancies Act 1987).' },
  { id: 'electronic', text: 'I agree to sign this application electronically, and that typing my full name below has the same effect as my handwritten signature.', review: true },
];

export const APPLICATION_STATUSES = {
  draft: { label: 'Draft', applicant: 'In progress' },
  awaiting_applicants: { label: 'Awaiting other applicants', applicant: 'Waiting for other applicants' },
  submitted: { label: 'Submitted', applicant: 'Submitted' },
  under_review: { label: 'Under review', applicant: 'Being reviewed' },
  info_requested: { label: 'Further information requested', applicant: 'More information needed' },
  finalised: { label: 'Finalised', applicant: 'Finalised' },
  withdrawn: { label: 'Withdrawn', applicant: 'Withdrawn' },
};

// ─── Validation ───────────────────────────────────────────────────────────
export const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
export function set(obj, path, value) {
  const keys = path.split('.'); let o = obj;
  keys.slice(0, -1).forEach((k) => { if (typeof o[k] !== 'object' || o[k] === null || Array.isArray(o[k])) o[k] = {}; o = o[k]; });
  o[keys.at(-1)] = value;
}
export function isVisible(field, data) {
  if (!field.when) return true;
  const [dep, val] = field.when;
  const v = get(data, dep);
  return Array.isArray(val) ? val.includes(v) : v === val;
}
const empty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

function checkValue(f, v, today) {
  if (empty(v)) return f.required ? 'This field is required.' : null;
  const s = String(v);
  if (f.max && s.length > f.max) return `Please keep this under ${f.max} characters.`;
  switch (f.type) {
    case 'email': if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'Enter a valid email address, like name@example.com.'; break;
    case 'tel': if (!/^[0-9 +()-]{8,20}$/.test(s)) return 'Enter a valid phone number.'; break;
    case 'money': if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return 'Enter an amount in dollars, e.g. 650.'; break;
    case 'number': { const n = Number(s); if (!Number.isInteger(n)) return 'Enter a whole number.'; if (f.min != null && n < f.min) return `Must be at least ${f.min}.`; if (f.max != null && n > f.max) return `Must be ${f.max} or less.`; break; }
    case 'date': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) return 'Enter a valid date.';
      if (f.future && s < today) return 'Choose today or a future date.';
      if (f.adult) { const d = new Date(s); const a = new Date(today); a.setFullYear(a.getFullYear() - 18); if (d > a) return 'Applicants must be 18 or over.'; if (d.getFullYear() < 1900) return 'Enter a valid date of birth.'; }
      break;
    }
    case 'month': if (!/^\d{4}-\d{2}$/.test(s)) return 'Enter a month and year.'; break;
    case 'select': case 'radio': { const opts = f.options.map((o) => (Array.isArray(o) ? o[0] : o)); if (!opts.includes(s)) return 'Choose one of the options.'; break; }
    case 'checkboxes': { const opts = f.options.map((o) => o[0]); if (!Array.isArray(v) || v.some((x) => !opts.includes(x))) return 'Choose from the options.'; break; }
    case 'checkbox': if (typeof v !== 'boolean') return 'Invalid value.'; if (f.mustBeTrue && v !== true) return 'Please tick to continue.'; break;
    default: break;
  }
  if (f.pattern && !new RegExp(f.pattern).test(s)) return 'Check the format of this field.';
  return null;
}

export function validateFields(fields, data, today = new Date().toISOString().slice(0, 10)) {
  const errors = {};
  for (const f of fields) {
    if (!f.name || !isVisible(f, data)) continue;
    const v = get(data, f.name);
    if (f.type === 'list') {
      const arr = Array.isArray(v) ? v : [];
      if (arr.length < (f.min || 0)) errors[f.name] = `Add at least ${f.min} ${f.itemLabel.toLowerCase()}${f.min > 1 ? 's' : ''}.`;
      if (arr.length > f.max) errors[f.name] = `Add no more than ${f.max}.`;
      arr.forEach((item, i) => f.fields.forEach((sf) => { const e = checkValue(sf, item?.[sf.name], today); if (e) errors[`${f.name}.${i}.${sf.name}`] = e; }));
      continue;
    }
    if (f.type === 'checkbox' && f.required && v !== true) { errors[f.name] = 'Please tick to continue.'; continue; }
    const e = checkValue(f, v, today);
    if (e) errors[f.name] = e;
  }
  return errors;
}

// Strip anything not declared in the schema and coerce types (mass-assignment protection).
export function sanitise(fields, input) {
  const out = {};
  for (const f of fields) {
    if (!f.name) continue;
    let v = get(input, f.name);
    if (v === undefined) continue;
    if (f.type === 'list') {
      v = (Array.isArray(v) ? v : []).slice(0, f.max).map((item) => {
        const o = {}; f.fields.forEach((sf) => { const x = item?.[sf.name]; if (x !== undefined) o[sf.name] = String(x).slice(0, sf.max || 200).trim(); }); return o;
      });
    } else if (f.type === 'checkbox') v = v === true || v === 'true' || v === 'on';
    else if (f.type === 'checkboxes') v = (Array.isArray(v) ? v : [v]).map(String).slice(0, 10);
    else v = String(v).slice(0, (f.max || 200) + 1).trim();
    set(out, f.name, v);
  }
  return out;
}

export function deepMerge(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(out[k], v) : v;
  return out;
}
