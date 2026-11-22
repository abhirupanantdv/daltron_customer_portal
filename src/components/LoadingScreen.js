import Logo from "@/components/Logo";

export default function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-brand text-white" role="status">
      <Logo className="cove-logo h-20 w-auto sm:h-24" />
      <p className="mt-8 text-xs uppercase tracking-[0.28em] text-white/70">Customer support</p>
      <div className="mt-6 h-0.5 w-36 overflow-hidden rounded-full bg-white/15">
        <div className="cove-bar h-full w-1/3 rounded-full bg-white" />
      </div>
      <p className="sr-only">Loading AnantDV customer support</p>
    </div>
  );
}
