/** Pronto Eventi logosundaki iki kişi figürü: mor + turkuaz */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* sol kişi — mor */}
      <circle cx="8.9" cy="6.1" r="3.1" fill="#8B5BFF" />
      <path d="M2.7 20.2c0-3.5 2.8-6.3 6.2-6.3s6.2 2.8 6.2 6.3v1H2.7v-1Z" fill="#8B5BFF" />
      {/* sağ kişi — turkuaz, hafif önde */}
      <circle cx="16.5" cy="6.7" r="2.7" fill="#00C0B8" />
      <path d="M11.8 21.2c0-3 2.3-5.5 5.2-5.5s5.2 2.5 5.2 5.5v.8h-10.4v-.8Z" fill="#00C0B8" />
    </svg>
  );
}
