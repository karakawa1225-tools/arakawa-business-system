export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-navy-950">{title}</h1>
      {description && <p className="mt-1 text-sm text-gunmetal-600">{description}</p>}
    </div>
  );
}
