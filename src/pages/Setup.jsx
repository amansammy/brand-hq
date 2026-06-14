export default function Setup() {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="card max-w-xl w-full p-8">
        <div className="h-11 w-11 rounded-xl bg-ink text-canvas flex items-center justify-center font-display text-xl mb-5">B</div>
        <h1 className="font-display text-2xl mb-2">Almost there — connect Supabase</h1>
        <p className="text-sm text-muted mb-5">
          Brand HQ needs your free Supabase project keys before it can run. It takes about 10 minutes.
        </p>
        <ol className="text-sm space-y-3 mb-6">
          <li className="flex gap-3"><span className="chip bg-accent-soft text-accent">1</span>
            Create a free project at <span className="font-medium">supabase.com</span>.</li>
          <li className="flex gap-3"><span className="chip bg-accent-soft text-accent">2</span>
            In <span className="font-medium">SQL Editor</span>, run the contents of <code className="px-1 bg-canvas rounded">supabase/schema.sql</code>.</li>
          <li className="flex gap-3"><span className="chip bg-accent-soft text-accent">3</span>
            Copy <code className="px-1 bg-canvas rounded">.env.example</code> to <code className="px-1 bg-canvas rounded">.env</code> and paste your Project URL + anon key.</li>
          <li className="flex gap-3"><span className="chip bg-accent-soft text-accent">4</span>
            Restart <code className="px-1 bg-canvas rounded">npm run dev</code>.</li>
        </ol>
        <p className="text-xs text-faint">Full walkthrough is in <code>README.md</code>.</p>
      </div>
    </div>
  )
}
