import { useEffect, useState, useCallback } from 'react'
import { supabase, logActivity } from '../lib/supabase.js'
import { useAuth } from '../lib/auth.jsx'
import { Avatar, EmptyState, Spinner, PageHeader, Modal } from '../components/ui.jsx'
import { Icon } from '../lib/icons.jsx'
import { prettyDate, todayISO } from '../lib/util.js'

const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-CA', { maximumFractionDigits: 2 })

export default function Budget() {
  const { user, profiles, can } = useAuth()
  const canEdit = can('budget', 'edit')
  const [expenses, setExpenses] = useState([])
  const [allocations, setAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const byId = (id) => profiles.find((p) => p.id === id)

  const load = useCallback(async () => {
    const [e, a] = await Promise.all([
      supabase.from('expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('budget_allocations').select('*').order('created_at'),
    ])
    setExpenses(e.data || [])
    setAllocations(a.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('budget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_allocations' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  async function removeExpense(id) {
    await supabase.from('expenses').delete().eq('id', id)
  }

  if (loading) return <Spinner />

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const people = profiles.length || 1
  const share = total / people
  const paid = {}
  profiles.forEach((p) => { paid[p.id] = 0 })
  expenses.forEach((e) => { if (e.paid_by != null && paid[e.paid_by] != null) paid[e.paid_by] += Number(e.amount || 0) })
  const balances = profiles.map((p) => ({ p, net: (paid[p.id] || 0) - share }))
  const ower = balances.find((b) => b.net < -0.5)
  const owed = balances.find((b) => b.net > 0.5)

  return (
    <div>
      <PageHeader title="Budget" subtitle="What you're spending, who paid, and what it should sell for."
        action={canEdit && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add expense</button>} />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-faint mb-1">Total spent</p>
          <p className="font-display text-2xl">{money(total)}</p>
        </div>
        {profiles.map((p) => (
          <div key={p.id} className="card p-4">
            <p className="text-xs text-faint mb-1 flex items-center gap-1"><Avatar profile={p} size={16} /> {p.display_name} paid</p>
            <p className="font-display text-2xl">{money(paid[p.id] || 0)}</p>
          </div>
        ))}
      </div>

      {/* Settle up */}
      {ower && owed && Math.abs(ower.net) > 0.5 && (
        <div className="card p-4 mb-6 flex items-center gap-3 bg-accent-soft/40 border-accent/30">
          <Icon name="wallet" size={18} className="text-accent" />
          <p className="text-sm"><span className="font-medium">{ower.p.display_name}</span> owes <span className="font-medium">{owed.p.display_name}</span> <span className="font-medium">{money(Math.abs(ower.net))}</span> to settle up (50/50 split).</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses */}
        <div>
          <h2 className="font-display text-lg mb-3">Expenses</h2>
          {expenses.length === 0 ? (
            <EmptyState icon="wallet" title="No expenses yet" subtitle="Log fabric, samples, shoots — anything you spend." />
          ) : (
            <div className="card divide-y divide-line">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 group">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <p className="text-xs text-faint flex items-center gap-1.5">
                      {e.category && <span className="chip h-4 px-1.5 bg-canvas border border-line">{e.category}</span>}
                      {byId(e.paid_by) && <span className="flex items-center gap-1"><Avatar profile={byId(e.paid_by)} size={14} /> {byId(e.paid_by).display_name}</span>}
                      · {prettyDate(e.spent_on)}
                    </p>
                  </div>
                  <span className="text-sm font-medium shrink-0">{money(e.amount)}</span>
                  {canEdit && <button onClick={() => removeExpense(e.id)} className="opacity-0 group-hover:opacity-100 text-faint hover:text-accent"><Icon name="trash" size={14} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Allocations + Calculator */}
        <div className="space-y-6">
          <Allocations allocations={allocations} expenses={expenses} user={user} canEdit={canEdit} />
          <PricingCalculator />
        </div>
      </div>

      {adding && <ExpenseModal profiles={profiles} user={user} onClose={() => setAdding(false)} />}
    </div>
  )
}

function Allocations({ allocations, expenses, user, canEdit = true }) {
  const [cat, setCat] = useState('')
  const [amt, setAmt] = useState('')
  const spentByCat = {}
  expenses.forEach((e) => { const c = e.category || 'Uncategorised'; spentByCat[c] = (spentByCat[c] || 0) + Number(e.amount || 0) })

  async function add(e) {
    e.preventDefault()
    if (!cat.trim() || !amt) return
    await supabase.from('budget_allocations').insert({ category: cat.trim(), amount: Number(amt), created_by: user.id })
    setCat(''); setAmt('')
  }
  const remove = (id) => supabase.from('budget_allocations').delete().eq('id', id)

  return (
    <div className="card p-4">
      <h2 className="font-display text-lg mb-3">Category budgets</h2>
      <div className="space-y-3 mb-4">
        {allocations.length === 0 && <p className="text-sm text-faint">Set budgets per category to track against spend.</p>}
        {allocations.map((a) => {
          const spent = spentByCat[a.category] || 0
          const pct = a.amount > 0 ? Math.min(100, Math.round((spent / a.amount) * 100)) : 0
          const over = spent > a.amount
          return (
            <div key={a.id} className="group">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium">{a.category}</span>
                <span className={over ? 'text-accent' : 'text-muted'}>{money(spent)} / {money(a.amount)}
                  {canEdit && <button onClick={() => remove(a.id)} className="opacity-0 group-hover:opacity-100 text-faint hover:text-accent ml-2"><Icon name="close" size={12} /></button>}
                </span>
              </div>
              <div className="h-1.5 bg-canvas rounded-full overflow-hidden"><div className={`h-full rounded-full ${over ? 'bg-accent' : 'bg-accent/70'}`} style={{ width: `${pct}%` }} /></div>
            </div>
          )
        })}
      </div>
      {canEdit && (
      <form onSubmit={add} className="flex gap-2">
        <input className="input h-9 text-sm flex-1 min-w-0" placeholder="Category" value={cat} onChange={(e) => setCat(e.target.value)} />
        <input className="input h-9 text-sm w-24 min-w-0" type="number" placeholder="$" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <button className="btn btn-soft h-9 px-3 shrink-0" disabled={!cat.trim() || !amt}><Icon name="plus" size={15} /></button>
      </form>
      )}
    </div>
  )
}

function PricingCalculator() {
  const [f, setF] = useState({ fabric: '', labour: '', trims: '', shipping: '', other: '' })
  const [margin, setMargin] = useState(60)
  const cost = Object.values(f).reduce((s, v) => s + (Number(v) || 0), 0)
  const retail = margin < 100 ? cost / (1 - margin / 100) : cost
  const profit = retail - cost

  const Field = ({ k, label }) => (
    <div>
      <label className="label">{label}</label>
      <input className="input h-9 text-sm" type="number" placeholder="$0" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  )

  return (
    <div className="card p-4">
      <h2 className="font-display text-lg mb-1">Cost → price</h2>
      <p className="text-xs text-faint mb-3">Per-unit landed cost to retail price.</p>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <Field k="fabric" label="Fabric" />
        <Field k="labour" label="Labour" />
        <Field k="trims" label="Trims" />
        <Field k="shipping" label="Shipping" />
        <Field k="other" label="Other" />
        <div>
          <label className="label">Margin %</label>
          <input className="input h-9 text-sm" type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
        </div>
      </div>
      <div className="rounded-xl bg-canvas border border-line p-3 grid grid-cols-3 text-center">
        <div><p className="text-xs text-faint">Unit cost</p><p className="font-display text-lg">{money(cost)}</p></div>
        <div><p className="text-xs text-faint">Profit</p><p className="font-display text-lg">{money(profit)}</p></div>
        <div><p className="text-xs text-faint">Retail</p><p className="font-display text-lg text-accent">{money(retail)}</p></div>
      </div>
    </div>
  )
}

function ExpenseModal({ profiles, user, onClose }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [paidBy, setPaidBy] = useState(user.id)
  const [spentOn, setSpentOn] = useState(todayISO())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!title.trim() || !amount) return
    setBusy(true)
    const { data, error } = await supabase.from('expenses').insert({
      title: title.trim(), amount: Number(amount), category: category.trim() || null,
      paid_by: paidBy || null, spent_on: spentOn, note: note.trim() || null, created_by: user.id,
    }).select().single()
    if (!error && data) logActivity({ verb: 'added', entity_type: 'expense', entity_id: data.id, summary: `logged an expense: ${data.title} (${money(data.amount)})` })
    setBusy(false); onClose()
  }

  return (
    <Modal open onClose={onClose} title="Add expense"
      footer={<><button onClick={onClose} className="btn btn-soft">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={!title.trim() || !amount || busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">What for</label>
            <input className="input" autoFocus placeholder="e.g. Cotton fabric — 20m" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><label className="label">Amount ($)</label>
            <input className="input" type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="label">Category</label>
            <input className="input" placeholder="Fabric, Samples, Photography…" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div><label className="label">Paid by</label>
            <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0"><label className="label">Date</label>
            <input className="input min-w-0" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} /></div>
        </div>
        <div><label className="label">Note (optional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
    </Modal>
  )
}
