"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  
  
  // Close mobile sidebar when screen resizes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileSidebarOpen])
  
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - fixed position */}
      <aside className="hidden md:block fixed left-0 top-0 bottom-0 w-[220px] lg:w-[280px] z-30 border-r bg-background">
        <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin">
          <Sidebar />
        </div>
      </aside>
      
      {/* Main Content Area - this wrapper ensures proper positioning relative to the fixed sidebar */}
      <div className="flex flex-col min-h-screen md:pl-[220px] lg:pl-[280px]">
        {/* Mobile Header with Hamburger */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-4 md:hidden">
          <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col p-0 w-[280px] max-w-[85vw]">
              <div className="overflow-y-auto overflow-x-hidden h-full scrollbar-thin">
                <Sidebar />
              </div>
            </SheetContent>
          </Sheet>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 w-full py-6 px-4 md:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}