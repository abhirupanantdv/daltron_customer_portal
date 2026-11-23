import { useLayoutEffect, useRef } from "react";
import Lenis from "lenis";
import { pagePad } from "@/components/ui";

const FAQ = [
  {
    id: "hours",
    question: "When is the desk open?",
    answer: "Monday to Friday, 9:00–18:00 IST. The desk is closed Saturday and Sunday.",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
    alt: "A bright office with daylight coming through the windows",
  },
  {
    id: "after-hours",
    question: "What if I write after hours?",
    answer: "The message waits here. It is picked up the next weekday morning. Callbacks are placed only during desk hours.",
    image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80",
    alt: "Code on a laptop screen in low light",
  },
  {
    id: "ticket",
    question: "What do I need to open a ticket?",
    answer: "A subject, the project, your name and email, and what happened. Billing, account, and order requests also need a reference. A callback needs a phone number.",
    image: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1400&q=80",
    alt: "Hands typing a request on a laptop",
  },
  {
    id: "reply",
    question: "How do I get a reply?",
    answer: "Choose chat, email, or a call on the ticket. Chat stays on that ticket. Email goes to the address you gave. A call is a callback on a weekday.",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=80",
    alt: "People in conversation around a meeting table",
  },
  {
    id: "more",
    question: "Can I add more after I send it?",
    answer: "Yes. Open the ticket and send a message. Screenshots and a short video can be added when you create it.",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80",
    alt: "A group gathered around a laptop, adding to the work",
  },
  {
    id: "reopen",
    question: "What if a resolved ticket comes back?",
    answer: "Send a message in the chat. That opens the ticket again.",
    image: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1400&q=80",
    alt: "A team back at their desks in a busy office",
  },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HomeFaq() {
  const rootRef = useRef(null);
  const lenisRef = useRef(null);
  const placeRef = useRef(() => {});

  useLayoutEffect(() => {
    const section = rootRef.current;
    const wrapper = section?.closest(".page-layer");
    const content = wrapper?.firstElementChild;
    if (!section || !(wrapper instanceof HTMLElement) || !(content instanceof HTMLElement)) return undefined;

    const items = [...section.querySelectorAll("[data-faq-item]")];
    const reduce = prefersReducedMotion();

    function place() {
      if (reduce) {
        items.forEach((item) => {
          item.style.opacity = "1";
          item.style.transform = "none";
        });
        return;
      }
      const rootBox = wrapper.getBoundingClientRect();
      const start = wrapper.clientHeight * 0.92;
      const end = wrapper.clientHeight * 0.55;
      items.forEach((item) => {
        const distance = item.getBoundingClientRect().top - rootBox.top;
        const progress = Math.min(1, Math.max(0, (start - distance) / (start - end)));
        const eased = 1 - (1 - progress) ** 3;
        item.style.opacity = String(eased);
        item.style.transform = `translate3d(0, ${(1 - eased) * 36}px, 0)`;
      });
    }

    placeRef.current = place;
    if (reduce) {
      place();
      return undefined;
    }

    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf: true,
      lerp: 0.1,
    });
    lenisRef.current = lenis;
    const seen = new IntersectionObserver(place, { root: wrapper, threshold: [0, 0.25, 0.6, 1] });
    items.forEach((item) => seen.observe(item));
    lenis.on("scroll", place);
    wrapper.addEventListener("scroll", place, { passive: true });
    place();

    return () => {
      placeRef.current = () => {};
      lenisRef.current = null;
      seen.disconnect();
      wrapper.removeEventListener("scroll", place);
      lenis.destroy();
      items.forEach((item) => {
        item.style.opacity = "";
        item.style.transform = "";
      });
    };
  }, []);

  return (
    <section ref={rootRef} aria-labelledby="faq-heading" className="w-full border-t border-ink/10">
      <div className={`${pagePad} py-14 sm:py-16`}>
        <div data-faq-item className="max-w-xl">
          <h2 id="faq-heading" className="font-display text-4xl tracking-tight sm:text-5xl">
            Questions
          </h2>
          <p className="mt-3 text-sm leading-7 text-mute">Short answers before you open a ticket.</p>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {FAQ.map((item) => (
            <li key={item.id} data-faq-item className="group overflow-hidden rounded-3xl border border-ink/10 bg-surface shadow-[0_18px_40px_rgba(9,31,43,0.07)]">
              <div className="aspect-[16/10] overflow-hidden bg-mist">
                <img
                  src={item.image}
                  alt={item.alt}
                  width={1400}
                  height={875}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              </div>
              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <h3 className="font-display text-2xl tracking-tight text-balance">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-mute">{item.answer}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
