import CopyableText from "./CopyableText";

type P = { id: string; name: string; price: number; currency: string; thumbnail_url?: string; description?: string };
export default function PackageCard({ pkg }: { pkg: P }) {
  return (
    <div className="grid grid-cols-[80px,1fr,auto] gap-3 items-center rounded-2xl shadow p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur">
      <img src={pkg.thumbnail_url || 'https://via.placeholder.com/80'} className="w-20 h-20 rounded-xl object-cover" />
      <div className="min-w-0">
          <div className="font-medium truncate">{pkg.name}</div>
          <div className="text-sm opacity-70 line-clamp-2">{pkg.description || ''}</div>
          <div className="mt-1 text-sm">
            <CopyableText value={`${pkg.price} ${pkg.currency}`} />
          </div>
      </div>
      <button className="btn bg-blue-600 text-white text-sm hover:bg-blue-700">Details</button>
    </div>
  );
}
