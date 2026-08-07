import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTip } from "@workspace/api-client-react";

const tipSchema = z.object({
  nameOrAlias: z.string().optional(),
  contactEmail: z.string().email("Valid email required for contact, or leave blank").optional().or(z.literal("")),
  message: z.string().min(10, "Message must be at least 10 characters"),
  provenance: z.string().optional(),
});

type TipForm = z.infer<typeof tipSchema>;

export default function ReaderDesk() {
  useEffect(() => {
    document.title = "Reader Desk | RSR Crime Division — Los Angeles";
  }, []);

  const [tipSuccess, setTipSuccess] = useState(false);

  const tipForm = useForm<TipForm>({
    resolver: zodResolver(tipSchema),
    defaultValues: {
      nameOrAlias: "",
      contactEmail: "",
      message: "",
      provenance: ""
    }
  });

  const createTip = useCreateTip();

  const onTipSubmit = (data: TipForm) => {
    createTip.mutate({
      data: {
        nameOrAlias: data.nameOrAlias || null,
        contactEmail: data.contactEmail || null,
        message: data.message,
        provenance: data.provenance || null
      }
    }, {
      onSuccess: () => {
        setTipSuccess(true);
        tipForm.reset();
      }
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      <header className="mb-12 border-b border-black pb-8 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 block">
          Tips · Corrections · Correspondence
        </span>
        <h1 className="text-4xl sm:text-5xl font-headline font-bold uppercase tracking-widest mb-6">
          Reader Desk
        </h1>
        <p className="text-base font-serif max-w-2xl mx-auto text-gray-600">
          Crime Wire welcomes reader tips, document leads, corrections, and correspondence. We review all submissions. This is not an anonymous or secure document system.
        </p>
      </header>

      <div className="bg-white border-4 border-black p-6 sm:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        {tipSuccess ? (
          <div className="text-center py-16">
            <h3 className="text-3xl font-headline font-bold uppercase tracking-widest mb-4 border-y-2 border-black inline-block py-3">
              Tip Received — File Open
            </h3>
            <p className="mt-4 font-serif text-lg">Your message has been logged with the Bureau Desk.</p>
            <button 
              onClick={() => setTipSuccess(false)}
              className="mt-10 bg-black text-white px-8 py-3 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              Submit Another
            </button>
          </div>
        ) : (
          <form onSubmit={tipForm.handleSubmit(onTipSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2">Name or Alias</label>
                <input 
                  type="text" 
                  {...tipForm.register("nameOrAlias")}
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2">Contact Email</label>
                <input 
                  type="email" 
                  {...tipForm.register("contactEmail")}
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                />
                {tipForm.formState.errors.contactEmail && (
                  <p className="text-xs text-red-600 font-bold mt-2 uppercase">{tipForm.formState.errors.contactEmail.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">Message *</label>
              <textarea 
                {...tipForm.register("message")}
                rows={6}
                className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white resize-none"
              ></textarea>
              {tipForm.formState.errors.message && (
                <p className="text-xs text-red-600 font-bold mt-2 uppercase">{tipForm.formState.errors.message.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2">Provenance / Source</label>
              <input 
                type="text" 
                {...tipForm.register("provenance")}
                placeholder="Describe the source, date, or origin of any documents"
                className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white placeholder:text-gray-400"
              />
            </div>

            <div className="border border-black p-5 bg-gray-50 text-xs font-serif leading-relaxed text-gray-700">
              <strong className="block mb-2 font-sans font-bold uppercase tracking-widest text-black">Notice:</strong>
              Crime Wire does not promise anonymity and does not operate a secure document drop. Do not submit documents you cannot share through ordinary channels. Contact information is used only to follow up on this tip. It is not shared, sold, or used for any other purpose.
            </div>

            <button 
              type="submit" 
              disabled={createTip.isPending}
              className="w-full bg-black text-white py-4 mt-2 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createTip.isPending ? "Transmitting..." : "Submit to Bureau Desk"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
