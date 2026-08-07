import { useEffect } from 'react';

export default function Standards() {
  useEffect(() => {
    document.title = "Editorial Standards | RSR Crime Division — Los Angeles";
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <header className="mb-16 border-b border-black pb-8">
        <h1 className="text-4xl sm:text-5xl font-headline font-bold uppercase tracking-widest mb-4">
          Editorial Standards
        </h1>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
          RSR Crime Division · Crime Wire
        </p>
      </header>

      <div className="space-y-20">
        
        <section>
          <h2 className="font-headline font-bold text-2xl uppercase tracking-widest border-b border-black pb-3 mb-8">
            Evidence Classification
          </h2>
          <div className="space-y-8">
            {[
              {
                term: "Documented",
                def: "Material for which a contemporaneous source document has been identified and reviewed. Named, dated, and traceable."
              },
              {
                term: "Corroborated",
                def: "Material supported by two or more independent sources. Sources are identified by type; named where possible."
              },
              {
                term: "Reported",
                def: "Material drawn from prior published reporting. The reporting outlet and date are noted. Not independently verified by this bureau."
              },
              {
                term: "Disputed",
                def: "Material for which contradictory accounts exist in the record. Both accounts are noted; neither is treated as established."
              },
              {
                term: "Unverified",
                def: "Material received but not yet confirmed against a source. Held in the file, not published as fact."
              },
              {
                term: "Inference",
                def: "Logical conclusion drawn from documented material. Labeled explicitly. Not treated as an established fact."
              }
            ].map((item) => (
              <div key={item.term} className="flex flex-col sm:flex-row gap-2 sm:gap-8 items-start border-l-2 border-black pl-4">
                <span className="sm:w-48 font-sans font-bold uppercase tracking-widest text-sm shrink-0">
                  {item.term}
                </span>
                <p className="font-serif text-lg text-gray-800 leading-relaxed">
                  {item.def}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-headline font-bold text-2xl uppercase tracking-widest border-b border-black pb-3 mb-6">
            Source Chain Rules
          </h2>
          <div className="font-serif text-lg text-gray-800 leading-relaxed space-y-6">
            <p>
              Every claim in a Crime Wire investigation is tracked to its source. Sources are classified by type: contemporaneous document, institutional record, oral account, published reporting, inference.
            </p>
            <p>
              Oral accounts are noted as such and not treated as documentary evidence unless supported by a record. A chain of custody for claims is maintained in the case file.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-headline font-bold text-2xl uppercase tracking-widest border-b border-black pb-3 mb-6">
            Correction Policy
          </h2>
          <div className="font-serif text-lg text-gray-800 leading-relaxed space-y-6">
            <p>
              Corrections are published in the Reader Desk section and noted inline where the original error appeared. Crime Wire does not delete or silently alter published material. Corrections include the original error and the corrected information.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
