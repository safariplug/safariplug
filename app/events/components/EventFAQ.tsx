export default function EventFAQ({
  title,
  venue,
  city,
}: {
  title: string;
  venue: string | null;
  city: string | null;
}) {

  const faq = [
    {
      question: `What is ${title}?`,
      answer: `${title} is an experience listed on SafariPlug for people looking for things to do in East Africa.`,
    },
    {
      question: `Where is ${title} located?`,
      answer: `${title} takes place at ${venue || "the listed venue"}.`,
    },
    {
      question: `How do I attend ${title}?`,
      answer: `Visit the SafariPlug experience page for booking details and organizer information.`,
    },
  ];


  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((item)=>({
              "@type":"Question",
              name:item.question,
              acceptedAnswer:{
                "@type":"Answer",
                text:item.answer,
              }
            }))
          }),
        }}
      />

      <section className="mt-8 rounded-3xl bg-white p-8 shadow-sm">

        <h2 className="text-3xl font-black">
          Frequently Asked Questions
        </h2>

        <div className="mt-6 space-y-5">

          {faq.map((item)=>(
            <div key={item.question}>

              <h3 className="font-black">
                {item.question}
              </h3>

              <p className="mt-2 text-slate-600">
                {item.answer}
              </p>

            </div>
          ))}

        </div>

      </section>
    </>
  );
}