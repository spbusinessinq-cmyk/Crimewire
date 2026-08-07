import { useEffect } from 'react';
import { Link } from 'wouter';

export default function Edition() {
  useEffect(() => {
    document.title = "Current Edition | Los Angeles Crime Wire";
  }, []);

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center px-4 py-20 min-h-[60vh]">
      <div className="text-center max-w-lg mx-auto border-4 border-black p-10 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h1 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-6">
          Los Angeles Crime Wire · Current Edition
        </h1>
        <h2 className="text-4xl sm:text-5xl font-headline font-bold uppercase tracking-widest mb-8">
          Latest Edition
        </h2>
        <div className="border border-dashed border-gray-400 bg-gray-50 py-10 px-6 mb-8">
          <p className="font-serif text-lg text-gray-600">
            Edition pending — check back Thursday.
          </p>
        </div>
        <Link 
          href="/crime-wire" 
          className="inline-block bg-black text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors w-full"
        >
          Subscribe to The Thursday Drop
        </Link>
      </div>
    </div>
  );
}
