export const meta = {
  name: 'walwarden-delivery-train',
  description: 'Walwarden preset of the generic delivery-train: PR-triage → plan → architecture → UX → implement → adversarial review (every stage) → fix → auto-merge across all unblocked walwarden tickets',
  whenToUse:
    'Knock out the remaining walwarden tickets autonomously. Invoke: Workflow({name:"walwarden-delivery-train"}) for everything unblocked, args:{tickets:[264,{n:330,hint:"..."}]} to pin a list, args:{triagePrs:false} to skip PR triage. (Thin wrapper over the generic "delivery-train" engine with project:"walwarden".)',
  phases: [{ title: 'Delivery train' }],
}

// Walwarden is a registered project in the delivery-train engine; just delegate.
const RAW = args && !Array.isArray(args) ? args : { tickets: args }
return await workflow('delivery-train', { ...RAW, project: 'walwarden' })
