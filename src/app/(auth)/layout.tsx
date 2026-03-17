export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen mesh-gradient-bg relative overflow-hidden">
      {/* Blobs decorativos */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-bella-rose-300 rounded-full blur-[150px] opacity-30 animate-blob" />
      <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] bg-bella-violet-300 rounded-full blur-[150px] opacity-25 animate-blob animation-delay-2000" />

      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
