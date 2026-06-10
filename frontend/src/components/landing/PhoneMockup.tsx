import type { ReactNode } from 'react'

interface PhoneMockupProps {
  children: ReactNode
  className?: string
  maxWidth?: number
}

export default function PhoneMockup({ children, className = '', maxWidth = 280 }: PhoneMockupProps) {
  return (
    <div
      className={`relative mx-auto p-3 pb-3.5 bg-gradient-to-br from-stone-800 to-stone-900 rounded-[2.5rem] shadow-[0_30px_60px_rgba(46,42,36,0.25)] ${className}`}
      style={{ maxWidth }}
    >
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-black rounded-full z-10"
        aria-hidden
      />
      <div className="rounded-[2rem] overflow-hidden bg-cream aspect-[9/19] flex flex-col">
        {children}
      </div>
    </div>
  )
}
