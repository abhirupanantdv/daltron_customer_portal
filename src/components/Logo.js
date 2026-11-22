import logo from "@/logo/anantdvlogo-removebg-preview.png";

export default function Logo({ className }) {
  const src = typeof logo === "string" ? logo : logo.src;
  return <img src={src} alt="AnantDV" width={224} height={98} className={className} />;
}
