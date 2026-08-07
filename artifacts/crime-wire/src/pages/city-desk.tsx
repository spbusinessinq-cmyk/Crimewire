import { useEffect } from 'react';

export default function CityDesk() {
  useEffect(() => {
    document.title = "City Desk | RSR Crime Division — Los Angeles";
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <header className="mb-12 border-b border-black pb-8">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 block">
          Current Reporting
        </span>
        <h1 className="text-4xl sm:text-5xl font-headline font-bold uppercase tracking-widest mb-6">
          City Desk
        </h1>
        <p className="text-base font-serif max-w-2xl text-gray-600">
          Los Angeles crime news, court outcomes, and incident reports. Filed as material is confirmed.
        </p>
      </header>

      <div className="border border-dashed border-gray-400 bg-gray-50 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
        <span className="bg-black text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 mb-4">
          Pending
        </span>
        <h2 className="font-headline font-bold text-2xl uppercase tracking-widest mb-3">
          City Desk — Pending Material
        </h2>
        <p className="font-serif text-gray-600 max-w-md">
          No briefs filed at this time. Current reporting will appear here when confirmed material is available.
        </p>
      </div>
    </div>
  );
}
