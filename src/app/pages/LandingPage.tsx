'use client'

import { useNavigate } from "react-router";
import { HeroFuturistic } from '@/components/ui/HeroFuturistic';
 
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="w-full h-screen bg-slate-950 overflow-hidden">
        <HeroFuturistic onExplore={() => navigate('/app')} />
    </div>
  )
}
